-- Admin-Agency Billing Relationship Schema
-- This migration creates the necessary tables and logic for managing billing relationships
-- between admins and agencies, allowing either party to control billing arrangements

-- Enum for billing arrangement types
CREATE TYPE billing_arrangement AS ENUM (
    'admin_direct',     -- Admin pays directly for their own service
    'agency_sponsored', -- Agency pays for admin's service
    'agency_allocated'  -- Agency provides credit allocation to admin
);

-- Enum for relationship status
CREATE TYPE relationship_status AS ENUM (
    'active',           -- Active relationship
    'admin_ejected',    -- Admin ejected agency (admin now pays direct)
    'agency_ejected',   -- Agency ejected admin (admin must pay direct or lose access)
    'mutual_terminated',-- Both parties agreed to terminate
    'expired'          -- Relationship expired due to non-payment or other reasons
);

-- Admin-Agency billing relationships table
CREATE TABLE admin_agency_billing_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Billing arrangement details
    billing_arrangement billing_arrangement NOT NULL DEFAULT 'admin_direct',
    monthly_credit_allocation INTEGER DEFAULT 0, -- Credits agency allocates to admin per month
    billing_start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    billing_end_date TIMESTAMP WITH TIME ZONE, -- NULL for indefinite
    
    -- Relationship status and history
    status relationship_status NOT NULL DEFAULT 'active',
    created_by UUID NOT NULL REFERENCES auth.users(id), -- Who initiated the relationship
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    terminated_at TIMESTAMP WITH TIME ZONE,
    terminated_by UUID REFERENCES auth.users(id), -- Who terminated the relationship
    termination_reason TEXT,
    
    -- Billing metadata
    agency_billing_account_id VARCHAR(255), -- Reference to agency's Stripe customer ID
    admin_fallback_billing_id VARCHAR(255), -- Admin's fallback Stripe customer ID
    
    -- Constraints
    UNIQUE(admin_user_id, agency_user_id), -- One relationship per admin-agency pair
    CHECK (billing_end_date IS NULL OR billing_end_date > billing_start_date),
    CHECK (monthly_credit_allocation >= 0),
    CHECK (
        CASE 
            WHEN status IN ('admin_ejected', 'agency_ejected', 'mutual_terminated') 
            THEN terminated_at IS NOT NULL AND terminated_by IS NOT NULL
            ELSE TRUE
        END
    )
);

-- Index for performance
CREATE INDEX idx_admin_agency_billing_admin_id ON admin_agency_billing_relationships(admin_user_id);
CREATE INDEX idx_admin_agency_billing_agency_id ON admin_agency_billing_relationships(agency_user_id);
CREATE INDEX idx_admin_agency_billing_status ON admin_agency_billing_relationships(status);

-- Billing history table for tracking changes and transactions
CREATE TABLE admin_agency_billing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES admin_agency_billing_relationships(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'relationship_created', 'billing_changed', 'credits_allocated', 'payment_processed', 'relationship_terminated'
    previous_arrangement billing_arrangement,
    new_arrangement billing_arrangement,
    
    -- Financial details
    amount_cents INTEGER, -- Amount in cents for financial transactions
    credits_transferred INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_payment_intent_id VARCHAR(255),
    
    -- Event metadata
    initiated_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}', -- Additional flexible data
    
    -- Indexes
    INDEX idx_billing_history_relationship ON admin_agency_billing_history(relationship_id),
    INDEX idx_billing_history_event_type ON admin_agency_billing_history(event_type),
    INDEX idx_billing_history_created_at ON admin_agency_billing_history(created_at)
);

