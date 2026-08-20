-- Server-side storage for Google Business Profile OAuth tokens.
-- Written by the Express server (service role) from
-- /api/oauth/google_my_business/callback. Refresh tokens never reach the
-- browser.
--
-- NOTE: an older, never-applied migration (20260727000000_create_google_oauth_tokens.sql)
-- declares a different shape with permissive "authenticated" policies. This
-- migration is written to converge either state: it creates the table if
-- missing, adds any missing columns, and drops those permissive policies.
-- RLS is ENABLED with NO policies: only the service role can read or write.

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      text,
  user_id           uuid,
  business_id       uuid,
  google_account_id text NOT NULL,
  email             text,
  access_token      text NOT NULL,
  refresh_token     text,
  expires_at        timestamptz,
  scopes            text[] NOT NULL DEFAULT '{}'::text[],
  locations         jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Converge the older shape if it was applied first.
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS workspace_id      text;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS user_id           uuid;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS business_id       uuid;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS google_account_id text;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS email             text;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS access_token      text;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS refresh_token     text;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS expires_at        timestamptz;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS scopes            text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS locations         jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.google_oauth_tokens ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- workspace_id may be NULL; NULLS NOT DISTINCT keeps the upsert deterministic.
CREATE UNIQUE INDEX IF NOT EXISTS google_oauth_tokens_workspace_account_uidx
  ON public.google_oauth_tokens (workspace_id, google_account_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS google_oauth_tokens_user_idx     ON public.google_oauth_tokens (user_id);
CREATE INDEX IF NOT EXISTS google_oauth_tokens_business_idx ON public.google_oauth_tokens (business_id);

ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read of google tokens"   ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Authenticated insert of google tokens" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Authenticated update of google tokens" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Authenticated delete of google tokens" ON public.google_oauth_tokens;

REVOKE ALL ON public.google_oauth_tokens FROM anon, authenticated;

COMMENT ON TABLE public.google_oauth_tokens IS
  'Google OAuth tokens (GBP). Service-role only: RLS enabled, no policies.';
