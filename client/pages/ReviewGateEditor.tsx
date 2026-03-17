import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import {
  Save,
  Eye,
  ExternalLink,
  Copy,
  Star,
  Building2,
  Link,
  FileText,
  Settings2,
  ImageIcon,
  Video,
  RefreshCw,
  CheckCircle,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

// ── Settings shape ────────────────────────────────────────────────────────────
interface ReviewGateSettings {
  businessName: string;
  businessLogo: string;
  city: string;
  state: string;
  address: string;
  googleReviewUrl: string;
  reviewGateHeading: string;
  projectName: string;
  projectDescription: string;
  reviewGateThreshold: number;
  reviewGateSeoKeywords: string;
  serviceCategory: string;
  reviewGateVideoUrl: string;
  reviewGateThankYouMessage: string;
  reviewGateButtonText: string;
}

const DEFAULTS: ReviewGateSettings = {
  businessName: "Smith Construction LLC",
  businessLogo: "",
  city: "Springfield",
  state: "Illinois",
  address: "123 Main St, Springfield, IL 62701",
  googleReviewUrl: "https://g.page/r/CdWWUaI_IBAoEBM/review",
  reviewGateHeading: "How did we do?",
  projectName: "Kitchen Renovation",
  projectDescription:
    "Complete kitchen remodel with custom cabinets and granite countertops",
  reviewGateThreshold: 4,
  reviewGateSeoKeywords: "kitchen renovation, custom cabinets, home remodeling, Springfield contractor",
  serviceCategory: "Home Renovation",
  reviewGateVideoUrl: "",
  reviewGateThankYouMessage: "",
  reviewGateButtonText: "Submit My Review",
};

// ── Live Preview Component ────────────────────────────────────────────────────
function ReviewGatePreview({ s }: { s: ReviewGateSettings }) {
  const [previewRating, setPreviewRating] = useState(0);
  const [previewText, setPreviewText] = useState("");

  const isHighRating = previewRating >= s.reviewGateThreshold;
  const keywords = s.reviewGateSeoKeywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-[480px] mx-auto py-6">

        {/* Business Header */}
        <div className="text-center mb-6">
          {s.businessLogo ? (
            <img
              src={s.businessLogo}
              alt={s.businessName}
              className="h-14 w-14 rounded-lg object-cover mx-auto mb-3 ring-2 ring-blue-100"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-3 ring-2 ring-blue-100">
              <Building2 className="h-7 w-7 text-blue-400" />
            </div>
          )}
          <h1 className="text-xl font-semibold text-gray-900 mb-4">
            {s.businessName || "Your Business"}
          </h1>

          {/* Project Card */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-1 text-sm">
              {s.projectName || "Project Name"}
            </h3>
            <p className="text-gray-600 text-xs leading-relaxed">
              {s.projectDescription || "Project description will appear here."}
            </p>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">
            {s.reviewGateHeading || "How did we do?"}
          </h2>
        </div>

        {/* Video (if set) */}
        {s.reviewGateVideoUrl && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100 mb-6">
            <p className="text-xs font-medium text-blue-900 text-center mb-2">
              A Message from {s.businessName}
            </p>
            <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
              <Video className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        )}

        {/* Review Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-100">
          <div className="space-y-5">

            {/* Stars */}
            <div className="text-center">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Please rate your experience
              </p>
              <p className="text-xs text-blue-700 mb-3">
                Click the stars below to rate your experience from 1 to 5 stars
              </p>
              <StarRating
                rating={previewRating}
                onRatingChange={setPreviewRating}
                size="lg"
                className="justify-center mb-3"
              />

              {previewRating > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-blue-900 text-xs font-medium">
                    {previewRating === 1 && "We're sorry to hear that. We'd love to make this right."}
                    {previewRating === 2 && "Thank you for the feedback. How can we improve?"}
                    {previewRating === 3 && "Thanks for your feedback. Tell us more about your experience."}
                    {previewRating === 4 && "Great! We're glad you had a good experience."}
                    {previewRating === 5 && "Excellent! We're thrilled you loved our service."}
                  </p>
                </div>
              )}
            </div>

            {/* Text input */}
            {previewRating > 0 && (
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-2">
                  Tell us about your experience:
                </label>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="Share details about your experience..."
                  className="w-full min-h-[80px] text-sm border border-blue-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            )}

            {/* High-rating action */}
            {isHighRating && previewText.trim() && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <h4 className="text-xs font-semibold text-blue-900 mb-1">
                  ✨ Enhanced Version of Your Review
                </h4>
                <p className="text-xs text-blue-700 mb-3">
                  We've enhanced your review with location details and service keywords
                  that help other customers in {s.city} find {s.businessName}.
                </p>
                <div className="bg-white p-3 rounded-lg border border-blue-200 text-xs mb-3 shadow-sm text-gray-700">
                  {previewText} — {s.businessName} in {s.city}, {s.state} truly excels
                  at {s.serviceCategory.toLowerCase()}.{" "}
                  {keywords[0] && `Their ${keywords[0]} expertise made this experience exceptional.`}
                </div>
                <button className="w-full bg-blue-600 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copy Enhanced &amp; Continue to Google
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button className="w-full mt-2 border border-blue-300 text-blue-700 text-xs py-2 rounded-lg font-medium">
                  Use Original &amp; Continue to Google
                </button>
              </div>
            )}

            {/* Low-rating submit */}
            {previewRating > 0 && !isHighRating && (
              <button className="w-full bg-blue-600 text-white text-sm py-2.5 rounded-lg font-medium">
                {s.reviewGateButtonText || "Submit My Review"}
              </button>
            )}
          </div>
        </div>

        {/* Thank you message preview */}
        {s.reviewGateThankYouMessage && (
          <p className="text-center text-xs text-gray-500 mt-4 px-4">
            After submit: &ldquo;{s.reviewGateThankYouMessage}&rdquo;
          </p>
        )}

        {/* Threshold indicator */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <p className="text-xs text-gray-400">
            {s.reviewGateThreshold}+ stars → redirects to Google ·{" "}
            below → captures feedback internally
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 bg-primary/10 rounded-md">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
    </div>
  );
}

// ── Field Component ───────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Main Editor Page ──────────────────────────────────────────────────────────
export default function ReviewGateEditor() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ReviewGateSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("business_settings");
      if (raw) {
        const saved = JSON.parse(raw);
        setSettings({
          businessName: saved.businessName || DEFAULTS.businessName,
          businessLogo: saved.reviewGateLogoUrl || saved.businessLogo || DEFAULTS.businessLogo,
          city: saved.city || DEFAULTS.city,
          state: saved.state || DEFAULTS.state,
          address: saved.address || DEFAULTS.address,
          googleReviewUrl: saved.reviewGateGoogleUrl || saved.googleBusinessUrl || DEFAULTS.googleReviewUrl,
          reviewGateHeading: saved.reviewGateHeading || DEFAULTS.reviewGateHeading,
          projectName: saved.projectName || DEFAULTS.projectName,
          projectDescription: saved.projectDescription || DEFAULTS.projectDescription,
          reviewGateThreshold: saved.reviewGateThreshold ?? DEFAULTS.reviewGateThreshold,
          reviewGateSeoKeywords: saved.reviewGateSeoKeywords || DEFAULTS.reviewGateSeoKeywords,
          serviceCategory: saved.businessTypes?.[0] || saved.serviceCategory || DEFAULTS.serviceCategory,
          reviewGateVideoUrl: saved.reviewGateVideoUrl || DEFAULTS.reviewGateVideoUrl,
          reviewGateThankYouMessage: saved.reviewGateThankYouMessage || DEFAULTS.reviewGateThankYouMessage,
          reviewGateButtonText: saved.reviewGateButtonText || DEFAULTS.reviewGateButtonText,
        });
      }
    } catch {
      // keep defaults
    }
  }, []);

  const update = useCallback(<K extends keyof ReviewGateSettings>(
    key: K,
    value: ReviewGateSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Merge with existing settings to avoid wiping unrelated fields
      let existing: Record<string, any> = {};
      try {
        const raw = localStorage.getItem("business_settings");
        if (raw) existing = JSON.parse(raw);
      } catch {}

      const merged = {
        ...existing,
        businessName: settings.businessName,
        reviewGateLogoUrl: settings.businessLogo,
        city: settings.city,
        state: settings.state,
        address: settings.address,
        reviewGateGoogleUrl: settings.googleReviewUrl,
        googleBusinessUrl: settings.googleReviewUrl,
        reviewGateHeading: settings.reviewGateHeading,
        projectName: settings.projectName,
        projectDescription: settings.projectDescription,
        reviewGateThreshold: settings.reviewGateThreshold,
        reviewGateSeoKeywords: settings.reviewGateSeoKeywords,
        serviceCategory: settings.serviceCategory,
        reviewGateVideoUrl: settings.reviewGateVideoUrl,
        reviewGateThankYouMessage: settings.reviewGateThankYouMessage,
        reviewGateButtonText: settings.reviewGateButtonText,
      };

      localStorage.setItem("business_settings", JSON.stringify(merged));
      setHasChanges(false);
      toast.success("Review gate settings saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    setHasChanges(true);
    toast.info("Reset to default values — click Save to apply.");
  };

  return (
    <AppLayout>
      {/* Top bar */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-semibold text-base">Review Gate Editor</h1>
              <p className="text-xs text-muted-foreground">
                Edit your customer review page — preview updates live
              </p>
            </div>
            {hasChanges && (
              <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/review-demo")}
              className="gap-1.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              Full Preview
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden">

        {/* ── LEFT PANEL: Editor ── */}
        <div className="w-[380px] flex-shrink-0 border-r overflow-y-auto bg-background">
          <div className="p-5 space-y-7">

            {/* Business Details */}
            <div>
              <SectionHeader icon={Building2} title="Business Details" />
              <div className="space-y-4">
                <Field label="Business Name">
                  <Input
                    value={settings.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                    placeholder="Your Business Name"
                  />
                </Field>
                <Field label="Logo URL" hint="Paste a direct image URL (leave blank to show icon)">
                  <Input
                    value={settings.businessLogo}
                    onChange={(e) => update("businessLogo", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <Input
                      value={settings.city}
                      onChange={(e) => update("city", e.target.value)}
                      placeholder="Springfield"
                    />
                  </Field>
                  <Field label="State">
                    <Input
                      value={settings.state}
                      onChange={(e) => update("state", e.target.value)}
                      placeholder="Illinois"
                    />
                  </Field>
                </div>
                <Field label="Service Category" hint="Shown in SEO-enhanced reviews">
                  <Input
                    value={settings.serviceCategory}
                    onChange={(e) => update("serviceCategory", e.target.value)}
                    placeholder="Home Renovation"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Page Content */}
            <div>
              <SectionHeader icon={FileText} title="Page Content" />
              <div className="space-y-4">
                <Field label="Main Heading">
                  <Input
                    value={settings.reviewGateHeading}
                    onChange={(e) => update("reviewGateHeading", e.target.value)}
                    placeholder="How did we do?"
                  />
                </Field>
                <Field label="Project / Job Name">
                  <Input
                    value={settings.projectName}
                    onChange={(e) => update("projectName", e.target.value)}
                    placeholder="Kitchen Renovation"
                  />
                </Field>
                <Field label="Project Description">
                  <Textarea
                    value={settings.projectDescription}
                    onChange={(e) => update("projectDescription", e.target.value)}
                    placeholder="Describe the work completed for this customer…"
                    className="min-h-[80px] resize-none"
                  />
                </Field>
                <Field
                  label="Submit Button Text"
                  hint="Button shown for low-rating (private) submissions"
                >
                  <Input
                    value={settings.reviewGateButtonText}
                    onChange={(e) => update("reviewGateButtonText", e.target.value)}
                    placeholder="Submit My Review"
                  />
                </Field>
                <Field
                  label="Thank You Message"
                  hint="Shown after a low-rating feedback is submitted (optional)"
                >
                  <Textarea
                    value={settings.reviewGateThankYouMessage}
                    onChange={(e) => update("reviewGateThankYouMessage", e.target.value)}
                    placeholder="Thank you for your feedback. We appreciate your honesty…"
                    className="min-h-[70px] resize-none"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Review Settings */}
            <div>
              <SectionHeader icon={Star} title="Review Settings" />
              <div className="space-y-5">
                <Field
                  label={`Star Threshold: ${settings.reviewGateThreshold} stars`}
                  hint={`${settings.reviewGateThreshold}+ stars → redirect to Google · below → capture feedback privately`}
                >
                  <div className="pt-1 pb-2">
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[settings.reviewGateThreshold]}
                      onValueChange={([v]) => update("reviewGateThreshold", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={n === settings.reviewGateThreshold ? "font-semibold text-primary" : ""}>
                          {n}★
                        </span>
                      ))}
                    </div>
                  </div>
                </Field>

                <Field label="Google Review URL" hint="Customers with high ratings are sent here">
                  <Input
                    value={settings.googleReviewUrl}
                    onChange={(e) => update("googleReviewUrl", e.target.value)}
                    placeholder="https://g.page/r/your-review-link"
                  />
                </Field>

                <Field
                  label="SEO Keywords"
                  hint="Comma-separated — used to enhance reviews for better local search visibility"
                >
                  <Textarea
                    value={settings.reviewGateSeoKeywords}
                    onChange={(e) => update("reviewGateSeoKeywords", e.target.value)}
                    placeholder="kitchen renovation, custom cabinets, home remodeling"
                    className="min-h-[70px] resize-none"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Advanced */}
            <div>
              <SectionHeader icon={Video} title="Optional Video Message" />
              <div className="space-y-4">
                <Field
                  label="Business Owner Video URL"
                  hint="Direct link to an MP4 video file. Leave blank to hide the video section."
                >
                  <Input
                    value={settings.reviewGateVideoUrl}
                    onChange={(e) => update("reviewGateVideoUrl", e.target.value)}
                    placeholder="https://example.com/video.mp4"
                  />
                </Field>
              </div>
            </div>

            {/* Save at bottom too */}
            <div className="pt-2 pb-4">
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Live Preview ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {/* Preview header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Live Preview — updates as you type</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => navigate("/review-demo")}
            >
              <Eye className="h-3.5 w-3.5" />
              Open full page
            </Button>
          </div>

          {/* Preview content */}
          <div className="flex-1 overflow-y-auto">
            <ReviewGatePreview s={settings} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