-- Admin billing preferences table
CREATE TABLE admin_billing_preferences (
    admin_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Billing preferences
    allow_agency_sponsorship BOOLEAN DEFAULT true, -- Admin allows agencies to pay for their service
    auto_accept_agency_invites BOOLEAN DEFAULT false, -- Auto-accept agency billing invitations
    fallback_to_direct_billing BOOLEAN DEFAULT true, -- Fallback to direct billing if agency relationship ends
    
    -- Notification preferences
    notify_billing_changes BOOLEAN DEFAULT true,
    notify_relationship_changes BOOLEAN DEFAULT true,
    notify_credit_allocations BOOLEAN DEFAULT true,
    
    -- Contact information for billing
    billing_email VARCHAR(255),
    billing_phone VARCHAR(20),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Agency billing settings table
CREATE TABLE agency_billing_settings (
    agency_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Billing capabilities
    can_sponsor_admins BOOLEAN DEFAULT true, -- Agency can pay for admin services
    max_sponsored_admins INTEGER DEFAULT 10, -- Maximum admins agency can sponsor
    monthly_admin_budget_cents INTEGER, -- Total monthly budget for sponsoring admins
    
    -- Auto-management settings
    auto_allocate_credits BOOLEAN DEFAULT false, -- Automatically allocate credits to sponsored admins
    default_monthly_allocation INTEGER DEFAULT 100, -- Default credits per admin per month
    auto_terminate_on_budget_exceeded BOOLEAN DEFAULT false, -- Auto-terminate sponsorships if budget exceeded
    
    -- Billing account
    stripe_customer_id VARCHAR(255), -- Agency's Stripe customer ID
    default_payment_method_id VARCHAR(255), -- Default payment method for admin sponsorships
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_admin_agency_billing_relationships_updated_at 
    BEFORE UPDATE ON admin_agency_billing_relationships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_billing_preferences_updated_at 
    BEFORE UPDATE ON admin_billing_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_billing_settings_updated_at 
    BEFORE UPDATE ON agency_billing_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle relationship termination
CREATE OR REPLACE FUNCTION terminate_admin_agency_relationship(
    p_relationship_id UUID,
    p_terminated_by UUID,
    p_termination_reason TEXT DEFAULT NULL,
    p_new_status relationship_status DEFAULT 'mutual_terminated'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_relationship admin_agency_billing_relationships%ROWTYPE;
    v_admin_id UUID;
    v_agency_id UUID;
BEGIN
    -- Get the relationship details
    SELECT * INTO v_relationship 
    FROM admin_agency_billing_relationships 
    WHERE id = p_relationship_id AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active relationship not found';
    END IF;
    
    v_admin_id := v_relationship.admin_user_id;
    v_agency_id := v_relationship.agency_user_id;
    
    -- Verify the terminator has permission
    IF p_terminated_by NOT IN (v_admin_id, v_agency_id) THEN
        RAISE EXCEPTION 'Only admin or agency can terminate the relationship';
    END IF;
    
    -- Update the relationship status
    UPDATE admin_agency_billing_relationships 
    SET 
        status = p_new_status,
        terminated_at = now(),
        terminated_by = p_terminated_by,
        termination_reason = p_termination_reason,
        billing_end_date = CASE 
            WHEN billing_end_date IS NULL OR billing_end_date > now() 
            THEN now() 
            ELSE billing_end_date 
        END
    WHERE id = p_relationship_id;
    
    -- Record in billing history
    INSERT INTO admin_agency_billing_history (
        relationship_id,
        event_type,
        previous_arrangement,
        new_arrangement,
        initiated_by,
        metadata
    ) VALUES (
        p_relationship_id,
        'relationship_terminated',
        v_relationship.billing_arrangement,
        'admin_direct', -- Admin defaults to direct billing after termination
        p_terminated_by,
        jsonb_build_object(
            'termination_reason', p_termination_reason,
            'terminated_status', p_new_status
        )
    );
    
    -- If agency ejected admin, immediately switch admin to direct billing
    IF p_new_status = 'agency_ejected' THEN
        -- This would integrate with the main billing system to switch payment method
        -- For now, we just record the intent
        INSERT INTO admin_agency_billing_history (
            relationship_id,
            event_type,
            new_arrangement,
            initiated_by,
            metadata
        ) VALUES (
            p_relationship_id,
            'billing_switched_to_direct',
            'admin_direct',
            v_admin_id,
            jsonb_build_object('reason', 'agency_ejection')
        );
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer credits between agency and admin
CREATE OR REPLACE FUNCTION transfer_credits_agency_to_admin(
    p_relationship_id UUID,
    p_credits_amount INTEGER,
    p_initiated_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_relationship admin_agency_billing_relationships%ROWTYPE;
    v_agency_credits INTEGER;
BEGIN
    -- Get the relationship details
    SELECT * INTO v_relationship 
    FROM admin_agency_billing_relationships 
    WHERE id = p_relationship_id AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active relationship not found';
    END IF;
    
    -- Check agency has enough credits
    SELECT current_credits INTO v_agency_credits 
    FROM user_credits 
    WHERE user_id = v_relationship.agency_user_id;
    
    IF v_agency_credits < p_credits_amount THEN
        RAISE EXCEPTION 'Agency does not have enough credits';
    END IF;
    
    -- Transfer credits
    UPDATE user_credits 
    SET current_credits = current_credits - p_credits_amount 
    WHERE user_id = v_relationship.agency_user_id;
    
    UPDATE user_credits 
    SET current_credits = current_credits + p_credits_amount 
    WHERE user_id = v_relationship.admin_user_id;
    
    -- Record the transfer in history
    INSERT INTO admin_agency_billing_history (
        relationship_id,
        event_type,
        credits_transferred,
        initiated_by,
        metadata
    ) VALUES (
        p_relationship_id,
        'credits_allocated',
        p_credits_amount,
        p_initiated_by,
        jsonb_build_object(
            'from_user', v_relationship.agency_user_id,
            'to_user', v_relationship.admin_user_id
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- Enable RLS on all tables
ALTER TABLE admin_agency_billing_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_agency_billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_billing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_billing_settings ENABLE ROW LEVEL SECURITY;

-- Policies for admin_agency_billing_relationships
CREATE POLICY "Users can view their own billing relationships" ON admin_agency_billing_relationships
    FOR SELECT USING (
        auth.uid() = admin_user_id OR 
        auth.uid() = agency_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "Users can update their own billing relationships" ON admin_agency_billing_relationships
    FOR UPDATE USING (
        auth.uid() = admin_user_id OR 
        auth.uid() = agency_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "Agencies and admins can create billing relationships" ON admin_agency_billing_relationships
    FOR INSERT WITH CHECK (
        (auth.uid() = admin_user_id AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin') OR
        (auth.uid() = agency_user_id AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'agency') OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Policies for admin_agency_billing_history
CREATE POLICY "Users can view their billing history" ON admin_agency_billing_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_agency_billing_relationships 
            WHERE id = relationship_id 
            AND (admin_user_id = auth.uid() OR agency_user_id = auth.uid())
        ) OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "Users can insert billing history" ON admin_agency_billing_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_agency_billing_relationships 
            WHERE id = relationship_id 
            AND (admin_user_id = auth.uid() OR agency_user_id = auth.uid())
        ) OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Policies for admin_billing_preferences
CREATE POLICY "Admins can manage their billing preferences" ON admin_billing_preferences
    FOR ALL USING (
        auth.uid() = admin_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Policies for agency_billing_settings
CREATE POLICY "Agencies can manage their billing settings" ON agency_billing_settings
    FOR ALL USING (
        auth.uid() = agency_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Insert default preferences for existing users
INSERT INTO admin_billing_preferences (admin_user_id)
SELECT id FROM user_profiles WHERE role = 'admin'
ON CONFLICT (admin_user_id) DO NOTHING;

INSERT INTO agency_billing_settings (agency_user_id)
SELECT id FROM user_profiles WHERE role = 'agency'
ON CONFLICT (agency_user_id) DO NOTHING;
