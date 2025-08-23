-- Chat Database Schema for Local SEO Ranker
-- Run this SQL in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create chat_channels table
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  channel_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (channel_type IN ('text', 'direct_message')),
  category VARCHAR(50) DEFAULT 'General',
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  company_id UUID,
  agency_id UUID,
  
  -- Unique constraint for DM channels
  CONSTRAINT unique_dm_channels UNIQUE NULLS NOT DISTINCT (name, channel_type, company_id, agency_id)
);

-- Create chat_channel_participants table
CREATE TABLE IF NOT EXISTS chat_channel_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  is_muted BOOLEAN DEFAULT false,
  notification_settings JSONB DEFAULT '{"mentions": true, "all_messages": true}',
  
  UNIQUE(channel_id, user_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  parent_message_id UUID REFERENCES chat_messages(id), -- For threads
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}', -- For file attachments, links, etc.
  
  -- Add index for performance
  INDEX idx_messages_channel_created (channel_id, created_at),
  INDEX idx_messages_user (user_id),
  INDEX idx_messages_parent (parent_message_id)
);

-- Create chat_message_reactions table
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(message_id, user_id, emoji)
);

-- Create chat_user_presence table
CREATE TABLE IF NOT EXISTS chat_user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_typing_in_channel UUID REFERENCES chat_channels(id),
  custom_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create chat_notifications table
CREATE TABLE IF NOT EXISTS chat_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) DEFAULT 'message' CHECK (notification_type IN ('message', 'mention', 'dm')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_notifications_user_unread (user_id, is_read, created_at)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_chat_channels_updated_at BEFORE UPDATE ON chat_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_user_presence_updated_at BEFORE UPDATE ON chat_user_presence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_channels
CREATE POLICY "Users can view channels they participate in" ON chat_channels
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM chat_channel_participants WHERE channel_id = id
    )
  );

CREATE POLICY "Users can create channels" ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel admins can update channels" ON chat_channels
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM chat_channel_participants 
      WHERE channel_id = id AND role IN ('admin', 'moderator')
    )
  );

-- RLS Policies for chat_channel_participants
CREATE POLICY "Users can view participants in their channels" ON chat_channel_participants
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM chat_channel_participants WHERE channel_id = chat_channel_participants.channel_id
    )
  );

CREATE POLICY "Users can join channels" ON chat_channel_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" ON chat_channel_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their channels" ON chat_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM chat_channel_participants WHERE channel_id = chat_messages.channel_id
    )
  );

CREATE POLICY "Users can create messages in their channels" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() IN (
      SELECT user_id FROM chat_channel_participants WHERE channel_id = chat_messages.channel_id
    )
  );

CREATE POLICY "Users can update their own messages" ON chat_messages
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for chat_message_reactions
CREATE POLICY "Users can view reactions in their channels" ON chat_message_reactions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM chat_channel_participants 
      WHERE channel_id = (SELECT channel_id FROM chat_messages WHERE id = message_id)
    )
  );

CREATE POLICY "Users can manage their own reactions" ON chat_message_reactions
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for chat_user_presence
CREATE POLICY "Users can view presence of users in their channels" ON chat_user_presence
  FOR SELECT USING (
    user_id IN (
      SELECT DISTINCT cp.user_id 
      FROM chat_channel_participants cp
      WHERE cp.channel_id IN (
        SELECT channel_id FROM chat_channel_participants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own presence" ON chat_user_presence
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for chat_notifications
CREATE POLICY "Users can view their own notifications" ON chat_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Insert default channels for companies
INSERT INTO chat_channels (name, description, channel_type, category, is_private) VALUES
  ('general', 'General discussion for the team', 'text', 'Company', false),
  ('announcements', 'Important company announcements', 'text', 'Company', false),
  ('project-updates', 'Updates on current projects', 'text', 'Work', false),
  ('team-discussion', 'Casual team conversations', 'text', 'Work', false),
  ('client-feedback', 'Client feedback and reviews', 'text', 'Clients', false)
ON CONFLICT DO NOTHING;

-- Function to automatically add users to default channels
CREATE OR REPLACE FUNCTION add_user_to_default_channels()
RETURNS TRIGGER AS $$
BEGIN
  -- Add user to default public channels
  INSERT INTO chat_channel_participants (channel_id, user_id, role)
  SELECT id, NEW.id, 'member'
  FROM chat_channels 
  WHERE is_private = false AND channel_type = 'text'
  ON CONFLICT DO NOTHING;
  
  -- Initialize user presence
  INSERT INTO chat_user_presence (user_id, status)
  VALUES (NEW.id, 'offline')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to add new users to default channels
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION add_user_to_default_channels();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_unread ON chat_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_channel_participants_user ON chat_channel_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_participants_channel ON chat_channel_participants(channel_id);

-- Grant necessary permissions (run as supabase_admin)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMENT ON TABLE chat_channels IS 'Chat channels for team communication';
COMMENT ON TABLE chat_messages IS 'Messages sent in chat channels';
COMMENT ON TABLE chat_channel_participants IS 'Users participating in chat channels';
COMMENT ON TABLE chat_user_presence IS 'Real-time user presence and status';
COMMENT ON TABLE chat_notifications IS 'Unread message notifications for users';
