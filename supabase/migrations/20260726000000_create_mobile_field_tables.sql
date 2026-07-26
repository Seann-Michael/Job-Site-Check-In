-- Tables backing the mobile app's field features: site-visit check-ins,
-- job notes, and shared client galleries. The mobile app writes these
-- best-effort and falls back to on-device storage when unavailable.

-- Site-visit check-ins (also powers "team on site" presence)
CREATE TABLE IF NOT EXISTS job_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Team member',
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_checkins_job_id ON job_checkins(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checkins_active ON job_checkins(checked_out_at) WHERE checked_out_at IS NULL;

ALTER TABLE job_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to job checkins" ON job_checkins FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access to job checkins" ON job_checkins FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow update access to job checkins" ON job_checkins FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Per-job notes feed
CREATE TABLE IF NOT EXISTS job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Team member',
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_notes_job_id ON job_notes(job_id);

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to job notes" ON job_notes FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access to job notes" ON job_notes FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow delete access to job notes" ON job_notes FOR DELETE USING (TRUE);

-- Shared client galleries (public links: /g/:token)
CREATE TABLE IF NOT EXISTS shared_galleries (
  token TEXT PRIMARY KEY,
  job_id UUID NOT NULL,
  job_title TEXT,
  business_name TEXT,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_galleries_job_id ON shared_galleries(job_id);

ALTER TABLE shared_galleries ENABLE ROW LEVEL SECURITY;
-- Public read: the whole point is a link a client can open with no login.
CREATE POLICY "Allow public read of shared galleries" ON shared_galleries FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access to shared galleries" ON shared_galleries FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow delete access to shared galleries" ON shared_galleries FOR DELETE USING (TRUE);
