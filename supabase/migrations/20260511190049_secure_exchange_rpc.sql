-- Secure exchange mutations behind RPC functions.
-- Clients keep read access through RLS, but writes go through validated functions.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_blocked_bidirectional(user1 uuid, user2 uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_blocks ub
        WHERE (ub.blocker_id = user1 AND ub.blocked_id = user2)
           OR (ub.blocker_id = user2 AND ub.blocked_id = user1)
    );
$$;

CREATE OR REPLACE FUNCTION private.propose_exchange_impl(
    p_conversation_id uuid,
    p_match_id uuid,
    p_item_given uuid,
    p_item_received uuid DEFAULT NULL,
    p_meetup_location jsonb DEFAULT NULL,
    p_meetup_time timestamptz DEFAULT NULL
)
RETURNS public.exchanges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_conversation public.conversations%ROWTYPE;
    v_match public.matches%ROWTYPE;
    v_given_item public.items%ROWTYPE;
    v_received_item public.items%ROWTYPE;
    v_responder_id uuid;
    v_exchange public.exchanges%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT *
    INTO v_conversation
    FROM public.conversations
    WHERE id = p_conversation_id
      AND match_id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    IF v_conversation.user_a = v_user_id THEN
        v_responder_id := v_conversation.user_b;
    ELSIF v_conversation.user_b = v_user_id THEN
        v_responder_id := v_conversation.user_a;
    ELSE
        RAISE EXCEPTION 'Not allowed for this conversation';
    END IF;

    IF private.is_blocked_bidirectional(v_user_id, v_responder_id) THEN
        RAISE EXCEPTION 'Exchange is blocked for these users';
    END IF;

    SELECT *
    INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF v_match.status <> 'accepted' THEN
        RAISE EXCEPTION 'Exchange requires an accepted match';
    END IF;

    IF NOT (
        v_match.user_a IN (v_conversation.user_a, v_conversation.user_b)
        AND v_match.user_b IN (v_conversation.user_a, v_conversation.user_b)
    ) THEN
        RAISE EXCEPTION 'Match does not belong to this conversation';
    END IF;

    SELECT *
    INTO v_given_item
    FROM public.items
    WHERE id = p_item_given
    FOR UPDATE;

    IF NOT FOUND OR v_given_item.user_id <> v_user_id OR v_given_item.status <> 'active' THEN
        RAISE EXCEPTION 'Given item is not available';
    END IF;

    IF p_item_received IS NOT NULL THEN
        SELECT *
        INTO v_received_item
        FROM public.items
        WHERE id = p_item_received
        FOR UPDATE;

        IF NOT FOUND OR v_received_item.user_id <> v_responder_id OR v_received_item.status <> 'active' THEN
            RAISE EXCEPTION 'Received item is not available';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.exchanges e
        WHERE e.match_id = p_match_id
          AND e.status IN ('proposed', 'accepted')
    ) THEN
        RAISE EXCEPTION 'An active exchange already exists for this match';
    END IF;

    INSERT INTO public.exchanges (
        conversation_id,
        match_id,
        initiator_id,
        responder_id,
        item_given,
        item_received,
        meetup_location,
        meetup_time,
        status,
        initiator_confirmed,
        responder_confirmed
    )
    VALUES (
        p_conversation_id,
        p_match_id,
        v_user_id,
        v_responder_id,
        p_item_given,
        p_item_received,
        p_meetup_location,
        p_meetup_time,
        'proposed',
        false,
        false
    )
    RETURNING * INTO v_exchange;

    RETURN v_exchange;
END;
$$;

