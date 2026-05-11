-- ============================================================
-- 008_match_notify_trigger.sql
-- Server-side Telegram notifications via pg_net trigger.
-- Frontend NEVER calls notify-telegram directly.
-- ============================================================

-- Enable pg_net (usually pre-enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- Enable Vault extension for secure secret storage
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

-- The internal secret is stored in Supabase Vault to avoid
-- ALTER DATABASE permission issues on Supabase Cloud.

-- ============================================================
-- Trigger function: fires on INSERT / UPDATE to matches
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

  -- Retrieve the secret from Supabase Vault
  SELECT decrypted_secret INTO v_internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'internal_notify_secret';

  -- If not found, use a fallback to avoid crashing
  IF v_internal_secret IS NULL THEN
    v_internal_secret := 'MISSING_SECRET';
  END IF;

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

-- ============================================================
-- Attach trigger to matches table
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_match ON public.matches;

CREATE TRIGGER trg_notify_match
  AFTER INSERT OR UPDATE OF status
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_match_event();

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON FUNCTION public.notify_match_event() IS
  'Sends Telegram notifications via pg_net when a match is created or accepted. '
  'Uses x-internal-secret header — frontend cannot trigger this directly.';
