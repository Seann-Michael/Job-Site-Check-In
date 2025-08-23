import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Hash,
  Plus,
  Settings,
  Mic,
  Headphones,
  Send,
  Smile,
  Paperclip,
  MoreHorizontal,
  UserPlus,
  Bell,
  Pin,
  Users,
  Phone,
  Video,
  Search,
  AtSign,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "away" | "busy" | "offline";
  role?: string;
}

interface Channel {
  id: string;
  name: string;
  type: "text" | "voice" | "dm";
  unread?: number;
  category?: string;
}

interface Message {
  id: string;
  user: User;
  content: string;
  timestamp: Date;
  edited?: boolean;
  reactions?: { emoji: string; count: number; users: string[] }[];
}

const mockUsers: User[] = [
  { id: "1", name: "John Smith", status: "online", role: "Admin" },
  { id: "2", name: "Sarah Johnson", status: "online", role: "Manager" },
  { id: "3", name: "Mike Wilson", status: "away", role: "Agent" },
  { id: "4", name: "Emma Davis", status: "busy", role: "Agent" },
  { id: "5", name: "Alex Brown", status: "offline", role: "Client" },
];

const mockChannels: Channel[] = [
  { id: "1", name: "general", type: "text", category: "Company" },
  { id: "2", name: "announcements", type: "text", category: "Company" },
  { id: "3", name: "project-updates", type: "text", category: "Work", unread: 3 },
  { id: "4", name: "team-chat", type: "text", category: "Work" },
  { id: "5", name: "General Voice", type: "voice", category: "Voice Channels" },
  { id: "6", name: "Team Meeting", type: "voice", category: "Voice Channels" },
];

const mockMessages: Message[] = [
  {
    id: "1",
    user: mockUsers[0],
    content: "Welcome to the team chat! 👋 Let's keep our communications organized here.",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "2",
    user: mockUsers[1],
    content: "Thanks John! This will help us stay connected. I've uploaded the project guidelines to the shared folder.",
    timestamp: new Date(Date.now() - 3500000),
  },
  {
    id: "3",
    user: mockUsers[2],
    content: "Perfect timing! I was just about to ask about the new client onboarding process.",
    timestamp: new Date(Date.now() - 3400000),
  },
  {
    id: "4",
    user: mockUsers[1],
    content: "The onboarding docs are ready. I'll share them in #project-updates shortly.",
    timestamp: new Date(Date.now() - 3300000),
    reactions: [{ emoji: "👍", count: 2, users: ["1", "3"] }],
  },
];

