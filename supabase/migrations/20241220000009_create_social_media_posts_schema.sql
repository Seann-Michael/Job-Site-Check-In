-- Social Media Posts Schema
-- This migration creates tables for managing GMB updates and Facebook posts with AI content generation and syndication

-- Enum for platform types
CREATE TYPE social_platform AS ENUM ('gmb', 'facebook', 'instagram', 'twitter', 'linkedin');

-- Enum for post status
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed', 'cancelled');

-- Enum for content generation method
CREATE TYPE content_generation_method AS ENUM ('manual', 'ai_keyword', 'ai_template', 'ai_custom');

-- Enum for image source
CREATE TYPE image_source AS ENUM ('upload', 'ai_generated', 'stock', 'url');

-- Main social media posts table
CREATE TABLE social_media_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Post identification
    title TEXT NOT NULL,
    platform social_platform NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    content_length INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
    hashtags TEXT[], -- Array of hashtags
    mentions TEXT[], -- Array of mentions
    
    -- Targeting and keywords
    target_keywords TEXT[], -- Keywords for SEO targeting
    target_location TEXT, -- Geographic targeting
    target_audience JSONB, -- Audience targeting parameters
    
    -- AI Generation metadata
    generation_method content_generation_method NOT NULL DEFAULT 'manual',
    ai_prompt TEXT, -- Original AI prompt used
    ai_model_used TEXT, -- AI model version used
    ai_generation_config JSONB, -- AI parameters used
    
    -- Media attachments
    images JSONB DEFAULT '[]', -- Array of image metadata
    videos JSONB DEFAULT '[]', -- Array of video metadata
    primary_image_url TEXT,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Status and tracking
    status post_status NOT NULL DEFAULT 'draft',
    external_post_id TEXT, -- Platform-specific post ID after publishing
    external_url TEXT, -- URL to the published post
    
    -- Engagement metrics (updated after publishing)
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    reach_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    
    -- Syndication tracking
    syndicated_to social_platform[] DEFAULT '{}', -- Platforms this was syndicated to
    parent_post_id UUID REFERENCES social_media_posts(id), -- If this is a syndicated copy
    
    -- Error handling
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_gmb_content_length CHECK (
        platform != 'gmb' OR content_length <= 1500
    ),
    CONSTRAINT valid_scheduled_date CHECK (
        scheduled_for IS NULL OR scheduled_for > created_at
    ),
    
    -- Indexes
    INDEX idx_social_posts_user_id ON social_media_posts(user_id),
    INDEX idx_social_posts_platform ON social_media_posts(platform),
    INDEX idx_social_posts_status ON social_media_posts(status),
    INDEX idx_social_posts_scheduled ON social_media_posts(scheduled_for),
    INDEX idx_social_posts_keywords ON social_media_posts USING GIN (target_keywords),
    INDEX idx_social_posts_syndicated ON social_media_posts USING GIN (syndicated_to)
);

-- Post templates table for reusable content patterns
CREATE TABLE post_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Template details
    name TEXT NOT NULL,
    description TEXT,
    platform social_platform NOT NULL,
    
    -- Template content with placeholders
    content_template TEXT NOT NULL, -- Can include {{keyword}}, {{business_name}}, etc.
    suggested_hashtags TEXT[],
    
    -- AI generation parameters
    ai_style TEXT, -- Style instructions for AI
    ai_tone TEXT, -- Tone instructions (professional, casual, etc.)
    ai_focus TEXT, -- Focus areas (promotion, education, engagement)
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Categorization
    category TEXT, -- 'promotion', 'education', 'engagement', 'seasonal', etc.
    tags TEXT[],
    
    -- Sharing
    is_public BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_post_templates_user_id ON post_templates(user_id),
    INDEX idx_post_templates_platform ON post_templates(platform),
    INDEX idx_post_templates_category ON post_templates(category),
    INDEX idx_post_templates_tags ON post_templates USING GIN (tags)
);

