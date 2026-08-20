-- =====================================================================
-- W0 / 02 — clients: preserve the original name, split it only when certain
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   public.clients already HAS first_name, last_name and business_name — they
--   were added by the applied migration `add_client_name_fields`. They are
--   simply not populated, because everything writes the single `name` column.
--   mobile/src/lib/clients-store.ts writes all six fields, but the one live
--   row predates it.
--
--   So this migration adds NO name columns. It adds a place to keep the
--   original string, and it fills the three existing columns ONLY where the
--   answer is unambiguous.
--
-- WHAT IT DOES NOT DO
--   It does not guess. "Bob's Plumbing & Heating LLC" is a business, "Sarah
--   Chen" is a person, and "Chen Wei Ming" is neither obviously — the third
--   case is recorded as ambiguous in app.w0_backfill_report and LEFT ALONE.
--   Splitting names by whitespace is wrong for most of the world's naming
--   conventions; the only defensible automatic behaviour is to handle the
--   narrow certain cases and escalate the rest.
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 has run (app.w0_backfill_report, app.w0_series_log).
--   * public.clients exists with columns: id, name, first_name, last_name,
--     business_name (all text, all nullable except name).
--   * Exactly 1 live row. The logic is written to be correct at any scale.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/00: fails, app.w0_backfill_report does not exist.
--   After W0/03: harmless — W0/03's jobs->clients name matching reads
--   clients.name, which this file never modifies. Running this file AFTER the
--   client_id backfill is therefore also safe.
--
-- RE-RUNNABILITY
--   Fully re-runnable. The UPDATE is guarded on
--   (first_name IS NULL AND last_name IS NULL AND business_name IS NULL),
--   so a second run touches nothing it already classified. Report rows are
--   replaced, not appended, for the same step.
--
-- SAFETY: adds two nullable columns, updates only rows where all three name
--   columns are NULL. The original `name` string is never modified and is
--   additionally copied to legacy_full_name before anything else happens.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Somewhere to keep the truth.
-- ---------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS legacy_full_name  text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS name_split_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.clients'::regclass
       AND conname = 'clients_name_split_status_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_name_split_status_check
      CHECK (name_split_status IS NULL
             OR name_split_status IN ('person', 'business', 'ambiguous', 'manual'));
  END IF;
END $$;

COMMENT ON COLUMN public.clients.legacy_full_name IS
  'The exact contents of clients.name as it stood before W0/02 ran. Kept '
  'forever. If the split is ever found to be wrong, this is what you restore '
  'from.';

COMMENT ON COLUMN public.clients.name_split_status IS
  'How first_name/last_name/business_name were derived. '
  '''person''    = confidently split into a given/family name pair. '
  '''business''  = confidently a company; copied into business_name. '
  '''ambiguous'' = NOT split. A human must decide. See app.w0_backfill_report. '
  '''manual''    = set by a human or by the app, not by this migration.';

CREATE INDEX IF NOT EXISTS clients_name_split_status_idx
  ON public.clients (name_split_status)
  WHERE name_split_status = 'ambiguous';


-- ---------------------------------------------------------------------
-- 2. The classifier.
--
--    Deliberately conservative. It returns 'business', 'person' or
--    'ambiguous', and only the first two cause a write.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.classify_client_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s     text;
  parts text[];
BEGIN
  s := btrim(coalesce(p_name, ''));
  s := regexp_replace(s, '\s+', ' ', 'g');

  IF s = '' THEN
    RETURN 'ambiguous';
  END IF;

  -- Strong business markers. Word-boundary anchored so "Ford" does not match
  -- "for" and "Coventry" does not match " co ".
  IF s ~* '(^|[^[:alnum:]])(llc|l\.l\.c|inc|inc\.|incorporated|corp|corp\.|corporation|ltd|ltd\.|limited|co\.|company|group|holdings|enterprises|partners|associates|services|solutions|contracting|contractors|construction|plumbing|electric|electrical|roofing|landscaping|hvac|heating|cooling|paving|painting|cleaning|restoration|remodeling|properties|realty|management|pllc|llp|lp|gmbh|pty|s\.a|b\.v)($|[^[:alnum:]])'
  THEN
    RETURN 'business';
  END IF;

  -- Ampersands, slashes, plus signs and digits almost never appear in a
  -- personal name in this dataset but are common in trade names.
  IF s ~ '[&/+]' OR s ~ '[0-9]' THEN
    RETURN 'business';
  END IF;

  parts := regexp_split_to_array(s, ' ');

  -- The ONLY case we split: exactly two tokens, each purely alphabetic
  -- (allowing internal hyphen and apostrophe), each at least two characters.
  -- "Sarah Chen" yes. "J Smith" no. "Maria del Carmen Ruiz" no.
  IF array_length(parts, 1) = 2
     AND parts[1] ~ '^[[:alpha:]][[:alpha:]''\-]+$'
     AND parts[2] ~ '^[[:alpha:]][[:alpha:]''\-]+$'
  THEN
    RETURN 'person';
  END IF;

  -- A single token could be a mononym, a first name, or a one-word trade name
  -- ("Bosch"). Not decidable.
  RETURN 'ambiguous';
