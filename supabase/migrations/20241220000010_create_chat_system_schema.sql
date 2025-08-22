-- Chat System Schema
-- This migration creates tables for a Discord/Slack-style chat system for agency communication

-- Enum for channel types
CREATE TYPE chat_channel_type AS ENUM ('public', 'private', 'direct_message');

-- Enum for message types
CREATE TYPE chat_message_type AS ENUM ('text', 'system', 'task_created', 'file', 'image');

-- Enum for participant roles
CREATE TYPE chat_participant_role AS ENUM ('owner', 'admin', 'member', 'guest');

-- Enum for notification preferences
CREATE TYPE chat_notification_level AS ENUM ('all', 'mentions', 'none');

-- Chat channels table
CREATE TABLE chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Channel identification
    name TEXT NOT NULL,
    description TEXT,
    channel_type chat_channel_type NOT NULL DEFAULT 'public',
    
    -- Organization structure
    agency_id UUID, -- For agency-specific channels
    workspace_id UUID, -- For workspace grouping
    
    -- Channel settings
    is_archived BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false, -- For default general channels
    
    -- Permissions
    allow_all_agency_members BOOLEAN DEFAULT true,
    require_approval_to_join BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Message tracking
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0,
    
    -- Topic and purpose
    topic TEXT,
    purpose TEXT,
    
    -- Indexes
    INDEX idx_chat_channels_agency_id ON chat_channels(agency_id),
    INDEX idx_chat_channels_type ON chat_channels(channel_type),
    INDEX idx_chat_channels_created_by ON chat_channels(created_by),
    INDEX idx_chat_channels_last_message ON chat_channels(last_message_at DESC)
);

-- Channel participants table (for access control)
CREATE TABLE chat_channel_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Participant role and permissions
    role chat_participant_role NOT NULL DEFAULT 'member',
    
    -- Notification preferences for this channel
    notification_level chat_notification_level NOT NULL DEFAULT 'all',
    
    -- Participation metadata
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id),
    
    -- Read tracking
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_message_id UUID, -- References chat_messages(id)
    
    -- User status in channel
    is_muted BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false, -- Pin channel in sidebar
    
    -- Unique constraint
    UNIQUE(channel_id, user_id),
    
    -- Indexes
    INDEX idx_chat_participants_channel ON chat_channel_participants(channel_id),
    INDEX idx_chat_participants_user ON chat_channel_participants(user_id),
    INDEX idx_chat_participants_role ON chat_channel_participants(role)
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT,
    message_type chat_message_type NOT NULL DEFAULT 'text',
    
    -- Message hierarchy (for threads)
    parent_message_id UUID REFERENCES chat_messages(id), -- For threaded replies
    thread_count INTEGER DEFAULT 0, -- Number of replies in thread
    
    -- Author information
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Message metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Message status
    is_pinned BOOLEAN DEFAULT false,
    is_system_message BOOLEAN DEFAULT false,
    
    -- Mentions and references
    mentioned_users UUID[] DEFAULT '{}', -- Array of user IDs mentioned
    mentioned_channels UUID[] DEFAULT '{}', -- Array of channel IDs mentioned
    
    -- Task integration
    created_task_id UUID, -- If this message created a task
    
    -- Message formatting
    formatted_content JSONB, -- Rich text formatting data
    
    -- Indexes
    INDEX idx_chat_messages_channel ON chat_messages(channel_id),
    INDEX idx_chat_messages_user ON chat_messages(user_id),
    INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC),
    INDEX idx_chat_messages_parent ON chat_messages(parent_message_id),
    INDEX idx_chat_messages_mentions ON chat_messages USING GIN (mentioned_users),
    INDEX idx_chat_messages_task ON chat_messages(created_task_id)
);

-- Message reactions table (like Discord/Slack emoji reactions)
CREATE TABLE chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Reaction details
    emoji TEXT NOT NULL, -- Unicode emoji or custom emoji name
    emoji_native TEXT, -- Native unicode representation
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint - one reaction type per user per message
    UNIQUE(message_id, user_id, emoji),
    
    -- Indexes
    INDEX idx_chat_reactions_message ON chat_message_reactions(message_id),
    INDEX idx_chat_reactions_user ON chat_message_reactions(user_id)
);

