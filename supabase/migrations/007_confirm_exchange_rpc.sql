-- ============================================================
-- Migration 007: confirm_exchange RPC
-- Atomic exchange completion via PostgreSQL function.
-- Replaces client-side multi-step confirmExchange logic.
-- Uses SELECT FOR UPDATE to prevent race condition.
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_exchange(p_exchange_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_exchange exchanges%ROWTYPE;
  v_is_initiator boolean;
  v_both_confirmed boolean;
  v_item_ids uuid[];
BEGIN
  -- 1. Lock row to prevent race condition
  SELECT * INTO v_exchange
  FROM exchanges
  WHERE id = p_exchange_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Exchange not found');
  END IF;

  -- 2. Verify caller is a participant
  IF v_exchange.initiator_id != p_user_id AND v_exchange.responder_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'Not a participant');
  END IF;

  -- 3. Set confirmation flag
  v_is_initiator := (v_exchange.initiator_id = p_user_id);

  IF v_is_initiator THEN
    UPDATE exchanges SET initiator_confirmed = true WHERE id = p_exchange_id;
    v_both_confirmed := v_exchange.responder_confirmed;
  ELSE
    UPDATE exchanges SET responder_confirmed = true WHERE id = p_exchange_id;
    v_both_confirmed := v_exchange.initiator_confirmed;
  END IF;

  -- 4. If both confirmed — complete atomically
  IF v_both_confirmed THEN
    UPDATE exchanges
    SET status = 'completed', completed_at = now()
    WHERE id = p_exchange_id;

    -- Update both items
    v_item_ids := ARRAY[v_exchange.item_given, v_exchange.item_received]::uuid[];
    UPDATE items
    SET status = 'exchanged', updated_at = now()
    WHERE id = ANY(v_item_ids) AND id IS NOT NULL;

    -- Increment total_exchanges for both users
    UPDATE users
    SET total_exchanges = total_exchanges + 1
    WHERE id IN (v_exchange.initiator_id, v_exchange.responder_id);

    RETURN jsonb_build_object('completed', true, 'exchange_id', p_exchange_id);
  END IF;

  RETURN jsonb_build_object('completed', false, 'exchange_id', p_exchange_id);
END;
$$;
