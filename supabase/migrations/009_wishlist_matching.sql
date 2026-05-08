-- =================================================================
-- Migration 009: Wishlist-based Match Discovery
-- Finds two-way wishlist matches:
--   A has an item B wants AND B has an item A wants.
-- Uses ILIKE for fuzzy title matching (no pg_trgm required).
-- =================================================================

CREATE OR REPLACE FUNCTION find_wishlist_matches(p_user_id UUID)
RETURNS TABLE (
  other_user_id     UUID,
  other_first_name  TEXT,
  other_last_name   TEXT,
  other_rating      DECIMAL,
  my_item_id        UUID,
  my_item_title     TEXT,
  my_item_images    TEXT[],
  their_item_id     UUID,
  their_item_title  TEXT,
  their_item_images TEXT[],
  match_score       INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH my_active_items AS (
    SELECT id, title, images
    FROM public.items
    WHERE user_id = p_user_id AND status = 'active'
  ),
  my_wishlist AS (
    SELECT title AS wanted_title
    FROM public.wishlists
    WHERE user_id = p_user_id
  )
  SELECT DISTINCT ON (u.id)
    u.id                    AS other_user_id,
    u.first_name            AS other_first_name,
    u.last_name             AS other_last_name,
    u.rating                AS other_rating,
    mi.id                   AS my_item_id,
    mi.title                AS my_item_title,
    mi.images               AS my_item_images,
    ti.id                   AS their_item_id,
    ti.title                AS their_item_title,
    ti.images               AS their_item_images,
    80::INT                 AS match_score
  FROM public.users u
  -- Their wishlist: things they want
  JOIN public.wishlists tw ON tw.user_id = u.id
  -- My active items that satisfy their wishlist (bi-directional ILIKE)
  JOIN my_active_items mi ON (
    LOWER(mi.title) ILIKE '%' || LOWER(TRIM(tw.title)) || '%'
    OR LOWER(TRIM(tw.title)) ILIKE '%' || LOWER(mi.title) || '%'
  )
  -- My wishlist: things I want
  CROSS JOIN my_wishlist mw
  -- Their active items that satisfy my wishlist
  JOIN public.items ti ON ti.user_id = u.id
    AND ti.status = 'active'
    AND (
      LOWER(ti.title) ILIKE '%' || LOWER(TRIM(mw.wanted_title)) || '%'
      OR LOWER(TRIM(mw.wanted_title)) ILIKE '%' || LOWER(ti.title) || '%'
    )
  WHERE u.id != p_user_id
    -- Skip users with active/pending matches already
    AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.status NOT IN ('declined', 'expired')
        AND (
          (m.user_a = p_user_id AND m.user_b = u.id)
          OR (m.user_a = u.id AND m.user_b = p_user_id)
        )
    )
  ORDER BY u.id
  LIMIT 20;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION find_wishlist_matches(UUID) TO authenticated;
