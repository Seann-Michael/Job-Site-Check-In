-- Create agency static configurations table
CREATE TABLE IF NOT EXISTS agency_static_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_token TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create client onboarding submissions table
CREATE TABLE IF NOT EXISTS client_onboarding_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_token TEXT NOT NULL,
    agency_config_id UUID REFERENCES agency_static_configs(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_company TEXT,
    client_phone TEXT,
    selected_platforms TEXT[] NOT NULL DEFAULT '{}',
    custom_platform_responses JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agency_static_configs_token ON agency_static_configs(agency_token);
CREATE INDEX IF NOT EXISTS idx_agency_static_configs_created_by ON agency_static_configs(created_by);
CREATE INDEX IF NOT EXISTS idx_client_submissions_agency_token ON client_onboarding_submissions(agency_token);
CREATE INDEX IF NOT EXISTS idx_client_submissions_email ON client_onboarding_submissions(client_email);
CREATE INDEX IF NOT EXISTS idx_client_submissions_status ON client_onboarding_submissions(status);
CREATE INDEX IF NOT EXISTS idx_client_submissions_submitted_at ON client_onboarding_submissions(submitted_at);

-- Add unique constraint to prevent duplicate submissions per agency/email
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_submissions_unique 
    ON client_onboarding_submissions(agency_token, client_email);

-- Enable RLS
ALTER TABLE agency_static_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency_static_configs
-- Agencies can only see/manage their own configurations
CREATE POLICY "Users can view their own agency configs" ON agency_static_configs
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own agency configs" ON agency_static_configs
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own agency configs" ON agency_static_configs
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own agency configs" ON agency_static_configs
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for client_onboarding_submissions
-- Agency users can see submissions for their configurations
CREATE POLICY "Agency users can view submissions for their configs" ON client_onboarding_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agency_static_configs 
            WHERE agency_static_configs.agency_token = client_onboarding_submissions.agency_token 
            AND agency_static_configs.created_by = auth.uid()
        )
    );

-- Agency users can update submissions for their configurations
CREATE POLICY "Agency users can update submissions for their configs" ON client_onboarding_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM agency_static_configs 
            WHERE agency_static_configs.agency_token = client_onboarding_submissions.agency_token 
            AND agency_static_configs.created_by = auth.uid()
        )
    );

-- No RLS policy for INSERT on client_onboarding_submissions since it's done via public API
-- The API handles validation instead

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agency_static_configs_updated_at 
    BEFORE UPDATE ON agency_static_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_submissions_updated_at 
    BEFORE UPDATE ON client_onboarding_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON agency_static_configs TO authenticated;
GRANT ALL ON client_onboarding_submissions TO authenticated;
GRANT SELECT ON agency_static_configs TO anon;  -- For public config lookup
GRANT INSERT ON client_onboarding_submissions TO anon;  -- For public submissions
