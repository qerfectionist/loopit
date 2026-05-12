-- Fix search_path warnings and move pg_trgm out of public schema.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_items(
  p_query    text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit    int DEFAULT 20,
  p_offset   int DEFAULT 0
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
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_query tsquery;
BEGIN
  IF p_query IS NOT NULL AND length(trim(p_query)) >= 2 THEN
    BEGIN
      v_query := websearch_to_tsquery('simple', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_query := NULL;
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
  FROM public.items i
  LEFT JOIN public.users u ON u.id = i.user_id
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
