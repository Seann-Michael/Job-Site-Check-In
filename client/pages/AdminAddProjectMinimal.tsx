import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Building2,
  Home,
  Wrench,
  Palette,
  TreePine,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Home services project types
const HOME_SERVICE_TYPES = [
  { value: "renovation", label: "Renovation", icon: Home },
  { value: "construction", label: "Construction", icon: Building2 },
  { value: "repair", label: "Repair", icon: Wrench },
  { value: "painting", label: "Painting", icon: Palette },
  { value: "landscaping", label: "Landscaping", icon: TreePine },
  { value: "plumbing", label: "Plumbing", icon: Wrench },
  { value: "electrical", label: "Electrical", icon: Wrench },
  { value: "cleaning", label: "Cleaning", icon: Wrench },
];

export default function AdminAddProjectMinimal() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "renovation" as const,
    priority: "medium" as const,
    status: "planning" as const,
    customerName: "",
    customerEmail: "",
    budget: "",
    startDate: new Date().toISOString().split("T")[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description) {
      toast.error("Please fill in the required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate project creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Project created successfully!");
      navigate("/admin/projects");
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Add New Home Services Project"
      breadcrumbs={[
        { label: "Projects", href: "/admin/projects" },
        { label: "Add Project", href: "/admin/add-project" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Home Services Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g. Front Yard Renovation"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="type">Service Type</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOME_SERVICE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Project Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="budget">Project Budget (USD)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget}
                    onChange={(e) => handleInputChange("budget", e.target.value)}
                    placeholder="25000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Project Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Describe the project scope, requirements, and expected outcomes..."
                  rows={4}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Client Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Client Name</Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange("customerName", e.target.value)}
                    placeholder="Enter client name"
                  />
                </div>

                <div>
                  <Label htmlFor="customerEmail">Client Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange("startDate", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Additional Features</Label>
                  <div className="text-sm text-gray-500 mt-1">
                    Address search, photo capture, and advanced features will be added in future updates.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex gap-4 justify-end">
            <Link to="/admin/projects">
              <Button type="button" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
