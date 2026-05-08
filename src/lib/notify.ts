import { supabase } from '@/lib/supabase';

type NotifyEvent =
  | 'new_match'
  | 'match_accepted'
  | 'new_message'
  | 'exchange_proposed'
  | 'exchange_completed';

/**
 * Send a Telegram notification to a user.
 * Fire-and-forget — does NOT block the caller.
 * Errors are logged but not thrown.
 */
export const sendTelegramNotify = (
  telegramId: number,
  event: NotifyEvent,
  data?: Record<string, string>
): void => {
  // Intentionally not awaited — fire and forget
  supabase.functions
    .invoke('notify-telegram', {
      body: { telegram_id: telegramId, event, data },
    })
    .then(({ error }) => {
      if (error) console.warn('[Notify] Failed to send notification:', error);
    });
};
