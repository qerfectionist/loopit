// supabase/functions/auth-telegram/index.ts
//
// Telegram WebApp auth for Supabase.
// Flow:
//   1. Receives initData from Telegram WebApp
//   2. Verifies HMAC-SHA256 signature using TELEGRAM_BOT_TOKEN
//   3. Parses Telegram user from initData
//   4. Upserts user in public.users via service_role
//   5. Signs a custom JWT with SUPABASE_JWT_SECRET
//   6. Returns { access_token, user }
//
// ENV required (set in Supabase Dashboard → Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN        — your bot token from @BotFather        [ADD MANUALLY]
//   SUPABASE_JWT_SECRET       — project JWT secret (Settings → API)   [ADD MANUALLY]
//   SUPABASE_URL              — auto-provided by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase runtime
//   SUPABASE_ANON_KEY         — auto-provided by Supabase runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// CORS headers — needed for browser requests
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Telegram initData HMAC verification
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// ---------------------------------------------------------------------------
async function verifyTelegramInitData(
  initData: string,
  botToken: string,
): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  // Build the data-check-string: sorted key=value pairs (excluding hash)
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // HMAC key = HMAC-SHA256("WebAppData", botToken)
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretKey = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(botToken),
  );

  // HMAC-SHA256(dataCheckString, secretKey)
  const verifyKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    verifyKey,
    encoder.encode(dataCheckString),
  );

  // Convert signature to hex and compare
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatureHex === hash;
}

// ---------------------------------------------------------------------------
// Sign a custom JWT compatible with Supabase RLS (auth.uid() = sub)
// ---------------------------------------------------------------------------
async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signingInput = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput),
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signatureB64}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // --- 1. Parse request body ---
    const body = await req.json().catch(() => null);
    const initData: string | undefined = body?.initData;

    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // --- 2. Get env vars ---
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const jwtSecret = Deno.env.get('CUSTOM_JWT_SECRET');

    if (!botToken || !supabaseUrl || !serviceRoleKey || !jwtSecret) {
      console.error('[auth-telegram] Missing required env vars');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // --- 3. Verify Telegram signature ---
    // In DEV mode (initData = "dev"), skip verification
    let tgUser: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    } | null = null;

    if (initData === 'dev') {
      // DEV bypass — only allowed when ALLOW_DEV_AUTH=true is set in Edge Function secrets
      const allowDev = Deno.env.get('ALLOW_DEV_AUTH');
      if (allowDev !== 'true') {
        return new Response(JSON.stringify({ error: 'Dev auth not allowed in this environment' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      tgUser = {
        id: 123456789,
        first_name: 'Developer',
        last_name: 'Local',
        username: 'dev_local',
      };
    } else {
      const isValid = await verifyTelegramInitData(initData, botToken);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid Telegram signature' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Parse params from initData
      const params = new URLSearchParams(initData);

      // --- auth_date check: reject initData older than 5 minutes ---
      // Prevents replay attacks where an old (stolen) initData is reused.
      const authDateStr = params.get('auth_date');
      if (!authDateStr) {
        return new Response(JSON.stringify({ error: 'Missing auth_date in initData' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const authDate = parseInt(authDateStr, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      const MAX_AGE_SECONDS = 5 * 60; // 5 minutes per Telegram recommendation
      if (nowSec - authDate > MAX_AGE_SECONDS) {
        return new Response(JSON.stringify({ error: 'initData has expired' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Parse user from initData
      const userStr = params.get('user');
      if (!userStr) {
        return new Response(JSON.stringify({ error: 'No user in initData' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      tgUser = JSON.parse(userStr);
    }

    if (!tgUser) {
      return new Response(JSON.stringify({ error: 'Failed to parse Telegram user' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // --- 4. Upsert user in public.users via service_role ---
    // service_role bypasses RLS — safe here since we verified Telegram identity
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: user, error: upsertError } = await adminClient
      .from('users')
      .upsert(
        {
          telegram_id: tgUser.id,
          username: tgUser.username ?? null,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name ?? null,
          avatar_url: tgUser.photo_url ?? null,
        },
        { onConflict: 'telegram_id' },
      )
      .select()
      .single();

    if (upsertError || !user) {
      console.error('[auth-telegram] Upsert failed:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to create user' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // --- 5. Sign custom JWT ---
    // sub = public.users.id (UUID) → auth.uid() will return this value
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7; // 7 days

    const jwtPayload = {
      sub: user.id,           // UUID from public.users — this is what auth.uid() returns
      role: 'authenticated',  // required by Supabase RLS
      aud: 'authenticated',   // required by Supabase
      iat: now,
      exp,
      // Custom claim for extra security checks if needed
      telegram_id: tgUser.id,
    };

    const accessToken = await signJwt(jwtPayload, jwtSecret);

    // --- 6. Return token and user ---
    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 60 * 60 * 24 * 7,
        user,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[auth-telegram] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
