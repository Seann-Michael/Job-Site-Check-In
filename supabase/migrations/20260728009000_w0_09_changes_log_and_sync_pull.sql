-- =====================================================================
-- W0 / 09 — app.changes and sync_pull(): offline catch-up that cannot skip
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   Crews work with no signal. A device that has been offline needs to ask
--   "what changed since I last synced?" and get a complete answer.
--
--   The obvious implementation is a monotonically increasing id, or an
--   updated_at column, with the client remembering the highest value it saw.
--   BOTH ARE BROKEN, and they are broken in the same way.
--
--   Transactions do not commit in the order they take their sequence values
--   or read the clock. Consider:
--
--     T1 begins, inserts a row, gets id = 100          ... then stalls
--     T2 begins, inserts a row, gets id = 101, COMMITS
--     device syncs, sees id = 101, stores watermark 101
--     T1 finally COMMITS
--
--   Row 100 is now visible and permanently below the device's watermark. It
--   will never be delivered. The crew's checklist is silently missing an
--   item. This is not a rare race; it is the normal behaviour of a database
--   under concurrent load, and it is why "WHERE updated_at > $last" sync
--   loops lose data in production and nobody notices for months.
--
--   THE FIX, implemented below:
--     * every change row records its transaction id (xid8, 64-bit so it does
--       not wrap like the 32-bit xid);
--     * sync_pull only ever returns rows whose txid is strictly BELOW
--       pg_snapshot_xmin(pg_current_snapshot()) — the oldest transaction still
--       in flight;
--     * the new watermark it hands back is that same xmin.
--
--   Anything a still-running transaction will commit has a txid >= xmin, so
--   it is held back until that transaction finishes, and the watermark never
--   advances past it. Row 100 above is simply not returned yet, and the
--   watermark stays at T1's xid until T1 commits. Nothing is skipped, ever.
--   The cost is latency, not correctness: a long-running transaction delays
--   sync for everyone, which is the correct trade and is worth monitoring.
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * PostgreSQL 13 or later. xid8, pg_current_xact_id() and
--     pg_snapshot_xmin() were all added in 13. Supabase is well past that.
--   * W0/00 (app schema), W0/01 (app.current_company_ids) and W0/08
--     (company_id on every in-scope table) have run.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/08: the triggers still install, but every change row is logged
--     with company_id NULL and sync_pull cannot scope them. Re-run this file
--     after W0/08 — it is idempotent — or just apply in order.
--   Before W0/01: 42883 on app.current_company_ids().
--
-- SAFETY: adds one table and a set of AFTER triggers. Triggers add write
--   latency and storage. See the retention note in section 5 — this table
--   grows forever unless something prunes it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The log.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.changes (
  id           bigserial PRIMARY KEY,

  -- The whole point. 64-bit, so unlike xid it does not wrap around and make
  -- old rows compare as newer than new ones.
  txid         xid8 NOT NULL DEFAULT pg_current_xact_id(),

  company_id   uuid,
  table_schema text NOT NULL,
  table_name   text NOT NULL,
  row_id       text NOT NULL,
  op           text NOT NULL,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,
  payload      jsonb
);

ALTER TABLE app.changes ADD COLUMN IF NOT EXISTS actor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'app.changes'::regclass
                    AND conname = 'changes_op_check') THEN
    ALTER TABLE app.changes
      ADD CONSTRAINT changes_op_check CHECK (op IN ('insert', 'update', 'delete'));
  END IF;
END $$;

-- The index sync_pull actually uses: a range scan on txid, then company.
CREATE INDEX IF NOT EXISTS changes_txid_idx        ON app.changes (txid, id);
CREATE INDEX IF NOT EXISTS changes_company_txid_idx ON app.changes (company_id, txid, id);
CREATE INDEX IF NOT EXISTS changes_table_row_idx   ON app.changes (table_name, row_id);
CREATE INDEX IF NOT EXISTS changes_changed_at_idx  ON app.changes (changed_at);

