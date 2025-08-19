-- Create client status enum
CREATE TYPE client_status AS ENUM ('prospect', 'active', 'inactive', 'cancelled');

-- Create activity type enum
CREATE TYPE activity_type AS ENUM ('note', 'call', 'email', 'meeting', 'task', 'geo_scan', 'project_update', 'payment', 'other');

-- Create CRM clients table
CREATE TABLE IF NOT EXISTS crm_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic client information
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    
    -- Address information
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'US',
    
    -- Business details
    industry TEXT,
    business_size TEXT, -- 'small', 'medium', 'large', 'enterprise'
    annual_revenue DECIMAL(15, 2),
    
    -- CRM fields
    status client_status DEFAULT 'prospect',
    lead_source TEXT,
    assigned_to UUID REFERENCES auth.users(id),
    
    -- Service details
    monthly_retainer DECIMAL(10, 2),
    services_provided TEXT[],
    contract_start_date DATE,
    contract_end_date DATE,
    
    -- Tracking
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create CRM activities table (notes, calls, emails, etc.)
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    activity_type activity_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Activity specific data
    activity_data JSONB DEFAULT '{}', -- Store type-specific data
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    is_important BOOLEAN DEFAULT FALSE,
    attachments TEXT[], -- File URLs or references
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create CRM tasks table
CREATE TABLE IF NOT EXISTS crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Task metadata
    task_type TEXT, -- 'seo_audit', 'content_creation', 'reporting', etc.
    estimated_hours DECIMAL(5, 2),
    actual_hours DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create relationship table linking clients to geo grid scans
CREATE TABLE IF NOT EXISTS crm_client_geo_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
    scan_id UUID, -- Reference to geo_grid_scans table
    scan_name TEXT NOT NULL,
    scan_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scan_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create client documents table
CREATE TABLE IF NOT EXISTS crm_client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    file_url TEXT NOT NULL,
    
    document_type TEXT, -- 'contract', 'proposal', 'report', 'invoice', etc.
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_clients_agency_user ON crm_clients(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_clients_status ON crm_clients(status);
CREATE INDEX IF NOT EXISTS idx_crm_clients_assigned_to ON crm_clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_clients_company_name ON crm_clients(company_name);
CREATE INDEX IF NOT EXISTS idx_crm_clients_next_follow_up ON crm_clients(next_follow_up_date);

CREATE INDEX IF NOT EXISTS idx_crm_activities_client_id ON crm_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user_id ON crm_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_client_id ON crm_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);

-- Enable RLS
ALTER TABLE crm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_client_geo_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_client_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_clients
-- Agency users can only see clients they created or are assigned to
CREATE POLICY "Agency users can view their clients" ON crm_clients
    FOR SELECT USING (
        auth.uid() = agency_user_id OR 
        auth.uid() = assigned_to
    );

CREATE POLICY "Agency users can create clients" ON crm_clients
    FOR INSERT WITH CHECK (auth.uid() = agency_user_id);

CREATE POLICY "Agency users can update their clients" ON crm_clients
    FOR UPDATE USING (
        auth.uid() = agency_user_id OR 
        auth.uid() = assigned_to
    );

CREATE POLICY "Agency users can delete their clients" ON crm_clients
    FOR DELETE USING (auth.uid() = agency_user_id);

-- RLS Policies for crm_activities
CREATE POLICY "Users can view activities for their clients" ON crm_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM crm_clients 
            WHERE crm_clients.id = crm_activities.client_id 
            AND (crm_clients.agency_user_id = auth.uid() OR crm_clients.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Users can create activities for their clients" ON crm_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM crm_clients 
            WHERE crm_clients.id = crm_activities.client_id 
            AND (crm_clients.agency_user_id = auth.uid() OR crm_clients.assigned_to = auth.uid())
        )
    );

-- Similar policies for other tables
CREATE POLICY "Users can view tasks for their clients" ON crm_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM crm_clients 
            WHERE crm_clients.id = crm_tasks.client_id 
            AND (crm_clients.agency_user_id = auth.uid() OR crm_clients.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Users can create tasks for their clients" ON crm_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM crm_clients 
            WHERE crm_clients.id = crm_tasks.client_id 
            AND (crm_clients.agency_user_id = auth.uid() OR crm_clients.assigned_to = auth.uid())
        )
    );

-- Add triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_crm_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_crm_clients_updated_at 
    BEFORE UPDATE ON crm_clients 
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at_column();

CREATE TRIGGER update_crm_activities_updated_at 
    BEFORE UPDATE ON crm_activities 
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at_column();

CREATE TRIGGER update_crm_tasks_updated_at 
    BEFORE UPDATE ON crm_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON crm_clients TO authenticated;
GRANT ALL ON crm_activities TO authenticated;
GRANT ALL ON crm_tasks TO authenticated;
GRANT ALL ON crm_client_geo_scans TO authenticated;
GRANT ALL ON crm_client_documents TO authenticated;
