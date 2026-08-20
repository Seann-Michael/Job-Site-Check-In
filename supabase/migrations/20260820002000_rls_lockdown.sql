-- Auto-generated RLS lockdown. authenticated = tenant-scoped; anon = public-read tables only; service_role (server) bypasses RLS.
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='analytics' LOOP EXECUTE format('DROP POLICY %I ON public.analytics', r.policyname); END LOOP; END $$;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' LOOP EXECUTE format('DROP POLICY %I ON public.audit_logs', r.policyname); END LOOP; END $$;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='billing_records' LOOP EXECUTE format('DROP POLICY %I ON public.billing_records', r.policyname); END LOOP; END $$;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='broadcast_messages' LOOP EXECUTE format('DROP POLICY %I ON public.broadcast_messages', r.policyname); END LOOP; END $$;
ALTER TABLE public.business_notes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='business_notes' LOOP EXECUTE format('DROP POLICY %I ON public.business_notes', r.policyname); END LOOP; END $$;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='businesses' LOOP EXECUTE format('DROP POLICY %I ON public.businesses', r.policyname); END LOOP; END $$;
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='changelog_entries' LOOP EXECUTE format('DROP POLICY %I ON public.changelog_entries', r.policyname); END LOOP; END $$;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='client_notes' LOOP EXECUTE format('DROP POLICY %I ON public.client_notes', r.policyname); END LOOP; END $$;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='clients' LOOP EXECUTE format('DROP POLICY %I ON public.clients', r.policyname); END LOOP; END $$;
ALTER TABLE public.crash_logs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='crash_logs' LOOP EXECUTE format('DROP POLICY %I ON public.crash_logs', r.policyname); END LOOP; END $$;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='email_campaigns' LOOP EXECUTE format('DROP POLICY %I ON public.email_campaigns', r.policyname); END LOOP; END $$;
ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='email_providers' LOOP EXECUTE format('DROP POLICY %I ON public.email_providers', r.policyname); END LOOP; END $$;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' LOOP EXECUTE format('DROP POLICY %I ON public.email_templates', r.policyname); END LOOP; END $$;
ALTER TABLE public.event_triggers ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='event_triggers' LOOP EXECUTE format('DROP POLICY %I ON public.event_triggers', r.policyname); END LOOP; END $$;
ALTER TABLE public.gmb_audit_results ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_audit_results' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_audit_results', r.policyname); END LOOP; END $$;
ALTER TABLE public.gmb_categories ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_categories' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_categories', r.policyname); END LOOP; END $$;
ALTER TABLE public.gmb_hours ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_hours' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_hours', r.policyname); END LOOP; END $$;
ALTER TABLE public.gmb_profiles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_profiles' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_profiles', r.policyname); END LOOP; END $$;
ALTER TABLE public.gmb_qas ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_qas' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_qas', r.policyname); END LOOP; END $$;
ALTER TABLE public.gmb_services ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gmb_services' LOOP EXECUTE format('DROP POLICY %I ON public.gmb_services', r.policyname); END LOOP; END $$;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='help_articles' LOOP EXECUTE format('DROP POLICY %I ON public.help_articles', r.policyname); END LOOP; END $$;
ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='idea_comments' LOOP EXECUTE format('DROP POLICY %I ON public.idea_comments', r.policyname); END LOOP; END $$;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='idea_votes' LOOP EXECUTE format('DROP POLICY %I ON public.idea_votes', r.policyname); END LOOP; END $$;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ideas' LOOP EXECUTE format('DROP POLICY %I ON public.ideas', r.policyname); END LOOP; END $$;
ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_documents' LOOP EXECUTE format('DROP POLICY %I ON public.job_documents', r.policyname); END LOOP; END $$;
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_media' LOOP EXECUTE format('DROP POLICY %I ON public.job_media', r.policyname); END LOOP; END $$;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_photos' LOOP EXECUTE format('DROP POLICY %I ON public.job_photos', r.policyname); END LOOP; END $$;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='job_tasks' LOOP EXECUTE format('DROP POLICY %I ON public.job_tasks', r.policyname); END LOOP; END $$;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='jobs' LOOP EXECUTE format('DROP POLICY %I ON public.jobs', r.policyname); END LOOP; END $$;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='locations' LOOP EXECUTE format('DROP POLICY %I ON public.locations', r.policyname); END LOOP; END $$;
ALTER TABLE public.login_slides ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='login_slides' LOOP EXECUTE format('DROP POLICY %I ON public.login_slides', r.policyname); END LOOP; END $$;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' LOOP EXECUTE format('DROP POLICY %I ON public.message_templates', r.policyname); END LOOP; END $$;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='notification_templates' LOOP EXECUTE format('DROP POLICY %I ON public.notification_templates', r.policyname); END LOOP; END $$;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='notifications' LOOP EXECUTE format('DROP POLICY %I ON public.notifications', r.policyname); END LOOP; END $$;
ALTER TABLE public.optimization_jobs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='optimization_jobs' LOOP EXECUTE format('DROP POLICY %I ON public.optimization_jobs', r.policyname); END LOOP; END $$;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='plans' LOOP EXECUTE format('DROP POLICY %I ON public.plans', r.policyname); END LOOP; END $$;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='promo_codes' LOOP EXECUTE format('DROP POLICY %I ON public.promo_codes', r.policyname); END LOOP; END $$;
ALTER TABLE public.qa_checks ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='qa_checks' LOOP EXECUTE format('DROP POLICY %I ON public.qa_checks', r.policyname); END LOOP; END $$;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='review_requests' LOOP EXECUTE format('DROP POLICY %I ON public.review_requests', r.policyname); END LOOP; END $$;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='reviews' LOOP EXECUTE format('DROP POLICY %I ON public.reviews', r.policyname); END LOOP; END $$;
ALTER TABLE public.rss_feed_items ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='rss_feed_items' LOOP EXECUTE format('DROP POLICY %I ON public.rss_feed_items', r.policyname); END LOOP; END $$;
ALTER TABLE public.scaling_rules ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='scaling_rules' LOOP EXECUTE format('DROP POLICY %I ON public.scaling_rules', r.policyname); END LOOP; END $$;
ALTER TABLE public.server_media_metadata ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='server_media_metadata' LOOP EXECUTE format('DROP POLICY %I ON public.server_media_metadata', r.policyname); END LOOP; END $$;
ALTER TABLE public.signup_slides ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='signup_slides' LOOP EXECUTE format('DROP POLICY %I ON public.signup_slides', r.policyname); END LOOP; END $$;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sms_logs' LOOP EXECUTE format('DROP POLICY %I ON public.sms_logs', r.policyname); END LOOP; END $$;
ALTER TABLE public.super_admin_tasks ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='super_admin_tasks' LOOP EXECUTE format('DROP POLICY %I ON public.super_admin_tasks', r.policyname); END LOOP; END $$;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' LOOP EXECUTE format('DROP POLICY %I ON public.support_tickets', r.policyname); END LOOP; END $$;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='system_settings' LOOP EXECUTE format('DROP POLICY %I ON public.system_settings', r.policyname); END LOOP; END $$;
ALTER TABLE public.ticket_responses ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ticket_responses' LOOP EXECUTE format('DROP POLICY %I ON public.ticket_responses', r.policyname); END LOOP; END $$;
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_segments' LOOP EXECUTE format('DROP POLICY %I ON public.user_segments', r.policyname); END LOOP; END $$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='users' LOOP EXECUTE format('DROP POLICY %I ON public.users', r.policyname); END LOOP; END $$;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' LOOP EXECUTE format('DROP POLICY %I ON public.webhook_deliveries', r.policyname); END LOOP; END $$;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='webhooks' LOOP EXECUTE format('DROP POLICY %I ON public.webhooks', r.policyname); END LOOP; END $$;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='workflow_executions' LOOP EXECUTE format('DROP POLICY %I ON public.workflow_executions', r.policyname); END LOOP; END $$;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='workflows' LOOP EXECUTE format('DROP POLICY %I ON public.workflows', r.policyname); END LOOP; END $$;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='workspaces' LOOP EXECUTE format('DROP POLICY %I ON public.workspaces', r.policyname); END LOOP; END $$;
CREATE POLICY "analytics_rw" ON public.analytics FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "billing_records_rw" ON public.billing_records FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "business_notes_rw" ON public.business_notes FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "clients_rw" ON public.clients FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "gmb_audit_results_rw" ON public.gmb_audit_results FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "gmb_categories_rw" ON public.gmb_categories FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "gmb_hours_rw" ON public.gmb_hours FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "gmb_profiles_rw" ON public.gmb_profiles FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "gmb_qas_rw" ON public.gmb_qas FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "gmb_services_rw" ON public.gmb_services FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "jobs_rw" ON public.jobs FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "locations_rw" ON public.locations FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "review_requests_rw" ON public.review_requests FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "reviews_rw" ON public.reviews FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "sms_logs_rw" ON public.sms_logs FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "super_admin_tasks_rw" ON public.super_admin_tasks FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "webhooks_rw" ON public.webhooks FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "workflow_executions_rw" ON public.workflow_executions FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "workflows_rw" ON public.workflows FOR ALL TO authenticated USING (public.is_super_admin() OR public.owns_business(business_id)) WITH CHECK (public.is_super_admin() OR public.owns_business(business_id));
CREATE POLICY "job_documents_rw" ON public.job_documents FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_documents.job_id AND public.owns_business(j.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_documents.job_id AND public.owns_business(j.business_id)));
CREATE POLICY "job_media_rw" ON public.job_media FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_media.job_id AND public.owns_business(j.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_media.job_id AND public.owns_business(j.business_id)));
CREATE POLICY "job_photos_rw" ON public.job_photos FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_photos.job_id AND public.owns_business(j.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_photos.job_id AND public.owns_business(j.business_id)));
CREATE POLICY "job_tasks_rw" ON public.job_tasks FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_tasks.job_id AND public.owns_business(j.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id=job_tasks.job_id AND public.owns_business(j.business_id)));
CREATE POLICY "server_media_metadata_rw" ON public.server_media_metadata FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id::text=server_media_metadata.job_id AND public.owns_business(j.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id::text=server_media_metadata.job_id AND public.owns_business(j.business_id)));
CREATE POLICY "client_notes_rw" ON public.client_notes FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_notes.client_id AND public.owns_business(c.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_notes.client_id AND public.owns_business(c.business_id)));
CREATE POLICY "rss_feed_items_rw" ON public.rss_feed_items FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.workflows w WHERE w.id::text=rss_feed_items.workflow_id AND public.owns_business(w.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.workflows w WHERE w.id::text=rss_feed_items.workflow_id AND public.owns_business(w.business_id)));
CREATE POLICY "webhook_deliveries_rw" ON public.webhook_deliveries FOR ALL TO authenticated USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.webhooks wh WHERE wh.id=webhook_deliveries.webhook_id AND public.owns_business(wh.business_id))) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.webhooks wh WHERE wh.id=webhook_deliveries.webhook_id AND public.owns_business(wh.business_id)));
CREATE POLICY "help_articles_read" ON public.help_articles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "help_articles_write" ON public.help_articles FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "changelog_entries_read" ON public.changelog_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "changelog_entries_write" ON public.changelog_entries FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "login_slides_read" ON public.login_slides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "login_slides_write" ON public.login_slides FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "signup_slides_read" ON public.signup_slides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "signup_slides_write" ON public.signup_slides FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "plans_read" ON public.plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "plans_write" ON public.plans FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "broadcast_messages_admin" ON public.broadcast_messages FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "email_campaigns_admin" ON public.email_campaigns FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "email_providers_admin" ON public.email_providers FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "email_templates_admin" ON public.email_templates FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "event_triggers_admin" ON public.event_triggers FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "message_templates_admin" ON public.message_templates FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "notification_templates_admin" ON public.notification_templates FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "optimization_jobs_admin" ON public.optimization_jobs FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "promo_codes_admin" ON public.promo_codes FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "qa_checks_admin" ON public.qa_checks FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "scaling_rules_admin" ON public.scaling_rules FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "system_settings_admin" ON public.system_settings FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "user_segments_admin" ON public.user_segments FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "workspaces_admin" ON public.workspaces FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "audit_logs_admin" ON public.audit_logs FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "crash_logs_admin" ON public.crash_logs FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated USING (public.is_super_admin() OR user_id = auth.uid()) WITH CHECK (public.is_super_admin() OR user_id = auth.uid());
CREATE POLICY "idea_votes_own" ON public.idea_votes FOR ALL TO authenticated USING (public.is_super_admin() OR user_id = auth.uid()::text) WITH CHECK (public.is_super_admin() OR user_id = auth.uid()::text);
CREATE POLICY "ideas_read" ON public.ideas FOR SELECT TO authenticated USING (true);
CREATE POLICY "ideas_insert" ON public.ideas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ideas_admin" ON public.ideas FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "ideas_del" ON public.ideas FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE POLICY "idea_comments_read" ON public.idea_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "idea_comments_insert" ON public.idea_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "idea_comments_admin" ON public.idea_comments FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE POLICY "businesses_select" ON public.businesses FOR SELECT TO authenticated USING (public.is_super_admin() OR owner_id = auth.uid());
CREATE POLICY "businesses_insert" ON public.businesses FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR owner_id = auth.uid());
CREATE POLICY "businesses_update" ON public.businesses FOR UPDATE TO authenticated USING (public.is_super_admin() OR owner_id = auth.uid()) WITH CHECK (public.is_super_admin() OR owner_id = auth.uid());
CREATE POLICY "businesses_delete" ON public.businesses FOR DELETE TO authenticated USING (public.is_super_admin() OR owner_id = auth.uid());
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (public.is_super_admin() OR id = auth.uid() OR id IN (SELECT j.assigned_to FROM public.jobs j WHERE public.owns_business(j.business_id) AND j.assigned_to IS NOT NULL));
CREATE POLICY "users_update_self" ON public.users FOR UPDATE TO authenticated USING (public.is_super_admin() OR id = auth.uid()) WITH CHECK (public.is_super_admin() OR id = auth.uid());
CREATE POLICY "users_admin_write" ON public.users FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "users_admin_del" ON public.users FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE POLICY "support_tickets_insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "support_tickets_admin" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "support_tickets_admin_u" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "ticket_responses_insert" ON public.ticket_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ticket_responses_admin" ON public.ticket_responses FOR SELECT TO authenticated USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Revoke anon table privileges. RLS already denies anon on tables without an
-- anon policy, but revoking the grants is belt-and-braces and closes the
-- default-privilege SELECT hole the audit flagged.
-- ---------------------------------------------------------------------
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
  END LOOP;
  -- anon keeps SELECT only on the public-read tables:
  FOR t IN SELECT unnest(ARRAY['help_articles','changelog_entries','login_slides','signup_slides','plans']) LOOP
    NULL; -- SELECT grant retained
  END LOOP;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
           AND tablename <> ALL (ARRAY['help_articles','changelog_entries','login_slides','signup_slides','plans']) LOOP
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- ---------------------------------------------------------------------
-- Public pages read through SECURITY DEFINER RPCs (uuid acts as the share
-- token) instead of anon table SELECT. Review gate + public job page.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_request_public(p_id uuid)
RETURNS TABLE (id uuid, business_id uuid, customer_name text, project_name text,
               business_name text, settings jsonb, address jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rr.id, rr.business_id, rr.customer_name, rr.project_name,
         b.name, COALESCE(b.settings,'{}'::jsonb), COALESCE(b.address,'{}'::jsonb)
  FROM public.review_requests rr JOIN public.businesses b ON b.id = rr.business_id
  WHERE rr.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.review_request_mark_viewed(p_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.review_requests SET status='viewed', viewed_at=now()
  WHERE id = p_id AND status IN ('sent','scheduled');
$$;

CREATE OR REPLACE FUNCTION public.submit_gate_review(
  p_request_id uuid, p_rating int, p_title text, p_text text,
  p_author_name text, p_to_google boolean)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_biz uuid;
BEGIN
  SELECT business_id INTO v_biz FROM public.review_requests WHERE id = p_request_id;
  IF v_biz IS NULL THEN RAISE EXCEPTION 'unknown review request'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'invalid rating'; END IF;
  INSERT INTO public.reviews (business_id, platform, rating, title, text, author, date, metadata)
  VALUES (v_biz, 'custom', p_rating, NULLIF(p_title,''),
          COALESCE(NULLIF(trim(p_text),''),'(no comment provided)'),
          jsonb_build_object('name', COALESCE(NULLIF(p_author_name,''),'Customer')),
          now(),
          jsonb_build_object('source','review_gate','redirected_to_google',p_to_google,'review_request_id',p_request_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.public_job(p_id uuid)
RETURNS TABLE (id uuid, name text, description text, created_at timestamptz,
               seo_targets jsonb, metadata jsonb, photo_paths text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.name, j.description, j.created_at, j.seo_targets, j.metadata,
         COALESCE(ARRAY(SELECT m.file_path FROM public.job_media m
                        WHERE m.job_id=j.id AND m.media_type='image'
                        ORDER BY m.created_at), '{}')
  FROM public.jobs j WHERE j.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.review_request_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_request_mark_viewed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_gate_review(uuid,int,text,text,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_request_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_request_mark_viewed(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_gate_review(uuid,int,text,text,text,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_job(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: media bucket stays public-read (photo sharing). Only authenticated
-- users (and the service role) may write; anon writes revoked.
-- ---------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id='media');
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='media');
CREATE POLICY "media_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='media') WITH CHECK (bucket_id='media');
CREATE POLICY "media_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='media');

-- Views ran as owner (postgres), bypassing RLS. Make them respect the caller's RLS.
ALTER VIEW public.projects SET (security_invoker = on);
ALTER VIEW public.user_dashboard_summary SET (security_invoker = on);
ALTER VIEW public.business_performance_summary SET (security_invoker = on);
ALTER VIEW public.project_activity_summary SET (security_invoker = on);
