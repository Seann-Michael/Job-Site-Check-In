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

export default function AgencyBusinessOwnerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [business, setBusiness] = useState<BusinessOwner | null>(null);
  const [formData, setFormData] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    status: "active",
    plan: "Basic",
    address: "",
  });

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
      setFormData({
        businessName: foundBusiness.businessName,
        ownerName: foundBusiness.ownerName,
        email: foundBusiness.email,
        phone: foundBusiness.phone,
        status: foundBusiness.status,
        plan: foundBusiness.plan,
        address: foundBusiness.address,
      });
    }
  }, [id]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    if (!business) return;

    // Load all businesses
    const agencyBusinesses = JSON.parse(
      localStorage.getItem("agency_businesses") || "[]",
    );

    // Update the specific business
    const updatedBusinesses = agencyBusinesses.map((b: BusinessOwner) =>
      b.id === id
        ? {
            ...b,
            businessName: formData.businessName,
            ownerName: formData.ownerName,
            email: formData.email,
            phone: formData.phone,
            status: formData.status,
            plan: formData.plan,
            address: formData.address,
          }
        : b,
    );

    // Save back to localStorage
    localStorage.setItem(
      "agency_businesses",
      JSON.stringify(updatedBusinesses),
    );

    toast({
      title: "Business Updated",
      description: "Business owner information has been successfully updated.",
    });

    // Navigate back to detail page
    navigate(`/agency/admin/business-owners/${id}`);
  };

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

  return (
    <AgencyAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/agency/admin/business-owners/${id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Business Owner</h1>
              <p className="text-muted-foreground">{business.businessName}</p>
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
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Update the business details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    handleInputChange("businessName", e.target.value)
                  }
                  placeholder="Enter business name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name</Label>
                <Input
                  id="ownerName"
                  value={formData.ownerName}
                  onChange={(e) =>
                    handleInputChange("ownerName", e.target.value)
                  }
                  placeholder="Enter owner name"
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
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Enter business address"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage account status and subscription plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Account Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
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

              <div className="space-y-2">
                <Label htmlFor="plan">Subscription Plan</Label>
                <Select
                  value={formData.plan}
                  onValueChange={(value) => handleInputChange("plan", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Account Details</div>
                  <div className="text-sm text-muted-foreground">
                    <div>
                      Signup Date:{" "}
                      {new Date(business.signupDate).toLocaleDateString()}
                    </div>
                    <div>
                      Last Login:{" "}
                      {new Date(business.lastLogin).toLocaleDateString()}
                    </div>
                    <div>Projects: {business.projects}</div>
                    <div>Admin Users: {business.adminUsers}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Link to={`/agency/admin/business-owners/${id}`}>
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
