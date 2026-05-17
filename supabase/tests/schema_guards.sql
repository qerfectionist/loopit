-- Schema guards for security-sensitive Supabase behavior.
-- These checks are read-only and fail fast if a previous security fix regresses.

DO $$
DECLARE
  v_failures text[] := ARRAY[]::text[];
  v_definition text;
BEGIN
  -- Users may edit profile fields, but not trust counters.
  IF has_column_privilege('authenticated', 'public.users', 'rating', 'UPDATE') THEN
    v_failures := array_append(v_failures, 'authenticated can update users.rating');
  END IF;

  IF has_column_privilege('authenticated', 'public.users', 'total_exchanges', 'UPDATE') THEN
    v_failures := array_append(v_failures, 'authenticated can update users.total_exchanges');
  END IF;

  IF has_column_privilege('authenticated', 'public.users', 'review_count', 'UPDATE') THEN
    v_failures := array_append(v_failures, 'authenticated can update users.review_count');
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.users', 'first_name', 'UPDATE') THEN
    v_failures := array_append(v_failures, 'authenticated cannot update users.first_name');
  END IF;

  -- Reports must go through submit_report and dedupe open reports.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'reports'
      AND indexname = 'idx_reports_one_open_per_pair'
      AND indexdef LIKE '%(reporter_id, reported_user_id)%'
      AND indexdef LIKE '%WHERE (status = ''open''::text)%'
  ) THEN
    v_failures := array_append(v_failures, 'missing open-report dedupe index');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reports'
      AND cmd = 'INSERT'
      AND with_check = 'false'
  ) THEN
    v_failures := array_append(v_failures, 'reports direct insert policy is not closed');
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.submit_report(uuid, text, text, uuid, uuid, uuid)',
    'EXECUTE'
  ) THEN
    v_failures := array_append(v_failures, 'authenticated cannot execute public.submit_report');
  END IF;

  -- Wishlist matches must use a private definer implementation and hide blocked users.
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname = 'find_wishlist_matches_impl';

  IF v_definition IS NULL THEN
    v_failures := array_append(v_failures, 'missing private.find_wishlist_matches_impl');
  ELSIF position('NOT private.is_blocked_bidirectional(v_user_id, u.id)' in v_definition) = 0 THEN
    v_failures := array_append(v_failures, 'wishlist matches do not filter blocked users');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'find_wishlist_matches'
      AND p.prosecdef
  ) THEN
    v_failures := array_append(v_failures, 'public find_wishlist_matches wrapper is SECURITY DEFINER');
  END IF;

  -- Search must filter condition inside SQL before LIMIT/OFFSET.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid::regprocedure::text = 'search_items(text,text,text,integer,integer)'
  ) THEN
    v_failures := array_append(v_failures, 'missing search_items p_condition signature');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid::regprocedure::text = 'search_items(text,text,integer,integer)'
  ) THEN
    v_failures := array_append(v_failures, 'old search_items signature still exists');
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid::regprocedure::text = 'search_items(text,text,text,integer,integer)';

  IF v_definition IS NULL THEN
    v_failures := array_append(v_failures, 'cannot inspect search_items definition');
  ELSIF position('i.condition = p_condition' in v_definition) = 0 THEN
    v_failures := array_append(v_failures, 'search_items does not filter condition in SQL');
  END IF;

  -- Message insert should update the conversation timestamp atomically.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'messages'
      AND t.tgname = 'trg_touch_conversation_last_message'
      AND NOT t.tgisinternal
      AND pn.nspname = 'private'
      AND p.proname = 'touch_conversation_last_message_at'
  ) THEN
    v_failures := array_append(v_failures, 'missing message last_message_at trigger');
  END IF;

  IF coalesce(array_length(v_failures, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Supabase schema guard failures: %', array_to_string(v_failures, '; ');
  END IF;
END;
$$;

SELECT 'supabase schema guards passed' AS result;
