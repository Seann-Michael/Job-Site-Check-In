-- =========================================================
-- Fix credit tracking tables to use agency_account_number
-- + supabase UUID instead of agency_name
-- =========================================================

-- Shared timestamp helper (if not already present)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 1. Add agency_account_number to public.users
--    Agencies are identified by their UUID (id) AND this
--    stable account number — NOT by their mutable name.
-- =========================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agency_account_number VARCHAR(20) UNIQUE;

-- Function to generate a unique, human-readable account number
CREATE OR REPLACE FUNCTION generate_agency_account_number()
RETURNS TRIGGER AS $$
DECLARE
  v_new_number VARCHAR(20);
  v_attempts   INTEGER := 0;
BEGIN
  IF (NEW.role = 'agency_admin') AND (NEW.agency_account_number IS NULL) THEN
    LOOP
      v_new_number := 'AGY-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE agency_account_number = v_new_number
      ) THEN
        NEW.agency_account_number := v_new_number;
        EXIT;
      END IF;
      v_attempts := v_attempts + 1;
      IF v_attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique agency account number';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_agency_account_number ON public.users;
CREATE TRIGGER trg_set_agency_account_number
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION generate_agency_account_number();

-- Backfill any existing agency_admin rows that lack an account number
DO $$
DECLARE
  r            RECORD;
  v_new_number VARCHAR(20);
BEGIN
  FOR r IN
    SELECT id FROM public.users
    WHERE role = 'agency_admin' AND agency_account_number IS NULL
  LOOP
    LOOP
      v_new_number := 'AGY-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      IF NOT EXISTS (SELECT 1 FROM public.users WHERE agency_account_number = v_new_number) THEN
        UPDATE public.users SET agency_account_number = v_new_number WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- =========================================================
-- 2. agency_credits
--    One row per agency — identified by UUID + account number.
--    agency_name is NOT stored here; it lives in public.users.name
--    and is used for display only.
-- =========================================================
CREATE TABLE IF NOT EXISTS agency_credits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_account_number VARCHAR(20) NOT NULL REFERENCES public.users(agency_account_number) ON UPDATE CASCADE,
  current_credits       INTEGER     NOT NULL DEFAULT 0 CHECK (current_credits >= 0),
  total_purchased       INTEGER     NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  total_allocated       INTEGER     NOT NULL DEFAULT 0 CHECK (total_allocated >= 0),
  total_consumed        INTEGER     NOT NULL DEFAULT 0 CHECK (total_consumed >= 0),
  monthly_credit_limit  INTEGER,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_agency_credits_user   UNIQUE (agency_user_id),
  CONSTRAINT uq_agency_credits_acct   UNIQUE (agency_account_number)
);

CREATE INDEX IF NOT EXISTS idx_agency_credits_user_id        ON agency_credits(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_credits_account_number ON agency_credits(agency_account_number);

DROP TRIGGER IF EXISTS trg_agency_credits_updated_at ON agency_credits;
CREATE TRIGGER trg_agency_credits_updated_at
  BEFORE UPDATE ON agency_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 3. credit_transactions
--    Keyed by user UUID (the consumer) and, when the consumer
--    is an agency, also by agency_account_number.
--    No agency_name column — look up name via JOIN on public.users.
-- =========================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_user_id        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  agency_account_number VARCHAR(20) REFERENCES public.users(agency_account_number) ON UPDATE CASCADE ON DELETE SET NULL,
  transaction_type      VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'allocation')),
  credits_amount        INTEGER     NOT NULL,
  service_name          VARCHAR(100),
  description           TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_txn_user_id       ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_agency_user   ON credit_transactions(agency_user_id)        WHERE agency_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_txn_agency_acct   ON credit_transactions(agency_account_number) WHERE agency_account_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_txn_service       ON credit_transactions(service_name)          WHERE service_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_txn_created_at    ON credit_transactions(created_at);

