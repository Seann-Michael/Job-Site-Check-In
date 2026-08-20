-- ============================================================================
-- 20260820000000_baseline_live_schema.sql
-- Baseline of the LIVE Supabase project qfhbusqupidiwlrzkgqc, `public` schema
-- plus the `media` storage bucket, as it existed on 2026-08-20.
--
-- HOW THIS FILE WAS MADE
--   Generated from the system catalogs (pg_class/pg_attribute/pg_attrdef,
--   pg_constraint + pg_get_constraintdef, pg_index + pg_get_indexdef,
--   pg_get_viewdef, pg_get_functiondef, pg_get_triggerdef, pg_policies,
--   pg_class.relacl / pg_default_acl, storage.buckets) and assembled by script.
--   Nothing in here was hand-authored except the comments.
--
-- WHAT IT REPLACES
--   The 45 entries in supabase_migrations.schema_migrations on the live project
--   (20260311155641 .. 20260327085246) were applied through the dashboard / MCP
--   and have no corresponding files in this repo. This single file reproduces
--   their net result. The live project must be STAMPED with this version, not
--   re-migrated -- see supabase/README.md for the exact INSERT.
--
-- PROPERTIES
--   * Idempotent: CREATE TABLE IF NOT EXISTS, guarded enum creation, guarded
--     ADD CONSTRAINT, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE for views and
--     functions, DROP POLICY IF EXISTS before CREATE POLICY, DROP TRIGGER IF
--     EXISTS before CREATE TRIGGER, ON CONFLICT DO NOTHING for the bucket row.
--     Running it twice is a no-op; running it on the live project is a no-op.
--   * Faithful, not aspirational: the permissive RLS policies (USING (true)),
--     the disabled-RLS tables, the anon write grants and the public storage
--     bucket policies are reproduced exactly because that is what is live. The
--     RLS/auth redesign lives in supabase/migrations_pending/ and lands with the
--     auth step.
--   * Schema only. No data. (The live project still contains demo seed rows --
--     see supabase/README.md, "Leftover demo data".)
--
-- ORDER: extensions -> enums -> sequences -> functions -> tables -> PK/UNIQUE/
--        CHECK -> FKs -> indexes -> views -> triggers -> RLS + policies ->
--        grants -> storage.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Extensions (all already present on any Supabase project)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto"  WITH SCHEMA extensions;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net"    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
-- supabase_vault (schema vault) is managed by the platform and is not created here.

-- ----------------------------------------------------------------------------
-- 1. Enum types (12)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'audit_action') THEN
    CREATE TYPE public.audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import', 'share', 'permission_change');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'business_category') THEN
    CREATE TYPE public.business_category AS ENUM ('restaurant', 'retail', 'healthcare', 'automotive', 'real_estate', 'professional_services', 'home_services', 'beauty_wellness', 'fitness', 'education', 'entertainment', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'business_status') THEN
    CREATE TYPE public.business_status AS ENUM ('active', 'inactive', 'pending_verification', 'suspended', 'deleted');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'data_source') THEN
    CREATE TYPE public.data_source AS ENUM ('google_search_console', 'google_analytics', 'google_my_business', 'internal_tracking', 'third_party_api');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'location_status') THEN
    CREATE TYPE public.location_status AS ENUM ('active', 'inactive', 'pending_verification');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'location_type') THEN
    CREATE TYPE public.location_type AS ENUM ('storefront', 'service_area', 'hybrid');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'metric_type') THEN
    CREATE TYPE public.metric_type AS ENUM ('organic_traffic', 'keyword_ranking', 'local_ranking', 'review_count', 'review_rating', 'citation_count', 'conversion_rate', 'phone_calls', 'direction_requests', 'website_clicks');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'project_priority') THEN
    CREATE TYPE public.project_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'project_status') THEN
    CREATE TYPE public.project_status AS ENUM ('draft', 'active', 'in_progress', 'paused', 'completed', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'project_type') THEN
    CREATE TYPE public.project_type AS ENUM ('seo_audit', 'local_optimization', 'content_marketing', 'reputation_management', 'technical_seo', 'link_building', 'ongoing_optimization', 'renovation', 'construction', 'repair', 'painting', 'landscaping', 'driveway', 'roofing', 'flooring', 'plumbing', 'electrical', 'hvac', 'cleaning', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'review_platform') THEN
    CREATE TYPE public.review_platform AS ENUM ('google', 'yelp', 'facebook', 'tripadvisor', 'better_business_bureau', 'glassdoor', 'custom');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('super_admin', 'agency_admin', 'business_owner', 'staff', 'viewer');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Sequences (1)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.support_tickets_ticket_number_seq
  AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;

-- ----------------------------------------------------------------------------
-- 3. Functions (5) -- plain plpgsql, none SECURITY DEFINER, no search_path set
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_sub_account_id()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_id text;
  exists_check boolean;
BEGIN
  LOOP
    -- Generate random 9-digit number formatted as XXX-XXX-XXX
    new_id := lpad((floor(random() * 900000000) + 100000000)::text, 9, '0');
    new_id := substring(new_id, 1, 3) || '-' || substring(new_id, 4, 3) || '-' || substring(new_id, 7, 3);
    -- Check uniqueness
    SELECT EXISTS(SELECT 1 FROM users WHERE sub_account_id = new_id) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_workspace_account_id()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  digits text;
  candidate text;
begin
  loop
    digits := lpad((floor(random() * 900000000) + 100000000)::text, 9, '0');
    candidate := substr(digits, 1, 3) || '-' || substr(digits, 4, 3) || '-' || substr(digits, 7, 3);
    exit when not exists (
      select 1
      from public.businesses
      where account_id = candidate
    );
  end loop;

  return candidate;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_business_account_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.account_id is null or new.account_id = '' then
    new.account_id := public.generate_workspace_account_id();
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_sub_account_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.sub_account_id IS NULL OR NEW.sub_account_id = '' THEN
    NEW.sub_account_id := generate_sub_account_id();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4. Tables (57) -- columns, defaults, nullability only; constraints follow
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  metric_type metric_type NOT NULL,
  metric_name text NOT NULL,
  value numeric NOT NULL,
  dimensions jsonb,
  date date NOT NULL,
  hour integer,
  data_source data_source NOT NULL,
  quality_score numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  session_id uuid,
  business_id uuid,
  action audit_action NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  location jsonb,
  risk_score numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.billing_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  type text DEFAULT 'charge'::text NOT NULL,
  status text DEFAULT 'succeeded'::text NOT NULL,
  amount numeric(10,2) DEFAULT 0 NOT NULL,
  currency text DEFAULT 'usd'::text NOT NULL,
  description text,
  invoice_id text,
  payment_provider text DEFAULT 'stripe'::text NOT NULL,
  payment_method text,
  provider_transaction_id text,
  provider_invoice_url text,
  provider_receipt_url text,
  plan_name text,
  billing_period_start timestamp with time zone,
  billing_period_end timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'info'::text NOT NULL,
  target_audience text DEFAULT 'all'::text NOT NULL,
  custom_user_ids text[],
  scheduled_for timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  sent_at timestamp with time zone,
  view_count integer DEFAULT 0 NOT NULL,
  dismiss_count integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.business_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  note text DEFAULT ''::text NOT NULL,
  admin_user text DEFAULT 'Super Admin'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid,
  name text NOT NULL,
  description text,
  address jsonb NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  website text,
  category business_category NOT NULL,
  subcategory text,
  google_place_id text,
  google_my_business jsonb,
  business_hours jsonb,
  social_media jsonb,
  metadata jsonb,
  status business_status DEFAULT 'active'::business_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  verified_at timestamp with time zone,
  settings jsonb DEFAULT '{}'::jsonb,
  account_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  description text,
  type text DEFAULT 'feature'::text NOT NULL,
  items text[] DEFAULT '{}'::text[] NOT NULL,
  released_at date DEFAULT CURRENT_DATE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  created_by_id text DEFAULT ''::text NOT NULL,
  created_by_name text DEFAULT 'Unknown'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_name text,
  first_name text,
  last_name text
);

