import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, CheckCircle, ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import { workspaceService } from "@/lib/workspaceService";

// ── Video helpers ─────────────────────────────────────────────────────────────
function extractIframeSrc(input: string): string | null {
  if (!input || !input.trim().startsWith("<")) return null;
  const match = input.match(/src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&#]+)/);
  if (embedMatch) return embedMatch[1];
  return null;
}

function VideoPlayer({ src }: { src: string }) {
  // 1. Raw <iframe> embed code — extract src and use directly
  const iframeSrc = extractIframeSrc(src);
  if (iframeSrc) {
    return (
      <iframe
        src={iframeSrc}
        className="w-full rounded-lg aspect-video"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        title="Business owner video"
      />
    );
  }

  // 2. YouTube watch / short URL — convert to embed
  const ytId = getYouTubeVideoId(src);
  if (ytId) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytId}`}
        className="w-full rounded-lg aspect-video"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        title="Business owner video"
      />
    );
  }

  // 3. Direct video file
  return (
    <video controls className="w-full rounded-lg shadow-lg bg-black aspect-video">
      <source src={src} type="video/mp4" />
      <source src={src} />
      Your browser does not support the video tag.
    </video>
  );
}

interface ReviewRequest {
  id: string;
  businessName: string;
  businessLogo?: string;
  businessAddress: string;
  customerName: string;
  projectName: string;
  projectDescription: string;
  threshold: number;
  googleReviewUrl: string;
  businessCity: string;
  businessState: string;
  serviceCategory: string;
  businessOwnerVideo?: string;
  iframeCode?: string;
}

export default function ReviewGate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // `/review/preview` (or no id) is the authenticated admin previewing their
  // own business's gate. Real customers always arrive with a request UUID.
  const isAdminPreview = !id || id === "preview";
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  // Set only when the id resolved to a real review_requests row, so
  // submissions can be attributed to the right business and request.
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [remoteRequestId, setRemoteRequestId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [redirectToGoogle, setRedirectToGoogle] = useState(false);
  const [gateSettings, setGateSettings] = useState<{
    heading: string;
    thankYouMessage: string;
    buttonText: string;
  }>({
    heading: "How did we do?",
    thankYouMessage: "",
    buttonText: "Submit My Review",
  });

  useEffect(() => {
    const buildFromSettings = (
      saved: Record<string, any>,
      requestId: string,
      customerName?: string,
      projectName?: string,
    ) => {
      const request: ReviewRequest = {
        id: requestId,
        businessName: saved.businessName || "",
        businessLogo: saved.reviewGateLogoUrl || saved.businessLogo || undefined,
        businessAddress:
          [saved.address, saved.city, saved.state].filter(Boolean).join(", ") ||
          "",
        customerName: customerName || "Valued Customer",
        projectName: projectName || saved.projectName || "",
        projectDescription: saved.projectDescription || "",
        threshold: saved.reviewGateThreshold ?? 4,
        googleReviewUrl:
          saved.reviewGateGoogleUrl || saved.googleBusinessUrl || "",
        businessCity: saved.city || "",
        businessState: saved.state || "",
        serviceCategory:
          saved.businessTypes?.[0] || saved.serviceCategory || "",
        businessOwnerVideo: saved.reviewGateVideoUrl || undefined,
        iframeCode: saved.reviewGateIframeCode || undefined,
      };

      setGateSettings({
        heading: saved.reviewGateHeading || "How did we do?",
        thankYouMessage: saved.reviewGateThankYouMessage || "",
        buttonText: saved.reviewGateButtonText || "Submit My Review",
      });

      setReviewRequest(request);
    };

    const loadBusiness = async (bizId: string) => {
      const { data: biz, error } = await supabaseClient
        .from("businesses")
        .select("name, settings, address")
        .eq("id", bizId)
        .maybeSingle();
      if (error || !biz) return null;
      const addr = (biz.address || {}) as Record<string, any>;
      return {
        ...(biz.settings || {}),
        businessName: biz.name,
        address: (biz.settings as any)?.address ?? addr.street ?? addr.address,
        city: (biz.settings as any)?.city ?? addr.city,
        state: (biz.settings as any)?.state ?? addr.state,
      } as Record<string, any>;
    };

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        if (isAdminPreview) {
          // Admin preview: current workspace business
          await workspaceService.whenReady();
          const bizId = workspaceService.getCurrentBusinessId();
          const settings = bizId ? await loadBusiness(bizId) : null;
          if (!settings) {
            setNotFound(true);
            return;
          }
          setBusinessId(bizId);
          buildFromSettings(settings, "preview");
          return;
        }

        const { data: rows, error } = await supabaseClient.rpc(
          "review_request_public",
          { p_id: id },
        );

        const reviewReq = Array.isArray(rows) ? rows[0] : rows;
        if (error || !reviewReq?.business_id) {
          setNotFound(true);
          return;
        }

        // Record the open so both dashboards show a Viewed date.
        // Fire-and-forget: a failed write must never block the customer.
        supabaseClient
          .rpc("review_request_mark_viewed", { p_id: reviewReq.id })
          .then(
            () => undefined,
            () => undefined,
          );
        setRemoteRequestId(reviewReq.id);

        // Replicate loadBusiness's merge logic against the RPC row shape
        // (business_name / settings / address) since anon can no longer
        // select from the businesses table directly.
        const addr = (reviewReq.address || {}) as Record<string, any>;
        const rpcSettings = reviewReq.settings || {};
        const settings = {
          ...rpcSettings,
          businessName: reviewReq.business_name,
          address: rpcSettings.address ?? addr.street ?? addr.address,
          city: rpcSettings.city ?? addr.city,
          state: rpcSettings.state ?? addr.state,
        } as Record<string, any>;

        setBusinessId(reviewReq.business_id);
        buildFromSettings(
          settings,
          reviewReq.id,
          reviewReq.customer_name,
          reviewReq.project_name,
        );
      } catch (err) {
        console.error("Failed to load review request:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isAdminPreview]);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    setRedirectToGoogle(newRating >= (reviewRequest?.threshold || 4));
  };

  const copyToClipboard = async (text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Review copied to clipboard - paste it on Google!");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  /**
   * Records the submission in the shared reviews table so the dashboards can
   * show completions. The live review_requests status CHECK has no 'completed'
   * value, so the completion IS the reviews row — AdminReviews links it back
   * via metadata.review_request_id. Returns false when nothing was saved.
   */
  const recordSubmission = async (text: string, toGoogle: boolean) => {
    if (isAdminPreview) return true; // preview never writes
    try {
      const { error } = await supabaseClient.rpc("submit_gate_review", {
        p_request_id: remoteRequestId,
        p_rating: rating,
        p_title: reviewRequest?.projectName || null,
        p_text: text,
        p_author_name: reviewRequest?.customerName || "Customer",
        p_to_google: toGoogle,
      });
      return !error;
    } catch {
      return false;
    }
  };

  const handleSubmitFeedback = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const saved = await recordSubmission(reviewText, false);
    setIsSubmitting(false);
    if (!saved) {
      toast.error("We couldn't save your feedback. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  const handleGoogleRedirect = (text: string) => {
    void copyToClipboard(text);
    // Best-effort completion record — never blocks the customer's redirect
    void recordSubmission(text, true);
    setTimeout(() => {
      window.open(reviewRequest!.googleReviewUrl, "_blank");
      setSubmitted(true);
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-900">Loading review form...</p>
        </div>
      </div>
    );
  }

  if (notFound || !reviewRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 w-full max-w-md text-center">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">
            Review link not found
          </h2>
          <p className="text-blue-700">
            {isAdminPreview
              ? "No business is selected for this workspace, so there is nothing to preview."
              : "This review link is invalid or has expired. Please contact the business for a new link."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 w-full max-w-md text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-blue-900 mb-2">
            Thank You!
          </h2>
          {redirectToGoogle && reviewRequest.googleReviewUrl ? (
            <div className="space-y-3">
              <p className="text-blue-700">
                You'll be redirected to Google to complete your review.
              </p>
              <Badge className="bg-blue-100 text-blue-700 gap-1">
                <ExternalLink className="h-3 w-3" />
                Redirecting to Google...
              </Badge>
            </div>
          ) : (
            <p className="text-blue-700">
              {gateSettings.thankYouMessage ||
                "Your feedback has been recorded. We appreciate your input!"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {isAdminPreview && (
        <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-sm sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 flex-shrink-0" />
            <span className="font-semibold">Admin Preview</span>
            <span className="opacity-80 hidden sm:inline">&mdash; this banner is only visible to you, not your customers</span>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1.5 font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go Back
          </button>
        </div>
      )}
      <div className="p-4">
      <div className="max-w-xl mx-auto py-8">
        {/* Setup warning — only shown to the admin previewing the gate */}
        {isAdminPreview && !reviewRequest.googleReviewUrl && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 text-sm text-amber-800">
            <p className="font-semibold mb-1">Setup needed: no Google review link</p>
            <p>
              No Google review URL is configured for this business, so customers
              won't be sent to Google — their reviews will be recorded here
              instead. Add your Google review link in the Review Gate editor.
            </p>
          </div>
        )}

        {/* Business Header */}
        <div className="text-center mb-8">
          {reviewRequest.businessLogo && (
            <img
              src={reviewRequest.businessLogo}
              alt={`${reviewRequest.businessName} logo`}
              className="h-16 w-16 rounded-lg object-cover mx-auto mb-4 ring-2 ring-blue-100"
            />
          )}
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            {reviewRequest.businessName}
          </h1>

          <div className="bg-white rounded-xl p-5 shadow-md border border-blue-100 mb-8">
            <h3 className="font-semibold text-blue-900 mb-2">
              {reviewRequest.projectName}
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {reviewRequest.projectDescription}
            </p>
          </div>
        </div>

        {/* Main Question Heading */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-blue-900">{gateSettings.heading}</h2>
        </div>

        {/* Business Owner Video / Custom Iframe */}
        {(reviewRequest.iframeCode || reviewRequest.businessOwnerVideo) && (
          <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 mb-8">
            <div className="text-center mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                A Message from {reviewRequest.businessName}
              </h3>
            </div>
            <div className="max-w-lg mx-auto">
              {reviewRequest.iframeCode
                ? (() => {
                    const src = extractIframeSrc(reviewRequest.iframeCode!);
                    return src ? (
                      <iframe
                        src={src}
                        className="w-full rounded-lg aspect-video"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        title="A message from the business"
                      />
                    ) : null;
                  })()
                : <VideoPlayer src={reviewRequest.businessOwnerVideo!} />}
            </div>
          </div>
        )}

        {/* Review Form */}
        <div className="bg-white rounded-xl p-8 shadow-md border border-blue-100">
          <div className="space-y-6">
            {/* Star Rating */}
            <div className="text-center">
              <div className="mb-6">
                <p className="text-lg font-medium text-blue-900 mb-2">
                  Please rate your experience
                </p>
                <p className="text-sm text-blue-700">
                  Click the stars below to rate your experience from 1 to 5
                  stars
                </p>
              </div>
              <StarRating
                rating={rating}
                onRatingChange={handleRatingChange}
                size="lg"
                className="justify-center mb-4"
              />
              {rating > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-blue-900 font-medium">
                    {rating === 1 &&
                      "We're sorry to hear that. We'd love to make this right."}
                    {rating === 2 &&
                      "Thank you for the feedback. How can we improve?"}
                    {rating === 3 &&
                      "Thanks for your feedback. Tell us more about your experience."}
                    {rating === 4 &&
                      "Great! We're glad you had a good experience."}
                    {rating === 5 &&
                      "Excellent! We're thrilled you loved our service."}
                  </p>
                </div>
              )}
            </div>

            {/* Review Text Input */}
            {rating > 0 && (
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-3">
                  Tell us about your experience:
                </label>
                <Textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share details about your experience..."
                  className="min-h-[100px] border-blue-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                />
              </div>
            )}

            {rating > 0 &&
              (redirectToGoogle && reviewRequest.googleReviewUrl ? (
                <Button
                  onClick={() => handleGoogleRedirect(reviewText)}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy My Review & Continue to Google
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                >
                  {isSubmitting ? "Submitting..." : gateSettings.buttonText}
                </Button>
              ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
