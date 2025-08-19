import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "../components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Bot,
  Send,
  Loader2,
  User,
  CreditCard,
  AlertCircle,
  Copy,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Plus,
  Calendar,
  Trash2,
  Edit2,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  cost?: number;
  credits?: number;
  loading?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  total_messages: number;
  total_credits_used: number;
  total_cost: number;
  last_message_at: string;
  created_at: string;
}

interface AIResponse {
  response: string;
  cost: number;
  processing_time: string;
}

export default function AIAgent() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user credits and sessions on component mount
  useEffect(() => {
    loadUserCredits();
    loadChatSessions();
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadUserCredits = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) {
        console.warn("No auth token found");
        setUserCredits(null);
        return;
      }
      
      const response = await fetch("/api/credit-system/balance", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setUserCredits(data.current_credits || 0);
        } else {
          setUserCredits(null);
        }
      } else {
        setUserCredits(null);
      }
    } catch (error) {
      console.error("Error loading user credits:", error);
      setUserCredits(null);
    }
  };

  const loadChatSessions = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch("/api/ai/sessions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    }
  };

  const loadChatMessages = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/ai/sessions/${sessionId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          type: msg.message_type,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          cost: msg.cost,
          credits: msg.credits_used,
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error("Error loading chat messages:", error);
    }
  };

  const createNewChat = async () => {
    if (!newChatTitle.trim()) return;

    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch("/api/ai/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newChatTitle.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSessionId(data.session.id);
        setMessages([]);
        setNewChatTitle("");
        setShowNewChatDialog(false);
        await loadChatSessions();
        toast.success("New chat created!");
      }
    } catch (error) {
      console.error("Error creating new chat:", error);
      toast.error("Failed to create new chat");
    }
  };

  const selectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    loadChatMessages(sessionId);
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/ai/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        await loadChatSessions();
        toast.success("Chat deleted");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("Failed to delete chat");
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/ai/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
        }),
      });

      if (response.ok) {
        await loadChatSessions();
        setEditingSessionId(null);
        setEditTitle("");
        toast.success("Chat title updated");
      }
    } catch (error) {
      console.error("Error updating session title:", error);
      toast.error("Failed to update chat title");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;
    if (!currentSessionId) {
      toast.error("Please start a new chat first");
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: currentMessage.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "ai",
      content: "Thinking...",
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    const messageToSend = currentMessage.trim();
    setCurrentMessage("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageToSend,
          session_id: currentSessionId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error("API returned non-JSON response");
      }

      const data: AIResponse = await response.json();

      // Update the loading message with the actual response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: data.response,
                cost: data.cost,
                credits: Math.ceil(data.cost * 150),
                loading: false,
              }
            : msg
        )
      );

      // Update user credits and reload sessions
      await loadUserCredits();
      await loadChatSessions();

      toast.success(`Response received!`);
    } catch (error) {
      console.error("Error sending message:", error);
      
      setMessages(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: "Sorry, I encountered an error processing your request. Please try again.",
                loading: false,
              }
            : msg
        )
      );

      toast.error("Failed to get AI response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <AppLayout
      title="AI Agent"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "AI Agent" },
      ]}
    >
      <div className="p-3 md:p-6 h-full flex flex-col md:flex-row gap-3 md:gap-6">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">AI Agent</h1>
          </div>
          {userCredits !== null && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm">{userCredits}</span>
            </div>
          )}
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          w-80 md:w-80 flex flex-col space-y-4 bg-background md:bg-transparent
          border-r md:border-none shadow-lg md:shadow-none
          transition-transform duration-300 ease-in-out
          p-4 md:p-0
        `}>
          {/* Mobile Sidebar Header */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Chat History</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between">
            <h2 className="text-lg font-semibold">Chat History</h2>
            <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Chat</DialogTitle>
                  <DialogDescription>
                    Give your new chat session a descriptive title
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="chat-title">Chat Title</Label>
                    <Input
                      id="chat-title"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      placeholder="e.g., SEO Strategy Discussion"
                      onKeyPress={(e) => e.key === "Enter" && createNewChat()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createNewChat} disabled={!newChatTitle.trim()}>
                      Create Chat
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewChatDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Mobile New Chat Button */}
          <div className="md:hidden">
            <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Chat</DialogTitle>
                  <DialogDescription>
                    Give your new chat session a descriptive title
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobile-chat-title">Chat Title</Label>
                    <Input
                      id="mobile-chat-title"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      placeholder="e.g., SEO Strategy Discussion"
                      onKeyPress={(e) => e.key === "Enter" && createNewChat()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createNewChat} disabled={!newChatTitle.trim()}>
                      Create Chat
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewChatDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Credits Display */}
          {userCredits !== null && (
            <Card className="hidden md:block">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">{userCredits} Credits</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No chat sessions yet</p>
              </div>
            ) : (
              sessions.map((session) => (
                <Card
                  key={session.id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    currentSessionId === session.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => {
                    selectSession(session.id);
                    setIsMobileSidebarOpen(false);
                  }}
                >
                  <CardContent className="p-3">
                    {editingSessionId === session.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              updateSessionTitle(session.id, editTitle);
                            } else if (e.key === "Escape") {
                              setEditingSessionId(null);
                              setEditTitle("");
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => updateSessionTitle(session.id, editTitle)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSessionId(null);
                              setEditTitle("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium text-sm truncate pr-2">
                            {session.title}
                          </h3>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(session.id);
                                setEditTitle(session.title);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.last_message_at || session.created_at)}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span>{session.total_messages} messages</span>
                          <span>{session.total_credits_used} credits</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 w-full md:w-auto">
          {!currentSessionId ? (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent className="text-center">
                <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">Welcome to AI Agent</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a new chat to begin asking questions about SEO, marketing, and business strategy
                </p>
                <Button onClick={() => setShowNewChatDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask me anything about SEO, digital marketing, content strategy, or business growth
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {messages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-semibold mb-2">Ready to Help!</h3>
                      <p className="text-sm max-w-md mx-auto">
                        Start a conversation by asking me about SEO strategies, content ideas, 
                        keyword research, competitor analysis, or any marketing questions.
                      </p>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.type === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex gap-2 md:gap-3 max-w-[85%] md:max-w-[80%] ${
                          message.type === "user" ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            message.type === "user"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {message.type === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>

                        {/* Message Content */}
                        <div
                          className={`rounded-lg p-3 ${
                            message.type === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm">
                            {message.loading ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {message.content}
                              </div>
                            ) : (
                              message.content
                            )}
                          </div>

                          {/* Cost and credits info */}
                          {message.type === "ai" && message.cost && !message.loading && (
                            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                              <span>Cost: ${message.cost.toFixed(4)}</span>
                              <span>{message.credits} credits used</span>
                            </div>
                          )}

                          {/* Copy button for AI responses */}
                          {message.type === "ai" && !message.loading && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                              onClick={() => copyToClipboard(message.content)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me about SEO, marketing strategies, content ideas..."
                        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                        rows={2}
                        disabled={isLoading}
                      />
                    </div>
                    <Button
                      onClick={sendMessage}
                      disabled={!currentMessage.trim() || isLoading}
                      className="self-end"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {userCredits !== null && userCredits < 10 && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Low credits remaining ({userCredits}). Consider purchasing more credits to continue using the AI Agent.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
