-- Create AI chat sessions table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_messages INTEGER DEFAULT 0,
    total_credits_used INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI chat messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('user', 'ai')),
    content TEXT NOT NULL,
    credits_used INTEGER DEFAULT 0,
    cost DECIMAL(10, 6) DEFAULT 0,
    processing_time TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at);

-- Enable RLS
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_sessions
CREATE POLICY "Users can view their own chat sessions" ON ai_chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions" ON ai_chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" ON ai_chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions" ON ai_chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can view their own chat messages" ON ai_chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat messages" ON ai_chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_chat_sessions_updated_at 
    BEFORE UPDATE ON ai_chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_ai_chat_updated_at_column();

-- Trigger to update session stats when messages are added
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_chat_sessions 
    SET 
        total_messages = (SELECT COUNT(*) FROM ai_chat_messages WHERE session_id = NEW.session_id),
        total_credits_used = (SELECT COALESCE(SUM(credits_used), 0) FROM ai_chat_messages WHERE session_id = NEW.session_id),
        total_cost = (SELECT COALESCE(SUM(cost), 0) FROM ai_chat_messages WHERE session_id = NEW.session_id),
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.session_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_stats_trigger
    AFTER INSERT ON ai_chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_stats();

-- Grant necessary permissions
GRANT ALL ON ai_chat_sessions TO authenticated;
GRANT ALL ON ai_chat_messages TO authenticated;
