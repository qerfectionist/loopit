-- ============================================
-- 004: Allow item owner to SELECT own items
-- regardless of status (active/reserved/removed)
--
-- Problem: 001 policy "Anyone can read active items"
-- only allows SELECT where status = 'active'.
-- Owners cannot see their own reserved/removed books
-- in MyBooksPage.
-- ============================================

-- Drop the original combined policy from 001 to replace it
DROP POLICY IF EXISTS "Anyone can read active items" ON public.items;

-- Public: only active items visible to everyone
CREATE POLICY "Public read active items"
  ON public.items FOR SELECT
  USING (status = 'active');

-- Owner: can always see their own items regardless of status
CREATE POLICY "Owner read own items"
  ON public.items FOR SELECT
  USING (auth.uid() = user_id);
