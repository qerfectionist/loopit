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
// DEV mock user — used when Edge Function is unavailable in browser testing
// ---------------------------------------------------------------------------
const DEV_MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  telegram_id: 123456789,
  username: 'dev_local',
  first_name: 'Developer',
  last_name: 'Local',
  avatar_url: null,
  bio: 'Local development account',
  rating: 5.0,
  total_exchanges: 0,
  review_count: 0,
  location: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEV_MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock';

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
// In DEV mode, falls back to a mock user if Edge Function is unavailable.
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
    // DEV fallback: use mock user so UI is testable without Edge Function
    if (import.meta.env.DEV) {
      console.warn('[Auth] Using DEV mock user (Edge Function unreachable)');
      return applyDevMock();
    }
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('[Auth] auth-telegram returned error:', response.status, errorBody);
    // DEV fallback: allow browser testing even if Edge Function returns 401/500
    if (import.meta.env.DEV) {
      console.warn('[Auth] Using DEV mock user (Edge Function error:', response.status, ')');
      return applyDevMock();
    }
    return null;
  }

  const data: { access_token: string; user: User } = await response.json();

  if (!data.access_token || !data.user) {
    console.error('[Auth] Invalid response from auth-telegram');
    if (import.meta.env.DEV) return applyDevMock();
    return null;
  }

  // Set the custom token directly for PostgREST
  setSupabaseToken(data.access_token);
  localStorage.setItem('loopit_token', data.access_token);
  localStorage.setItem('loopit_user', JSON.stringify(data.user));

  return data.user;
};

/** Apply DEV mock user into localStorage + supabase client */
const applyDevMock = (): User => {
  setSupabaseToken(DEV_MOCK_TOKEN);
  localStorage.setItem('loopit_token', DEV_MOCK_TOKEN);
  localStorage.setItem('loopit_user', JSON.stringify(DEV_MOCK_USER));
  return DEV_MOCK_USER;
};

// ---------------------------------------------------------------------------
// getCurrentUser
// Reads the current user from localStorage if token exists.
// ---------------------------------------------------------------------------
export const getCurrentUser = async (): Promise<User | null> => {
  const token = localStorage.getItem('loopit_token');
  const userJson = localStorage.getItem('loopit_user');

  if (!token || !userJson) return null;

  // Check JWT expiry without a library: decode payload and check exp claim
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    // Base64url decode the payload (second segment)
    const payloadB64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = atob(payloadB64);
    const payload = JSON.parse(payloadJson) as { exp?: number };
    const nowSec = Math.floor(Date.now() / 1000);

    if (payload.exp && nowSec >= payload.exp) {
      // Token expired — clear everything and force re-auth
      console.warn('[Auth] JWT expired, clearing session.');
      localStorage.removeItem('loopit_token');
      localStorage.removeItem('loopit_user');
      // Also clear module-level token in supabase client
      setSupabaseToken(null);
      return null;
    }
  } catch {
    // Malformed token — treat as expired
    localStorage.removeItem('loopit_token');
    localStorage.removeItem('loopit_user');
    setSupabaseToken(null);
    return null;
  }

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
