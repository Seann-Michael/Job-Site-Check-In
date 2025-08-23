import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
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
  Send,
  Smile,
  Paperclip,
  MoreHorizontal,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Pin,
  Bell,
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
  type: "text" | "dm";
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
  { id: "4", name: "team-discussion", type: "text", category: "Work" },
  { id: "5", name: "client-feedback", type: "text", category: "Clients" },
  { id: "6", name: "Sarah Johnson", type: "dm", category: "Direct Messages" },
  { id: "7", name: "Mike Wilson", type: "dm", category: "Direct Messages" },
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
    new Set(["Company", "Work", "Clients", "Direct Messages"])
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
    <AppLayout 
      title="Team Chat" 
      description="Communicate with your team members"
      breadcrumbs={[{ label: "Team Chat" }]}
      showFooter={false}
      className="h-screen overflow-hidden"
    >
      <div className="flex h-full bg-background">
        {/* Channels Sidebar */}
        <Card className="w-72 flex flex-col border-r shadow-sm rounded-none border-t-0">
          {/* Channels Header */}
          <div className="p-4 border-b bg-card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Channels</h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Channels List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {Object.entries(groupedChannels).map(([category, channels]) => (
                <div key={category}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-8 px-2 font-semibold uppercase tracking-wide"
                    onClick={() => toggleCategory(category)}
                  >
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-3 h-3 mr-2" />
                    ) : (
                      <ChevronRight className="w-3 h-3 mr-2" />
                    )}
                    {category}
                  </Button>
                  
                  {expandedCategories.has(category) && (
                    <div className="ml-4 space-y-0.5">
                      {channels.map((channel) => (
                        <Button
                          key={channel.id}
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-foreground hover:bg-accent h-8 px-2 text-sm",
                            selectedChannel.id === channel.id && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => setSelectedChannel(channel)}
                        >
                          {channel.type === "dm" ? (
                            <div className="w-4 h-4 mr-2 relative">
                              <Avatar className="w-4 h-4">
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                  {channel.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                            </div>
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
        </Card>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <Card className="border-b border-x-0 border-t-0 rounded-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {selectedChannel.type === "dm" ? (
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {selectedChannel.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Hash className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedChannel.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedChannel.type === "dm" ? "Direct Message" : "Team collaboration and project discussions"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Pin className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Bell className="w-4 h-4" />
                  </Button>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search messages"
                      className="pl-9 w-40 h-8"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMembersList(!showMembersList)}
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {messages.map((msg, index) => {
                const showAvatar = index === 0 || messages[index - 1].user.id !== msg.user.id;
                const isFirstInGroup = showAvatar;
                
                return (
                  <div key={msg.id} className={cn("flex group hover:bg-accent/50 px-4 py-2 -mx-4 rounded", isFirstInGroup && "mt-4")}>
                    <div className="w-10 mr-3 flex-shrink-0">
                      {showAvatar ? (
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={msg.user.avatar} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {msg.user.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                          {formatTime(msg.timestamp)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {showAvatar && (
                        <div className="flex items-baseline space-x-2 mb-1">
                          <span className="font-semibold text-foreground text-sm">
                            {msg.user.name}
                          </span>
                          {msg.user.role && (
                            <Badge variant="secondary" className="text-xs h-4 px-1">
                              {msg.user.role}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className="text-foreground text-sm leading-relaxed">
                        {msg.content}
                        {msg.edited && (
                          <span className="text-xs text-muted-foreground ml-1">(edited)</span>
                        )}
                      </div>
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex space-x-1 mt-1">
                          {msg.reactions.map((reaction, idx) => (
                            <Button
                              key={idx}
                              variant="ghost"
                              className="h-6 px-2 text-xs bg-accent hover:bg-accent/80"
                            >
                              {reaction.emoji} {reaction.count}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                      <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
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
          <Card className="border-t border-x-0 border-b-0 rounded-none">
            <CardContent className="p-4">
              <div className="relative">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${selectedChannel.type === "dm" ? selectedChannel.name : "#" + selectedChannel.name}`}
                  className="pr-20 min-h-[44px] py-3"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
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
            </CardContent>
          </Card>
        </div>

        {/* Members Sidebar */}
        {showMembersList && (
          <Card className="w-64 border-l border-r-0 rounded-none shadow-sm">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Members — {mockUsers.filter(u => u.status !== "offline").length}
              </h4>
              
              <div className="space-y-3">
                {["online", "away", "busy", "offline"].map((status) => {
                  const usersInStatus = mockUsers.filter(user => user.status === status);
                  if (usersInStatus.length === 0) return null;
                  
                  return (
                    <div key={status}>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {status} — {usersInStatus.length}
                      </h5>
                      <div className="space-y-1">
                        {usersInStatus.map((user) => (
                          <div key={user.id} className="flex items-center space-x-3 p-2 rounded hover:bg-accent cursor-pointer">
                            <div className="relative">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                  {user.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background rounded-full",
                                getStatusColor(user.status)
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">
                                {user.name}
                              </div>
                              {user.role && (
                                <div className="text-xs text-muted-foreground">
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
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
