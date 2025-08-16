import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const DATAFORSEO_API_KEY = process.env.DATAFORSEO_API_KEY;

interface GeoGridRequest {
  keyword: string;
  location: string;
  business_name?: string;
  grid_size?: number;
  language?: string;
  depth?: number;
}

interface DataForSEOCredentials {
  login: string;
  password: string;
}

const getCredentials = (): DataForSEOCredentials => {
  if (DATAFORSEO_API_KEY) {
    // If using API key, split it into login:password format
    const [login, password] = DATAFORSEO_API_KEY.split(':');
    return { login, password };
  } else if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
    return { login: DATAFORSEO_LOGIN, password: DATAFORSEO_PASSWORD };
  } else {
    throw new Error('DataForSEO credentials not configured. Set DATAFORSEO_API_KEY or DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD');
  }
};

const makeDataForSEORequest = async (endpoint: string, data?: any) => {
  const credentials = getCredentials();
  const authString = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  const url = `https://api.dataforseo.com/v3/${endpoint}`;
  
  const options: RequestInit = {
    method: data ? 'POST' : 'GET',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${error}`);
  }

  return await response.json();
};

const performGeoGridScan = async (request: GeoGridRequest) => {
  const gridSize = request.grid_size || 5;
  const depth = request.depth || 10;
  
  // Prepare the request for DataForSEO SERP API
  const serpRequest = [
    {
      keyword: request.keyword,
      location_name: request.location,
      language_name: request.language || 'English',
      depth: depth,
      calculate_rectangles: true,
      // Custom parameters for geo grid scanning
      custom_rectangles: generateGridRectangles(request.location, gridSize),
    }
  ];

  try {
    // Submit the task to DataForSEO
    const taskResponse = await makeDataForSEORequest('serp/google/organic/live/advanced', serpRequest);
    
    if (taskResponse.status_code === 20000 && taskResponse.tasks && taskResponse.tasks.length > 0) {
      const taskResult = taskResponse.tasks[0];
      
      if (taskResult.status_code === 20000 && taskResult.result && taskResult.result.length > 0) {
        return processGeoGridResults(taskResult.result[0], request);
      } else {
        throw new Error(`Task failed: ${taskResult.status_message || 'Unknown error'}`);
      }
    } else {
      throw new Error(`API request failed: ${taskResponse.status_message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('DataForSEO request failed:', error);
    throw error;
  }
};

const generateGridRectangles = (location: string, gridSize: number) => {
  // This is a simplified grid generation
  // In a real implementation, you would use the location to get coordinates
  // and generate a proper grid of rectangles around that location
  
  const baseCoords = getLocationCoordinates(location);
  const rectangles = [];
  
  const gridStep = 0.01; // Approximately 1km
  const halfGrid = Math.floor(gridSize / 2);
  
  for (let i = -halfGrid; i <= halfGrid; i++) {
    for (let j = -halfGrid; j <= halfGrid; j++) {
      rectangles.push({
        ne_lat: baseCoords.lat + (i + 0.5) * gridStep,
        ne_lng: baseCoords.lng + (j + 0.5) * gridStep,
        sw_lat: baseCoords.lat + (i - 0.5) * gridStep,
        sw_lng: baseCoords.lng + (j - 0.5) * gridStep,
      });
    }
  }
  
  return rectangles;
};

const getLocationCoordinates = (location: string): { lat: number; lng: number } => {
  // Simplified location to coordinates mapping
  // In a real implementation, you would use a geocoding service
  const locationMap: Record<string, { lat: number; lng: number }> = {
    'Fairfield, CA': { lat: 38.2493, lng: -122.0397 },
    'San Francisco, CA': { lat: 37.7749, lng: -122.4194 },
    'New York, NY': { lat: 40.7128, lng: -74.0060 },
    'Los Angeles, CA': { lat: 34.0522, lng: -118.2437 },
  };
  
  return locationMap[location] || { lat: 37.7749, lng: -122.4194 }; // Default to SF
};

const processGeoGridResults = (result: any, request: GeoGridRequest) => {
  const organicResults = result.items || [];
  const businessResults = [];
  let targetBusinessRankings = [];
  
  // Process organic results to find business listings
  organicResults.forEach((item: any, index: number) => {
    if (item.type === 'organic') {
      businessResults.push({
        position: index + 1,
        title: item.title,
        url: item.url,
        description: item.description,
        domain: item.domain,
      });
      
      // Check if this is the target business
      if (request.business_name && 
          item.title.toLowerCase().includes(request.business_name.toLowerCase())) {
        targetBusinessRankings.push({
          position: index + 1,
          title: item.title,
          url: item.url,
        });
      }
    }
  });
  
  // Calculate grid statistics
  const totalResults = businessResults.length;
  const averageRanking = targetBusinessRankings.length > 0 
    ? targetBusinessRankings.reduce((sum, item) => sum + item.position, 0) / targetBusinessRankings.length
    : 0;
  
  return {
    status: 'completed',
    keyword: request.keyword,
    location: request.location,
    business_name: request.business_name,
    grid_size: `${request.grid_size || 5}x${request.grid_size || 5}`,
    results: {
      total_results: totalResults,
      target_business_found: targetBusinessRankings.length > 0,
      target_business_rankings: targetBusinessRankings,
      average_ranking: parseFloat(averageRanking.toFixed(1)),
      all_results: businessResults.slice(0, 20), // Limit to top 20
    },
    credits_used: calculateCreditsUsed(request),
    timestamp: new Date().toISOString(),
  };
};

const calculateCreditsUsed = (request: GeoGridRequest): number => {
  const baseCredits = 1;
  const gridSize = request.grid_size || 5;
  const gridMultiplier = gridSize * gridSize;
  return Math.ceil(baseCredits * gridMultiplier * 0.1); // Simplified calculation
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const request: GeoGridRequest = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!request.keyword) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: keyword' }),
      };
    }

    if (!request.location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: location' }),
      };
    }

    const result = await performGeoGridScan(request);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: result,
      }),
    };
  } catch (error) {
    console.error('DataForSEO service error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
