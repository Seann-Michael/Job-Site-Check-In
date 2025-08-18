import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GMBProfileAnalysis {
  business_quality_score: number;
  lead_potential_score: number;
  contact_completeness: number;
  business_verification_score: number;
  engagement_score: number;
  competition_level: 'low' | 'medium' | 'high';
  recommended_approach: string[];
  risk_factors: string[];
  opportunities: string[];
}

interface BusinessHoursAnalysis {
  is_open_24_7: boolean;
  operating_days: number;
  weekend_hours: boolean;
  extended_hours: boolean;
  average_daily_hours: number;
}

interface CategoryAnalysis {
  primary_category: string;
  category_competition: 'low' | 'medium' | 'high';
  seasonal_business: boolean;
  local_service: boolean;
  b2b_potential: boolean;
  b2c_potential: boolean;
}

interface LocationAnalysis {
  population_density: 'low' | 'medium' | 'high';
  commercial_area: boolean;
  tourist_area: boolean;
  accessibility_score: number;
  parking_availability: 'unknown' | 'limited' | 'adequate' | 'abundant';
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Helper function to get user from token
async function getUserFromAuth(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid token');
  }
  
  return user;
}

// Analyze business hours data
function analyzeBusinessHours(hours: any): BusinessHoursAnalysis {
  if (!hours || !hours.periods) {
    return {
      is_open_24_7: false,
      operating_days: 0,
      weekend_hours: false,
      extended_hours: false,
      average_daily_hours: 0,
    };
  }

  const periods = hours.periods;
  const days = new Set();
  let totalHours = 0;
  let extendedHoursCount = 0;
  let weekendHours = false;

  periods.forEach((period: any) => {
    if (period.open && period.close) {
      days.add(period.open.day);
      
      // Calculate hours for this period
      const openTime = period.open.time || '0000';
      const closeTime = period.close.time || '2359';
      
      const openHour = parseInt(openTime.substring(0, 2));
      const closeHour = parseInt(closeTime.substring(0, 2));
      
      let dailyHours = closeHour - openHour;
      if (dailyHours < 0) dailyHours += 24; // Handle overnight periods
      
      totalHours += dailyHours;
      
      // Check for extended hours (open before 7 AM or after 9 PM)
      if (openHour < 7 || closeHour > 21) {
        extendedHoursCount++;
      }
      
      // Check for weekend hours (Saturday = 6, Sunday = 0)
      if (period.open.day === 0 || period.open.day === 6) {
        weekendHours = true;
      }
    }
  });

  const operatingDays = days.size;
  const averageDailyHours = operatingDays > 0 ? totalHours / operatingDays : 0;
  const is24_7 = operatingDays === 7 && averageDailyHours >= 23;

  return {
    is_open_24_7: is24_7,
    operating_days: operatingDays,
    weekend_hours: weekendHours,
    extended_hours: extendedHoursCount > 0,
    average_daily_hours: Math.round(averageDailyHours * 10) / 10,
  };
}

