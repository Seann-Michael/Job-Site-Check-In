import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DataForSEO API configuration
const DATAFORSEO_API_LOGIN = process.env.DATAFORSEO_API_LOGIN || '';
const DATAFORSEO_API_PASSWORD = process.env.DATAFORSEO_API_PASSWORD || '';
const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com/v3';

interface KeywordResearchRequest {
  seedKeywords: string[];
  location?: string;
  language?: string;
  includeRelated?: boolean;
  maxResults?: number;
  minSearchVolume?: number;
  maxDifficulty?: number;
}

interface KeywordData {
  keyword: string;
  search_volume: number;
  competition: number;
  competition_level: 'low' | 'medium' | 'high';
  cpc: number;
  difficulty: number;
  trend: number[];
  related_keywords: string[];
  search_intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }>;
}

interface KeywordCluster {
  id: string;
  name: string;
  primary_keyword: string;
  keywords: KeywordData[];
  total_search_volume: number;
  avg_difficulty: number;
  avg_cpc: number;
  search_intent: string;
  content_opportunities: string[];
}

interface KeywordResearchResponse {
  clusters: KeywordCluster[];
  total_keywords: number;
  processing_time_ms: number;
  source: 'dataforseo' | 'cache' | 'mock';
}

// Helper function to call DataForSEO API
async function callDataForSEOAPI(endpoint: string, data: any[]): Promise<any> {
  if (!DATAFORSEO_API_LOGIN || !DATAFORSEO_API_PASSWORD) {
    throw new Error('DataForSEO API credentials not configured');
  }

  const auth = Buffer.from(`${DATAFORSEO_API_LOGIN}:${DATAFORSEO_API_PASSWORD}`).toString('base64');
  
  const response = await fetch(`${DATAFORSEO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.tasks || result.tasks.length === 0) {
    throw new Error('No data returned from DataForSEO API');
  }

  if (result.tasks[0].status_code !== 20000) {
    throw new Error(`DataForSEO API task failed: ${result.tasks[0].status_message}`);
  }

  return result.tasks[0].result;
}

// Get keyword data from DataForSEO
async function getKeywordData(keywords: string[], location: string = 'United States'): Promise<KeywordData[]> {
  try {
    // Get keyword metrics
    const keywordMetricsData = [{
      keywords: keywords,
      location_name: location,
      language_name: 'English',
      include_adult_keywords: false
    }];

    const metricsResult = await callDataForSEOAPI('/keywords_data/google_ads/search_volume/live', keywordMetricsData);
    
    // Get keyword suggestions for each seed keyword
    const suggestionsPromises = keywords.map(async (keyword) => {
      try {
        const suggestionsData = [{
          keyword: keyword,
          location_name: location,
          language_name: 'English',
          limit: 50,
          include_adult_keywords: false,
          sort_by: 'search_volume'
        }];

        const result = await callDataForSEOAPI('/keywords_data/google_ads/keywords_for_keywords/live', suggestionsData);
        return result || [];
      } catch (error) {
        console.error(`Error getting suggestions for keyword "${keyword}":`, error);
        return [];
      }
    });

    const allSuggestions = await Promise.all(suggestionsPromises);
    const flatSuggestions = allSuggestions.flat();

    // Combine and process keyword data
    const keywordMap = new Map<string, KeywordData>();

    // Process direct metrics
    if (metricsResult && metricsResult.length > 0) {
      metricsResult.forEach((item: any) => {
        if (item.keyword_info) {
          const keywordInfo = item.keyword_info;
          keywordMap.set(keywordInfo.keyword, {
            keyword: keywordInfo.keyword,
            search_volume: keywordInfo.search_volume || 0,
            competition: keywordInfo.competition || 0,
            competition_level: getCompetitionLevel(keywordInfo.competition),
            cpc: keywordInfo.cpc || 0,
            difficulty: calculateDifficulty(keywordInfo.competition, keywordInfo.search_volume),
            trend: keywordInfo.monthly_searches?.map((m: any) => m.search_volume) || [],
            related_keywords: [],
            search_intent: determineSearchIntent(keywordInfo.keyword),
            monthly_searches: keywordInfo.monthly_searches || []
          });
        }
      });
    }

    // Process suggestions
    flatSuggestions.forEach((item: any) => {
      if (item.keyword_info) {
        const keywordInfo = item.keyword_info;
        const keyword = keywordInfo.keyword;
        
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, {
            keyword: keyword,
            search_volume: keywordInfo.search_volume || 0,
            competition: keywordInfo.competition || 0,
            competition_level: getCompetitionLevel(keywordInfo.competition),
            cpc: keywordInfo.cpc || 0,
            difficulty: calculateDifficulty(keywordInfo.competition, keywordInfo.search_volume),
            trend: keywordInfo.monthly_searches?.map((m: any) => m.search_volume) || [],
            related_keywords: [],
            search_intent: determineSearchIntent(keyword),
            monthly_searches: keywordInfo.monthly_searches || []
          });
        }
      }
    });

    return Array.from(keywordMap.values());
  } catch (error) {
    console.error('Error fetching keyword data from DataForSEO:', error);
    throw error;
  }
}

// Helper functions
function getCompetitionLevel(competition: number): 'low' | 'medium' | 'high' {
  if (competition < 0.33) return 'low';
  if (competition < 0.67) return 'medium';
  return 'high';
}

function calculateDifficulty(competition: number, searchVolume: number): number {
  // Simple difficulty calculation based on competition and search volume
  const competitionScore = competition * 50;
  const volumeScore = Math.min(searchVolume / 1000, 50);
  return Math.round(competitionScore + volumeScore);
}

function determineSearchIntent(keyword: string): 'informational' | 'commercial' | 'transactional' | 'navigational' {
  const keywordLower = keyword.toLowerCase();
  
  // Transactional intent keywords
  if (keywordLower.match(/\b(buy|purchase|order|shop|price|cost|cheap|deal|discount|sale)\b/)) {
    return 'transactional';
  }
  
  // Commercial intent keywords
  if (keywordLower.match(/\b(best|top|review|compare|vs|versus|alternative)\b/)) {
    return 'commercial';
  }
  
  // Navigational intent keywords
  if (keywordLower.match(/\b(login|sign in|website|official|contact)\b/)) {
    return 'navigational';
  }
  
  // Default to informational
  return 'informational';
}

// Cluster keywords based on semantic similarity and search intent
function clusterKeywords(keywords: KeywordData[]): KeywordCluster[] {
  const clusters: KeywordCluster[] = [];
  const usedKeywords = new Set<string>();

  // Sort keywords by search volume (highest first)
  const sortedKeywords = [...keywords].sort((a, b) => b.search_volume - a.search_volume);

  sortedKeywords.forEach((keyword, index) => {
    if (usedKeywords.has(keyword.keyword)) return;

    // Find similar keywords for this cluster
    const clusterKeywords = [keyword];
    usedKeywords.add(keyword.keyword);

    // Look for semantically related keywords
    const keywordWords = keyword.keyword.toLowerCase().split(' ');
    
    sortedKeywords.forEach((otherKeyword) => {
      if (usedKeywords.has(otherKeyword.keyword)) return;
      
      const otherWords = otherKeyword.keyword.toLowerCase().split(' ');
      const commonWords = keywordWords.filter(word => otherWords.includes(word));
      
      // If keywords share words or have similar intent, cluster them
      if (commonWords.length >= 1 || 
          (keyword.search_intent === otherKeyword.search_intent && 
           Math.abs(keyword.difficulty - otherKeyword.difficulty) < 20)) {
        clusterKeywords.push(otherKeyword);
        usedKeywords.add(otherKeyword.keyword);
      }
    });

    // Only create cluster if it has meaningful keywords
    if (clusterKeywords.length > 0) {
      const totalSearchVolume = clusterKeywords.reduce((sum, kw) => sum + kw.search_volume, 0);
      const avgDifficulty = clusterKeywords.reduce((sum, kw) => sum + kw.difficulty, 0) / clusterKeywords.length;
      const avgCpc = clusterKeywords.reduce((sum, kw) => sum + kw.cpc, 0) / clusterKeywords.length;

      clusters.push({
        id: `cluster_${index + 1}`,
        name: generateClusterName(clusterKeywords),
        primary_keyword: keyword.keyword,
        keywords: clusterKeywords,
        total_search_volume: totalSearchVolume,
        avg_difficulty: Math.round(avgDifficulty),
        avg_cpc: parseFloat(avgCpc.toFixed(2)),
        search_intent: keyword.search_intent,
        content_opportunities: generateContentOpportunities(clusterKeywords)
      });
    }
  });

  // Sort clusters by total search volume
  return clusters.sort((a, b) => b.total_search_volume - a.total_search_volume);
}

function generateClusterName(keywords: KeywordData[]): string {
  const primaryKeyword = keywords[0].keyword;
  const words = primaryKeyword.split(' ');
  
  // Use the most important words from the primary keyword
  if (words.length > 2) {
    return words.slice(0, 2).join(' ') + ' related';
  }
  
  return primaryKeyword + ' cluster';
}

function generateContentOpportunities(keywords: KeywordData[]): string[] {
  const opportunities: string[] = [];
  const intents = [...new Set(keywords.map(k => k.search_intent))];
  
  intents.forEach(intent => {
    switch (intent) {
      case 'informational':
        opportunities.push('Create educational blog posts and how-to guides');
        opportunities.push('Develop FAQ content and explainer videos');
        break;
      case 'commercial':
        opportunities.push('Write comparison and review content');
        opportunities.push('Create "best of" and recommendation posts');
        break;
      case 'transactional':
        opportunities.push('Develop product/service landing pages');
        opportunities.push('Create promotional and sales-focused content');
        break;
      case 'navigational':
        opportunities.push('Optimize brand and location-specific content');
        opportunities.push('Improve website navigation and contact pages');
        break;
    }
  });

  return [...new Set(opportunities)]; // Remove duplicates
}

// Generate mock data when DataForSEO is not available
function generateMockKeywordData(seedKeywords: string[]): KeywordData[] {
  const mockKeywords: KeywordData[] = [];
  
  seedKeywords.forEach(seed => {
    // Add the seed keyword
    mockKeywords.push({
      keyword: seed,
      search_volume: Math.floor(Math.random() * 10000) + 500,
      competition: Math.random(),
      competition_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
      cpc: parseFloat((Math.random() * 5).toFixed(2)),
      difficulty: Math.floor(Math.random() * 100),
      trend: Array.from({length: 12}, () => Math.floor(Math.random() * 1000)),
      related_keywords: [],
      search_intent: ['informational', 'commercial', 'transactional', 'navigational'][Math.floor(Math.random() * 4)] as any,
      monthly_searches: []
    });

    // Add related keywords
    const relatedVariations = [
      `${seed} services`,
      `${seed} near me`,
      `best ${seed}`,
      `${seed} cost`,
      `${seed} reviews`,
      `how to ${seed}`,
      `${seed} company`,
      `${seed} tips`,
      `${seed} guide`,
      `${seed} benefits`
    ];

    relatedVariations.forEach(variation => {
      mockKeywords.push({
        keyword: variation,
        search_volume: Math.floor(Math.random() * 5000) + 100,
        competition: Math.random(),
        competition_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
        cpc: parseFloat((Math.random() * 3).toFixed(2)),
        difficulty: Math.floor(Math.random() * 80),
        trend: Array.from({length: 12}, () => Math.floor(Math.random() * 500)),
        related_keywords: [],
        search_intent: ['informational', 'commercial', 'transactional'][Math.floor(Math.random() * 3)] as any,
        monthly_searches: []
      });
    });
  });

  return mockKeywords;
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

    const request: KeywordResearchRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!request.seedKeywords || !Array.isArray(request.seedKeywords) || request.seedKeywords.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Missing or invalid seedKeywords. Provide an array of seed keywords.' 
        }),
      };
    }

    const startTime = Date.now();
    let keywordData: KeywordData[];
    let source: 'dataforseo' | 'cache' | 'mock' = 'mock';

    try {
      // Try to get real data from DataForSEO
      keywordData = await getKeywordData(
        request.seedKeywords, 
        request.location || 'United States'
      );
      source = 'dataforseo';
    } catch (error) {
      console.warn('Failed to fetch from DataForSEO, using mock data:', error);
      // Fall back to mock data
      keywordData = generateMockKeywordData(request.seedKeywords);
      source = 'mock';
    }

    // Apply filters if specified
    if (request.minSearchVolume) {
      keywordData = keywordData.filter(kw => kw.search_volume >= request.minSearchVolume!);
    }

    if (request.maxDifficulty) {
      keywordData = keywordData.filter(kw => kw.difficulty <= request.maxDifficulty!);
    }

    // Limit results if specified
    if (request.maxResults) {
      keywordData = keywordData.slice(0, request.maxResults);
    }

    // Cluster the keywords
    const clusters = clusterKeywords(keywordData);

    const processingTime = Date.now() - startTime;

    const response: KeywordResearchResponse = {
      clusters,
      total_keywords: keywordData.length,
      processing_time_ms: processingTime,
      source
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
    console.error('Keyword research error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to perform keyword research',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
