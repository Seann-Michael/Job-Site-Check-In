import React, { useState, useEffect } from "react";
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
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Activity,
  CheckSquare,
  Users,
  TrendingUp,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Link } from "react-router-dom";

interface CRMClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  status: 'prospect' | 'active' | 'inactive' | 'cancelled';
  monthly_retainer: number;
  last_contact_date: string;
  next_follow_up_date: string;
  industry: string;
  tags: string[];
  created_at: string;
}

interface CRMStats {
  total_clients: number;
  active_clients: number;
  prospects: number;
  monthly_revenue: number;
  overdue_tasks: number;
  upcoming_follow_ups: number;
}

const statusColors = {
  prospect: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function CRM() {
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [stats, setStats] = useState<CRMStats>({
    total_clients: 0,
    active_clients: 0,
    prospects: 0,
    monthly_revenue: 0,
    overdue_tasks: 0,
    upcoming_follow_ups: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadClients();
    loadStats();
  }, [statusFilter, sortBy, sortOrder]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const params = new URLSearchParams({
        status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        search: searchTerm,
      });

      const response = await fetch(`/api/crm/clients?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch("/api/crm/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <AppLayout
      title="CRM"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "CRM" },
      ]}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-blue-600" />
              Client Management
            </h1>
            <p className="text-muted-foreground">
              Manage your clients, track activities, and grow your business
            </p>
          </div>
          <Link to="/admin/crm/clients/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Clients</p>
                  <p className="text-2xl font-bold">{stats.total_clients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Active Clients</p>
                  <p className="text-2xl font-bold">{stats.active_clients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Prospects</p>
                  <p className="text-2xl font-bold">{stats.prospects}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Monthly Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.monthly_revenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Overdue Tasks</p>
                  <p className="text-2xl font-bold">{stats.overdue_tasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium">Follow-ups Due</p>
                  <p className="text-2xl font-bold">{stats.upcoming_follow_ups}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Client List</CardTitle>
            <CardDescription>
              Manage and track all your clients in one place
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date Added</SelectItem>
                  <SelectItem value="company_name">Company Name</SelectItem>
                  <SelectItem value="last_contact_date">Last Contact</SelectItem>
                  <SelectItem value="monthly_retainer">Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Next Follow-up</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading clients...
                      </TableCell>
                    </TableRow>
                  ) : filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-3">
                          <UserCheck className="h-12 w-12 text-muted-foreground/50" />
                          <div>
                            <h3 className="font-medium">No clients found</h3>
                            <p className="text-sm text-muted-foreground">
                              {searchTerm ? "Try adjusting your search criteria" : "Get started by adding your first client"}
                            </p>
                          </div>
                          {!searchTerm && (
                            <Link to="/admin/crm/clients/new">
                              <Button>Add Your First Client</Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.company_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              {client.website && (
                                <>
                                  <Globe className="h-3 w-3" />
                                  {client.website}
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.contact_name || "—"}</div>
                            <div className="text-sm text-muted-foreground">
                              {client.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {client.email}
                                </div>
                              )}
                              {client.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {client.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[client.status]}>
                            {client.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {client.monthly_retainer 
                            ? formatCurrency(client.monthly_retainer)
                            : "—"
                          }
                        </TableCell>
                        <TableCell>{formatDate(client.last_contact_date)}</TableCell>
                        <TableCell>{formatDate(client.next_follow_up_date)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/crm/clients/${client.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/crm/clients/${client.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Client
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
