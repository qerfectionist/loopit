-- ============================================
-- 002: RLS Policies for Matches, Conversations, Messages, Exchanges, Reviews
-- Run this in the Supabase SQL Editor
-- ============================================

-- For development: allow all operations on matches (no auth.uid() available with anon key)
-- In production, replace these with proper auth-based policies

-- MATCHES: anyone can read matches they are part of, and create new ones
CREATE POLICY "Anyone can read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Anyone can create matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update matches" ON public.matches FOR UPDATE USING (true);

-- CONVERSATIONS: read/write access
CREATE POLICY "Anyone can read conversations" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "Anyone can create conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversations" ON public.conversations FOR UPDATE USING (true);

-- MESSAGES: read/write access
CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can create messages" ON public.messages FOR INSERT WITH CHECK (true);

-- EXCHANGES: read/write access
CREATE POLICY "Anyone can read exchanges" ON public.exchanges FOR SELECT USING (true);
CREATE POLICY "Anyone can create exchanges" ON public.exchanges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update exchanges" ON public.exchanges FOR UPDATE USING (true);

-- REVIEWS: read/write access
CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can create reviews" ON public.reviews FOR INSERT WITH CHECK (true);

-- Also fix: items policy blocks insert from non-auth users
-- We need to allow inserts for development (no auth.uid())
CREATE POLICY "Anyone can insert items" ON public.items FOR INSERT WITH CHECK (true);

-- Wishlists: allow insert/delete for development
CREATE POLICY "Anyone can insert wishlists" ON public.wishlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete wishlists" ON public.wishlists FOR DELETE USING (true);
CREATE POLICY "Anyone can read wishlists" ON public.wishlists FOR SELECT USING (true);

-- Users: allow insert for upsert during dev auth
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);
