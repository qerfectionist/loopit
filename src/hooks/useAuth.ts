import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticateWithTelegram, getCurrentUser, updateUserProfile, getUserProfile } from '@/services/auth';
import { useAppStore } from '@/stores/appStore';
import type { User } from '@/types';

/** Authenticate and sync with Supabase on app start */
export const useAuth = () => {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  return useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      // Try to get existing user first
      let user = await getCurrentUser();
      if (!user) {
        // First time — create via Telegram data
        user = await authenticateWithTelegram();
      }
      if (user) {
        setCurrentUser(user);
      }
      return user;
    },
    staleTime: Infinity,
    retry: 2,
  });
};

/** Get another user's profile */
export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
};

/** Update current user's profile */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  return useMutation({
    mutationFn: ({ userId, updates }: {
      userId: string;
      updates: Partial<Pick<User, 'username' | 'first_name' | 'last_name' | 'avatar_url' | 'bio' | 'location'>>;
    }) => updateUserProfile(userId, updates),
    onSuccess: (user) => {
      if (user) {
        setCurrentUser(user);
        queryClient.setQueryData(['auth'], user);
        queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      }
    },
  });
};