// Analyze business category
function analyzeCategory(types: string[] = [], category: string): CategoryAnalysis {
  const allTypes = [...types, category].filter(Boolean);
  
  // Service-based businesses
  const serviceTypes = [
    'plumber', 'electrician', 'lawyer', 'doctor', 'dentist', 'veterinarian',
    'accounting', 'consulting', 'real_estate_agency', 'insurance_agency'
  ];
  
  // Retail businesses
  const retailTypes = [
    'store', 'shopping_mall', 'clothing_store', 'electronics_store',
    'furniture_store', 'grocery_or_supermarket', 'pharmacy'
  ];
  
  // Tourism-related
  const tourismTypes = [
    'tourist_attraction', 'hotel', 'restaurant', 'travel_agency',
    'amusement_park', 'museum', 'art_gallery'
  ];

  // Seasonal businesses
  const seasonalTypes = [
    'swimming_pool', 'ski_resort', 'campground', 'ice_cream_shop',
    'landscaping', 'pool_maintenance'
  ];

  const isService = allTypes.some(type => serviceTypes.includes(type));
  const isRetail = allTypes.some(type => retailTypes.includes(type));
  const isTourism = allTypes.some(type => tourismTypes.includes(type));
  const isSeasonal = allTypes.some(type => seasonalTypes.includes(type));

  // Determine competition level based on category
  const highCompetitionTypes = [
    'restaurant', 'bar', 'gas_station', 'convenience_store',
    'hair_care', 'beauty_salon', 'real_estate_agency'
  ];
  
  const lowCompetitionTypes = [
    'veterinarian', 'plumber', 'electrician', 'locksmith',
    'towing_service', 'funeral_home', 'storage'
  ];

  let competition: 'low' | 'medium' | 'high' = 'medium';
  if (allTypes.some(type => highCompetitionTypes.includes(type))) {
    competition = 'high';
  } else if (allTypes.some(type => lowCompetitionTypes.includes(type))) {
    competition = 'low';
  }

  return {
    primary_category: category || types[0] || 'business',
    category_competition: competition,
    seasonal_business: isSeasonal,
    local_service: isService,
    b2b_potential: isService || allTypes.includes('accounting') || allTypes.includes('consulting'),
    b2c_potential: isRetail || isTourism || allTypes.includes('restaurant'),
  };
}

// Calculate business quality score
function calculateBusinessQualityScore(lead: any): number {
  let score = 0;
  const maxScore = 100;

  // Rating score (30 points)
  if (lead.rating) {
    score += (lead.rating / 5) * 30;
  }

  // Review count score (20 points)
  if (lead.review_count) {
    const reviewScore = Math.min(lead.review_count / 100, 1) * 20;
    score += reviewScore;
  }

  // Verification score (20 points)
  if (lead.verified) {
    score += 20;
  }

  // Photos score (10 points)
  if (lead.photos && lead.photos.length > 0) {
    const photoScore = Math.min(lead.photos.length / 10, 1) * 10;
    score += photoScore;
  }

  // Hours information (10 points)
  if (lead.hours) {
    score += 10;
  }

  // Website presence (10 points)
  if (lead.website) {
    score += 10;
  }

  return Math.round(score);
}

// Calculate lead potential score
function calculateLeadPotentialScore(lead: any, categoryAnalysis: CategoryAnalysis): number {
  let score = 0;

  // Business type potential (40 points)
  if (categoryAnalysis.b2b_potential && categoryAnalysis.local_service) {
    score += 40;
  } else if (categoryAnalysis.b2c_potential && !categoryAnalysis.seasonal_business) {
    score += 35;
  } else if (categoryAnalysis.b2b_potential || categoryAnalysis.b2c_potential) {
    score += 25;
  } else {
    score += 15;
  }

  // Contact information availability (30 points)
  if (lead.phone) score += 15;
  if (lead.email) score += 10;
  if (lead.website) score += 5;

  // Competition level (20 points)
  switch (categoryAnalysis.category_competition) {
    case 'low':
      score += 20;
      break;
    case 'medium':
      score += 15;
      break;
    case 'high':
      score += 10;
      break;
  }

  // Business activity (10 points)
  if (lead.rating && lead.review_count > 10) {
    score += 10;
  } else if (lead.rating && lead.review_count > 0) {
    score += 7;
  } else if (lead.verified) {
    score += 5;
  }

  return Math.round(score);
}

// Calculate contact completeness
function calculateContactCompleteness(lead: any): number {
  const fields = ['phone', 'email', 'website', 'address'];
  const completedFields = fields.filter(field => lead[field] && lead[field] !== '');
  return Math.round((completedFields.length / fields.length) * 100);
}

