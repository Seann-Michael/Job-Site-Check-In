import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface BulkPostingRequest {
  // Campaign settings
  campaignName: string;
  totalPosts: number;
  startDate: string;
  endDate: string;
  
  // Content settings
  businessName: string;
  businessType: string;
  targetKeywords: string[];
  targetLocation: string;
  platforms: string[];
  
  // Scheduling settings
  postsPerDay: number;
  preferredTimes: string[]; // ['09:00', '14:00', '18:00']
  skipWeekends?: boolean;
  timezone?: string;
  
  // Content variety settings
  contentTypes: string[]; // ['promotional', 'educational', 'engagement']
  tones: string[]; // ['professional', 'casual', 'friendly']
  includeImages: boolean;
  
  // Advanced options
  diversityLevel: 'low' | 'medium' | 'high'; // How much to vary content
  keywordRotation: boolean; // Rotate through different keywords
  templateVariation: boolean; // Use different templates
}

interface BulkPostingResponse {
  success: boolean;
  campaignId: string;
  postsCreated: number;
  postsScheduled: number;
  errors: string[];
  schedule: Array<{
    date: string;
    time: string;
    platform: string;
    title: string;
    keywords: string[];
    contentType: string;
    tone: string;
  }>;
  estimatedCost?: number;
}

interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
  platform: string;
  scheduledFor: string;
  targetKeywords: string[];
  contentType: string;
  tone: string;
  imagePrompt?: string;
}

// Helper function to generate content prompts with variety
function generateContentPrompts(request: BulkPostingRequest): Array<{
  keywords: string[];
  contentType: string;
  tone: string;
  platform: string;
  promptVariation: string;
}> {
  const prompts = [];
  const { totalPosts, targetKeywords, contentTypes, tones, platforms } = request;
  
  for (let i = 0; i < totalPosts; i++) {
    // Rotate through content types, tones, and platforms
    const contentType = contentTypes[i % contentTypes.length];
    const tone = tones[i % tones.length];
    const platform = platforms[i % platforms.length];
    
    // Rotate keywords or use different combinations
    let keywords: string[];
    if (request.keywordRotation && targetKeywords.length > 1) {
      // Use different keyword combinations
      const keywordIndex = i % targetKeywords.length;
      keywords = [targetKeywords[keywordIndex]];
      
      // Add secondary keywords occasionally
      if (i % 3 === 0 && targetKeywords.length > 2) {
        const secondaryIndex = (i + 1) % targetKeywords.length;
        if (secondaryIndex !== keywordIndex) {
          keywords.push(targetKeywords[secondaryIndex]);
        }
      }
    } else {
      keywords = targetKeywords;
    }
    
    // Generate variety in prompts based on diversity level
    let promptVariation = '';
    if (request.diversityLevel === 'high') {
      const variations = [
        'Focus on customer benefits and value proposition',
        'Share behind-the-scenes insights',
        'Include statistics or industry facts',
        'Tell a customer success story',
        'Address common questions or concerns',
        'Highlight unique selling points',
        'Share tips and best practices',
        'Discuss industry trends',
        'Feature team expertise',
        'Showcase community involvement'
      ];
      promptVariation = variations[i % variations.length];
    } else if (request.diversityLevel === 'medium') {
      const variations = [
        'Focus on benefits',
        'Share insights',
        'Include facts',
        'Address questions',
        'Highlight uniqueness'
      ];
      promptVariation = variations[i % variations.length];
    }
    
    prompts.push({
      keywords,
      contentType,
      tone,
      platform,
      promptVariation
    });
  }
  
  return prompts;
}

