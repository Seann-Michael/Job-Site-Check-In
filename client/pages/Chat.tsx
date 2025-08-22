import React, { useState, useEffect, useRef } from "react";
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
  Minus
} from "lucide-react";

interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  channel_type: 'public' | 'private' | 'direct_message';
  topic?: string;
  message_count: number;
  last_message_at?: string;
  is_muted?: boolean;
  is_pinned?: boolean;
  unread_count?: number;
}

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  edited_at?: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
  reactions?: ChatReaction[];
  thread_count?: number;
  parent_message_id?: string;
}

interface ChatReaction {
  id: string;
  emoji: string;
  emoji_native: string;
  user_id: string;
  created_at: string;
}

interface UserPresence {
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen_at: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
}

export default function Chat() {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load channels on component mount
  useEffect(() => {
    loadChannels();
    loadOnlineUsers();
  }, []);

  // Load messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
    }
  }, [selectedChannel]);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/chat/channels', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
        
        // Select first channel by default
        if (data.channels && data.channels.length > 0 && !selectedChannel) {
          setSelectedChannel(data.channels[0]);
        }
      } else {
        toast.error('Failed to load channels');
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      toast.error('Error loading channels');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    setMessageLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch(`/api/chat/messages?channel_id=${channelId}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((data.messages || []).reverse()); // Reverse to show oldest first
      } else {
        toast.error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Error loading messages');
    } finally {
      setMessageLoading(false);
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/chat/preferences/online-users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOnlineUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel) return;

    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_id: selectedChannel.id,
          content: newMessage,
          message_type: 'text'
        }),
      });

      if (response.ok) {
        const message = await response.json();
        setMessages(prev => [...prev, message]);
        setNewMessage('');
        messageInputRef.current?.focus();
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message');
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error('Channel name is required');
      return;
    }

    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newChannelName,
          description: newChannelDescription,
          channel_type: newChannelType,
          allow_all_agency_members: newChannelType === 'public'
        }),
      });

      if (response.ok) {
        const channel = await response.json();
        setChannels(prev => [...prev, channel]);
        setSelectedChannel(channel);
        setIsCreatingChannel(false);
        setNewChannelName('');
        setNewChannelDescription('');
        toast.success('Channel created successfully');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
                    <h3 className="font-semibold">{selectedChannel.name}</h3>
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
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Textarea
                    ref={messageInputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Message #${selectedChannel.name}`}
                    className="min-h-[40px] max-h-32 resize-none"
                    rows={1}
                  />
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
            <h3 className="font-medium mb-4">Online Members</h3>
            <div className="space-y-2">
              {onlineUsers.map((presence) => (
                <div key={presence.user_id} className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={presence.user?.raw_user_meta_data?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getUserInitials(presence.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1">
                      {getStatusIcon(presence.status)}
                    </div>
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
