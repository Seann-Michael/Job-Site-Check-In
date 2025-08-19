-- Enhanced Credit Allocation System
-- This migration adds support for automatic monthly credit allocations
-- and ensures admin purchases are always billed directly to the admin

-- Add columns to track monthly allocation processing
ALTER TABLE admin_agency_billing_relationships 
ADD COLUMN last_allocation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN next_allocation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN auto_allocate_enabled BOOLEAN DEFAULT true,
ADD COLUMN allocation_day_of_month INTEGER DEFAULT 1 CHECK (allocation_day_of_month >= 1 AND allocation_day_of_month <= 28);

-- Create index for efficient allocation processing
CREATE INDEX idx_billing_relationships_next_allocation 
ON admin_agency_billing_relationships(next_allocation_date) 
WHERE status = 'active' AND auto_allocate_enabled = true AND monthly_credit_allocation > 0;

-- Table to track all credit allocations (both manual and automatic)
CREATE TABLE credit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES admin_agency_billing_relationships(id) ON DELETE CASCADE,
    agency_user_id UUID NOT NULL REFERENCES auth.users(id),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Allocation details
    credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
    allocation_type VARCHAR(20) NOT NULL CHECK (allocation_type IN ('manual', 'monthly_auto', 'bonus')),
    allocation_reason TEXT,
    
    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'cancelled')),
    processed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    
    -- Billing information
    cost_per_credit_cents INTEGER DEFAULT 0, -- Cost agency pays per credit (if any)
    total_cost_cents INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id), -- Who initiated the allocation
    
    -- Indexes
    INDEX idx_credit_allocations_relationship ON credit_allocations(relationship_id),
    INDEX idx_credit_allocations_status ON credit_allocations(status),
    INDEX idx_credit_allocations_type ON credit_allocations(allocation_type),
    INDEX idx_credit_allocations_created_at ON credit_allocations(created_at)
);

-- Table to ensure admin purchases are always billed to admin
CREATE TABLE admin_purchase_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    purchase_session_id VARCHAR(255), -- Stripe session ID or similar
    override_reason VARCHAR(50) NOT NULL DEFAULT 'admin_direct_purchase',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    INDEX idx_admin_purchase_overrides_user ON admin_purchase_overrides(admin_user_id),
    INDEX idx_admin_purchase_overrides_session ON admin_purchase_overrides(purchase_session_id)
);

