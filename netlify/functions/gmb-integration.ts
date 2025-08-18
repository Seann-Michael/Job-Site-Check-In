import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google My Business API configuration
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    weekday_text?: string[];
    periods?: any[];
  };
  photos?: any[];
  reviews?: any[];
  price_level?: number;
  vicinity?: string;
  url?: string;
  utc_offset?: number;
  cid?: string;
}

interface GMBSearchParams {
  location: { lat: number; lng: number };
  radius: number;
  keyword?: string;
  type?: string;
  minprice?: number;
  maxprice?: number;
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

// Helper function to extract Google CID from place data
function extractGoogleCID(place: any): string {
  // Try multiple methods to get Google CID
  if (place.cid) return place.cid;
  if (place.reference) return place.reference;
  if (place.place_id) {
    // Extract CID from place_id if available
    const placeIdMatch = place.place_id.match(/ChIJ(.+)/);
    if (placeIdMatch) return placeIdMatch[1];
    return place.place_id;
  }
  // Fallback to generating from coordinates and name
  return `${place.geometry?.location?.lat}_${place.geometry?.location?.lng}_${place.name?.replace(/\s+/g, '_')}`;
}

// Helper function to calculate data completeness score
function calculateCompletenessScore(placeData: any): number {
  const fields = ['name', 'formatted_phone_number', 'website', 'formatted_address', 'types', 'rating'];
  const completedFields = fields.filter(field => {
    const value = placeData[field];
    return value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
  });
  return Math.round((completedFields.length / fields.length) * 100);
}

// Helper function to convert Google Places data to GMB lead format
function convertPlaceToLead(place: PlaceDetails): any {
  const googleCid = extractGoogleCID(place);
  
  return {
    google_cid: googleCid,
    business_name: place.name,
    phone: place.formatted_phone_number,
    website: place.website,
    address: place.formatted_address,
    latitude: place.geometry?.location?.lat,
    longitude: place.geometry?.location?.lng,
    category: place.types?.[0] || 'business',
    rating: place.rating,
    review_count: place.user_ratings_total || 0,
    hours: place.opening_hours ? {
      weekday_text: place.opening_hours.weekday_text,
      periods: place.opening_hours.periods,
    } : null,
    attributes: {
      business_status: place.business_status,
      price_level: place.price_level,
      types: place.types,
      vicinity: place.vicinity,
      google_url: place.url,
    },
    photos: place.photos?.map(photo => 
      `${GOOGLE_PLACES_API_BASE}/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
    ) || [],
    verified: place.business_status === 'OPERATIONAL',
    last_updated: new Date().toISOString(),
    data_completeness_score: calculateCompletenessScore(place),
    unlock_credits_cost: 5,
    status: 'active' as const,
    raw_data: place,
  };
}

// Function to search for places using Google Places API
async function searchPlaces(params: GMBSearchParams): Promise<PlaceDetails[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  // Build search URL
  const searchUrl = new URL(`${GOOGLE_PLACES_API_BASE}/nearbysearch/json`);
  searchUrl.searchParams.set('location', `${params.location.lat},${params.location.lng}`);
  searchUrl.searchParams.set('radius', params.radius.toString());
  searchUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  
  if (params.keyword) {
    searchUrl.searchParams.set('keyword', params.keyword);
  }
  if (params.type) {
    searchUrl.searchParams.set('type', params.type);
  }
  if (params.minprice) {
    searchUrl.searchParams.set('minprice', params.minprice.toString());
  }
  if (params.maxprice) {
    searchUrl.searchParams.set('maxprice', params.maxprice.toString());
  }

  const response = await fetch(searchUrl.toString());
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message}`);
  }

  return data.results || [];
}

// Function to get detailed place information
async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  const detailsUrl = new URL(`${GOOGLE_PLACES_API_BASE}/details/json`);
  detailsUrl.searchParams.set('place_id', placeId);
  detailsUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  detailsUrl.searchParams.set('fields', 
    'place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,business_status,types,geometry,opening_hours,photos,reviews,price_level,vicinity,url,utc_offset'
  );