-- Message attachments table
CREATE TABLE chat_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- File information
    filename TEXT NOT NULL,
    original_filename TEXT,
    file_size INTEGER,
    mime_type TEXT,
    
    -- Storage information
    storage_path TEXT NOT NULL, -- Path in storage bucket
    storage_bucket TEXT NOT NULL DEFAULT 'chat-attachments',
    public_url TEXT,
    
    -- File metadata
    width INTEGER, -- For images
    height INTEGER, -- For images
    duration_seconds INTEGER, -- For videos/audio
    
    -- Upload metadata
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- File processing
    is_processed BOOLEAN DEFAULT false,
    thumbnail_url TEXT, -- For image/video thumbnails
    
    -- Indexes
    INDEX idx_chat_attachments_message ON chat_message_attachments(message_id),
    INDEX idx_chat_attachments_uploaded_by ON chat_message_attachments(uploaded_by)
);

-- Chat notifications table (for managing notification preferences and history)
CREATE TABLE chat_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type TEXT NOT NULL, -- 'mention', 'direct_message', 'channel_message', etc.
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false, -- Whether notification was actually sent
    
    -- Delivery tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Notification content (for display)
    title TEXT,
    body TEXT,
    
    -- Indexes
    INDEX idx_chat_notifications_user ON chat_notifications(user_id),
    INDEX idx_chat_notifications_channel ON chat_notifications(channel_id),
    INDEX idx_chat_notifications_unread ON chat_notifications(user_id, is_read) WHERE is_read = false,
    INDEX idx_chat_notifications_created_at ON chat_notifications(created_at DESC)
);

-- User chat preferences table
CREATE TABLE chat_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Global notification settings
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    desktop_notifications BOOLEAN DEFAULT true,
    
    -- Notification timing
    notification_start_time TIME DEFAULT '09:00:00',
    notification_end_time TIME DEFAULT '17:00:00',
    weekend_notifications BOOLEAN DEFAULT false,
    
    -- Display preferences
    theme TEXT DEFAULT 'light', -- 'light', 'dark', 'auto'
    compact_mode BOOLEAN DEFAULT false,
    show_member_list BOOLEAN DEFAULT true,
    
    -- Sound preferences
    message_sound BOOLEAN DEFAULT true,
    mention_sound BOOLEAN DEFAULT true,
    
    -- Status and availability
    status TEXT DEFAULT 'active', -- 'active', 'away', 'busy', 'offline'
    status_message TEXT,
    auto_away_minutes INTEGER DEFAULT 10,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(user_id),
    
    -- Indexes
    INDEX idx_chat_preferences_user ON chat_user_preferences(user_id)
);

-- Chat presence table (for online/offline status)
CREATE TABLE chat_user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Presence information
    status TEXT DEFAULT 'offline', -- 'online', 'away', 'busy', 'offline'
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_channel_id UUID REFERENCES chat_channels(id),
    
    -- Session information
    session_id TEXT,
    user_agent TEXT,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_chat_presence_status ON chat_user_presence(status),
    INDEX idx_chat_presence_last_seen ON chat_user_presence(last_seen_at),
    INDEX idx_chat_presence_channel ON chat_user_presence(current_channel_id)
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating updated_at
CREATE TRIGGER trigger_chat_channels_updated_at
    BEFORE UPDATE ON chat_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_updated_at();

CREATE TRIGGER trigger_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_updated_at();

CREATE TRIGGER trigger_chat_preferences_updated_at
    BEFORE UPDATE ON chat_user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_updated_at();

CREATE TRIGGER trigger_chat_presence_updated_at
    BEFORE UPDATE ON chat_user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_updated_at();

-- Function to update channel message count and last message time
CREATE OR REPLACE FUNCTION update_channel_message_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chat_channels 
        SET message_count = message_count + 1,
            last_message_at = NEW.created_at
        WHERE id = NEW.channel_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_channels 
        SET message_count = GREATEST(message_count - 1, 0)
        WHERE id = OLD.channel_id;
        
        -- Update last_message_at to the most recent message
        UPDATE chat_channels 
        SET last_message_at = (
            SELECT MAX(created_at) 
            FROM chat_messages 
            WHERE channel_id = OLD.channel_id 
            AND deleted_at IS NULL
        )
        WHERE id = OLD.channel_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message count updates
