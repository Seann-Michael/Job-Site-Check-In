-- Create storage buckets for different types of media
-- Note: In Supabase, buckets need to be created via the dashboard or REST API
-- This file documents the required buckets and their configurations

-- Documentation: Required Storage Buckets
-- ==========================================

-- 1. MEDIA BUCKET (for general file uploads)
-- Bucket Name: media
-- Public: true (files should be publicly accessible)
-- Allowed MIME types: All
-- Max file size: 50MB
-- File size limit: 50MB
-- 
-- RLS Policies needed:
-- - Allow authenticated users to upload files
-- - Allow public read access to all files
-- - Allow users to delete their own uploaded files

-- 2. AVATARS BUCKET (for user profile pictures)
-- Bucket Name: avatars  
-- Public: true
-- Allowed MIME types: image/*
-- Max file size: 2MB
--
-- RLS Policies needed:
-- - Allow authenticated users to upload their own avatar
-- - Allow public read access
-- - Allow users to update/delete their own avatar

-- 3. PROJECT_ASSETS BUCKET (for project-specific files)
-- Bucket Name: project-assets
-- Public: false (private, requires signed URLs)
-- Allowed MIME types: All
-- Max file size: 100MB
--
-- RLS Policies needed:
-- - Allow project owners to upload files
-- - Allow project team members to read files
-- - Allow project owners to delete files

-- Create RLS policies for existing media bucket
-- (Assuming the 'media' bucket exists)

-- Policy: Allow authenticated users to upload files to media bucket
-- INSERT policy for media bucket
-- NOTE: These policies are applied via Supabase dashboard or Storage API

-- Example policies that would be applied via dashboard:
/*
-- For uploads (INSERT)
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' AND 
  auth.role() = 'authenticated'
);

-- For public read access (SELECT)
CREATE POLICY "Allow public downloads" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

-- For authenticated user deletes (DELETE)
CREATE POLICY "Allow user to delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'media' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
*/

-- Create a function to check if required buckets exist
CREATE OR REPLACE FUNCTION check_storage_buckets()
RETURNS TABLE(bucket_name TEXT, exists BOOLEAN, public_access BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest(ARRAY['media', 'avatars', 'project-assets']) as bucket_name,
    EXISTS(
      SELECT 1 FROM storage.buckets b 
      WHERE b.name = unnest(ARRAY['media', 'avatars', 'project-assets'])
    ) as exists,
    COALESCE(
      (SELECT b.public FROM storage.buckets b 
       WHERE b.name = unnest(ARRAY['media', 'avatars', 'project-assets'])), 
      false
    ) as public_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a helper function to generate storage URLs
CREATE OR REPLACE FUNCTION get_public_storage_url(bucket_name TEXT, file_path TEXT)
RETURNS TEXT AS $$
BEGIN
  -- This would be replaced with the actual Supabase URL in production
  RETURN format('https://your-project.supabase.co/storage/v1/object/public/%s/%s', bucket_name, file_path);
END;
$$ LANGUAGE plpgsql;

-- Update the media_files table to include bucket information
ALTER TABLE media_files 
ADD COLUMN IF NOT EXISTS bucket_name TEXT DEFAULT 'media';

-- Add constraint to ensure valid bucket names
ALTER TABLE media_files 
ADD CONSTRAINT valid_bucket_name 
CHECK (bucket_name IN ('media', 'avatars', 'project-assets'));

-- Create index on bucket_name for better performance
CREATE INDEX IF NOT EXISTS idx_media_files_bucket ON media_files(bucket_name);

-- Add comment for documentation
COMMENT ON COLUMN media_files.bucket_name IS 'Supabase storage bucket name where the file is stored';

-- Insert audit log entry for this migration
INSERT INTO audit_logs (
  table_name,
  operation,
  description,
  metadata,
  created_at
) VALUES (
  'system',
  'CUSTOM',
  'Storage bucket configuration updated',
  '{"migration": "002_setup_storage_buckets", "buckets": ["media", "avatars", "project-assets"]}',
  NOW()
);
