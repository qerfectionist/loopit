# Loopit

Telegram Mini App for exchanging books and other items.

## What Is Inside

- Telegram login through a Supabase Edge Function.
- Item listings with images, search, filters, wishlist, matches, chat, exchanges, reviews, blocks, and reports.
- Supabase database migrations with RLS policies.
- Supabase Storage bucket for item images.
- Telegram notifications through a database trigger and Edge Function.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Important Environment Variables

Frontend:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
```

Supabase Edge Function secrets:

```bash
TELEGRAM_BOT_TOKEN=
CUSTOM_JWT_SECRET=
INTERNAL_NOTIFY_SECRET=
```

## Security Notes

- The app uses a custom Telegram JWT. Database policies rely on `auth.uid()`.
- User IDs sent from the frontend must not be trusted for authorization.
- Match acceptance, match decline, likes, wishlist matching, and exchange confirmation are handled by database functions.
- Do not keep one-time database repair scripts in the app folder.
