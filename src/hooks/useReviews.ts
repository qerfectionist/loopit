import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserReviews, submitReview, hasReviewed } from '@/services/reviews';

/** Fetch reviews received by a user */
export const useUserReviews = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => getUserReviews(userId!),
    enabled: !!userId,
  });
};

/** Check if current user already reviewed an exchange */
export const useHasReviewed = (exchangeId: string | undefined, reviewerId: string | undefined) => {
  return useQuery({
    queryKey: ['hasReviewed', exchangeId, reviewerId],
    queryFn: () => hasReviewed(exchangeId!, reviewerId!),
    enabled: !!exchangeId && !!reviewerId,
  });
};

/** Submit a review */
export const useSubmitReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitReview,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.reviewed_id] });
      queryClient.invalidateQueries({ queryKey: ['hasReviewed', variables.exchange_id] });
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
    },
  });
};
