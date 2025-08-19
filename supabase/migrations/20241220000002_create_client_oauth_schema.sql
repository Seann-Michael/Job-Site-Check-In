-- Create enum types for OAuth system
CREATE TYPE onboarding_status AS ENUM ('pending', 'in-progress', 'completed', 'expired');
CREATE TYPE platform_status AS ENUM ('not_connected', 'connecting', 'connected', 'error', 'revoked');
CREATE TYPE access_level AS ENUM ('read_only', 'full_management');

-- Onboarding Sessions table
CREATE TABLE onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    client_company VARCHAR(255),
    status onboarding_status DEFAULT 'pending',
    access_level access_level DEFAULT 'read_only',
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Branding configuration
    branding_config JSONB DEFAULT '{
        "logo_url": null,
        "primary_color": "#2563eb",
        "company_name": null
    }',
    
    -- Required platforms array
    required_platforms TEXT[] NOT NULL DEFAULT '{}',
    required_custom_platforms TEXT[] DEFAULT '{}',
    
    -- Connected platforms tracking
    connected_platforms JSONB DEFAULT '[]',
    
    -- Generated link details
    onboarding_token VARCHAR(255) UNIQUE NOT NULL,
    link_clicks INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client Access table - stores actual OAuth tokens and permissions
CREATE TABLE client_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'google_ads', 'meta_ads', 'google_analytics', etc.
    
    -- OAuth tokens (encrypted)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Platform account information
    account_info JSONB NOT NULL DEFAULT '{}', -- { accountId, accountName, email, etc. }
    
    -- Permissions granted
    permissions TEXT[] DEFAULT '{}',
    scopes TEXT[] DEFAULT '{}',
    
    -- Status tracking
    status platform_status DEFAULT 'not_connected',
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, platform)
);

-- OAuth Activity Log table
CREATE TABLE oauth_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
    platform VARCHAR(50),
    event_type VARCHAR(50) NOT NULL, -- 'oauth_started', 'oauth_success', 'oauth_error', 'token_refresh', etc.
    event_data JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom Platforms table (agency-created platforms)
CREATE TABLE custom_platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    fields JSONB NOT NULL DEFAULT '[]',
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom Platform Responses table (client responses to custom fields)
CREATE TABLE custom_platform_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
    custom_platform_id UUID NOT NULL REFERENCES custom_platforms(id) ON DELETE CASCADE,
    field_responses JSONB NOT NULL DEFAULT '{}',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, custom_platform_id)
);

-- Platform Configuration table (for managing OAuth app credentials)
CREATE TABLE platform_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    icon_url VARCHAR(500),
    description TEXT,
    
    -- OAuth configuration
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    auth_url VARCHAR(500),
    token_url VARCHAR(500),
    scopes TEXT[] DEFAULT '{}',
    
    -- Platform specific settings
    configuration JSONB DEFAULT '{}',
    
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook Events table for tracking platform webhooks
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    account_id VARCHAR(255),
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_onboarding_sessions_agency_user ON onboarding_sessions(agency_user_id);
CREATE INDEX idx_onboarding_sessions_status ON onboarding_sessions(status);
CREATE INDEX idx_onboarding_sessions_token ON onboarding_sessions(onboarding_token);
CREATE INDEX idx_onboarding_sessions_expires ON onboarding_sessions(expires_at);

CREATE INDEX idx_client_access_session ON client_access(session_id);
CREATE INDEX idx_client_access_platform ON client_access(platform);
CREATE INDEX idx_client_access_status ON client_access(status);
CREATE INDEX idx_client_access_active ON client_access(is_active);

CREATE INDEX idx_oauth_activity_session ON oauth_activity_log(session_id);
CREATE INDEX idx_oauth_activity_platform ON oauth_activity_log(platform);
CREATE INDEX idx_oauth_activity_event ON oauth_activity_log(event_type);
CREATE INDEX idx_oauth_activity_created ON oauth_activity_log(created_at);

CREATE INDEX idx_platform_config_platform ON platform_configurations(platform);
CREATE INDEX idx_platform_config_enabled ON platform_configurations(is_enabled);

CREATE INDEX idx_webhook_events_platform ON webhook_events(platform);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);

CREATE INDEX idx_custom_platforms_agency_user ON custom_platforms(agency_user_id);
CREATE INDEX idx_custom_platforms_active ON custom_platforms(is_active);

CREATE INDEX idx_custom_platform_responses_session ON custom_platform_responses(session_id);
CREATE INDEX idx_custom_platform_responses_platform ON custom_platform_responses(custom_platform_id);

