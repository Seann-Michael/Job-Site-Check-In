import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
// import { ModernPhotoCapture } from "@/components/ModernPhotoCapture";
import { PhoneInput } from "@/components/ui/phone-input";
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
  Sparkles,
  Lightbulb,
  Plus,
  Trash2,
  Building2,
  Home,
  Wrench,
  Palette,
  TreePine,
  Car,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
// import type { ProjectInfo } from "@/lib/mediaMetadata";
// import { generateProjectId } from "@/lib/idGenerator";
// import { AddressAutocomplete } from "@/components/GoogleMaps";
// import { USStatesSelect } from "@/components/ui/us-states-select";
// import { dataService, Business } from "@/lib/dataService";
// import {
//   getGoogleMapsApiKey,
//   validateGoogleMapsApiKey,
//   createStreetViewEmbedUrl,
//   checkStreetViewAvailability,
// } from "@/lib/googleMaps";

interface EnhancedPhoto {
  url: string;
  metadata: any;
  enhancedFileName: string;
}

// Home services project types
const HOME_SERVICE_TYPES = [
  { value: "renovation", label: "Renovation", icon: Home },
  { value: "construction", label: "Construction", icon: Building2 },
  { value: "repair", label: "Repair", icon: Wrench },
  { value: "painting", label: "Painting", icon: Palette },
  { value: "landscaping", label: "Landscaping", icon: TreePine },
  { value: "driveway", label: "Driveway", icon: Car },
  { value: "roofing", label: "Roofing", icon: Home },
  { value: "flooring", label: "Flooring", icon: Home },
  { value: "plumbing", label: "Plumbing", icon: Wrench },
  { value: "electrical", label: "Electrical", icon: Wrench },
  { value: "hvac", label: "HVAC", icon: Wrench },
  { value: "cleaning", label: "Cleaning", icon: Sparkles },
];

