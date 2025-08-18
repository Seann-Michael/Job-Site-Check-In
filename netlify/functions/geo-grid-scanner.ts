import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';

interface GeoGridScanParams {
  scan_name: string;
  location_name?: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  grid_size?: number;
  business_types?: string[];
  max_results_per_cell?: number;
  include_photos?: boolean;
}

interface GridCell {
  lat: number;
  lng: number;
  radius: number;
  cell_id: string;
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

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to generate grid cells
function generateGridCells(
  centerLat: number, 
  centerLng: number, 
  radiusKm: number, 
  gridSize: number = 20
): GridCell[] {
  const cells: GridCell[] = [];
  
  // Calculate the step size for latitude and longitude
  const latStep = (radiusKm * 2) / (gridSize * 111); // Convert km to degrees (approximate)
  const lngStep = (radiusKm * 2) / (gridSize * 111 * Math.cos(centerLat * Math.PI / 180));
  
  // Calculate starting position (top-left corner)
  const startLat = centerLat + (radiusKm / 111);
  const startLng = centerLng - (radiusKm / (111 * Math.cos(centerLat * Math.PI / 180)));
  
  // Generate grid cells
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const cellLat = startLat - (i * latStep);
      const cellLng = startLng + (j * lngStep);
      
      // Check if cell is within the original radius
      const distanceFromCenter = calculateDistance(centerLat, centerLng, cellLat, cellLng);
      
      if (distanceFromCenter <= radiusKm) {
        cells.push({
          lat: cellLat,
          lng: cellLng,
          radius: Math.min(latStep * 111 * 1000, 1000), // Convert to meters, max 1km
          cell_id: `${i}_${j}`,
        });
      }
    }
  }
  
  return cells;
}

// Helper function to search places in a grid cell
async function searchPlacesInCell(
  cell: GridCell, 
  businessTypes: string[] = [], 
  maxResults: number = 20
): Promise<any[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  let allResults: any[] = [];

  // If no specific business types, do a general search
  const searchTypes = businessTypes.length > 0 ? businessTypes : ['establishment'];

  for (const businessType of searchTypes) {
    try {
      const searchUrl = new URL(`${GOOGLE_PLACES_API_BASE}/nearbysearch/json`);
      searchUrl.searchParams.set('location', `${cell.lat},${cell.lng}`);
      searchUrl.searchParams.set('radius', cell.radius.toString());
      searchUrl.searchParams.set('type', businessType);
      searchUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);

      const response = await fetch(searchUrl.toString());
      const data = await response.json();

      if (data.status === 'OK' && data.results) {
        allResults.push(...data.results);
      }

      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error searching in cell ${cell.cell_id} for type ${businessType}:`, error);
    }
  }

  // Remove duplicates based on place_id
  const uniqueResults = allResults.filter((place, index, self) =>
    index === self.findIndex(p => p.place_id === place.place_id)
  );

  return uniqueResults.slice(0, maxResults);
}

// Helper function to get detailed place information
async function getPlaceDetails(placeId: string): Promise<any> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  const detailsUrl = new URL(`${GOOGLE_PLACES_API_BASE}/details/json`);
  detailsUrl.searchParams.set('place_id', placeId);
  detailsUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  detailsUrl.searchParams.set('fields', 
    'place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,business_status,types,geometry,opening_hours,photos,price_level,vicinity,url'
  );

  const response = await fetch(detailsUrl.toString());
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Google Places API error: ${data.status}`);
  }

  return data.result;
}

