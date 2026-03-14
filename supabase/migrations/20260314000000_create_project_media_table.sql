-- Create project_media table for unified storage of photos and videos
CREATE TABLE IF NOT EXISTS project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'document')) DEFAULT 'image',
  category TEXT CHECK (category IN ('before', 'after', 'progress', 'final', 'reference', 'general', 'walkthrough', 'demonstration')) DEFAULT 'general',
  description TEXT,
  geolocation JSONB,
  metadata JSONB,
  is_featured BOOLEAN DEFAULT FALSE,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC
);

-- Create indexes for better query performance
CREATE INDEX idx_project_media_project_id ON project_media(project_id);
CREATE INDEX idx_project_media_created_at ON project_media(created_at DESC);
CREATE INDEX idx_project_media_media_type ON project_media(media_type);
CREATE INDEX idx_project_media_is_featured ON project_media(is_featured);

-- Add RLS policies if using RLS
ALTER TABLE project_media ENABLE ROW LEVEL SECURITY;

-- Policy for read access
CREATE POLICY "Allow read access to project media" ON project_media
  FOR SELECT USING (TRUE);

-- Policy for insert access
CREATE POLICY "Allow insert access to project media" ON project_media
  FOR INSERT WITH CHECK (TRUE);

-- Policy for update access
CREATE POLICY "Allow update access to project media" ON project_media
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Policy for delete access
CREATE POLICY "Allow delete access to project media" ON project_media
  FOR DELETE USING (TRUE);
