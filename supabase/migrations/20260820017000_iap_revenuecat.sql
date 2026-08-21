-- ============================================================================
-- In-app purchases via RevenueCat (App Store + Google Play).
--
-- IAP subscriptions feed the SAME entitlement model Stripe already uses: a
-- RevenueCat webhook (server, service role) upserts the business's single
-- `subscriptions` row and appends to `billing_records`. Feature-gating stays
-- provider-agnostic — it reads status + plan, never "which store paid".
--
-- This migration only ADDS columns / widens a CHECK, so it is safe on top of
-- the live schema and fully idempotent (ADD COLUMN IF NOT EXISTS, guarded
-- constraints, IF NOT EXISTS indexes).
-- ============================================================================

-- ── subscriptions: which provider/store owns this row + the RC identity ─────
-- `provider` distinguishes Stripe (web) from the two app stores. The store
-- ids let the webhook reconcile renewals and dedupe. `stripe_*` columns stay
-- as-is for the web path.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider               text NOT NULL DEFAULT 'stripe';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS store                  text;   -- 'app_store' | 'play_store'
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS revenuecat_app_user_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS store_product_id       text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS store_transaction_id   text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_provider_check' AND conrelid = 'public.subscriptions'::regclass) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check
      CHECK (provider IN ('stripe', 'app_store', 'play_store', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subscriptions_rc_app_user_idx ON public.subscriptions (revenuecat_app_user_id);

-- ── plans: map a plan to its per-store product ids + RC entitlement ─────────
-- One logical plan ("Pro monthly") knows its identifier in each system; the
-- webhook resolves product_id / entitlement -> plan. `stripe_price_id` stays.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS apple_product_id        text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS google_product_id       text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS revenuecat_entitlement_id text;

CREATE INDEX IF NOT EXISTS plans_apple_product_idx  ON public.plans (apple_product_id);
CREATE INDEX IF NOT EXISTS plans_google_product_idx ON public.plans (google_product_id);

-- ── billing_records: allow the two store providers + an IAP idempotency key ─
ALTER TABLE public.billing_records ADD COLUMN IF NOT EXISTS store_transaction_id text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_payment_provider_check' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records DROP CONSTRAINT billing_records_payment_provider_check;
  END IF;
  ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_payment_provider_check
    CHECK (payment_provider = ANY (ARRAY['stripe'::text, 'app_store'::text, 'play_store'::text, 'manual'::text, 'other'::text]));
END $$;

-- Unique so the webhook can upsert an IAP charge idempotently on retries.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_records_store_txn_key' AND conrelid = 'public.billing_records'::regclass) THEN
    ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_store_txn_key UNIQUE (store_transaction_id);
  END IF;
END $$;
