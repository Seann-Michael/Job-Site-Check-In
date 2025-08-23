import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Users, Plus } from "lucide-react";

export default function ChatSimple() {
  const [message, setMessage] = useState("");

  const mockChannels = [
    { id: 1, name: "General", unread: 3, type: "public" },
    { id: 2, name: "Project Updates", unread: 0, type: "public" },
    { id: 3, name: "Team Chat", unread: 1, type: "private" },
  ];

  const mockMessages = [
    { id: 1, user: "John Smith", message: "Hello team! How's the project going?", time: "10:30 AM" },
    { id: 2, user: "Sarah Johnson", message: "Making good progress on the frontend.", time: "10:35 AM" },
    { id: 3, user: "Mike Wilson", message: "Backend API is ready for testing.", time: "10:40 AM" },
  ];

  return (
    <AppLayout>
      <div className="p-6 h-[calc(100vh-120px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Channels Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Channels
                </CardTitle>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium"># {channel.name}</span>
                    {channel.type === "private" && (
                      <Badge variant="secondary" className="text-xs">Private</Badge>
                    )}
                  </div>
                  {channel.unread > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {channel.unread}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-3 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  # General
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    5 members
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            
            {/* Messages */}
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
                {mockMessages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {msg.user.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{msg.user}</span>
                        <span className="text-xs text-muted-foreground">{msg.time}</span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      console.log("Sending message:", message);
                      setMessage("");
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    console.log("Sending message:", message);
                    setMessage("");
                  }}
                  disabled={!message.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
