-- Account deletion and push notification tokens
--
-- 1. push_tokens — one row per phone that has allowed notifications. Written
--    and read only by the server (service role); no client role can see another
--    user's device token.
--
-- 2. delete_account(uuid) — everything the database has to forget when a user
--    deletes their account, in ONE transaction, so a failure part-way leaves
--    nothing half-deleted.
--
--      * A business the user OWNS is deleted with all of its data: jobs,
--        photos and documents (rows here; the files are returned as
--        `storage_paths` for the server to remove), clients, reviews, review
--        requests, Google connection, automation, billing rows.
--      * A business the user only WORKS FOR is untouched. Their membership is
--        removed and their name comes off assignments; the work they uploaded
--        stays with the business.
--      * A super admin cannot delete themselves this way.
--
--    Service role only: the server calls it after verifying the caller's token
--    and their typed confirmation. It is not exposed to any client role.
--
-- Idempotent: safe to re-run.

-- ── 1. push_tokens ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  token        text NOT NULL,
  platform     text NOT NULL DEFAULT 'ios',
  device_name  text,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now()
);

-- A token identifies one app install. If a second person signs in on the same
-- phone the row moves to them rather than notifying both.
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_key ON public.push_tokens (token);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_tokens FROM anon, authenticated;

-- ── 2. delete_account ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role     text;
  v_biz      uuid[];
  v_jobs     uuid[];
  v_clients  uuid[];
  v_media    uuid[];
  v_owner_keys text[];
  v_paths    text[];
  r          record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF lower(regexp_replace(COALESCE(v_role, ''), '[^a-zA-Z]', '', 'g')) = 'superadmin' THEN
    RAISE EXCEPTION 'super_admin_cannot_self_delete' USING ERRCODE = 'P0001';
  END IF;

  v_biz     := COALESCE(ARRAY(SELECT b.id FROM public.businesses b WHERE b.owner_id = p_user_id), '{}');
  v_jobs    := COALESCE(ARRAY(SELECT j.id FROM public.jobs j WHERE j.business_id = ANY (v_biz)), '{}');
  v_clients := COALESCE(ARRAY(SELECT c.id FROM public.clients c WHERE c.business_id = ANY (v_biz)), '{}');
  v_media   := COALESCE(ARRAY(SELECT m.id FROM public.job_media m
                              WHERE m.job_id = ANY (v_jobs) OR m.client_id = ANY (v_clients)), '{}');

  -- Files live under <folder>/<job id or client id>/… in the private bucket.
  -- Collected before the rows go, returned for the server to remove.
  v_owner_keys := COALESCE(ARRAY(SELECT x::text FROM unnest(v_jobs || v_clients) AS x), '{}');
  v_paths := COALESCE(ARRAY(
    SELECT o.name FROM storage.objects o
    WHERE o.bucket_id = 'media'
      AND split_part(o.name, '/', 1) IN ('project-media', 'project-documents', 'client-documents')
      AND split_part(o.name, '/', 2) = ANY (v_owner_keys)
  ), '{}');

  IF array_length(v_biz, 1) IS NOT NULL THEN
    -- Tables keyed by job or photo id as text, with no foreign key to cascade.
    DELETE FROM public.media_comments        WHERE media_id = ANY (ARRAY(SELECT x::text FROM unnest(v_media) AS x));
    DELETE FROM public.job_checkins          WHERE job_id = ANY (ARRAY(SELECT x::text FROM unnest(v_jobs) AS x));
    DELETE FROM public.job_notes             WHERE job_id = ANY (ARRAY(SELECT x::text FROM unnest(v_jobs) AS x));
    DELETE FROM public.job_field_state       WHERE job_id = ANY (ARRAY(SELECT x::text FROM unnest(v_jobs) AS x));
    DELETE FROM public.server_media_metadata WHERE job_id = ANY (ARRAY(SELECT x::text FROM unnest(v_jobs) AS x));

    -- Every table that carries a business_id, discovered at run time so a table
    -- added later is covered without editing this function. Children of jobs
    -- and clients go with their parent through their own cascades.
    FOR r IN
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'business_id'
        AND t.table_type = 'BASE TABLE'
    LOOP
      EXECUTE format('DELETE FROM public.%I WHERE business_id::text = ANY ($1)', r.table_name)
        USING ARRAY(SELECT x::text FROM unnest(v_biz) AS x);
    END LOOP;

    DELETE FROM public.businesses WHERE id = ANY (v_biz) AND owner_id = p_user_id;
  END IF;

  -- The user themself, in businesses they did not own.
  UPDATE public.jobs             SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE public.job_tasks        SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE public.job_tasks        SET assigned_by = NULL WHERE assigned_by = p_user_id;
  UPDATE public.business_members SET invited_by  = NULL WHERE invited_by  = p_user_id;
  UPDATE public.audit_logs       SET user_id     = NULL WHERE user_id     = p_user_id;
  DELETE FROM public.business_members    WHERE user_id = p_user_id;
  DELETE FROM public.google_oauth_tokens WHERE user_id = p_user_id;
  DELETE FROM public.notifications       WHERE user_id = p_user_id;
  DELETE FROM public.push_tokens         WHERE user_id = p_user_id;
  DELETE FROM public.idea_votes          WHERE user_id = p_user_id::text;
  DELETE FROM public.crash_logs          WHERE user_id = p_user_id::text;

  DELETE FROM public.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'businesses_deleted', COALESCE(array_length(v_biz, 1), 0),
    'jobs_deleted',       COALESCE(array_length(v_jobs, 1), 0),
    'storage_paths',      to_jsonb(v_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid) TO service_role;
