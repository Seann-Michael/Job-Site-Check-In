import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StarRating } from "@/components/StarRating";
import {
  Save,
  Eye,
  ExternalLink,
  Copy,
  Star,
  Building2,
  FileText,
  Video,
  RefreshCw,
  Smartphone,
  Upload,
  X,
  Youtube,
  Film,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import { workspaceService } from "@/lib/workspaceService";

// ── Video helpers ─────────────────────────────────────────────────────────────

/** Extract the src attribute from a raw <iframe ...> embed code string. */
function extractIframeSrc(input: string): string | null {
  if (!input || !input.trim().startsWith("<")) return null;
  const match = input.match(/src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  // youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return watchMatch[1];
  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/embed/ID  (already an embed URL or from iframe src)
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&#]+)/);
  if (embedMatch) return embedMatch[1];
  return null;
}

function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|ogg|avi)($|\?)/i.test(url);
}

/**
 * Resolve whatever the user pasted (watch URL, short URL, iframe code, direct
 * file URL) into a renderable embed URL or a direct src string.
 * Returns { type: "iframe" | "video", src }.
 */
function resolveVideoInput(raw: string): { type: "iframe" | "video"; src: string } | null {
  if (!raw) return null;

  // 1. Raw <iframe> embed code → extract src directly
  const iframeSrc = extractIframeSrc(raw);
  if (iframeSrc) return { type: "iframe", src: iframeSrc };

  // 2. YouTube watch / short / embed URL → convert to embed
  const ytEmbed = getYouTubeEmbedUrl(raw);
  if (ytEmbed) return { type: "iframe", src: ytEmbed };

  // 3. Direct video file or Supabase storage URL
  if (isDirectVideoUrl(raw) || raw.startsWith("blob:") || raw.includes("supabase")) {
    return { type: "video", src: raw };
  }

  // 4. Any other URL — try as a video src
  return { type: "video", src: raw };
}

// ── VideoEmbed — renders correctly for any supported input ────────────────────
function VideoEmbed({ url }: { url: string }) {
  const resolved = resolveVideoInput(url);
  if (!resolved) return null;

  if (resolved.type === "iframe") {
    return (
      <iframe
        src={resolved.src}
        className="w-full rounded-lg aspect-video"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        title="Business owner video"
      />
    );
  }

  return (
    <video controls className="w-full rounded-lg aspect-video bg-black">
      <source src={resolved.src} />
      Your browser does not support the video tag.
    </video>
  );
}

