import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import { ArrowLeft, Save } from "lucide-react";
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

export default function AgencyAdminUserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Admin",
    status: "active" as const,
    permissions: [] as string[],
  });

  const availablePermissions = [
    "Manage Business Owners",
    "View Reports",
    "Billing Management",
    "User Management",
    "Settings Access",
    "Analytics Access",
    "Super Admin",
  ];

  useEffect(() => {
    // Load admin user data
    const agencyAdminUsers = JSON.parse(
      localStorage.getItem("agency_admin_users") || "[]",
    );
    const foundUser = agencyAdminUsers.find((u: AdminUser) => u.id === id);

    if (foundUser) {
      setUser(foundUser);
      setFormData({
        name: foundUser.name,
        email: foundUser.email,
        phone: foundUser.phone,
        role: foundUser.role,
        status: foundUser.status,
        permissions: foundUser.permissions,
      });
    }
  }, [id]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSave = () => {
    if (!user) return;

    // Load all admin users
    const agencyAdminUsers = JSON.parse(
      localStorage.getItem("agency_admin_users") || "[]",
    );

    // Update the specific user
    const updatedUsers = agencyAdminUsers.map((u: AdminUser) =>
      u.id === id
        ? {
            ...u,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            status: formData.status,
            permissions: formData.permissions,
          }
        : u,
    );

    // Save back to localStorage
    localStorage.setItem("agency_admin_users", JSON.stringify(updatedUsers));

    toast({
      title: "User Updated",
      description: "Admin user information has been successfully updated.",
    });

    // Navigate back to detail page
    navigate(`/agency/admin/admin-users/${id}`);
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
            <Link to={`/agency/admin/admin-users/${id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Admin User</h1>
              <p className="text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>

        {/* Edit Form */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>
                Update the basic information for this admin user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange("role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    handleInputChange(
                      "status",
                      value as "active" | "inactive" | "pending" | "suspended",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                Select the permissions for this admin user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {availablePermissions.map((permission) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={permission}
                      checked={formData.permissions.includes(permission)}
                      onChange={() => handlePermissionToggle(permission)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label
                      htmlFor={permission}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {permission}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Account Information:</p>
                  <div className="space-y-1 text-xs">
                    <div>
                      Created: {new Date(user.createdDate).toLocaleDateString()}
                    </div>
                    <div>
                      Last Login:{" "}
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </div>
                    <div>
                      Assigned Businesses: {user.assignedBusinesses.length}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Link to={`/agency/admin/admin-users/${id}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </AgencyAdminLayout>
  );
}
