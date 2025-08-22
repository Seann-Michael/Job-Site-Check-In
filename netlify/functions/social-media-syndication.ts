import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SyndicationRequest {
  postId: string;
  targetPlatforms: string[];
  contentModifications?: {
    [platform: string]: {
      content?: string;
      hashtags?: string[];
      removeKeywords?: string[];
      addKeywords?: string[];
    };
  };
  scheduleDelay?: number; // Minutes to delay each syndicated post
  preserveScheduling?: boolean; // Whether to maintain original schedule
}

interface SyndicationRule {
  id: string;
  name: string;
  is_active: boolean;
  source_platform: string;
  target_platforms: string[];
  content_modifications: any;
  hashtag_modifications: any;
  trigger_conditions: any;
  delay_minutes: number;
  keyword_filters: string[];
  exclude_keywords: string[];
}

interface PlatformConfig {
  maxLength: number;
  hashtagLimit: number;
  supportsMentions: boolean;
  supportsImages: boolean;
  supportsVideos: boolean;
  requiresApproval: boolean;
}

// Platform-specific configurations
const PLATFORM_CONFIGS: { [key: string]: PlatformConfig } = {
  gmb: {
    maxLength: 1500,
    hashtagLimit: 30,
    supportsMentions: false,
    supportsImages: true,
    supportsVideos: false,
    requiresApproval: false
  },
  facebook: {
    maxLength: 63206,
    hashtagLimit: 30,
    supportsMentions: true,
    supportsImages: true,
    supportsVideos: true,
    requiresApproval: false
  },
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    supportsMentions: true,
    supportsImages: true,
    supportsVideos: true,
    requiresApproval: false
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 10,
    supportsMentions: true,
    supportsImages: true,
    supportsVideos: true,
    requiresApproval: false
  },
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    supportsMentions: true,
    supportsImages: true,
    supportsVideos: true,
    requiresApproval: false
  }
};

// Helper function to adapt content for different platforms
function adaptContentForPlatform(
  originalContent: string,
  originalPlatform: string,
  targetPlatform: string,
  modifications?: any
): { content: string; hashtags: string[]; truncated: boolean } {
  let adaptedContent = originalContent;
  let hashtags: string[] = [];
  let truncated = false;

  const targetConfig = PLATFORM_CONFIGS[targetPlatform];
  const originalConfig = PLATFORM_CONFIGS[originalPlatform];

  // Apply custom modifications if provided
  if (modifications?.content) {
    adaptedContent = modifications.content;
  }

  // Extract and adapt hashtags
  const hashtagRegex = /#\w+/g;
  const originalHashtags = adaptedContent.match(hashtagRegex) || [];
  
  // Remove hashtags from content for processing
  let contentWithoutHashtags = adaptedContent.replace(hashtagRegex, '').trim();

  // Platform-specific adaptations
  switch (targetPlatform) {
    case 'twitter':
      // For Twitter, be more concise and punchy
      if (contentWithoutHashtags.length > targetConfig.maxLength - 50) { // Leave room for hashtags
        contentWithoutHashtags = contentWithoutHashtags.substring(0, targetConfig.maxLength - 50) + '...';
        truncated = true;
      }
      break;

    case 'linkedin':
      // For LinkedIn, add more professional context
      if (originalPlatform === 'instagram' || originalPlatform === 'facebook') {
        // Remove casual elements like emojis if coming from more casual platforms
        contentWithoutHashtags = contentWithoutHashtags.replace(/[^\w\s.,!?]/g, '');
      }
      break;

    case 'instagram':
      // For Instagram, ensure visual appeal and engagement
      if (originalPlatform === 'linkedin') {
        // Add some visual elements and make it more engaging
        contentWithoutHashtags = contentWithoutHashtags.replace(/\. /g, '.\n\n');
      }
      break;

    case 'gmb':
      // For GMB, focus on local relevance and calls to action
      if (contentWithoutHashtags.length > targetConfig.maxLength) {
        contentWithoutHashtags = contentWithoutHashtags.substring(0, targetConfig.maxLength - 3) + '...';
        truncated = true;
      }
      break;
  }

  // Adapt hashtags for target platform
  hashtags = originalHashtags
    .slice(0, targetConfig.hashtagLimit)
    .map(tag => tag.toLowerCase());

  // Apply hashtag modifications if provided
  if (modifications?.hashtags) {
    hashtags = modifications.hashtags;
  }

  // Combine content and hashtags
  const finalContent = `${contentWithoutHashtags}\n\n${hashtags.join(' ')}`.trim();

  return {
    content: finalContent,
    hashtags,
    truncated
  };
}

