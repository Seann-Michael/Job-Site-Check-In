-- Performance optimization: Add missing database indexes
-- This migration adds indexes for commonly queried columns identified through code analysis

-- Businesses table indexes
-- These are frequently queried in BusinessService.listBusinesses
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_name_ci ON businesses(lower(name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_google_place_id ON businesses(google_place_id);

-- Projects table indexes  
-- These are frequently queried in ProjectService.listProjects
CREATE INDEX IF NOT EXISTS idx_projects_business_id ON projects(business_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date);

-- Composite index for common business listing with ordering
CREATE INDEX IF NOT EXISTS idx_projects_business_created_at ON projects(business_id, created_at DESC);

-- Keywords table indexes (if keywords table exists)
-- These are frequently queried in KeywordService.listKeywords
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'keywords') THEN
        CREATE INDEX IF NOT EXISTS idx_keywords_business_id ON keywords(business_id);
        CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON keywords(created_at DESC);
        
        -- Full-text search index for keyword text searches
        CREATE INDEX IF NOT EXISTS idx_keywords_tsv ON keywords USING GIN (to_tsvector('english', keyword));
    END IF;
END
$$;

-- Users table indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email); -- Should already exist as unique
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- Reviews table indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviews') THEN
        CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
    END IF;
END
$$;

-- Local rankings table indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'local_rankings') THEN
        CREATE INDEX IF NOT EXISTS idx_local_rankings_business_id ON local_rankings(business_id);
        CREATE INDEX IF NOT EXISTS idx_local_rankings_keyword_id ON local_rankings(keyword_id);
        CREATE INDEX IF NOT EXISTS idx_local_rankings_created_at ON local_rankings(created_at DESC);
    END IF;
END
$$;

-- Project tasks table indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
        CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON project_tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_project_tasks_created_at ON project_tasks(created_at DESC);
    END IF;
END
$$;

-- Media files table indexes (common in media operations)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media_files') THEN
        CREATE INDEX IF NOT EXISTS idx_media_files_project_id ON media_files(project_id);
        CREATE INDEX IF NOT EXISTS idx_media_files_business_id ON media_files(business_id);
        CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);
    END IF;
END
$$;

-- Audit logs table indexes for tracking and reporting
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    END IF;
END
$$;

-- Sessions table indexes for authentication
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sessions') THEN
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    END IF;
END
$$;

-- Add comments for documentation
COMMENT ON INDEX idx_businesses_owner_id IS 'Index for efficient business listing by owner';
COMMENT ON INDEX idx_projects_business_id IS 'Index for efficient project listing by business';
COMMENT ON INDEX idx_projects_business_created_at IS 'Composite index for business projects ordered by creation date';

-- Create a function to analyze index usage (helpful for monitoring)
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
    table_name text,
    index_name text,
    index_scans bigint,
    tuples_read bigint,
    tuples_fetched bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        indexname as index_name,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_index_usage_stats() IS 'Function to monitor index usage for performance tuning';
