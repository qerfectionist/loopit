-- ============================================
-- 003: Fix RLS — replace dev bypass (USING(true))
-- with proper auth.uid()-based policies.
--
-- Requires: users are authenticated via custom JWT
-- from the auth-telegram Edge Function.
-- auth.uid() = public.users.id (UUID)
-- ============================================

-- ============================================
-- DROP old dev bypass policies from 002
-- ============================================

-- matches
DROP POLICY IF EXISTS "Anyone can read matches"       ON public.matches;
DROP POLICY IF EXISTS "Anyone can create matches"     ON public.matches;
DROP POLICY IF EXISTS "Anyone can update matches"     ON public.matches;

-- conversations
DROP POLICY IF EXISTS "Anyone can read conversations"  ON public.conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can update conversations" ON public.conversations;

-- messages
DROP POLICY IF EXISTS "Anyone can read messages"      ON public.messages;
DROP POLICY IF EXISTS "Anyone can create messages"    ON public.messages;

-- exchanges
DROP POLICY IF EXISTS "Anyone can read exchanges"     ON public.exchanges;
DROP POLICY IF EXISTS "Anyone can create exchanges"   ON public.exchanges;
DROP POLICY IF EXISTS "Anyone can update exchanges"   ON public.exchanges;

-- reviews
DROP POLICY IF EXISTS "Anyone can read reviews"       ON public.reviews;
DROP POLICY IF EXISTS "Anyone can create reviews"     ON public.reviews;

-- items (bypass from 002)
DROP POLICY IF EXISTS "Anyone can insert items"       ON public.items;

-- wishlists (bypass from 002)
DROP POLICY IF EXISTS "Anyone can insert wishlists"   ON public.wishlists;
DROP POLICY IF EXISTS "Anyone can delete wishlists"   ON public.wishlists;
DROP POLICY IF EXISTS "Anyone can read wishlists"     ON public.wishlists;

-- users (bypass from 002)
DROP POLICY IF EXISTS "Anyone can insert users"       ON public.users;

-- Drop old policies from 001 that will be replaced
DROP POLICY IF EXISTS "Users manage own items"        ON public.items;
DROP POLICY IF EXISTS "Users update own profile"      ON public.users;
DROP POLICY IF EXISTS "Users read own wishlists"      ON public.wishlists;
DROP POLICY IF EXISTS "Users manage own wishlists"    ON public.wishlists;

-- ============================================
-- USERS
-- auth.uid() = id because JWT sub = public.users.id
-- ============================================
-- Read: anyone can see profiles (needed for book listings, chat)
-- Already exists from 001: "Anyone can read profiles"

-- Insert: only via Edge Function (service_role bypasses RLS)
-- Authenticated users cannot insert — only Edge Function can
CREATE POLICY "Auth users update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- ITEMS
-- ============================================

-- Insert: authenticated users only (user_id must match caller)
CREATE POLICY "Auth users insert own items"
  ON public.items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update/Delete: only owner
CREATE POLICY "Auth users manage own items"
  ON public.items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users delete own items"
  ON public.items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- WISHLISTS
-- ============================================
CREATE POLICY "Auth users read own wishlists"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users insert own wishlists"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users delete own wishlists"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- MATCHES
-- A user can see matches they are part of
-- ============================================
CREATE POLICY "Auth users read own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Insert: user_a must be the caller (the liker)
CREATE POLICY "Auth users create matches as user_a"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = user_a);

-- Update: only participants can change status (accept/decline)
CREATE POLICY "Auth users update own matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE POLICY "Auth users read own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Insert: created automatically when match is accepted
-- Both participants should be able to trigger this
CREATE POLICY "Auth users create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Auth users update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============================================
-- MESSAGES
-- ============================================
CREATE POLICY "Auth users read messages in own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- Insert: sender must be the caller
CREATE POLICY "Auth users send messages as self"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- EXCHANGES
-- ============================================
CREATE POLICY "Auth users read own exchanges"
  ON public.exchanges FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = responder_id);

CREATE POLICY "Auth users create exchanges as initiator"
  ON public.exchanges FOR INSERT
  WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Auth users update own exchanges"
  ON public.exchanges FOR UPDATE
  USING (auth.uid() = initiator_id OR auth.uid() = responder_id);

-- ============================================
-- REVIEWS
-- ============================================
CREATE POLICY "Auth users read reviews"
  ON public.reviews FOR SELECT
  USING (true); -- public ratings are visible to all

CREATE POLICY "Auth users create reviews as reviewer"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);