// Helper function to convert place data to GMB lead format
function convertPlaceToLead(place: any): any {
  const googleCid = place.reference || place.place_id || `${place.geometry?.location?.lat}_${place.geometry?.location?.lng}_${place.name?.replace(/\s+/g, '_')}`;
  
  const completenessFields = ['name', 'formatted_phone_number', 'website', 'formatted_address', 'types', 'rating'];
  const completedFields = completenessFields.filter(field => {
    const value = place[field];
    return value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
  });
  const completenessScore = Math.round((completedFields.length / completenessFields.length) * 100);

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
    photos: place.photos?.map((photo: any) => 
      `${GOOGLE_PLACES_API_BASE}/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
    ) || [],
    verified: place.business_status === 'OPERATIONAL',
    last_updated: new Date().toISOString(),
    data_completeness_score: completenessScore,
    unlock_credits_cost: 5,
    status: 'active' as const,
    raw_data: place,
  };
}

// POST /api/geo-grid-scanner/start - Start a geo grid scan
async function startGeoGridScan(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const scanParams: GeoGridScanParams = JSON.parse(event.body || '{}');
    
    if (!scanParams.center_latitude || !scanParams.center_longitude || !scanParams.radius_km) {
      throw new Error('Center coordinates and radius are required');
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabase
      .from('geo_grid_scans')
      .insert({
        user_id: user.id,
        scan_name: scanParams.scan_name,
        location_name: scanParams.location_name,
        center_latitude: scanParams.center_latitude,
        center_longitude: scanParams.center_longitude,
        radius_km: scanParams.radius_km,
        grid_size: scanParams.grid_size || 20,
        business_types: scanParams.business_types || [],
        status: 'pending',
        scan_parameters: scanParams,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError || !scan) {
      throw new Error('Failed to create scan record');
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Geo grid scan started',
        scan_id: scan.id,
        status: 'pending',
        estimated_cells: Math.pow(scanParams.grid_size || 20, 2),
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

// POST /api/geo-grid-scanner/process/:scanId - Process a geo grid scan
async function processGeoGridScan(event: HandlerEvent, scanId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Get scan record
    const { data: scan, error: scanError } = await supabase
      .from('geo_grid_scans')
      .select('*')
      .eq('id', scanId)
      .eq('user_id', user.id)
      .single();

    if (scanError || !scan) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Scan not found' }),
      };
    }

    if (scan.status !== 'pending') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Scan already processed or in progress' }),
      };
    }

    // Update scan status to processing
    await supabase
      .from('geo_grid_scans')
      .update({ status: 'processing' })
      .eq('id', scanId);

    // Generate grid cells
    const gridCells = generateGridCells(
      scan.center_latitude,
      scan.center_longitude,
      scan.radius_km,
      scan.grid_size
    );

    console.log(`Generated ${gridCells.length} grid cells for scan ${scanId}`);

    let allLeads: any[] = [];
    let processedCells = 0;

    // Process each grid cell
    for (const cell of gridCells) {
      try {
        const places = await searchPlacesInCell(
          cell,
          scan.business_types || [],
          scan.scan_parameters?.max_results_per_cell || 20
        );

        // Get detailed information for each place
        const detailedPlaces = await Promise.all(
          places.slice(0, 10).map(async (place) => {
            try {
              return await getPlaceDetails(place.place_id);
            } catch (error) {
              console.error(`Error getting details for place ${place.place_id}:`, error);
              return place; // Fallback to basic place data
            }
          })
        );

        // Convert to GMB lead format
        const cellLeads = detailedPlaces.map(convertPlaceToLead);
        allLeads.push(...cellLeads);

        processedCells++;
        console.log(`Processed cell ${cell.cell_id}: ${cellLeads.length} leads found (${processedCells}/${gridCells.length})`);

        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error processing cell ${cell.cell_id}:`, error);
      }
    }

    // Remove duplicates based on Google CID
    const uniqueLeads = allLeads.filter((lead, index, self) =>
      index === self.findIndex(l => l.google_cid === lead.google_cid)
    );

    console.log(`Found ${allLeads.length} total leads, ${uniqueLeads.length} unique leads`);

    // Check for existing leads in database
    const cids = uniqueLeads.map(lead => lead.google_cid);
    const { data: existingLeads } = await supabase
      .from('gmb_leads')
      .select('google_cid')
      .in('google_cid', cids);

    const existingCids = new Set(existingLeads?.map(lead => lead.google_cid) || []);
    const newLeads = uniqueLeads.filter(lead => !existingCids.has(lead.google_cid));

    console.log(`${newLeads.length} new leads to import, ${uniqueLeads.length - newLeads.length} duplicates`);

    // Insert new leads if any
    let insertedLeads: any[] = [];
    if (newLeads.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('gmb_leads')
        .insert(newLeads)
        .select();

      if (insertError) {
        throw insertError;
      }

      insertedLeads = inserted || [];
    }

    // Update scan record with results
    const { error: updateError } = await supabase
      .from('geo_grid_scans')
      .update({
        status: 'completed',
        total_leads_found: insertedLeads.length,
        completed_at: new Date().toISOString(),
        results_data: {
          total_processed: allLeads.length,
          unique_leads: uniqueLeads.length,
          new_leads: insertedLeads.length,
          duplicates: uniqueLeads.length - newLeads.length,
          processed_cells: processedCells,
          total_cells: gridCells.length,
        },
      })
      .eq('id', scanId);

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Geo grid scan completed successfully',
        scan_id: scanId,
        results: {
          total_processed: allLeads.length,
          unique_leads: uniqueLeads.length,
          new_leads: insertedLeads.length,
          duplicates: uniqueLeads.length - newLeads.length,
          processed_cells: processedCells,
          total_cells: gridCells.length,
        },
        leads: insertedLeads,
      }),
    };
  } catch (error) {
    // Update scan status to failed
    await supabase
      .from('geo_grid_scans')
      .update({ 
        status: 'failed',
        results_data: { error: (error as Error).message }
      })
      .eq('id', scanId);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// GET /api/geo-grid-scanner/scans - Get user's scans
async function getUserScans(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const params = new URLSearchParams(event.queryStringParameters || {});
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { data: scans, error, count } = await supabase
      .from('geo_grid_scans')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: scans,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
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

// GET /api/geo-grid-scanner/scan/:scanId - Get scan details
async function getScanDetails(event: HandlerEvent, scanId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const { data: scan, error } = await supabase
      .from('geo_grid_scans')
      .select('*')
      .eq('id', scanId)
      .eq('user_id', user.id)
      .single();

    if (error || !scan) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Scan not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: scan }),
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
        if (pathParts[0] === 'geo-grid-scanner' && pathParts[1] === 'scans') {
          return await getUserScans(event);
        }
        if (pathParts[0] === 'geo-grid-scanner' && pathParts[1] === 'scan' && pathParts[2]) {
          return await getScanDetails(event, pathParts[2]);
        }
        break;

      case 'POST':
        if (pathParts[0] === 'geo-grid-scanner' && pathParts[1] === 'start') {
          return await startGeoGridScan(event);
        }
        if (pathParts[0] === 'geo-grid-scanner' && pathParts[1] === 'process' && pathParts[2]) {
          return await processGeoGridScan(event, pathParts[2]);
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
