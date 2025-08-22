export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  channel_type: 'public' | 'private' | 'direct_message';
  topic?: string;
  purpose?: string;
  message_count: number;
  last_message_at?: string;
  is_muted?: boolean;
  is_pinned?: boolean;
  unread_count?: number;
  agency_id?: string;
  workspace_id?: string;
  is_archived?: boolean;
  is_default?: boolean;
  allow_all_agency_members?: boolean;
  require_approval_to_join?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  deleted_at?: string;
  message_type: 'text' | 'system' | 'task_created' | 'file' | 'image';
  parent_message_id?: string;
  thread_count?: number;
  is_pinned?: boolean;
  is_system_message?: boolean;
  mentioned_users?: string[];
  mentioned_channels?: string[];
  created_task_id?: string;
  formatted_content?: any;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
  reactions?: ChatReaction[];
  attachments?: ChatAttachment[];
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  emoji_native: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
}

export interface ChatAttachment {
  id: string;
  message_id: string;
  filename: string;
  original_filename?: string;
  file_size?: number;
  mime_type?: string;
  storage_path: string;
  storage_bucket: string;
  public_url?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  uploaded_by: string;
  uploaded_at: string;
  is_processed?: boolean;
  thumbnail_url?: string;
}

export interface ChatChannelParticipant {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  notification_level: 'all' | 'mentions' | 'none';
  joined_at: string;
  invited_by?: string;
  last_read_at?: string;
  last_read_message_id?: string;
  is_muted?: boolean;
  is_pinned?: boolean;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
}

export interface ChatNotification {
  id: string;
  user_id: string;
  channel_id: string;
  message_id: string;
  notification_type: string;
  is_read: boolean;
  is_sent: boolean;
  sent_at?: string;
  read_at?: string;
  created_at: string;
  title?: string;
  body?: string;
  channel?: ChatChannel;
  message?: ChatMessage;
}

export interface ChatUserPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  desktop_notifications: boolean;
  notification_start_time: string;
  notification_end_time: string;
  weekend_notifications: boolean;
  theme: string;
  compact_mode: boolean;
  show_member_list: boolean;
  message_sound: boolean;
  mention_sound: boolean;
  status: string;
  status_message?: string;
  auto_away_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ChatUserPresence {
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen_at: string;
  current_channel_id?: string;
  session_id?: string;
  user_agent?: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
}

export interface TypingIndicator {
  channel_id: string;
  user_id: string;
  user_name: string;
  started_at: string;
}

export interface ChatStats {
  total_channels: number;
  total_messages: number;
  active_users: number;
  messages_today: number;
  most_active_channel: string;
}

// Event types for real-time subscriptions
export type ChatEventType = 
  | 'message_created'
  | 'message_updated'
  | 'message_deleted'
  | 'reaction_added'
  | 'reaction_removed'
  | 'user_typing'
  | 'user_stopped_typing'
  | 'presence_updated'
  | 'channel_created'
  | 'channel_updated'
  | 'channel_deleted'
  | 'user_joined_channel'
  | 'user_left_channel';

export interface ChatEvent {
  type: ChatEventType;
  channel_id?: string;
  user_id?: string;
  message_id?: string;
  data: any;
  timestamp: string;
}
