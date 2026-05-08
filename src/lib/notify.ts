/**
 * @deprecated SECURITY: This module is intentionally disabled.
 *
 * Telegram notifications are now triggered exclusively via the PostgreSQL
 * trigger `trg_notify_match` (pg_net) on the server side.
 *
 * The `notify-telegram` Edge Function requires an `x-internal-secret` header
 * that is NEVER available on the frontend — calling it from the browser will
 * always return 403 Forbidden.
 *
 * Do NOT add new callers of this function. Add notification logic to:
 *   supabase/migrations/008_match_notify_trigger.sql
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const sendTelegramNotify = (..._args: unknown[]): void => {
  // Intentional no-op — notifications fire from DB trigger trg_notify_match.
};