// Helper function to generate schedule
function generateSchedule(request: BulkPostingRequest): Array<{
  date: string;
  time: string;
  dayOfWeek: string;
}> {
  const schedule = [];
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const { postsPerDay, preferredTimes, skipWeekends } = request;
  
  const currentDate = new Date(startDate);
  let postCount = 0;
  
  while (currentDate <= endDate && postCount < request.totalPosts) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Skip weekends if requested
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Schedule posts for this day
    const postsForThisDay = Math.min(postsPerDay, request.totalPosts - postCount);
    
    for (let i = 0; i < postsForThisDay; i++) {
      const timeIndex = i % preferredTimes.length;
      const scheduledTime = preferredTimes[timeIndex];
      
      schedule.push({
        date: currentDate.toISOString().split('T')[0],
        time: scheduledTime,
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
      });
      
      postCount++;
      if (postCount >= request.totalPosts) break;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return schedule;
}

// Helper function to call OpenAI API for bulk content generation
async function generateBulkContent(prompts: any[], businessContext: any): Promise<string[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const batchPrompts = prompts.map((prompt, index) => {
    const systemPrompt = `You are an expert social media content creator specializing in local business marketing and SEO optimization. Create engaging, authentic content that naturally incorporates target keywords while maintaining readability and engagement.

Business Context:
- Business: ${businessContext.businessName}
- Type: ${businessContext.businessType}
- Location: ${businessContext.targetLocation}

Create a ${prompt.platform} post with the following specifications:
- Content Type: ${prompt.contentType}
- Tone: ${prompt.tone}
- Keywords to include: ${prompt.keywords.join(', ')}
- Platform: ${prompt.platform}
- Special focus: ${prompt.promptVariation}

Requirements:
- Keep within platform character limits
- Include natural keyword integration
- Make it engaging and authentic
- Include a clear call to action
- Return only the post content, no hashtags (they will be generated separately)`;

    return {
      role: 'user',
      content: systemPrompt
    };
  });

  // Process in batches to avoid rate limits
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < batchPrompts.length; i += batchSize) {
    const batch = batchPrompts.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (prompt) => {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert social media content creator. Create engaging, authentic content.'
            },
            prompt
          ],
          max_tokens: 500,
          temperature: 0.8, // Higher temperature for more variety
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < batchPrompts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Helper function to generate hashtags for posts
async function generateHashtagsForPosts(posts: any[], businessContext: any): Promise<string[][]> {
  if (!OPENAI_API_KEY) {
    return posts.map(() => []); // Return empty arrays if no API key
  }

  const hashtagPromises = posts.map(async (post) => {
    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Generate relevant hashtags for social media posts. Return 5-8 hashtags separated by spaces, with # symbols included.'
            },
            {
              role: 'user',
              content: `Generate hashtags for this ${post.platform} post about ${businessContext.businessType} business targeting keywords: ${post.targetKeywords.join(', ')}

Post content: "${post.content}"

Include location-based hashtags for ${businessContext.targetLocation} and relevant industry hashtags.`
            }
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim().split(' ').filter((tag: string) => tag.startsWith('#'));
      }
    } catch (error) {
      console.error('Error generating hashtags:', error);
    }
    
    // Fallback hashtags
    return [`#${businessContext.businessType.replace(/\s+/g, '')}`, `#${businessContext.targetLocation.replace(/\s+/g, '')}`];
  });

  return Promise.all(hashtagPromises);
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
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

    const request: BulkPostingRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    const requiredFields = ['campaignName', 'totalPosts', 'startDate', 'endDate', 'businessName', 'targetKeywords', 'platforms'];
    for (const field of requiredFields) {
      if (!request[field as keyof BulkPostingRequest]) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: `Missing required field: ${field}` }),
        };
      }
    }

    // Validate totalPosts limit
    if (request.totalPosts > 100) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Maximum 100 posts allowed per bulk creation' }),
      };
    }

    const campaignId = `campaign_${Date.now()}_${user.id.slice(-8)}`;
    const errors: string[] = [];
    let postsCreated = 0;
    let postsScheduled = 0;

    try {
      // Generate schedule
      const schedule = generateSchedule(request);
      
      if (schedule.length < request.totalPosts) {
        errors.push(`Could only schedule ${schedule.length} posts in the specified date range`);
      }

      // Generate content prompts with variety
      const contentPrompts = generateContentPrompts(request);

      // Generate all content using AI
      const businessContext = {
        businessName: request.businessName,
        businessType: request.businessType,
        targetLocation: request.targetLocation
      };

      const generatedContent = await generateBulkContent(contentPrompts, businessContext);

      // Combine generated content with schedule
      const postsToCreate: GeneratedPost[] = [];
      const actualPostCount = Math.min(schedule.length, generatedContent.length, request.totalPosts);

      for (let i = 0; i < actualPostCount; i++) {
        const scheduleItem = schedule[i];
        const contentPrompt = contentPrompts[i];
        const content = generatedContent[i];

        const scheduledDateTime = new Date(`${scheduleItem.date}T${scheduleItem.time}:00`);

        postsToCreate.push({
          title: `${request.campaignName} - Post ${i + 1}`,
          content: content,
          hashtags: [], // Will be generated separately
          platform: contentPrompt.platform,
          scheduledFor: scheduledDateTime.toISOString(),
          targetKeywords: contentPrompt.keywords,
          contentType: contentPrompt.contentType,
          tone: contentPrompt.tone,
          imagePrompt: request.includeImages ? `Professional ${request.businessType} image for ${contentPrompt.contentType} social media post` : undefined
        });
      }

      // Generate hashtags for all posts
      const allHashtags = await generateHashtagsForPosts(postsToCreate, businessContext);
      postsToCreate.forEach((post, index) => {
        post.hashtags = allHashtags[index] || [];
      });

      // Save posts to database
      const postsForDatabase = postsToCreate.map(post => ({
        user_id: user.id,
        title: post.title,
        platform: post.platform,
        content: post.content,
        hashtags: post.hashtags,
        target_keywords: post.targetKeywords,
        target_location: request.targetLocation,
        generation_method: 'ai_keyword',
        ai_prompt: `Bulk campaign: ${request.campaignName}`,
        scheduled_for: post.scheduledFor,
        status: 'scheduled',
        syndicated_to: [],
        images: post.imagePrompt ? [{ type: 'ai_prompt', prompt: post.imagePrompt }] : []
      }));

      // Insert posts in batches
      const batchSize = 10;
      for (let i = 0; i < postsForDatabase.length; i += batchSize) {
        const batch = postsForDatabase.slice(i, i + batchSize);
        
        try {
          const { data, error } = await supabase
            .from('social_media_posts')
            .insert(batch);

          if (error) {
            errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            postsCreated += batch.length;
            postsScheduled += batch.length;
          }
        } catch (error) {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Create response schedule for preview
      const responseSchedule = schedule.slice(0, actualPostCount).map((scheduleItem, index) => ({
        date: scheduleItem.date,
        time: scheduleItem.time,
        platform: contentPrompts[index].platform,
        title: postsToCreate[index].title,
        keywords: contentPrompts[index].keywords,
        contentType: contentPrompts[index].contentType,
        tone: contentPrompts[index].tone
      }));

      const response: BulkPostingResponse = {
        success: postsCreated > 0,
        campaignId,
        postsCreated,
        postsScheduled,
        errors,
        schedule: responseSchedule,
        estimatedCost: postsCreated * 0.02 // Rough estimate for AI generation costs
      };

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(response),
      };

    } catch (error) {
      console.error('Bulk posting generation error:', error);
      
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          campaignId,
          postsCreated,
          postsScheduled,
          errors: [...errors, `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          schedule: []
        }),
      };
    }

  } catch (error) {
    console.error('Bulk posting API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to create bulk posts',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