COMMENT ON TABLE app.changes IS
  'Append-only change feed for offline sync. Ordered by txid, NOT by id or '
  'by changed_at: id comes from a sequence and changed_at from the clock, and '
  'neither reflects COMMIT order, so a watermark based on either silently '
  'skips rows committed out of order. See this migration''s header.';

COMMENT ON COLUMN app.changes.txid IS
  'pg_current_xact_id() of the writing transaction. sync_pull compares this '
  'against pg_snapshot_xmin(pg_current_snapshot()) to guarantee no row is '
  'ever handed out before every transaction that could still insert an '
  'earlier row has committed.';

COMMENT ON COLUMN app.changes.row_id IS
  'TEXT because primary keys in this schema are not uniformly uuid: '
  'shared_galleries is keyed on `token` and job_field_state on a TEXT job_id.';


-- ---------------------------------------------------------------------
-- 2. The trigger.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
DECLARE
  v_row     jsonb;
  v_company uuid;
  v_row_id  text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  -- Guarded: a table whose company_id is absent or malformed must not break
  -- the write it is logging.
  BEGIN
    IF TG_TABLE_NAME = 'companies' THEN
      -- companies is the tenant ROOT: it has no company_id column, so the
      -- generic path below would log every companies row with company_id NULL,
      -- forever. Combined with the old `company_id IS NULL OR ...` escape
      -- hatch in sync_pull, that handed every authenticated user of every
      -- tenant the full payload of every company — name, slug, owner_user_id
      -- and the whole settings blob. A company's own id IS its tenant.
      v_company := nullif(v_row ->> 'id', '')::uuid;
    ELSE
      v_company := nullif(v_row ->> 'company_id', '')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_company := NULL;
  END;

  -- Primary key by convention, in the order the tables in this schema use.
  v_row_id := coalesce(v_row ->> 'id', v_row ->> 'token', v_row ->> 'job_id', '?');

  INSERT INTO app.changes
    (txid, company_id, table_schema, table_name, row_id, op, actor_id, payload)
  VALUES
    (pg_current_xact_id(), v_company, TG_TABLE_SCHEMA, TG_TABLE_NAME,
     v_row_id, lower(TG_OP), app.current_user_id(), v_row);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

COMMENT ON FUNCTION app.log_change() IS
  'AFTER trigger writing to app.changes. SECURITY DEFINER so that a client '
  'which is allowed to write the row is also allowed to log it, without '
  'granting anyone direct access to the app schema.';


-- ---------------------------------------------------------------------
-- 3. Attach it to every table that opted in via app.w0_scope.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t       record;
  n       integer := 0;
BEGIN
  FOR t IN
    SELECT table_name FROM app.w0_scope WHERE log_changes ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      RAISE NOTICE 'W0/09: public.% missing — change trigger skipped', t.table_name;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                   'zz_log_change_' || t.table_name, t.table_name);
    -- Named zz_* so it sorts last: PostgreSQL fires triggers in name order,
    -- and the log should record the row as it ended up, after every BEFORE
    -- trigger has had its say.
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION app.log_change()',
      'zz_log_change_' || t.table_name, t.table_name);
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'W0/09: change-log trigger installed on % table(s)', n;
END $$;


