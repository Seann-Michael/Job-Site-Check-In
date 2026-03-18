import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ArrowLeft,
  Calendar,
  User,
  Send,
  CheckCircle,
  Clock,
  Code,
  XCircle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import supabaseClient from "@/lib/supabaseClient";

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  isAdmin?: boolean;
}

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status:
    | "submitted"
    | "under-review"
    | "planned"
    | "in-progress"
    | "completed"
    | "declined";
  upvotes: number;
  downvotes: number;
  userVote: "up" | "down" | null;
  author: string;
  createdAt: string;
  comments: Comment[];
  priority: "low" | "medium" | "high";
}

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadIdea();
  }, [id]);

  const loadIdea = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("ideas")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        setIdea(null);
        return;
      }
      const statusMap: Record<string, Idea["status"]> = {
        pending: "submitted",
        approved: "planned",
        rejected: "declined",
        roadmap: "in-progress",
      };
      setIdea({
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        status: statusMap[data.status] ?? "submitted",
        upvotes: data.upvotes ?? 0,
        downvotes: data.downvotes ?? 0,
        userVote: null,
        author: data.author_name,
        createdAt: data.created_at,
        comments: [],
        priority: data.priority ?? "medium",
      });
    } catch {
      setIdea(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (voteType: "up" | "down") => {
    if (!idea) return;

    let newUpvotes = idea.upvotes;
    let newDownvotes = idea.downvotes;
    let newUserVote: "up" | "down" | null = voteType;

    // Remove existing vote if any
    if (idea.userVote === "up") {
      newUpvotes--;
    } else if (idea.userVote === "down") {
      newDownvotes--;
    }

    // If clicking the same vote type, remove the vote
    if (idea.userVote === voteType) {
      newUserVote = null;
    } else {
      // Add new vote
      if (voteType === "up") {
        newUpvotes++;
      } else {
        newDownvotes++;
      }
    }

    setIdea({
      ...idea,
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      userVote: newUserVote,
    });
    toast.success("Vote recorded!");
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !idea) return;

    if (!currentUser) {
      toast.error("You must be logged in to comment");
      return;
    }

    if (!captchaVerified) {
      setShowCaptcha(true);
      toast.error("Please complete the captcha verification");
      return;
    }

    setIsSubmittingComment(true);

    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const comment: Comment = {
      id: `c${Date.now()}`,
      author: currentUser.name || "You",
      content: newComment,
      createdAt: new Date().toISOString(),
    };

    setIdea({
      ...idea,
      comments: [...idea.comments, comment],
    });

    setNewComment("");
    setCaptchaVerified(false);
    setShowCaptcha(false);
    setIsSubmittingComment(false);
    toast.success("Comment added!");
  };

  const handleCaptchaVerify = () => {
    // Mock captcha verification
    setCaptchaVerified(true);
    setShowCaptcha(false);
    toast.success("Captcha verified!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "in-progress":
        return (
          <Badge className="bg-blue-500">
            <Code className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case "planned":
        return (
          <Badge className="bg-purple-500">
            <Calendar className="h-3 w-3 mr-1" />
            Planned
          </Badge>
        );
      case "under-review":
        return (
          <Badge className="bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Under Review
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge variant="secondary">Submitted</Badge>;
    }
  };

  const getCategoryName = (categoryId: string) => {
    const categories: Record<string, string> = {
      "ui-ux": "UI/UX Improvements",
      mobile: "Mobile Experience",
      analytics: "Analytics & Reporting",
      integrations: "Integrations & APIs",
      automation: "Automation & Workflows",
      payments: "Payments & Billing",
      communication: "Communication",
      security: "Security & Privacy",
      documentation: "Documentation",
    };
    return categories[categoryId] || categoryId;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!idea) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Idea Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              The idea you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate("/ideas")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ideas
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 prevent-overflow">
        {/* Navigation */}
        <Button
          variant="ghost"
          onClick={() => navigate("/ideas")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ideas
        </Button>

        {/* Main Content */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  {idea.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {idea.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(idea.createdAt).toLocaleDateString()}
                  </span>
                  <Badge variant="outline">
                    {getCategoryName(idea.category)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {getStatusBadge(idea.status)}
                <div className="flex items-center gap-2">
                  <Button
                    variant={idea.userVote === "up" ? "default" : "outline"}
                    onClick={() => handleVote("up")}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {idea.upvotes}
                  </Button>
                  <Button
                    variant={
                      idea.userVote === "down" ? "destructive" : "outline"
                    }
                    onClick={() => handleVote("down")}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    {idea.downvotes}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {idea.description}
              </p>
            </div>
          </div>

          {/* Comments Section */}
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Comments ({idea.comments.length})
              </h2>
            </div>

            {/* Comment Form */}
            <div className="mb-8">
              {currentUser ? (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Share your thoughts on this idea..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="mb-3"
                    rows={3}
                  />

                  {/* Simple Captcha */}
                  {showCaptcha && (
                    <div className="p-4 border rounded-lg bg-gray-50">
                      <p className="text-sm font-medium mb-2">Security Check</p>
                      <p className="text-sm text-gray-600 mb-3">
                        Please verify you're human by clicking the button below:
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleCaptchaVerify}
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        I'm not a robot
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim() || isSubmittingComment}
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {isSubmittingComment ? "Posting..." : "Post Comment"}
                    </Button>
                    {captchaVerified && (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 border rounded-lg bg-gray-50">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-3">
                    You must be logged in to leave a comment
                  </p>
                  <Button onClick={() => navigate("/login")}>
                    Sign In to Comment
                  </Button>
                </div>
              )}
            </div>

            {/* Comments List */}
            <div className="space-y-6">
              {idea.comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {comment.author.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900">
                          {comment.author}
                        </span>
                        {comment.isAdmin && (
                          <Badge variant="secondary" className="text-xs">
                            Admin
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {idea.comments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No comments yet. Be the first to share your thoughts!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
