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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppLayout } from "@/components/AppLayout";
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  MoreVertical,
  Eye,
  MessageCircle,
  Paperclip,
  Activity,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isAgencyAdmin, isSuperAdmin, getCurrentUser } from "@/lib/auth";
import { ArrowUpDown } from "lucide-react";
import { supabase } from "@/lib/dataService";
import { Link } from "react-router-dom";

interface SupportTicket {
  id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  description: string;
  createdDate: string;
  updatedDate: string;
  assignedTo?: string;
  submittedBy: string;
  responses: TicketResponse[];
}

interface TicketResponse {
  id: string;
  message: string;
  timestamp: string;
  author: string;
  isStaff: boolean;
}


export default function Support() {
  const { toast } = useToast();
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortField, setSortField] = useState<string>("createdDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    priority: "medium" as SupportTicket["priority"],
    description: "",
  });

  const categories = [
    "Technical Issue",
    "Billing Question",
    "Feature Request",
    "Account Access",
    "Integration Help",
    "Data Export",
    "Performance Issue",
    "Security Concern",
    "Training Request",
    "Other",
  ];

  useEffect(() => {
    loadTickets();
  }, []);


  const getCurrentUserRole = () => {
    if (isSuperAdmin()) return "super-admin";
    if (isAgencyAdmin()) return "agency-admin";
    return "admin";
  };

  const loadTickets = async () => {
    try {
      const role = getCurrentUserRole();
      const currentUser = getCurrentUser();

      let query = supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      // Business admin only sees their own tickets
      if (role === "admin" && currentUser?.email) {
        query = query.eq("submitted_by", currentUser.email);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: SupportTicket[] = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        priority: r.priority,
        status: r.status,
        description: r.description,
        createdDate: r.created_at,
        updatedDate: r.updated_at,
        submittedBy: r.submitted_by,
        assignedTo: r.assigned_to,
        responses: [],
      }));

      setTickets(mapped);
    } catch (err: any) {
      toast({
        title: "Couldn't load tickets",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!formData.title || !formData.category || !formData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const currentUser = getCurrentUser();
    const submittedBy = currentUser?.email;
    if (!submittedBy) {
      toast({
        title: "Error",
        description: "Could not identify your account. Please log in again.",
        variant: "destructive",
      });
      return;
    }
    const role = getCurrentUserRole();

    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          title: formData.title,
          category: formData.category,
          priority: formData.priority,
          description: formData.description,
          status: "open",
          submitted_by: submittedBy,
          user_type: role,
        })
        .select()
        .single();

      if (error) throw error;

      const newTicket: SupportTicket = {
        id: data.id,
        title: data.title,
        category: data.category,
        priority: data.priority,
        status: data.status,
        description: data.description,
        createdDate: data.created_at,
        updatedDate: data.updated_at,
        submittedBy: data.submitted_by,
        responses: [],
      };

      setTickets([newTicket, ...tickets]);
      setFormData({ title: "", category: "", priority: "medium", description: "" });
      setShowCreateForm(false);

      toast({
        title: "Ticket Created",
        description: `Support ticket has been created successfully.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to create ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { variant: "secondary" as const, label: "Low" },
      medium: { variant: "outline" as const, label: "Medium" },
      high: { variant: "default" as const, label: "High" },
      urgent: { variant: "destructive" as const, label: "Urgent" },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { variant: "outline" as const, label: "Open", icon: MessageSquare },
      "in-progress": {
        variant: "default" as const,
        label: "In Progress",
        icon: Clock,
      },
      resolved: {
        variant: "secondary" as const,
        label: "Resolved",
        icon: CheckCircle,
      },
      closed: {
        variant: "secondary" as const,
        label: "Closed",
        icon: CheckCircle,
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    let aValue = a[sortField as keyof SupportTicket];
    let bValue = b[sortField as keyof SupportTicket];

    if (typeof aValue === "string") aValue = aValue.toLowerCase();
    if (typeof bValue === "string") bValue = bValue.toLowerCase();

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setReplyText("");
    setResponsesLoading(true);
    try {
      const { data, error } = await supabase
        .from("ticket_responses")
        .select("*")
        .eq("ticket_id", ticket.id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const responses: TicketResponse[] = (data || []).map((r: any) => ({
        id: r.id,
        message: r.message,
        timestamp: r.created_at,
        author: r.author,
        isStaff: r.is_staff,
      }));
      setSelectedTicket((prev) => (prev && prev.id === ticket.id ? { ...prev, responses } : prev));
    } catch (err: any) {
      toast({
        title: "Couldn't load responses",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResponsesLoading(false);
    }
  };

  const handleRowClick = (ticket: SupportTicket) => {
    void openTicket(ticket);
  };

  const handleAddResponse = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    const currentUser = getCurrentUser();
    const author = currentUser?.name || currentUser?.email;
    if (!author) {
      toast({ title: "Error", description: "Could not identify your account.", variant: "destructive" });
      return;
    }
    setSendingReply(true);
    try {
      // RLS only allows (ticket_id, message, author) on insert; staff/internal
      // flags are set server-side for super admin tooling, never from here.
      const { data, error } = await supabase
        .from("ticket_responses")
        .insert({
          ticket_id: selectedTicket.id,
          message: replyText.trim(),
          author,
        })
        .select()
        .single();
      if (error) throw error;
      const response: TicketResponse = {
        id: data.id,
        message: data.message,
        timestamp: data.created_at,
        author: data.author,
        isStaff: !!data.is_staff,
      };
      setSelectedTicket((prev) => (prev ? { ...prev, responses: [...prev.responses, response] } : prev));
      setReplyText("");
      toast({ title: "Response added" });
    } catch (err: any) {
      toast({
        title: "Couldn't add response",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingReply(false);
    }
  };

  // Only super admins can UPDATE support_tickets under RLS.
  const canResolveTickets = isSuperAdmin();

  const handleMarkResolved = async (ticket: SupportTicket) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "resolved", actual_resolution: now, updated_at: now })
        .eq("id", ticket.id);
      if (error) throw error;
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: "resolved", updatedDate: now } : t)),
      );
      setSelectedTicket((prev) =>
        prev && prev.id === ticket.id ? { ...prev, status: "resolved", updatedDate: now } : prev,
      );
      toast({ title: "Ticket resolved" });
    } catch (err: any) {
      toast({
        title: "Couldn't update ticket",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const getLayoutComponent = () => {
    const role = getCurrentUserRole();
    if (role === "super-admin") return SuperAdminLayout;
    if (role === "agency-admin") return AgencyAdminLayout;
    return AppLayout;
  };

  const LayoutComponent = getLayoutComponent();

  return (
    <LayoutComponent>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Support Center</h1>
            <p className="text-muted-foreground">
              Get help and submit support tickets
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateForm(true)}
              className="gap-2"
              disabled={showCreateForm}
            >
              <Plus className="h-4 w-4" />
              Create Ticket
            </Button>
          </div>
        </div>

        {/* Quick Access Dashboard */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Activity className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="font-semibold text-yellow-800">
                    12 Warnings
                  </div>
                  <div className="text-sm text-muted-foreground">
                    System Errors
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-blue-800">
                    {tickets.length} Open
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Support Tickets
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-green-800">System OK</div>
                  <div className="text-sm text-muted-foreground">
                    Overall Status
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Ticket Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create Support Ticket</CardTitle>
              <CardDescription>
                Describe your issue and we'll help you resolve it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Ticket Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Brief description of your issue"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: value as "low" | "medium" | "high" | "urgent",
                    }))
                  }
                >
                  <SelectTrigger id="priority" className="w-full md:w-[200px]">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Please provide detailed information about your issue..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTicket}>Create Ticket</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Support Tickets ({tickets.length})</CardTitle>
            <CardDescription>
              Track the status of your support requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading tickets…
              </div>
            ) : tickets.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-8 p-0 font-medium"
                          onClick={() => handleSort("title")}
                        >
                          Ticket
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-8 p-0 font-medium"
                          onClick={() => handleSort("category")}
                        >
                          Category
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-8 p-0 font-medium"
                          onClick={() => handleSort("priority")}
                        >
                          Priority
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-8 p-0 font-medium"
                          onClick={() => handleSort("status")}
                        >
                          Status
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-8 p-0 font-medium"
                          onClick={() => handleSort("createdDate")}
                        >
                          Created
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="h-8 p-0 font-medium"
                          onClick={() => handleSort("updatedDate")}
                        >
                          Updated
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(ticket)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{ticket.title}</div>
                            <div className="text-sm text-muted-foreground">
                              #{ticket.id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>
                          {getPriorityBadge(ticket.priority)}
                        </TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell>
                          {new Date(ticket.createdDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(ticket.updatedDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRowClick(ticket)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRowClick(ticket)}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Add Response
                              </DropdownMenuItem>
                              {canResolveTickets && (ticket.status === "open" || ticket.status === "in-progress") && (
                                <DropdownMenuItem onClick={() => handleMarkResolved(ticket)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Resolved
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No support tickets found</p>
                <p className="text-sm">
                  Create your first ticket to get help from our support team
                </p>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Quick Help Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Knowledge Base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Step-by-step guides for common tasks — account access, billing,
                team management, integrations and data export.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/knowledge-base">Browse articles</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Ticket Priorities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Low</span><span className="text-muted-foreground">Questions and minor issues</span></div>
                <div className="flex justify-between"><span>Medium</span><span className="text-muted-foreground">Something isn't working as expected</span></div>
                <div className="flex justify-between"><span>High</span><span className="text-muted-foreground">A feature you rely on is blocked</span></div>
                <div className="flex justify-between"><span>Urgent</span><span className="text-muted-foreground">You can't use the product at all</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <DialogContent className="max-w-2xl">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTicket.title}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                  <span>{selectedTicket.category}</span>
                  <span>· Opened {new Date(selectedTicket.createdDate).toLocaleString()}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                <div className="space-y-2">
                  <Label>Responses</Label>
                  {responsesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading responses...</p>
                  ) : selectedTicket.responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No responses yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedTicket.responses.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-md border p-3 text-sm ${r.isStaff ? "bg-muted/50" : ""}`}
                        >
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{r.author}{r.isStaff ? " (support)" : ""}</span>
                            <span>{new Date(r.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTicket.status !== "closed" && (
                  <div className="space-y-2">
                    <Label htmlFor="ticket-reply">Add a response</Label>
                    <Textarea
                      id="ticket-reply"
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                {canResolveTickets && (selectedTicket.status === "open" || selectedTicket.status === "in-progress") && (
                  <Button variant="outline" onClick={() => handleMarkResolved(selectedTicket)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
                {selectedTicket.status !== "closed" && (
                  <Button onClick={handleAddResponse} disabled={!replyText.trim() || sendingReply}>
                    {sendingReply ? "Sending..." : "Send Response"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </LayoutComponent>
  );
}
