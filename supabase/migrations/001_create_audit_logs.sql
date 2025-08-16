-- Create audit_logs table for tracking system changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'CUSTOM')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created ON audit_logs(table_name, created_at DESC);

-- Create media_files table for file storage metadata
CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  public_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for media_files
CREATE INDEX IF NOT EXISTS idx_media_files_project_id ON media_files(project_id);
CREATE INDEX IF NOT EXISTS idx_media_files_category ON media_files(category);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_at ON media_files(uploaded_at DESC);

-- Enable RLS (Row Level Security) on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit_logs
-- Admin users can see all logs
CREATE POLICY "Admin users can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Users can see their own logs
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Service role can insert audit logs (for backend operations)
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Enable RLS on media_files table
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for media_files
-- Users can see media files for their projects
CREATE POLICY "Users can view media files for their projects" ON media_files
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE business_id IN (
        SELECT id FROM businesses 
        WHERE owner_id = auth.uid()
      )
    )
  );

-- Users can upload media files to their projects
CREATE POLICY "Users can upload media files to their projects" ON media_files
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE business_id IN (
        SELECT id FROM businesses 
        WHERE owner_id = auth.uid()
      )
    )
  );

-- Users can delete their own media files
CREATE POLICY "Users can delete their own media files" ON media_files
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE business_id IN (
        SELECT id FROM businesses 
        WHERE owner_id = auth.uid()
      )
    )
  );

-- Create function to automatically log database changes
CREATE OR REPLACE FUNCTION log_database_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip logging for audit_logs table to prevent infinite recursion
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_logs (
    table_name,
    operation,
    user_id,
    old_values,
    new_values,
    description,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    TG_OP || ' operation on ' || TG_TABLE_NAME,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic audit logging on important tables
-- (Uncomment and customize based on which tables you want to audit)

-- CREATE TRIGGER audit_users_changes
--   AFTER INSERT OR UPDATE OR DELETE ON users
--   FOR EACH ROW EXECUTE FUNCTION log_database_changes();

-- CREATE TRIGGER audit_projects_changes
--   AFTER INSERT OR UPDATE OR DELETE ON projects
--   FOR EACH ROW EXECUTE FUNCTION log_database_changes();

-- CREATE TRIGGER audit_businesses_changes
--   AFTER INSERT OR UPDATE OR DELETE ON businesses
--   FOR EACH ROW EXECUTE FUNCTION log_database_changes();

-- Create function to clean up old audit logs (maintain 200 most recent)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete logs beyond the 200 most recent
  DELETE FROM audit_logs
  WHERE id NOT IN (
    SELECT id FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 200
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup daily (if pg_cron extension is available)
-- SELECT cron.schedule('audit-log-cleanup', '0 2 * * *', 'SELECT cleanup_old_audit_logs();');

-- Insert initial audit log entry to mark system setup
INSERT INTO audit_logs (
  table_name,
  operation,
  description,
  metadata,
  created_at
) VALUES (
  'system',
  'CUSTOM',
  'Audit log system initialized',
  '{"migration": "001_create_audit_logs", "version": "1.0.0"}',
  NOW()
);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Tracks all system changes and user actions for audit purposes';
COMMENT ON COLUMN audit_logs.table_name IS 'Name of the table that was changed or system event identifier';
COMMENT ON COLUMN audit_logs.operation IS 'Type of operation: INSERT, UPDATE, DELETE, SELECT, or CUSTOM';
COMMENT ON COLUMN audit_logs.user_id IS 'ID of the user who performed the action (NULL for system actions)';
COMMENT ON COLUMN audit_logs.old_values IS 'JSON representation of old values before change';
COMMENT ON COLUMN audit_logs.new_values IS 'JSON representation of new values after change';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context and metadata about the change';
COMMENT ON COLUMN audit_logs.description IS 'Human-readable description of the change';

COMMENT ON TABLE media_files IS 'Metadata for files stored in Supabase Storage';
COMMENT ON COLUMN media_files.storage_path IS 'Path to file in Supabase Storage bucket';
COMMENT ON COLUMN media_files.project_id IS 'Associated project (NULL for general files)';
COMMENT ON COLUMN media_files.category IS 'File category: general, project_photos, documents, etc.';
COMMENT ON COLUMN media_files.metadata IS 'Additional file metadata and processing information';
