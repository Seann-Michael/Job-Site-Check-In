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
} from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  cost?: number;
  credits?: number;
  loading?: boolean;
}

interface AIResponse {
  response: string;
  cost: number;
  processing_time: number;
}

export default function AIAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user credits on component mount
  useEffect(() => {
    loadUserCredits();
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadUserCredits = async () => {
    try {
      console.log("Loading user credits from /api/credit-system/balance");
      const response = await fetch("/api/credit-system/balance", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase_token")}`,
        },
      });

      console.log("Credit response status:", response.status);
      console.log("Credit response headers:", Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.log("Credit data received:", data);
          setUserCredits(data.current_credits || 0);
        } else {
          const text = await response.text();
          console.warn("Credit API returned non-JSON:", text);
          setUserCredits(null);
        }
      } else {
        const errorText = await response.text();
        console.warn(`Failed to load credits (${response.status}):`, errorText);
        setUserCredits(null);
      }
    } catch (error) {
      console.error("Error loading user credits:", error);
      setUserCredits(null);
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

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: currentMessage.trim(),
      timestamp: new Date(),
    };

    // Add user message and loading AI message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "ai",
      content: "Thinking...",
      timestamp: new Date(),
      loading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    const messageToSend = currentMessage.trim();
    setCurrentMessage("");
    setIsLoading(true);

    try {
      console.log("Sending AI message to /api/ai/chat");
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase_token")}`,
        },
        body: JSON.stringify({
          message: messageToSend,
        }),
      });

      console.log("AI response status:", response.status);
      console.log("AI response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI API error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("AI API returned non-JSON:", text);
        throw new Error("API returned non-JSON response");
      }

      const data: AIResponse = await response.json();
      console.log("AI response data:", data);

      // Calculate credits used (markup the cost)
      const creditsUsed = Math.ceil(data.cost * 1.5); // 50% markup

      // Update the loading message with the actual response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: data.response,
                cost: data.cost,
                credits: creditsUsed,
                loading: false,
              }
            : msg,
        ),
      );

      // Update user credits
      setUserCredits((prev) => (prev ? Math.max(0, prev - creditsUsed) : null));

      toast.success(`Response received! Used ${creditsUsed} credits.`);
    } catch (error) {
      console.error("Error sending message:", error);

      // Replace loading message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content:
                  "Sorry, I encountered an error processing your request. Please try again.",
                loading: false,
              }
            : msg,
        ),
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

  const clearChat = () => {
    setMessages([]);
    toast.success("Chat cleared!");
  };

  return (
    <AppLayout
      title="AI Agent"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "AI Agent" },
      ]}
    >
      <div className="p-6 space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Bot className="h-8 w-8 text-blue-600" />
              AI Agent
            </h1>
            <p className="text-muted-foreground">
              Powered by DataForSEO AI - Ask questions about SEO, marketing, and
              business strategy
            </p>
          </div>

          <div className="flex items-center gap-4">
            {userCredits !== null && (
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="font-semibold">{userCredits} Credits</span>
              </div>
            )}
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearChat}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Chat
              </Button>
            )}
          </div>
        </div>

        {/* Usage Info */}
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo Mode:</strong> AI Agent is currently using mock responses for testing.
            Each query consumes a small number of credits. DataForSEO integration is being configured.
          </AlertDescription>
        </Alert>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Assistant
              </CardTitle>
              <CardDescription>
                Ask me anything about SEO, digital marketing, content strategy,
                or business growth
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold mb-2">
                      Ready to Help!
                    </h3>
                    <p className="text-sm max-w-md mx-auto">
                      Start a conversation by asking me about SEO strategies,
                      content ideas, keyword research, competitor analysis, or
                      any marketing questions.
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
                      className={`flex gap-3 max-w-[80%] ${
                        message.type === "user"
                          ? "flex-row-reverse"
                          : "flex-row"
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
                        {message.type === "ai" &&
                          message.cost &&
                          !message.loading && (
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
                      Low credits remaining ({userCredits}). Consider purchasing
                      more credits to continue using the AI Agent.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Tips */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Tips for better results:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • Be specific with your questions for more targeted advice
              </li>
              <li>
                • Ask about competitor analysis, keyword research, or content
                strategies
              </li>
              <li>• Request step-by-step guides for SEO improvements</li>
              <li>• Inquire about industry trends and best practices</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
