import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import {
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  UserPlus,
  Download,
  Mail,
  Phone,
  Building2,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "pending" | "suspended";
  plan: string;
  monthlyValue: number;
  signupDate: string;
  lastLogin: string;
  projects: number;
  revenue: number;
}

export default function AgencyClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    // Load agency clients from localStorage
    const agencyClients = JSON.parse(
      localStorage.getItem("agency_clients") || "[]",
    );

    // If no clients exist, create some sample data
    if (agencyClients.length === 0) {
      const sampleClients: Client[] = [
        {
          id: "1",
          businessName: "Joe's Pizza",
          ownerName: "Joe Smith",
          email: "joe@joespizza.com",
          phone: "(555) 123-4567",
          status: "active",
          plan: "Professional",
          monthlyValue: 149,
          signupDate: "2024-01-15",
          lastLogin: "2024-03-10",
          projects: 8,
          revenue: 1192,
        },
        {
          id: "2",
          businessName: "Sarah's Salon",
          ownerName: "Sarah Johnson",
          email: "sarah@sarahssalon.com",
          phone: "(555) 987-6543",
          status: "active",
          plan: "Premium",
          monthlyValue: 199,
          signupDate: "2024-02-01",
          lastLogin: "2024-03-12",
          projects: 12,
          revenue: 1592,
        },
        {
          id: "3",
          businessName: "Mike's Auto Repair",
          ownerName: "Mike Wilson",
          email: "mike@mikesauto.com",
          phone: "(555) 456-7890",
          status: "pending",
          plan: "Basic",
          monthlyValue: 99,
          signupDate: "2024-03-05",
          lastLogin: "2024-03-05",
          projects: 0,
          revenue: 0,
        },
      ];

      localStorage.setItem("agency_clients", JSON.stringify(sampleClients));
      setClients(sampleClients);
      setFilteredClients(sampleClients);
    } else {
      setClients(agencyClients);
      setFilteredClients(agencyClients);
    }
  }, []);

  useEffect(() => {
    let filtered = clients.filter((client) => {
      const matchesSearch =
        searchQuery === "" ||
        client.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || client.status === statusFilter;

      const matchesPlan = planFilter === "all" || client.plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });

    setFilteredClients(filtered);
  }, [searchQuery, statusFilter, planFilter, clients]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active" },
      inactive: { variant: "secondary" as const, label: "Inactive" },
      pending: { variant: "outline" as const, label: "Pending" },
      suspended: { variant: "destructive" as const, label: "Suspended" },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  const getTotalStats = () => {
    const activeClients = clients.filter((c) => c.status === "active").length;
    const totalRevenue = clients.reduce((sum, client) => {
      return sum + (client.status === "active" ? client.monthlyValue : 0);
    }, 0);
    const commission = totalRevenue * 0.15; // 15% commission

    return { activeClients, totalRevenue, commission };
  };

  const stats = getTotalStats();

  return (
    <AgencyAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Client Management</h1>
            <p className="text-muted-foreground">
              Manage and monitor your client accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/agency/admin/clients/add">
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Client
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Clients
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeClients}</div>
              <p className="text-xs text-muted-foreground">
                {clients.length} total clients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Monthly Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalRevenue.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">
                From active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Your Commission
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.commission.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">15% commission</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clients ({filteredClients.length})</CardTitle>
            <CardDescription>
              All your clients and their subscription details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly Value</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Signup Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {client.businessName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {client.ownerName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(client.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ${client.monthlyValue}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          /month
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {client.projects}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(client.signupDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/agency/admin/clients/${client.id}`}
                                className="flex items-center"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/agency/admin/clients/${client.id}/edit`}
                                className="flex items-center"
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Client
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Message
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Suspend Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredClients.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No clients found</p>
                <p className="text-sm">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgencyAdminLayout>
  );
}