-- Function to calculate next allocation date
CREATE OR REPLACE FUNCTION calculate_next_allocation_date(
    current_date TIMESTAMP WITH TIME ZONE,
    day_of_month INTEGER
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    next_month_date TIMESTAMP WITH TIME ZONE;
    target_day INTEGER;
BEGIN
    -- Start with the first day of next month
    next_month_date := date_trunc('month', current_date) + interval '1 month';
    
    -- Adjust day of month (ensure it's valid for the target month)
    target_day := LEAST(day_of_month, EXTRACT(DAY FROM (next_month_date + interval '1 month' - interval '1 day')));
    
    -- Set the target day
    next_month_date := next_month_date + interval '1 day' * (target_day - 1);
    
    RETURN next_month_date;
END;
$$ LANGUAGE plpgsql;

-- Function to process a single credit allocation
CREATE OR REPLACE FUNCTION process_credit_allocation(
    p_allocation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_allocation credit_allocations%ROWTYPE;
    v_relationship admin_agency_billing_relationships%ROWTYPE;
    v_agency_credits INTEGER;
BEGIN
    -- Get allocation details
    SELECT * INTO v_allocation 
    FROM credit_allocations 
    WHERE id = p_allocation_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found or already processed';
    END IF;
    
    -- Get relationship details
    SELECT * INTO v_relationship 
    FROM admin_agency_billing_relationships 
    WHERE id = v_allocation.relationship_id AND status = 'active';
    
    IF NOT FOUND THEN
        -- Mark allocation as failed
        UPDATE credit_allocations 
        SET status = 'failed', 
            failure_reason = 'Relationship not active',
            processed_at = now()
        WHERE id = p_allocation_id;
        RETURN FALSE;
    END IF;
    
    -- Check if agency has enough credits
    SELECT current_credits INTO v_agency_credits 
    FROM user_credits 
    WHERE user_id = v_allocation.agency_user_id;
    
    IF v_agency_credits < v_allocation.credits_amount THEN
        -- Mark allocation as failed
        UPDATE credit_allocations 
        SET status = 'failed', 
            failure_reason = 'Insufficient agency credits',
            processed_at = now()
        WHERE id = p_allocation_id;
        RETURN FALSE;
    END IF;
    
    -- Begin the transfer
    BEGIN
        -- Deduct credits from agency
        UPDATE user_credits 
        SET current_credits = current_credits - v_allocation.credits_amount,
            total_spent = total_spent + v_allocation.credits_amount
        WHERE user_id = v_allocation.agency_user_id;
        
        -- Add credits to admin (create record if doesn't exist)
        INSERT INTO user_credits (user_id, current_credits, total_purchased)
        VALUES (v_allocation.admin_user_id, v_allocation.credits_amount, 0)
        ON CONFLICT (user_id) 
        DO UPDATE SET current_credits = user_credits.current_credits + v_allocation.credits_amount;
        
        -- Mark allocation as processed
        UPDATE credit_allocations 
        SET status = 'processed', 
            processed_at = now()
        WHERE id = p_allocation_id;
        
        -- Record in billing history
        INSERT INTO admin_agency_billing_history (
            relationship_id,
            event_type,
            credits_transferred,
            initiated_by,
            metadata
        ) VALUES (
            v_allocation.relationship_id,
            CASE 
                WHEN v_allocation.allocation_type = 'monthly_auto' THEN 'monthly_allocation_processed'
                WHEN v_allocation.allocation_type = 'manual' THEN 'manual_allocation_processed'
                ELSE 'allocation_processed'
            END,
            v_allocation.credits_amount,
            v_allocation.created_by,
            jsonb_build_object(
                'allocation_id', p_allocation_id,
                'allocation_type', v_allocation.allocation_type,
                'allocation_reason', v_allocation.allocation_reason
            )
        );
        
        RETURN TRUE;
        
    EXCEPTION WHEN OTHERS THEN
        -- Mark allocation as failed
        UPDATE credit_allocations 
        SET status = 'failed', 
            failure_reason = SQLERRM,
            processed_at = now()
        WHERE id = p_allocation_id;
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create monthly allocations for all active relationships
CREATE OR REPLACE FUNCTION create_monthly_allocations()
RETURNS INTEGER AS $$
DECLARE
    v_relationship admin_agency_billing_relationships%ROWTYPE;
    v_allocation_id UUID;
    v_processed_count INTEGER := 0;
BEGIN
    -- Loop through all relationships that need monthly allocation
    FOR v_relationship IN 
        SELECT * FROM admin_agency_billing_relationships 
        WHERE status = 'active' 
        AND auto_allocate_enabled = true 
        AND monthly_credit_allocation > 0
        AND (next_allocation_date IS NULL OR next_allocation_date <= now())
    LOOP
        -- Create allocation record
        INSERT INTO credit_allocations (
            relationship_id,
            agency_user_id,
            admin_user_id,
            credits_amount,
            allocation_type,
            allocation_reason,
            created_by
        ) VALUES (
            v_relationship.id,
            v_relationship.agency_user_id,
            v_relationship.admin_user_id,
            v_relationship.monthly_credit_allocation,
            'monthly_auto',
            'Automated monthly allocation',
            v_relationship.agency_user_id
        ) RETURNING id INTO v_allocation_id;
        
        -- Process the allocation
        IF process_credit_allocation(v_allocation_id) THEN
            v_processed_count := v_processed_count + 1;
            
            -- Update the relationship's allocation dates
            UPDATE admin_agency_billing_relationships 
            SET last_allocation_date = now(),
                next_allocation_date = calculate_next_allocation_date(now(), allocation_day_of_month)
            WHERE id = v_relationship.id;
        END IF;
    END LOOP;
    
    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a manual credit allocation
CREATE OR REPLACE FUNCTION create_manual_allocation(
    p_relationship_id UUID,
    p_credits_amount INTEGER,
    p_allocation_reason TEXT DEFAULT NULL,
    p_initiated_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_relationship admin_agency_billing_relationships%ROWTYPE;
    v_allocation_id UUID;
BEGIN
    -- Verify relationship exists and is active
    SELECT * INTO v_relationship 
    FROM admin_agency_billing_relationships 
    WHERE id = p_relationship_id AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active relationship not found';
    END IF;
    
    -- Verify the initiator has permission (must be agency or super admin)
    IF p_initiated_by != v_relationship.agency_user_id THEN
        -- Check if super admin
        IF NOT EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = p_initiated_by AND role = 'super_admin'
        ) THEN
            RAISE EXCEPTION 'Permission denied: only agency or super admin can create allocations';
        END IF;
    END IF;
    
    -- Create allocation record
    INSERT INTO credit_allocations (
        relationship_id,
        agency_user_id,
        admin_user_id,
        credits_amount,
        allocation_type,
        allocation_reason,
        created_by
    ) VALUES (
        p_relationship_id,
        v_relationship.agency_user_id,
        v_relationship.admin_user_id,
        p_credits_amount,
        'manual',
        COALESCE(p_allocation_reason, 'Manual credit allocation'),
        p_initiated_by
    ) RETURNING id INTO v_allocation_id;
    
    -- Process the allocation immediately
    IF NOT process_credit_allocation(v_allocation_id) THEN
        RAISE EXCEPTION 'Failed to process credit allocation';
    END IF;
    
    RETURN v_allocation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure admin purchases are billed to admin
CREATE OR REPLACE FUNCTION ensure_admin_direct_billing(
    p_admin_user_id UUID,
    p_purchase_session_id VARCHAR(255) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Record the override to ensure this purchase is billed to admin
    INSERT INTO admin_purchase_overrides (
        admin_user_id,
        purchase_session_id,
        override_reason
    ) VALUES (
        p_admin_user_id,
        p_purchase_session_id,
        'admin_direct_purchase'
    );
    
    -- Log the override in billing history if there's an active relationship
    INSERT INTO admin_agency_billing_history (
        relationship_id,
        event_type,
        initiated_by,
        metadata
    )
    SELECT 
        r.id,
        'admin_direct_purchase_override',
        p_admin_user_id,
        jsonb_build_object(
            'purchase_session_id', p_purchase_session_id,
            'override_reason', 'admin_direct_purchase'
        )
    FROM admin_agency_billing_relationships r
    WHERE r.admin_user_id = p_admin_user_id 
    AND r.status = 'active'
    LIMIT 1;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize next allocation dates for existing relationships
UPDATE admin_agency_billing_relationships 
SET next_allocation_date = calculate_next_allocation_date(
    COALESCE(last_allocation_date, created_at), 
    allocation_day_of_month
)
WHERE status = 'active' 
AND auto_allocate_enabled = true 
AND monthly_credit_allocation > 0 
AND next_allocation_date IS NULL;

-- RLS Policies for new tables

-- Enable RLS
ALTER TABLE credit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_purchase_overrides ENABLE ROW LEVEL SECURITY;

-- Policies for credit_allocations
CREATE POLICY "Users can view their credit allocations" ON credit_allocations
    FOR SELECT USING (
        auth.uid() = agency_user_id OR 
        auth.uid() = admin_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "Agencies can create allocations for their relationships" ON credit_allocations
    FOR INSERT WITH CHECK (
        auth.uid() = agency_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "System can update allocation status" ON credit_allocations
    FOR UPDATE USING (
        auth.uid() = agency_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Policies for admin_purchase_overrides
CREATE POLICY "Admins can view their purchase overrides" ON admin_purchase_overrides
    FOR SELECT USING (
        auth.uid() = admin_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "Admins can create purchase overrides" ON admin_purchase_overrides
    FOR INSERT WITH CHECK (
        auth.uid() = admin_user_id OR
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Create a function to be called by a cron job (if using pg_cron)
-- This would typically be set up as: SELECT cron.schedule('monthly-allocations', '0 9 * * *', 'SELECT create_monthly_allocations();');
COMMENT ON FUNCTION create_monthly_allocations() IS 'Function to be called daily by cron job to process monthly credit allocations';