// ── VideoUploader ─────────────────────────────────────────────────────────────
function VideoUploader({
  onUpload,
  onClear,
  currentUrl,
}: {
  onUpload: (url: string) => void;
  onClear: () => void;
  currentUrl: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4, WebM, or MOV)");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File must be under 100 MB");
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);

    setUploading(true);
    setProgress(10);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `review-gate-videos/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      setProgress(30);
      const { error } = await supabaseClient.storage
        .from("media")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) throw error;
      setProgress(80);

      const {
        data: { publicUrl },
      } = supabaseClient.storage.from("media").getPublicUrl(path);

      setProgress(100);
      onUpload(publicUrl);
      toast.success("Video uploaded!");
    } catch (err: any) {
      toast.error("Upload failed: " + (err?.message ?? "Unknown error"));
      setLocalPreview(null);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative border-2 border-dashed rounded-lg transition-colors ${
          uploading
            ? "border-primary/40 bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 cursor-pointer"
        }`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/ogg"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
        <div className="flex flex-col items-center gap-2 p-5 text-center">
          <div className="p-2 bg-muted rounded-full">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium">
              {uploading ? "Uploading…" : "Click or drag a video file here"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              MP4, WebM, MOV · max 100 MB
            </p>
          </div>
        </div>
        {uploading && (
          <div className="px-4 pb-4">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}

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
  reviewGateIframeCode: string;
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
  reviewGateIframeCode: "",
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

        {/* Iframe / Video embed (if set) */}
        {(s.reviewGateIframeCode || s.reviewGateVideoUrl) && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100 mb-6">
            <p className="text-xs font-medium text-blue-900 text-center mb-2">
              A Message from {s.businessName}
            </p>
            {s.reviewGateIframeCode
              ? <IframeEmbed code={s.reviewGateIframeCode} />
              : <VideoEmbed url={s.reviewGateVideoUrl} />}
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

// ── IframeEmbed — safely renders a pasted <iframe> embed code ───────────────
function IframeEmbed({ code }: { code: string }) {
  const src = extractIframeSrc(code);
  if (!src) {
    return (
      <div className="w-full rounded-lg aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">
        Invalid embed code — make sure it contains a src attribute.
      </div>
    );
  }
  return (
    <iframe
      src={src}
      className="w-full rounded-lg aspect-video"
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      title="Custom embed"
    />
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

  // Load from Supabase (businesses.settings) with localStorage cache fallback
  useEffect(() => {
    const applySettings = (s: Record<string, any>, bizName?: string) => {
      setSettings({
        businessName: bizName || s.businessName || DEFAULTS.businessName,
        businessLogo: s.reviewGateLogoUrl || s.businessLogo || DEFAULTS.businessLogo,
        city: s.city || DEFAULTS.city,
        state: s.state || DEFAULTS.state,
        address: s.address || DEFAULTS.address,
        googleReviewUrl: s.reviewGateGoogleUrl || s.googleBusinessUrl || DEFAULTS.googleReviewUrl,
        reviewGateHeading: s.reviewGateHeading || DEFAULTS.reviewGateHeading,
        projectName: s.projectName || DEFAULTS.projectName,
        projectDescription: s.projectDescription || DEFAULTS.projectDescription,
        reviewGateThreshold: s.reviewGateThreshold ?? DEFAULTS.reviewGateThreshold,
        reviewGateSeoKeywords: s.reviewGateSeoKeywords || DEFAULTS.reviewGateSeoKeywords,
        serviceCategory: s.businessTypes?.[0] || s.serviceCategory || DEFAULTS.serviceCategory,
        reviewGateVideoUrl: s.reviewGateVideoUrl || DEFAULTS.reviewGateVideoUrl,
        reviewGateIframeCode: s.reviewGateIframeCode || DEFAULTS.reviewGateIframeCode,
        reviewGateThankYouMessage: s.reviewGateThankYouMessage || DEFAULTS.reviewGateThankYouMessage,
        reviewGateButtonText: s.reviewGateButtonText || DEFAULTS.reviewGateButtonText,
      });
    };

    const load = async () => {
      // 1. Try Supabase first
      try {
        let wsState = workspaceService.getState();
        if (!wsState.initialized) wsState = await workspaceService.initialize();
        if (wsState.currentBusinessId) {
          const { data: biz } = await supabaseClient
            .from("businesses")
            .select("name, settings")
            .eq("id", wsState.currentBusinessId)
            .single();
          if (biz) {
            applySettings((biz.settings || {}) as Record<string, any>, biz.name);
            return;
          }
        }
      } catch {
        // fall through to localStorage cache
      }

      // 2. localStorage cache fallback
      try {
        const raw = localStorage.getItem("business_settings");
        if (raw) applySettings(JSON.parse(raw));
      } catch {
        // keep defaults
      }
    };

    load();
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
      const patch: Record<string, any> = {
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
        reviewGateIframeCode: settings.reviewGateIframeCode,
        reviewGateThankYouMessage: settings.reviewGateThankYouMessage,
        reviewGateButtonText: settings.reviewGateButtonText,
      };

      // 1. Persist to Supabase (primary)
      let savedToSupabase = false;
      try {
        let wsState = workspaceService.getState();
        if (!wsState.initialized) wsState = await workspaceService.initialize();
        if (wsState.currentBusinessId) {
          const { data: biz } = await supabaseClient
            .from("businesses")
            .select("settings")
            .eq("id", wsState.currentBusinessId)
            .single();
          const merged = { ...(biz?.settings || {}), ...patch };
          const { error } = await supabaseClient
            .from("businesses")
            .update({ settings: merged, updated_at: new Date().toISOString() })
            .eq("id", wsState.currentBusinessId);
          if (error) throw error;
          savedToSupabase = true;
        }
      } catch (err) {
        console.error("[ReviewGateEditor] Supabase save failed:", err);
      }

      // 2. Keep localStorage in sync as a fast-read cache
      let existing: Record<string, any> = {};
      try {
        const raw = localStorage.getItem("business_settings");
        if (raw) existing = JSON.parse(raw);
      } catch {}
      localStorage.setItem("business_settings", JSON.stringify({ ...existing, ...patch }));

      setHasChanges(false);
      toast.success(savedToSupabase ? "Review gate settings saved!" : "Settings saved locally (Supabase unavailable).");
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

            {/* Video */}
            <div>
              <SectionHeader icon={Video} title="Business Owner Video (Optional)" />
              <div className="space-y-4">

                {/* Current video preview (small) */}
                {settings.reviewGateVideoUrl && (
                  <div className="rounded-lg overflow-hidden border border-border relative">
                    <VideoEmbed url={settings.reviewGateVideoUrl} />
                    <button
                      onClick={() => update("reviewGateVideoUrl", "")}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Remove video"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* YouTube / iframe / URL input */}
                <Field
                  label="Paste a video URL or embed code"
                  hint={
                    extractIframeSrc(settings.reviewGateVideoUrl)
                      ? "✓ Iframe embed code detected — will render directly"
                      : getYouTubeVideoId(settings.reviewGateVideoUrl)
                      ? "✓ YouTube video detected — will embed automatically"
                      : "YouTube URL, YouTube iframe embed code, or direct MP4/WebM link"
                  }
                >
                  <div className="relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                      {extractIframeSrc(settings.reviewGateVideoUrl) || getYouTubeVideoId(settings.reviewGateVideoUrl)
                        ? <Youtube className="h-4 w-4 text-red-500" />
                        : <Film className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <Input
                      value={settings.reviewGateVideoUrl}
                      onChange={(e) => update("reviewGateVideoUrl", e.target.value)}
                      placeholder='https://youtube.com/watch?v=... or paste <iframe src="..."> embed code'
                      className="pl-8"
                    />
                  </div>
                </Field>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or upload a file</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* File uploader */}
                <VideoUploader
                  currentUrl={settings.reviewGateVideoUrl}
                  onUpload={(url) => update("reviewGateVideoUrl", url)}
                  onClear={() => update("reviewGateVideoUrl", "")}
                />
              </div>
            </div>

            <Separator />

            {/* Custom iframe embed */}
            <div>
              <SectionHeader icon={Code} title="Custom Iframe Embed (Optional)" />
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Paste any <code className="bg-muted px-1 rounded">&lt;iframe&gt;</code> embed code here — YouTube, Loom, Vimeo, or any other platform.
                  This takes priority over the video URL above.
                </p>

                {/* Live preview of pasted iframe */}
                {settings.reviewGateIframeCode && extractIframeSrc(settings.reviewGateIframeCode) && (
                  <div className="rounded-lg overflow-hidden border border-border relative">
                    <IframeEmbed code={settings.reviewGateIframeCode} />
                    <button
                      onClick={() => update("reviewGateIframeCode", "")}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Remove embed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <Field
                  label="Paste iframe embed code"
                  hint={
                    extractIframeSrc(settings.reviewGateIframeCode)
                      ? `✓ Valid embed detected — src: ${extractIframeSrc(settings.reviewGateIframeCode)!.slice(0, 50)}…`
                      : settings.reviewGateIframeCode
                      ? "⚠ Could not find a src attribute in the embed code"
                      : 'Example: <iframe src="https://..." allowfullscreen></iframe>'
                  }
                >
                  <Textarea
                    value={settings.reviewGateIframeCode}
                    onChange={(e) => update("reviewGateIframeCode", e.target.value)}
                    placeholder={'<iframe src="https://www.youtube.com/embed/VIDEO_ID" title="..." frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'}
                    className="min-h-[90px] resize-none font-mono text-xs"
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
