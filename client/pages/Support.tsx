// @ts-nocheck - Temporary suppression of type errors
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
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  Eye,
  MessageCircle,
  Paperclip,
  Activity,
  FileText,
  Download,
  RefreshCw,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isAgencyAdmin, isSuperAdmin } from "@/lib/auth";
import { ArrowUpDown } from "lucide-react";

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
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortField, setSortField] = useState<string>("createdDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    priority: "medium" as const,
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
    // Load tickets based on user role
    const userRole = getCurrentUserRole();
    loadTicketsForRole(userRole);
  }, []);

  const getCurrentUserRole = () => {
    if (isSuperAdmin()) return "super-admin";
    if (isAgencyAdmin()) return "agency-admin";
    return "admin";
  };

  const loadTicketsForRole = (role: string) => {
    let existingTickets = JSON.parse(
      localStorage.getItem("support_tickets") || "[]",
    );

    // Filter tickets based on role
    if (role === "admin") {
      // Business admin only sees their own tickets
      const currentUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
      existingTickets = existingTickets.filter(
        (ticket: SupportTicket) => ticket.submittedBy === currentUser.email,
      );
    } else if (role === "agency-admin") {
      // Agency admin sees tickets from their business owners and their own
      existingTickets = existingTickets.filter(
        (ticket: SupportTicket) =>
          ticket.submittedBy.includes("agency") ||
          !ticket.submittedBy.includes("super"),
      );
    }
    // Super admin sees all tickets

    setTickets(existingTickets);
  };

  const handleCreateTicket = () => {
    if (!formData.title || !formData.category || !formData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
    const newTicket: SupportTicket = {
      id: Date.now().toString(),
      title: formData.title,
      category: formData.category,
      priority: formData.priority,
      status: "open",
      description: formData.description,
      createdDate: new Date().toISOString().split("T")[0],
      updatedDate: new Date().toISOString().split("T")[0],
      submittedBy: currentUser.email || "user@example.com",
      responses: [],
    };

    // Load existing tickets, add new one
    const existingTickets = JSON.parse(
      localStorage.getItem("support_tickets") || "[]",
    );
    existingTickets.push(newTicket);
    localStorage.setItem("support_tickets", JSON.stringify(existingTickets));

    // Update local state
    setTickets([newTicket, ...tickets]);

    // Reset form
    setFormData({
      title: "",
      category: "",
      priority: "medium",
      description: "",
    });
    setShowCreateForm(false);

    toast({
      title: "Ticket Created",
      description: `Support ticket #${newTicket.id} has been created successfully.`,
    });
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

  const handleRowClick = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    // Here you could navigate to ticket detail page or open modal
    toast({
      title: "Opening Ticket",
      description: `Opening ticket #${ticket.id}: ${ticket.title}`,
    });
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
              variant="outline"
              onClick={() => {
                document.getElementById("crash-logs-section")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              View Error Logs
            </Button>
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              document.getElementById("crash-logs-section")?.scrollIntoView({
                behavior: "smooth",
              });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="font-semibold text-red-800">7 Critical</div>
                  <div className="text-sm text-muted-foreground">
                    Crash Reports
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                    <SelectTrigger>
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
                  <SelectTrigger className="w-full md:w-[200px]">
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
            {tickets.length > 0 ? (
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
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Add Response
                              </DropdownMenuItem>
                              {ticket.status === "open" && (
                                <DropdownMenuItem>
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

        {/* Error Logs Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Logs & Error Tracking
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Recent system activities and error logs for troubleshooting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Recent Errors</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2 border border-red-200 bg-red-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium text-red-800">
                          API Connection Failed
                        </div>
                        <div className="text-red-600">
                          Unable to connect to webhook endpoint
                        </div>
                        <div className="text-red-500 text-xs">
                          2 minutes ago
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 border border-yellow-200 bg-yellow-50 rounded">
                      <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium text-yellow-800">
                          Session Timeout Warning
                        </div>
                        <div className="text-yellow-600">
                          User session expiring soon
                        </div>
                        <div className="text-yellow-500 text-xs">
                          15 minutes ago
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">System Activity</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2 border border-green-200 bg-green-50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium text-green-800">
                          Backup Completed
                        </div>
                        <div className="text-green-600">
                          Daily system backup successful
                        </div>
                        <div className="text-green-500 text-xs">1 hour ago</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 border border-blue-200 bg-blue-50 rounded">
                      <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium text-blue-800">
                          Log File Rotated
                        </div>
                        <div className="text-blue-600">
                          System logs archived
                        </div>
                        <div className="text-blue-500 text-xs">3 hours ago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 border rounded bg-muted/50">
                <h5 className="font-medium mb-2">Log Analysis Summary</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-red-600">3 Errors</div>
                    <div className="text-muted-foreground">Last 24h</div>
                  </div>
                  <div>
                    <div className="font-medium text-yellow-600">
                      7 Warnings
                    </div>
                    <div className="text-muted-foreground">Last 24h</div>
                  </div>
                  <div>
                    <div className="font-medium text-green-600">
                      245 Success
                    </div>
                    <div className="text-muted-foreground">Last 24h</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-600">
                      98.7% Uptime
                    </div>
                    <div className="text-muted-foreground">Last 7 days</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Crash Logs */}
        <Card id="crash-logs-section">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                User Crash Reports & Error Logs
              </div>
              <div className="flex gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Errors</SelectItem>
                    <SelectItem value="critical">Critical Only</SelectItem>
                    <SelectItem value="warning">Warnings Only</SelectItem>
                    <SelectItem value="info">Info Only</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Real-time monitoring of application errors, crashes, and system
              issues. Last updated: {new Date().toLocaleTimeString()}
            </CardDescription>

            {/* Search and Filter Controls */}
            <div className="flex gap-4 mt-4">
              <div className="flex-1">
                <Input
                  placeholder="Search error messages, components, or user emails..."
                  className="w-full"
                />
              </div>
              <Select defaultValue="24h">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {/* Error Statistics Summary */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-800">7</div>
                    <div className="text-sm text-red-600">Critical Crashes</div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-xs text-red-500 mt-1">
                  +3 since yesterday
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-yellow-800">12</div>
                    <div className="text-sm text-yellow-600">
                      Runtime Errors
                    </div>
                  </div>
                  <Activity className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="text-xs text-yellow-500 mt-1">
                  -2 since yesterday
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-800">156</div>
                    <div className="text-sm text-blue-600">Affected Users</div>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  23% of total users
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-800">
                      89%
                    </div>
                    <div className="text-sm text-purple-600">System Uptime</div>
                  </div>
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-xs text-purple-500 mt-1">
                  Above 95% target
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Critical Crashes */}
              <div>
                <h4 className="font-medium mb-3 text-red-800">
                  Critical Application Crashes
                </h4>
                <div className="space-y-2">
                  <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-800">
                          Settings Module Crash
                        </span>
                      </div>
                      <span className="text-xs text-red-600">2 hours ago</span>
                    </div>
                    <div className="text-sm text-red-700 mb-2">
                      <strong>Error:</strong> Cannot read property 'events' of
                      undefined at Settings.tsx:3206:116
                    </div>
                    <div className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
                      TypeError: Cannot read properties of undefined (reading
                      'join')
                      <br />
                      at Settings (Settings.tsx:3206:116)
                      <br />
                      at renderWithHooks (chunk-WPQCFWW4.js:11596:35)
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="destructive" className="text-xs">
                        High Priority
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        User: joe@joespizza.com
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Browser: Chrome
                      </Badge>
                    </div>
                  </div>

                  <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-800">
                          Notifications System Crash
                        </span>
                      </div>
                      <span className="text-xs text-red-600">5 hours ago</span>
                    </div>
                    <div className="text-sm text-red-700 mb-2">
                      <strong>Error:</strong> Cannot access property before
                      initialization
                    </div>
                    <div className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
                      ReferenceError: Cannot access 'NotificationPreferences'
                      before initialization
                      <br />
                      at NotificationPreferences.tsx:47:12
                      <br />
                      at App.tsx:258:32
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="destructive" className="text-xs">
                        High Priority
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        User: maria@sarahssalon.com
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Browser: Safari
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* JavaScript Errors */}
              <div>
                <h4 className="font-medium mb-3 text-yellow-800">
                  JavaScript Runtime Errors
                </h4>
                <div className="space-y-2">
                  <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">
                          Webhook Form Validation Error
                        </span>
                      </div>
                      <span className="text-xs text-yellow-600">
                        1 hour ago
                      </span>
                    </div>
                    <div className="text-sm text-yellow-700 mb-2">
                      <strong>Error:</strong> FormData.get() returned null for
                      'events' field
                    </div>
                    <div className="text-xs text-yellow-600 font-mono bg-yellow-100 p-2 rounded">
                      TypeError: Cannot read properties of null (reading
                      'split')
                      <br />
                      at addWebhook (Settings.tsx:1160:25)
                      <br />
                      at onSubmit (Settings.tsx:3170:15)
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Badge
                        variant="default"
                        className="text-xs bg-yellow-600"
                      >
                        Medium Priority
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        User: admin@mikesauto.com
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Impact */}
              <div>
                <h4 className="font-medium mb-3 text-purple-800">
                  User Impact Summary
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg bg-red-50 border-red-200">
                    <div className="font-medium text-red-800 mb-1">
                      Affected Users
                    </div>
                    <div className="text-2xl font-bold text-red-600">23</div>
                    <div className="text-xs text-red-600">
                      Out of 156 total users
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="font-medium text-yellow-800 mb-1">
                      Sessions with Errors
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">47</div>
                    <div className="text-xs text-yellow-600">
                      12% of all sessions
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <div className="font-medium text-blue-800 mb-1">
                      Most Problematic Feature
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      Settings
                    </div>
                    <div className="text-xs text-blue-600">
                      67% of all crashes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Help Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Common Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>• Password reset instructions</li>
                <li>• Billing and payment questions</li>
                <li>• User management help</li>
                <li>• API integration guides</li>
                <li>• Data export procedures</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Response Times
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Low Priority:</span>
                  <span>24-48 hours</span>
                </div>
                <div className="flex justify-between">
                  <span>Medium Priority:</span>
                  <span>12-24 hours</span>
                </div>
                <div className="flex justify-between">
                  <span>High Priority:</span>
                  <span>4-8 hours</span>
                </div>
                <div className="flex justify-between">
                  <span>Urgent:</span>
                  <span>1-2 hours</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>For urgent technical issues:</p>
                <p className="font-medium">emergency@support.com</p>
                <p className="font-medium">1-800-SUPPORT</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Emergency support available 24/7 for critical system outages
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutComponent>
  );
}
