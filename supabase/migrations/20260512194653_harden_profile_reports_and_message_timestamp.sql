-- Harden profile updates, report submission, and conversation timestamps.

CREATE SCHEMA IF NOT EXISTS private;

-- Users may edit only profile fields. Trust counters are maintained by database RPCs/triggers.
REVOKE UPDATE ON public.users FROM anon;
REVOKE UPDATE ON public.users FROM authenticated;

GRANT UPDATE (
    username,
    first_name,
    last_name,
    avatar_url,
    bio,
    location,
    updated_at
) ON public.users TO authenticated;

DROP POLICY IF EXISTS "Auth users update own profile" ON public.users;
CREATE POLICY "Auth users update own profile"
    ON public.users
    FOR UPDATE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION private.submit_report_impl(
    p_reported_user_id uuid,
    p_reason text,
    p_description text DEFAULT NULL,
    p_related_item_id uuid DEFAULT NULL,
    p_related_conversation_id uuid DEFAULT NULL,
    p_related_exchange_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_reporter_id uuid := auth.uid();
    v_reason text := NULLIF(trim(p_reason), '');
    v_report_id uuid;
BEGIN
    IF v_reporter_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_reported_user_id IS NULL THEN
        RAISE EXCEPTION 'Reported user is required';
    END IF;

    IF p_reported_user_id = v_reporter_id THEN
        RAISE EXCEPTION 'Users cannot report themselves';
    END IF;

    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Report reason is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_reported_user_id
    ) THEN
        RAISE EXCEPTION 'Reported user not found';
    END IF;

    IF p_related_item_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id = p_related_item_id
    ) THEN
        RAISE EXCEPTION 'Related item not found';
    END IF;

    IF p_related_conversation_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = p_related_conversation_id
          AND (c.user_a = v_reporter_id OR c.user_b = v_reporter_id)
    ) THEN
        RAISE EXCEPTION 'Related conversation not found';
    END IF;

    IF p_related_exchange_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.exchanges e
        WHERE e.id = p_related_exchange_id
          AND (e.initiator_id = v_reporter_id OR e.responder_id = v_reporter_id)
    ) THEN
        RAISE EXCEPTION 'Related exchange not found';
    END IF;

    INSERT INTO public.reports (
        reporter_id,
        reported_user_id,
        reason,
        description,
        related_item_id,
        related_conversation_id,
        related_exchange_id,
        status
    )
    VALUES (
        v_reporter_id,
        p_reported_user_id,
        v_reason,
        NULLIF(trim(p_description), ''),
        p_related_item_id,
        p_related_conversation_id,
        p_related_exchange_id,
        'open'
    )
    RETURNING id INTO v_report_id;

    RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_report(
    p_reported_user_id uuid,
    p_reason text,
    p_description text DEFAULT NULL,
    p_related_item_id uuid DEFAULT NULL,
    p_related_conversation_id uuid DEFAULT NULL,
    p_related_exchange_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.submit_report_impl(
        p_reported_user_id,
        p_reason,
        p_description,
        p_related_item_id,
        p_related_conversation_id,
        p_related_exchange_id
    );
$$;

REVOKE ALL ON FUNCTION private.submit_report_impl(uuid, text, text, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_report(uuid, text, text, uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.submit_report_impl(uuid, text, text, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report(uuid, text, text, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "No direct report inserts" ON public.reports;

CREATE POLICY "No direct report inserts" ON public.reports
    FOR INSERT
    WITH CHECK (false);

CREATE OR REPLACE FUNCTION private.touch_conversation_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.touch_conversation_last_message_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_touch_conversation_last_message ON public.messages;
CREATE TRIGGER trg_touch_conversation_last_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION private.touch_conversation_last_message_at();
