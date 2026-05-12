-- Explicitly prevent unsigned users from calling privileged RPC functions.
-- Authenticated users still need selected functions for app workflows.

REVOKE ALL ON FUNCTION public.accept_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_exchange(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_like(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_wishlist_matches() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_review(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_match_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_exchange(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_like(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_wishlist_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, text) TO authenticated;
