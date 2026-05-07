import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMatches, acceptMatch, declineMatch, getUnreadMatchesCount, createLike } from '@/services/matches';

/** Fetch user's matches */
export const useMatches = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['matches', userId],
    queryFn: () => getMatches(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 30, // Poll every 30s
  });
};

/** Accept a match */
export const useAcceptMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (matchId: string) => acceptMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMatches'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

/** Decline a match */
export const useDeclineMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (matchId: string) => declineMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMatches'] });
    },
  });
};

/** Unread matches count for badges */
export const useUnreadMatches = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['unreadMatches', userId],
    queryFn: () => getUnreadMatchesCount(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 15,
  });
};

/** Like / express interest in an item — creates a pending match */
export const useLikeItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts: {
      likerUserId: string;
      likerItemId: string | null;
      ownerUserId: string;
      ownerItemId: string;
    }) => createLike(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMatches'] });
    },
  });
};
