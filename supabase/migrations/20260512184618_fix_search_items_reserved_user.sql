-- Avoid reserved output parameter name "user" in the search_items RPC.
-- The frontend maps item_user back to Item.user after receiving RPC rows.

CREATE OR REPLACE FUNCTION public.search_items(
  p_query text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
  title text,
  author text,
  description text,
  condition text,
  images text[],
  isbn text,
  exchange_type text,
  price decimal,
  status text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  item_user jsonb,
  rank real
)
LANGUAGE plpgsql
SECURITY INVOKER
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
    i.id,
    i.user_id,
    i.category,
    i.title,
    i.author,
    i.description,
    i.condition,
    i.images,
    i.isbn,
    i.exchange_type,
    i.price,
    i.status,
    i.metadata,
    i.created_at,
    i.updated_at,
    to_jsonb(u.*) AS item_user,
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
    CASE
      WHEN v_query IS NOT NULL THEN ts_rank_cd(i.search_vector, v_query)
    END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_items(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_items(text, text, int, int) TO authenticated;
