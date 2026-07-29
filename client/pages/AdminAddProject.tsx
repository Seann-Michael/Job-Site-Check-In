// @ts-nocheck - Temporary suppression of type errors
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
  Plus,
  Trash2,
  Home,
  Wrench,
  Palette,
  TreePine,
  Car,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ProjectInfo } from "@/lib/mediaMetadata";
import { generateProjectId } from "@/lib/idGenerator";
import { AddressAutocomplete } from "@/components/GoogleMaps";
import { USStatesSelect } from "@/components/ui/us-states-select";
import { compatibleDataService as dataService } from "@/lib/compatibleDataService";
import {
  getGoogleMapsApiKey,
  createStreetViewEmbedUrl,
  checkStreetViewAvailability,
} from "@/lib/googleMaps";

interface EnhancedPhoto {
  url: string;
  metadata: any;
  enhancedFileName: string;
}

// Home services project types
const HOME_SERVICE_TYPES = [
  { value: "renovation", label: "Renovation", icon: Home },
  { value: "construction", label: "Construction", icon: Home },
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
  const [budgetDisplay, setBudgetDisplay] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "renovation" as const,
    priority: "medium" as const,
    // Must be a member of the project_status enum (draft, active, in_progress,
    // paused, completed, cancelled) — the old "planning" default made the
    // insert itself fail.
    status: "active" as const,
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
  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        const businessData = await dataService.getBusinesses();
        setBusinesses(businessData);
        // Auto-select if only one business
        if (businessData.length === 1) {
          setSelectedBusinessId(businessData[0].id);
        }
      } catch (error) {
        console.error("Error loading businesses:", error);
        toast.error("Failed to load businesses. Please try again.");
      }
    };

    loadBusinesses();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressSelect = async (address: any) => {
    const updatedFormData = {
      ...formData,
      addressSearch: address.formatted_address || "",
      streetAddress: address.name || "",
      city: address.city || "",
      state: address.state || "",
      zipCode: address.postal_code || "",
      placeId: address.place_id || "",
      gpsLat: address.geometry?.location?.lat?.toString() || "",
      gpsLng: address.geometry?.location?.lng?.toString() || "",
    };

    setFormData(updatedFormData);

    // Check for Street View availability
    const apiKey = getGoogleMapsApiKey();
    if (apiKey && address.geometry?.location) {
      try {
        const streetViewAvailable = await checkStreetViewAvailability(
          address.geometry.location.lat,
          address.geometry.location.lng,
          apiKey,
        );

        if (streetViewAvailable) {
          const streetViewUrl = createStreetViewEmbedUrl(
            address.geometry.location.lat,
            address.geometry.location.lng,
            apiKey,
          );

          setFormData((prev) => ({
            ...prev,
            streetViewUrl,
            hasStreetView: true,
          }));

        } else {
          setFormData((prev) => ({
            ...prev,
            streetViewUrl: "",
            hasStreetView: false,
          }));
        }
      } catch (error) {
        console.error("Error checking Street View availability:", error);
      }
    }
  };

  const handlePhotosUpdate = (newPhotos: EnhancedPhoto[]) => {
    setPhotos(newPhotos);
  };

  const enhanceDescription = async () => {
    if (!formData.name) {
      toast.error("Please enter a job name first");
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

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    handleInputChange("budget", raw);
    setBudgetDisplay(e.target.value);
  };

  const handleBudgetFocus = () => {
    setBudgetDisplay(formData.budget);
  };

  const handleBudgetBlur = () => {
    if (formData.budget) {
      const num = parseFloat(formData.budget);
      if (!isNaN(num)) {
        setBudgetDisplay(
          "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        );
      }
    } else {
      setBudgetDisplay("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description) {
      toast.error("Please fill in the required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare project data with error handling
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
        materials: formData.materials?.filter(material => material?.trim() !== "") || [],
        tasks: formData.tasks?.filter(task => task?.trim() !== "") || [],
        timeline: {
          start_date: formData.startDate,
          end_date: formData.completionDate || undefined,
          estimated_duration: formData.completionDate && formData.startDate ?
            Math.ceil((new Date(formData.completionDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) :
            null
        },
        budget: formData.budget ? {
          total: parseFloat(formData.budget) || 0,
          spent: 0,
          currency: 'USD'
        } : undefined,
        metadata: {
          address: {
            street: formData.streetAddress || "",
            city: formData.city || "",
            state: formData.state || "",
            zipCode: formData.zipCode || "",
            country: formData.country || "United States",
            coordinates: formData.gpsLat && formData.gpsLng ? {
              lat: parseFloat(formData.gpsLat) || 0,
              lng: parseFloat(formData.gpsLng) || 0
            } : undefined
          },
          photos_count: photos?.length || 0,
          street_view_available: formData.hasStreetView || false,
          additional_phones: formData.additionalPhones?.filter(phone => phone?.trim() !== "") || [],
          notes: formData.notes || ""
        },
        due_date: formData.dueDate || undefined,
        started_at: new Date().toISOString()
      };

      // Create the project with error handling
      const project = await dataService.createProject(projectData);

      if (!project || !project.id) {
        throw new Error("Failed to create project - no project ID returned");
      }

      // Upload photos if any (with enhanced error handling)
      if (photos && photos.length > 0) {
        toast.info("Uploading photos...");
        let uploadedCount = 0;
        for (const photo of photos) {
          try {
            if (!photo?.url || !photo?.enhancedFileName) {
              console.warn("Skipping invalid photo:", photo);
              continue;
            }

            // Convert URL to File object for upload
            const response = await fetch(photo.url);
            if (!response.ok) {
              throw new Error(`Failed to fetch photo: ${response.statusText}`);
            }

            const blob = await response.blob();
            const file = new File([blob], photo.enhancedFileName, { type: blob.type });

            await dataService.uploadProjectPhoto(project.id, file, {
              category: 'general',
              description: photo.metadata?.description || '',
              is_featured: false,
              metadata: photo.metadata || {}
            });
            uploadedCount++;
          } catch (error) {
            console.error("Error uploading photo:", error);
            // Continue with other photos even if one fails
          }
        }

        if (uploadedCount > 0) {
          toast.success(`Successfully uploaded ${uploadedCount} photo(s)`);
        }
      }

      toast.success("Job created successfully!");
      navigate(`/job/${project.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create project. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Add New Home Services Job"
      breadcrumbs={[
        { label: "Jobs", href: "/admin/jobs" },
        { label: "Add Job", href: "/admin/add-job" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                      {/* Options mirror the project_status enum exactly — the
                          mobile app reads these same values back. */}
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget">Project Cost</Label>
                  <Input
                    id="budget"
                    type="text"
                    value={budgetDisplay}
                    onChange={handleBudgetChange}
                    onFocus={handleBudgetFocus}
                    onBlur={handleBudgetBlur}
                    placeholder="Enter amount"
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
                  value={formData.addressSearch}
                  onChange={(address, placeResult) => {
                    if (placeResult) {
                      handleAddressSelect(placeResult);
                    }
                  }}
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
            <Link to="/admin/jobs">
              <Button type="button" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