export default function AdminAddProject() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<EnhancedPhoto[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "renovation" as const,
    priority: "medium" as const,
    status: "planning" as const,
    // Address search field
    addressSearch: "",
    // Structured address fields
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
    placeId: "",
    gpsLat: "",
    gpsLng: "",
    customerName: "",
    customerEmail: "",
    mobilePhone: "",
    additionalPhones: [""],
    startDate: new Date().toISOString().split("T")[0], // Auto-populated with today
    completionDate: "",
    dueDate: "",
    budget: "",
    materials: [""],
    tasks: [""],
    notes: "",
    streetViewUrl: "", // Store Street View URL to avoid repeated API calls
    hasStreetView: false, // Track if Street View is available
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);

  // Load user's businesses on component mount
  // useEffect(() => {
  //   const loadBusinesses = async () => {
  //     try {
  //       const businessData = await dataService.getBusinesses();
  //       setBusinesses(businessData);
  //       // Auto-select if only one business
  //       if (businessData.length === 1) {
  //         setSelectedBusinessId(businessData[0].id);
  //       }
  //     } catch (error) {
  //       console.error("Error loading businesses:", error);
  //       toast.error("Failed to load businesses. Please try again.");
  //     }
  //   };

  //   loadBusinesses();
  // }, []);

  // Debug Google Maps API setup on page load
  // useEffect(() => {
  //   const debugGoogleMapsSetup = async () => {
  //     console.log("🔧 AdminAddProject: Starting Google Maps API debug...");

  //     // Check environment variable directly
  //     const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  //     console.log(
  //       "🌍 Environment variable VITE_GOOGLE_MAPS_API_KEY:",
  //       envApiKey
  //         ? `${envApiKey.substring(0, 10)}...${envApiKey.substring(envApiKey.length - 6)}`
  //         : "Not Set",
  //     );

  //     // Test getGoogleMapsApiKey function
  //     const apiKey = getGoogleMapsApiKey();
  //     console.log(
  //       "🔑 getGoogleMapsApiKey() returned:",
  //       apiKey
  //         ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 6)}`
  //         : "No Key",
  //     );

  //     // Test API key validation if we have one
  //     if (apiKey) {
  //       console.log("🧪 Testing API key validation...");
  //       try {
  //         const validation = await validateGoogleMapsApiKey(apiKey);
  //         console.log("✅ API Key Validation Result:", validation);
  //       } catch (error) {
  //         console.error("❌ API Key Validation Error:", error);
  //       }
  //     } else {
  //       console.log("⚠️ No Google Maps API key found - address features disabled");
  //     }
  //   };

  //   debugGoogleMapsSetup();
  // }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressSelect = async (address: any) => {
    console.log("🗺️ Address selected:", address);
    // Simplified for now
  };

  const handlePhotosUpdate = (newPhotos: EnhancedPhoto[]) => {
    setPhotos(newPhotos);
  };

  const enhanceDescription = async () => {
    if (!formData.name) {
      toast.error("Please enter a project name first");
      return;
    }

    setIsEnhancingDescription(true);
    try {
      // Simulate AI enhancement - in a real app, this would call an AI service
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const serviceType = HOME_SERVICE_TYPES.find(t => t.value === formData.type)?.label || "Service";
      const enhanced = `${serviceType} project for ${formData.name}. This project involves professional ${serviceType.toLowerCase()} services to improve the property's functionality, aesthetics, and value. Work will be completed by licensed professionals with quality materials and industry-standard practices.`;

      setFormData((prev) => ({ ...prev, description: enhanced }));
      toast.success("Description enhanced successfully!");
    } catch (error) {
      toast.error("Failed to enhance description");
    } finally {
      setIsEnhancingDescription(false);
    }
  };

  const addMaterial = () => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, ""]
    }));
  };

  const updateMaterial = (index: number, value: string) => {
    const newMaterials = [...formData.materials];
    newMaterials[index] = value;
    setFormData(prev => ({ ...prev, materials: newMaterials }));
  };

  const removeMaterial = (index: number) => {
    if (formData.materials.length > 1) {
      const newMaterials = formData.materials.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, materials: newMaterials }));
    }
  };

  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, ""]
    }));
  };

  const updateTask = (index: number, value: string) => {
    const newTasks = [...formData.tasks];
    newTasks[index] = value;
    setFormData(prev => ({ ...prev, tasks: newTasks }));
  };

  const removeTask = (index: number) => {
    if (formData.tasks.length > 1) {
      const newTasks = formData.tasks.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, tasks: newTasks }));
    }
  };

  const addPhoneNumber = () => {
    setFormData((prev) => ({
      ...prev,
      additionalPhones: [...prev.additionalPhones, ""],
    }));
  };

  const removePhoneNumber = (index: number) => {
    if (formData.additionalPhones.length > 1) {
      setFormData((prev) => ({
        ...prev,
        additionalPhones: prev.additionalPhones.filter((_, i) => i !== index),
      }));
    }
  };

  const updatePhoneNumber = (index: number, value: string) => {
    const newPhones = [...formData.additionalPhones];
    newPhones[index] = value;
    setFormData((prev) => ({ ...prev, additionalPhones: newPhones }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBusinessId) {
      toast.error("Please select a business for this project");
      return;
    }

    if (!formData.name || !formData.description) {
      toast.error("Please fill in the required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare project data
      const projectData = {
        business_id: selectedBusinessId,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        status: formData.status,
        priority: formData.priority,
        client_contact: formData.customerName ? {
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.mobilePhone
        } : undefined,
        materials: formData.materials.filter(material => material.trim() !== ""),
        tasks: formData.tasks.filter(task => task.trim() !== ""),
        timeline: {
          start_date: formData.startDate,
          end_date: formData.completionDate,
          estimated_duration: formData.completionDate ? 
            Math.ceil((new Date(formData.completionDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 
            null
        },
        budget: formData.budget ? {
          total: parseFloat(formData.budget),
          spent: 0,
          currency: 'USD'
        } : undefined,
        metadata: {
          address: {
            street: formData.streetAddress,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            country: formData.country,
            coordinates: formData.gpsLat && formData.gpsLng ? {
              lat: parseFloat(formData.gpsLat),
              lng: parseFloat(formData.gpsLng)
            } : undefined
          },
          photos_count: photos.length,
          street_view_available: formData.hasStreetView,
          additional_phones: formData.additionalPhones.filter(phone => phone.trim() !== ""),
          notes: formData.notes
        },
        due_date: formData.dueDate || undefined,
        started_at: new Date().toISOString()
      };

      // Create the project
      const project = await dataService.createProject(projectData);

      // Upload photos if any
      if (photos.length > 0) {
        toast.info("Uploading photos...");
        for (const photo of photos) {
          try {
            // Convert URL to File object for upload
            const response = await fetch(photo.url);
            const blob = await response.blob();
            const file = new File([blob], photo.enhancedFileName, { type: blob.type });
            
            await dataService.uploadProjectPhoto(project.id, file, {
              category: 'general',
              description: photo.metadata?.description || '',
              is_featured: false,
              metadata: photo.metadata
            });
          } catch (error) {
            console.error("Error uploading photo:", error);
          }
        }
      }

      toast.success("Project created successfully!");
      navigate(`/project/${project.id}`);
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
          {/* Business Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="business">Select Business *</Label>
                <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a business for this project" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map((business) => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {businesses.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No businesses found. <Link to="/super-admin/businesses" className="text-primary hover:underline">Go to business management</Link>.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
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
                      <SelectItem value="cancelled">Cancelled</SelectItem>
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
                <div className="space-y-2">
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Describe the project scope, requirements, and expected outcomes..."
                    rows={4}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={enhanceDescription}
                    disabled={isEnhancingDescription || !formData.name}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isEnhancingDescription ? "Enhancing..." : "AI Enhance"}
                  </Button>
                </div>
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

              <div>
                <Label htmlFor="mobilePhone">Primary Phone</Label>
                <PhoneInput
                  value={formData.mobilePhone}
                  onChange={(value) => handleInputChange("mobilePhone", value)}
                  placeholder="Enter primary phone number"
                />
              </div>

              {/* Additional Phone Numbers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Additional Phone Numbers</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPhoneNumber}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Phone
                  </Button>
                </div>
                {formData.additionalPhones.map((phone, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <PhoneInput
                      value={phone}
                      onChange={(value) => updatePhoneNumber(index, value)}
                      placeholder="Additional phone number"
                    />
                    {formData.additionalPhones.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removePhoneNumber(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Project Materials */}
          <Card>
            <CardHeader>
              <CardTitle>Materials & Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Required Materials</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Material
                  </Button>
                </div>
                {formData.materials.map((material, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      value={material}
                      onChange={(e) => updateMaterial(index, e.target.value)}
                      placeholder="Enter material or supply needed"
                    />
                    {formData.materials.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeMaterial(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Project Tasks</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTask}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Task
                  </Button>
                </div>
                {formData.tasks.map((task, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      value={task}
                      onChange={(e) => updateTask(index, e.target.value)}
                      placeholder="Enter task or work item"
                    />
                    {formData.tasks.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTask(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange("dueDate", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="completionDate">Expected Completion</Label>
                  <Input
                    id="completionDate"
                    type="date"
                    value={formData.completionDate}
                    onChange={(e) => handleInputChange("completionDate", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle>Project Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="addressSearch">Address Search</Label>
                <AddressAutocomplete
                  onAddressSelect={handleAddressSelect}
                  placeholder="Search for project address..."
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="streetAddress">Street Address</Label>
                  <Input
                    id="streetAddress"
                    value={formData.streetAddress}
                    onChange={(e) => handleInputChange("streetAddress", e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="City name"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <USStatesSelect
                    value={formData.state}
                    onValueChange={(value) => handleInputChange("state", value)}
                    placeholder="Select state"
                  />
                </div>

                <div>
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => handleInputChange("zipCode", e.target.value)}
                    placeholder="12345"
                  />
                </div>
              </div>

              {formData.hasStreetView && formData.streetViewUrl && (
                <div>
                  <Label>Street View Preview</Label>
                  <div className="mt-2">
                    <iframe
                      src={formData.streetViewUrl}
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="rounded-md"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Photos */}
          <Card>
            <CardHeader>
              <CardTitle>Project Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {/* <ModernPhotoCapture
                photos={photos}
                onPhotosChange={handlePhotosUpdate}
                projectInfo={{
                  id: generateProjectId(),
                  name: formData.name,
                  address: `${formData.streetAddress}, ${formData.city}, ${formData.state}`,
                  customerName: formData.customerName,
                  keywords: [formData.type, formData.name],
                }}
              /> */}
              <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-gray-500">Photo capture feature coming soon for home services projects</p>
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Add any additional notes, special requirements, or important details..."
                rows={3}
              />
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
            <Button type="submit" disabled={isSubmitting || !selectedBusinessId}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