CREATE TABLE IF NOT EXISTS public.crash_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  severity text DEFAULT 'error'::text NOT NULL,
  component text DEFAULT ''::text NOT NULL,
  message text DEFAULT ''::text NOT NULL,
  stack text,
  user_id text,
  user_agent text DEFAULT ''::text NOT NULL,
  url text DEFAULT ''::text NOT NULL,
  count integer DEFAULT 1 NOT NULL,
  resolved boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  template_id uuid,
  content text,
  target_segment text DEFAULT 'all'::text NOT NULL,
  recipient_count integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  stats jsonb DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "delivered": 0, "unsubscribed": 0}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_providers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'api'::text NOT NULL,
  provider_key text,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  stats jsonb DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "delivered": 0, "complained": 0}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_content text,
  text_content text,
  preview_text text,
  category text DEFAULT 'broadcast'::text NOT NULL,
  variables text[],
  is_active boolean DEFAULT true NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  last_used timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.event_triggers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  event text NOT NULL,
  conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
  actions jsonb DEFAULT '[]'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  trigger_count integer DEFAULT 0 NOT NULL,
  last_triggered timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.gmb_audit_results (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'good'::text,
  impact text DEFAULT 'low'::text,
  action_required text,
  scanned_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmb_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmb_hours (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  day text NOT NULL,
  open_time text,
  close_time text,
  is_closed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmb_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  place_id text NOT NULL,
  business_name text NOT NULL,
  address text,
  phone text,
  website text,
  rating numeric(3,2),
  review_count integer DEFAULT 0,
  types text[],
  description text,
  overall_score integer DEFAULT 0,
  photos text[],
  lat numeric(10,7),
  lng numeric(10,7),
  google_url text,
  last_scanned_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmb_qas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  question text NOT NULL,
  answer text,
  author text DEFAULT 'Business Owner'::text,
  source text DEFAULT 'manual'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmb_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price text,
  category text,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general'::text NOT NULL,
  user_type text DEFAULT 'all'::text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  views integer DEFAULT 0 NOT NULL,
  rating numeric(3,1) DEFAULT 0 NOT NULL,
  rating_count integer DEFAULT 0 NOT NULL,
  is_popular boolean DEFAULT false NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.idea_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  idea_id uuid NOT NULL,
  author_name text DEFAULT 'Anonymous'::text NOT NULL,
  author_email text DEFAULT ''::text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.idea_votes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  idea_id uuid NOT NULL,
  user_email text DEFAULT ''::text NOT NULL,
  user_id text DEFAULT ''::text NOT NULL,
  voted_at timestamp with time zone DEFAULT now() NOT NULL,
  device_id text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ideas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'general'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  author_name text DEFAULT 'Anonymous'::text NOT NULL,
  author_email text,
  upvotes integer DEFAULT 0 NOT NULL,
  downvotes integer DEFAULT 0 NOT NULL,
  comments_count integer DEFAULT 0 NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  admin_notes text,
  roadmap_status text,
  estimated_completion date,
  assigned_to text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.job_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid,
  filename text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  mime_type text NOT NULL,
  document_type text DEFAULT 'general'::text NOT NULL,
  description text,
  tags text[],
  version integer DEFAULT 1 NOT NULL,
  is_final boolean DEFAULT false NOT NULL,
  access_level text DEFAULT 'team'::text NOT NULL,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  client_id uuid
);

CREATE TABLE IF NOT EXISTS public.job_media (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid NOT NULL,
  filename text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  media_type text DEFAULT 'image'::text,
  category text DEFAULT 'general'::text,
  description text,
  geolocation jsonb,
  metadata jsonb,
  is_featured boolean DEFAULT false,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  width integer,
  height integer,
  duration_seconds numeric,
  client_id uuid
);

CREATE TABLE IF NOT EXISTS public.job_photos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid,
  filename text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  category text DEFAULT 'general'::text NOT NULL,
  description text,
  geolocation jsonb,
  metadata jsonb,
  is_featured boolean DEFAULT false NOT NULL,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.job_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo'::text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  assigned_to uuid,
  assigned_by uuid,
  estimated_hours numeric,
  actual_hours numeric,
  due_date timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  dependencies jsonb,
  labels text[],
  progress_percentage integer DEFAULT 0 NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  name text NOT NULL,
  description text,
  type project_type NOT NULL,
  status project_status DEFAULT 'draft'::project_status NOT NULL,
  priority project_priority DEFAULT 'medium'::project_priority NOT NULL,
  assigned_to uuid,
  client_contact jsonb,
  objectives text[],
  deliverables text[],
  timeline jsonb,
  budget jsonb,
  seo_targets jsonb,
  competitors jsonb,
  progress jsonb,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  due_date timestamp with time zone,
  materials text[] DEFAULT '{}'::text[],
  tasks text[] DEFAULT '{}'::text[],
  client_id uuid
);