-- =========================================================
-- 4. credit_usage_by_service
--    Daily credit consumption per service per agency,
--    identified by UUID + account number.
-- =========================================================
CREATE TABLE IF NOT EXISTS credit_usage_by_service (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_account_number VARCHAR(20) NOT NULL REFERENCES public.users(agency_account_number) ON UPDATE CASCADE,
  service_name          VARCHAR(100) NOT NULL,
  usage_date            DATE         NOT NULL DEFAULT CURRENT_DATE,
  credits_used          INTEGER      NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  request_count         INTEGER      NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  metadata              JSONB        DEFAULT '{}',
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_usage_by_service UNIQUE (agency_user_id, service_name, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_by_svc_user    ON credit_usage_by_service(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_usage_by_svc_account ON credit_usage_by_service(agency_account_number);
CREATE INDEX IF NOT EXISTS idx_usage_by_svc_date    ON credit_usage_by_service(usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_by_svc_service ON credit_usage_by_service(service_name);

DROP TRIGGER IF EXISTS trg_credit_usage_by_svc_updated_at ON credit_usage_by_service;
CREATE TRIGGER trg_credit_usage_by_svc_updated_at
  BEFORE UPDATE ON credit_usage_by_service
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 5. daily_credit_usage
--    Aggregated daily totals per agency,
--    identified by UUID + account number.
-- =========================================================
CREATE TABLE IF NOT EXISTS daily_credit_usage (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_account_number VARCHAR(20) NOT NULL REFERENCES public.users(agency_account_number) ON UPDATE CASCADE,
  usage_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  credits_used          INTEGER     NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  credits_purchased     INTEGER     NOT NULL DEFAULT 0 CHECK (credits_purchased >= 0),
  credits_allocated     INTEGER     NOT NULL DEFAULT 0 CHECK (credits_allocated >= 0),
  credits_refunded      INTEGER     NOT NULL DEFAULT 0 CHECK (credits_refunded >= 0),
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_daily_credit_usage UNIQUE (agency_user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user    ON daily_credit_usage(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_account ON daily_credit_usage(agency_account_number);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date    ON daily_credit_usage(usage_date);

DROP TRIGGER IF EXISTS trg_daily_credit_usage_updated_at ON daily_credit_usage;
CREATE TRIGGER trg_daily_credit_usage_updated_at
  BEFORE UPDATE ON daily_credit_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 6. credit_usage_combined VIEW
--    Joins all credit tables. Lookup key = UUID + account number.
--    agency name is fetched from public.users for display only.
-- =========================================================
DROP VIEW IF EXISTS credit_usage_combined;
CREATE VIEW credit_usage_combined AS
SELECT
  ac.agency_user_id,
  ac.agency_account_number,
  u.name            AS agency_display_name,   -- display only, NOT a lookup key
  ac.current_credits,
  ac.total_purchased,
  ac.total_allocated,
  ac.total_consumed,
  ac.monthly_credit_limit,
  -- Today's aggregated figures
  COALESCE(dcu.credits_used,      0) AS today_credits_used,
  COALESCE(dcu.credits_purchased, 0) AS today_credits_purchased,
  COALESCE(dcu.credits_allocated, 0) AS today_credits_allocated,
  -- Per-service breakdown for today (JSONB array)
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'service',      cubs.service_name,
          'credits_used', cubs.credits_used,
          'requests',     cubs.request_count
        ) ORDER BY cubs.credits_used DESC
      )
      FROM credit_usage_by_service cubs
      WHERE cubs.agency_user_id = ac.agency_user_id
        AND cubs.usage_date     = CURRENT_DATE
    ),
    '[]'::jsonb
  ) AS today_usage_by_service,
  ac.created_at,
  ac.updated_at
FROM agency_credits ac
JOIN public.users u
  ON u.id = ac.agency_user_id
LEFT JOIN daily_credit_usage dcu
  ON  dcu.agency_user_id = ac.agency_user_id
  AND dcu.usage_date     = CURRENT_DATE;

-- =========================================================
-- 7. Row Level Security
-- =========================================================
ALTER TABLE agency_credits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage_by_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_credit_usage      ENABLE ROW LEVEL SECURITY;

-- agency_credits: agencies see their own row; super_admins see all
CREATE POLICY "agency_credits_own_row" ON agency_credits
  FOR SELECT USING (auth.uid() = agency_user_id);

CREATE POLICY "agency_credits_super_admin" ON agency_credits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- credit_transactions: user sees their own rows; super_admin sees all
CREATE POLICY "credit_txn_own_rows" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = agency_user_id);

CREATE POLICY "credit_txn_super_admin" ON credit_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- credit_usage_by_service
CREATE POLICY "usage_by_svc_own_rows" ON credit_usage_by_service
  FOR SELECT USING (auth.uid() = agency_user_id);

CREATE POLICY "usage_by_svc_super_admin" ON credit_usage_by_service
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- daily_credit_usage
CREATE POLICY "daily_usage_own_rows" ON daily_credit_usage
  FOR SELECT USING (auth.uid() = agency_user_id);

CREATE POLICY "daily_usage_super_admin" ON daily_credit_usage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- =========================================================
-- 8. Helper functions for application code
-- =========================================================

-- Upsert daily roll-up (call whenever credits are consumed/purchased)
CREATE OR REPLACE FUNCTION upsert_daily_credit_usage(
  p_agency_user_id        UUID,
  p_agency_account_number VARCHAR(20),
  p_credits_used          INTEGER DEFAULT 0,
  p_credits_purchased     INTEGER DEFAULT 0,
  p_credits_allocated     INTEGER DEFAULT 0,
  p_credits_refunded      INTEGER DEFAULT 0,
  p_usage_date            DATE    DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_credit_usage (
    agency_user_id, agency_account_number, usage_date,
    credits_used, credits_purchased, credits_allocated, credits_refunded
  ) VALUES (
    p_agency_user_id, p_agency_account_number, p_usage_date,
    p_credits_used, p_credits_purchased, p_credits_allocated, p_credits_refunded
  )
  ON CONFLICT (agency_user_id, usage_date) DO UPDATE SET
    credits_used      = daily_credit_usage.credits_used      + EXCLUDED.credits_used,
    credits_purchased = daily_credit_usage.credits_purchased + EXCLUDED.credits_purchased,
    credits_allocated = daily_credit_usage.credits_allocated + EXCLUDED.credits_allocated,
    credits_refunded  = daily_credit_usage.credits_refunded  + EXCLUDED.credits_refunded,
    updated_at        = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert per-service usage (call per API/service call that consumes credits)
CREATE OR REPLACE FUNCTION upsert_credit_usage_by_service(
  p_agency_user_id        UUID,
  p_agency_account_number VARCHAR(20),
  p_service_name          VARCHAR(100),
  p_credits_used          INTEGER DEFAULT 0,
  p_request_count         INTEGER DEFAULT 1,
  p_usage_date            DATE    DEFAULT CURRENT_DATE,
  p_metadata              JSONB   DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO credit_usage_by_service (
    agency_user_id, agency_account_number, service_name, usage_date,
    credits_used, request_count, metadata
  ) VALUES (
    p_agency_user_id, p_agency_account_number, p_service_name, p_usage_date,
    p_credits_used, p_request_count, p_metadata
  )
  ON CONFLICT (agency_user_id, service_name, usage_date) DO UPDATE SET
    credits_used  = credit_usage_by_service.credits_used  + EXCLUDED.credits_used,
    request_count = credit_usage_by_service.request_count + EXCLUDED.request_count,
    metadata      = credit_usage_by_service.metadata      || EXCLUDED.metadata,
    updated_at    = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
