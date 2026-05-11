-- ============================================================
-- 016_safety_rls_filtering.sql
-- Moves safety filtering (blocking) from client-side JS to DB level.
-- Uses SECURITY DEFINER to bypass user_blocks RLS and hide
-- content bidirectionally.
-- ============================================

-- 1. Create a helper function that checks if there's a block between two users
-- SECURITY DEFINER allows it to read user_blocks even if the user doing the query
-- isn't the blocker (RLS on user_blocks normally prevents this).
CREATE OR REPLACE FUNCTION public.is_blocked_bidirectional(user1 uuid, user2 uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks 
    WHERE (blocker_id = user1 AND blocked_id = user2)
       OR (blocker_id = user2 AND blocked_id = user1)
  );
$$;

-- ============================================
-- ITEMS: Hide blocked users' items
-- ============================================
DROP POLICY IF EXISTS "Public read active items" ON public.items;

CREATE POLICY "Public read active items"
  ON public.items FOR SELECT
  USING (
    status = 'active'
    AND NOT public.is_blocked_bidirectional(auth.uid(), user_id)
  );

-- ============================================
-- MATCHES: Hide matches with blocked users
-- ============================================
DROP POLICY IF EXISTS "Auth users read own matches" ON public.matches;

CREATE POLICY "Auth users read own matches"
  ON public.matches FOR SELECT
  USING (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND NOT public.is_blocked_bidirectional(auth.uid(), CASE WHEN auth.uid() = user_a THEN user_b ELSE user_a END)
  );

-- ============================================
-- CONVERSATIONS: Hide chats with blocked users
-- ============================================
DROP POLICY IF EXISTS "Auth users read own conversations" ON public.conversations;

CREATE POLICY "Auth users read own conversations"
  ON public.conversations FOR SELECT
  USING (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND NOT public.is_blocked_bidirectional(auth.uid(), CASE WHEN auth.uid() = user_a THEN user_b ELSE user_a END)
  );
