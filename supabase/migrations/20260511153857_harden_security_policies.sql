-- Harden client-facing database actions.
-- The client must not be trusted to tell the database which user is acting.

-- ============================================================
-- Exchanges: confirm using auth.uid(), not a client-supplied user id
-- ============================================================

DROP FUNCTION IF EXISTS public.confirm_exchange(uuid, uuid);

CREATE OR REPLACE FUNCTION public.confirm_exchange(p_exchange_id uuid)
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

REVOKE ALL ON FUNCTION public.confirm_exchange(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_exchange(uuid) TO authenticated;

-- ============================================================
-- Messages: sender must be a conversation participant
-- ============================================================

DROP POLICY IF EXISTS "Auth users send messages as self" ON public.messages;
DROP POLICY IF EXISTS "Auth users mark messages read in own conversations" ON public.messages;

CREATE POLICY "Auth users send messages as participant"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND type IN ('text', 'image')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

CREATE POLICY "Auth users mark messages read in own conversations"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- ============================================================
-- Wishlist matching: current user comes from auth.uid()
-- ============================================================

DROP FUNCTION IF EXISTS public.find_wishlist_matches(uuid);

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
    AND NOT public.is_blocked_bidirectional(v_user_id, u.id)
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

REVOKE ALL ON FUNCTION public.find_wishlist_matches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches() TO authenticated;

-- ============================================================
-- Matches: accept/decline/create-like are server-side actions
-- ============================================================

DROP POLICY IF EXISTS "Auth users update own matches" ON public.matches;

CREATE OR REPLACE FUNCTION public.accept_match(p_match_id uuid)
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

CREATE OR REPLACE FUNCTION public.decline_match(p_match_id uuid)
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

CREATE OR REPLACE FUNCTION public.create_like(
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

REVOKE ALL ON FUNCTION public.accept_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_like(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_like(uuid, uuid) TO authenticated;
