# Chat Database Setup Instructions

## Overview
This document provides step-by-step instructions to set up the chat database schema in your Supabase project.

## Prerequisites
- A Supabase project set up and configured
- Admin access to your Supabase dashboard
- The chat-schema.sql file

## Setup Steps

### 1. Access Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### 2. Run the Chat Schema
1. Click **"New Query"**
2. Copy the entire contents of `scripts/chat-schema.sql`
3. Paste it into the SQL editor
4. Click **"Run"** to execute the schema

### 3. Verify Installation
After running the schema, you should see these tables created:
- `chat_channels`
- `chat_channel_participants`
- `chat_messages`
- `chat_message_reactions`
- `chat_user_presence`
- `chat_notifications`

You can verify by going to **Table Editor** and checking that these tables exist.

### 4. Default Data
The schema automatically creates 5 default channels:
- **general** - General discussion for the team
- **announcements** - Important company announcements
- **project-updates** - Updates on current projects
- **team-discussion** - Casual team conversations
- **client-feedback** - Client feedback and reviews

### 5. Row Level Security (RLS)
The schema includes comprehensive RLS policies that ensure:
- Users can only see channels they participate in
- Users can only view messages in their channels
- Users can only update their own messages and presence
- Proper access control for different user roles

### 6. Automatic User Setup
When new users are created, they are automatically:
- Added to all default public channels
- Given a presence record with 'offline' status

## What's Included

### Tables
- **chat_channels**: Store channel information
- **chat_channel_participants**: Track channel memberships
- **chat_messages**: Store all chat messages
- **chat_message_reactions**: Handle emoji reactions
- **chat_user_presence**: Track online/offline status
- **chat_notifications**: Manage unread message notifications

### Features
- Row Level Security for data protection
- Automatic timestamps with triggers
- Optimized indexes for performance
- Support for direct messages
- Message threading capability
- User presence tracking
- Notification system

### Security
- All tables have RLS enabled
- Users can only access data they have permission to see
- Channel-based access control
- Message ownership verification

## Troubleshooting

### If you get permission errors:
Make sure you're running the SQL as a Supabase admin user.

### If tables already exist:
The schema uses `IF NOT EXISTS` clauses, so it's safe to run multiple times.

### If you need to reset:
To completely reset the chat schema, you can run:
```sql
DROP TABLE IF EXISTS chat_notifications CASCADE;
DROP TABLE IF EXISTS chat_message_reactions CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_channel_participants CASCADE;
DROP TABLE IF EXISTS chat_user_presence CASCADE;
DROP TABLE IF EXISTS chat_channels CASCADE;
```

Then re-run the schema.

## Next Steps
After setting up the database:
1. Update your Netlify functions to use the real database
2. Test the chat functionality
3. Configure real-time subscriptions for live messaging
