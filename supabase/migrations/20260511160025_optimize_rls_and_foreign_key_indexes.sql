-- Add indexes for foreign keys and optimize RLS auth.uid() calls.

-- Foreign key indexes recommended by Supabase performance advisor.
CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON public.conversations(user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON public.conversations(user_b);

CREATE INDEX IF NOT EXISTS idx_exchanges_conversation_id ON public.exchanges(conversation_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_match_id ON public.exchanges(match_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_initiator_id ON public.exchanges(initiator_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_responder_id ON public.exchanges(responder_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_item_given ON public.exchanges(item_given);
CREATE INDEX IF NOT EXISTS idx_exchanges_item_received ON public.exchanges(item_received);

CREATE INDEX IF NOT EXISTS idx_matches_user_b ON public.matches(user_b);
CREATE INDEX IF NOT EXISTS idx_matches_item_a ON public.matches(item_a);
CREATE INDEX IF NOT EXISTS idx_matches_item_b ON public.matches(item_b);
CREATE INDEX IF NOT EXISTS idx_matches_wishlist_a ON public.matches(wishlist_a);
CREATE INDEX IF NOT EXISTS idx_matches_wishlist_b ON public.matches(wishlist_b);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_related_item_id ON public.reports(related_item_id);
CREATE INDEX IF NOT EXISTS idx_reports_related_conversation_id ON public.reports(related_conversation_id);
CREATE INDEX IF NOT EXISTS idx_reports_related_exchange_id ON public.reports(related_exchange_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_id ON public.reviews(reviewed_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON public.user_blocks(blocked_id);

-- USERS
DROP POLICY IF EXISTS "Auth users update own profile" ON public.users;
CREATE POLICY "Auth users update own profile"
  ON public.users FOR UPDATE
  USING ((select auth.uid()) = id);

-- ITEMS: merge two SELECT policies and optimize auth.uid() calls.
DROP POLICY IF EXISTS "Public read active items" ON public.items;
DROP POLICY IF EXISTS "Owner read own items" ON public.items;
CREATE POLICY "Read active or own items"
  ON public.items FOR SELECT
  USING (
    (
      status = 'active'
      AND NOT private.is_blocked_bidirectional((select auth.uid()), user_id)
    )
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Auth users insert own items" ON public.items;
CREATE POLICY "Auth users insert own items"
  ON public.items FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users manage own items" ON public.items;
CREATE POLICY "Auth users manage own items"
  ON public.items FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users delete own items" ON public.items;
CREATE POLICY "Auth users delete own items"
  ON public.items FOR DELETE
  USING ((select auth.uid()) = user_id);

-- WISHLISTS
DROP POLICY IF EXISTS "Auth users read own wishlists" ON public.wishlists;
CREATE POLICY "Auth users read own wishlists"
  ON public.wishlists FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users insert own wishlists" ON public.wishlists;
CREATE POLICY "Auth users insert own wishlists"
  ON public.wishlists FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users delete own wishlists" ON public.wishlists;
CREATE POLICY "Auth users delete own wishlists"
  ON public.wishlists FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users update own wishlists" ON public.wishlists;
CREATE POLICY "Auth users update own wishlists"
  ON public.wishlists FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- MATCHES
DROP POLICY IF EXISTS "Auth users read own matches" ON public.matches;
CREATE POLICY "Auth users read own matches"
  ON public.matches FOR SELECT
  USING (
    ((select auth.uid()) = user_a OR (select auth.uid()) = user_b)
    AND NOT private.is_blocked_bidirectional(
      (select auth.uid()),
      CASE WHEN (select auth.uid()) = user_a THEN user_b ELSE user_a END
    )
  );

DROP POLICY IF EXISTS "Auth users create matches as user_a" ON public.matches;
CREATE POLICY "Auth users create matches as user_a"
  ON public.matches FOR INSERT
  WITH CHECK ((select auth.uid()) = user_a);

-- CONVERSATIONS
DROP POLICY IF EXISTS "Auth users read own conversations" ON public.conversations;
CREATE POLICY "Auth users read own conversations"
  ON public.conversations FOR SELECT
  USING (
    ((select auth.uid()) = user_a OR (select auth.uid()) = user_b)
    AND NOT private.is_blocked_bidirectional(
      (select auth.uid()),
      CASE WHEN (select auth.uid()) = user_a THEN user_b ELSE user_a END
    )
  );

DROP POLICY IF EXISTS "Auth users create conversations" ON public.conversations;
CREATE POLICY "Auth users create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK ((select auth.uid()) = user_a OR (select auth.uid()) = user_b);

DROP POLICY IF EXISTS "Auth users update own conversations" ON public.conversations;
CREATE POLICY "Auth users update own conversations"
  ON public.conversations FOR UPDATE
  USING ((select auth.uid()) = user_a OR (select auth.uid()) = user_b);

-- MESSAGES
DROP POLICY IF EXISTS "Auth users read messages in own conversations" ON public.messages;
CREATE POLICY "Auth users read messages in own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = (select auth.uid()) OR c.user_b = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Auth users send messages as participant" ON public.messages;
CREATE POLICY "Auth users send messages as participant"
  ON public.messages FOR INSERT
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND type IN ('text', 'image')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = (select auth.uid()) OR c.user_b = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Auth users mark messages read in own conversations" ON public.messages;
CREATE POLICY "Auth users mark messages read in own conversations"
  ON public.messages FOR UPDATE
  USING (
    (select auth.uid()) <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = (select auth.uid()) OR c.user_b = (select auth.uid()))
    )
  )
  WITH CHECK (
    (select auth.uid()) <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = (select auth.uid()) OR c.user_b = (select auth.uid()))
    )
  );

-- EXCHANGES
DROP POLICY IF EXISTS "Auth users read own exchanges" ON public.exchanges;
CREATE POLICY "Auth users read own exchanges"
  ON public.exchanges FOR SELECT
  USING ((select auth.uid()) = initiator_id OR (select auth.uid()) = responder_id);

DROP POLICY IF EXISTS "Auth users create exchanges as initiator" ON public.exchanges;
CREATE POLICY "Auth users create exchanges as initiator"
  ON public.exchanges FOR INSERT
  WITH CHECK ((select auth.uid()) = initiator_id);

DROP POLICY IF EXISTS "Auth users update own exchanges" ON public.exchanges;
CREATE POLICY "Auth users update own exchanges"
  ON public.exchanges FOR UPDATE
  USING ((select auth.uid()) = initiator_id OR (select auth.uid()) = responder_id);

-- USER BLOCKS
DROP POLICY IF EXISTS "Users can view their own blocks" ON public.user_blocks;
CREATE POLICY "Users can view their own blocks"
  ON public.user_blocks FOR SELECT
  USING ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Users can create blocks" ON public.user_blocks;
CREATE POLICY "Users can create blocks"
  ON public.user_blocks FOR INSERT
  WITH CHECK ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Users can delete their blocks" ON public.user_blocks;
CREATE POLICY "Users can delete their blocks"
  ON public.user_blocks FOR DELETE
  USING ((select auth.uid()) = blocker_id);

-- REPORTS
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING ((select auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK ((select auth.uid()) = reporter_id);
