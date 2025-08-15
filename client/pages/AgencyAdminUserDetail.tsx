import { Button } from "@/components/ui/button";
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
  Mail,
  Phone,
  Users,
  Edit,
  Shield,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  Smartphone,
} from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: "active" | "inactive" | "pending" | "suspended";
  lastLogin: string;
  createdDate: string;
  permissions: string[];
  assignedBusinesses: string[];
}

interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
  details: string;
}

export default function AgencyAdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    // Load admin user data
    const agencyAdminUsers = JSON.parse(
      localStorage.getItem("agency_admin_users") || "[]",
    );
    const foundUser = agencyAdminUsers.find((u: AdminUser) => u.id === id);

    if (foundUser) {
      setUser(foundUser);

      // Mock activity logs
      setActivityLogs([
        {
          id: "1",
          action: "Login",
          timestamp: "2024-03-12 09:30:00",
          details: "User logged in from Chrome browser",
        },
        {
          id: "2",
          action: "Business Access",
          timestamp: "2024-03-12 09:32:00",
          details: "Accessed Joe's Pizza business profile",
        },
        {
          id: "3",
          action: "User Edit",
          timestamp: "2024-03-11 14:15:00",
          details: "Updated contact information",
        },
        {
          id: "4",
          action: "Login",
          timestamp: "2024-03-11 08:45:00",
          details: "User logged in from Safari browser",
        },
      ]);
    }
  }, [id]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: {
        variant: "default" as const,
        label: "Active",
        icon: CheckCircle,
      },
      inactive: {
        variant: "secondary" as const,
        label: "Inactive",
        icon: AlertCircle,
      },
      pending: { variant: "outline" as const, label: "Pending", icon: Clock },
      suspended: {
        variant: "destructive" as const,
        label: "Suspended",
        icon: AlertCircle,
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

  const handleDeleteUser = () => {
    if (!user) return;

    if (
      confirm(
        `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      )
    ) {
      // Load users, remove this one, save back
      const agencyAdminUsers = JSON.parse(
        localStorage.getItem("agency_admin_users") || "[]",
      );
      const updatedUsers = agencyAdminUsers.filter(
        (u: AdminUser) => u.id !== id,
      );
      localStorage.setItem("agency_admin_users", JSON.stringify(updatedUsers));

      toast({
        title: "User Deleted",
        description: "Admin user has been successfully deleted.",
      });

      navigate("/agency/admin/admin-users");
    }
  };

  const sendMobileAppLink = () => {
    if (!user) return;

    toast({
      title: "Mobile App Link Sent",
      description: `Mobile app download link sent to ${user.email}`,
    });
  };

  if (!user) {
    return (
      <AgencyAdminLayout>
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold">Admin User Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The requested admin user could not be found.
          </p>
          <Link to="/agency/admin/admin-users">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Users
            </Button>
          </Link>
        </div>
      </AgencyAdminLayout>
    );
  }

  return (
    <AgencyAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/agency/admin/admin-users">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{user.name}</h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={sendMobileAppLink}>
              <Smartphone className="mr-2 h-4 w-4" />
              Send App Link
            </Button>
            <Link to={`/agency/admin/admin-users/${user.id}/edit`}>
              <Button>
                <Edit className="mr-2 h-4 w-4" />
                Edit User
              </Button>
            </Link>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* User Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{getStatusBadge(user.status)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Role</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{user.role}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Assigned Businesses
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {user.assignedBusinesses.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Login</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {new Date(user.lastLogin).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
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
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{user.phone}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>
                      {new Date(user.createdDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Login:</span>
                    <span>{new Date(user.lastLogin).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <Badge variant="outline">{user.role}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    {getStatusBadge(user.status)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Permissions</CardTitle>
                <CardDescription>
                  Permissions assigned to this admin user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {user.permissions.map((permission, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span>{permission}</span>
                      <Badge variant="outline">Granted</Badge>
                    </div>
                  ))}
                  {user.permissions.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">
                      No specific permissions assigned
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Recent actions performed by this user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {log.action}
                          </TableCell>
                          <TableCell>
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AgencyAdminLayout>
  );
}
