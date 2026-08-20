-- =====================================================================
-- RLS hardening round 2 (post-audit fixes)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Supabase Auth must be able to run the auth.users triggers.
--    (Revoking EXECUTE from PUBLIC broke every login with
--     "Database error querying schema".)
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user()     TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_updated() TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_updated() FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. BLOCKER: users could UPDATE their own `role` to super_admin.
--    Belt: a trigger that rejects privileged-column changes unless the
--    caller is already super_admin or the service role.
--    Braces: column-level REVOKE so PostgREST rejects the column outright.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_is_admin boolean;
BEGIN
  -- service_role / postgres (no JWT) are trusted.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    INTO caller_is_admin;
  IF caller_is_admin THEN RETURN NEW; END IF;
  IF NEW.role           IS DISTINCT FROM OLD.role
  OR NEW.id             IS DISTINCT FROM OLD.id
  OR NEW.email          IS DISTINCT FROM OLD.email
  OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
  OR NEW.sub_account_id IS DISTINCT FROM OLD.sub_account_id THEN
    RAISE EXCEPTION 'not allowed to change privileged user fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_user_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_user_privileged_columns ON public.users;
CREATE TRIGGER trg_guard_user_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_privileged_columns();

-- Column-level: authenticated may update only profile fields.
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (name, first_name, last_name, avatar_url, phone, metadata, updated_at, is_2fa_enabled, last_login, phone_verified)
  ON public.users TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Spoofable community/support inserts: callers could set is_admin,
--    admin_notes, vote counts, is_staff, is_internal, and impersonate
--    another author_email. Tighten WITH CHECK and revoke the columns.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "ideas_insert" ON public.ideas;
CREATE POLICY "ideas_insert" ON public.ideas FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin() OR (
      author_email = auth.email()
      AND COALESCE(upvotes,0) = 0 AND COALESCE(downvotes,0) = 0 AND COALESCE(comments_count,0) = 0
      AND admin_notes IS NULL AND assigned_to IS NULL AND estimated_completion IS NULL
    )
  );
REVOKE INSERT ON public.ideas FROM authenticated;
GRANT INSERT (title, description, category, author_name, author_email) ON public.ideas TO authenticated;

DROP POLICY IF EXISTS "idea_comments_insert" ON public.idea_comments;
CREATE POLICY "idea_comments_insert" ON public.idea_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (author_email = auth.email() AND COALESCE(is_admin,false) = false));
REVOKE INSERT ON public.idea_comments FROM authenticated;
GRANT INSERT (idea_id, author_name, author_email, content) ON public.idea_comments TO authenticated;

-- Support tickets: users may create and READ their own (by submitted_by = email),
-- and read non-internal responses on their own tickets; reply as non-staff.
DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (submitted_by = auth.email() AND assigned_to IS NULL));
DROP POLICY IF EXISTS "support_tickets_own_select" ON public.support_tickets;
CREATE POLICY "support_tickets_own_select" ON public.support_tickets FOR SELECT TO authenticated
  USING (submitted_by = auth.email());
REVOKE INSERT ON public.support_tickets FROM authenticated;
GRANT INSERT (ticket_number, title, description, category, priority, status, submitted_by, organization, user_type, tags)
  ON public.support_tickets TO authenticated;

DROP POLICY IF EXISTS "ticket_responses_insert" ON public.ticket_responses;
CREATE POLICY "ticket_responses_insert" ON public.ticket_responses FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin() OR (
      COALESCE(is_staff,false) = false AND COALESCE(is_internal,false) = false
      AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_responses.ticket_id AND t.submitted_by = auth.email())
    )
  );
DROP POLICY IF EXISTS "ticket_responses_own_select" ON public.ticket_responses;
CREATE POLICY "ticket_responses_own_select" ON public.ticket_responses FOR SELECT TO authenticated
  USING (
    COALESCE(is_internal,false) = false
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_responses.ticket_id AND t.submitted_by = auth.email())
  );
REVOKE INSERT ON public.ticket_responses FROM authenticated;
GRANT INSERT (ticket_id, message, author) ON public.ticket_responses TO authenticated;

