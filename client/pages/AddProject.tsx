import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { ModernPhotoCapture } from "@/components/ModernPhotoCapture";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Lightbulb,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ProjectInfo } from "@/lib/mediaMetadata";
import { SmartDropdownInput } from "@/components/SmartDropdownInput";
import { DROPDOWN_FIELDS } from "@/hooks/useDropdownState";
import { generateProjectId } from "@/lib/idGenerator";
import { AddressAutocomplete } from "@/components/GoogleMaps";
import {
  getGoogleMapsApiKey,
  validateGoogleMapsApiKey,
} from "@/lib/googleMaps";

interface EnhancedPhoto {
  url: string;
  metadata: any;
  enhancedFileName: string;
}

export default function AddProject() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<EnhancedPhoto[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
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
    mobilePhone: "",
    additionalPhones: [""],
    keywords: "",
    startDate: new Date().toISOString().split("T")[0], // Auto-populated with today
    completionDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);

  // Debug Google Maps API setup on page load
  useEffect(() => {
    const debugGoogleMapsSetup = async () => {
      console.log("🔧 AddProject: Starting Google Maps API debug...");

      // Check environment variable directly
      const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      console.log(
        "🌍 Environment variable VITE_GOOGLE_MAPS_API_KEY:",
        envApiKey
          ? `${envApiKey.substring(0, 10)}...${envApiKey.substring(envApiKey.length - 6)}`
          : "Not Set",
      );

      // Test getGoogleMapsApiKey function
      const apiKey = getGoogleMapsApiKey();
      console.log(
        "🔑 getGoogleMapsApiKey() returned:",
        apiKey
          ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 6)}`
          : "No Key",
      );

      // Test API key validation if we have one
      if (apiKey) {
        console.log("🧪 Testing API key validation...");
        try {
          const validation = await validateGoogleMapsApiKey(apiKey);
          console.log("📊 Validation result:", validation);

          if (validation.valid) {
            console.log("✅ Google Maps API key is valid and working");
          } else {
            console.error(
              "❌ Google Maps API key validation failed:",
              validation.error,
            );
          }
        } catch (error) {
          console.error("💥 API validation error:", error);
        }
      }
    };

    debugGoogleMapsSetup();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearAddressData = () => {
    setFormData((prev) => ({
      ...prev,
      addressSearch: "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      country: "United States",
      placeId: "",
      gpsLat: "",
      gpsLng: "",
    }));
  };

  const handleAddressSelect = (selectedPlace: any) => {
    console.log("🏠 Selected place:", selectedPlace);

    // Parse Google Places address components
    const addressComponents = selectedPlace.address_components || [];
    let streetNumber = "";
    let route = "";
    let city = "";
    let state = "";
    let zipCode = "";
    let country = "";

    addressComponents.forEach((component: any) => {
      const types = component.types;
      if (types.includes("street_number")) {
        streetNumber = component.long_name;
      } else if (types.includes("route")) {
        route = component.long_name;
      } else if (types.includes("locality")) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = component.short_name;
      } else if (types.includes("postal_code")) {
        zipCode = component.long_name;
      } else if (types.includes("country")) {
        country = component.long_name;
      }
    });

    const streetAddress = `${streetNumber} ${route}`.trim();

    setFormData((prev) => ({
      ...prev,
      addressSearch: selectedPlace.formattedAddress || selectedPlace.description,
      streetAddress: streetAddress,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country || "United States",
      placeId: selectedPlace.place_id || selectedPlace.placeId || "",
      gpsLat: selectedPlace.geometry?.location?.lat?.toString() || selectedPlace.lat?.toString() || "",
      gpsLng: selectedPlace.geometry?.location?.lng?.toString() || selectedPlace.lng?.toString() || "",
    }));
  };

  const handleAdditionalPhoneChange = (index: number, value: string) => {
    setFormData((prev) => {
      const newPhones = [...prev.additionalPhones];
      newPhones[index] = value;
      return {
        ...prev,
        additionalPhones: newPhones,
      };
    });
  };

  const addPhoneField = () => {
    setFormData((prev) => ({
      ...prev,
      additionalPhones: [...prev.additionalPhones, ""],
    }));
  };

  const removePhoneField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      additionalPhones: prev.additionalPhones.filter((_, i) => i !== index),
    }));
  };

  const handleAddressSelect = (address: string, lat?: number, lng?: number) => {
    setFormData((prev) => ({
      ...prev,
      address,
      gpsLat: lat ? lat.toString() : "",
      gpsLng: lng ? lng.toString() : "",
    }));
  };

  // Simulate Google Places API (in production, use actual Google Places API)
  const simulateGooglePlaces = (input: string) => {
    if (input.length > 3) {
      // Simulate API response with coordinates
      const mockCoordinates = {
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.006 + (Math.random() - 0.5) * 0.1,
      };

      if (input.toLowerCase().includes("main")) {
        mockCoordinates.lat = 40.7589;
        mockCoordinates.lng = -73.9851;
      }

      setFormData((prev) => ({
        ...prev,
        gpsLat: mockCoordinates.lat.toFixed(6),
        gpsLng: mockCoordinates.lng.toFixed(6),
      }));
    }
  };

  const handlePhotosChange = (enhancedPhotos: EnhancedPhoto[]) => {
    setPhotos(enhancedPhotos);
  };

  const enhanceDescription = async () => {
    if (!formData.description.trim()) {
      toast.error("Please enter a description first");
      return;
    }

    setIsEnhancingDescription(true);
    try {
      // Simulate AI enhancement
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const enhanced = generateEnhancedDescription(
        formData.description,
        formData.name,
      );
      setFormData((prev) => ({ ...prev, description: enhanced }));
      toast.success("Description enhanced!");
    } catch (error) {
      toast.error("Failed to enhance description");
    } finally {
      setIsEnhancingDescription(false);
    }
  };

  const generateKeywordSuggestions = async () => {
    if (!formData.name && !formData.description) {
      toast.error("Please enter project name or description first");
      return;
    }

    try {
      // Simulate AI keyword generation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const suggestions = generateKeywords(formData.name, formData.description);
      setSuggestedKeywords(suggestions);
      toast.success("Keywords suggested!");
    } catch (error) {
      toast.error("Failed to generate keywords");
    }
  };

  const addKeywordFromSuggestion = (keyword: string) => {
    const currentKeywords = formData.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!currentKeywords.includes(keyword)) {
      const newKeywords = [...currentKeywords, keyword].join(", ");
      setFormData((prev) => ({ ...prev, keywords: newKeywords }));
    }
    setSuggestedKeywords((prev) => prev.filter((k) => k !== keyword));
  };

  const generateEnhancedDescription = (
    original: string,
    projectName: string,
  ): string => {
    // Simple AI simulation - in production, this would call an actual AI service
    const templates = [
      `Professional ${projectName.toLowerCase()} featuring ${original}. This comprehensive project showcases exceptional craftsmanship and attention to detail, delivering outstanding results that exceed client expectations.`,
      `Expert ${projectName.toLowerCase()} project completed with precision and care. ${original} The work demonstrates superior quality construction techniques and modern design principles.`,
      `High-quality ${projectName.toLowerCase()} transformation including ${original}. This project represents our commitment to excellence and delivers lasting value through skilled workmanship.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  };

  const generateKeywords = (name: string, description: string): string[] => {
    // Simple keyword generation simulation
    const commonKeywords = [
      "renovation",
      "remodel",
      "construction",
      "professional",
      "quality",
    ];
    const contextKeywords = [];

    const text = (name + " " + description).toLowerCase();
    if (text.includes("kitchen"))
      contextKeywords.push("kitchen", "cabinets", "countertops");
    if (text.includes("bathroom"))
      contextKeywords.push("bathroom", "tiles", "fixtures");
    if (text.includes("floor"))
      contextKeywords.push("flooring", "hardwood", "installation");
    if (text.includes("paint"))
      contextKeywords.push("painting", "interior", "exterior");
    if (text.includes("roof"))
      contextKeywords.push("roofing", "shingles", "repair");

    return [...commonKeywords, ...contextKeywords].slice(0, 6);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    if (photos.length === 0) {
      toast.error("Please add at least one photo");
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const project = {
        id: generateProjectId(),
        ...formData,
        keywords: formData.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        photos,
        documents: [],
        tasks: [],
        checklist: [],
        notes: [],
        activityLog: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store in localStorage for demo
      const existingProjects = JSON.parse(
        localStorage.getItem("projects") || "[]",
      );
      localStorage.setItem(
        "projects",
        JSON.stringify([project, ...existingProjects]),
      );

      toast.success("Project created successfully!");
      navigate("/admin/projects");
    } catch (error) {
      toast.error("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container px-4 py-6 max-w-full overflow-x-hidden">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/admin/projects">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold">Add New Project</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-w-full sm:max-w-2xl mx-auto space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="Enter project name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <div className="relative">
                  <Textarea
                    id="description"
                    placeholder="Describe the project"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    rows={3}
                  />
                  {formData.description && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 gap-2"
                      onClick={enhanceDescription}
                      disabled={isEnhancingDescription}
                    >
                      {isEnhancingDescription ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isEnhancingDescription ? "Enhancing..." : "AI Enhance"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* Address Search */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Address Lookup</Label>
                    {formData.addressSearch && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearAddressData}
                        title="Clear address and start over"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <AddressAutocomplete
                    placeholder="Search for address..."
                    value={formData.addressSearch}
                    onChange={(address, placeResult) => {
                      if (placeResult) {
                        handleAddressSelect(placeResult);
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          addressSearch: address,
                        }));
                      }
                    }}
                  />
                  {formData.placeId && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                      <CheckCircle className="h-3 w-3" />
                      Address verified with Google Maps
                    </div>
                  )}
                </div>

                {/* Address Fields */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Address Details</Label>

                  <div className="space-y-2">
                    <Label htmlFor="streetAddress">Street Address</Label>
                    <Input
                      id="streetAddress"
                      placeholder="123 Main Street"
                      value={formData.streetAddress}
                      onChange={(e) => handleInputChange("streetAddress", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="City"
                        value={formData.city}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        placeholder="State"
                        value={formData.state}
                        onChange={(e) => handleInputChange("state", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                      <Input
                        id="zipCode"
                        placeholder="12345"
                        value={formData.zipCode}
                        onChange={(e) => handleInputChange("zipCode", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        placeholder="United States"
                        value={formData.country}
                        onChange={(e) => handleInputChange("country", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Technical Details (Collapsible) */}
                <details className="space-y-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    {formData.placeId && (
                      <div className="space-y-2">
                        <Label htmlFor="placeId">Place ID</Label>
                        <Input
                          id="placeId"
                          value={formData.placeId}
                          className="bg-muted font-mono text-xs"
                          readOnly
                          title="Google Places unique identifier"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="gpsLat">GPS Latitude</Label>
                      <Input
                        id="gpsLat"
                        placeholder="40.7128"
                        value={formData.gpsLat}
                        onChange={(e) => handleInputChange("gpsLat", e.target.value)}
                        className={formData.placeId ? "bg-muted" : ""}
                        readOnly={!!formData.placeId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gpsLng">GPS Longitude</Label>
                      <Input
                        id="gpsLng"
                        placeholder="-74.0060"
                        value={formData.gpsLng}
                        onChange={(e) => handleInputChange("gpsLng", e.target.value)}
                        className={formData.placeId ? "bg-muted" : ""}
                        readOnly={!!formData.placeId}
                      />
                    </div>
                  </div>
                </details>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Project Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      handleInputChange("startDate", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-populated with today's date
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="completionDate">
                    Expected Completion Date{" "}
                    <span className="text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="completionDate"
                    type="date"
                    value={formData.completionDate}
                    onChange={(e) =>
                      handleInputChange("completionDate", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer full name"
                    value={formData.customerName}
                    onChange={(e) =>
                      handleInputChange("customerName", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobilePhone">Mobile Phone</Label>
                  <PhoneInput
                    id="mobilePhone"
                    value={formData.mobilePhone}
                    onChange={(value) =>
                      handleInputChange("mobilePhone", value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label>Additional Phone Numbers</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPhoneField}
                      className="gap-2 w-full sm:w-auto min-h-[44px]"
                    >
                      <Plus className="h-4 w-4" />
                      Add Phone
                    </Button>
                  </div>
                  {formData.additionalPhones.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="(555) 123-4567"
                        value={phone}
                        onChange={(e) =>
                          handleAdditionalPhoneChange(index, e.target.value)
                        }
                        className="min-h-[44px]"
                      />
                      {formData.additionalPhones.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePhoneField(index)}
                          className="min-h-[44px] min-w-[44px] flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label htmlFor="keywords">Keywords</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full sm:w-auto min-h-[44px]"
                    onClick={generateKeywordSuggestions}
                  >
                    <Lightbulb className="h-4 w-4" />
                    Suggest Keywords
                  </Button>
                </div>
                <SmartDropdownInput
                  fieldName={DROPDOWN_FIELDS.PROJECT_KEYWORDS}
                  value={formData.keywords}
                  onChange={(value) => handleInputChange("keywords", value)}
                  placeholder="renovation, bathroom, kitchen (comma separated)"
                  allowMultiple={true}
                  separator=","
                />
                {suggestedKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-sm text-muted-foreground mr-2">
                      Suggestions:
                    </span>
                    {suggestedKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => addKeywordFromSuggestion(keyword)}
                      >
                        + {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Separate keywords with commas to help organize your projects
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <ModernPhotoCapture
                photos={photos}
                onPhotosChange={handlePhotosChange}
                projectInfo={{
                  id: "new-project",
                  name: formData.name || "New Project",
                  address: formData.address || "",
                  customerName: formData.customerName || "",
                  keywords: formData.keywords
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean),
                }}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-4">
            <Link to="/admin/projects" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 min-w-32 w-full sm:w-auto min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Project
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