END $$;

COMMENT ON FUNCTION app.classify_client_name(text) IS
  'Conservative client-name classifier used by the W0/02 backfill. Returns '
  '''business'', ''person'' or ''ambiguous''. Three or more tokens are ALWAYS '
  'ambiguous: whitespace-splitting multi-token names mangles compound '
  'surnames, patronymics, and names where the family name comes first.';


-- ---------------------------------------------------------------------
-- 3. Preserve the original, unconditionally and first.
-- ---------------------------------------------------------------------
UPDATE public.clients
   SET legacy_full_name = name
 WHERE legacy_full_name IS DISTINCT FROM name
   AND legacy_full_name IS NULL;


-- ---------------------------------------------------------------------
-- 4. Classify and, where certain, populate.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r          record;
  verdict    text;
  s          text;
  parts      text[];
  n_person   integer := 0;
  n_business integer := 0;
  n_ambig    integer := 0;
BEGIN
  -- Clear this step's previous report rows so a re-run does not double up.
  DELETE FROM app.w0_backfill_report WHERE step = '02_clients_name_split';

  FOR r IN
    SELECT id, name
      FROM public.clients
     WHERE first_name    IS NULL
       AND last_name     IS NULL
       AND business_name IS NULL
  LOOP
    verdict := app.classify_client_name(r.name);

    IF verdict = 'person' THEN
      s     := regexp_replace(btrim(r.name), '\s+', ' ', 'g');
      parts := regexp_split_to_array(s, ' ');

      UPDATE public.clients
         SET first_name        = parts[1],
             last_name         = parts[2],
             name_split_status = 'person'
       WHERE id = r.id;

      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('02_clients_name_split', 'clients', r.id::text, 'applied',
              format('split %L into first_name=%L last_name=%L', r.name, parts[1], parts[2]));
      n_person := n_person + 1;

    ELSIF verdict = 'business' THEN
      UPDATE public.clients
         SET business_name     = btrim(r.name),
             name_split_status = 'business'
       WHERE id = r.id;

      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('02_clients_name_split', 'clients', r.id::text, 'applied',
              format('classified %L as a business name', r.name));
      n_business := n_business + 1;

    ELSE
      -- Touch nothing except the flag. This is the important branch.
      UPDATE public.clients
         SET name_split_status = 'ambiguous'
       WHERE id = r.id;

      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('02_clients_name_split', 'clients', r.id::text, 'ambiguous',
              format('left untouched: %L is not confidently a person or a business. '
                     'Set first_name/last_name/business_name by hand and then set '
                     'name_split_status = ''manual''.', r.name));
      n_ambig := n_ambig + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'W0/02 clients name split: % person, % business, % ambiguous (left alone)',
               n_person, n_business, n_ambig;

  IF n_ambig > 0 THEN
    RAISE NOTICE 'Review them with: SELECT * FROM app.w0_backfill_report '
                 'WHERE step = ''02_clients_name_split'' AND outcome = ''ambiguous'';';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 5. Useful lookup index for W0/03, which matches jobs to clients by name.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS clients_name_lower_idx
  ON public.clients (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS clients_business_name_lower_idx
  ON public.clients (lower(btrim(business_name)))
  WHERE business_name IS NOT NULL;

INSERT INTO app.w0_series_log (step, detail)
VALUES ('02_clients_name_split_backfill',
        'legacy_full_name + name_split_status added; conservative split applied '
        'only to rows where all three name columns were NULL. Ambiguous rows '
        'flagged, not guessed.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
