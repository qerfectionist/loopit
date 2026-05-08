-- ============================================================
-- Migration 008: Full Text Search for items
-- Adds search_vector generated column with weighted fields:
--   title = A (highest priority)
--   author = B
--   description = C (lowest priority)
-- Adds GIN index for fast FTS queries.
-- Adds search_items() RPC for ranked results via ts_rank_cd.
-- ============================================================

-- Step 1: Add generated tsvector column
ALTER TABLE items
ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(author, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'C')
) STORED;

-- Step 2: GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_items_fts ON items USING GIN(search_vector);

-- Step 3: RPC function for ranked search
CREATE OR REPLACE FUNCTION search_items(
  p_query    text    DEFAULT NULL,
  p_category text    DEFAULT NULL,
  p_limit    int     DEFAULT 20,
  p_offset   int     DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  user_id       uuid,
  category      text,
  title         text,
  author        text,
  description   text,
  condition     text,
  images        text[],
  isbn          text,
  exchange_type text,
  price         decimal,
  status        text,
  metadata      jsonb,
  created_at    timestamptz,
  updated_at    timestamptz,
  "user"        jsonb,
  rank          real
)
LANGUAGE plpgsql AS $$
DECLARE
  v_query tsquery;
BEGIN
  -- Parse query only if >= 2 chars
  IF p_query IS NOT NULL AND length(trim(p_query)) >= 2 THEN
    BEGIN
      v_query := websearch_to_tsquery('simple', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_query := NULL; -- fallback if query is invalid
    END;
  END IF;

  RETURN QUERY
  SELECT
    i.id, i.user_id, i.category, i.title, i.author, i.description,
    i.condition, i.images, i.isbn, i.exchange_type, i.price,
    i.status, i.metadata, i.created_at, i.updated_at,
    to_jsonb(u.*) AS "user",
    CASE
      WHEN v_query IS NOT NULL THEN ts_rank_cd(i.search_vector, v_query)
      ELSE 0::real
    END AS rank
  FROM items i
  LEFT JOIN users u ON u.id = i.user_id
  WHERE
    i.status = 'active'
    AND (p_category IS NULL OR i.category = p_category)
    AND (v_query IS NULL OR i.search_vector @@ v_query)
  ORDER BY
    CASE WHEN v_query IS NOT NULL
      THEN ts_rank_cd(i.search_vector, v_query)
    END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
