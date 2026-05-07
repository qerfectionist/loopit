import { supabase, setSupabaseToken } from '@/lib/supabase';
import { getTelegram } from '@/lib/telegram';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Edge Function URL — built from VITE_SUPABASE_URL
// ---------------------------------------------------------------------------
const getEdgeFunctionUrl = () => {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/auth-telegram`;
};

// ---------------------------------------------------------------------------
// DEV: mock initData string when running outside Telegram
// Edge Function treats the literal string "dev" as a bypass (local only)
// ---------------------------------------------------------------------------
const getInitData = (): string | null => {
  const tg = getTelegram();
  if (tg?.initData) return tg.initData;
  if (import.meta.env.DEV) {
    console.warn('[Auth] Not in Telegram. Using DEV mock initData.');
    return 'dev';
  }
  return null;
};

// ---------------------------------------------------------------------------
// authenticateWithTelegram
// Calls the Edge Function, gets a custom JWT, sets it globally for Supabase.
// Bypasses GoTrue (auth.users) completely.
// ---------------------------------------------------------------------------
export const authenticateWithTelegram = async (): Promise<User | null> => {
  const initData = getInitData();
  if (!initData) {
    console.warn('[Auth] No initData available and not in DEV mode');
    return null;
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  let response: Response;
  try {
    response = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ initData }),
    });
  } catch (err) {
    console.error('[Auth] Network error calling auth-telegram:', err);
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('[Auth] auth-telegram returned error:', response.status, errorBody);
    return null;
  }

  const data: { access_token: string; user: User } = await response.json();

  if (!data.access_token || !data.user) {
    console.error('[Auth] Invalid response from auth-telegram');
    return null;
  }

  // Set the custom token directly for PostgREST
  setSupabaseToken(data.access_token);
  localStorage.setItem('loopit_user', JSON.stringify(data.user));

  return data.user;
};

// ---------------------------------------------------------------------------
// getCurrentUser
// Reads the current user from localStorage if token exists.
// ---------------------------------------------------------------------------
export const getCurrentUser = async (): Promise<User | null> => {
  const token = localStorage.getItem('loopit_token');
  const userJson = localStorage.getItem('loopit_user');
  
  if (!token || !userJson) return null;
  
  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// updateUserProfile
// Updates allowed fields for the authenticated user.
// auth.uid() = user.id is enforced by RLS policy "Auth users update own profile"
// ---------------------------------------------------------------------------
export const updateUserProfile = async (
  userId: string,
  updates: Partial<Pick<User, 'username' | 'first_name' | 'last_name' | 'avatar_url' | 'bio' | 'location'>>,
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

// ---------------------------------------------------------------------------
// getUserProfile
// Public profile lookup — allowed by "Anyone can read profiles" RLS policy
// ---------------------------------------------------------------------------
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
