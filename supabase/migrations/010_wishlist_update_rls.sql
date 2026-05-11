-- =================================================================
-- Migration 010: Add missing UPDATE RLS policy for wishlists
-- Ensures users can only update their own wishlist items.
-- SELECT, INSERT, DELETE policies already exist (migration ~005).
-- =================================================================

DROP POLICY IF EXISTS "Auth users update own wishlists" ON public.wishlists;
CREATE POLICY "Auth users update own wishlists"
  ON public.wishlists
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
