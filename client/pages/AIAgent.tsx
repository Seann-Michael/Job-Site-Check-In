import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "../components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { 
  Bot, 
  Send, 
  User, 
  Loader2,
  MessageSquare,
  Sparkles 
} from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  loading?: boolean;
}

export default function AIAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(250000);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

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
      // Simple mock AI responses
      const responses = [
        `Great question about "${messageToSend}"! Here are some key insights:

• **SEO Strategy**: Focus on long-tail keywords and user intent
• **Content Marketing**: Create valuable, engaging content that solves problems  
• **Technical SEO**: Ensure fast loading times and mobile optimization
• **Local SEO**: Optimize for local search if you serve specific geographic areas

Would you like me to elaborate on any of these areas?`,

        `Regarding "${messageToSend}", here's my analysis:

• **Competitor Research**: Analyze top-performing competitors in your space
• **Keyword Opportunities**: Look for low-competition, high-intent keywords
• **Content Gaps**: Identify topics your competitors haven't covered well
• **Backlink Strategy**: Build quality links from relevant, authoritative sites

Let me know if you need specific tactics for any of these strategies!`,

        `For "${messageToSend}", I recommend these approaches:

• **Performance Optimization**: Improve Core Web Vitals and page speed
• **User Experience**: Enhance navigation and reduce bounce rates
• **Content Quality**: Create comprehensive, authoritative content
• **Social Signals**: Build engagement across social media platforms

Each of these elements works together to improve your overall digital presence.`
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const creditsUsed = Math.floor(5 + Math.random() * 15); // 5-20 credits

      // Update the loading message with the actual response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: randomResponse,
                loading: false,
              }
            : msg
        )
      );

      // Update credits
      setCredits(prev => Math.max(0, prev - creditsUsed));
      toast.success(`Response generated! Used ${creditsUsed} credits.`);

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

  const formatCredits = (credits: number) => {
    if (credits >= 1000000) {
      return `${(credits / 1000000).toFixed(1)}M`;
    } else if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}K`;
    }
    return credits.toString();
  };

  return (
    <AppLayout
      title="AI Agent"
      description="Get instant SEO and marketing insights powered by AI"
    >
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Agent</h1>
              <p className="text-muted-foreground">Your SEO & Marketing Assistant</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="px-3 py-1">
              <Sparkles className="h-4 w-4 mr-2" />
              {formatCredits(credits)} credits
            </Badge>
          </div>
        </div>

        {/* Chat Interface */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Chat</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Welcome to AI Agent</h3>
                  <p className="text-muted-foreground">
                    Ask me anything about SEO, marketing, content strategy, or business growth!
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex items-start space-x-2 max-w-[80%] ${
                      message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
                    }`}
                  >
                    <div
                      className={`p-2 rounded-full ${
                        message.type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.type === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`rounded-lg p-3 ${
                        message.type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.loading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about SEO, marketing, content strategy..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || isLoading}
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
