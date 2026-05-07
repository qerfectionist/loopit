import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  authenticateWithTelegram,
  getCurrentUser,
  updateUserProfile,
  getUserProfile,
} from '@/services/auth';
import { useAppStore } from '@/stores/appStore';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// useAuth
// Main auth hook — called once at app root (AppRouter).
// Flow:
//   1. Try to restore session from localStorage (getCurrentUser)
//   2. If no session → call Edge Function (authenticateWithTelegram)
//   3. Listen to session changes via onAuthStateChange
// ---------------------------------------------------------------------------
export const useAuth = () => {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const queryClient = useQueryClient();

  // No longer using GoTrue onAuthStateChange because we are using a custom JWT bypassed approach.

  return useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      // Step 1: try to restore existing session from localStorage
      let user = await getCurrentUser();

      if (!user) {
        // Step 2: no session — authenticate via Telegram initData → Edge Function
        user = await authenticateWithTelegram();
      }

      if (user) {
        setCurrentUser(user);
      }

      return user;
    },
    staleTime: Infinity,  // auth state doesn't go stale automatically
    retry: 2,
  });
};

// ---------------------------------------------------------------------------
// useUserProfile
// Fetch another user's public profile by UUID
// ---------------------------------------------------------------------------
export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
};

// ---------------------------------------------------------------------------
// useUpdateProfile
// Update current user's profile fields.
// Works because auth.uid() = currentUser.id after setSession()
// ---------------------------------------------------------------------------
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  return useMutation({
    mutationFn: ({
      userId,
      updates,
    }: {
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
