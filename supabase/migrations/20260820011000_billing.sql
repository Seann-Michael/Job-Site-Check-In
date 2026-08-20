-- ============================================================================
-- Billing module: plans / subscriptions / invoices (billing_records).
--
-- Source of truth is Stripe when configured, but every column here also works
-- for MANUAL / COMP (internal) billing so the module functions with Stripe
-- dormant. All mutations to `subscriptions` and `billing_records` go through
-- the server (service role); the `authenticated` (PostgREST) role gets SELECT
-- only, gated by the existing can_read_business() / is_super_admin() helpers.
--
-- DESIGN DECISION — one subscription row per business:
--   `subscriptions` has UNIQUE(business_id): a business has at most ONE
--   subscription row, mutated in place across plan changes / cancel / resub.
--   Historical billing lives in `billing_records` (one row per invoice), so we
--   do not keep a subscription history table. The webhook + assign endpoints
--   upsert on business_id. (The alternative — history rows + is_current — was
--   rejected to keep MRR/active-count queries a single scan of one row/biz.)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, guarded constraints, CREATE TABLE IF
-- NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY.
-- ============================================================================

-- ── plans: Stripe + structured pricing columns ─────────────────────────────
-- NOTE: `plans.features` already exists as text[] in the baseline and
-- `plans.is_active` already exists as boolean — we keep both as-is (changing
-- features to jsonb would be destructive). `price` (text) is kept for display;
-- `amount_cents` is the authoritative numeric amount used for MRR / Stripe.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_price_id   text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_product_id text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS interval          text NOT NULL DEFAULT 'month';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS amount_cents      integer;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order        integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_interval_check' AND conrelid = 'public.plans'::regclass) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_interval_check CHECK (interval IN ('month', 'year'));
  END IF;
END $$;

-- ── businesses: link to the Stripe customer ────────────────────────────────
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- ── subscriptions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id            uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id                uuid REFERENCES public.plans(id),
  stripe_subscription_id text,
  stripe_customer_id     text,
  status                 text NOT NULL DEFAULT 'incomplete',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pkey' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
  END IF;
  -- One subscription row per business (see design note above).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_business_id_key' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_business_id_key UNIQUE (business_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_stripe_sub_key' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_stripe_sub_key UNIQUE (stripe_subscription_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'comped', 'incomplete'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subscriptions_business_id_idx ON public.subscriptions (business_id);
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx     ON public.subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx      ON public.subscriptions (status);

-- keep updated_at fresh (reuse the shared trigger fn if present)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
    CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ── billing_records: invoice columns ───────────────────────────────────────
-- Baseline already has: business_id, type, status, amount (numeric), currency,
-- invoice_id, provider_invoice_url, provider_receipt_url, billing_period_start,
-- billing_period_end, created_at. We add Stripe/invoice-specific columns. The
-- `status` values used by this module are paid|open|void|uncollectible|refunded;
-- the baseline has a CHECK restricting status to a different legacy set, so we
-- widen it below to the UNION of both (keeping existing rows valid).
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS stripe_invoice_id  text;
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS amount_cents       integer;
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS hosted_invoice_url text;
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS pdf_url            text;
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS period_start       timestamptz;
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS period_end         timestamptz;

-- Widen the status CHECK to include the Stripe invoice statuses used here
-- (paid|open|void|uncollectible) alongside the legacy values. Idempotent:
-- drop the old constraint (any name) and recreate with the full set.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_status_check' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records DROP CONSTRAINT billing_records_status_check;
  END IF;
  ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_status_check
    CHECK (status IN (
      'paid', 'open', 'void', 'uncollectible', 'refunded',
      'succeeded', 'failed', 'pending', 'disputed', 'cancelled'
    ));
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_stripe_invoice_key' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_stripe_invoice_key UNIQUE (stripe_invoice_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS billing_records_created_at_idx ON public.billing_records (created_at);
CREATE INDEX IF NOT EXISTS billing_records_status_idx     ON public.billing_records (status);

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- ── subscriptions: SELECT for business readers + super admin; NO client writes
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.can_read_business(business_id));
-- No INSERT/UPDATE/DELETE policy: only the service role (server) may write.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
REVOKE ALL ON public.subscriptions FROM anon;

-- ── plans: keep the baseline policies (anon+authenticated read; super admin
-- write). Re-assert them idempotently so this migration is self-contained.
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_read" ON public.plans;
CREATE POLICY "plans_read" ON public.plans
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "plans_write" ON public.plans;
CREATE POLICY "plans_write" ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ── billing_records: owner/member read own; writes super-admin/service only.
-- (Tightens the prior billing_records_write which allowed owners/staff to
-- write via can_write_business — invoices must only be written server-side.)
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_records_select" ON public.billing_records;
CREATE POLICY "billing_records_select" ON public.billing_records
  FOR SELECT TO authenticated
  USING (public.can_read_business(business_id));
DROP POLICY IF EXISTS "billing_records_write" ON public.billing_records;
CREATE POLICY "billing_records_write" ON public.billing_records
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
REVOKE INSERT, UPDATE, DELETE ON public.billing_records FROM anon;

-- Grants: authenticated may SELECT (RLS still applies); the service role used
-- by the server bypasses RLS entirely.
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.billing_records TO authenticated;
GRANT SELECT ON public.plans TO anon, authenticated;
