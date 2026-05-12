-- Keep wishlist match discovery behind a private SECURITY DEFINER function,
-- and ensure blocked users never appear in wishlist matches.

CREATE SCHEMA IF NOT EXISTS private;

DROP FUNCTION IF EXISTS public.find_wishlist_matches(uuid);
DROP FUNCTION IF EXISTS public.find_wishlist_matches();

CREATE OR REPLACE FUNCTION private.find_wishlist_matches_impl()
RETURNS TABLE (
  other_user_id     uuid,
  other_first_name  text,
  other_last_name   text,
  other_rating      numeric,
  my_item_id        uuid,
  my_item_title     text,
  my_item_images    text[],
  their_item_id     uuid,
  their_item_title  text,
  their_item_images text[],
  match_score       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH my_active_items AS (
    SELECT id, title, images
    FROM public.items
    WHERE user_id = v_user_id
      AND status = 'active'
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
    80::integer
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

CREATE OR REPLACE FUNCTION public.find_wishlist_matches()
RETURNS TABLE (
  other_user_id     uuid,
  other_first_name  text,
  other_last_name   text,
  other_rating      numeric,
  my_item_id        uuid,
  my_item_title     text,
  my_item_images    text[],
  their_item_id     uuid,
  their_item_title  text,
  their_item_images text[],
  match_score       integer
)
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT * FROM private.find_wishlist_matches_impl();
$$;

-- Backward-compatible wrapper for old clients that still pass a user id.
-- The argument is intentionally ignored; auth.uid() is the source of truth.
CREATE OR REPLACE FUNCTION public.find_wishlist_matches(p_user_id uuid)
RETURNS TABLE (
  other_user_id     uuid,
  other_first_name  text,
  other_last_name   text,
  other_rating      numeric,
  my_item_id        uuid,
  my_item_title     text,
  my_item_images    text[],
  their_item_id     uuid,
  their_item_title  text,
  their_item_images text[],
  match_score       integer
)
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT * FROM private.find_wishlist_matches_impl();
$$;

REVOKE ALL ON FUNCTION private.find_wishlist_matches_impl() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.find_wishlist_matches_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches(uuid) TO authenticated;
