import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

interface MediaUploadRequest {
  fileName: string;
  fileType: string;
  fileData: string; // Base64 encoded file data
  projectId?: string;
  category?: string;
  metadata?: Record<string, any>;
}

interface MediaListRequest {
  projectId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const uploadMedia = async (request: MediaUploadRequest) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase configuration is missing');
  }

  // Decode base64 file data
  const buffer = Buffer.from(request.fileData, 'base64');
  
  // Generate unique file path
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2);
  const fileExtension = request.fileName.split('.').pop() || 'bin';
  const storageFileName = `${request.projectId || 'general'}/${timestamp}-${randomId}.${fileExtension}`;

  try {
    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storageFileName, buffer, {
        contentType: request.fileType,
        duplex: 'half'
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(storageFileName);

    // Store media metadata in database
    const mediaRecord = {
      filename: request.fileName,
      storage_path: storageFileName,
      file_type: request.fileType,
      file_size: buffer.length,
      project_id: request.projectId,
      category: request.category || 'general',
      metadata: request.metadata || {},
      public_url: urlData.publicUrl,
      uploaded_at: new Date().toISOString(),
    };

    const { data: dbData, error: dbError } = await supabase
      .from('media_files')
      .insert([mediaRecord])
      .select()
      .single();

    if (dbError) {
      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .remove([storageFileName]);
      
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    return {
      id: dbData.id,
      filename: dbData.filename,
      publicUrl: dbData.public_url,
      fileType: dbData.file_type,
      fileSize: dbData.file_size,
      uploadedAt: dbData.uploaded_at,
    };
  } catch (error) {
    console.error('Media upload error:', error);
    throw error;
  }
};

const listMedia = async (request: MediaListRequest) => {
  let query = supabase
    .from('media_files')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (request.projectId) {
    query = query.eq('project_id', request.projectId);
  }

  if (request.category) {
    query = query.eq('category', request.category);
  }

  if (request.limit) {
    query = query.limit(request.limit);
  }

  if (request.offset) {
    query = query.range(request.offset, request.offset + (request.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data;
};

const deleteMedia = async (mediaId: string) => {
  // First get the media record to find the storage path
  const { data: mediaRecord, error: fetchError } = await supabase
    .from('media_files')
    .select('storage_path')
    .eq('id', mediaId)
    .single();

  if (fetchError) {
    throw new Error(`Media record not found: ${fetchError.message}`);
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove([mediaRecord.storage_path]);

  if (storageError) {
    console.warn(`Storage deletion failed: ${storageError.message}`);
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('media_files')
    .delete()
    .eq('id', mediaId);

  if (dbError) {
    throw new Error(`Database deletion failed: ${dbError.message}`);
  }

  return { success: true };
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const { httpMethod, queryStringParameters } = event;
  
  try {
    if (httpMethod === 'POST') {
      // Upload media
      const request: MediaUploadRequest = JSON.parse(event.body || '{}');
      
      if (!request.fileName || !request.fileType || !request.fileData) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required fields: fileName, fileType, fileData' }),
        };
      }

      const result = await uploadMedia(request);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: result }),
      };
      
    } else if (httpMethod === 'GET') {
      // List media
      const request: MediaListRequest = {
        projectId: queryStringParameters?.projectId,
        category: queryStringParameters?.category,
        limit: queryStringParameters?.limit ? parseInt(queryStringParameters.limit) : undefined,
        offset: queryStringParameters?.offset ? parseInt(queryStringParameters.offset) : undefined,
      };

      const result = await listMedia(request);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: result }),
      };
      
    } else if (httpMethod === 'DELETE') {
      // Delete media
      const mediaId = queryStringParameters?.id;
      
      if (!mediaId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required parameter: id' }),
        };
      }

      const result = await deleteMedia(mediaId);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
      
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (error) {
    console.error('Media storage error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
