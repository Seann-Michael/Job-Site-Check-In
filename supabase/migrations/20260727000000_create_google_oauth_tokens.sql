-- Stores the business owner's Google OAuth token for the Business Profile
-- API (scope https://www.googleapis.com/auth/business.manage). The web app
-- writes this after the owner signs in with Google; the mobile app reads it
-- to manage the listing (profile, hours, posts, review replies).
--
-- Google Places is NOT used for listing management — only address
-- autocomplete and the public-view audit.

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'business_profile',
  business_id UUID,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  -- accounts/{accountId}/locations/{locationId}
  location_name TEXT,
  account_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_provider ON google_oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_business ON google_oauth_tokens(business_id);

ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens are credentials: authenticated app users only, never public.
CREATE POLICY "Authenticated read of google tokens" ON google_oauth_tokens
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert of google tokens" ON google_oauth_tokens
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update of google tokens" ON google_oauth_tokens
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete of google tokens" ON google_oauth_tokens
  FOR DELETE USING (auth.role() = 'authenticated');