// Generate business recommendations
function generateRecommendations(
  lead: any,
  categoryAnalysis: CategoryAnalysis,
  qualityScore: number,
  potentialScore: number
): {
  recommended_approach: string[];
  risk_factors: string[];
  opportunities: string[];
} {
  const approach: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];

  // Approach recommendations
  if (potentialScore >= 70) {
    approach.push('High-priority lead - direct outreach recommended');
    approach.push('Consider premium service offerings');
  } else if (potentialScore >= 50) {
    approach.push('Medium-priority lead - email/social media approach');
    approach.push('Focus on value proposition');
  } else {
    approach.push('Low-priority lead - automated nurturing sequence');
    approach.push('Build relationship gradually');
  }

  if (categoryAnalysis.b2b_potential) {
    approach.push('Business-focused messaging and case studies');
    approach.push('LinkedIn outreach may be effective');
  }

  if (categoryAnalysis.local_service) {
    approach.push('Emphasize local SEO and community presence');
    approach.push('Local networking and referrals recommended');
  }

  // Risk factors
  if (categoryAnalysis.category_competition === 'high') {
    risks.push('High competition in this category');
  }

  if (categoryAnalysis.seasonal_business) {
    risks.push('Seasonal business - timing is crucial');
  }

  if (qualityScore < 40) {
    risks.push('Low business quality score - may indicate inactive business');
  }

  if (!lead.phone && !lead.email) {
    risks.push('Limited contact information available');
  }

  if (!lead.verified) {
    risks.push('Business not verified on Google - may be inactive');
  }

  // Opportunities
  if (lead.review_count < 10) {
    opportunities.push('Opportunity to help with review generation');
  }

  if (!lead.website) {
    opportunities.push('Website development opportunity');
  }

  if (!lead.photos || lead.photos.length < 5) {
    opportunities.push('Business photography services opportunity');
  }

  if (categoryAnalysis.local_service && qualityScore > 60) {
    opportunities.push('Strong candidate for local SEO services');
  }

  if (categoryAnalysis.b2b_potential && potentialScore > 50) {
    opportunities.push('Potential for ongoing business relationship');
  }

  return {
    recommended_approach: approach,
    risk_factors: risks,
    opportunities: opportunities,
  };
}

// Main analysis function
function analyzeGMBProfile(lead: any): GMBProfileAnalysis {
  const categoryAnalysis = analyzeCategory(lead.attributes?.types, lead.category);
  const qualityScore = calculateBusinessQualityScore(lead);
  const potentialScore = calculateLeadPotentialScore(lead, categoryAnalysis);
  const contactCompleteness = calculateContactCompleteness(lead);
  
  // Verification score based on multiple factors
  let verificationScore = 0;
  if (lead.verified) verificationScore += 40;
  if (lead.rating && lead.review_count > 0) verificationScore += 30;
  if (lead.photos && lead.photos.length > 0) verificationScore += 20;
  if (lead.hours) verificationScore += 10;

  // Engagement score based on reviews and activity
  let engagementScore = 0;
  if (lead.review_count > 0) {
    engagementScore = Math.min((lead.review_count / 50) * 100, 100);
  }

  const recommendations = generateRecommendations(
    lead,
    categoryAnalysis,
    qualityScore,
    potentialScore
  );

  return {
    business_quality_score: qualityScore,
    lead_potential_score: potentialScore,
    contact_completeness: contactCompleteness,
    business_verification_score: verificationScore,
    engagement_score: Math.round(engagementScore),
    competition_level: categoryAnalysis.category_competition,
    ...recommendations,
  };
}