-- ---------------------------------------------------------------------
-- 3. public_job() leaked internal metadata (notes, GPS) to anon.
--    Project only the public-safe keys.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_job(p_id uuid)
RETURNS TABLE (id uuid, name text, description text, created_at timestamptz,
               seo_targets jsonb, metadata jsonb, photo_paths text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.name, j.description, j.created_at,
         NULL::jsonb,
         jsonb_strip_nulls(jsonb_build_object(
           'tags',     j.metadata -> 'tags',
           'keywords', j.metadata -> 'keywords'
         )),
         COALESCE(ARRAY(SELECT m.file_path FROM public.job_media m
                        WHERE m.job_id=j.id AND m.media_type='image'
                        ORDER BY m.created_at), '{}')
  FROM public.jobs j WHERE j.id = p_id;
$$;

-- review_request_public: only the settings keys the gate page renders.
CREATE OR REPLACE FUNCTION public.review_request_public(p_id uuid)
RETURNS TABLE (id uuid, business_id uuid, customer_name text, project_name text,
               business_name text, settings jsonb, address jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rr.id, rr.business_id, rr.customer_name, rr.project_name, b.name,
         jsonb_strip_nulls(jsonb_build_object(
           'reviewGateGoogleUrl', COALESCE(b.settings->'reviewGateGoogleUrl', b.google_my_business->'review_url'),
           'reviewGateThreshold', b.settings->'reviewGateThreshold',
           'reviewGateVideoUrl',  b.settings->'reviewGateVideoUrl',
           'reviewGateMessage',   b.settings->'reviewGateMessage',
           'logoUrl',             b.settings->'logoUrl',
           'primaryColor',        b.settings->'primaryColor',
           'address',             b.settings->'address',
           'city',                b.settings->'city',
           'state',               b.settings->'state'
         )),
         jsonb_strip_nulls(jsonb_build_object('city', b.address->'city', 'state', b.address->'state'))
  FROM public.review_requests rr JOIN public.businesses b ON b.id = rr.business_id
  WHERE rr.id = p_id;
$$;

-- submit_gate_review: one review per request, bounded sizes, valid status.
CREATE OR REPLACE FUNCTION public.submit_gate_review(
  p_request_id uuid, p_rating int, p_title text, p_text text,
  p_author_name text, p_to_google boolean)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_biz uuid; v_status text;
BEGIN
  SELECT business_id, status INTO v_biz, v_status FROM public.review_requests WHERE id = p_request_id;
  IF v_biz IS NULL THEN RAISE EXCEPTION 'unknown review request'; END IF;
  IF v_status NOT IN ('sent','viewed','scheduled') THEN RAISE EXCEPTION 'review request is closed'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'invalid rating'; END IF;
  IF length(COALESCE(p_text,'')) > 5000 OR length(COALESCE(p_title,'')) > 200 OR length(COALESCE(p_author_name,'')) > 120 THEN
    RAISE EXCEPTION 'input too long';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reviews r WHERE r.metadata->>'review_request_id' = p_request_id::text) THEN
    RAISE EXCEPTION 'review already submitted';
  END IF;
  INSERT INTO public.reviews (business_id, platform, rating, title, text, author, date, metadata)
  VALUES (v_biz, 'custom', p_rating, NULLIF(p_title,''),
          COALESCE(NULLIF(trim(p_text),''),'(no comment provided)'),
          jsonb_build_object('name', COALESCE(NULLIF(p_author_name,''),'Customer')),
          now(),
          jsonb_build_object('source','review_gate','redirected_to_google',p_to_google,'review_request_id',p_request_id));
  UPDATE public.review_requests SET status = 'viewed', viewed_at = COALESCE(viewed_at, now()) WHERE id = p_request_id;
END; $$;

-- ---------------------------------------------------------------------
-- 4. Helper functions: not callable by anon over REST.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_super_admin()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_business(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_business(text)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_business_ids()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_sub_account_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_workspace_account_id() FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER FUNCTION public.update_updated_at_column()      SET search_path = public;
ALTER FUNCTION public.set_sub_account_id()            SET search_path = public;
ALTER FUNCTION public.set_business_account_id()       SET search_path = public;
ALTER FUNCTION public.generate_sub_account_id()       SET search_path = public;
ALTER FUNCTION public.generate_workspace_account_id() SET search_path = public;

-- ---------------------------------------------------------------------
-- 5. Client-level media/documents (job_id NULL, client_id set) were
--    unreachable under the job-scoped policies. Allow via client->business.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "job_media_rw" ON public.job_media;
CREATE POLICY "job_media_rw" ON public.job_media FOR ALL TO authenticated
  USING (public.is_super_admin()
     OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_media.job_id AND public.owns_business(j.business_id))
     OR (job_media.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = job_media.client_id AND public.owns_business(c.business_id))))
  WITH CHECK (public.is_super_admin()
     OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_media.job_id AND public.owns_business(j.business_id))
     OR (job_media.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = job_media.client_id AND public.owns_business(c.business_id))));
