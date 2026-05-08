import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface NotifyPayload {
  telegram_id: number;
  event: 'new_match' | 'match_accepted' | 'new_message' | 'exchange_proposed' | 'exchange_completed';
  data?: Record<string, string>;
}

const MESSAGES: Record<NotifyPayload['event'], (data?: Record<string, string>) => string> = {
  new_match: (d) =>
    `📚 *Новый матч!*\n${d?.name ?? 'Кто-то'} заинтересовался вашей книгой «${d?.title ?? ''}». Откройте приложение, чтобы ответить.`,
  match_accepted: (d) =>
    `🎉 *Матч принят!*\n${d?.name ?? 'Пользователь'} принял ваш запрос на обмен. Открывайте чат и договаривайтесь!`,
  new_message: (d) =>
    `💬 *Новое сообщение*\n${d?.name ?? 'Пользователь'}: ${d?.text ?? '...'}`,
  exchange_proposed: (d) =>
    `🤝 *Предложение обмена!*\n${d?.name ?? 'Пользователь'} предлагает обменяться. Проверьте детали в приложении.`,
  exchange_completed: () =>
    `✅ *Обмен завершён!*\nОба участника подтвердили передачу. Оставьте отзыв о партнёре.`,
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { telegram_id, event, data } = payload;

  if (!telegram_id || !event) {
    return new Response(JSON.stringify({ error: 'Missing telegram_id or event' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messageText = MESSAGES[event]?.(data);
  if (!messageText) {
    return new Response(JSON.stringify({ error: 'Unknown event' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Send via Telegram Bot API
  const tgRes = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegram_id,
      text: messageText,
      parse_mode: 'Markdown',
    }),
  });

  const tgBody = await tgRes.json();

  if (!tgRes.ok) {
    console.error('[notify-telegram] Telegram API error:', tgBody);
    return new Response(JSON.stringify({ error: tgBody.description ?? 'Telegram error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
