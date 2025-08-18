-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'agency');
CREATE TYPE lead_status AS ENUM ('active', 'inactive', 'verified', 'duplicate');
CREATE TYPE scan_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- GMB Leads table
CREATE TABLE gmb_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_cid VARCHAR(50) UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(500),
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    category VARCHAR(255),
    rating DECIMAL(3, 2),
    review_count INTEGER DEFAULT 0,
    hours JSONB,
    attributes JSONB,
    photos TEXT[],
    description TEXT,
    verified BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE,
    data_completeness_score INTEGER DEFAULT 0,
    unlock_credits_cost INTEGER DEFAULT 5,
    status lead_status DEFAULT 'active',
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User credits table
CREATE TABLE user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_credits INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    monthly_allocation INTEGER DEFAULT 0,
    used_this_month INTEGER DEFAULT 0,
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Credit transactions table
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'allocation')),
    credits_amount INTEGER NOT NULL,
    description TEXT,
    lead_id UUID REFERENCES gmb_leads(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead unlocks table (tracks which leads users have unlocked)
CREATE TABLE lead_unlocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES gmb_leads(id) ON DELETE CASCADE,
    credits_spent INTEGER NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lead_id)
);

-- Geo grid scans table
CREATE TABLE geo_grid_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_name VARCHAR(255) NOT NULL,
    location_name VARCHAR(255),
    center_latitude DECIMAL(10, 8) NOT NULL,
    center_longitude DECIMAL(11, 8) NOT NULL,
    radius_km DECIMAL(6, 2) NOT NULL,
    grid_size INTEGER DEFAULT 20,
    business_types TEXT[],
    total_leads_found INTEGER DEFAULT 0,
    status scan_status DEFAULT 'pending',
    scan_parameters JSONB,
    results_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agency client assignments table
CREATE TABLE agency_client_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES gmb_leads(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_user_id, lead_id)
);

-- User profiles extension (add role and agency info)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'admin',
    agency_name VARCHAR(255),
    agency_id UUID REFERENCES auth.users(id),
    full_name VARCHAR(255),
    company VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_gmb_leads_google_cid ON gmb_leads(google_cid);
CREATE INDEX idx_gmb_leads_location ON gmb_leads(latitude, longitude);
CREATE INDEX idx_gmb_leads_category ON gmb_leads(category);
CREATE INDEX idx_gmb_leads_rating ON gmb_leads(rating);
CREATE INDEX idx_gmb_leads_status ON gmb_leads(status);
CREATE INDEX idx_gmb_leads_created_at ON gmb_leads(created_at);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);

CREATE INDEX idx_lead_unlocks_user_id ON lead_unlocks(user_id);
CREATE INDEX idx_lead_unlocks_lead_id ON lead_unlocks(lead_id);

CREATE INDEX idx_geo_grid_scans_user_id ON geo_grid_scans(user_id);
CREATE INDEX idx_geo_grid_scans_status ON geo_grid_scans(status);
CREATE INDEX idx_geo_grid_scans_location ON geo_grid_scans(center_latitude, center_longitude);

CREATE INDEX idx_agency_assignments_agency_user ON agency_client_assignments(agency_user_id);
CREATE INDEX idx_agency_assignments_client_user ON agency_client_assignments(client_user_id);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_agency_id ON user_profiles(agency_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_gmb_leads_updated_at BEFORE UPDATE ON gmb_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_geo_grid_scans_updated_at BEFORE UPDATE ON geo_grid_scans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE gmb_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_grid_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gmb_leads
CREATE POLICY "Super admins can manage all leads" ON gmb_leads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Admins and agencies can view leads" ON gmb_leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'agency')
        )
    );

-- RLS Policies for user_credits
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all credits" ON user_credits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- RLS Policies for credit_transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all transactions" ON credit_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- RLS Policies for lead_unlocks
CREATE POLICY "Users can view own unlocks" ON lead_unlocks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own unlocks" ON lead_unlocks
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for geo_grid_scans
CREATE POLICY "Users can manage own scans" ON geo_grid_scans
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all scans" ON geo_grid_scans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- RLS Policies for agency_client_assignments
CREATE POLICY "Agency users can manage their assignments" ON agency_client_assignments
    FOR ALL USING (
        agency_user_id = auth.uid() OR 
        client_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Super admins can manage all profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, role, full_name)
    VALUES (NEW.id, 'admin', COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    INSERT INTO public.user_credits (user_id, current_credits, monthly_allocation)
    VALUES (NEW.id, 100, 100);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