-- ---------------------------------------------------------------------
-- 4. sync_pull.
--
--    Contract for the client:
--      1. call sync_pull(p_since => <stored watermark>)
--      2. apply every returned row, in the order returned
--      3. store the `watermark` column from the LAST row as the new watermark
--      4. if `has_more` is true, call again IMMEDIATELY with that watermark
--      5. if no rows come back, call sync_watermark() and store that instead
--
--    Never advance the watermark to anything other than a value this function
--    returned. In particular never use now() or max(id).
--
-- ============ WHY THE WATERMARK IS PER-ROW, NOT THE SNAPSHOT xmin ============
--    An earlier cut of this function returned `snap.xmin AS watermark` — the
--    SAME value on every row — while also applying a LIMIT. That combination
--    silently destroys data, which is the exact failure class this file's
--    header claims to eliminate:
--
--      600 rows satisfy p_since <= txid < xmin, and p_limit is 500.
--      The client applies 500 rows and, per the contract, stores the last
--      row's watermark — which is xmin, not that row's txid.
--      The next call filters `txid >= xmin`, and the 100 undelivered rows all
--      have txid < xmin. They are never delivered. Ever.
--
--    Returning each row's OWN txid is safe precisely because of the xmin
--    predicate below: everything strictly below xmin is committed, and the
--    ordering is by txid, so "resume at the last txid I saw" cannot skip a
--    sibling. The comparison is `>=`, not `>`, so rows sharing that txid are
--    re-delivered rather than dropped — the change feed is idempotent by
--    construction (each row carries table_name, row_id and the full payload),
--    so replaying a few rows is free and losing one is not.
--
--    `has_more` removes the guesswork entirely: a client that sees it true
--    knows the page was truncated and must call again before idling.
-- ===========================================================================

-- The return type changes (watermark semantics + has_more), and CREATE OR
-- REPLACE cannot change a function's result type. Drop first.
DROP FUNCTION IF EXISTS public.sync_pull(xid8, integer);

