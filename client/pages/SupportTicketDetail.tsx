import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  Paperclip,
  Download,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";

interface SupportResponse {
  id: string;
  message: string;
  author: string;
  authorRole: string;
  timestamp: string;
  attachments?: string[];
}

interface SupportTicket {
  id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  description: string;
  createdDate: string;
  updatedDate: string;
  submittedBy: string;
  responses: SupportResponse[];
  attachments?: string[];
}

export default function SupportTicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) {
      navigate("/support");
      return;
    }

    // Load ticket from localStorage
    const existingTickets = JSON.parse(
      localStorage.getItem("support_tickets") || "[]",
    );
    const foundTicket = existingTickets.find(
      (t: SupportTicket) => t.id === ticketId,
    );

    if (!foundTicket) {
      toast.error("Ticket not found");
      navigate("/support");
      return;
    }

    setTicket(foundTicket);
    setLoading(false);
  }, [ticketId, navigate]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setNewAttachments([...newAttachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setNewAttachments(newAttachments.filter((_, i) => i !== index));
  };

  const handleSubmitResponse = async () => {
    if (!newMessage.trim() || !ticket) return;

    setIsSubmitting(true);
    try {
      const newResponse: SupportResponse = {
        id: Date.now().toString(),
        message: newMessage,
        author: currentUser?.name || "User",
        authorRole: "Business Owner",
        timestamp: new Date().toISOString(),
        attachments: newAttachments.map((file) => file.name),
      };

      const updatedTicket = {
        ...ticket,
        responses: [...ticket.responses, newResponse],
        updatedDate: new Date().toISOString().split("T")[0],
      };

      // Update localStorage
      const existingTickets = JSON.parse(
        localStorage.getItem("support_tickets") || "[]",
      );
      const updatedTickets = existingTickets.map((t: SupportTicket) =>
        t.id === ticket.id ? updatedTicket : t,
      );
      localStorage.setItem("support_tickets", JSON.stringify(updatedTickets));

      setTicket(updatedTicket);
      setNewMessage("");
      setNewAttachments([]);
      toast.success("Response added successfully!");
    } catch (error) {
      toast.error("Failed to add response. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500";
      case "in_progress":
        return "bg-yellow-500";
      case "resolved":
        return "bg-green-500";
      case "closed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <MessageSquare className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4" />;
      case "closed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container px-4 py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!ticket) {
    return (
      <AppLayout>
        <div className="container px-4 py-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">Ticket not found</h3>
            <Link to="/support">
              <Button>Back to Support</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/support">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{ticket.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{ticket.category}</Badge>
              <Badge
                variant="outline"
                className={`text-white ${getPriorityColor(ticket.priority)}`}
              >
                {ticket.priority}
              </Badge>
              <Badge
                variant="outline"
                className={`text-white ${getStatusColor(ticket.status)}`}
              >
                {ticket.status.replace("_", " ")}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Created: {ticket.createdDate}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Original Description */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Original Request
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {currentUser?.name || "User"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Business Owner
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(ticket.createdDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                    </div>
                  </div>

                  {/* Original Attachments */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Attachments</h4>
                      <div className="flex flex-wrap gap-2">
                        {ticket.attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>{attachment}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-1"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Response Thread */}
            <Card>
              <CardHeader>
                <CardTitle>Response Thread</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ticket.responses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No responses yet. Add a message below to continue the
                      conversation.
                    </p>
                  ) : (
                    ticket.responses.map((response) => (
                      <div key={response.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {response.author}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {response.authorRole}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(response.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap mb-2">
                          {response.message}
                        </p>

                        {/* Response Attachments */}
                        {response.attachments &&
                          response.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {response.attachments.map((attachment, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span>{attachment}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 ml-1"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add Response */}
            <Card>
              <CardHeader>
                <CardTitle>Add Response</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Type your response..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="attachments">Attachments</Label>
                    <Input
                      id="attachments"
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="cursor-pointer"
                    />
                    {newAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newAttachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>{file.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-1"
                              onClick={() => removeAttachment(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSubmitResponse}
                      disabled={!newMessage.trim() || isSubmitting}
                      className="gap-2"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isSubmitting ? "Sending..." : "Send Response"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Ticket ID</Label>
                  <p className="text-sm text-muted-foreground">{ticket.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Submitted By</Label>
                  <p className="text-sm text-muted-foreground">
                    {ticket.submittedBy}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {ticket.createdDate}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <p className="text-sm text-muted-foreground">
                    {ticket.updatedDate}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Responses</Label>
                  <p className="text-sm text-muted-foreground">
                    {ticket.responses.length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  If you need immediate assistance, you can also reach out to
                  our support team directly.
                </p>
                <Button variant="outline" className="w-full gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
