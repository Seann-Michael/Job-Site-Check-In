import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OpenAI DALL-E API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface ImageGenerationRequest {
  prompt: string;
  businessName: string;
  businessType: string;
  platform: 'gmb' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  style: 'professional' | 'modern' | 'creative' | 'minimalist' | 'vibrant' | 'corporate';
  includeText?: boolean;
  brandColors?: string[]; // Hex color codes
  imageType: 'service_showcase' | 'behind_scenes' | 'team_photo' | 'product_display' | 'location_shot' | 'promotional' | 'educational';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

interface GeneratedImage {
  imageUrl: string;
  revisedPrompt: string;
  generationId: string;
  dimensions: {
    width: number;
    height: number;
  };
  suggestedUsage: string[];
  alternativePrompts: string[];
}

// Helper function to optimize prompts for business imagery
function optimizeImagePrompt(request: ImageGenerationRequest): string {
  const { prompt, businessName, businessType, platform, style, includeText, brandColors, imageType } = request;

  // Platform-specific optimizations
  const platformSpecs = {
    gmb: {
      aspectRatio: 'square format (1:1)',
      focus: 'local business appeal, clear and professional',
      recommendations: 'suitable for Google My Business posts, high local relevance'
    },
    facebook: {
      aspectRatio: 'landscape format (16:9) or square (1:1)',
      focus: 'eye-catching and shareable, community-focused',
      recommendations: 'optimized for Facebook feed, engaging and social'
    },
    instagram: {
      aspectRatio: 'square format (1:1) or vertical (4:5)',
      focus: 'visually stunning, Instagram-aesthetic',
      recommendations: 'high visual appeal, story-worthy, aesthetically pleasing'
    },
    twitter: {
      aspectRatio: 'landscape format (16:9)',
      focus: 'clear and concise visual message',
      recommendations: 'works well in Twitter feed, quick visual impact'
    },
    linkedin: {
      aspectRatio: 'landscape format (16:9) or square (1:1)',
      focus: 'professional and business-oriented',
      recommendations: 'appropriate for professional network, credible and authoritative'
    }
  };

  // Style descriptions
  const styleDescriptions = {
    professional: 'clean, business-appropriate, polished, high-quality',
    modern: 'contemporary design, sleek, current trends, fresh look',
    creative: 'artistic, unique perspective, innovative, original',
    minimalist: 'simple, clean lines, uncluttered, elegant simplicity',
    vibrant: 'bright colors, energetic, bold, eye-catching',
    corporate: 'formal, established, trustworthy, traditional business'
  };

  // Image type specific guidance
  const imageTypeGuidance = {
    service_showcase: 'showcasing the business service in action, demonstrating expertise and quality',
    behind_scenes: 'authentic workplace moments, team at work, genuine business operations',
    team_photo: 'professional team members, friendly and approachable, business environment',
    product_display: 'high-quality product presentation, appealing arrangement, commercial photography style',
    location_shot: 'business location exterior or interior, welcoming atmosphere, local context',
    promotional: 'marketing-focused imagery, compelling visual call-to-action, sales-oriented',
    educational: 'informative visual content, instructional elements, knowledge-sharing focus'
  };

  // Build enhanced prompt
  let enhancedPrompt = `Create a ${style} ${styleDescriptions[style]} image for a ${businessType} business named "${businessName}". `;
  
  // Add image type guidance
  enhancedPrompt += `This is a ${imageType.replace('_', ' ')} image that should be ${imageTypeGuidance[imageType]}. `;
  
  // Add the original prompt
  enhancedPrompt += prompt + '. ';
  
  // Add platform optimization
  enhancedPrompt += `Optimized for ${platform} - ${platformSpecs[platform].focus}, ${platformSpecs[platform].aspectRatio}. `;
  
  // Add technical specifications
  enhancedPrompt += 'High-resolution, professional photography quality, commercial use appropriate. ';
  
  // Add brand colors if specified
  if (brandColors && brandColors.length > 0) {
    enhancedPrompt += `Incorporate brand colors: ${brandColors.join(', ')}. `;
  }
  
  // Add text inclusion guidance
  if (includeText) {
    enhancedPrompt += 'Include space for overlay text or subtle text elements. ';
  } else {
    enhancedPrompt += 'Focus on imagery without text elements. ';
  }
  
  // Add quality and style modifiers
  enhancedPrompt += 'Photorealistic, well-lit, professional composition, marketing-ready quality.';

  return enhancedPrompt;
}

// Generate alternative prompts for variety
function generateAlternativePrompts(originalPrompt: string, request: ImageGenerationRequest): string[] {
  const alternatives = [];
  const { businessType, imageType, style } = request;

  // Different angle variations
  const angleVariations = [
    `Wide shot: ${originalPrompt}`,
    `Close-up detail: ${originalPrompt}`,
    `Bird's eye view: ${originalPrompt}`,
    `Side angle perspective: ${originalPrompt}`
  ];

  // Different style variations
  const styleVariations = [
    originalPrompt.replace(style, 'modern minimalist'),
    originalPrompt.replace(style, 'warm and inviting'),
    originalPrompt.replace(style, 'bold and dynamic'),
    originalPrompt.replace(style, 'elegant and sophisticated')
  ];

  // Different composition variations
  const compositionVariations = [
    `${originalPrompt}, centered composition`,
    `${originalPrompt}, rule of thirds composition`,
    `${originalPrompt}, symmetrical layout`,
    `${originalPrompt}, asymmetrical dynamic layout`
  ];

  // Select 3 best alternatives
  alternatives.push(angleVariations[0], styleVariations[1], compositionVariations[2]);
  
  return alternatives;
}

// Helper function to call DALL-E API
async function generateImageWithDALLE(prompt: string, size: string = '1024x1024', quality: string = 'standard'): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
      response_format: 'url'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DALL-E API error: ${error}`);
  }

  const data = await response.json();
  return data;
}

// Helper function to save image to Supabase storage
async function saveImageToStorage(imageUrl: string, userId: string, filename: string): Promise<string> {
  try {
    // Download the image from OpenAI
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFilename = `${userId}/${timestamp}_${filename}.png`;
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('social-media-assets')
      .upload(uniqueFilename, imageBuffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      throw new Error(`Storage upload error: ${error.message}`);
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('social-media-assets')
      .getPublicUrl(uniqueFilename);

    return publicData.publicUrl;
  } catch (error) {
    console.error('Error saving image to storage:', error);
    // Return original URL if storage fails
    return imageUrl;
  }
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

    const request: ImageGenerationRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!request.prompt || !request.businessName || !request.platform) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Missing required fields: prompt, businessName, platform' 
        }),
      };
    }

    const startTime = Date.now();

    // Optimize the prompt for better business imagery
    const optimizedPrompt = optimizeImagePrompt(request);
    
    // Generate the image
    const dalleResponse = await generateImageWithDALLE(
      optimizedPrompt, 
      request.size || '1024x1024',
      request.quality || 'standard'
    );

    const imageData = dalleResponse.data[0];
    
    // Save image to storage and get permanent URL
    const filename = `${request.imageType}_${request.platform}_${Date.now()}`;
    const permanentUrl = await saveImageToStorage(imageData.url, user.id, filename);
    
    // Generate alternative prompts for future use
    const alternativePrompts = generateAlternativePrompts(optimizedPrompt, request);
    
    // Generate usage suggestions
    const usageSuggestions = [
      `Perfect for ${request.platform} ${request.imageType.replace('_', ' ')} content`,
      `Use as hero image for business promotion`,
      `Great for social media campaigns`,
      `Suitable for website and marketing materials`
    ];

    const generationTime = Date.now() - startTime;

    // Save to media assets table
    await supabase.from('media_assets').insert({
      user_id: user.id,
      filename: filename,
      original_filename: `generated_${request.imageType}`,
      file_size: null, // We could calculate this if needed
      mime_type: 'image/png',
      storage_path: permanentUrl,
      storage_bucket: 'social-media-assets',
      public_url: permanentUrl,
      width: parseInt(request.size?.split('x')[0] || '1024'),
      height: parseInt(request.size?.split('x')[1] || '1024'),
      source_type: 'ai_generated',
      ai_prompt: optimizedPrompt,
      ai_model_used: 'dall-e-3',
      generation_config: {
        original_prompt: request.prompt,
        style: request.style,
        platform: request.platform,
        image_type: request.imageType,
        quality: request.quality || 'standard',
        size: request.size || '1024x1024'
      },
      description: `AI-generated ${request.imageType.replace('_', ' ')} image for ${request.businessName}`,
      tags: [request.platform, request.imageType, request.style, 'ai-generated']
    });

    // Save generation history
    await supabase.from('ai_generation_history').insert({
      user_id: user.id,
      generation_type: 'image',
      model_used: 'dall-e-3',
      user_prompt: request.prompt,
      target_keywords: [],
      business_context: {
        business_name: request.businessName,
        business_type: request.businessType,
        platform: request.platform,
        image_type: request.imageType,
        style: request.style
      },
      generated_content: permanentUrl,
      generation_metadata: {
        optimized_prompt: optimizedPrompt,
        revised_prompt: imageData.revised_prompt,
        dimensions: {
          width: parseInt(request.size?.split('x')[0] || '1024'),
          height: parseInt(request.size?.split('x')[1] || '1024')
        },
        alternative_prompts: alternativePrompts
      },
      generation_time_ms: generationTime
    });

    const result: GeneratedImage = {
      imageUrl: permanentUrl,
      revisedPrompt: imageData.revised_prompt || optimizedPrompt,
      generationId: imageData.revised_prompt || 'generated', // DALL-E doesn't return an ID
      dimensions: {
        width: parseInt(request.size?.split('x')[0] || '1024'),
        height: parseInt(request.size?.split('x')[1] || '1024')
      },
      suggestedUsage: usageSuggestions,
      alternativePrompts
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
    console.error('Image generation error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to generate image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
