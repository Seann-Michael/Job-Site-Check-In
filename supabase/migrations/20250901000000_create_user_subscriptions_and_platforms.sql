-- Create user_subscriptions table to track active subscriptions per user
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  stripe_subscription_id VARCHAR(255),
  paypal_subscription_id VARCHAR(255),
  external_subscription_id VARCHAR(255),
  plan_id VARCHAR(255),
  status VARCHAR(50),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider ON user_subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- RLS: allow users to see their own subscriptions; admins can manage
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their subscriptions" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Users can manage their subscriptions" ON user_subscriptions
  FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Insert default platform configurations for payment providers if not present
INSERT INTO platform_configurations (platform, display_name, icon_url, description, scopes, is_enabled)
SELECT 'stripe', 'Stripe', '/icons/stripe.svg', 'Stripe payments and subscriptions', ARRAY[]::text[], true
WHERE NOT EXISTS (SELECT 1 FROM platform_configurations WHERE platform = 'stripe');

INSERT INTO platform_configurations (platform, display_name, icon_url, description, scopes, is_enabled)
SELECT 'paypal', 'PayPal', '/icons/paypal.svg', 'PayPal payments and subscriptions', ARRAY[]::text[], true
WHERE NOT EXISTS (SELECT 1 FROM platform_configurations WHERE platform = 'paypal');

INSERT INTO platform_configurations (platform, display_name, icon_url, description, scopes, is_enabled)
SELECT 'coinbase', 'Coinbase Commerce', '/icons/coinbase.svg', 'Coinbase Commerce charges', ARRAY[]::text[], true
WHERE NOT EXISTS (SELECT 1 FROM platform_configurations WHERE platform = 'coinbase');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_user_subscriptions_updated_at();
