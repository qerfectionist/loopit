-- Move the block helper out of the exposed public API schema.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_blocked_bidirectional(user1 uuid, user2 uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT CASE
    WHEN user1 IS NULL OR user2 IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_blocks
      WHERE (blocker_id = user1 AND blocked_id = user2)
         OR (blocker_id = user2 AND blocked_id = user1)
    )
  END;
$$;

REVOKE ALL ON FUNCTION private.is_blocked_bidirectional(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_blocked_bidirectional(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public read active items" ON public.items;
CREATE POLICY "Public read active items"
  ON public.items FOR SELECT
  USING (
    status = 'active'
    AND NOT private.is_blocked_bidirectional(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Auth users read own matches" ON public.matches;
CREATE POLICY "Auth users read own matches"
  ON public.matches FOR SELECT
  USING (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND NOT private.is_blocked_bidirectional(auth.uid(), CASE WHEN auth.uid() = user_a THEN user_b ELSE user_a END)
  );

DROP POLICY IF EXISTS "Auth users read own conversations" ON public.conversations;
CREATE POLICY "Auth users read own conversations"
  ON public.conversations FOR SELECT
  USING (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND NOT private.is_blocked_bidirectional(auth.uid(), CASE WHEN auth.uid() = user_a THEN user_b ELSE user_a END)
  );

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

REVOKE ALL ON FUNCTION public.find_wishlist_matches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches() TO authenticated;

DROP FUNCTION IF EXISTS public.is_blocked_bidirectional(uuid, uuid);
