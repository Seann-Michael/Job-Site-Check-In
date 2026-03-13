import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, CheckCircle, Star, MapPin, ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";

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
  seoKeywords: string[];
  businessCity: string;
  businessState: string;
  serviceCategory: string;
  businessOwnerVideo?: string;
}

export default function ReviewGate() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPreview = location.pathname === "/review-demo";
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(
    null,
  );
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [seoReviewText, setSeoReviewText] = useState("");
  const [showSeoVersion, setShowSeoVersion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [redirectToGoogle, setRedirectToGoogle] = useState(false);

  useEffect(() => {
    const loadReviewRequest = () => {
      const mockRequest: ReviewRequest = {
        id: id || "demo",
        businessName: "Smith Construction LLC",
        businessLogo: undefined,
        businessAddress: "123 Main St, Springfield, IL 62701",
        customerName: "John",
        projectName: "Kitchen Renovation",
        projectDescription:
          "Complete kitchen remodel with custom cabinets and granite countertops",
        threshold: 4,
        googleReviewUrl: "https://g.page/r/CdWWUaI_IBAoEBM/review",
        seoKeywords: [
          "kitchen renovation",
          "custom cabinets",
          "home remodeling",
          "Springfield contractor",
        ],
        businessCity: "Springfield",
        businessState: "Illinois",
        serviceCategory: "Home Renovation",
        businessOwnerVideo:
          "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      };

      // Force set the review request immediately
      setTimeout(() => {
        setReviewRequest(mockRequest);
      }, 100);
    };

    loadReviewRequest();
  }, [id]);

  const generateSeoReview = (originalText: string, request: ReviewRequest) => {
    // Simulate AI enhancement using the configured prompt
    // In real implementation, this would call an AI service with the custom prompt

    const aiPrompt = `You are helping enhance customer reviews to be more discoverable and helpful. Take the customer's original review and enhance it by: 1) Adding location-specific keywords (${request.businessCity}, ${request.businessState}), 2) Including relevant service categories (${request.serviceCategory}), 3) Making it more descriptive while keeping the customer's authentic voice, 4) Adding helpful details that would assist other potential customers. Keep the enhancement natural and genuine.`;

    if (!originalText) {
      // Generate a template review when no original text exists
      const templates = [
        `Outstanding ${request.serviceCategory.toLowerCase()} experience with ${request.businessName} in ${request.businessCity}, ${request.businessState}! Their professional team exceeded our expectations with exceptional ${request.seoKeywords[0]} work. The attention to detail and quality craftsmanship made this project seamless from start to finish. Highly recommend their ${request.seoKeywords.slice(0, 2).join(" and ")} services to anyone in the ${request.businessCity} area looking for reliable contractors!`,

        `Excellent service from ${request.businessName}! Their ${request.serviceCategory.toLowerCase()} expertise in ${request.businessCity} is top-notch. The team's professionalism and ${request.seoKeywords[0]} skills made our project a complete success. Quality work, fair pricing, and great communication throughout. Perfect choice for ${request.seoKeywords.slice(0, 2).join(" or ")} in ${request.businessState}!`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    } else {
      // Enhance the customer's original text with SEO elements
      const enhancedVersions = [
        `${originalText.replace(/[.!]$/, "")} - ${request.businessName} in ${request.businessCity}, ${request.businessState} truly excels at ${request.serviceCategory.toLowerCase()}. Their ${request.seoKeywords[0]} expertise and professional approach made this entire experience exceptional. I highly recommend their ${request.seoKeywords.slice(0, 2).join(" and ")} services to anyone in the ${request.businessCity} area!`,

        `Outstanding ${request.serviceCategory.toLowerCase()} service in ${request.businessCity}! ${originalText} ${request.businessName}'s team demonstrated excellent ${request.seoKeywords[0]} skills and attention to detail. Their professionalism and quality work make them the perfect choice for ${request.seoKeywords.slice(0, 2).join(" or ")} throughout ${request.businessState}.`,

        `${originalText.replace(/[.!]$/, "")} ${request.businessName} provides exceptional ${request.serviceCategory.toLowerCase()} services in ${request.businessCity}, ${request.businessState}. Their expertise in ${request.seoKeywords[0]} and commitment to quality made our project a complete success. Highly recommend to neighbors in the ${request.businessCity} area!`,
      ];
      return enhancedVersions[
        Math.floor(Math.random() * enhancedVersions.length)
      ];
    }
  };

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    if (newRating >= (reviewRequest?.threshold || 4)) {
      setRedirectToGoogle(true);
    } else {
      setRedirectToGoogle(false);
      setShowSeoVersion(false);
      setSeoReviewText("");
    }
  };

  const handleReviewTextChange = (text: string) => {
    setReviewText(text);
    if (redirectToGoogle && text.trim() && reviewRequest) {
      const seoVersion = generateSeoReview(text, reviewRequest);
      setSeoReviewText(seoVersion);
      setShowSeoVersion(true);
    } else {
      setShowSeoVersion(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Review copied to clipboard!");
  };

  if (!reviewRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-900">Loading review form...</p>
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
          {redirectToGoogle ? (
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
              Your feedback has been recorded. We appreciate your input!
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
          <h2 className="text-3xl font-bold text-blue-900">How did we do?</h2>
        </div>

        {/* Business Owner Video */}
        {reviewRequest.businessOwnerVideo && (
          <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 mb-8">
            <div className="text-center mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                A Message from {reviewRequest.businessName}
              </h3>
            </div>
            <div className="max-w-lg mx-auto">
              <video
                controls
                className="w-full rounded-lg shadow-lg"
                poster="/api/placeholder/600/400"
              >
                <source
                  src={reviewRequest.businessOwnerVideo}
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
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
                  onChange={(e) => handleReviewTextChange(e.target.value)}
                  placeholder="Share details about your experience..."
                  className="min-h-[100px] border-blue-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                />
              </div>
            )}

            {/* Enhanced Review */}
            {showSeoVersion && seoReviewText && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                <div className="mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    ✨ Enhanced Version of Your Review
                  </h4>
                  <p className="text-sm text-blue-700">
                    We've enhanced your review with location details and service
                    keywords that help other customers in{" "}
                    {reviewRequest.businessCity} find{" "}
                    {reviewRequest.businessName}.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-blue-200 text-sm mb-4 shadow-sm">
                  {seoReviewText}
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      copyToClipboard(seoReviewText);
                      setTimeout(() => {
                        window.open(reviewRequest.googleReviewUrl, "_blank");
                      }, 500);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Enhanced & Continue to Google
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      copyToClipboard(reviewText);
                      setTimeout(() => {
                        window.open(reviewRequest.googleReviewUrl, "_blank");
                      }, 500);
                    }}
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    Use Original & Continue to Google
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
