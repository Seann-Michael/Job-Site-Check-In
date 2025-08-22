import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FileUploadRequest {
  fileName: string;
  fileType: string;
  fileData: string; // Base64 encoded file data
  messageId: string;
  channelId: string;
}

// Helper function to check if user can access channel
async function canUserAccessChannel(channelId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_channel_participants')
    .select('id')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .single();
  
  return !!data;
}

// Helper function to get image dimensions
async function getImageDimensions(buffer: Buffer, mimeType: string): Promise<{ width?: number; height?: number }> {
  // For now, return empty dimensions - could implement image analysis later
  return {};
}

// Helper function to generate thumbnail for images
async function generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  // For now, return null - could implement thumbnail generation later
  return null;
}

const uploadChatFile = async (request: FileUploadRequest, userId: string) => {
  // Decode base64 file data
  const buffer = Buffer.from(request.fileData, 'base64');
  
  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (buffer.length > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }

  // Generate unique file path
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2);
  const fileExtension = request.fileName.split('.').pop() || 'bin';
  const storageFileName = `chat-attachments/${request.channelId}/${timestamp}-${randomId}.${fileExtension}`;

  try {
    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('chat-attachments')
      .upload(storageFileName, buffer, {
        contentType: request.fileType,
        duplex: 'half'
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(storageFileName);

    // Get image dimensions if it's an image
    let dimensions = {};
    if (request.fileType.startsWith('image/')) {
      dimensions = await getImageDimensions(buffer, request.fileType);
    }

    // Generate thumbnail for images
    let thumbnailUrl = null;
    if (request.fileType.startsWith('image/')) {
      const thumbnail = await generateThumbnail(buffer, request.fileType);
      if (thumbnail) {
        const thumbnailPath = `chat-attachments/${request.channelId}/thumbnails/${timestamp}-${randomId}_thumb.jpg`;
        const { data: thumbnailData, error: thumbnailError } = await supabase.storage
          .from('chat-attachments')
          .upload(thumbnailPath, thumbnail, {
            contentType: 'image/jpeg'
          });

        if (!thumbnailError) {
          const { data: thumbnailUrlData } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(thumbnailPath);
          thumbnailUrl = thumbnailUrlData.publicUrl;
        }
      }
    }

    // Store attachment metadata in database
    const attachmentRecord = {
      message_id: request.messageId,
      filename: request.fileName,
      original_filename: request.fileName,
      file_size: buffer.length,
      mime_type: request.fileType,
      storage_path: storageFileName,
      storage_bucket: 'chat-attachments',
      public_url: urlData.publicUrl,
      width: dimensions.width,
      height: dimensions.height,
      thumbnail_url: thumbnailUrl,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
      is_processed: true
    };

    const { data: dbData, error: dbError } = await supabase
      .from('chat_message_attachments')
      .insert([attachmentRecord])
      .select()
      .single();

    if (dbError) {
      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from('chat-attachments')
        .remove([storageFileName]);
      
      if (thumbnailUrl) {
        await supabase.storage
          .from('chat-attachments')
          .remove([`chat-attachments/${request.channelId}/thumbnails/${timestamp}-${randomId}_thumb.jpg`]);
      }
      
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    // Update message type if it was text
    if (request.fileType.startsWith('image/')) {
      await supabase
        .from('chat_messages')
        .update({ message_type: 'image' })
        .eq('id', request.messageId);
    } else {
      await supabase
        .from('chat_messages')
        .update({ message_type: 'file' })
        .eq('id', request.messageId);
    }

    return {
      id: dbData.id,
      filename: dbData.filename,
      originalFilename: dbData.original_filename,
      fileSize: dbData.file_size,
      mimeType: dbData.mime_type,
      publicUrl: dbData.public_url,
      thumbnailUrl: dbData.thumbnail_url,
      width: dbData.width,
      height: dbData.height,
      uploadedAt: dbData.uploaded_at,
    };
  } catch (error) {
    console.error('Chat file upload error:', error);
    throw error;
  }
};

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

    // Parse request
    const request: FileUploadRequest = JSON.parse(event.body || '{}');
    
    if (!request.fileName || !request.fileType || !request.fileData || !request.messageId || !request.channelId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Missing required fields: fileName, fileType, fileData, messageId, channelId' 
        }),
      };
    }

    // Check if user has access to the channel
    if (!(await canUserAccessChannel(request.channelId, user.id))) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Access denied to channel' }),
      };
    }

    // Verify the message exists and belongs to the user
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, user_id, channel_id')
      .eq('id', request.messageId)
      .eq('user_id', user.id)
      .eq('channel_id', request.channelId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Message not found or access denied' }),
      };
    }

    const result = await uploadChatFile(request, user.id);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Chat file upload API error:', error);
    
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