// Helper function to check if a post matches syndication rules
function matchesSyndicationRules(post: any, rules: SyndicationRule[]): SyndicationRule[] {
  return rules.filter(rule => {
    if (!rule.is_active) return false;
    if (rule.source_platform !== post.platform) return false;

    // Check keyword filters
    if (rule.keyword_filters.length > 0) {
      const hasRequiredKeywords = rule.keyword_filters.some(keyword =>
        post.content.toLowerCase().includes(keyword.toLowerCase()) ||
        post.target_keywords?.some((tk: string) => tk.toLowerCase().includes(keyword.toLowerCase()))
      );
      if (!hasRequiredKeywords) return false;
    }

    // Check exclude keywords
    if (rule.exclude_keywords.length > 0) {
      const hasExcludedKeywords = rule.exclude_keywords.some(keyword =>
        post.content.toLowerCase().includes(keyword.toLowerCase()) ||
        post.target_keywords?.some((tk: string) => tk.toLowerCase().includes(keyword.toLowerCase()))
      );
      if (hasExcludedKeywords) return false;
    }

    // Check trigger conditions (you can expand this based on your needs)
    if (rule.trigger_conditions) {
      // Add custom trigger logic here
    }

    return true;
  });
}

// Main handler
export const handler: Handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      },
    };
  }

  try {
    // Verify authentication
    const authHeader = event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    const method = event.httpMethod;
    const path = event.path;

    if (method === 'POST' && path.includes('syndicate')) {
      // Manual syndication
      const request: SyndicationRequest = JSON.parse(event.body || '{}');

      // Validate request
      if (!request.postId || !request.targetPlatforms?.length) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            error: 'Missing required fields: postId, targetPlatforms' 
          }),
        };
      }

      // Get the original post
      const { data: originalPost, error: postError } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('id', request.postId)
        .eq('user_id', user.id)
        .single();

      if (postError || !originalPost) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Post not found' }),
        };
      }

      const syndicatedPosts = [];
      const errors = [];

      // Create syndicated posts for each target platform
      for (const targetPlatform of request.targetPlatforms) {
        try {
          // Skip if already syndicated to this platform
          if (originalPost.syndicated_to?.includes(targetPlatform)) {
            continue;
          }

          // Adapt content for target platform
          const modifications = request.contentModifications?.[targetPlatform];
          const { content, hashtags, truncated } = adaptContentForPlatform(
            originalPost.content,
            originalPost.platform,
            targetPlatform,
            modifications
          );

          // Calculate schedule time
          let scheduledFor = null;
          if (originalPost.scheduled_for && request.preserveScheduling) {
            const originalSchedule = new Date(originalPost.scheduled_for);
            const delayMinutes = request.scheduleDelay || 0;
            scheduledFor = new Date(originalSchedule.getTime() + (delayMinutes * 60000));
          }

          // Create syndicated post
          const syndicatedPost = {
            title: `${originalPost.title} (${targetPlatform})`,
            platform: targetPlatform,
            content,
            hashtags,
            mentions: originalPost.mentions || [],
            target_keywords: originalPost.target_keywords || [],
            target_location: originalPost.target_location,
            target_audience: originalPost.target_audience,
            generation_method: 'ai_custom', // Since it's adapted
            ai_prompt: `Syndicated from ${originalPost.platform} post`,
            images: originalPost.images || [],
            videos: originalPost.videos || [],
            primary_image_url: originalPost.primary_image_url,
            scheduled_for: scheduledFor?.toISOString(),
            status: scheduledFor ? 'scheduled' : 'draft',
            parent_post_id: originalPost.id,
            user_id: user.id
          };

          const { data: createdPost, error: createError } = await supabase
            .from('social_media_posts')
            .insert(syndicatedPost)
            .select()
            .single();

          if (createError) {
            errors.push(`Failed to create ${targetPlatform} post: ${createError.message}`);
            continue;
          }

          syndicatedPosts.push({
            ...createdPost,
            truncated,
            adaptations: modifications ? 'Custom modifications applied' : 'Auto-adapted for platform'
          });

          // Update original post's syndicated_to array
          const updatedSyndicatedTo = [...(originalPost.syndicated_to || []), targetPlatform];
          await supabase
            .from('social_media_posts')
            .update({ syndicated_to: updatedSyndicatedTo })
            .eq('id', originalPost.id);

        } catch (error) {
          errors.push(`Error syndicating to ${targetPlatform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          syndicatedPosts,
          errors: errors.length > 0 ? errors : null,
          totalCreated: syndicatedPosts.length,
          totalErrors: errors.length
        }),
      };

    } else if (method === 'POST' && path.includes('auto-syndicate')) {
      // Auto-syndication based on rules
      const { postId } = JSON.parse(event.body || '{}');

      if (!postId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Post ID is required' }),
        };
      }

      // Get the post
      const { data: post, error: postError } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

      if (postError || !post) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Post not found' }),
        };
      }

      // Get user's syndication rules
      const { data: rules, error: rulesError } = await supabase
        .from('syndication_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (rulesError) {
        throw rulesError;
      }

      // Find matching rules
      const matchingRules = matchesSyndicationRules(post, rules || []);

      if (matchingRules.length === 0) {
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            message: 'No matching syndication rules found',
            syndicatedPosts: [],
            appliedRules: []
          }),
        };
      }

      const syndicatedPosts = [];
      const appliedRules = [];
      const errors = [];

      // Apply each matching rule
      for (const rule of matchingRules) {
        try {
          for (const targetPlatform of rule.target_platforms) {
            // Skip if already syndicated
            if (post.syndicated_to?.includes(targetPlatform)) {
              continue;
            }

            // Apply rule modifications
            const { content, hashtags, truncated } = adaptContentForPlatform(
              post.content,
              post.platform,
              targetPlatform,
              rule.content_modifications[targetPlatform]
            );

            // Calculate schedule with rule delay
            let scheduledFor = null;
            if (post.scheduled_for) {
              const originalSchedule = new Date(post.scheduled_for);
              scheduledFor = new Date(originalSchedule.getTime() + (rule.delay_minutes * 60000));
            }

            const syndicatedPost = {
              title: `${post.title} (${targetPlatform} - Auto)`,
              platform: targetPlatform,
              content,
              hashtags,
              mentions: post.mentions || [],
              target_keywords: post.target_keywords || [],
              target_location: post.target_location,
              target_audience: post.target_audience,
              generation_method: 'ai_custom',
              ai_prompt: `Auto-syndicated via rule: ${rule.name}`,
              images: post.images || [],
              videos: post.videos || [],
              primary_image_url: post.primary_image_url,
              scheduled_for: scheduledFor?.toISOString(),
              status: scheduledFor ? 'scheduled' : 'draft',
              parent_post_id: post.id,
              user_id: user.id
            };

            const { data: createdPost, error: createError } = await supabase
              .from('social_media_posts')
              .insert(syndicatedPost)
              .select()
              .single();

            if (createError) {
              errors.push(`Rule "${rule.name}": Failed to create ${targetPlatform} post - ${createError.message}`);
              continue;
            }

            syndicatedPosts.push({
              ...createdPost,
              truncated,
              appliedRule: rule.name,
              targetPlatform
            });
          }

          appliedRules.push({
            id: rule.id,
            name: rule.name,
            targetPlatforms: rule.target_platforms
          });

        } catch (error) {
          errors.push(`Rule "${rule.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update original post's syndicated_to array
      if (syndicatedPosts.length > 0) {
        const newPlatforms = syndicatedPosts.map(p => p.platform);
        const updatedSyndicatedTo = [...(post.syndicated_to || []), ...newPlatforms];
        await supabase
          .from('social_media_posts')
          .update({ syndicated_to: updatedSyndicatedTo })
          .eq('id', post.id);
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          syndicatedPosts,
          appliedRules,
          errors: errors.length > 0 ? errors : null,
          totalCreated: syndicatedPosts.length,
          totalRulesApplied: appliedRules.length
        }),
      };

    } else if (method === 'GET' && path.includes('rules')) {
      // Get syndication rules
      const { data: rules, error } = await supabase
        .from('syndication_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules: rules || [] }),
      };

    } else {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

  } catch (error) {
    console.error('Syndication API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
