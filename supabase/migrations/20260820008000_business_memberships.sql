-- =====================================================================
-- Team memberships: business_members + can_read_business / can_write_business
--
-- Model
--   owner   implicit: businesses.owner_id (never a business_members row)
--   staff   business_members.role = 'staff'  -> read + write tenant data
--   viewer  business_members.role = 'viewer' -> read only
--   super_admin sees/writes everything (is_super_admin()), never a member.
--
-- Every tenant policy is regenerated (script: /tmp/gen_members.py pattern)
-- as a pair:
--   <table>_select  FOR SELECT  USING (can_read_business(...))
--   <table>_write   FOR ALL     USING (can_write_business(...)) WITH CHECK (same)
-- FOR ALL shares one USING across UPDATE/DELETE, so viewers (read-only) pass
-- the _select policy but fail the _write policy on every mutation.
--
-- business_members itself is READ-ONLY over PostgREST: INSERT/UPDATE/DELETE
-- are revoked from `authenticated`. All membership mutations go through the
-- server (service role) at /api/team/* so no one can add themselves or
-- anyone else to a business via the open API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('staff','viewer')),
  invited_by  uuid REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX IF NOT EXISTS business_members_business_idx ON public.business_members (business_id);
CREATE INDEX IF NOT EXISTS business_members_user_idx     ON public.business_members (user_id);

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_members FROM anon, PUBLIC;
GRANT  SELECT ON public.business_members TO authenticated;
-- Mutations are server-only (service role bypasses RLS and grants).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.business_members FROM authenticated;

-- ---------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_business(bid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
      OR public.owns_business(bid)
      OR EXISTS (SELECT 1 FROM public.business_members m
                 WHERE m.business_id = bid AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_write_business(bid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
      OR public.owns_business(bid)
      OR EXISTS (SELECT 1 FROM public.business_members m
                 WHERE m.business_id = bid AND m.user_id = auth.uid() AND m.role = 'staff');
$$;

-- Text overloads (sms_logs.business_id is text).
CREATE OR REPLACE FUNCTION public.can_read_business(bid text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  BEGIN u := bid::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.can_read_business(u);
END; $$;

CREATE OR REPLACE FUNCTION public.can_write_business(bid text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  BEGIN u := bid::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.can_write_business(u);
END; $$;

-- owned UNION member business ids.
CREATE OR REPLACE FUNCTION public.current_business_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  UNION
  SELECT business_id FROM public.business_members WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.can_read_business(uuid)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_business(text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_business(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_business(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_business_ids()   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_business(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_business(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_business(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_business(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_business_ids()   TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Regenerated tenant policies (drop everything on each table first)
-- ---------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='analytics' LOOP EXECUTE format('DROP POLICY %I ON public.analytics', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='billing_records' LOOP EXECUTE format('DROP POLICY %I ON public.billing_records', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='business_notes' LOOP EXECUTE format('DROP POLICY %I ON public.business_notes', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='clients' LOOP EXECUTE format('DROP POLICY %I ON public.clients', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_audit_results' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_audit_results', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_categories' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_categories', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_hours' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_hours', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_profiles' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_profiles', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_qas' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_qas', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_services' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_services', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='jobs' LOOP EXECUTE format('DROP POLICY %I ON public.jobs', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='locations' LOOP EXECUTE format('DROP POLICY %I ON public.locations', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='review_requests' LOOP EXECUTE format('DROP POLICY %I ON public.review_requests', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='reviews' LOOP EXECUTE format('DROP POLICY %I ON public.reviews', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sms_logs' LOOP EXECUTE format('DROP POLICY %I ON public.sms_logs', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='super_admin_tasks' LOOP EXECUTE format('DROP POLICY %I ON public.super_admin_tasks', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='webhooks' LOOP EXECUTE format('DROP POLICY %I ON public.webhooks', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='workflow_executions' LOOP EXECUTE format('DROP POLICY %I ON public.workflow_executions', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='workflows' LOOP EXECUTE format('DROP POLICY %I ON public.workflows', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_photos' LOOP EXECUTE format('DROP POLICY %I ON public.job_photos', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_tasks' LOOP EXECUTE format('DROP POLICY %I ON public.job_tasks', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='server_media_metadata' LOOP EXECUTE format('DROP POLICY %I ON public.server_media_metadata', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_media' LOOP EXECUTE format('DROP POLICY %I ON public.job_media', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_documents' LOOP EXECUTE format('DROP POLICY %I ON public.job_documents', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='client_notes' LOOP EXECUTE format('DROP POLICY %I ON public.client_notes', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='rss_feed_items' LOOP EXECUTE format('DROP POLICY %I ON public.rss_feed_items', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' LOOP EXECUTE format('DROP POLICY %I ON public.webhook_deliveries', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='businesses' LOOP EXECUTE format('DROP POLICY %I ON public.businesses', r.policyname); END LOOP; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='business_members' LOOP EXECUTE format('DROP POLICY %I ON public.business_members', r.policyname); END LOOP; END $$;

-- business-scoped
CREATE POLICY "analytics_select" ON public.analytics FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "analytics_write" ON public.analytics FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "billing_records_select" ON public.billing_records FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "billing_records_write" ON public.billing_records FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "business_notes_select" ON public.business_notes FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "business_notes_write" ON public.business_notes FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "clients_write" ON public.clients FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "gmb_audit_results_select" ON public.gmb_audit_results FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "gmb_audit_results_write" ON public.gmb_audit_results FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "gmb_categories_select" ON public.gmb_categories FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "gmb_categories_write" ON public.gmb_categories FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "gmb_hours_select" ON public.gmb_hours FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "gmb_hours_write" ON public.gmb_hours FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "gmb_profiles_select" ON public.gmb_profiles FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "gmb_profiles_write" ON public.gmb_profiles FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "gmb_qas_select" ON public.gmb_qas FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "gmb_qas_write" ON public.gmb_qas FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "gmb_services_select" ON public.gmb_services FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "gmb_services_write" ON public.gmb_services FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "jobs_select" ON public.jobs FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "jobs_write" ON public.jobs FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "locations_select" ON public.locations FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "locations_write" ON public.locations FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "review_requests_select" ON public.review_requests FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "review_requests_write" ON public.review_requests FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "reviews_write" ON public.reviews FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "sms_logs_select" ON public.sms_logs FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "sms_logs_write" ON public.sms_logs FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "super_admin_tasks_select" ON public.super_admin_tasks FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "super_admin_tasks_write" ON public.super_admin_tasks FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "webhooks_select" ON public.webhooks FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "webhooks_write" ON public.webhooks FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "workflow_executions_select" ON public.workflow_executions FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "workflow_executions_write" ON public.workflow_executions FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
CREATE POLICY "workflows_select" ON public.workflows FOR SELECT TO authenticated USING (public.can_read_business(business_id));
CREATE POLICY "workflows_write" ON public.workflows FOR ALL TO authenticated USING (public.can_write_business(business_id)) WITH CHECK (public.can_write_business(business_id));
-- job-scoped (through jobs.business_id)
CREATE POLICY "job_photos_select" ON public.job_photos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_photos.job_id AND public.can_read_business(j.business_id)));
CREATE POLICY "job_photos_write" ON public.job_photos FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_photos.job_id AND public.can_write_business(j.business_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_photos.job_id AND public.can_write_business(j.business_id)));
CREATE POLICY "job_tasks_select" ON public.job_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_tasks.job_id AND public.can_read_business(j.business_id)));
CREATE POLICY "job_tasks_write" ON public.job_tasks FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_tasks.job_id AND public.can_write_business(j.business_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_tasks.job_id AND public.can_write_business(j.business_id)));
CREATE POLICY "server_media_metadata_select" ON public.server_media_metadata FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id::text=server_media_metadata.job_id AND public.can_read_business(j.business_id)));
CREATE POLICY "server_media_metadata_write" ON public.server_media_metadata FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id::text=server_media_metadata.job_id AND public.can_write_business(j.business_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id::text=server_media_metadata.job_id AND public.can_write_business(j.business_id)));
-- job_media / job_documents: job branch OR client-level branch (job_id NULL)
CREATE POLICY "job_media_select" ON public.job_media FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_media.job_id AND public.can_read_business(j.business_id)) OR (job_media.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=job_media.client_id AND public.can_read_business(c.business_id))));
CREATE POLICY "job_media_write" ON public.job_media FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_media.job_id AND public.can_write_business(j.business_id)) OR (job_media.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=job_media.client_id AND public.can_write_business(c.business_id)))) WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_media.job_id AND public.can_write_business(j.business_id)) OR (job_media.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=job_media.client_id AND public.can_write_business(c.business_id))));
CREATE POLICY "job_documents_select" ON public.job_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_documents.job_id AND public.can_read_business(j.business_id)) OR (job_documents.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=job_documents.client_id AND public.can_read_business(c.business_id))));
CREATE POLICY "job_documents_write" ON public.job_documents FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_documents.job_id AND public.can_write_business(j.business_id)) OR (job_documents.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=job_documents.client_id AND public.can_write_business(c.business_id)))) WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_documents.job_id AND public.can_write_business(j.business_id)) OR (job_documents.job_id IS NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=job_documents.client_id AND public.can_write_business(c.business_id))));
-- client_notes via client -> business
CREATE POLICY "client_notes_select" ON public.client_notes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_notes.client_id AND public.can_read_business(c.business_id)));
CREATE POLICY "client_notes_write" ON public.client_notes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_notes.client_id AND public.can_write_business(c.business_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_notes.client_id AND public.can_write_business(c.business_id)));
-- rss_feed_items via workflow (workflow_id is text); webhook_deliveries via webhook
CREATE POLICY "rss_feed_items_select" ON public.rss_feed_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id::text=rss_feed_items.workflow_id AND public.can_read_business(w.business_id)));
CREATE POLICY "rss_feed_items_write" ON public.rss_feed_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id::text=rss_feed_items.workflow_id AND public.can_write_business(w.business_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id::text=rss_feed_items.workflow_id AND public.can_write_business(w.business_id)));
CREATE POLICY "webhook_deliveries_select" ON public.webhook_deliveries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.webhooks wh WHERE wh.id=webhook_deliveries.webhook_id AND public.can_read_business(wh.business_id)));
CREATE POLICY "webhook_deliveries_write" ON public.webhook_deliveries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.webhooks wh WHERE wh.id=webhook_deliveries.webhook_id AND public.can_write_business(wh.business_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.webhooks wh WHERE wh.id=webhook_deliveries.webhook_id AND public.can_write_business(wh.business_id)));

-- businesses: members may read; only the owner (or super admin) may change/delete.
CREATE POLICY "businesses_select" ON public.businesses FOR SELECT TO authenticated USING (public.can_read_business(id));
CREATE POLICY "businesses_insert" ON public.businesses FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR owner_id = auth.uid());
CREATE POLICY "businesses_update" ON public.businesses FOR UPDATE TO authenticated USING (public.is_super_admin() OR owner_id = auth.uid()) WITH CHECK (public.is_super_admin() OR owner_id = auth.uid());
CREATE POLICY "businesses_delete" ON public.businesses FOR DELETE TO authenticated USING (public.is_super_admin() OR owner_id = auth.uid());

-- business_members: readable by anyone who can read the business. No write
-- policy on purpose (and the privileges are revoked above).
CREATE POLICY "business_members_select" ON public.business_members FOR SELECT TO authenticated USING (public.can_read_business(business_id));

-- users_select: self, job assignees, and fellow members/owners of businesses
-- the caller can read. Super admins stay hidden from tenants.
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR id = auth.uid()
    OR (
      role <> 'super_admin'
      AND (
        id IN (SELECT j.assigned_to FROM public.jobs j
               WHERE public.can_read_business(j.business_id) AND j.assigned_to IS NOT NULL)
        OR id IN (SELECT bm.user_id FROM public.business_members bm WHERE public.can_read_business(bm.business_id))
        OR id IN (SELECT b.owner_id FROM public.businesses b WHERE public.can_read_business(b.id))
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. Storage: reads for any member, writes for owner/staff.
--    storage_path_allowed(text)  -> read semantics (can_read_business)
--    storage_path_writable(text) -> write semantics (can_write_business)
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
  IF u = auth.uid() THEN RETURN true; END IF;
  IF public.can_read_business(u) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = u AND public.can_read_business(j.business_id)) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.clients c WHERE c.id = u AND public.can_read_business(c.business_id)) THEN RETURN true; END IF;
  RETURN false;
END; $$;

CREATE OR REPLACE FUNCTION public.storage_path_writable(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE seg text[]; k text; u uuid;
BEGIN
  IF public.is_super_admin() THEN RETURN true; END IF;
  seg := string_to_array(p_name, '/');
  IF array_length(seg,1) < 2 THEN RETURN false; END IF;
  IF seg[1] = 'branding' THEN RETURN false; END IF;
  k := seg[2];
  BEGIN u := k::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  IF u = auth.uid() THEN RETURN true; END IF;
  IF public.can_write_business(u) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = u AND public.can_write_business(j.business_id)) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.clients c WHERE c.id = u AND public.can_write_business(c.business_id)) THEN RETURN true; END IF;
  RETURN false;
END; $$;
REVOKE EXECUTE ON FUNCTION public.storage_path_allowed(text)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_path_writable(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.storage_path_allowed(text)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.storage_path_writable(text) TO authenticated;

DROP POLICY IF EXISTS "media_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_delete" ON storage.objects;
CREATE POLICY "media_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.storage_path_allowed(name));
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.storage_path_writable(name));
CREATE POLICY "media_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'media' AND public.storage_path_writable(name))
  WITH CHECK (bucket_id = 'media' AND public.storage_path_writable(name));
CREATE POLICY "media_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING      (bucket_id = 'media' AND public.storage_path_writable(name));

DROP POLICY IF EXISTS "public_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "public_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "public_assets_delete" ON storage.objects;
CREATE POLICY "public_assets_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-assets' AND public.storage_path_writable(name));
CREATE POLICY "public_assets_update" ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'public-assets' AND public.storage_path_writable(name))
  WITH CHECK (bucket_id = 'public-assets' AND public.storage_path_writable(name));
CREATE POLICY "public_assets_delete" ON storage.objects FOR DELETE TO authenticated
  USING      (bucket_id = 'public-assets' AND public.storage_path_writable(name));