  const response = await fetch(detailsUrl.toString());
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message}`);
  }

  return data.result;
}

// POST /api/gmb-integration/search - Search for GMB profiles
async function searchGMBProfiles(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const searchParams: GMBSearchParams = JSON.parse(event.body || '{}');
    
    if (!searchParams.location || !searchParams.radius) {
      throw new Error('Location and radius are required');
    }

    // Search for places
    const places = await searchPlaces(searchParams);
    
    // Get detailed information for each place
    const detailedPlaces = await Promise.all(
      places.slice(0, 20).map(async (place) => {
        try {
          return await getPlaceDetails(place.place_id);
        } catch (error) {
          console.error(`Error getting details for place ${place.place_id}:`, error);
          return place; // Fallback to basic place data
        }
      })
    );

    // Convert to GMB lead format
    const gmbLeads = detailedPlaces.map(convertPlaceToLead);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: gmbLeads,
        total_found: places.length,
        processed: detailedPlaces.length,
        search_params: searchParams,
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

// POST /api/gmb-integration/import - Import GMB profiles to database
async function importGMBProfiles(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Only super admins can import directly
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }

    const { leads, scan_id }: { leads: any[]; scan_id?: string } = JSON.parse(event.body || '{}');
    
    if (!Array.isArray(leads) || leads.length === 0) {
      throw new Error('No leads to import');
    }

    // Check for existing leads by Google CID
    const cids = leads.map(lead => lead.google_cid);
    const { data: existingLeads } = await supabase
      .from('gmb_leads')
      .select('google_cid')
      .in('google_cid', cids);

    const existingCids = new Set(existingLeads?.map(lead => lead.google_cid) || []);
    const newLeads = leads.filter(lead => !existingCids.has(lead.google_cid));

    if (newLeads.length === 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'All leads already exist',
          duplicates: leads.length,
        }),
      };
    }

    // Insert new leads
    const { data: insertedLeads, error: insertError } = await supabase
      .from('gmb_leads')
      .insert(newLeads)
      .select();

    if (insertError) {
      throw insertError;
    }

    // Update scan record if provided
    if (scan_id) {
      await supabase
        .from('geo_grid_scans')
        .update({
          total_leads_found: insertedLeads?.length || 0,
          status: 'completed',
          completed_at: new Date().toISOString(),
          results_data: {
            imported_leads: insertedLeads?.length || 0,
            duplicates: leads.length - newLeads.length,
            total_processed: leads.length,
          },
        })
        .eq('id', scan_id);
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'GMB profiles imported successfully',
        imported: insertedLeads?.length || 0,
        duplicates: leads.length - newLeads.length,
        scan_id,
        data: insertedLeads,
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

// GET /api/gmb-integration/place/:placeId - Get detailed place information
async function getPlaceDetailsEndpoint(event: HandlerEvent, placeId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const placeDetails = await getPlaceDetails(placeId);
    const gmbLead = convertPlaceToLead(placeDetails);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: gmbLead,
        raw_data: placeDetails,
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

// POST /api/gmb-integration/validate-api-key - Validate Google Maps API key
async function validateApiKey(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    if (!GOOGLE_MAPS_API_KEY) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Google Maps API key not configured' 
        }),
      };
    }

    // Test API key with a simple geocoding request
    const testUrl = `${GOOGLE_PLACES_API_BASE}/textsearch/json?query=test&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(testUrl);
    const data = await response.json();

    const valid = data.status === 'OK' || data.status === 'ZERO_RESULTS';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid,
        status: data.status,
        error_message: data.error_message,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        valid: false, 
        error: (error as Error).message 
      }),
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
        if (pathParts[0] === 'gmb-integration' && pathParts[1] === 'place' && pathParts[2]) {
          return await getPlaceDetailsEndpoint(event, pathParts[2]);
        }
        break;

      case 'POST':
        if (pathParts[0] === 'gmb-integration' && pathParts[1] === 'search') {
          return await searchGMBProfiles(event);
        }
        if (pathParts[0] === 'gmb-integration' && pathParts[1] === 'import') {
          return await importGMBProfiles(event);
        }
        if (pathParts[0] === 'gmb-integration' && pathParts[1] === 'validate-api-key') {
          return await validateApiKey(event);
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