CREATE TRIGGER trigger_update_channel_stats
    AFTER INSERT OR DELETE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_message_stats();

-- Function to update thread count
CREATE OR REPLACE FUNCTION update_thread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_message_id IS NOT NULL THEN
        UPDATE chat_messages 
        SET thread_count = thread_count + 1
        WHERE id = NEW.parent_message_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_message_id IS NOT NULL THEN
        UPDATE chat_messages 
        SET thread_count = GREATEST(thread_count - 1, 0)
        WHERE id = OLD.parent_message_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for thread count updates
CREATE TRIGGER trigger_update_thread_count
    AFTER INSERT OR DELETE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_count();

-- RLS Policies
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_user_presence ENABLE ROW LEVEL SECURITY;

-- Policies for chat_channels
CREATE POLICY "Users can view channels they participate in" ON chat_channels
    FOR SELECT USING (
        id IN (
            SELECT channel_id 
            FROM chat_channel_participants 
            WHERE user_id = auth.uid()
        )
        OR (channel_type = 'public' AND allow_all_agency_members = true)
    );

CREATE POLICY "Users can create channels" ON chat_channels
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel creators and admins can update channels" ON chat_channels
    FOR UPDATE USING (
        created_by = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM chat_channel_participants 
            WHERE channel_id = id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Policies for chat_channel_participants
CREATE POLICY "Users can view participants of channels they're in" ON chat_channel_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_channel_participants cp2 
            WHERE cp2.channel_id = channel_id 
            AND cp2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join public channels" ON chat_channel_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM chat_channels 
            WHERE id = channel_id 
            AND (channel_type = 'public' OR created_by = auth.uid())
        )
    );

CREATE POLICY "Users can manage their own participation" ON chat_channel_participants
    FOR ALL USING (user_id = auth.uid());

-- Policies for chat_messages
CREATE POLICY "Users can view messages in channels they participate in" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_channel_participants 
            WHERE channel_id = chat_messages.channel_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages to channels they participate in" ON chat_messages
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM chat_channel_participants 
            WHERE channel_id = chat_messages.channel_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can edit their own messages" ON chat_messages
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE USING (user_id = auth.uid());

-- Policies for reactions
CREATE POLICY "Users can manage reactions in accessible channels" ON chat_message_reactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_channel_participants p ON p.channel_id = m.channel_id
            WHERE m.id = message_id 
            AND p.user_id = auth.uid()
        )
    );

-- Policies for attachments
CREATE POLICY "Users can view attachments in accessible channels" ON chat_message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_channel_participants p ON p.channel_id = m.channel_id
            WHERE m.id = message_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can upload attachments to accessible channels" ON chat_message_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_channel_participants p ON p.channel_id = m.channel_id
            WHERE m.id = message_id 
            AND p.user_id = auth.uid()
        )
    );

-- Policies for notifications
CREATE POLICY "Users can manage their own notifications" ON chat_notifications
    FOR ALL USING (user_id = auth.uid());

-- Policies for preferences
CREATE POLICY "Users can manage their own preferences" ON chat_user_preferences
    FOR ALL USING (user_id = auth.uid());

-- Policies for presence
CREATE POLICY "Users can view presence of users in shared channels" ON chat_user_presence
    FOR SELECT USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM chat_channel_participants p1
            JOIN chat_channel_participants p2 ON p1.channel_id = p2.channel_id
            WHERE p1.user_id = auth.uid() 
            AND p2.user_id = chat_user_presence.user_id
        )
    );

CREATE POLICY "Users can update their own presence" ON chat_user_presence
    FOR ALL USING (user_id = auth.uid());

-- Create storage bucket for chat attachments
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('chat-attachments', 'chat-attachments', false);

-- Sample data for development
-- Create a default general channel
INSERT INTO chat_channels (name, description, channel_type, created_by, is_default, topic) 
VALUES (
    'general', 
    'General discussion for all team members', 
    'public', 
    '00000000-0000-0000-0000-000000000000', -- Placeholder user ID
    true,
    'Welcome to the team chat!'
);

-- Create sample user preferences
INSERT INTO chat_user_preferences (user_id) 
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT (user_id) DO NOTHING;
