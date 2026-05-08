-- Drop the direct insert policy for reviews to force usage of the submit_review RPC
-- This ensures that reviews can only be created via the secure submit_review RPC
-- which atomatically recalculates the user's rating and review count.

DROP POLICY IF EXISTS "Auth users create reviews as reviewer" ON public.reviews;
