import React, { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Building2,
  Shield,
  CheckCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Lock,
  Info,
} from "lucide-react";
import {
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DESCRIPTIONS,
  CustomPlatform,
} from "../types/oauth";
import { toast } from "sonner";

interface AgencyConfig {
  agency_name: string;
  selected_platforms: string[];
  selected_custom_platforms: string[];
  access_level: "read_only" | "full_management";
  branding: {
    primary_color: string;
    company_name: string;
    logo_url?: string;
  };
  instructions?: string;
}

interface ClientForm {
  name: string;
  email: string;
  company: string;
  phone?: string;
  custom_platform_responses: Record<string, any>;
}

export default function PublicOnboarding() {
  const { agencyToken } = useParams<{ agencyToken: string }>();
  const [agencyConfig, setAgencyConfig] = useState<AgencyConfig | null>(null);
  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  
  const [clientForm, setClientForm] = useState<ClientForm>({
    name: "",
    email: "",
    company: "",
    phone: "",
    custom_platform_responses: {},
  });
  
  const [formErrors, setFormErrors] = useState<any>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (agencyToken) {
      loadAgencyConfig();
    }
  }, [agencyToken]);

  const loadAgencyConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/oauth/agency-config/${agencyToken}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Invalid or expired onboarding link");
        } else {
          setError("Failed to load onboarding configuration");
        }
        return;
      }

      const data = await response.json();
      setAgencyConfig(data.config);
      
      // Load custom platforms if any are selected
      if (data.config.selected_custom_platforms?.length > 0) {
        await loadCustomPlatforms(data.config.selected_custom_platforms);
      }
      
      // Pre-select all platforms
      setSelectedPlatforms([
        ...data.config.selected_platforms,
        ...data.config.selected_custom_platforms,
      ]);
      
    } catch (error) {
      console.error("Error loading agency config:", error);
      setError("Failed to load onboarding configuration");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomPlatforms = async (platformIds: string[]) => {
    try {
      const response = await fetch("/api/oauth/custom-platforms");
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          const allCustomPlatforms = data.data || [];
          // Filter to only show the ones selected by agency
          const selectedCustomPlatforms = allCustomPlatforms.filter((p: CustomPlatform) =>
            platformIds.includes(p.id)
          );
          setCustomPlatforms(selectedCustomPlatforms);
        }
      }
    } catch (error) {
      console.error("Error loading custom platforms:", error);
    }
  };

  const validateForm = (): boolean => {
    const errors: any = {};

    if (!clientForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (!clientForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientForm.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (selectedPlatforms.length === 0) {
      errors.platforms = "Please select at least one platform to connect";
    }

    // Validate custom platform fields
    customPlatforms.forEach((platform) => {
      if (selectedPlatforms.includes(platform.id)) {
        platform.fields.forEach((field) => {
          if (field.required) {
            const value = clientForm.custom_platform_responses[`${platform.id}_${field.name}`];
            if (!value || (typeof value === "string" && !value.trim())) {
              errors[`custom_${platform.id}_${field.name}`] = `${field.label} is required`;
            }
          }
        });
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlatformToggle = (platformId: string, checked: boolean) => {
    setSelectedPlatforms((prev) =>
      checked
        ? [...prev, platformId]
        : prev.filter((id) => id !== platformId)
    );
  };

  const handleCustomFieldChange = (platformId: string, fieldName: string, value: any) => {
    setClientForm((prev) => ({
      ...prev,
      custom_platform_responses: {
        ...prev.custom_platform_responses,
        [`${platformId}_${fieldName}`]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/oauth/client-onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agency_token: agencyToken,
          client_info: clientForm,
          selected_platforms: selectedPlatforms,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit onboarding request");
      }

      const data = await response.json();
      setSubmitted(true);
      toast.success("Onboarding request submitted successfully!");
      
    } catch (error) {
      console.error("Error submitting onboarding:", error);
      toast.error("Failed to submit onboarding request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading onboarding...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Unable to Load Onboarding
                </h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Please contact your agency for a new onboarding link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!agencyConfig) {
    return <Navigate to="/" replace />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Onboarding Request Submitted!
                </h2>
                <p className="text-muted-foreground">
                  Thank you for submitting your onboarding request. 
                  {agencyConfig.branding.company_name} will contact you soon to complete the platform connections.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">What happens next?</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Your agency will review your information</li>
                  <li>• They will guide you through connecting your selected platforms</li>
                  <li>• You'll receive access to your marketing dashboard</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-background"
      style={{ 
        background: `linear-gradient(135deg, ${agencyConfig.branding.primary_color}10 0%, ${agencyConfig.branding.primary_color}05 100%)` 
      }}
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {agencyConfig.branding.logo_url ? (
              <img
                src={agencyConfig.branding.logo_url}
                alt={agencyConfig.branding.company_name}
                className="h-12 w-auto max-w-48 object-contain"
              />
            ) : (
              <div 
                className="flex h-12 w-12 items-center justify-center rounded-lg text-white shadow-lg"
                style={{ backgroundColor: agencyConfig.branding.primary_color }}
              >
                <Building2 className="h-6 w-6" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to {agencyConfig.branding.company_name}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your marketing platforms to get started with professional digital marketing services
          </p>
        </div>

        {/* Instructions */}
        {agencyConfig.instructions && (
          <Alert className="max-w-4xl mx-auto mb-8">
            <Info className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">
              {agencyConfig.instructions}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Form */}
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: agencyConfig.branding.primary_color }} />
              Platform Connection Request
            </CardTitle>
            <CardDescription>
              Fill out your information and select the platforms you'd like {agencyConfig.branding.company_name} to manage for you.
              Your information is secure and will only be used to set up your marketing services.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Your Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={clientForm.name}
                      onChange={(e) =>
                        setClientForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="John Smith"
                      className={formErrors.name ? "border-red-500" : ""}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-500">{formErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={clientForm.email}
                      onChange={(e) =>
                        setClientForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="john@company.com"
                      className={formErrors.email ? "border-red-500" : ""}
                    />
                    {formErrors.email && (
                      <p className="text-sm text-red-500">{formErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      value={clientForm.company}
                      onChange={(e) =>
                        setClientForm((prev) => ({ ...prev, company: e.target.value }))
                      }
                      placeholder="Your Company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={clientForm.phone}
                      onChange={(e) =>
                        setClientForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Platform Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Platform Connections</h3>
                  {formErrors.platforms && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {formErrors.platforms}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Select the platforms you'd like {agencyConfig.branding.company_name} to connect and manage for you.
                  You'll maintain ownership and can revoke access at any time.
                </p>

                {/* Standard Platforms */}
                {agencyConfig.selected_platforms.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Marketing Platforms</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {agencyConfig.selected_platforms.map((platform) => (
                        <div
                          key={platform}
                          className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            id={platform}
                            checked={selectedPlatforms.includes(platform)}
                            onCheckedChange={(checked) =>
                              handlePlatformToggle(platform, checked as boolean)
                            }
                          />
                          <div className="flex-1 space-y-1">
                            <Label
                              htmlFor={platform}
                              className="font-medium cursor-pointer"
                            >
                              {PLATFORM_DISPLAY_NAMES[platform as keyof typeof PLATFORM_DISPLAY_NAMES]}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {PLATFORM_DESCRIPTIONS[platform as keyof typeof PLATFORM_DESCRIPTIONS]}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              {agencyConfig.access_level === "read_only" ? "Read-only access" : "Full management access"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Platforms */}
                {customPlatforms.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Additional Platforms</h4>
                    <div className="space-y-4">
                      {customPlatforms.map((platform) => (
                        <div key={platform.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={`custom_${platform.id}`}
                              checked={selectedPlatforms.includes(platform.id)}
                              onCheckedChange={(checked) =>
                                handlePlatformToggle(platform.id, checked as boolean)
                              }
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`custom_${platform.id}`}
                                className="font-medium cursor-pointer flex items-center gap-2"
                              >
                                {platform.icon_url && (
                                  <img
                                    src={platform.icon_url}
                                    alt={platform.name}
                                    className="w-5 h-5 object-contain"
                                  />
                                )}
                                {platform.name}
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {platform.description}
                              </p>
                              {platform.instructions && (
                                <p className="text-sm text-blue-600 mt-2">
                                  <strong>Instructions:</strong> {platform.instructions}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Custom Platform Fields */}
                          {selectedPlatforms.includes(platform.id) && platform.fields.length > 0 && (
                            <div className="ml-6 pl-4 border-l space-y-3">
                              <p className="text-sm font-medium">Required Information:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {platform.fields.map((field) => (
                                  <div key={field.name} className="space-y-2">
                                    <Label htmlFor={`${platform.id}_${field.name}`}>
                                      {field.label} {field.required && "*"}
                                    </Label>
                                    {field.type === "select" ? (
                                      <select
                                        id={`${platform.id}_${field.name}`}
                                        value={clientForm.custom_platform_responses[`${platform.id}_${field.name}`] || ""}
                                        onChange={(e) =>
                                          handleCustomFieldChange(platform.id, field.name, e.target.value)
                                        }
                                        className="w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
                                      >
                                        <option value="">Select...</option>
                                        {field.options?.map((option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </select>
                                    ) : field.type === "textarea" ? (
                                      <textarea
                                        id={`${platform.id}_${field.name}`}
                                        value={clientForm.custom_platform_responses[`${platform.id}_${field.name}`] || ""}
                                        onChange={(e) =>
                                          handleCustomFieldChange(platform.id, field.name, e.target.value)
                                        }
                                        placeholder={field.placeholder}
                                        className="min-h-[80px] w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
                                      />
                                    ) : field.type === "checkbox" ? (
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`${platform.id}_${field.name}`}
                                          checked={clientForm.custom_platform_responses[`${platform.id}_${field.name}`] || false}
                                          onCheckedChange={(checked) =>
                                            handleCustomFieldChange(platform.id, field.name, checked)
                                          }
                                        />
                                        <Label htmlFor={`${platform.id}_${field.name}`} className="text-sm">
                                          {field.placeholder || "Yes"}
                                        </Label>
                                      </div>
                                    ) : (
                                      <Input
                                        id={`${platform.id}_${field.name}`}
                                        type={field.type}
                                        value={clientForm.custom_platform_responses[`${platform.id}_${field.name}`] || ""}
                                        onChange={(e) =>
                                          handleCustomFieldChange(platform.id, field.name, e.target.value)
                                        }
                                        placeholder={field.placeholder}
                                        className={formErrors[`custom_${platform.id}_${field.name}`] ? "border-red-500" : ""}
                                      />
                                    )}
                                    {formErrors[`custom_${platform.id}_${field.name}`] && (
                                      <p className="text-sm text-red-500">
                                        {formErrors[`custom_${platform.id}_${field.name}`]}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Security Notice */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Your data is secure:</strong> {agencyConfig.branding.company_name} will only access the platforms you select. 
                  You maintain full ownership of your accounts and can revoke access at any time.
                </AlertDescription>
              </Alert>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-lg"
                style={{ backgroundColor: agencyConfig.branding.primary_color }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    Submit Connection Request
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            Powered by {agencyConfig.branding.company_name} • 
            Your information is protected and secure
          </p>
        </div>
      </div>
    </div>
  );
}
