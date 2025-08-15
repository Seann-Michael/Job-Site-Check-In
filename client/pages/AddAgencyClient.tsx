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
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  DollarSign,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

interface ClientFormData {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  industry: string;
  plan: string;
  monthlyValue: number;
  notes: string;
}

export default function AddAgencyClient() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    industry: "",
    plan: "",
    monthlyValue: 99,
    notes: "",
  });

  const plans = [
    { value: "Basic", label: "Basic Plan", price: 99 },
    { value: "Professional", label: "Professional Plan", price: 149 },
    { value: "Premium", label: "Premium Plan", price: 199 },
    { value: "Enterprise", label: "Enterprise Plan", price: 299 },
  ];

  const industries = [
    "Construction",
    "Restaurant",
    "Retail",
    "Healthcare",
    "Beauty & Salon",
    "Automotive",
    "Real Estate",
    "Legal Services",
    "Financial Services",
    "Other",
  ];

  const handleInputChange = (
    field: keyof ClientFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePlanChange = (planValue: string) => {
    const selectedPlan = plans.find((p) => p.value === planValue);
    setFormData((prev) => ({
      ...prev,
      plan: planValue,
      monthlyValue: selectedPlan?.price || 99,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (
        !formData.businessName ||
        !formData.ownerName ||
        !formData.email ||
        !formData.plan
      ) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get existing agency clients
      const existingClients = JSON.parse(
        localStorage.getItem("agency_clients") || "[]",
      );

      // Create new client
      const newClient = {
        id: Date.now().toString(),
        ...formData,
        status: "pending",
        signupDate: new Date().toISOString().split("T")[0],
        lastLogin: new Date().toISOString(),
        projects: 0,
        revenue: 0,
        createdAt: new Date().toISOString(),
      };

      // Add to clients array
      const updatedClients = [...existingClients, newClient];
      localStorage.setItem("agency_clients", JSON.stringify(updatedClients));

      toast.success("Client added successfully!");
      navigate("/agency/admin/clients");
    } catch (error) {
      toast.error("Failed to add client. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AgencyAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/agency/admin/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Add New Client</h1>
            <p className="text-muted-foreground">
              Add a new client to your agency portfolio
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Business Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Business Information
                  </CardTitle>
                  <CardDescription>
                    Basic information about the client's business
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">
                        Business Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="businessName"
                        placeholder="e.g., Joe's Pizza"
                        value={formData.businessName}
                        onChange={(e) =>
                          handleInputChange("businessName", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Select
                        value={formData.industry}
                        onValueChange={(value) =>
                          handleInputChange("industry", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {industries.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Business Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main St, City, State 12345"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://www.example.com"
                      value={formData.website}
                      onChange={(e) =>
                        handleInputChange("website", e.target.value)
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>
                    Primary contact details for the business owner
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">
                      Owner/Manager Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ownerName"
                      placeholder="John Smith"
                      value={formData.ownerName}
                      onChange={(e) =>
                        handleInputChange("ownerName", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Additional Notes</CardTitle>
                  <CardDescription>
                    Any additional information about this client
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add any notes about this client, their goals, or special requirements..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={4}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Plan & Billing */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Plan & Billing
                  </CardTitle>
                  <CardDescription>
                    Select the subscription plan for this client
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan">
                      Subscription Plan <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.plan}
                      onValueChange={handlePlanChange}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.value} value={plan.value}>
                            <div className="flex items-center justify-between w-full">
                              <span>{plan.label}</span>
                              <span className="ml-2 text-sm text-muted-foreground">
                                ${plan.price}/mo
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyValue">Monthly Value</Label>
                    <Input
                      id="monthlyValue"
                      type="number"
                      value={formData.monthlyValue}
                      onChange={(e) =>
                        handleInputChange(
                          "monthlyValue",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      min="0"
                      step="1"
                    />
                  </div>

                  {formData.monthlyValue > 0 && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Client pays:</span>
                        <span className="font-medium">
                          ${formData.monthlyValue}/month
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Your commission (15%):</span>
                        <span className="font-medium text-green-600">
                          ${(formData.monthlyValue * 0.15).toFixed(0)}/month
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Annual commission:</span>
                        <span className="font-medium text-green-600">
                          ${(formData.monthlyValue * 0.15 * 12).toFixed(0)}/year
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                          Adding Client...
                        </>
                      ) : (
                        "Add Client"
                      )}
                    </Button>
                    <Link to="/agency/admin/clients">
                      <Button variant="outline" className="w-full">
                        Cancel
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </AgencyAdminLayout>
  );
}