-- Media assets table for managing images and videos
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File information
    filename TEXT NOT NULL,
    original_filename TEXT,
    file_size INTEGER,
    mime_type TEXT NOT NULL,
    
    -- Storage information
    storage_path TEXT NOT NULL, -- Path in storage bucket
    storage_bucket TEXT NOT NULL DEFAULT 'social-media-assets',
    public_url TEXT,
    
    -- Image/video metadata
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER, -- For videos
    
    -- AI Generation metadata (if AI-generated)
    source_type image_source NOT NULL DEFAULT 'upload',
    ai_prompt TEXT, -- Prompt used for AI generation
    ai_model_used TEXT,
    generation_config JSONB,
    
    -- Usage and categorization
    alt_text TEXT,
    description TEXT,
    tags TEXT[],
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_media_assets_user_id ON media_assets(user_id),
    INDEX idx_media_assets_source_type ON media_assets(source_type),
    INDEX idx_media_assets_mime_type ON media_assets(mime_type),
    INDEX idx_media_assets_tags ON media_assets USING GIN (tags)
);

-- Syndication rules table for automated cross-posting
CREATE TABLE syndication_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Rule configuration
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Source and target platforms
    source_platform social_platform NOT NULL,
    target_platforms social_platform[] NOT NULL DEFAULT '{}',
    
    -- Content modification rules
    content_modifications JSONB DEFAULT '{}', -- Rules for modifying content per platform
    hashtag_modifications JSONB DEFAULT '{}', -- Platform-specific hashtag rules
    
    -- Trigger conditions
    trigger_conditions JSONB DEFAULT '{}', -- Conditions for when to syndicate
    
    -- Timing rules
    delay_minutes INTEGER DEFAULT 0, -- Delay before syndicating
    
    -- Filtering rules
    keyword_filters TEXT[], -- Only syndicate posts with these keywords
    exclude_keywords TEXT[], -- Don't syndicate posts with these keywords
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_syndication_rules_user_id ON syndication_rules(user_id),
    INDEX idx_syndication_rules_source ON syndication_rules(source_platform),
    INDEX idx_syndication_rules_active ON syndication_rules(is_active)
);

-- AI generation history for tracking and improving prompts
CREATE TABLE ai_generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES social_media_posts(id) ON DELETE SET NULL,
    
    -- Generation details
    generation_type TEXT NOT NULL, -- 'content', 'image', 'hashtags'
    model_used TEXT NOT NULL,
    
    -- Input
    user_prompt TEXT,
    target_keywords TEXT[],
    business_context JSONB, -- Business information used
    
    -- Output
    generated_content TEXT,
    generation_metadata JSONB, -- Model-specific metadata
    
    -- Quality metrics
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    was_used BOOLEAN DEFAULT false,
    was_modified BOOLEAN DEFAULT false,
    
    -- Performance tracking
    generation_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,4),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_ai_history_user_id ON ai_generation_history(user_id),
    INDEX idx_ai_history_post_id ON ai_generation_history(post_id),
    INDEX idx_ai_history_type ON ai_generation_history(generation_type),
    INDEX idx_ai_history_rating ON ai_generation_history(user_rating)
);

-- Post analytics table for detailed performance tracking
CREATE TABLE post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social_media_posts(id) ON DELETE CASCADE,
    
    -- Time-based metrics
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Engagement metrics
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    
    -- Reach and impression metrics
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    
    -- Platform-specific metrics
    platform_specific_metrics JSONB DEFAULT '{}',
    
    -- Derived metrics
    engagement_rate DECIMAL(5,2),
    click_through_rate DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_post_analytics_post_id ON post_analytics(post_id),
    INDEX idx_post_analytics_recorded_at ON post_analytics(recorded_at)
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_social_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating updated_at
CREATE TRIGGER trigger_social_posts_updated_at
    BEFORE UPDATE ON social_media_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_social_media_updated_at();

CREATE TRIGGER trigger_post_templates_updated_at
    BEFORE UPDATE ON post_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_social_media_updated_at();

