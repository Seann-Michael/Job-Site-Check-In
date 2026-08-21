-- ============================================================================
-- Remove PayPal as a supported payment provider.
--
-- The product now bills exclusively through Stripe (web) with manual/comp as
-- the internal fallback, so 'paypal' is no longer an allowed value for
-- billing_records.payment_provider. Payments were never live, so no real rows
-- carry 'paypal'; the UPDATE below is a defensive no-op that keeps the
-- constraint swap safe even if a test row exists.
--
-- Idempotent: guarded UPDATE, drop-then-recreate the CHECK with the tightened
-- value set.
-- ============================================================================

-- Reassign any lingering 'paypal' records to 'other' so the tightened
-- constraint can be applied without violating existing rows.
UPDATE public.billing_records
SET payment_provider = 'other'
WHERE payment_provider = 'paypal';

-- Swap the CHECK constraint to the Stripe-only value set.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_records_payment_provider_check'
      AND conrelid = 'public.billing_records'::regclass
  ) THEN
    ALTER TABLE public.billing_records DROP CONSTRAINT billing_records_payment_provider_check;
  END IF;
  ALTER TABLE public.billing_records ADD CONSTRAINT billing_records_payment_provider_check
    CHECK (payment_provider = ANY (ARRAY['stripe'::text, 'manual'::text, 'other'::text]));
END $$;
