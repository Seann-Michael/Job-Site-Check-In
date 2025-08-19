import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Info,
  Upload,
  Copy,
  QrCode,
  Mail,
  CheckCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DESCRIPTIONS,
  AccessLevel,
  CustomPlatform,
} from "../../types/oauth";
import { CustomPlatformManager } from "./CustomPlatformManager";
import { toast } from "sonner";

interface StaticLinkConfig {
  agency_name: string;
  selected_platforms: string[];
  selected_custom_platforms: string[];
  access_level: AccessLevel;
  branding: {
    primary_color: string;
    company_name: string;
    logo_url?: string;
  };
  instructions?: string;
}

interface StaticLinkGeneratorProps {
  onLinkGenerated?: (link: string, config: StaticLinkConfig) => void;
}

export const StaticLinkGenerator: React.FC<StaticLinkGeneratorProps> = ({
  onLinkGenerated,
}) => {
  const [config, setConfig] = useState<StaticLinkConfig>({
    agency_name: "",
    selected_platforms: [],
    selected_custom_platforms: [],
    access_level: "read_only",
    branding: {
      primary_color: "#2563eb",
      company_name: "",
      logo_url: undefined,
    },
    instructions: "",
  });

  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatform[]>([]);
  const [showCustomPlatformManager, setShowCustomPlatformManager] =
    useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Load custom platforms on component mount
  useEffect(() => {
    fetchCustomPlatforms();
  }, []);

  const fetchCustomPlatforms = async () => {
    try {
      console.log("Fetching custom platforms from /api/oauth/custom-platforms");
      const response = await fetch("/api/oauth/custom-platforms", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("supabase_token")}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.log("Custom platforms data:", data);
          setCustomPlatforms(data.data || []);
        } else {
          console.warn("Custom platforms API returned non-JSON response, content-type:", contentType);
          const text = await response.text();
          console.warn("Response body:", text);
          setCustomPlatforms([]);
        }
      } else {
        console.warn(`Custom platforms API returned ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.warn("Error response body:", errorText);
        setCustomPlatforms([]);
      }
    } catch (error) {
      console.error("Error fetching custom platforms:", error);
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      setCustomPlatforms([]);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};

    if (!config.agency_name.trim() || config.agency_name.length < 2) {
      newErrors.agency_name = "Agency name is required (minimum 2 characters)";
    }

    if (
      config.selected_platforms.length === 0 &&
      config.selected_custom_platforms.length === 0
    ) {
      newErrors.selected_platforms = "Please select at least one platform";
    }

    if (!config.branding.company_name.trim()) {
      newErrors.company_name = "Company name is required for branding";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlatformToggle = (platform: string, checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      selected_platforms: checked
        ? [...prev.selected_platforms, platform]
        : prev.selected_platforms.filter((p) => p !== platform),
    }));
  };

  const handleCustomPlatformToggle = (platformId: string, checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      selected_custom_platforms: checked
        ? [...prev.selected_custom_platforms, platformId]
        : prev.selected_custom_platforms.filter((p) => p !== platformId),
    }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev: any) => ({
        ...prev,
        branding: "Logo file size must be less than 2MB",
      }));
      return;
    }

    // Validate file type
    if (!["image/jpeg", "image/png", "image/svg+xml"].includes(file.type)) {
      setErrors((prev: any) => ({
        ...prev,
        branding: "Logo must be JPG, PNG, or SVG format",
      }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      setConfig((prev) => ({
        ...prev,
        branding: {
          ...prev.branding,
          logo_url: result,
        },
      }));
    };
    reader.readAsDataURL(file);

    // Clear any previous errors
    setErrors((prev: any) => ({ ...prev, branding: undefined }));
  };

  const generateStaticLink = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    try {
      // Generate a unique agency token
      const agencyToken = `agency_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Save the agency configuration
      const response = await fetch("/api/oauth/agency-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase_token")}`,
        },
        body: JSON.stringify({
          agency_token: agencyToken,
          config: config,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save agency configuration");
      }

      // Generate the static link
      const staticLink = `${window.location.origin}/onboard/agency/${agencyToken}`;
      
      setGeneratedLink(staticLink);
      onLinkGenerated?.(staticLink, config);
      toast.success("Static onboarding link generated successfully!");
    } catch (error) {
      console.error("Error generating static link:", error);
      toast.error("Failed to generate link. Please try again.");
      setErrors({ agency_name: "Failed to generate link. Please try again." });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const resetForm = () => {
    setConfig({
      agency_name: "",
      selected_platforms: [],
      selected_custom_platforms: [],
      access_level: "read_only",
      branding: {
        primary_color: "#2563eb",
        company_name: "",
        logo_url: undefined,
      },
      instructions: "",
    });
    setErrors({});
    setGeneratedLink(null);
    setLogoPreview(null);
  };

  if (generatedLink) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            Static Onboarding Link Generated
          </CardTitle>
          <CardDescription>
            Share this link with any number of clients. Each client who uses this link will be onboarded with the same platform connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generated Link */}
          <div className="space-y-2">
            <Label>Static Onboarding Link</Label>
            <div className="flex gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(generatedLink)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(generatedLink, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Usage Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Reusable Link:</strong> This link can be shared with unlimited clients. Each client will see the same onboarding process with your selected platforms. No login required for clients.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={resetForm}
              className="flex-1"
            >
              Generate New Configuration
            </Button>
          </div>

          {/* Selected Platforms Preview */}
          <div className="space-y-2">
            <Label>Selected Platforms ({config.selected_platforms.length + config.selected_custom_platforms.length})</Label>
            <div className="flex flex-wrap gap-2">
              {config.selected_platforms.map((platform) => (
                <Badge key={platform} variant="secondary">
                  {
                    PLATFORM_DISPLAY_NAMES[
                      platform as keyof typeof PLATFORM_DISPLAY_NAMES
                    ]
                  }
                </Badge>
              ))}
              {config.selected_custom_platforms.map((platformId) => {
                const platform = customPlatforms.find(p => p.id === platformId);
                return platform ? (
                  <Badge key={platformId} variant="outline">
                    {platform.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <React.Fragment>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Generate Static Client Onboarding Link
            <Info
              className="h-5 w-5 text-muted-foreground cursor-help"
              title="Create a reusable link that can be shared with unlimited clients"
            />
          </CardTitle>
          <CardDescription>
            Create a single, reusable link that can be shared with any number of clients. 
            All clients using this link will have the same onboarding experience with your selected platforms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Agency Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Agency Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agency_name">Agency Name *</Label>
                <Input
                  id="agency_name"
                  value={config.agency_name}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      agency_name: e.target.value,
                    }))
                  }
                  placeholder="Your Agency Name"
                  className={errors.agency_name ? "border-red-500" : ""}
                />
                {errors.agency_name && (
                  <p className="text-sm text-red-500">{errors.agency_name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name for Branding *</Label>
                <Input
                  id="company_name"
                  value={config.branding.company_name}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      branding: {
                        ...prev.branding,
                        company_name: e.target.value,
                      },
                    }))
                  }
                  placeholder="Your Agency Brand Name"
                  className={errors.company_name ? "border-red-500" : ""}
                />
                {errors.company_name && (
                  <p className="text-sm text-red-500">{errors.company_name}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions for Clients (Optional)</Label>
              <textarea
                id="instructions"
                value={config.instructions}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    instructions: e.target.value,
                  }))
                }
                placeholder="Add any specific instructions for your clients about the onboarding process..."
                className="min-h-[100px] w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
              />
            </div>
          </div>

          {/* Platform Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Platform Selection</h3>
              {errors.selected_platforms && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.selected_platforms}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SUPPORTED_PLATFORMS.map((platform) => (
                <div
                  key={platform}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={platform}
                    checked={config.selected_platforms.includes(platform)}
                    onCheckedChange={(checked) =>
                      handlePlatformToggle(platform, checked as boolean)
                    }
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={platform}
                      className="font-medium cursor-pointer"
                    >
                      {
                        PLATFORM_DISPLAY_NAMES[
                          platform as keyof typeof PLATFORM_DISPLAY_NAMES
                        ]
                      }
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {
                        PLATFORM_DESCRIPTIONS[
                          platform as keyof typeof PLATFORM_DESCRIPTIONS
                        ]
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Platforms Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Custom Platforms</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomPlatformManager(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Custom Platforms
                </Button>
              </div>

              {customPlatforms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customPlatforms.map((platform) => (
                    <div
                      key={platform.id}
                      className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={`custom_${platform.id}`}
                        checked={config.selected_custom_platforms.includes(
                          platform.id,
                        )}
                        onCheckedChange={(checked) =>
                          handleCustomPlatformToggle(
                            platform.id,
                            checked as boolean,
                          )
                        }
                      />
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`custom_${platform.id}`}
                          className="font-medium cursor-pointer flex items-center gap-2"
                        >
                          {platform.icon_url && (
                            <img
                              src={platform.icon_url}
                              alt={platform.name}
                              className="w-4 h-4 object-contain"
                            />
                          )}
                          {platform.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {platform.description ||
                            "Custom platform integration"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No custom platforms created yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowCustomPlatformManager(true)}
                  >
                    Create Custom Platform
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Access Level Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Access Level Configuration
            </h3>
            <RadioGroup
              value={config.access_level}
              onValueChange={(value: AccessLevel) =>
                setConfig((prev) => ({ ...prev, access_level: value }))
              }
              className="space-y-4"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <RadioGroupItem
                  value="read_only"
                  id="read_only"
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="read_only"
                    className="font-medium cursor-pointer"
                  >
                    Read Only Access
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    View data and reports only. Cannot make changes to campaigns
                    or settings.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <RadioGroupItem
                  value="full_management"
                  id="full_management"
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="full_management"
                    className="font-medium cursor-pointer"
                  >
                    Full Management Access
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Complete access to view, edit, and manage all campaigns and
                    settings.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Branding Customization */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Branding Customization</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_upload">Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="logo_upload"
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        document.getElementById("logo_upload")?.click()
                      }
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Logo
                    </Button>
                    {logoPreview && (
                      <div className="w-12 h-12 border rounded overflow-hidden">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Max 2MB. Supports JPG, PNG, SVG formats.
                  </p>
                  {errors.branding && (
                    <p className="text-sm text-red-500">{errors.branding}</p>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={config.branding.primary_color}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          branding: {
                            ...prev.branding,
                            primary_color: e.target.value,
                          },
                        }))
                      }
                      className="w-16 h-10 p-1 rounded"
                    />
                    <Input
                      value={config.branding.primary_color}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          branding: {
                            ...prev.branding,
                            primary_color: e.target.value,
                          },
                        }))
                      }
                      placeholder="#2563eb"
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div
                    className="p-4 rounded-lg border text-white text-center font-medium"
                    style={{ backgroundColor: config.branding.primary_color }}
                  >
                    {config.branding.company_name || "Your Agency"} Onboarding
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generateStaticLink}
            disabled={isGenerating}
            className="w-full h-12 text-lg"
            style={{ backgroundColor: config.branding.primary_color }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Static Link...
              </>
            ) : (
              "Generate Static Onboarding Link"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Custom Platform Manager Dialog */}
      {showCustomPlatformManager && (
        <Dialog
          open={showCustomPlatformManager}
          onOpenChange={setShowCustomPlatformManager}
        >
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Custom Platforms</DialogTitle>
              <DialogDescription>
                Create and manage custom platform connections for your
                onboarding process
              </DialogDescription>
            </DialogHeader>
            <CustomPlatformManager onPlatformsUpdated={fetchCustomPlatforms} />
          </DialogContent>
        </Dialog>
      )}
    </React.Fragment>
  );
};

export default StaticLinkGenerator;
