-- Move privileged RPC bodies into private schema and keep public RPC as SECURITY INVOKER wrappers.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.confirm_exchange_impl(p_exchange_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exchange public.exchanges%ROWTYPE;
  v_user_id uuid;
  v_both_confirmed boolean;
  v_item_ids uuid[];
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_exchange
  FROM public.exchanges
  WHERE id = p_exchange_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Exchange not found');
  END IF;

  IF v_exchange.initiator_id != v_user_id AND v_exchange.responder_id != v_user_id THEN
    RETURN jsonb_build_object('error', 'Not a participant');
  END IF;

  IF v_exchange.status = 'completed' THEN
    RETURN jsonb_build_object('completed', true, 'exchange_id', p_exchange_id);
  END IF;

  IF v_exchange.status != 'accepted' THEN
    RETURN jsonb_build_object('error', 'Exchange must be accepted before completion');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.items
    WHERE id = v_exchange.item_given
      AND user_id = v_exchange.initiator_id
  ) THEN
    RETURN jsonb_build_object('error', 'Invalid initiator item');
  END IF;

  IF v_exchange.item_received IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.items
    WHERE id = v_exchange.item_received
      AND user_id = v_exchange.responder_id
  ) THEN
    RETURN jsonb_build_object('error', 'Invalid responder item');
  END IF;

  IF v_user_id = v_exchange.initiator_id THEN
    v_exchange.initiator_confirmed := true;
  ELSE
    v_exchange.responder_confirmed := true;
  END IF;

  UPDATE public.exchanges
  SET
    initiator_confirmed = v_exchange.initiator_confirmed,
    responder_confirmed = v_exchange.responder_confirmed
  WHERE id = p_exchange_id;

  v_both_confirmed := v_exchange.initiator_confirmed AND v_exchange.responder_confirmed;

  IF v_both_confirmed THEN
    UPDATE public.exchanges
    SET status = 'completed', completed_at = now()
    WHERE id = p_exchange_id;

    v_item_ids := ARRAY[v_exchange.item_given, v_exchange.item_received]::uuid[];

    UPDATE public.items
    SET status = 'exchanged', updated_at = now()
    WHERE id = ANY(v_item_ids)
      AND id IS NOT NULL;

    UPDATE public.users
    SET total_exchanges = total_exchanges + 1,
        updated_at = now()
    WHERE id IN (v_exchange.initiator_id, v_exchange.responder_id);

    RETURN jsonb_build_object('completed', true, 'exchange_id', p_exchange_id);
  END IF;

  RETURN jsonb_build_object('completed', false, 'exchange_id', p_exchange_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.accept_match_impl(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_match public.matches%ROWTYPE;
  v_conversation_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.user_b != v_user_id THEN
    RAISE EXCEPTION 'Only the recipient can accept this match';
  END IF;

  IF v_match.status NOT IN ('pending', 'viewed', 'accepted') THEN
    RAISE EXCEPTION 'Match cannot be accepted from this state';
  END IF;

  UPDATE public.matches
  SET status = 'accepted'
  WHERE id = p_match_id;

  INSERT INTO public.conversations (match_id, user_a, user_b)
  VALUES (p_match_id, v_match.user_a, v_match.user_b)
  ON CONFLICT (match_id) DO UPDATE
    SET user_a = EXCLUDED.user_a,
        user_b = EXCLUDED.user_b
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.decline_match_impl(p_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_match public.matches%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.user_a != v_user_id AND v_match.user_b != v_user_id THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF v_match.status = 'accepted' THEN
    RAISE EXCEPTION 'Accepted matches cannot be declined';
  END IF;

  UPDATE public.matches
  SET status = 'declined'
  WHERE id = p_match_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_like_impl(
  p_liker_item_id uuid,
  p_owner_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
  v_match_id uuid;
  v_reciprocal_id uuid;
  v_conversation_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner_id
  FROM public.items
  WHERE id = p_owner_item_id
    AND status = 'active';

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF v_owner_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot like your own item';
  END IF;

  IF p_liker_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.items
    WHERE id = p_liker_item_id
      AND user_id = v_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid offered item';
  END IF;

  SELECT id INTO v_match_id
  FROM public.matches
  WHERE user_a = v_user_id
    AND user_b = v_owner_id
    AND item_b = p_owner_item_id
    AND status NOT IN ('declined', 'expired')
  LIMIT 1;

  IF v_match_id IS NULL THEN
    INSERT INTO public.matches (user_a, user_b, item_a, item_b, score, status)
    VALUES (v_user_id, v_owner_id, p_liker_item_id, p_owner_item_id, 50, 'pending')
    RETURNING id INTO v_match_id;
  END IF;

  SELECT id INTO v_reciprocal_id
  FROM public.matches
  WHERE user_a = v_owner_id
    AND user_b = v_user_id
    AND status IN ('pending', 'viewed')
  LIMIT 1;

  IF v_reciprocal_id IS NOT NULL THEN
    UPDATE public.matches
    SET status = 'accepted'
    WHERE id IN (v_match_id, v_reciprocal_id);

    INSERT INTO public.conversations (match_id, user_a, user_b)
    VALUES (v_match_id, v_user_id, v_owner_id)
    ON CONFLICT (match_id) DO UPDATE
      SET user_a = EXCLUDED.user_a,
          user_b = EXCLUDED.user_b
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_match_id,
    'accepted', v_reciprocal_id IS NOT NULL,
    'conversation_id', v_conversation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.find_wishlist_matches_impl()
RETURNS TABLE (
  other_user_id     uuid,
  other_first_name  text,
  other_last_name   text,
  other_rating      decimal,
  my_item_id        uuid,
  my_item_title     text,
  my_item_images    text[],
  their_item_id     uuid,
  their_item_title  text,
  their_item_images text[],
  match_score       int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH my_active_items AS (
    SELECT id, title, images
    FROM public.items
    WHERE user_id = v_user_id AND status = 'active'
  ),
  my_wishlist AS (
    SELECT title AS wanted_title
    FROM public.wishlists
    WHERE user_id = v_user_id
  )
  SELECT DISTINCT ON (u.id)
    u.id,
    u.first_name,
    u.last_name,
    u.rating,
    mi.id,
    mi.title,
    mi.images,
    ti.id,
    ti.title,
    ti.images,
    80::int
  FROM public.users u
  JOIN public.wishlists tw ON tw.user_id = u.id
  JOIN my_active_items mi ON (
    lower(mi.title) ILIKE '%' || lower(trim(tw.title)) || '%'
    OR lower(trim(tw.title)) ILIKE '%' || lower(mi.title) || '%'
  )
  CROSS JOIN my_wishlist mw
  JOIN public.items ti ON ti.user_id = u.id
    AND ti.status = 'active'
    AND (
      lower(ti.title) ILIKE '%' || lower(trim(mw.wanted_title)) || '%'
      OR lower(trim(mw.wanted_title)) ILIKE '%' || lower(ti.title) || '%'
    )
  WHERE u.id != v_user_id
    AND NOT private.is_blocked_bidirectional(v_user_id, u.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.status NOT IN ('declined', 'expired')
        AND (
          (m.user_a = v_user_id AND m.user_b = u.id)
          OR (m.user_a = u.id AND m.user_b = v_user_id)
        )
    )
  ORDER BY u.id
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION private.submit_review_impl(
  p_exchange_id uuid,
  p_rating int,
  p_comment text DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exchange public.exchanges%ROWTYPE;
  v_reviewed_id uuid;
  v_reviewer_id uuid;
  v_review public.reviews;
  v_avg_rating decimal(3,2);
  v_count int;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_exchange
  FROM public.exchanges
  WHERE id = p_exchange_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange not found';
  END IF;

  IF v_exchange.status != 'completed' THEN
    RAISE EXCEPTION 'Can only review completed exchanges';
  END IF;

  IF v_reviewer_id = v_exchange.initiator_id THEN
    v_reviewed_id := v_exchange.responder_id;
  ELSIF v_reviewer_id = v_exchange.responder_id THEN
    v_reviewed_id := v_exchange.initiator_id;
  ELSE
    RAISE EXCEPTION 'You are not a participant in this exchange';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE exchange_id = p_exchange_id AND reviewer_id = v_reviewer_id
  ) THEN
    RAISE EXCEPTION 'You have already reviewed this exchange';
  END IF;

  INSERT INTO public.reviews (exchange_id, reviewer_id, reviewed_id, rating, comment)
  VALUES (p_exchange_id, v_reviewer_id, v_reviewed_id, p_rating, p_comment)
  RETURNING * INTO v_review;

  SELECT COALESCE(avg(rating), 0)::decimal(3,2), count(*)
  INTO v_avg_rating, v_count
  FROM public.reviews
  WHERE reviewed_id = v_reviewed_id;

  UPDATE public.users
  SET rating = v_avg_rating,
      review_count = v_count,
      updated_at = now()
  WHERE id = v_reviewed_id;

  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_exchange(p_exchange_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.confirm_exchange_impl(p_exchange_id); $$;

CREATE OR REPLACE FUNCTION public.confirm_exchange(p_exchange_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.confirm_exchange_impl(p_exchange_id); $$;

CREATE OR REPLACE FUNCTION public.accept_match(p_match_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.accept_match_impl(p_match_id); $$;

CREATE OR REPLACE FUNCTION public.decline_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.decline_match_impl(p_match_id); $$;

CREATE OR REPLACE FUNCTION public.create_like(p_liker_item_id uuid, p_owner_item_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.create_like_impl(p_liker_item_id, p_owner_item_id); $$;

CREATE OR REPLACE FUNCTION public.find_wishlist_matches()
RETURNS TABLE (
  other_user_id     uuid,
  other_first_name  text,
  other_last_name   text,
  other_rating      decimal,
  my_item_id        uuid,
  my_item_title     text,
  my_item_images    text[],
  their_item_id     uuid,
  their_item_title  text,
  their_item_images text[],
  match_score       int
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT * FROM private.find_wishlist_matches_impl(); $$;

CREATE OR REPLACE FUNCTION public.find_wishlist_matches(p_user_id uuid)
RETURNS TABLE (
  other_user_id     uuid,
  other_first_name  text,
  other_last_name   text,
  other_rating      decimal,
  my_item_id        uuid,
  my_item_title     text,
  my_item_images    text[],
  their_item_id     uuid,
  their_item_title  text,
  their_item_images text[],
  match_score       int
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT * FROM private.find_wishlist_matches_impl(); $$;

CREATE OR REPLACE FUNCTION public.submit_review(p_exchange_id uuid, p_rating int, p_comment text DEFAULT NULL)
RETURNS public.reviews
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.submit_review_impl(p_exchange_id, p_rating, p_comment); $$;

CREATE OR REPLACE FUNCTION private.notify_match_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_user_id  uuid;
  v_actor_user_id   uuid;
  v_telegram_id     bigint;
  v_actor_name      text;
  v_event           text;
  v_internal_secret text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_event          := 'new_match';
    v_target_user_id := NEW.user_b;
    v_actor_user_id  := NEW.user_a;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    v_event          := 'match_accepted';
    v_target_user_id := NEW.user_a;
    v_actor_user_id  := NEW.user_b;
  ELSE
    RETURN NEW;
  END IF;

  SELECT telegram_id INTO v_telegram_id FROM public.users WHERE id = v_target_user_id;
  IF v_telegram_id IS NULL THEN RETURN NEW; END IF;
  SELECT first_name INTO v_actor_name FROM public.users WHERE id = v_actor_user_id;
  SELECT decrypted_secret INTO v_internal_secret FROM vault.decrypted_secrets WHERE name = 'internal_notify_secret';
  IF v_internal_secret IS NULL THEN v_internal_secret := 'MISSING_SECRET'; END IF;

  PERFORM extensions.net.http_post(
    url     := 'https://gleoaovlbiltiwcoxpes.supabase.co/functions/v1/notify-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_internal_secret),
    body    := jsonb_build_object('telegram_id', v_telegram_id, 'event', v_event, 'data', jsonb_build_object('name', COALESCE(v_actor_name, 'Someone')))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match ON public.matches;
CREATE TRIGGER trg_notify_match
  AFTER INSERT OR UPDATE OF status
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_match_event();

DROP FUNCTION IF EXISTS public.notify_match_event();

REVOKE ALL ON FUNCTION private.confirm_exchange_impl(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.accept_match_impl(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.decline_match_impl(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.create_like_impl(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.find_wishlist_matches_impl() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.submit_review_impl(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.notify_match_event() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.confirm_exchange_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.accept_match_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.decline_match_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_like_impl(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.find_wishlist_matches_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION private.submit_review_impl(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_exchange(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_exchange(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_like(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_wishlist_matches() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_wishlist_matches(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_review(uuid, integer, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.confirm_exchange(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_exchange(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_like(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, text) TO authenticated;
