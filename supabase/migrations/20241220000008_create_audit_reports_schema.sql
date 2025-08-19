-- Audit Reports Schema
-- This migration creates tables for storing technical SEO audit reports

-- Enum for audit status
CREATE TYPE audit_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Enum for audit type
CREATE TYPE audit_type AS ENUM ('on_page', 'off_page', 'comprehensive');

-- Main audit reports table
CREATE TABLE audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic report information
    website_url TEXT NOT NULL,
    report_title TEXT,
    audit_type audit_type NOT NULL DEFAULT 'comprehensive',
    status audit_status NOT NULL DEFAULT 'pending',
    
    -- Audit configuration
    audit_config JSONB DEFAULT '{}', -- Store audit parameters and settings
    
    -- Results and data
    on_page_results JSONB, -- DataForSEO on-page audit results
    off_page_results JSONB, -- DataForSEO off-page audit results
    technical_results JSONB, -- Technical audit results
    summary_metrics JSONB, -- Key metrics and scores
    
    -- Report sharing and access
    public_share_token UUID DEFAULT gen_random_uuid(),
    is_public BOOLEAN DEFAULT false,
    public_expiry_date TIMESTAMP WITH TIME ZONE,
    
    -- File references
    pdf_file_path TEXT, -- Path to generated PDF
    pdf_file_size INTEGER,
    
    -- Processing metadata
    dataforseo_task_id TEXT, -- DataForSEO task identifier
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_audit_reports_user_id ON audit_reports(user_id),
    INDEX idx_audit_reports_status ON audit_reports(status),
    INDEX idx_audit_reports_share_token ON audit_reports(public_share_token),
    INDEX idx_audit_reports_created_at ON audit_reports(created_at)
);

-- Detailed audit findings table
CREATE TABLE audit_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    
    -- Finding classification
    category TEXT NOT NULL, -- 'technical', 'content', 'performance', 'mobile', 'security', etc.
    subcategory TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    
    -- Finding details
    title TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    
    -- Technical details
    element_selector TEXT, -- CSS selector for the problematic element
    page_url TEXT, -- Specific page where issue was found
    line_number INTEGER, -- Line number in source code if applicable
    
    -- Metrics
    impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 100),
    fix_difficulty TEXT CHECK (fix_difficulty IN ('easy', 'medium', 'hard')),
    estimated_fix_time INTEGER, -- Estimated time to fix in minutes
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_audit_findings_report_id ON audit_findings(audit_report_id),
    INDEX idx_audit_findings_severity ON audit_findings(severity),
    INDEX idx_audit_findings_category ON audit_findings(category)
);

-- Audit pages table (for tracking individual pages analyzed)
CREATE TABLE audit_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    
    -- Page information
    url TEXT NOT NULL,
    title TEXT,
    meta_description TEXT,
    
    -- SEO metrics
    title_length INTEGER,
    meta_description_length INTEGER,
    h1_count INTEGER,
    h2_count INTEGER,
    h3_count INTEGER,
    images_count INTEGER,
    images_without_alt INTEGER,
    internal_links_count INTEGER,
    external_links_count INTEGER,
    
    -- Performance metrics
    page_size_bytes INTEGER,
    load_time_ms INTEGER,
    
    -- Technical metrics
    status_code INTEGER,
    response_time_ms INTEGER,
    
    -- Content analysis
    word_count INTEGER,
    reading_time_minutes DECIMAL(5,2),
    
    -- Additional data from DataForSEO
    dataforseo_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_audit_pages_report_id ON audit_pages(audit_report_id),
    INDEX idx_audit_pages_status_code ON audit_pages(status_code)
);

-- Audit keywords table (for tracking keyword performance)
CREATE TABLE audit_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    
    -- Keyword information
    keyword TEXT NOT NULL,
    search_volume INTEGER,
    keyword_difficulty INTEGER,
    cpc DECIMAL(10,2),
    
    -- Ranking information
    current_position INTEGER,
    previous_position INTEGER,
    best_position INTEGER,
    ranking_url TEXT,
    
    -- Competition analysis
    top_competitors JSONB, -- Array of competitor URLs and their positions
    
    -- Additional metrics
    click_through_rate DECIMAL(5,2),
    impressions INTEGER,
    clicks INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_audit_keywords_report_id ON audit_keywords(audit_report_id),
    INDEX idx_audit_keywords_position ON audit_keywords(current_position)
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audit_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating updated_at
CREATE TRIGGER trigger_audit_reports_updated_at
    BEFORE UPDATE ON audit_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_audit_reports_updated_at();

-- RLS Policies
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_keywords ENABLE ROW LEVEL SECURITY;

-- Policies for audit_reports
CREATE POLICY "Users can view their own audit reports" ON audit_reports
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (is_public = true AND (public_expiry_date IS NULL OR public_expiry_date > NOW()))
    );

CREATE POLICY "Users can create their own audit reports" ON audit_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audit reports" ON audit_reports
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audit reports" ON audit_reports
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for audit_findings
CREATE POLICY "Users can view findings for their reports" ON audit_findings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM audit_reports 
            WHERE audit_reports.id = audit_findings.audit_report_id 
            AND (
                audit_reports.user_id = auth.uid() OR 
                (audit_reports.is_public = true AND (audit_reports.public_expiry_date IS NULL OR audit_reports.public_expiry_date > NOW()))
            )
        )
    );

CREATE POLICY "Users can manage findings for their reports" ON audit_findings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM audit_reports 
            WHERE audit_reports.id = audit_findings.audit_report_id 
            AND audit_reports.user_id = auth.uid()
        )
    );

-- Similar policies for audit_pages and audit_keywords
CREATE POLICY "Users can view pages for their reports" ON audit_pages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM audit_reports 
            WHERE audit_reports.id = audit_pages.audit_report_id 
            AND (
                audit_reports.user_id = auth.uid() OR 
                (audit_reports.is_public = true AND (audit_reports.public_expiry_date IS NULL OR audit_reports.public_expiry_date > NOW()))
            )
        )
    );

CREATE POLICY "Users can manage pages for their reports" ON audit_pages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM audit_reports 
            WHERE audit_reports.id = audit_pages.audit_report_id 
            AND audit_reports.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view keywords for their reports" ON audit_keywords
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM audit_reports 
            WHERE audit_reports.id = audit_keywords.audit_report_id 
            AND (
                audit_reports.user_id = auth.uid() OR 
                (audit_reports.is_public = true AND (audit_reports.public_expiry_date IS NULL OR audit_reports.public_expiry_date > NOW()))
            )
        )
    );

CREATE POLICY "Users can manage keywords for their reports" ON audit_keywords
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM audit_reports 
            WHERE audit_reports.id = audit_keywords.audit_report_id 
            AND audit_reports.user_id = auth.uid()
        )
    );

-- Function to generate public share URL
CREATE OR REPLACE FUNCTION generate_public_share_url(report_id UUID)
RETURNS TEXT AS $$
DECLARE
    share_token UUID;
BEGIN
    SELECT public_share_token INTO share_token
    FROM audit_reports
    WHERE id = report_id;
    
    IF share_token IS NULL THEN
        RAISE EXCEPTION 'Report not found or no share token available';
    END IF;
    
    RETURN 'https://yourdomain.com/public/audit-report/' || share_token::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
