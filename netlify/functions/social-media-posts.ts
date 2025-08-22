import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SocialMediaPost {
  id?: string;
  title: string;
  platform: 'gmb' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  content: string;
  hashtags?: string[];
  mentions?: string[];
  target_keywords?: string[];
  target_location?: string;
  target_audience?: any;
  generation_method?: 'manual' | 'ai_keyword' | 'ai_template' | 'ai_custom';
  ai_prompt?: string;
  ai_model_used?: string;
  ai_generation_config?: any;
  images?: any[];
  videos?: any[];
  primary_image_url?: string;
  scheduled_for?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  syndicated_to?: string[];
  parent_post_id?: string;
}

interface PostQuery {
  platform?: string;
  status?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
}

// Helper function to validate post content
function validatePost(post: SocialMediaPost): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!post.title || post.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!post.platform) {
    errors.push('Platform is required');
  }

  if (!post.content || post.content.trim().length === 0) {
    errors.push('Content is required');
  }

  // Platform-specific validations
  if (post.platform === 'gmb' && post.content && post.content.length > 1500) {
    errors.push('GMB updates must be 1500 characters or less');
  }

  if (post.platform === 'twitter' && post.content && post.content.length > 280) {
    errors.push('Twitter posts must be 280 characters or less');
  }

  // Validate scheduled date
  if (post.scheduled_for) {
    const scheduledDate = new Date(post.scheduled_for);
    const now = new Date();
    if (scheduledDate <= now) {
      errors.push('Scheduled date must be in the future');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Helper function to build query filters
function buildQueryFilters(query: PostQuery, userId: string) {
  let queryBuilder = supabase
    .from('social_media_posts')
    .select(`
      *,
      post_analytics (
        likes,
        comments,
        shares,
        reach,
        impressions,
        engagement_rate,
        recorded_at
      )
    `)
    .eq('user_id', userId);

  if (query.platform) {
    queryBuilder = queryBuilder.eq('platform', query.platform);
  }

  if (query.status) {
    queryBuilder = queryBuilder.eq('status', query.status);
  }

  if (query.search) {
    queryBuilder = queryBuilder.or(`title.ilike.%${query.search}%,content.ilike.%${query.search}%`);
  }

  if (query.start_date) {
    queryBuilder = queryBuilder.gte('created_at', query.start_date);
  }

  if (query.end_date) {
    queryBuilder = queryBuilder.lte('created_at', query.end_date);
  }

  if (query.limit) {
    queryBuilder = queryBuilder.limit(query.limit);
  }

  if (query.offset) {
    queryBuilder = queryBuilder.range(query.offset, (query.offset + (query.limit || 10)) - 1);
  }

  return queryBuilder.order('created_at', { ascending: false });
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const postId = path.split('/').pop();

    switch (method) {
      case 'GET':
        // Get posts (with optional filtering)
        if (postId && postId !== 'social-media-posts') {
          // Get specific post
          const { data: post, error } = await supabase
            .from('social_media_posts')
            .select(`
              *,
              post_analytics (
                likes,
                comments,
                shares,
                reach,
                impressions,
                engagement_rate,
                recorded_at
              )
            `)
            .eq('id', postId)
            .eq('user_id', user.id)
            .single();

          if (error) {
            return {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Post not found' }),
            };
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(post),
          };
        } else {
          // Get all posts with filters
          const query: PostQuery = {};
          const urlParams = new URLSearchParams(event.queryStringParameters || {});
          
          query.platform = urlParams.get('platform') || undefined;
          query.status = urlParams.get('status') || undefined;
          query.search = urlParams.get('search') || undefined;
          query.start_date = urlParams.get('start_date') || undefined;
          query.end_date = urlParams.get('end_date') || undefined;
          query.limit = parseInt(urlParams.get('limit') || '20');
          query.offset = parseInt(urlParams.get('offset') || '0');

          const { data: posts, error, count } = await buildQueryFilters(query, user.id);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              posts: posts || [],
              total: count || 0,
              limit: query.limit,
              offset: query.offset
            }),
          };
        }

      case 'POST':
        // Create new post
        const newPostData: SocialMediaPost = JSON.parse(event.body || '{}');
        
        // Validate the post
        const validation = validatePost(newPostData);
        if (!validation.valid) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              error: 'Validation failed',
              details: validation.errors 
            }),
          };
        }

        // Add user_id and set defaults
        const postToCreate = {
          ...newPostData,
          user_id: user.id,
          status: newPostData.status || 'draft',
          content_length: newPostData.content.length,
          hashtags: newPostData.hashtags || [],
          mentions: newPostData.mentions || [],
          target_keywords: newPostData.target_keywords || [],
          images: newPostData.images || [],
          videos: newPostData.videos || [],
          syndicated_to: newPostData.syndicated_to || [],
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          reach_count: 0,
          retry_count: 0
        };

        const { data: createdPost, error: createError } = await supabase
          .from('social_media_posts')
          .insert(postToCreate)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        return {
          statusCode: 201,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createdPost),
        };

      case 'PUT':
        // Update existing post
        if (!postId || postId === 'social-media-posts') {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Post ID is required for updates' }),
          };
        }

        const updateData: Partial<SocialMediaPost> = JSON.parse(event.body || '{}');
        
        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.user_id;
        delete updateData.created_at;
        delete updateData.external_post_id; // These should only be set by publishing system

        // Validate if content is being updated
        if (updateData.content !== undefined) {
          const validationForUpdate = validatePost({
            title: updateData.title || '',
            platform: updateData.platform || 'gmb',
            content: updateData.content,
            ...updateData
          } as SocialMediaPost);
          
          if (!validationForUpdate.valid) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                error: 'Validation failed',
                details: validationForUpdate.errors 
              }),
            };
          }

          // Update content length if content changed
          updateData.content_length = updateData.content.length;
        }

        const { data: updatedPost, error: updateError } = await supabase
          .from('social_media_posts')
          .update(updateData)
          .eq('id', postId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          if (updateError.code === 'PGRST116') {
            return {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Post not found' }),
            };
          }
          throw updateError;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedPost),
        };

      case 'DELETE':
        // Delete post
        if (!postId || postId === 'social-media-posts') {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Post ID is required for deletion' }),
          };
        }

        const { error: deleteError } = await supabase
          .from('social_media_posts')
          .delete()
          .eq('id', postId)
          .eq('user_id', user.id);

        if (deleteError) {
          throw deleteError;
        }

        return {
          statusCode: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        };

      default:
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
    console.error('Social media posts API error:', error);
    
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