export default function Chat() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>(mockChannels[0]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Company", "Work", "Voice Channels"])
  );
  const [showMembersList, setShowMembersList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      user: mockUsers[0], // Current user
      content: message,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const groupedChannels = mockChannels.reduce((acc, channel) => {
    const category = channel.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(channel);
    return acc;
  }, {} as Record<string, Channel[]>);

  const getStatusColor = (status: User["status"]) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "away": return "bg-yellow-500";
      case "busy": return "bg-red-500";
      case "offline": return "bg-gray-400";
      default: return "bg-gray-400";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Server/Company Sidebar */}
      <div className="w-16 bg-gray-900 dark:bg-gray-950 flex flex-col items-center py-3 space-y-2">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group">
          <span className="text-white font-semibold text-lg">LS</span>
        </div>
        <Separator className="w-8 bg-gray-600" />
        <div className="w-12 h-12 bg-gray-700 rounded-full hover:rounded-xl hover:bg-green-600 transition-all duration-200 flex items-center justify-center cursor-pointer">
          <Plus className="text-white w-6 h-6" />
        </div>
      </div>

      {/* Channels Sidebar */}
      <div className="w-60 bg-gray-800 dark:bg-gray-800 flex flex-col">
        {/* Server Header */}
        <div className="h-12 border-b border-gray-700 flex items-center px-4 shadow-md">
          <h2 className="text-white font-semibold text-sm">Local SEO Company</h2>
          <ChevronDown className="text-gray-400 w-4 h-4 ml-auto" />
        </div>

        {/* Channels List */}
        <ScrollArea className="flex-1 px-2">
          <div className="py-3 space-y-1">
            {Object.entries(groupedChannels).map(([category, channels]) => (
              <div key={category}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs text-gray-400 hover:text-gray-300 h-6 px-1 font-semibold uppercase tracking-wide"
                  onClick={() => toggleCategory(category)}
                >
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-3 h-3 mr-1" />
                  ) : (
                    <ChevronRight className="w-3 h-3 mr-1" />
                  )}
                  {category}
                </Button>
                
                {expandedCategories.has(category) && (
                  <div className="ml-2 space-y-0.5">
                    {channels.map((channel) => (
                      <Button
                        key={channel.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700/50 h-8 px-2 text-sm",
                          selectedChannel.id === channel.id && "bg-gray-700/70 text-white"
                        )}
                        onClick={() => setSelectedChannel(channel)}
                      >
                        {channel.type === "voice" ? (
                          <Volume2 className="w-4 h-4 mr-2 text-green-500" />
                        ) : (
                          <Hash className="w-4 h-4 mr-2" />
                        )}
                        <span className="truncate">{channel.name}</span>
                        {channel.unread && (
                          <Badge variant="destructive" className="ml-auto h-4 min-w-4 text-xs px-1">
                            {channel.unread}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* User Panel */}
        <div className="h-14 bg-gray-900/50 border-t border-gray-700 flex items-center px-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-600 text-white text-sm">JS</AvatarFallback>
          </Avatar>
          <div className="ml-2 flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">John Smith</div>
            <div className="text-gray-400 text-xs">#1234</div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-white">
              <Mic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-white">
              <Headphones className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-white">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        {/* Chat Header */}
        <div className="h-12 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 bg-white dark:bg-gray-800 shadow-sm">
          <Hash className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-gray-900 dark:text-white font-semibold">{selectedChannel.name}</h3>
          <div className="text-gray-500 text-sm ml-2 hidden sm:block">
            Team collaboration and project discussions
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <Video className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <Pin className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <Users className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search"
                className="pl-9 w-36 h-7 bg-gray-100 dark:bg-gray-700 border-none text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => setShowMembersList(!showMembersList)}
            >
              <Users className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const showAvatar = index === 0 || messages[index - 1].user.id !== msg.user.id;
              const isFirstInGroup = showAvatar;
              
              return (
                <div key={msg.id} className={cn("flex group hover:bg-gray-50 dark:hover:bg-gray-700/50 px-4 py-1 -mx-4 rounded", isFirstInGroup && "mt-4")}>
                  <div className="w-10 mr-3 flex-shrink-0">
                    {showAvatar ? (
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={msg.user.avatar} />
                        <AvatarFallback className="bg-blue-600 text-white">
                          {msg.user.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="text-xs text-gray-400 text-center opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {msg.user.name}
                        </span>
                        {msg.user.role && (
                          <Badge variant="secondary" className="text-xs h-4 px-1">
                            {msg.user.role}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
                      {msg.content}
                      {msg.edited && (
                        <span className="text-xs text-gray-400 ml-1">(edited)</span>
                      )}
                    </div>
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex space-x-1 mt-1">
                        {msg.reactions.map((reaction, idx) => (
                          <Button
                            key={idx}
                            variant="ghost"
                            className="h-6 px-2 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            {reaction.emoji} {reaction.count}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message #${selectedChannel.name}`}
              className="pr-20 bg-gray-100 dark:bg-gray-700 border-none text-sm min-h-[44px] py-3"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-gray-600">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-gray-400 hover:text-gray-600">
                <Smile className="w-4 h-4" />
              </Button>
              <Button
                onClick={sendMessage}
                size="sm"
                className="w-8 h-8 p-0"
                disabled={!message.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Members Sidebar */}
      {showMembersList && (
        <div className="w-60 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Members — {mockUsers.filter(u => u.status !== "offline").length}
            </h4>
            
            <div className="space-y-3">
              {["online", "away", "busy", "offline"].map((status) => {
                const usersInStatus = mockUsers.filter(user => user.status === status);
                if (usersInStatus.length === 0) return null;
                
                return (
                  <div key={status}>
                    <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                      {status} — {usersInStatus.length}
                    </h5>
                    <div className="space-y-1">
                      {usersInStatus.map((user) => (
                        <div key={user.id} className="flex items-center space-x-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer">
                          <div className="relative">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-blue-600 text-white text-xs">
                                {user.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white dark:border-gray-800 rounded-full",
                              getStatusColor(user.status)
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.name}
                            </div>
                            {user.role && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.role}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