DROP POLICY IF EXISTS "job_documents_rw" ON public.job_documents;
CREATE POLICY "job_documents_rw" ON public.job_documents FOR ALL TO authenticated
  USING (public.is_super_admin()
     OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_documents.job_id AND public.owns_business(j.business_id))
     OR (job_documents.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = job_documents.client_id AND public.owns_business(c.business_id))))
  WITH CHECK (public.is_super_admin()
     OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_documents.job_id AND public.owns_business(j.business_id))
     OR (job_documents.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = job_documents.client_id AND public.owns_business(c.business_id))));

-- ---------------------------------------------------------------------
-- 6. Storage: scope writes so user A can't overwrite/delete user B's objects.
--    Layout enforced: <area>/<owner-scoped-id>/... ; the second path segment
--    must be a business the caller owns, a job of such a business, the
--    caller's own user id (avatars), or branding/ (super admin only).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storage_path_allowed(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE seg text[]; k text; u uuid;
BEGIN
  IF public.is_super_admin() THEN RETURN true; END IF;
  seg := string_to_array(p_name, '/');
  IF array_length(seg,1) < 2 THEN RETURN false; END IF;
  IF seg[1] = 'branding' THEN RETURN false; END IF;
  k := seg[2];
  BEGIN u := k::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  IF u = auth.uid() THEN RETURN true; END IF;                                -- avatars/<uid>/...
  IF public.owns_business(u) THEN RETURN true; END IF;                       -- <area>/<business_id>/...
  IF EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = u AND public.owns_business(j.business_id)) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.clients c WHERE c.id = u AND public.owns_business(c.business_id)) THEN RETURN true; END IF;
  RETURN false;
END; $$;
REVOKE EXECUTE ON FUNCTION public.storage_path_allowed(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.storage_path_allowed(text) TO authenticated;

DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_delete" ON storage.objects;
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='media' AND public.storage_path_allowed(name));
CREATE POLICY "media_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='media' AND public.storage_path_allowed(name))
  WITH CHECK (bucket_id='media' AND public.storage_path_allowed(name));
CREATE POLICY "media_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='media' AND public.storage_path_allowed(name));

-- ---------------------------------------------------------------------
-- 7. Indexes for RLS predicates.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS businesses_owner_id_idx      ON public.businesses (owner_id);
CREATE INDEX IF NOT EXISTS jobs_assigned_to_idx         ON public.jobs (assigned_to);
CREATE INDEX IF NOT EXISTS review_requests_business_idx ON public.review_requests (business_id);
CREATE INDEX IF NOT EXISTS locations_business_idx       ON public.locations (business_id);
CREATE INDEX IF NOT EXISTS analytics_business_idx       ON public.analytics (business_id);
CREATE INDEX IF NOT EXISTS idea_votes_user_idx          ON public.idea_votes (user_id);
CREATE INDEX IF NOT EXISTS ticket_responses_ticket_idx  ON public.ticket_responses (ticket_id);
CREATE INDEX IF NOT EXISTS job_media_client_idx         ON public.job_media (client_id);
CREATE INDEX IF NOT EXISTS job_documents_client_idx     ON public.job_documents (client_id);
