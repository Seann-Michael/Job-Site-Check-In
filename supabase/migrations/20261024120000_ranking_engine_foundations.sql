-- Ranking-engine foundations
--
-- Supports four changes that turn stored-but-unused data into working features:
--
--   1. analytics       — a key the GBP insights sync can upsert on, so performance
--                        numbers accumulate as a dated series instead of being
--                        fetched and discarded.
--   2. gmb_audit_results — an index for "the newest scan", now that scans are kept
--                        as history rather than deleted on every run.
--   3. review_requests — the columns an automated, scheduled, multi-channel
--                        review request actually needs (email, channel, the job it
--                        came from, delivery outcome, follow-up timing).
--   4. sms_opt_outs    — a hard suppression list. STOP is a legal obligation under
--                        the TCPA, not a nicety, and it has to survive anything
--                        the sender does.
--
-- Idempotent throughout: safe to re-run.

-- ── 1. analytics: one row per (business, metric, day) ───────────────────────
-- business_id is nullable on this table, so the uniqueness is partial. Any
-- pre-existing duplicates are collapsed first, keeping the newest row, or the
-- index creation would fail on live data.
DELETE FROM public.analytics a
USING public.analytics b
WHERE a.business_id IS NOT NULL
  AND a.business_id = b.business_id
  AND a.metric_name = b.metric_name
  AND a.date = b.date
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

CREATE UNIQUE INDEX IF NOT EXISTS analytics_business_metric_date_key
  ON public.analytics (business_id, metric_name, date)
  WHERE business_id IS NOT NULL;

-- ── 2. gmb_audit_results: fetch the latest scan cheaply ────────────────────
CREATE INDEX IF NOT EXISTS gmb_audit_results_business_scanned_idx
  ON public.gmb_audit_results (business_id, scanned_at DESC);

-- ── 3. review_requests: what an automated request needs ────────────────────
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS channel        text NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS job_id         uuid,
  ADD COLUMN IF NOT EXISTS review_link    text,
  ADD COLUMN IF NOT EXISTS attempt_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error     text,
  ADD COLUMN IF NOT EXISTS twilio_sid     text,
  ADD COLUMN IF NOT EXISTS follow_up_after timestamp with time zone,
  ADD COLUMN IF NOT EXISTS follow_up_of   uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_requests_channel_check'
      AND conrelid = 'public.review_requests'::regclass
  ) THEN
    ALTER TABLE public.review_requests
      ADD CONSTRAINT review_requests_channel_check
      CHECK (channel = ANY (ARRAY['sms'::text, 'email'::text, 'manual'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_requests_job_id_fkey'
      AND conrelid = 'public.review_requests'::regclass
  ) THEN
    ALTER TABLE public.review_requests
      ADD CONSTRAINT review_requests_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_requests_follow_up_of_fkey'
      AND conrelid = 'public.review_requests'::regclass
  ) THEN
    ALTER TABLE public.review_requests
      ADD CONSTRAINT review_requests_follow_up_of_fkey
      FOREIGN KEY (follow_up_of) REFERENCES public.review_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- The scheduler claims due rows; this is the index it scans.
CREATE INDEX IF NOT EXISTS review_requests_due_idx
  ON public.review_requests (scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS review_requests_follow_up_due_idx
  ON public.review_requests (follow_up_after)
  WHERE follow_up_after IS NOT NULL;

-- ── 4. sms_opt_outs: a suppression list that outranks the sender ───────────
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id          uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  phone       text NOT NULL,
  reason      text NOT NULL DEFAULT 'stop_reply',
  source      text NOT NULL DEFAULT 'inbound_sms',
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sms_opt_outs_pkey' AND conrelid = 'public.sms_opt_outs'::regclass
  ) THEN
    ALTER TABLE public.sms_opt_outs ADD CONSTRAINT sms_opt_outs_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sms_opt_outs_business_id_fkey' AND conrelid = 'public.sms_opt_outs'::regclass
  ) THEN
    ALTER TABLE public.sms_opt_outs
      ADD CONSTRAINT sms_opt_outs_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- A number opts out once per business. Global opt-outs (business_id NULL) are
-- deduped by their own partial index, since NULL is never equal to NULL.
CREATE UNIQUE INDEX IF NOT EXISTS sms_opt_outs_business_phone_key
  ON public.sms_opt_outs (business_id, phone)
  WHERE business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sms_opt_outs_global_phone_key
  ON public.sms_opt_outs (phone)
  WHERE business_id IS NULL;

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'sms_opt_outs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sms_opt_outs', r.policyname);
  END LOOP;
END $$;

-- Readable by anyone who can read the business, so the UI can show "opted out"
-- next to a customer. Deliberately NOT writable from the client: an opt-out is
-- recorded by the server from Twilio's inbound webhook, and nothing in the app
-- should be able to delete one to resume messaging.
CREATE POLICY "sms_opt_outs_select" ON public.sms_opt_outs
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.can_read_business(business_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sms_opt_outs FROM authenticated, anon;
GRANT SELECT ON public.sms_opt_outs TO authenticated;

-- ── 5. notifications: business context for fan-out alerts ─────────────────
-- Rows stay per-user (the read flag is per-recipient); business_id is context
-- so a tenant can filter "alerts about this business", and so the review
-- watcher can tell whether it has already alerted on a given review.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS business_id uuid,
  ADD COLUMN IF NOT EXISTS dedupe_key  text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_business_id_fkey' AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- One alert per recipient per subject: the watcher is idempotent and can run
-- as often as it likes without re-notifying about the same review.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_business_created_idx
  ON public.notifications (business_id, created_at DESC)
  WHERE business_id IS NOT NULL;

-- ── 6. review_requests.status: the states the worker actually uses ─────────
-- The original check allowed only sent/viewed/scheduled/expired, so a claimed
-- ('sending'), failed, or opted-out request could not be written at all.
-- 'opted_out' is terminal and deliberately distinct from 'failed': the customer
-- declining is not a system error, and must never be retried.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_requests_status_check'
      AND conrelid = 'public.review_requests'::regclass
  ) THEN
    ALTER TABLE public.review_requests DROP CONSTRAINT review_requests_status_check;
  END IF;

  ALTER TABLE public.review_requests
    ADD CONSTRAINT review_requests_status_check
    CHECK (status = ANY (ARRAY[
      'sent'::text,
      'viewed'::text,
      'scheduled'::text,
      'sending'::text,
      'failed'::text,
      'opted_out'::text,
      'expired'::text
    ]));
END $$;
