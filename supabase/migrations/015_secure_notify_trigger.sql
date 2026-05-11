-- ============================================================
-- 015_secure_notify_trigger.sql
-- Overwrites notify_match_event to use current_setting instead of a hardcoded secret
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_match_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id  uuid;
  v_actor_user_id   uuid;
  v_telegram_id     bigint;
  v_actor_name      text;
  v_event           text;
  v_internal_secret text;
BEGIN
  -- Determine event + target user
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_event          := 'new_match';
    v_target_user_id := NEW.user_b;   -- notify the book owner
    v_actor_user_id  := NEW.user_a;   -- who liked

  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'accepted'
        AND OLD.status <> 'accepted' THEN
    v_event          := 'match_accepted';
    v_target_user_id := NEW.user_a;   -- notify the original liker
    v_actor_user_id  := NEW.user_b;   -- who accepted

  ELSE
    RETURN NEW; -- ignore all other events
  END IF;

  -- Look up target telegram_id
  SELECT telegram_id INTO v_telegram_id
  FROM public.users
  WHERE id = v_target_user_id;

  IF v_telegram_id IS NULL THEN
    RETURN NEW; -- user has no Telegram id, skip silently
  END IF;

  -- Look up actor name for the notification message
  SELECT first_name INTO v_actor_name
  FROM public.users
  WHERE id = v_actor_user_id;

  -- Retrieve the secret from a secure DB setting (set via Supabase Dashboard or Vault)
  v_internal_secret := current_setting('app.settings.internal_notify_secret', true);

  -- Fire HTTP call via pg_net (async, non-blocking)
  PERFORM extensions.net.http_post(
    url     := 'https://gleoaovlbiltiwcoxpes.supabase.co/functions/v1/notify-telegram',
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-internal-secret', v_internal_secret
    ),
    body    := jsonb_build_object(
      'telegram_id', v_telegram_id,
      'event',       v_event,
      'data',        jsonb_build_object(
        'name', COALESCE(v_actor_name, 'Someone')
      )
    )
  );

  RETURN NEW;
END;
$$;
