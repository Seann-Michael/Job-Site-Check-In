-- Second batch of mobile field tables: per-job workflow state (checklist
-- tasks + stars/groups/value/assignees) and per-photo comment threads.

-- One row per job holding the synced checklist and workflow metadata.
-- job_id is TEXT so the mobile app can sync before strict FK coupling.
CREATE TABLE IF NOT EXISTS job_field_state (
  job_id TEXT PRIMARY KEY,
  tasks JSONB,
  meta JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE job_field_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to job field state" ON job_field_state FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access to job field state" ON job_field_state FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow update access to job field state" ON job_field_state FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Photo/video comment threads with @mentions
CREATE TABLE IF NOT EXISTS media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Team member',
  comment TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_comments_media_id ON media_comments(media_id);

ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to media comments" ON media_comments FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert access to media comments" ON media_comments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow delete access to media comments" ON media_comments FOR DELETE USING (TRUE);
