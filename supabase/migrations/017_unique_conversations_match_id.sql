-- ============================================================
-- 017_unique_conversations_match_id.sql
-- Adds a unique constraint on match_id in the conversations table.
-- This allows UPSERT (ON CONFLICT) to work correctly and prevents
-- duplicate conversations for the same match.
-- ============================================

-- 1. Remove duplicate conversations if any accidentally slipped through
DELETE FROM public.conversations c1
USING public.conversations c2
WHERE c1.match_id = c2.match_id AND c1.created_at < c2.created_at;

-- 2. Add the UNIQUE constraint
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_match_id_key;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_match_id_key UNIQUE (match_id);
