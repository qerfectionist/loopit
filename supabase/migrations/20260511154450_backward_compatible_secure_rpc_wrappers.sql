-- Keep older deployed clients working while preserving the hardened auth.uid() checks.

CREATE OR REPLACE FUNCTION public.confirm_exchange(p_exchange_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.confirm_exchange(p_exchange_id);
$$;

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
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.find_wishlist_matches();
$$;

REVOKE ALL ON FUNCTION public.confirm_exchange(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_wishlist_matches(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_exchange(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches(uuid) TO authenticated;
