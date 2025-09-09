-- Create tables for WordPress bulk page generator

-- Ensure pgcrypto is available for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wordpress connections table
CREATE TABLE wordpress_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site_url VARCHAR(1000) NOT NULL,
    site_name VARCHAR(255),
    api_key TEXT, -- encrypted on client side if desired; store as provided
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_wordpress_connections_user_id ON wordpress_connections(user_id);
CREATE INDEX idx_wordpress_connections_site_url ON wordpress_connections(site_url);

-- Page templates table
CREATE TABLE page_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- list of variable definitions { name, label, default }
    page_type VARCHAR(50) DEFAULT 'custom', -- 'service', 'location', 'combo', 'custom'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_page_templates_user_id ON page_templates(user_id);
CREATE INDEX idx_page_templates_page_type ON page_templates(page_type);

-- Bulk page generation jobs
CREATE TYPE bulk_job_status AS ENUM ('pending','processing','completed','failed','paused','canceled');

CREATE TABLE bulk_page_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES wordpress_connections(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES page_templates(id) ON DELETE SET NULL,
    status bulk_job_status DEFAULT 'pending',
    total_pages INTEGER DEFAULT 0,
    completed_pages INTEGER DEFAULT 0,
    result_summary JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}', -- scheduling, seo options, spinner options
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_bulk_page_jobs_user_id ON bulk_page_jobs(user_id);
CREATE INDEX idx_bulk_page_jobs_site_id ON bulk_page_jobs(site_id);
CREATE INDEX idx_bulk_page_jobs_status ON bulk_page_jobs(status);

-- Generated pages table
CREATE TABLE generated_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES bulk_page_jobs(id) ON DELETE CASCADE,
    page_title VARCHAR(1000) NOT NULL,
    page_slug VARCHAR(1000) NOT NULL,
    wordpress_post_id VARCHAR(255), -- remote post id returned from WP
    variables_used JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}', -- store raw response or status for troubleshooting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_generated_pages_job_id ON generated_pages(job_id);
CREATE INDEX idx_generated_pages_slug ON generated_pages(page_slug);

-- Use existing utility function to update updated_at if present
-- This project defines update_updated_at_column in previous migrations; rely on it

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        EXECUTE 'CREATE TRIGGER update_wordpress_connections_updated_at BEFORE UPDATE ON wordpress_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
        EXECUTE 'CREATE TRIGGER update_page_templates_updated_at BEFORE UPDATE ON page_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
        EXECUTE 'CREATE TRIGGER update_bulk_page_jobs_updated_at BEFORE UPDATE ON bulk_page_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
        EXECUTE 'CREATE TRIGGER update_generated_pages_updated_at BEFORE UPDATE ON generated_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;
END$$;

-- Enable Row Level Security and policies to restrict access to owners
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_page_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_pages ENABLE ROW LEVEL SECURITY;

-- Policy: allow users to manage their own wordpress_connections
CREATE POLICY "Users can manage their wordpress connections" ON wordpress_connections
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: templates ownership
CREATE POLICY "Users can manage their own templates" ON page_templates
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: bulk jobs ownership
CREATE POLICY "Users can manage their bulk jobs" ON bulk_page_jobs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: generated pages can be read/managed by job owner
CREATE POLICY "Users can read generated pages from their jobs" ON generated_pages
    FOR ALL
    USING (EXISTS (SELECT 1 FROM bulk_page_jobs WHERE bulk_page_jobs.id = generated_pages.job_id AND bulk_page_jobs.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM bulk_page_jobs WHERE bulk_page_jobs.id = generated_pages.job_id AND bulk_page_jobs.user_id = auth.uid()));

-- Add indexes for searching by created_at
CREATE INDEX idx_wordpress_connections_created_at ON wordpress_connections(created_at);
CREATE INDEX idx_page_templates_created_at ON page_templates(created_at);
CREATE INDEX idx_bulk_page_jobs_created_at ON bulk_page_jobs(created_at);
CREATE INDEX idx_generated_pages_created_at ON generated_pages(created_at);
