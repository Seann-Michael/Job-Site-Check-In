-- Profiles and Onboarding schema

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  federal_domain TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_progress INTEGER DEFAULT 0,
  token_balance INTEGER DEFAULT 0,
  total_tokens_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding tasks
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  token_reward INTEGER DEFAULT 0,
  required BOOLEAN DEFAULT TRUE,
  order_sequence INTEGER,
  help_url TEXT,
  estimated_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User task progress
CREATE TABLE IF NOT EXISTS user_task_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  task_id UUID REFERENCES onboarding_tasks(id),
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')) DEFAULT 'not_started',
  completed_at TIMESTAMP WITH TIME ZONE,
  tokens_awarded INTEGER DEFAULT 0,
  skip_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- Tokens history for audit
CREATE TABLE IF NOT EXISTS tokens_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  task_id UUID REFERENCES onboarding_tasks(id),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can view own task progress" ON user_task_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert tokens_history for themselves" ON tokens_history
  FOR INSERT USING (auth.uid() = user_id);

-- Trigger to set timestamps
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();

CREATE OR REPLACE FUNCTION update_user_task_progress_created_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = COALESCE(NEW.created_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_task_progress_created_at BEFORE INSERT ON user_task_progress FOR EACH ROW EXECUTE FUNCTION update_user_task_progress_created_at();

-- Auto-create profile for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, federal_domain)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email LIKE '%.gov' OR NEW.email LIKE '%.mil' THEN split_part(NEW.email, '@', 2) ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
