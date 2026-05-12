-- Prevent report spam: one open report per reporter/reported pair.

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_open_per_pair
    ON public.reports (reporter_id, reported_user_id)
    WHERE status = 'open';

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

    SELECT r.id
    INTO v_report_id
    FROM public.reports r
    WHERE r.reporter_id = v_reporter_id
      AND r.reported_user_id = p_reported_user_id
      AND r.status = 'open'
    ORDER BY r.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN v_report_id;
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
    ON CONFLICT (reporter_id, reported_user_id)
        WHERE status = 'open'
    DO UPDATE SET
        reason = public.reports.reason
    RETURNING id INTO v_report_id;

    RETURN v_report_id;
END;
$$;
