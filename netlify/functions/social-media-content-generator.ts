import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface ContentGenerationRequest {
  platform: 'gmb' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  targetKeywords: string[];
  businessName: string;
  businessType: string;
  targetLocation: string;
  contentType: 'promotional' | 'educational' | 'engagement' | 'behind-scenes' | 'announcement';
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'conversational';
  callToAction: string;
  additionalContext?: string;
  templateId?: string;
  customPrompt?: string;
}

interface GeneratedContent {
  content: string;
  hashtags: string[];
  characterCount: number;
  suggestedImages: string[];
  engagementTips: string[];
}

// Helper function to call OpenAI API
async function generateContentWithOpenAI(prompt: string, maxTokens: number): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

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
          content: `You are an expert social media content creator specializing in local business marketing and SEO optimization. Create engaging, authentic content that naturally incorporates target keywords while maintaining readability and engagement. Focus on local SEO best practices and authentic business storytelling.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Helper function to generate hashtags
async function generateHashtags(keywords: string[], businessType: string, location: string): Promise<string[]> {
  const prompt = `Generate 8-12 relevant hashtags for a ${businessType} business in ${location} targeting these keywords: ${keywords.join(', ')}. 
  
  Include:
  - 2-3 keyword-specific hashtags
  - 2-3 location-based hashtags
  - 2-3 business type hashtags
  - 2-3 broader engagement hashtags
  
  Format as a simple list separated by commas, with # symbols included.`;

  const hashtagsText = await generateContentWithOpenAI(prompt, 150);
  return hashtagsText.split(',').map(tag => tag.trim()).filter(tag => tag.startsWith('#'));
}

