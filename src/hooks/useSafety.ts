import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blockUser, unblockUser, getBlockedUsers, reportUser } from '@/services/safety';
import { useAppStore } from '@/stores/appStore';

export const useBlockedUsers = () => {
  const currentUser = useAppStore((s) => s.currentUser);

  return useQuery({
    queryKey: ['blocked_users', currentUser?.id],
    queryFn: () => getBlockedUsers(currentUser!.id),
    enabled: !!currentUser?.id,
  });
};

export const useBlockUser = () => {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.currentUser);

  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!currentUser) throw new Error('Not authenticated');
      return blockUser(currentUser.id, blockedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked_users', currentUser?.id] });
      // Invalidate other queries to filter out blocked users' items/chats
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.currentUser);

  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!currentUser) throw new Error('Not authenticated');
      return unblockUser(currentUser.id, blockedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked_users', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useReportUser = () => {
  const currentUser = useAppStore((s) => s.currentUser);

  return useMutation({
    mutationFn: ({ 
      reportedId, 
      reason, 
      description,
      relatedItemId,
      relatedConversationId,
      relatedExchangeId
    }: { 
      reportedId: string; 
      reason: string; 
      description?: string;
      relatedItemId?: string;
      relatedConversationId?: string;
      relatedExchangeId?: string;
    }) => {
      if (!currentUser) throw new Error('Not authenticated');
      return reportUser(
        currentUser.id, 
        reportedId, 
        reason, 
        description,
        relatedItemId,
        relatedConversationId,
        relatedExchangeId
      );
    },
  });
};
