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
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      exchange_id: params.exchange_id,
      reviewer_id: params.reviewer_id,
      reviewed_id: params.reviewed_id,
      rating: params.rating,
      comment: params.comment ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Reviews] Submit failed:', error);
    return null;
  }

  // Update user's average rating
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewed_id', params.reviewed_id);

  if (reviews && reviews.length > 0) {
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await supabase
      .from('users')
      .update({ rating: Math.round(avgRating * 100) / 100 })
      .eq('id', params.reviewed_id);
  }

  return data as Review;
};
