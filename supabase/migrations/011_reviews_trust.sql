-- ============================================
-- Reviews & Trust System
-- Adds review count and secure RPC for submission
-- ============================================

-- 1. Add review_count to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- 2. RPC to securely submit a review
CREATE OR REPLACE FUNCTION public.submit_review(
  p_exchange_id UUID,
  p_rating INT,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exchange public.exchanges%ROWTYPE;
  v_reviewed_id UUID;
  v_reviewer_id UUID;
  v_review public.reviews;
  v_avg_rating DECIMAL(3,2);
  v_count INT;
BEGIN
  -- Validate rating
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock exchange for update to prevent concurrent submissions
  SELECT * INTO v_exchange 
  FROM public.exchanges 
  WHERE id = p_exchange_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange not found';
  END IF;

  -- Check status
  IF v_exchange.status != 'completed' THEN
    RAISE EXCEPTION 'Can only review completed exchanges';
  END IF;

  -- Determine roles and validate participation
  IF v_reviewer_id = v_exchange.initiator_id THEN
    v_reviewed_id := v_exchange.responder_id;
  ELSIF v_reviewer_id = v_exchange.responder_id THEN
    v_reviewed_id := v_exchange.initiator_id;
  ELSE
    RAISE EXCEPTION 'You are not a participant in this exchange';
  END IF;

  -- Check if review already exists
  IF EXISTS (
    SELECT 1 FROM public.reviews 
    WHERE exchange_id = p_exchange_id AND reviewer_id = v_reviewer_id
  ) THEN
    RAISE EXCEPTION 'You have already reviewed this exchange';
  END IF;

  -- Insert review
  INSERT INTO public.reviews (
    exchange_id, 
    reviewer_id, 
    reviewed_id, 
    rating, 
    comment
  ) VALUES (
    p_exchange_id,
    v_reviewer_id,
    v_reviewed_id,
    p_rating,
    p_comment
  ) RETURNING * INTO v_review;

  -- Recalculate rating and count
  SELECT 
    COALESCE(AVG(rating), 0)::DECIMAL(3,2),
    COUNT(*)
  INTO v_avg_rating, v_count
  FROM public.reviews
  WHERE reviewed_id = v_reviewed_id;

  -- Update user trust metrics
  UPDATE public.users 
  SET 
    rating = v_avg_rating,
    review_count = v_count,
    updated_at = NOW()
  WHERE id = v_reviewed_id;

  RETURN v_review;
END;
$$;

-- 3. Permissions
REVOKE EXECUTE ON FUNCTION public.submit_review(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, INT, TEXT) TO authenticated;
