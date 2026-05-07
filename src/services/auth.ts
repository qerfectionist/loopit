import { supabase } from '@/lib/supabase';
import { getTelegram } from '@/lib/telegram';
import type { User } from '@/types';

/**
 * Authenticate via Telegram WebApp initData.
 * Sends initData to Supabase Edge Function which verifies it
 * and returns a Supabase JWT token.
 *
 * For MVP without edge function, we do direct upsert with telegram_id.
 */
const DEV_MOCK_USER = {
  id: 123456789,
  first_name: 'Developer',
  last_name: 'Local',
  username: 'dev_local',
  photo_url: 'https://i.pravatar.cc/150?u=dev'
};

/**
 * Authenticate via Telegram WebApp initData.
 * Sends initData to Supabase Edge Function which verifies it
 * and returns a Supabase JWT token.
 *
 * For MVP without edge function, we do direct upsert with telegram_id.
 */
export const authenticateWithTelegram = async (): Promise<User | null> => {
  const tg = getTelegram();
  let tgUser;

  if (!tg?.initDataUnsafe?.user) {
    if (import.meta.env.DEV) {
      console.warn('[Auth] Not in Telegram. Using DEV mock user.');
      tgUser = DEV_MOCK_USER;
    } else {
      console.warn('[Auth] Not running inside Telegram WebApp');
      return null;
    }
  } else {
    tgUser = tg.initDataUnsafe.user;
  }

  // Upsert user in Supabase
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: tgUser.id,
        username: tgUser.username ?? null,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? null,
        avatar_url: tgUser.photo_url ?? null,
      },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[Auth] Failed to upsert user:', error);
    return null;
  }

  return data as User;
};

/**
 * Get current user from Supabase by telegram_id.
 * Used on app startup to check if user exists.
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const tg = getTelegram();
  let tgUserId = tg?.initDataUnsafe?.user?.id;

  if (!tgUserId && import.meta.env.DEV) {
    tgUserId = DEV_MOCK_USER.id;
  }

  if (!tgUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', tgUserId)
    .single();

  if (error) {
    console.error('[Auth] Failed to get user:', error);
    return null;
  }

  return data as User;
};

/**
 * Update user profile fields.
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<Pick<User, 'username' | 'first_name' | 'last_name' | 'avatar_url' | 'bio' | 'location'>>
): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('[Auth] Failed to update profile:', error);
    return null;
  }

  return data as User;
};

/**
 * Get a user's public profile by id.
 */
export const getUserProfile = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] Failed to get profile:', error);
    return null;
  }

  return data as User;
};