CREATE TRIGGER trigger_syndication_rules_updated_at
    BEFORE UPDATE ON syndication_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_social_media_updated_at();

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE post_templates 
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment media asset usage
CREATE OR REPLACE FUNCTION increment_media_usage(asset_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE media_assets 
    SET usage_count = usage_count + 1
    WHERE id = asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndication_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for social_media_posts
CREATE POLICY "Users can manage their own social media posts" ON social_media_posts
    FOR ALL USING (auth.uid() = user_id);

-- Policies for post_templates
CREATE POLICY "Users can view their own and public templates" ON post_templates
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage their own templates" ON post_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON post_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON post_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for media_assets
CREATE POLICY "Users can manage their own media assets" ON media_assets
    FOR ALL USING (auth.uid() = user_id);

-- Policies for syndication_rules
CREATE POLICY "Users can manage their own syndication rules" ON syndication_rules
    FOR ALL USING (auth.uid() = user_id);

-- Policies for ai_generation_history
CREATE POLICY "Users can manage their own AI generation history" ON ai_generation_history
    FOR ALL USING (auth.uid() = user_id);

-- Policies for post_analytics
CREATE POLICY "Users can view analytics for their posts" ON post_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM social_media_posts 
            WHERE social_media_posts.id = post_analytics.post_id 
            AND social_media_posts.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert analytics" ON post_analytics
    FOR INSERT WITH CHECK (true); -- Allow system to insert analytics

-- Create storage bucket for social media assets (this would typically be done via Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('social-media-assets', 'social-media-assets', true);

-- Sample post templates for GMB and Facebook
INSERT INTO post_templates (user_id, name, description, platform, content_template, suggested_hashtags, ai_style, ai_tone, ai_focus, category, tags) VALUES
-- GMB Templates
(
    '00000000-0000-0000-0000-000000000000', -- Placeholder user ID
    'GMB Keyword Promotion',
    'Template for promoting services with target keywords',
    'gmb',
    'Excited to help {{target_location}} with {{target_keyword}}! At {{business_name}}, we specialize in delivering exceptional {{service_type}}. Contact us today to learn more about how we can help your {{target_keyword}} needs.',
    ARRAY['#{{target_keyword}}', '#{{target_location}}', '#localbusiness'],
    'Professional and helpful',
    'Enthusiastic but professional',
    'Service promotion with local SEO',
    'promotion',
    ARRAY['gmb', 'local-seo', 'service-promotion']
),
(
    '00000000-0000-0000-0000-000000000000',
    'GMB Educational Post',
    'Educational content template for GMB',
    'gmb',
    'Did you know that {{educational_fact}}? At {{business_name}}, we believe in educating our {{target_location}} community about {{topic}}. Here are 3 key tips: {{tip_1}}, {{tip_2}}, and {{tip_3}}.',
    ARRAY['#education', '#{{topic}}', '#localtips'],
    'Educational and authoritative',
    'Helpful and informative',
    'Education and authority building',
    'education',
    ARRAY['gmb', 'education', 'tips']
),
-- Facebook Templates
(
    '00000000-0000-0000-0000-000000000000',
    'Facebook Service Showcase',
    'Template for showcasing services on Facebook',
    'facebook',
    '🌟 Looking for quality {{target_keyword}} in {{target_location}}? Look no further! At {{business_name}}, we''ve been serving our community with excellence for {{years_in_business}} years. Our team specializes in {{service_details}} and we''re here to help you achieve {{customer_outcome}}. 

Ready to get started? Contact us today! 📞

#{{target_keyword}} #{{target_location}} #QualityService #LocalBusiness',
    ARRAY['#{{target_keyword}}', '#{{target_location}}', '#qualityservice', '#localbusiness'],
    'Engaging and community-focused',
    'Friendly and approachable',
    'Service promotion with community connection',
    'promotion',
    ARRAY['facebook', 'service-showcase', 'community']
),
(
    '00000000-0000-0000-0000-000000000000',
    'Facebook Behind the Scenes',
    'Template for behind-the-scenes content',
    'facebook',
    '👀 Behind the scenes at {{business_name}}! Today our team is working on {{current_project}} for a customer in {{target_location}}. We love what we do and it shows in every {{service_type}} project we complete. 

What makes us different? {{unique_value_proposition}}

Drop a comment below if you''d like to see more behind-the-scenes content! 👇

#BehindTheScenes #{{business_name}} #{{target_location}} #{{service_type}}',
    ARRAY['#behindthescenes', '#{{business_name}}', '#{{target_location}}', '#{{service_type}}'],
    'Personal and authentic',
    'Casual and engaging',
    'Community engagement and authenticity',
    'engagement',
    ARRAY['facebook', 'behind-scenes', 'authentic']
);