CREATE TABLE IF NOT EXISTS public.kv_store_32071718 (
  key text NOT NULL,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  name text NOT NULL,
  address jsonb NOT NULL,
  primary_phone text NOT NULL,
  location_type location_type NOT NULL,
  google_place_id text,
  service_areas jsonb,
  local_rankings jsonb,
  citations jsonb,
  photos jsonb,
  amenities text[],
  accessibility_features text[],
  parking_info jsonb,
  public_transport text[],
  is_primary boolean DEFAULT false NOT NULL,
  status location_status DEFAULT 'active'::location_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.login_slides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  tag text DEFAULT ''::text NOT NULL,
  headline text DEFAULT ''::text NOT NULL,
  body text DEFAULT ''::text NOT NULL,
  stat_value text DEFAULT ''::text NOT NULL,
  stat_label text DEFAULT ''::text NOT NULL,
  color text DEFAULT 'from-blue-600 to-indigo-700'::text NOT NULL,
  image_url text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  subject text,
  content text NOT NULL,
  type text DEFAULT 'email'::text NOT NULL,
  category text DEFAULT 'notification'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  last_used timestamp with time zone,
  variables text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text DEFAULT ''::text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  type text DEFAULT 'info'::text NOT NULL,
  category text DEFAULT 'system'::text NOT NULL,
  variables text[] DEFAULT '{}'::text[] NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  is_active boolean DEFAULT false NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  approval_status text DEFAULT 'pending'::text NOT NULL,
  approved_by text,
  approved_at timestamp with time zone,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text DEFAULT 'info'::text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  message text DEFAULT ''::text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  action_url text,
  action_label text,
  source text DEFAULT 'system'::text,
  priority text DEFAULT 'normal'::text,
  category text DEFAULT 'system'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.optimization_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  progress integer DEFAULT 0 NOT NULL,
  logs text[],
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text DEFAULT ''::text NOT NULL,
  price text DEFAULT '$0'::text NOT NULL,
  features text[] DEFAULT ARRAY[]::text[] NOT NULL,
  max_users integer,
  max_businesses integer,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text DEFAULT ''::text NOT NULL,
  code text DEFAULT ''::text NOT NULL,
  discount text DEFAULT '10'::text NOT NULL,
  discount_type text DEFAULT '%'::text NOT NULL,
  usage_limit text DEFAULT '100'::text NOT NULL,
  expiry_date text,
  used integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qa_checks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  assigned_to text,
  notes text,
  last_run_at timestamp with time zone,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.review_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  customer_name text DEFAULT ''::text NOT NULL,
  customer_phone text DEFAULT 'N/A'::text NOT NULL,
  project_name text DEFAULT 'Project'::text NOT NULL,
  status text DEFAULT 'sent'::text NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  viewed_at timestamp with time zone,
  scheduled_for timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  platform review_platform NOT NULL,
  platform_review_id text,
  rating smallint NOT NULL,
  title text,
  text text NOT NULL,
  author jsonb,
  date timestamp with time zone NOT NULL,
  response jsonb,
  sentiment jsonb,
  keywords_mentioned text[],
  photos jsonb,
  is_verified boolean DEFAULT false NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rss_feed_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workflow_id text NOT NULL,
  sub_account_id text,
  feed_title text DEFAULT 'Completed Jobs Feed'::text NOT NULL,
  item_title text NOT NULL,
  item_description text,
  item_link text,
  item_guid text DEFAULT (gen_random_uuid())::text NOT NULL,
  pub_date timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scaling_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  trigger_metric text NOT NULL,
  trigger_operator text DEFAULT '>'::text NOT NULL,
  trigger_value numeric NOT NULL,
  trigger_duration integer DEFAULT 300 NOT NULL,
  action_type text DEFAULT 'notify'::text NOT NULL,
  action_parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  trigger_count integer DEFAULT 0 NOT NULL,
  last_triggered timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.server_media_metadata (
  id text NOT NULL,
  original_name text NOT NULL,
  stored_path text NOT NULL,
  mime_type text NOT NULL,
  size bigint DEFAULT 0 NOT NULL,
  account_id text NOT NULL,
  job_id text,
  media_type text NOT NULL,
  is_public boolean DEFAULT false NOT NULL,
  public_url_id text,
  uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
  uploaded_by text DEFAULT 'Unknown'::text NOT NULL,
  thumbnail_small text,
  thumbnail_medium text,
  thumbnail_large text
);

CREATE TABLE IF NOT EXISTS public.signup_slides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  tag text NOT NULL,
  headline text NOT NULL,
  body text NOT NULL,
  stat_value text NOT NULL,
  stat_label text NOT NULL,
  color text DEFAULT 'from-blue-600 to-indigo-700'::text NOT NULL,
  image_url text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  twilio_sid text,
  direction text DEFAULT 'outbound'::text NOT NULL,
  to_number text NOT NULL,
  from_number text,
  message text NOT NULL,
  status text DEFAULT 'sent'::text NOT NULL,
  campaign_id text,
  business_id text,
  error_code text,
  error_message text,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.super_admin_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  title text NOT NULL,
  notes text,
  assigned_to uuid,
  assigned_to_name text,
  status text DEFAULT 'open'::text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  due_at timestamp with time zone,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_number integer DEFAULT nextval('public.support_tickets_ticket_number_seq'::regclass) NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'Other'::text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  submitted_by text DEFAULT ''::text NOT NULL,
  organization text,
  user_type text DEFAULT 'admin'::text NOT NULL,
  assigned_to text,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  estimated_resolution timestamp with time zone,
  actual_resolution timestamp with time zone,
  satisfaction_rating smallint,
  time_spent integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  value jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ticket_responses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  message text NOT NULL,
  author text DEFAULT 'Super Admin'::text NOT NULL,
  is_staff boolean DEFAULT true NOT NULL,
  is_internal boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_segments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
  tags text[],
  user_count integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  is_static boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text DEFAULT 'Super Admin'::text NOT NULL,
  last_calculated timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  role user_role DEFAULT 'business_owner'::user_role NOT NULL,
  is_2fa_enabled boolean DEFAULT false NOT NULL,
  avatar_url text,
  phone text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_login timestamp with time zone,
  email_verified boolean DEFAULT false NOT NULL,
  phone_verified boolean DEFAULT false NOT NULL,
  sub_account_id text,
  first_name text,
  last_name text
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  webhook_id uuid NOT NULL,
  execution_id uuid,
  payload jsonb NOT NULL,
  status character varying(50) DEFAULT 'pending'::character varying,
  http_status_code integer,
  response_body text,
  error_message text,
  attempt_number integer DEFAULT 1,
  next_retry_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  url text NOT NULL,
  events jsonb DEFAULT '[]'::jsonb,
  secret text NOT NULL,
  headers jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  retry_policy jsonb DEFAULT '{"max_retries": 3, "retry_delay_seconds": 60}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workflow_id uuid NOT NULL,
  business_id uuid NOT NULL,
  trigger_data jsonb NOT NULL,
  status character varying(50) DEFAULT 'pending'::character varying,
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  steps jsonb DEFAULT '[]'::jsonb NOT NULL,
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text DEFAULT ''::text NOT NULL,
  user_count integer DEFAULT 0 NOT NULL,
  storage_used text DEFAULT '0 GB'::text NOT NULL,
  storage_limit_gb integer DEFAULT 10 NOT NULL,
  user_limit integer DEFAULT 5 NOT NULL,
  modules text[] DEFAULT ARRAY['Projects'::text, 'Gallery'::text] NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER SEQUENCE public.support_tickets_ticket_number_seq OWNED BY public.support_tickets.ticket_number;

-- ----------------------------------------------------------------------------
-- 5. Primary keys, UNIQUE and CHECK constraints (guarded)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_pkey' AND conrelid = 'public.analytics'::regclass) THEN
    ALTER TABLE public.analytics ADD CONSTRAINT analytics_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_pkey' AND conrelid = 'public.audit_logs'::regclass) THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_payment_provider_check' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_payment_provider_check CHECK ((payment_provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'manual'::text, 'other'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_status_check' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_status_check CHECK ((status = ANY (ARRAY['succeeded'::text, 'failed'::text, 'pending'::text, 'refunded'::text, 'disputed'::text, 'cancelled'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_type_check' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_type_check CHECK ((type = ANY (ARRAY['charge'::text, 'refund'::text, 'credit'::text, 'dispute'::text, 'subscription_start'::text, 'subscription_renewal'::text, 'subscription_cancel'::text, 'subscription_pause'::text, 'trial_start'::text, 'trial_end'::text, 'plan_upgrade'::text, 'plan_downgrade'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_pkey' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcast_messages_status_check' AND conrelid = 'public.broadcast_messages'::regclass) THEN
    ALTER TABLE public.broadcast_messages ADD CONSTRAINT broadcast_messages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sent'::text, 'cancelled'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcast_messages_target_audience_check' AND conrelid = 'public.broadcast_messages'::regclass) THEN
    ALTER TABLE public.broadcast_messages ADD CONSTRAINT broadcast_messages_target_audience_check CHECK ((target_audience = ANY (ARRAY['all'::text, 'business-owners'::text, 'agency-admins'::text, 'staff'::text, 'custom'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcast_messages_type_check' AND conrelid = 'public.broadcast_messages'::regclass) THEN
    ALTER TABLE public.broadcast_messages ADD CONSTRAINT broadcast_messages_type_check CHECK ((type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'error'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcast_messages_pkey' AND conrelid = 'public.broadcast_messages'::regclass) THEN
    ALTER TABLE public.broadcast_messages ADD CONSTRAINT broadcast_messages_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_notes_pkey' AND conrelid = 'public.business_notes'::regclass) THEN
    ALTER TABLE public.business_notes ADD CONSTRAINT business_notes_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_pkey' AND conrelid = 'public.businesses'::regclass) THEN
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_entries_type_check' AND conrelid = 'public.changelog_entries'::regclass) THEN
    ALTER TABLE public.changelog_entries ADD CONSTRAINT changelog_entries_type_check CHECK ((type = ANY (ARRAY['feature'::text, 'improvement'::text, 'bugfix'::text, 'breaking'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_entries_pkey' AND conrelid = 'public.changelog_entries'::regclass) THEN
    ALTER TABLE public.changelog_entries ADD CONSTRAINT changelog_entries_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_notes_pkey' AND conrelid = 'public.client_notes'::regclass) THEN
    ALTER TABLE public.client_notes ADD CONSTRAINT client_notes_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_pkey' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crash_logs_severity_check' AND conrelid = 'public.crash_logs'::regclass) THEN
    ALTER TABLE public.crash_logs ADD CONSTRAINT crash_logs_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'error'::text, 'warning'::text, 'info'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crash_logs_pkey' AND conrelid = 'public.crash_logs'::regclass) THEN
    ALTER TABLE public.crash_logs ADD CONSTRAINT crash_logs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_status_check' AND conrelid = 'public.email_campaigns'::regclass) THEN
    ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'cancelled'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_pkey' AND conrelid = 'public.email_campaigns'::regclass) THEN
    ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_providers_type_check' AND conrelid = 'public.email_providers'::regclass) THEN
    ALTER TABLE public.email_providers ADD CONSTRAINT email_providers_type_check CHECK ((type = ANY (ARRAY['smtp'::text, 'api'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_providers_pkey' AND conrelid = 'public.email_providers'::regclass) THEN
    ALTER TABLE public.email_providers ADD CONSTRAINT email_providers_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_category_check' AND conrelid = 'public.email_templates'::regclass) THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_category_check CHECK ((category = ANY (ARRAY['broadcast'::text, 'automation'::text, 'transactional'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_pkey' AND conrelid = 'public.email_templates'::regclass) THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_triggers_pkey' AND conrelid = 'public.event_triggers'::regclass) THEN
    ALTER TABLE public.event_triggers ADD CONSTRAINT event_triggers_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_audit_results_impact_check' AND conrelid = 'public.gmb_audit_results'::regclass) THEN
    ALTER TABLE public.gmb_audit_results ADD CONSTRAINT gmb_audit_results_impact_check CHECK ((impact = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_audit_results_status_check' AND conrelid = 'public.gmb_audit_results'::regclass) THEN
    ALTER TABLE public.gmb_audit_results ADD CONSTRAINT gmb_audit_results_status_check CHECK ((status = ANY (ARRAY['critical'::text, 'warning'::text, 'good'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_audit_results_pkey' AND conrelid = 'public.gmb_audit_results'::regclass) THEN
    ALTER TABLE public.gmb_audit_results ADD CONSTRAINT gmb_audit_results_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_categories_pkey' AND conrelid = 'public.gmb_categories'::regclass) THEN
    ALTER TABLE public.gmb_categories ADD CONSTRAINT gmb_categories_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_hours_pkey' AND conrelid = 'public.gmb_hours'::regclass) THEN
    ALTER TABLE public.gmb_hours ADD CONSTRAINT gmb_hours_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_hours_business_id_day_key' AND conrelid = 'public.gmb_hours'::regclass) THEN
    ALTER TABLE public.gmb_hours ADD CONSTRAINT gmb_hours_business_id_day_key UNIQUE (business_id, day);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_profiles_pkey' AND conrelid = 'public.gmb_profiles'::regclass) THEN
    ALTER TABLE public.gmb_profiles ADD CONSTRAINT gmb_profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_profiles_business_id_key' AND conrelid = 'public.gmb_profiles'::regclass) THEN
    ALTER TABLE public.gmb_profiles ADD CONSTRAINT gmb_profiles_business_id_key UNIQUE (business_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_qas_pkey' AND conrelid = 'public.gmb_qas'::regclass) THEN
    ALTER TABLE public.gmb_qas ADD CONSTRAINT gmb_qas_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmb_services_pkey' AND conrelid = 'public.gmb_services'::regclass) THEN
    ALTER TABLE public.gmb_services ADD CONSTRAINT gmb_services_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'help_articles_status_check' AND conrelid = 'public.help_articles'::regclass) THEN
    ALTER TABLE public.help_articles ADD CONSTRAINT help_articles_status_check CHECK ((status = ANY (ARRAY['published'::text, 'draft'::text, 'archived'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'help_articles_user_type_check' AND conrelid = 'public.help_articles'::regclass) THEN
    ALTER TABLE public.help_articles ADD CONSTRAINT help_articles_user_type_check CHECK ((user_type = ANY (ARRAY['all'::text, 'business'::text, 'agency'::text, 'admin'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'help_articles_pkey' AND conrelid = 'public.help_articles'::regclass) THEN
    ALTER TABLE public.help_articles ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idea_comments_pkey' AND conrelid = 'public.idea_comments'::regclass) THEN
    ALTER TABLE public.idea_comments ADD CONSTRAINT idea_comments_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idea_votes_pkey' AND conrelid = 'public.idea_votes'::regclass) THEN
    ALTER TABLE public.idea_votes ADD CONSTRAINT idea_votes_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ideas_priority_check' AND conrelid = 'public.ideas'::regclass) THEN
    ALTER TABLE public.ideas ADD CONSTRAINT ideas_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ideas_roadmap_status_check' AND conrelid = 'public.ideas'::regclass) THEN
    ALTER TABLE public.ideas ADD CONSTRAINT ideas_roadmap_status_check CHECK ((roadmap_status = ANY (ARRAY['planned'::text, 'in-progress'::text, 'completed'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ideas_status_check' AND conrelid = 'public.ideas'::regclass) THEN
    ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'roadmap'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ideas_pkey' AND conrelid = 'public.ideas'::regclass) THEN
    ALTER TABLE public.ideas ADD CONSTRAINT ideas_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_access_level_check' AND conrelid = 'public.job_documents'::regclass) THEN
    ALTER TABLE public.job_documents ADD CONSTRAINT project_documents_access_level_check CHECK ((access_level = ANY (ARRAY['public'::text, 'client'::text, 'team'::text, 'admin'::text, 'private'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_document_type_check' AND conrelid = 'public.job_documents'::regclass) THEN
    ALTER TABLE public.job_documents ADD CONSTRAINT project_documents_document_type_check CHECK ((document_type = ANY (ARRAY['contract'::text, 'proposal'::text, 'report'::text, 'invoice'::text, 'receipt'::text, 'correspondence'::text, 'technical'::text, 'legal'::text, 'general'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_pkey' AND conrelid = 'public.job_documents'::regclass) THEN
    ALTER TABLE public.job_documents ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_media_category_check' AND conrelid = 'public.job_media'::regclass) THEN
    ALTER TABLE public.job_media ADD CONSTRAINT project_media_category_check CHECK ((category = ANY (ARRAY['before'::text, 'after'::text, 'progress'::text, 'final'::text, 'reference'::text, 'general'::text, 'walkthrough'::text, 'demonstration'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_media_media_type_check' AND conrelid = 'public.job_media'::regclass) THEN
    ALTER TABLE public.job_media ADD CONSTRAINT project_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_media_pkey' AND conrelid = 'public.job_media'::regclass) THEN
    ALTER TABLE public.job_media ADD CONSTRAINT project_media_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_photos_category_check' AND conrelid = 'public.job_photos'::regclass) THEN
    ALTER TABLE public.job_photos ADD CONSTRAINT project_photos_category_check CHECK ((category = ANY (ARRAY['before'::text, 'after'::text, 'progress'::text, 'final'::text, 'reference'::text, 'general'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_photos_pkey' AND conrelid = 'public.job_photos'::regclass) THEN
    ALTER TABLE public.job_photos ADD CONSTRAINT project_photos_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_priority_check' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_progress_percentage_check' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_progress_percentage_check CHECK (((progress_percentage >= 0) AND (progress_percentage <= 100)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_status_check' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'completed'::text, 'cancelled'::text, 'blocked'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_pkey' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_pkey' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kv_store_32071718_pkey' AND conrelid = 'public.kv_store_32071718'::regclass) THEN
    ALTER TABLE public.kv_store_32071718 ADD CONSTRAINT kv_store_32071718_pkey PRIMARY KEY (key);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_pkey' AND conrelid = 'public.locations'::regclass) THEN
    ALTER TABLE public.locations ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'login_slides_pkey' AND conrelid = 'public.login_slides'::regclass) THEN
    ALTER TABLE public.login_slides ADD CONSTRAINT login_slides_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_category_check' AND conrelid = 'public.message_templates'::regclass) THEN
    ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_category_check CHECK ((category = ANY (ARRAY['welcome'::text, 'notification'::text, 'marketing'::text, 'transactional'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_status_check' AND conrelid = 'public.message_templates'::regclass) THEN
    ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_type_check' AND conrelid = 'public.message_templates'::regclass) THEN
    ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_type_check CHECK ((type = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'in-app'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_pkey' AND conrelid = 'public.message_templates'::regclass) THEN
    ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_approval_status_check' AND conrelid = 'public.notification_templates'::regclass) THEN
    ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_category_check' AND conrelid = 'public.notification_templates'::regclass) THEN
    ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_category_check CHECK ((category = ANY (ARRAY['system'::text, 'marketing'::text, 'support'::text, 'emergency'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_type_check' AND conrelid = 'public.notification_templates'::regclass) THEN
    ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_type_check CHECK ((type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'error'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_pkey' AND conrelid = 'public.notification_templates'::regclass) THEN
    ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_category_check' AND conrelid = 'public.notifications'::regclass) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check CHECK ((category = ANY (ARRAY['project'::text, 'system'::text, 'billing'::text, 'security'::text, 'update'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check' AND conrelid = 'public.notifications'::regclass) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_source_check' AND conrelid = 'public.notifications'::regclass) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_check CHECK ((source = ANY (ARRAY['system'::text, 'user'::text, 'api'::text, 'webhook'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check' AND conrelid = 'public.notifications'::regclass) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'error'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_pkey' AND conrelid = 'public.notifications'::regclass) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optimization_jobs_status_check' AND conrelid = 'public.optimization_jobs'::regclass) THEN
    ALTER TABLE public.optimization_jobs ADD CONSTRAINT optimization_jobs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'scheduled'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optimization_jobs_type_check' AND conrelid = 'public.optimization_jobs'::regclass) THEN
    ALTER TABLE public.optimization_jobs ADD CONSTRAINT optimization_jobs_type_check CHECK ((type = ANY (ARRAY['cache_warmup'::text, 'database_cleanup'::text, 'index_rebuild'::text, 'log_rotation'::text, 'custom'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optimization_jobs_pkey' AND conrelid = 'public.optimization_jobs'::regclass) THEN
    ALTER TABLE public.optimization_jobs ADD CONSTRAINT optimization_jobs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_pkey' AND conrelid = 'public.plans'::regclass) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_discount_type_check' AND conrelid = 'public.promo_codes'::regclass) THEN
    ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_discount_type_check CHECK ((discount_type = ANY (ARRAY['%'::text, '$'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_pkey' AND conrelid = 'public.promo_codes'::regclass) THEN
    ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_code_key' AND conrelid = 'public.promo_codes'::regclass) THEN
    ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_code_key UNIQUE (code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_checks_category_check' AND conrelid = 'public.qa_checks'::regclass) THEN
    ALTER TABLE public.qa_checks ADD CONSTRAINT qa_checks_category_check CHECK ((category = ANY (ARRAY['ui'::text, 'api'::text, 'data'::text, 'security'::text, 'performance'::text, 'general'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_checks_priority_check' AND conrelid = 'public.qa_checks'::regclass) THEN
    ALTER TABLE public.qa_checks ADD CONSTRAINT qa_checks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_checks_status_check' AND conrelid = 'public.qa_checks'::regclass) THEN
    ALTER TABLE public.qa_checks ADD CONSTRAINT qa_checks_status_check CHECK ((status = ANY (ARRAY['pass'::text, 'fail'::text, 'pending'::text, 'in_progress'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_checks_pkey' AND conrelid = 'public.qa_checks'::regclass) THEN
    ALTER TABLE public.qa_checks ADD CONSTRAINT qa_checks_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_requests_status_check' AND conrelid = 'public.review_requests'::regclass) THEN
    ALTER TABLE public.review_requests ADD CONSTRAINT review_requests_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'viewed'::text, 'scheduled'::text, 'expired'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_requests_pkey' AND conrelid = 'public.review_requests'::regclass) THEN
    ALTER TABLE public.review_requests ADD CONSTRAINT review_requests_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_pkey' AND conrelid = 'public.reviews'::regclass) THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rss_feed_items_pkey' AND conrelid = 'public.rss_feed_items'::regclass) THEN
    ALTER TABLE public.rss_feed_items ADD CONSTRAINT rss_feed_items_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scaling_rules_action_type_check' AND conrelid = 'public.scaling_rules'::regclass) THEN
    ALTER TABLE public.scaling_rules ADD CONSTRAINT scaling_rules_action_type_check CHECK ((action_type = ANY (ARRAY['scale_up'::text, 'scale_down'::text, 'restart'::text, 'notify'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scaling_rules_pkey' AND conrelid = 'public.scaling_rules'::regclass) THEN
    ALTER TABLE public.scaling_rules ADD CONSTRAINT scaling_rules_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'server_media_metadata_pkey' AND conrelid = 'public.server_media_metadata'::regclass) THEN
    ALTER TABLE public.server_media_metadata ADD CONSTRAINT server_media_metadata_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signup_slides_pkey' AND conrelid = 'public.signup_slides'::regclass) THEN
    ALTER TABLE public.signup_slides ADD CONSTRAINT signup_slides_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_logs_pkey' AND conrelid = 'public.sms_logs'::regclass) THEN
    ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'super_admin_tasks_priority_check' AND conrelid = 'public.super_admin_tasks'::regclass) THEN
    ALTER TABLE public.super_admin_tasks ADD CONSTRAINT super_admin_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'super_admin_tasks_status_check' AND conrelid = 'public.super_admin_tasks'::regclass) THEN
    ALTER TABLE public.super_admin_tasks ADD CONSTRAINT super_admin_tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'blocked'::text, 'done'::text, 'cancelled'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'super_admin_tasks_pkey' AND conrelid = 'public.super_admin_tasks'::regclass) THEN
    ALTER TABLE public.super_admin_tasks ADD CONSTRAINT super_admin_tasks_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_priority_check' AND conrelid = 'public.support_tickets'::regclass) THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_status_check' AND conrelid = 'public.support_tickets'::regclass) THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in-progress'::text, 'resolved'::text, 'closed'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_pkey' AND conrelid = 'public.support_tickets'::regclass) THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_pkey' AND conrelid = 'public.system_settings'::regclass) THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_key_key' AND conrelid = 'public.system_settings'::regclass) THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_key_key UNIQUE (key);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_responses_pkey' AND conrelid = 'public.ticket_responses'::regclass) THEN
    ALTER TABLE public.ticket_responses ADD CONSTRAINT ticket_responses_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_segments_pkey' AND conrelid = 'public.user_segments'::regclass) THEN
    ALTER TABLE public.user_segments ADD CONSTRAINT user_segments_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sub_account_id_key' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_sub_account_id_key UNIQUE (sub_account_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_pkey' AND conrelid = 'public.webhook_deliveries'::regclass) THEN
    ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_pkey' AND conrelid = 'public.webhooks'::regclass) THEN
    ALTER TABLE public.webhooks ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_business_id_url_key' AND conrelid = 'public.webhooks'::regclass) THEN
    ALTER TABLE public.webhooks ADD CONSTRAINT webhooks_business_id_url_key UNIQUE (business_id, url);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_pkey' AND conrelid = 'public.workflow_executions'::regclass) THEN
    ALTER TABLE public.workflow_executions ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflows_pkey' AND conrelid = 'public.workflows'::regclass) THEN
    ALTER TABLE public.workflows ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_pkey' AND conrelid = 'public.workspaces'::regclass) THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Foreign keys (33, guarded; all tables exist by now)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_business_id_fkey' AND conrelid = 'public.analytics'::regclass) THEN
    ALTER TABLE public.analytics ADD CONSTRAINT analytics_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_business_id_fkey' AND conrelid = 'public.audit_logs'::regclass) THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey' AND conrelid = 'public.audit_logs'::regclass) THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_business_id_fkey' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_notes_business_id_fkey' AND conrelid = 'public.business_notes'::regclass) THEN
    ALTER TABLE public.business_notes ADD CONSTRAINT business_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_owner_id_fkey' AND conrelid = 'public.businesses'::regclass) THEN
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_notes_client_id_fkey' AND conrelid = 'public.client_notes'::regclass) THEN
    ALTER TABLE public.client_notes ADD CONSTRAINT client_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_business_id_fkey' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_template_id_fkey' AND conrelid = 'public.email_campaigns'::regclass) THEN
    ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idea_comments_idea_id_fkey' AND conrelid = 'public.idea_comments'::regclass) THEN
    ALTER TABLE public.idea_comments ADD CONSTRAINT idea_comments_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.ideas(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idea_votes_idea_id_fkey' AND conrelid = 'public.idea_votes'::regclass) THEN
    ALTER TABLE public.idea_votes ADD CONSTRAINT idea_votes_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.ideas(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_client_id_fkey' AND conrelid = 'public.job_documents'::regclass) THEN
    ALTER TABLE public.job_documents ADD CONSTRAINT project_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_project_id_fkey' AND conrelid = 'public.job_documents'::regclass) THEN
    ALTER TABLE public.job_documents ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_uploaded_by_fkey' AND conrelid = 'public.job_documents'::regclass) THEN
    ALTER TABLE public.job_documents ADD CONSTRAINT project_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_media_client_id_fkey' AND conrelid = 'public.job_media'::regclass) THEN
    ALTER TABLE public.job_media ADD CONSTRAINT project_media_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_media_project_id_fkey' AND conrelid = 'public.job_media'::regclass) THEN
    ALTER TABLE public.job_media ADD CONSTRAINT project_media_project_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_photos_project_id_fkey' AND conrelid = 'public.job_photos'::regclass) THEN
    ALTER TABLE public.job_photos ADD CONSTRAINT project_photos_project_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_photos_uploaded_by_fkey' AND conrelid = 'public.job_photos'::regclass) THEN
    ALTER TABLE public.job_photos ADD CONSTRAINT project_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_assigned_by_fkey' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_assigned_to_fkey' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_project_id_fkey' AND conrelid = 'public.job_tasks'::regclass) THEN
    ALTER TABLE public.job_tasks ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_assigned_to_fkey' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT projects_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_business_id_fkey' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT projects_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_client_id_fkey' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_business_id_fkey' AND conrelid = 'public.locations'::regclass) THEN
    ALTER TABLE public.locations ADD CONSTRAINT locations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_requests_business_id_fkey' AND conrelid = 'public.review_requests'::regclass) THEN
    ALTER TABLE public.review_requests ADD CONSTRAINT review_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_business_id_fkey' AND conrelid = 'public.reviews'::regclass) THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'super_admin_tasks_assigned_to_fkey' AND conrelid = 'public.super_admin_tasks'::regclass) THEN
    ALTER TABLE public.super_admin_tasks ADD CONSTRAINT super_admin_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'super_admin_tasks_business_id_fkey' AND conrelid = 'public.super_admin_tasks'::regclass) THEN
    ALTER TABLE public.super_admin_tasks ADD CONSTRAINT super_admin_tasks_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_responses_ticket_id_fkey' AND conrelid = 'public.ticket_responses'::regclass) THEN
    ALTER TABLE public.ticket_responses ADD CONSTRAINT ticket_responses_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_execution_id_fkey' AND conrelid = 'public.webhook_deliveries'::regclass) THEN
    ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_executions(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_webhook_id_fkey' AND conrelid = 'public.webhook_deliveries'::regclass) THEN
    ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_executions_workflow_id_fkey' AND conrelid = 'public.workflow_executions'::regclass) THEN
    ALTER TABLE public.workflow_executions ADD CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Indexes not backing a constraint (56)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS billing_records_business_id_idx ON public.billing_records USING btree (business_id);
CREATE INDEX IF NOT EXISTS billing_records_created_at_idx ON public.billing_records USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS billing_records_payment_provider_idx ON public.billing_records USING btree (payment_provider);
CREATE INDEX IF NOT EXISTS idx_business_notes_business_id ON public.business_notes USING btree (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS businesses_account_id_key ON public.businesses USING btree (account_id);
CREATE INDEX IF NOT EXISTS client_notes_client_id_idx ON public.client_notes USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON public.clients USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients USING btree (email);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients USING btree (name);
CREATE INDEX IF NOT EXISTS idx_gmb_audit_results_business_id ON public.gmb_audit_results USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_gmb_categories_business_id ON public.gmb_categories USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_gmb_hours_business_id ON public.gmb_hours USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_gmb_profiles_business_id ON public.gmb_profiles USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_gmb_qas_business_id ON public.gmb_qas USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_gmb_services_business_id ON public.gmb_services USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_idea_comments_idea_id ON public.idea_comments USING btree (idea_id);
CREATE UNIQUE INDEX IF NOT EXISTS idea_votes_idea_device_unique ON public.idea_votes USING btree (idea_id, device_id) WHERE (device_id <> ''::text);
CREATE UNIQUE INDEX IF NOT EXISTS idea_votes_idea_email_unique ON public.idea_votes USING btree (idea_id, user_email) WHERE (user_email <> ''::text);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON public.job_documents USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_project_media_created_at ON public.job_media USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_media_is_featured ON public.job_media USING btree (is_featured);
CREATE INDEX IF NOT EXISTS idx_project_media_media_type ON public.job_media USING btree (media_type);
CREATE INDEX IF NOT EXISTS idx_project_media_project_id ON public.job_media USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_is_featured ON public.job_photos USING btree (is_featured);
CREATE INDEX IF NOT EXISTS idx_project_photos_project_id ON public.job_photos USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.job_tasks USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.job_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_business_id ON public.jobs USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.jobs USING btree (status);
-- NOTE: the live DB carries two identical indexes on kv_store_32071718(key text_pattern_ops)
-- (kv_store_32071718_key_idx and kv_store_32071718_key_idx1). Both are reproduced for fidelity;
-- the duplicate is a Figma-Make scaffold artifact and can be dropped later.
CREATE INDEX IF NOT EXISTS kv_store_32071718_key_idx ON public.kv_store_32071718 USING btree (key text_pattern_ops);
CREATE INDEX IF NOT EXISTS kv_store_32071718_key_idx1 ON public.kv_store_32071718 USING btree (key text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON public.reviews USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON public.reviews USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_rss_feed_items_pub_date ON public.rss_feed_items USING btree (pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_rss_feed_items_workflow_id ON public.rss_feed_items USING btree (workflow_id);
CREATE INDEX IF NOT EXISTS idx_server_media_account ON public.server_media_metadata USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_server_media_project ON public.server_media_metadata USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_server_media_public_url ON public.server_media_metadata USING btree (public_url_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_business ON public.sms_logs USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON public.sms_logs USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_twilio_sid ON public.sms_logs USING btree (twilio_sid);
CREATE INDEX IF NOT EXISTS super_admin_tasks_assigned_to_idx ON public.super_admin_tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS super_admin_tasks_business_id_idx ON public.super_admin_tasks USING btree (business_id);
CREATE INDEX IF NOT EXISTS super_admin_tasks_due_at_idx ON public.super_admin_tasks USING btree (due_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_execution_id ON public.webhook_deliveries USING btree (execution_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON public.webhook_deliveries USING btree (webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_business_id ON public.webhooks USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON public.webhooks USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_business_id ON public.workflow_executions USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions USING btree (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_business_id ON public.workflows USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON public.workflows USING btree (is_active);

-- ----------------------------------------------------------------------------
-- 8. Views (4)
-- ----------------------------------------------------------------------------
-- NOTE: none of these views are SECURITY INVOKER on the live DB (no reloptions set);
-- they run with the owner's (postgres) privileges, i.e. they bypass RLS on the
-- underlying tables. Reproduced as-is; revisit in the auth/RLS step.

-- `projects` is a compatibility shim over `jobs` that the web client still reads.
CREATE OR REPLACE VIEW public.projects AS
 SELECT id,
    business_id,
    name,
    description,
    type,
    status,
    priority,
    assigned_to,
    client_contact,
    objectives,
    deliverables,
    timeline,
    budget,
    seo_targets,
    competitors,
    progress,
    metadata,
    created_at,
    updated_at,
    started_at,
    completed_at,
    due_date,
    materials,
    tasks,
    client_id
   FROM public.jobs;

CREATE OR REPLACE VIEW public.business_performance_summary AS
 SELECT b.id AS business_id,
    b.name AS business_name,
    b.category,
    b.status,
    count(DISTINCT p.id) AS total_projects,
    count(DISTINCT p.id) FILTER (WHERE p.status = ANY (ARRAY['active'::project_status, 'in_progress'::project_status])) AS active_projects,
    count(DISTINCT p.id) FILTER (WHERE p.status = 'completed'::project_status) AS completed_projects,
    count(DISTINCT r.id) AS total_reviews,
    COALESCE(avg(r.rating), 0::numeric)::numeric(3,2) AS avg_rating,
    count(DISTINCT r.id) FILTER (WHERE r.rating >= 4) AS positive_reviews,
    count(DISTINCT r.id) FILTER (WHERE r.rating <= 2) AS negative_reviews
   FROM public.businesses b
     LEFT JOIN public.jobs p ON p.business_id = b.id
     LEFT JOIN public.reviews r ON r.business_id = b.id
  GROUP BY b.id, b.name, b.category, b.status;

CREATE OR REPLACE VIEW public.project_activity_summary AS
 SELECT p.id AS project_id,
    p.name AS project_name,
    p.status,
    p.priority,
    p.type,
    p.created_at,
    p.updated_at,
    p.due_date,
    count(DISTINCT pt.id) AS total_tasks,
    count(DISTINCT pt.id) FILTER (WHERE pt.status = 'completed'::text) AS completed_tasks,
    count(DISTINCT ph.id) AS total_photos,
    count(DISTINCT pd.id) AS total_documents,
        CASE
            WHEN count(pt.id) = 0 THEN 0::numeric
            ELSE round(count(pt.id) FILTER (WHERE pt.status = 'completed'::text)::numeric / count(pt.id)::numeric * 100::numeric)
        END AS completion_percentage
   FROM public.jobs p
     LEFT JOIN public.job_tasks pt ON pt.job_id = p.id
     LEFT JOIN public.job_photos ph ON ph.job_id = p.id
     LEFT JOIN public.job_documents pd ON pd.job_id = p.id
  GROUP BY p.id, p.name, p.status, p.priority, p.type, p.created_at, p.updated_at, p.due_date;

CREATE OR REPLACE VIEW public.user_dashboard_summary AS
 SELECT u.id AS user_id,
    u.name,
    u.email,
    u.role,
    count(DISTINCT b.id) AS total_businesses,
    count(DISTINCT p.id) AS total_projects,
    count(DISTINCT p.id) FILTER (WHERE p.status = ANY (ARRAY['active'::project_status, 'in_progress'::project_status])) AS active_projects,
    count(DISTINCT p.id) FILTER (WHERE p.status = 'completed'::project_status) AS completed_projects,
    count(DISTINCT r.id) AS total_reviews,
    COALESCE(avg(r.rating), 0::numeric)::numeric(3,2) AS avg_review_rating
   FROM public.users u
     LEFT JOIN public.businesses b ON b.owner_id = u.id
     LEFT JOIN public.jobs p ON p.business_id = b.id
     LEFT JOIN public.reviews r ON r.business_id = b.id
  GROUP BY u.id, u.name, u.email, u.role;

-- ----------------------------------------------------------------------------
-- 9. Triggers (5)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_business_account_id ON public.businesses;
CREATE TRIGGER trg_set_business_account_id BEFORE INSERT ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.set_business_account_id();

DROP TRIGGER IF EXISTS set_project_documents_updated_at ON public.job_documents;
CREATE TRIGGER set_project_documents_updated_at BEFORE UPDATE ON public.job_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_project_photos_updated_at ON public.job_photos;
CREATE TRIGGER set_project_photos_updated_at BEFORE UPDATE ON public.job_photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_project_tasks_updated_at ON public.job_tasks;
CREATE TRIGGER set_project_tasks_updated_at BEFORE UPDATE ON public.job_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_set_sub_account_id ON public.users;
CREATE TRIGGER trg_set_sub_account_id BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_sub_account_id();

-- ----------------------------------------------------------------------------
-- 10. Row level security + policies
-- ----------------------------------------------------------------------------
-- RLS enabled flags, exactly as on the live DB (26 of 57 tables). The other 31
-- tables have RLS DISABLED and are world-readable/writable through the default
-- grants below. This is the known-insecure state that the auth/RLS step
-- (supabase/migrations_pending/) is designed to replace.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_store_32071718 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scaling_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Policies: 76 on public, reproduced verbatim (including the USING (true) ones).
-- kv_store_32071718 has RLS enabled and NO policies, so it is reachable only via
-- service_role -- that is the Figma-Make edge-function scaffold's convention.

DROP POLICY IF EXISTS analytics_anon_all ON public.analytics;
CREATE POLICY analytics_anon_all ON public.analytics AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_anon_all ON public.audit_logs;
CREATE POLICY audit_logs_anon_all ON public.audit_logs AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS broadcast_messages_public_read ON public.broadcast_messages;
CREATE POLICY broadcast_messages_public_read ON public.broadcast_messages AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS broadcast_messages_public_write ON public.broadcast_messages;
CREATE POLICY broadcast_messages_public_write ON public.broadcast_messages AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS businesses_anon_all ON public.businesses;
CREATE POLICY businesses_anon_all ON public.businesses AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS changelog_delete ON public.changelog_entries;
CREATE POLICY changelog_delete ON public.changelog_entries AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS changelog_insert ON public.changelog_entries;
CREATE POLICY changelog_insert ON public.changelog_entries AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS changelog_read ON public.changelog_entries;
CREATE POLICY changelog_read ON public.changelog_entries AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS changelog_update ON public.changelog_entries;
CREATE POLICY changelog_update ON public.changelog_entries AS PERMISSIVE FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Allow all access to clients" ON public.clients AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS email_campaigns_public_read ON public.email_campaigns;
CREATE POLICY email_campaigns_public_read ON public.email_campaigns AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS email_campaigns_public_write ON public.email_campaigns;
CREATE POLICY email_campaigns_public_write ON public.email_campaigns AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS email_providers_public_read ON public.email_providers;
CREATE POLICY email_providers_public_read ON public.email_providers AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS email_providers_public_write ON public.email_providers;
CREATE POLICY email_providers_public_write ON public.email_providers AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS email_templates_public_read ON public.email_templates;
CREATE POLICY email_templates_public_read ON public.email_templates AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS email_templates_public_write ON public.email_templates;
CREATE POLICY email_templates_public_write ON public.email_templates AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS event_triggers_public_read ON public.event_triggers;
CREATE POLICY event_triggers_public_read ON public.event_triggers AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS event_triggers_public_write ON public.event_triggers;
CREATE POLICY event_triggers_public_write ON public.event_triggers AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS help_articles_delete ON public.help_articles;
CREATE POLICY help_articles_delete ON public.help_articles AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS help_articles_insert ON public.help_articles;
CREATE POLICY help_articles_insert ON public.help_articles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS help_articles_read ON public.help_articles;
CREATE POLICY help_articles_read ON public.help_articles AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS help_articles_update ON public.help_articles;
CREATE POLICY help_articles_update ON public.help_articles AS PERMISSIVE FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can delete ideas" ON public.ideas;
CREATE POLICY "Anyone can delete ideas" ON public.ideas AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can update ideas" ON public.ideas;
CREATE POLICY "Anyone can update ideas" ON public.ideas AS PERMISSIVE FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit ideas" ON public.ideas;
CREATE POLICY "Authenticated users can submit ideas" ON public.ideas AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read ideas" ON public.ideas;
CREATE POLICY "Public can read ideas" ON public.ideas AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS project_documents_anon_all ON public.job_documents;
CREATE POLICY project_documents_anon_all ON public.job_documents AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations" ON public.job_media;
CREATE POLICY "Allow all operations" ON public.job_media AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete access to job media" ON public.job_media;
CREATE POLICY "Allow delete access to job media" ON public.job_media AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS "Allow insert access to job media" ON public.job_media;
CREATE POLICY "Allow insert access to job media" ON public.job_media AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read access to job media" ON public.job_media;
CREATE POLICY "Allow read access to job media" ON public.job_media AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Allow update access to job media" ON public.job_media;
CREATE POLICY "Allow update access to job media" ON public.job_media AS PERMISSIVE FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS project_photos_anon_all ON public.job_photos;
CREATE POLICY project_photos_anon_all ON public.job_photos AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS project_tasks_anon_all ON public.job_tasks;
CREATE POLICY project_tasks_anon_all ON public.job_tasks AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS projects_anon_all ON public.jobs;
CREATE POLICY projects_anon_all ON public.jobs AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS locations_anon_all ON public.locations;
CREATE POLICY locations_anon_all ON public.locations AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read active slides" ON public.login_slides;
CREATE POLICY "Public can read active slides" ON public.login_slides AS PERMISSIVE FOR SELECT TO public
  USING ((active = true));

DROP POLICY IF EXISTS "Service role can manage slides" ON public.login_slides;
CREATE POLICY "Service role can manage slides" ON public.login_slides AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS message_templates_public_read ON public.message_templates;
CREATE POLICY message_templates_public_read ON public.message_templates AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS message_templates_public_write ON public.message_templates;
CREATE POLICY message_templates_public_write ON public.message_templates AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS optimization_jobs_public_read ON public.optimization_jobs;
CREATE POLICY optimization_jobs_public_read ON public.optimization_jobs AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS optimization_jobs_public_write ON public.optimization_jobs;
CREATE POLICY optimization_jobs_public_write ON public.optimization_jobs AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS qa_checks_delete ON public.qa_checks;
CREATE POLICY qa_checks_delete ON public.qa_checks AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS qa_checks_insert ON public.qa_checks;
CREATE POLICY qa_checks_insert ON public.qa_checks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS qa_checks_read ON public.qa_checks;
CREATE POLICY qa_checks_read ON public.qa_checks AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS qa_checks_update ON public.qa_checks;
CREATE POLICY qa_checks_update ON public.qa_checks AS PERMISSIVE FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS reviews_anon_all ON public.reviews;
CREATE POLICY reviews_anon_all ON public.reviews AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS rss_public_read ON public.rss_feed_items;
CREATE POLICY rss_public_read ON public.rss_feed_items AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS rss_service_write ON public.rss_feed_items;
CREATE POLICY rss_service_write ON public.rss_feed_items AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS scaling_rules_public_read ON public.scaling_rules;
CREATE POLICY scaling_rules_public_read ON public.scaling_rules AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS scaling_rules_public_write ON public.scaling_rules;
CREATE POLICY scaling_rules_public_write ON public.scaling_rules AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS "Public can read active signup slides" ON public.signup_slides;
CREATE POLICY "Public can read active signup slides" ON public.signup_slides AS PERMISSIVE FOR SELECT TO public
  USING ((active = true));

DROP POLICY IF EXISTS "Super admin can manage signup slides" ON public.signup_slides;
CREATE POLICY "Super admin can manage signup slides" ON public.signup_slides AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS tickets_delete ON public.support_tickets;
CREATE POLICY tickets_delete ON public.support_tickets AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS tickets_insert ON public.support_tickets;
CREATE POLICY tickets_insert ON public.support_tickets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS tickets_read ON public.support_tickets;
CREATE POLICY tickets_read ON public.support_tickets AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS tickets_update ON public.support_tickets;
CREATE POLICY tickets_update ON public.support_tickets AS PERMISSIVE FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS responses_delete ON public.ticket_responses;
CREATE POLICY responses_delete ON public.ticket_responses AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS responses_insert ON public.ticket_responses;
CREATE POLICY responses_insert ON public.ticket_responses AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS responses_read ON public.ticket_responses;
CREATE POLICY responses_read ON public.ticket_responses AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS responses_update ON public.ticket_responses;
CREATE POLICY responses_update ON public.ticket_responses AS PERMISSIVE FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS user_segments_public_read ON public.user_segments;
CREATE POLICY user_segments_public_read ON public.user_segments AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS user_segments_public_write ON public.user_segments;
CREATE POLICY user_segments_public_write ON public.user_segments AS PERMISSIVE FOR ALL TO public
  USING (true);

DROP POLICY IF EXISTS users_anon_all ON public.users;
CREATE POLICY users_anon_all ON public.users AS PERMISSIVE FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "System can insert webhook deliveries" ON public.webhook_deliveries AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Users can view their webhook deliveries" ON public.webhook_deliveries AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM public.webhooks
  WHERE ((webhooks.id = webhook_deliveries.webhook_id) AND (webhooks.business_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can create webhooks for their business" ON public.webhooks;
CREATE POLICY "Users can create webhooks for their business" ON public.webhooks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their business webhooks" ON public.webhooks;
CREATE POLICY "Users can delete their business webhooks" ON public.webhooks AS PERMISSIVE FOR DELETE TO public
  USING ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their business webhooks" ON public.webhooks;
CREATE POLICY "Users can update their business webhooks" ON public.webhooks AS PERMISSIVE FOR UPDATE TO public
  USING ((business_id = auth.uid()))
  WITH CHECK ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their business webhooks" ON public.webhooks;
CREATE POLICY "Users can view their business webhooks" ON public.webhooks AS PERMISSIVE FOR SELECT TO public
  USING ((business_id = auth.uid()));

DROP POLICY IF EXISTS "System can insert workflow executions" ON public.workflow_executions;
CREATE POLICY "System can insert workflow executions" ON public.workflow_executions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their workflow executions" ON public.workflow_executions;
CREATE POLICY "Users can view their workflow executions" ON public.workflow_executions AS PERMISSIVE FOR SELECT TO public
  USING ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create workflows" ON public.workflows;
CREATE POLICY "Users can create workflows" ON public.workflows AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their workflows" ON public.workflows;
CREATE POLICY "Users can delete their workflows" ON public.workflows AS PERMISSIVE FOR DELETE TO public
  USING ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their workflows" ON public.workflows;
CREATE POLICY "Users can update their workflows" ON public.workflows AS PERMISSIVE FOR UPDATE TO public
  USING ((business_id = auth.uid()))
  WITH CHECK ((business_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their workflows" ON public.workflows;
CREATE POLICY "Users can view their workflows" ON public.workflows AS PERMISSIVE FOR SELECT TO public
  USING ((business_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 11. Grants
-- ----------------------------------------------------------------------------
-- Grants, exactly as on the live DB. Every table, view and sequence in public
-- carries {postgres,anon,authenticated,service_role}=arwdDxtm (i.e. ALL), and
-- every function carries EXECUTE for the same roles. These are the stock
-- Supabase default privileges; nothing has been revoked yet. The lockdown
-- migration in supabase/migrations_pending/ is what revokes anon's write half.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Default privileges for objects created later by `postgres` (also live as-is).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. Storage
-- ----------------------------------------------------------------------------
-- Storage: one bucket, `media`, PUBLIC, no size limit, no MIME restriction.
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- storage.objects policies, verbatim. Despite their names, all four apply to
-- role `public` (no TO clause on the live policies), so anon AND authenticated
-- can read/upload/update/delete anything in the bucket. The lockdown migration
-- in supabase/migrations_pending/ drops the three write policies.
DROP POLICY IF EXISTS "Allow anon delete from media bucket" ON storage.objects;
CREATE POLICY "Allow anon delete from media bucket" ON storage.objects AS PERMISSIVE FOR DELETE TO public
  USING ((bucket_id = 'media'::text));

DROP POLICY IF EXISTS "Allow anon read from media bucket" ON storage.objects;
CREATE POLICY "Allow anon read from media bucket" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'media'::text));

DROP POLICY IF EXISTS "Allow anon update in media bucket" ON storage.objects;
CREATE POLICY "Allow anon update in media bucket" ON storage.objects AS PERMISSIVE FOR UPDATE TO public
  USING ((bucket_id = 'media'::text))
  WITH CHECK ((bucket_id = 'media'::text));

DROP POLICY IF EXISTS "Allow anon upload to media bucket" ON storage.objects;
CREATE POLICY "Allow anon upload to media bucket" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'media'::text));

-- end of baseline