// POST /api/gmb-data-processor/analyze - Analyze single GMB profile
async function analyzeProfile(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const { lead_id } = JSON.parse(event.body || '{}');
    
    if (!lead_id) {
      throw new Error('Lead ID is required');
    }

    // Get lead data
    const { data: lead, error } = await supabase
      .from('gmb_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (error || !lead) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Lead not found' }),
      };
    }

    // Perform analysis
    const analysis = analyzeGMBProfile(lead);

    // Update lead with analysis results
    const { error: updateError } = await supabase
      .from('gmb_leads')
      .update({
        attributes: {
          ...lead.attributes,
          analysis: analysis,
          analyzed_at: new Date().toISOString(),
        },
      })
      .eq('id', lead_id);

    if (updateError) {
      console.error('Error updating lead with analysis:', updateError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: analysis,
        lead_id,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// POST /api/gmb-data-processor/batch-analyze - Analyze multiple GMB profiles
async function batchAnalyzeProfiles(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const { lead_ids, limit = 50 } = JSON.parse(event.body || '{}');
    
    if (!lead_ids || !Array.isArray(lead_ids)) {
      throw new Error('Lead IDs array is required');
    }

    if (lead_ids.length > limit) {
      throw new Error(`Maximum ${limit} leads can be analyzed at once`);
    }

    // Get leads data
    const { data: leads, error } = await supabase
      .from('gmb_leads')
      .select('*')
      .in('id', lead_ids);

    if (error) {
      throw error;
    }

    if (!leads || leads.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No leads found' }),
      };
    }

    // Analyze each lead
    const analyses = leads.map(lead => ({
      lead_id: lead.id,
      analysis: analyzeGMBProfile(lead),
    }));

    // Update leads with analysis results (in batches)
    const updatePromises = leads.map(lead => {
      const analysis = analyses.find(a => a.lead_id === lead.id)?.analysis;
      if (!analysis) return Promise.resolve();

      return supabase
        .from('gmb_leads')
        .update({
          attributes: {
            ...lead.attributes,
            analysis: analysis,
            analyzed_at: new Date().toISOString(),
          },
        })
        .eq('id', lead.id);
    });

    await Promise.all(updatePromises);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: analyses,
        processed: analyses.length,
        total_requested: lead_ids.length,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// GET /api/gmb-data-processor/analytics - Get aggregated analysis data
async function getAnalyticsData(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Get user profile to check permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Only super admins can view full analytics
    if (profile?.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }

    // Get leads with analysis data
    const { data: leads, error } = await supabase
      .from('gmb_leads')
      .select('id, attributes, category, rating, review_count, verified')
      .not('attributes->>analysis', 'is', null);

    if (error) {
      throw error;
    }

    if (!leads || leads.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          data: {
            total_analyzed: 0,
            quality_distribution: {},
            potential_distribution: {},
            category_breakdown: {},
            competition_analysis: {},
          },
        }),
      };
    }

    // Aggregate analytics
    const qualityDistribution = { high: 0, medium: 0, low: 0 };
    const potentialDistribution = { high: 0, medium: 0, low: 0 };
    const categoryBreakdown: Record<string, number> = {};
    const competitionAnalysis = { low: 0, medium: 0, high: 0 };

    leads.forEach(lead => {
      const analysis = lead.attributes?.analysis;
      if (!analysis) return;

      // Quality distribution
      if (analysis.business_quality_score >= 70) {
        qualityDistribution.high++;
      } else if (analysis.business_quality_score >= 40) {
        qualityDistribution.medium++;
      } else {
        qualityDistribution.low++;
      }

      // Potential distribution
      if (analysis.lead_potential_score >= 70) {
        potentialDistribution.high++;
      } else if (analysis.lead_potential_score >= 40) {
        potentialDistribution.medium++;
      } else {
        potentialDistribution.low++;
      }

      // Category breakdown
      const category = lead.category || 'unknown';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

      // Competition analysis
      if (analysis.competition_level) {
        competitionAnalysis[analysis.competition_level]++;
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: {
          total_analyzed: leads.length,
          quality_distribution: qualityDistribution,
          potential_distribution: potentialDistribution,
          category_breakdown: categoryBreakdown,
          competition_analysis: competitionAnalysis,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/api/', '');
  const pathParts = path.split('/');

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (pathParts[0] === 'gmb-data-processor' && pathParts[1] === 'analytics') {
          return await getAnalyticsData(event);
        }
        break;

      case 'POST':
        if (pathParts[0] === 'gmb-data-processor' && pathParts[1] === 'analyze') {
          return await analyzeProfile(event);
        }
        if (pathParts[0] === 'gmb-data-processor' && pathParts[1] === 'batch-analyze') {
          return await batchAnalyzeProfiles(event);
        }
        break;
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