// Platform-specific content generation
function buildPlatformPrompt(request: ContentGenerationRequest): { prompt: string; maxLength: number } {
  const { platform, targetKeywords, businessName, businessType, targetLocation, contentType, tone, callToAction, additionalContext } = request;

  const baseContext = `
Business: ${businessName}
Type: ${businessType}
Location: ${targetLocation}
Target Keywords: ${keywords.join(', ')}
Content Type: ${contentType}
Tone: ${tone}
Call to Action: ${callToAction}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}
  `.trim();

  let platformInstructions = '';
  let maxLength = 1000;

  switch (platform) {
    case 'gmb':
      platformInstructions = `
Create a Google My Business update (maximum 1500 characters) that:
- Naturally incorporates the target keywords for local SEO
- Highlights the business's expertise and value proposition
- Includes a clear call to action
- Maintains a helpful, professional tone
- Avoids overly promotional language
- Focuses on how the business serves the local community
- Could include information about services, tips, or business updates
      `;
      maxLength = 1500;
      break;

    case 'facebook':
      platformInstructions = `
Create a Facebook post that:
- Engages the local community with authentic storytelling
- Naturally weaves in target keywords
- Encourages comments, shares, and engagement
- Uses emojis strategically for visual appeal
- Includes a strong call to action
- Builds trust and showcases personality
- Is conversational and community-focused
- Can be slightly longer and more detailed than other platforms
      `;
      maxLength = 2000;
      break;

    case 'instagram':
      platformInstructions = `
Create an Instagram caption that:
- Is visually descriptive and engaging
- Uses strategic emojis and line breaks for readability
- Incorporates target keywords naturally
- Encourages user interaction through questions or calls to action
- Has a strong opening hook
- Is optimized for the Instagram algorithm
- Includes relevant hashtags (these will be generated separately)
      `;
      maxLength = 2200;
      break;

    case 'twitter':
      platformInstructions = `
Create a Twitter/X post that:
- Is concise and punchy (under 280 characters)
- Incorporates 1-2 target keywords naturally
- Includes a clear call to action
- Uses relevant emojis
- Encourages retweets and engagement
- Has a strong hook in the first few words
      `;
      maxLength = 280;
      break;

    case 'linkedin':
      platformInstructions = `
Create a professional LinkedIn post that:
- Shares industry insights or business expertise
- Naturally incorporates target keywords
- Provides value to professional network
- Showcases thought leadership
- Includes a professional call to action
- Uses a more formal but engaging tone
- Can be educational or behind-the-scenes focused
      `;
      maxLength = 3000;
      break;
  }

  const prompt = `${baseContext}

${platformInstructions}

Generate engaging ${platform} content that incorporates these requirements. Do not include hashtags in the main content - they will be generated separately.`;

  return { prompt, maxLength };
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

    const request: ContentGenerationRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!request.platform || !request.businessName || !request.targetKeywords?.length) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Missing required fields: platform, businessName, targetKeywords' 
        }),
      };
    }

    // Check if using a template
    let templateContent = '';
    if (request.templateId) {
      const { data: template } = await supabase
        .from('post_templates')
        .select('content_template, ai_style, ai_tone, ai_focus')
        .eq('id', request.templateId)
        .eq('user_id', user.id)
        .single();

      if (template) {
        templateContent = template.content_template;
        // Override request settings with template settings if not provided
        if (!request.tone && template.ai_tone) {
          request.tone = template.ai_tone as any;
        }
      }
    }

    const startTime = Date.now();

    // Generate main content
    const { prompt, maxLength } = buildPlatformPrompt(request);
    let generatedContent: string;

    if (templateContent) {
      // Use template as base and enhance with AI
      const templatePrompt = `${prompt}

Use this template as a starting point and enhance it with AI:
"${templateContent}"

Replace placeholders like {{business_name}}, {{target_keyword}}, etc. with actual values and improve the content while maintaining the template structure.`;
      
      generatedContent = await generateContentWithOpenAI(templatePrompt, maxLength / 4);
    } else {
      generatedContent = await generateContentWithOpenAI(prompt, maxLength / 4);
    }

    // Generate hashtags
    const hashtags = await generateHashtags(request.targetKeywords, request.businessType, request.targetLocation);

    // Generate engagement tips
    const tipsPrompt = `Based on this ${request.platform} content for a ${request.businessType} business, provide 3-4 specific tips for maximizing engagement. Focus on timing, audience interaction, and platform-specific best practices.

Content: "${generatedContent}"`;

    const engagementTipsText = await generateContentWithOpenAI(tipsPrompt, 200);
    const engagementTips = engagementTipsText.split('\n').filter(tip => tip.trim().length > 0);

    // Suggest image types
    const imagePrompt = `Based on this ${request.platform} content for a ${request.businessType} business, suggest 3-4 types of images that would complement this post and drive engagement. Be specific about the visual elements.

Content: "${generatedContent}"`;

    const suggestedImagesText = await generateContentWithOpenAI(imagePrompt, 150);
    const suggestedImages = suggestedImagesText.split('\n').filter(img => img.trim().length > 0);

    const generationTime = Date.now() - startTime;

    // Save generation history
    await supabase.from('ai_generation_history').insert({
      user_id: user.id,
      generation_type: 'content',
      model_used: 'gpt-4',
      user_prompt: request.customPrompt || 'Auto-generated from request parameters',
      target_keywords: request.targetKeywords,
      business_context: {
        business_name: request.businessName,
        business_type: request.businessType,
        target_location: request.targetLocation,
        platform: request.platform,
        content_type: request.contentType,
        tone: request.tone
      },
      generated_content: generatedContent,
      generation_metadata: {
        hashtags,
        character_count: generatedContent.length,
        suggested_images: suggestedImages,
        engagement_tips: engagementTips
      },
      generation_time_ms: generationTime,
      tokens_used: Math.ceil(generatedContent.length / 4) // Rough estimate
    });

    const result: GeneratedContent = {
      content: generatedContent,
      hashtags,
      characterCount: generatedContent.length,
      suggestedImages,
      engagementTips
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Content generation error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to generate content',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
