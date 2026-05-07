import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || 'placeholder-key';

// Bypass GoTrue completely for custom JWTs
let customToken: string | null = localStorage.getItem('loopit_token');

export const setSupabaseToken = (token: string | null) => {
  customToken = token;
  if (token) {
    localStorage.setItem('loopit_token', token);
    supabase.realtime.setAuth(token);
  } else {
    localStorage.removeItem('loopit_token');
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }, // we handle it
  global: {
    fetch: (url, options = {}) => {
      if (customToken) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${customToken}`);
        options.headers = headers;
      }
      return fetch(url, options);
    },
  },
});

if (customToken) {
  supabase.realtime.setAuth(customToken);
}