CREATE OR REPLACE FUNCTION private.accept_exchange_impl(p_exchange_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_exchange public.exchanges%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT *
    INTO v_exchange
    FROM public.exchanges
    WHERE id = p_exchange_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange not found';
    END IF;

    IF v_user_id NOT IN (v_exchange.initiator_id, v_exchange.responder_id) THEN
        RAISE EXCEPTION 'Not allowed for this exchange';
    END IF;

    IF private.is_blocked_bidirectional(v_exchange.initiator_id, v_exchange.responder_id) THEN
        RAISE EXCEPTION 'Exchange is blocked for these users';
    END IF;

    IF v_exchange.status = 'accepted' THEN
        RETURN true;
    END IF;

    IF v_exchange.status <> 'proposed' THEN
        RAISE EXCEPTION 'Only proposed exchanges can be accepted';
    END IF;

    IF v_user_id <> v_exchange.responder_id THEN
        RAISE EXCEPTION 'Only the responder can accept this exchange';
    END IF;

    UPDATE public.exchanges
    SET status = 'accepted'
    WHERE id = p_exchange_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.cancel_exchange_impl(p_exchange_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_exchange public.exchanges%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT *
    INTO v_exchange
    FROM public.exchanges
    WHERE id = p_exchange_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange not found';
    END IF;

    IF v_user_id NOT IN (v_exchange.initiator_id, v_exchange.responder_id) THEN
        RAISE EXCEPTION 'Not allowed for this exchange';
    END IF;

    IF v_exchange.status = 'cancelled' THEN
        RETURN true;
    END IF;

    IF v_exchange.status = 'completed' THEN
        RAISE EXCEPTION 'Completed exchanges cannot be cancelled';
    END IF;

    UPDATE public.exchanges
    SET status = 'cancelled'
    WHERE id = p_exchange_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_exchange_meetup_impl(
    p_exchange_id uuid,
    p_place text,
    p_time timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_exchange public.exchanges%ROWTYPE;
    v_place text := NULLIF(trim(p_place), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_place IS NULL THEN
        RAISE EXCEPTION 'Meetup place is required';
    END IF;

    IF p_time IS NULL THEN
        RAISE EXCEPTION 'Meetup time is required';
    END IF;

    SELECT *
    INTO v_exchange
    FROM public.exchanges
    WHERE id = p_exchange_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange not found';
    END IF;

    IF v_user_id NOT IN (v_exchange.initiator_id, v_exchange.responder_id) THEN
        RAISE EXCEPTION 'Not allowed for this exchange';
    END IF;

    IF private.is_blocked_bidirectional(v_exchange.initiator_id, v_exchange.responder_id) THEN
        RAISE EXCEPTION 'Exchange is blocked for these users';
    END IF;

    IF v_exchange.status <> 'accepted' THEN
        RAISE EXCEPTION 'Meetup can be updated only after exchange acceptance';
    END IF;

    UPDATE public.exchanges
    SET
        meetup_location = jsonb_build_object('lat', 0, 'lng', 0, 'city', v_place),
        meetup_time = p_time
    WHERE id = p_exchange_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_exchange(
    p_conversation_id uuid,
    p_match_id uuid,
    p_item_given uuid,
    p_item_received uuid DEFAULT NULL,
    p_meetup_location jsonb DEFAULT NULL,
    p_meetup_time timestamptz DEFAULT NULL
)
RETURNS public.exchanges
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.propose_exchange_impl(
        p_conversation_id,
        p_match_id,
        p_item_given,
        p_item_received,
        p_meetup_location,
        p_meetup_time
    );
$$;

CREATE OR REPLACE FUNCTION public.accept_exchange(p_exchange_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.accept_exchange_impl(p_exchange_id);
$$;

CREATE OR REPLACE FUNCTION public.cancel_exchange(p_exchange_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.cancel_exchange_impl(p_exchange_id);
$$;

CREATE OR REPLACE FUNCTION public.update_exchange_meetup(
    p_exchange_id uuid,
    p_place text,
    p_time timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.update_exchange_meetup_impl(p_exchange_id, p_place, p_time);
$$;

REVOKE ALL ON FUNCTION private.is_blocked_bidirectional(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.propose_exchange_impl(uuid, uuid, uuid, uuid, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.accept_exchange_impl(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.cancel_exchange_impl(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.update_exchange_meetup_impl(uuid, text, timestamptz) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.propose_exchange(uuid, uuid, uuid, uuid, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_exchange(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_exchange(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_exchange_meetup(uuid, text, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.propose_exchange_impl(uuid, uuid, uuid, uuid, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION private.accept_exchange_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.cancel_exchange_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.update_exchange_meetup_impl(uuid, text, timestamptz) TO authenticated;

GRANT EXECUTE ON FUNCTION public.propose_exchange(uuid, uuid, uuid, uuid, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_exchange(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_exchange(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_exchange_meetup(uuid, text, timestamptz) TO authenticated;

DROP POLICY IF EXISTS "Auth users create exchanges as initiator" ON public.exchanges;
DROP POLICY IF EXISTS "Auth users update own exchanges" ON public.exchanges;
DROP POLICY IF EXISTS "No direct exchange inserts" ON public.exchanges;
DROP POLICY IF EXISTS "No direct exchange updates" ON public.exchanges;

CREATE POLICY "No direct exchange inserts" ON public.exchanges
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "No direct exchange updates" ON public.exchanges
    FOR UPDATE
    USING (false)
    WITH CHECK (false);
