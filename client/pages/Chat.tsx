import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useChatPresence } from '@/hooks/useChatPresence';
import { useTypingIndicators } from '@/hooks/useTypingIndicators';
import { chatChannelManager } from '@/lib/chatUtils';
import { makeAuthenticatedChatRequest, withAuthRetry } from '@/lib/chatAuth';
import type {
  ChatChannel,
  ChatMessage,
  ChatReaction,
  ChatUserPresence
} from '@/types/chat';
import {
  Hash,
  Plus,
  Search,
  Settings,
  Users,
  Bell,
  MoreVertical,
  Send,
  Smile,
  Paperclip,
  AtSign,
  MessageSquare,
  Pin,
  Star,
  Volume2,
  VolumeX,
  Edit,
  Trash2,
  Reply,
  Copy,
  UserPlus,
  LogOut,
  Clock,
  Check,
  CheckCheck,
  Circle,
  Minus,
  Wifi,
  WifiOff
} from "lucide-react";


// Initialize Supabase client for real-time subscriptions
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function Chat() {
  const { user } = useAuth();
  const { onlineUsers, currentStatus, isConnected, updatePresence } = useChatPresence();

  // State declarations first
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);

  // Hooks that depend on state
  const {
    typingUsers,
    isTyping,
    handleTyping,
    stopTyping,
    getTypingText,
    hasTypingUsers
  } = useTypingIndicators(selectedChannel?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelType, setNewChannelType] = useState<'public' | 'private'>('public');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function definitions (need to be before useEffect hooks that use them)
  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await makeAuthenticatedChatRequest('/api/chat/channels');
      setChannels(data.channels || []);

      // Select first channel by default
      if (data.channels && data.channels.length > 0 && !selectedChannel) {
        setSelectedChannel(data.channels[0]);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      toast.error('Error loading channels');
    } finally {
      setLoading(false);
    }
  }, [selectedChannel]);

  // Ensure default channels exist and user is part of them
  const ensureDefaultChannels = useCallback(async () => {
    try {
      await chatChannelManager.ensureDefaultChannels();
      // Reload channels after ensuring defaults
      await loadChannels();
    } catch (error) {
      console.error('Error ensuring default channels:', error);
    }
  }, [loadChannels]);

  const loadMessages = useCallback(async (channelId: string) => {
    setMessageLoading(true);
    try {
      const data = await makeAuthenticatedChatRequest(`/api/chat/messages?channel_id=${channelId}&limit=50`);
      setMessages((data.messages || []).reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Error loading messages');
    } finally {
      setMessageLoading(false);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // Real-time message subscription
  useEffect(() => {
    if (!selectedChannel || !user) return;

    const channel = supabase
      .channel(`messages:${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChannel.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          // Only add if it's not from current user (to avoid duplicates)
          if (newMessage.user_id !== user.id) {
            setMessages(prev => [...prev, newMessage]);
            // Load full message data with user info
            loadMessageWithUserData(newMessage.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChannel.id}`
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          setMessages(prev => prev.map(msg =>
            msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChannel.id}`
        },
        (payload) => {
          const deletedMessage = payload.old as ChatMessage;
          setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannel, user]);

  // Update presence when channel changes
  useEffect(() => {
    if (selectedChannel && user) {
      updatePresence(currentStatus, selectedChannel.id);
    }
  }, [selectedChannel, user, currentStatus, updatePresence]);

  // Load channels on component mount
  useEffect(() => {
    if (user) {
      loadChannels();
      ensureDefaultChannels();
    }
  }, [user, loadChannels, ensureDefaultChannels]);

  // Load messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
    }
  }, [selectedChannel, loadMessages]);

  // Load message with user data
  const loadMessageWithUserData = async (messageId: string) => {
    try {
      const messageData = await makeAuthenticatedChatRequest(`/api/chat/messages/${messageId}`);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? messageData : msg
      ));
    } catch (error) {
      console.error('Error loading message data:', error);
    }
  };


  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return;

    // Clear typing indicator
    stopTyping();

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      channel_id: selectedChannel.id,
      message_type: 'text',
      user: {
        id: user.id,
        email: user.email || '',
        raw_user_meta_data: user.user_metadata
      }
    };

    // Optimistically add message to UI
    setMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage('');
    messageInputRef.current?.focus();

    try {
      const message = await makeAuthenticatedChatRequest('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: selectedChannel.id,
          content: messageContent,
          message_type: 'text'
        }),
      });

      // Replace temp message with real message
      setMessages(prev => prev.map(msg =>
        msg.id === tempMessage.id ? message : msg
      ));
    } catch (error) {
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      console.error('Error sending message:', error);
      toast.error('Error sending message');
      setNewMessage(messageContent); // Restore message content
    }
  };

  const createChannel = async (channelData?: any) => {
    const data = channelData || {
      name: newChannelName,
      description: newChannelDescription,
      channel_type: newChannelType,
      allow_all_agency_members: newChannelType === 'public'
    };

    if (!data.name.trim()) {
      toast.error('Channel name is required');
      return;
    }

    try {
      const channel = await chatChannelManager.createChannel(data);

      if (channel) {
        setChannels(prev => [...prev, channel]);
        setSelectedChannel(channel);

        if (!channelData) {
          setIsCreatingChannel(false);
          setNewChannelName('');
          setNewChannelDescription('');
          toast.success('Channel created successfully');
        }

        return channel;
      } else {
        toast.error('Failed to create channel');
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Error creating channel');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getUserDisplayName = (user: any) => {
    return user?.raw_user_meta_data?.full_name || 
           user?.raw_user_meta_data?.name || 
           user?.email?.split('@')[0] || 
           'Unknown User';
  };

  const getUserInitials = (user: any) => {
    const name = getUserDisplayName(user);
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Circle className="h-3 w-3 fill-green-500 text-green-500" />;
      case 'away':
        return <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />;
      case 'busy':
        return <Minus className="h-3 w-3 text-red-500" />;
      default:
        return <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else {
      handleTyping();
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  // Stop typing when user stops typing for a while
  useEffect(() => {
    if (newMessage === '') {
      stopTyping();
    }
  }, [newMessage, stopTyping]);

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Channels */}
      <div className="w-64 bg-muted/50 border-r flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Chat</h2>
            <Button size="sm" variant="ghost" onClick={() => setIsCreatingChannel(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search channels"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Channels List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredChannels.map((channel) => (
              <Button
                key={channel.id}
                variant={selectedChannel?.id === channel.id ? "secondary" : "ghost"}
                className="w-full justify-start h-auto p-2"
                onClick={() => setSelectedChannel(channel)}
              >
                <div className="flex items-center gap-2 w-full">
                  <Hash className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{channel.name}</span>
                      {channel.unread_count && channel.unread_count > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 text-xs">
                          {channel.unread_count}
                        </Badge>
                      )}
                    </div>
                    {channel.topic && (
                      <div className="text-xs text-muted-foreground truncate">
                        {channel.topic}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {channel.is_pinned && <Pin className="h-3 w-3" />}
                    {channel.is_muted && <VolumeX className="h-3 w-3" />}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{selectedChannel.name}</h3>
                      {isConnected ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {selectedChannel.topic && (
                      <p className="text-sm text-muted-foreground">{selectedChannel.topic}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Users className="h-4 w-4" />
                    <span className="ml-1 text-xs">{onlineUsers.length}</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowMemberList(!showMemberList)}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messageLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                    <p className="text-muted-foreground">Be the first to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const isNewSender = !prevMessage || prevMessage.user_id !== message.user_id;
                    const showTimestamp = !prevMessage || 
                      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000; // 5 minutes

                    return (
                      <div key={message.id} className={`group ${isNewSender ? 'mt-4' : 'mt-1'}`}>
                        <div className="flex gap-3">
                          {isNewSender ? (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={message.user?.raw_user_meta_data?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {getUserInitials(message.user)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8 flex-shrink-0 flex justify-center">
                              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
                                {formatTime(message.created_at)}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            {isNewSender && (
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {getUserDisplayName(message.user)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(message.created_at)}
                                </span>
                                {message.edited_at && (
                                  <span className="text-xs text-muted-foreground">(edited)</span>
                                )}
                              </div>
                            )}
                            
                            <div className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </div>
                            
                            {/* Reactions */}
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {message.reactions.map((reaction) => (
                                  <Button
                                    key={reaction.id}
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                  >
                                    {reaction.emoji_native} 1
                                  </Button>
                                ))}
                              </div>
                            )}
                            
                            {/* Thread indicator */}
                            {message.thread_count && message.thread_count > 0 && (
                              <Button variant="ghost" size="sm" className="mt-1 h-auto p-1 text-xs text-primary">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}
                              </Button>
                            )}
                          </div>
                          
                          {/* Message Actions */}
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Smile className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Reply className="h-3 w-3" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy text
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Pin className="h-4 w-4 mr-2" />
                                  Pin message
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Star className="h-4 w-4 mr-2" />
                                  Save message
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit message
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete message
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing Indicators */}
              {hasTypingUsers && (
                <div className="px-4 py-2 text-sm text-muted-foreground italic">
                  {getTypingText()}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Textarea
                      ref={messageInputRef}
                      value={newMessage}
                      onChange={handleMessageChange}
                      onKeyPress={handleKeyPress}
                      onBlur={stopTyping}
                      placeholder={`Message #${selectedChannel.name}`}
                      className="min-h-[40px] max-h-32 resize-none"
                      rows={1}
                    />
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <AtSign className="h-4 w-4" />
                  </Button>
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Welcome to Team Chat</h3>
              <p className="text-muted-foreground">Select a channel to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Members */}
      {showMemberList && selectedChannel && (
        <div className="w-64 bg-muted/30 border-l">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Members</h3>
              <Badge variant="secondary" className="text-xs">
                {onlineUsers.filter(u => u.status === 'online').length} online
              </Badge>
            </div>

            {/* Current User Status */}
            {user && (
              <div className="mb-4 p-2 bg-background rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.raw_user_meta_data?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getUserInitials({ raw_user_meta_data: user.raw_user_meta_data, email: user.email })}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(currentStatus)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      You
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {currentStatus}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updatePresence('online')}>
                        <Circle className="h-3 w-3 fill-green-500 text-green-500 mr-2" />
                        Online
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updatePresence('away')}>
                        <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500 mr-2" />
                        Away
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updatePresence('busy')}>
                        <Minus className="h-3 w-3 text-red-500 mr-2" />
                        Busy
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

            {/* Online Members */}
            <div className="space-y-2">
              {onlineUsers
                .filter(presence => presence.user_id !== user?.id)
                .map((presence) => (
                <div key={presence.user_id} className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={presence.user?.raw_user_meta_data?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getUserInitials(presence.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(presence.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {getUserDisplayName(presence.user)}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {presence.status}
                    </div>
                  </div>
                </div>
              ))}

              {onlineUsers.filter(u => u.user_id !== user?.id).length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No other members online
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Dialog */}
      <Dialog open={isCreatingChannel} onOpenChange={setIsCreatingChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Create a new channel for your team to collaborate.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Channel Name</label>
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. general, random, project-alpha"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                placeholder="What is this channel about?"
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Channel Type</label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={newChannelType === 'public' ? 'default' : 'outline'}
                  onClick={() => setNewChannelType('public')}
                  className="flex-1"
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Public
                </Button>
                <Button
                  variant={newChannelType === 'private' ? 'default' : 'outline'}
                  onClick={() => setNewChannelType('private')}
                  className="flex-1"
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Private
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsCreatingChannel(false)}>
              Cancel
            </Button>
            <Button onClick={createChannel}>
              Create Channel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