CREATE FUNCTION public.sync_pull(
  p_since xid8    DEFAULT '0'::xid8,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  id           bigint,
  txid         xid8,
  table_name   text,
  row_id       text,
  op           text,
  changed_at   timestamptz,
  payload      jsonb,
  watermark    xid8,
  has_more     boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
  WITH lim AS (
    SELECT greatest(1, least(coalesce(p_limit, 500), 5000)) AS n
  ),
  snap AS (
    SELECT pg_snapshot_xmin(pg_current_snapshot()) AS xmin
  ),
  page AS (
    -- One more than the page size, so truncation is detectable.
    SELECT c.*
      FROM app.changes c
     CROSS JOIN snap
     CROSS JOIN lim
     WHERE c.txid >= p_since
       -- THE LOAD-BEARING PREDICATE. Strictly less than xmin: anything at or
       -- above it belongs to a transaction that may still be running, and
       -- handing it out would let the watermark advance past a sibling row
       -- that has not committed yet.
       AND c.txid < snap.xmin
       -- NO `company_id IS NULL OR` ESCAPE HATCH. This function is SECURITY
       -- DEFINER and granted to `authenticated`, so it reads app.changes with
       -- no RLS — that clause was an unconditional cross-tenant read of every
       -- NULL-company row, and app.log_change() produced a permanent supply of
       -- them from public.companies. A row with no company belongs to no
       -- tenant and is returned to nobody.
       AND c.company_id = ANY (app.current_company_ids())
     ORDER BY c.txid, c.id
     LIMIT (SELECT n FROM lim) + 1
  )
  SELECT p.id,
         p.txid,
         p.table_name,
         p.row_id,
         p.op,
         p.changed_at,
         p.payload,
         -- PER ROW. Store the LAST one you applied.
         p.txid AS watermark,
         (SELECT count(*) FROM page) > (SELECT n FROM lim) AS has_more
    FROM page p
   ORDER BY p.txid, p.id
   LIMIT (SELECT n FROM lim);
$$;

COMMENT ON FUNCTION public.sync_pull(xid8, integer) IS
  'Offline catch-up. Returns changes with p_since <= txid < '
  'pg_snapshot_xmin(pg_current_snapshot()), ordered by txid, scoped strictly '
  'to the caller''s companies. Store the `watermark` of the LAST row you '
  'applied — it is that row''s OWN txid, not the snapshot bound, so a '
  'truncated page cannot make you skip the remainder. When `has_more` is '
  'true, call again with that watermark before idling. When no rows come '
  'back, store sync_watermark() instead.';

-- The "nothing changed" case still needs to advance the watermark, otherwise
-- an idle device re-scans the same range forever.
CREATE OR REPLACE FUNCTION public.sync_watermark()
RETURNS xid8
LANGUAGE sql
STABLE
AS $$
  SELECT pg_snapshot_xmin(pg_current_snapshot());
$$;

COMMENT ON FUNCTION public.sync_watermark() IS
  'The value a client should store when sync_pull returns no rows. Always '
  'safe: it is the same bound sync_pull filters on.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.sync_pull(xid8, integer) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.sync_watermark() TO authenticated';
  END IF;
  -- Deliberately NOT granted to anon. An unauthenticated caller gets an empty
  -- company list, but there is no reason to expose the feed at all.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.sync_pull(xid8, integer) FROM anon';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 5. Retention.
--
--    app.changes grows without limit. Pruning it is safe only for rows older
--    than the OLDEST watermark any device still holds — delete a row a
--    sleeping tablet has not seen and that tablet is permanently out of date
--    with no way to detect it.
--
--    The function below is therefore NOT scheduled by this migration. Wire it
--    to pg_cron only after you are tracking per-device watermarks and can
--    pass a genuinely safe cutoff.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.prune_changes(p_before_txid xid8)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE n bigint;
BEGIN
  IF p_before_txid IS NULL THEN
    RAISE EXCEPTION 'app.prune_changes requires an explicit cutoff txid. '
                    'There is no safe default: it must be below the oldest '
                    'watermark any device still holds.';
  END IF;

  DELETE FROM app.changes WHERE txid < p_before_txid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'app.prune_changes: removed % row(s) below txid %', n, p_before_txid;
  RETURN n;
END $$;

COMMENT ON FUNCTION app.prune_changes(xid8) IS
  'Deletes change rows below an explicitly supplied cutoff. Requires the '
  'cutoff argument on purpose — a default would eventually be applied to a '
  'device that had been offline longer than the default, silently desyncing '
  'it. NOT scheduled by any migration.';

-- ---------------------------------------------------------------------
-- 6. Repair any change rows logged by an earlier cut of this file.
--
--    Rows for public.companies were logged with company_id NULL, and
--    NULL-company rows are now returned to nobody — so without this they
--    would be invisible rather than merely un-leaked. Re-derive the tenant
--    from the payload. Idempotent.
-- ---------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  UPDATE app.changes
     SET company_id = nullif(payload ->> 'id', '')::uuid
   WHERE company_id IS NULL
     AND table_name = 'companies'
     AND nullif(payload ->> 'id', '') IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    RAISE NOTICE 'W0/09: re-scoped % companies change row(s) to their own id', n;
  END IF;

  SELECT count(*) INTO n FROM app.changes WHERE company_id IS NULL;
  IF n > 0 THEN
    RAISE WARNING 'W0/09: app.changes holds % row(s) with company_id IS NULL. '
                  'They are returned to NOBODY by sync_pull (which is the safe '
                  'direction), so any device that has not yet seen them never '
                  'will. Inspect with: SELECT table_name, count(*) FROM '
                  'app.changes WHERE company_id IS NULL GROUP BY 1;', n;
  END IF;
END $$;

INSERT INTO app.w0_series_log (step, detail)
VALUES ('09_changes_log_and_sync_pull',
        'app.changes (bigserial id + xid8 txid) with AFTER triggers on every '
        'table flagged log_changes in app.w0_scope; public.sync_pull() '
        'filtered on pg_snapshot_xmin so out-of-order commits cannot be '
        'skipped, returning a PER-ROW watermark plus has_more so a truncated '
        'page cannot make a client skip the remainder, and scoped strictly to '
        'the caller''s companies (the company_id IS NULL escape hatch is gone); '
        'companies change rows are scoped to their own id; sync_watermark() '
        'and an unscheduled prune_changes().')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
