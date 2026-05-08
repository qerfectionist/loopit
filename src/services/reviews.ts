import { supabase } from '@/lib/supabase';
import type { Review } from '@/types';

/** Get reviews for a user (reviews they received) */
export const getUserReviews = async (userId: string): Promise<Review[]> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:users!reviews_reviewer_id_fkey(*)')
    .eq('reviewed_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Reviews] Fetch failed:', error);
    return [];
  }

  return (data ?? []) as Review[];
};

/** Check if user already reviewed this exchange */
export const hasReviewed = async (
  exchangeId: string,
  reviewerId: string
): Promise<boolean> => {
  const { count } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('exchange_id', exchangeId)
    .eq('reviewer_id', reviewerId);

  return (count ?? 0) > 0;
};

/** Submit a review */
export const submitReview = async (params: {
  exchange_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment?: string;
}): Promise<Review | null> => {
  const { data, error } = await supabase.rpc('submit_review', {
    p_exchange_id: params.exchange_id,
    p_rating: params.rating,
    p_comment: params.comment ?? null,
  });

  if (error) {
    console.error('[Reviews] Submit failed:', error);
    return null;
  }

  return data as unknown as Review;
};