-- Add triggers for updated_at
CREATE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_access_updated_at BEFORE UPDATE ON client_access FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_platform_configurations_updated_at BEFORE UPDATE ON platform_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_platforms_updated_at BEFORE UPDATE ON custom_platforms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_platform_responses_updated_at BEFORE UPDATE ON custom_platform_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_sessions
CREATE POLICY "Agency users can manage their own onboarding sessions" ON onboarding_sessions
    FOR ALL USING (
        agency_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- RLS Policies for client_access
CREATE POLICY "Agency users can view their clients' access" ON client_access
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM onboarding_sessions 
            WHERE id = client_access.session_id 
            AND (agency_user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ))
        )
    );

CREATE POLICY "Agency users can update their clients' access" ON client_access
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM onboarding_sessions 
            WHERE id = client_access.session_id 
            AND agency_user_id = auth.uid()
        )
    );

-- RLS Policies for oauth_activity_log
CREATE POLICY "Agency users can view their activity logs" ON oauth_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM onboarding_sessions 
            WHERE id = oauth_activity_log.session_id 
            AND (agency_user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            ))
        )
    );

-- RLS Policies for platform_configurations
CREATE POLICY "All authenticated users can view platform configurations" ON platform_configurations
    FOR SELECT USING (auth.uid() IS NOT NULL AND is_enabled = TRUE);

CREATE POLICY "Super admins can manage platform configurations" ON platform_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- RLS Policies for webhook_events
CREATE POLICY "Super admins can manage webhook events" ON webhook_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Function to generate unique onboarding token
CREATE OR REPLACE FUNCTION generate_onboarding_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set onboarding token on insert
CREATE OR REPLACE FUNCTION set_onboarding_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.onboarding_token IS NULL OR NEW.onboarding_token = '' THEN
        NEW.onboarding_token = generate_onboarding_token();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set onboarding token
CREATE TRIGGER set_onboarding_sessions_token BEFORE INSERT ON onboarding_sessions FOR EACH ROW EXECUTE FUNCTION set_onboarding_token();

-- Function to log OAuth activity
CREATE OR REPLACE FUNCTION log_oauth_activity(
    p_session_id UUID,
    p_platform VARCHAR(50),
    p_event_type VARCHAR(50),
    p_event_data JSONB DEFAULT '{}',
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO oauth_activity_log (
        session_id,
        platform,
        event_type,
        event_data,
        user_agent,
        ip_address
    ) VALUES (
        p_session_id,
        p_platform,
        p_event_type,
        p_event_data,
        p_user_agent,
        p_ip_address
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default platform configurations
INSERT INTO platform_configurations (platform, display_name, icon_url, description, scopes) VALUES
('google_ads', 'Google Ads', '/icons/google-ads.svg', 'Manage Google Ads campaigns and view performance data', ARRAY['https://www.googleapis.com/auth/adwords']),
('meta_ads', 'Meta Ads', '/icons/meta-ads.svg', 'Manage Facebook and Instagram advertising campaigns', ARRAY['ads_management', 'ads_read', 'business_management']),
('google_analytics', 'Google Analytics', '/icons/google-analytics.svg', 'Access website analytics and reporting data', ARRAY['https://www.googleapis.com/auth/analytics.readonly']),
('google_search_console', 'Google Search Console', '/icons/google-search-console.svg', 'View search performance and indexing data', ARRAY['https://www.googleapis.com/auth/webmasters.readonly']),
('google_my_business', 'Google My Business', '/icons/google-my-business.svg', 'Manage business listings and customer reviews', ARRAY['https://www.googleapis.com/auth/business.manage']),
('tiktok_ads', 'TikTok Ads', '/icons/tiktok-ads.svg', 'Manage TikTok advertising campaigns', ARRAY['user.info.basic', 'advertiser.read']);

-- Function to update connected platforms in onboarding session
CREATE OR REPLACE FUNCTION update_connected_platforms()
RETURNS TRIGGER AS $$
DECLARE
    connected_list JSONB;
BEGIN
    -- Get current connected platforms for this session
    SELECT json_agg(
        json_build_object(
            'platform', platform,
            'status', status,
            'connected_at', COALESCE(
                (SELECT created_at FROM client_access ca2 WHERE ca2.session_id = NEW.session_id AND ca2.platform = client_access.platform AND ca2.status = 'connected' ORDER BY created_at DESC LIMIT 1),
                created_at
            ),
            'account_name', account_info->>'accountName',
            'account_id', account_info->>'accountId'
        )
    ) INTO connected_list
    FROM client_access 
    WHERE session_id = NEW.session_id;
    
    -- Update the onboarding session
    UPDATE onboarding_sessions 
    SET 
        connected_platforms = COALESCE(connected_list, '[]'::jsonb),
        updated_at = NOW()
    WHERE id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update connected platforms when client_access changes
CREATE TRIGGER update_session_connected_platforms 
    AFTER INSERT OR UPDATE ON client_access 
    FOR EACH ROW EXECUTE FUNCTION update_connected_platforms();
