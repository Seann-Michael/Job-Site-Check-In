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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  Edit,
  Shield,
  ExternalLink,
  User,
  Activity,
  CreditCard,
  Settings,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";

interface BusinessOwner {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "pending" | "suspended";
  plan: string;
  signupDate: string;
  lastLogin: string;
  projects: number;
  adminUsers: number;
  address: string;
}

interface Project {
  id: string;
  name: string;
  status: "active" | "completed" | "on-hold";
  createdDate: string;
  lastUpdate: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: string;
  status: "active" | "inactive";
}

export default function AgencyBusinessOwnerDetail() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<BusinessOwner | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    // Load business data
    const agencyBusinesses = JSON.parse(
      localStorage.getItem("agency_businesses") || "[]",
    );
    const foundBusiness = agencyBusinesses.find(
      (b: BusinessOwner) => b.id === id,
    );

    if (foundBusiness) {
      setBusiness(foundBusiness);

      // Mock projects data
      setProjects([
        {
          id: "1",
          name: "Kitchen Renovation",
          status: "active",
          createdDate: "2024-02-15",
          lastUpdate: "2024-03-10",
        },
        {
          id: "2",
          name: "Bathroom Remodel",
          status: "completed",
          createdDate: "2024-01-20",
          lastUpdate: "2024-02-25",
        },
        {
          id: "3",
          name: "Office Expansion",
          status: "on-hold",
          createdDate: "2024-03-01",
          lastUpdate: "2024-03-05",
        },
      ]);

      // Mock admin users data
      setAdminUsers([
        {
          id: "1",
          name: foundBusiness.ownerName,
          email: foundBusiness.email,
          role: "Owner",
          lastLogin: foundBusiness.lastLogin,
          status: "active",
        },
        {
          id: "2",
          name: "Assistant Manager",
          email: "assistant@" + foundBusiness.email.split("@")[1],
          role: "Admin",
          lastLogin: "2024-03-08",
          status: "active",
        },
      ]);
    }
  }, [id]);

  if (!business) {
    return (
      <AgencyAdminLayout>
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">Business Owner Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The requested business owner could not be found.
          </p>
          <Link to="/agency/admin/business-owners">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Business Owners
            </Button>
          </Link>
        </div>
      </AgencyAdminLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active" },
      inactive: { variant: "secondary" as const, label: "Inactive" },
      pending: { variant: "outline" as const, label: "Pending" },
      suspended: { variant: "destructive" as const, label: "Suspended" },
      completed: { variant: "default" as const, label: "Completed" },
      "on-hold": { variant: "secondary" as const, label: "On Hold" },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  const impersonateUser = () => {
    // Store current agency session
    const currentUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
    localStorage.setItem("agency_session", JSON.stringify(currentUser));

    // Create impersonated user session
    const impersonatedUser = {
      id: business.id,
      name: business.ownerName,
      email: business.email,
      role: "admin",
      isImpersonated: true,
      businessName: business.businessName,
    };

    localStorage.setItem("auth_user", JSON.stringify(impersonatedUser));
    window.location.href = "/";
  };

  return (
    <AgencyAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/agency/admin/business-owners">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{business.businessName}</h1>
              <p className="text-muted-foreground">{business.ownerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={impersonateUser}>
              <Shield className="mr-2 h-4 w-4" />
              Login as User
            </Button>
            <Link to={`/agency/admin/business-owners/${business.id}/edit`}>
              <Button>
                <Edit className="mr-2 h-4 w-4" />
                Edit Business
              </Button>
            </Link>
          </div>
        </div>

        {/* Business Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{getStatusBadge(business.status)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plan</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{business.plan}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projects</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{business.projects}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{business.adminUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="users">Admin Users</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{business.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{business.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{business.address}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signup Date:</span>
                    <span>
                      {new Date(business.signupDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Login:</span>
                    <span>
                      {new Date(business.lastLogin).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Plan:</span>
                    <Badge variant="outline">{business.plan}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Account Status:
                    </span>
                    {getStatusBadge(business.status)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Projects ({projects.length})</CardTitle>
                <CardDescription>
                  All projects created under this business account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Update</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">
                            {project.name}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(project.status)}
                          </TableCell>
                          <TableCell>
                            {new Date(project.createdDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(project.lastUpdate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Admin Users ({adminUsers.length})</CardTitle>
                <CardDescription>
                  Users with administrative access to this business account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(user.status)}</TableCell>
                          <TableCell>
                            {new Date(user.lastLogin).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>
                  Billing details and subscription information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Current Plan</h4>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{business.plan}</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {business.adminUsers} users included
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Billing Cycle</h4>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Next billing date: March 15, 2024
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Payment method: •••• 4242
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AgencyAdminLayout>
  );
}
