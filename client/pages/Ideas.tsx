import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ThumbsUp,
  MessageSquare,
  Search,
  CheckCircle,
  Clock,
  Code,
  Calendar,
  User,
  Filter,
  Zap,
  Smartphone,
  BarChart3,
  Settings,
  Globe,
  CreditCard,
  Mail,
  Shield,
  FileText,
  Plus,
  Send,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "approved" | "rejected" | "roadmap";
  upvotes: number;
  downvotes: number;
  comments_count: number;
  author_name: string;
  priority: "low" | "medium" | "high";
  roadmap_status: "planned" | "in-progress" | "completed" | null;
  estimated_completion: string | null;
  created_at: string;
}

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string | null;
  type: "feature" | "improvement" | "bugfix" | "breaking";
  items: string[];
  released_at: string;
}

interface CategoryStat {
  category: string;
  ideaCount: number;
  totalVotes: number;
}

// ── Static category definitions ────────────────────────────────────────────────
const CATEGORIES = [
  { id: "automation",    name: "Automation & Workflows",    description: "Streamline processes with smart automation",     icon: Zap,        color: "bg-blue-500" },
  { id: "mobile",        name: "Mobile Experience",         description: "Enhance mobile apps and responsive design",      icon: Smartphone, color: "bg-purple-500" },
  { id: "analytics",     name: "Analytics & Reporting",     description: "Better insights and data visualization",         icon: BarChart3,  color: "bg-green-500" },
  { id: "integrations",  name: "Integrations & APIs",       description: "Connect with more tools and services",           icon: Globe,      color: "bg-orange-500" },
  { id: "payments",      name: "Payments & Billing",        description: "Payment processing and billing features",        icon: CreditCard, color: "bg-emerald-500" },
  { id: "communication", name: "Communication",             description: "Email, SMS, and messaging improvements",        icon: Mail,       color: "bg-pink-500" },
  { id: "security",      name: "Security & Privacy",        description: "Enhanced security and privacy controls",        icon: Shield,     color: "bg-red-500" },
  { id: "ui-ux",         name: "UI/UX Improvements",        description: "User interface and experience enhancements",    icon: Settings,   color: "bg-indigo-500" },
  { id: "documentation", name: "Documentation",             description: "Improve guides, tutorials, and help content",  icon: FileText,   color: "bg-gray-500" },
];

const getCurrentUserEmail = (): string => getCurrentUser()?.email || "";

// Returns a stable device ID for anonymous users — persisted in localStorage
const getOrCreateDeviceId = (): string => {
  const KEY = "ideas_device_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function Ideas() {
  const navigate = useNavigate();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [changelogLoading, setChangelogLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("boards");

  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  // suggestion form
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState({
    title: "",
    description: "",
    category: "",
    justification: "",
    author_name: "",
  });

  // ── Fetch ideas ─────────────────────────────────────────────────────────────
  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("ideas")
        .select("id, title, description, category, status, upvotes, downvotes, comments_count, author_name, priority, roadmap_status, estimated_completion, created_at")
        .neq("status", "rejected")
        .order("upvotes", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Idea[];
      setIdeas(rows);

      // Compute per-category stats
      const statsMap: Record<string, CategoryStat> = {};
      for (const idea of rows) {
        if (!statsMap[idea.category]) {
          statsMap[idea.category] = { category: idea.category, ideaCount: 0, totalVotes: 0 };
        }
        statsMap[idea.category].ideaCount += 1;
        statsMap[idea.category].totalVotes += idea.upvotes;
      }
      setCategoryStats(Object.values(statsMap));
    } catch (err: any) {
      toast.error("Failed to load ideas: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch changelog ──────────────────────────────────────────────────────────
  const fetchChangelog = useCallback(async () => {
    setChangelogLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("changelog_entries")
        .select("*")
        .order("released_at", { ascending: false });
      if (error) throw error;
      setChangelog((data ?? []) as ChangelogEntry[]);
    } catch (err: any) {
      toast.error("Failed to load changelog: " + (err?.message ?? "Unknown"));
    } finally {
      setChangelogLoading(false);
    }
  }, []);

  // ── Load user's existing votes from Supabase ────────────────────────────────
  const fetchUserVotes = useCallback(async () => {
    const userEmail = getCurrentUserEmail();
    const deviceId = getOrCreateDeviceId();
    try {
      // Try email first, fall back to device ID
      const identifier = userEmail
        ? { column: "user_email", value: userEmail }
        : { column: "device_id", value: deviceId };

      const { data, error } = await supabaseClient
        .from("idea_votes")
        .select("idea_id")
        .eq(identifier.column, identifier.value);
      if (error) throw error;
      setVotedIds(new Set((data ?? []).map((r: any) => r.idea_id as string)));
    } catch (err) {
      console.error("Could not load votes:", err);
      toast.error("Couldn't load your previous votes");
    }
  }, []);

  useEffect(() => {
    fetchIdeas();
    fetchChangelog();
    fetchUserVotes();
  }, [fetchIdeas, fetchChangelog, fetchUserVotes]);

  // ── Vote ─────────────────────────────────────────────────────────────────────
  const handleVote = async (idea: Idea) => {
    const alreadyVoted = votedIds.has(idea.id);
    const newUpvotes = alreadyVoted ? idea.upvotes - 1 : idea.upvotes + 1;
    const userEmail = getCurrentUserEmail();
    const deviceId = getOrCreateDeviceId();

    // Optimistic update
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, upvotes: newUpvotes } : i));
    const newVoted = new Set(votedIds);
    if (alreadyVoted) newVoted.delete(idea.id); else newVoted.add(idea.id);
    setVotedIds(newVoted);

    try {
      const { error } = await supabaseClient
        .from("ideas")
        .update({ upvotes: newUpvotes })
        .eq("id", idea.id);
      if (error) throw error;

      // Persist vote — logged-in users keyed by email, anonymous by device_id
      if (alreadyVoted) {
        // Remove vote: delete by email if available, else by device_id
        const deleteQuery = supabaseClient.from("idea_votes").delete().eq("idea_id", idea.id);
        const { error: delError } = userEmail
          ? await deleteQuery.eq("user_email", userEmail)
          : await deleteQuery.eq("device_id", deviceId);
        if (delError) throw delError;
      } else {
        const { error: insError } = await supabaseClient.from("idea_votes").insert({
          idea_id: idea.id,
          user_email: userEmail || "",
          device_id: deviceId || "",
        });
        // 23505 = unique violation: the vote was already recorded, which is fine.
        if (insError && insError.code !== "23505") throw insError;
      }
    } catch (err: any) {
      setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, upvotes: idea.upvotes } : i));
      setVotedIds(votedIds);
      toast.error("Failed to record vote");
    }
  };

  // ── Submit suggestion ─────────────────────────────────────────────────────────
  const handleSuggestionSubmit = async () => {
    if (!suggestionForm.title || !suggestionForm.description || !suggestionForm.category) {
      toast.error("Please fill in the required fields");
      return;
    }
    const authorEmail = getCurrentUserEmail();
    if (!authorEmail) {
      toast.error("You must be logged in to submit a suggestion");
      return;
    }
    setSubmitting(true);
    try {
      // RLS only allows (title, description, category, author_name, author_email)
      // with author_email = auth.email(). Status/priority/votes are DB defaults.
      const justification = suggestionForm.justification.trim();
      const description = justification
        ? `${suggestionForm.description.trim()}\n\nWhy this matters: ${justification}`
        : suggestionForm.description.trim();
      const { error } = await supabaseClient.from("ideas").insert({
        title: suggestionForm.title.trim(),
        description,
        category: suggestionForm.category,
        author_name:
          suggestionForm.author_name.trim() || getCurrentUser()?.name || "Anonymous",
        author_email: authorEmail,
      });
      if (error) throw error;

      setSuggestionForm({ title: "", description: "", category: "", justification: "", author_name: "" });
      setShowSuggestionForm(false);
      toast.success("Feature suggestion submitted! It will be reviewed by our team.");
      fetchIdeas();
    } catch (err: any) {
      toast.error("Failed to submit suggestion: " + (err?.message ?? "Unknown"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const approvedIdeas = ideas.filter((i) => i.status === "approved" || i.status === "pending");
  const roadmapIdeas = ideas.filter((i) => i.status === "roadmap");

  const filteredIdeas = approvedIdeas.filter((idea) => {
    if (selectedCategory && idea.category !== selectedCategory) return false;
    const q = searchTerm.toLowerCase();
    if (q && !idea.title.toLowerCase().includes(q) && !idea.description.toLowerCase().includes(q)) return false;
    return true;
  });

  const getCategoryMeta = (id: string) => CATEGORIES.find((c) => c.id === id);
  const getCategoryName = (id: string) => getCategoryMeta(id)?.name ?? id;

  const getCategoryCount = (catId: string) => {
    const s = categoryStats.find((s) => s.category === catId);
    return { ideaCount: s?.ideaCount ?? 0, totalVotes: s?.totalVotes ?? 0 };
  };

  // ── Status badge ──────────────────────────────────────────────────────────────
  const getStatusBadge = (status: string, roadmapStatus?: string | null) => {
    if (status === "roadmap") {
      if (roadmapStatus === "completed") return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      if (roadmapStatus === "in-progress") return <Badge className="bg-blue-500"><Code className="h-3 w-3 mr-1" />In Progress</Badge>;
      return <Badge className="bg-purple-500"><Calendar className="h-3 w-3 mr-1" />Planned</Badge>;
    }
    if (status === "approved") return <Badge className="bg-teal-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    if (status === "declined" || status === "rejected") return <Badge variant="destructive">Declined</Badge>;
    return <Badge variant="secondary">Under Review</Badge>;
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  const SkeletonCard = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-3">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-full" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Ideas & Roadmap</h1>
            <p className="mt-1 text-sm text-gray-600">Share your ideas and see what's coming next</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4 flex-wrap gap-3">
              <div className="flex space-x-1">
                {["boards", "roadmap", "feedback", "changelog"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                      activeTab === tab
                        ? "bg-green-100 text-green-700"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { fetchIdeas(); fetchChangelog(); }}
                  disabled={loading}
                  className="gap-1"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>

                <Dialog open={showSuggestionForm} onOpenChange={setShowSuggestionForm}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Suggest Feature
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                      <DialogTitle>Suggest a New Feature</DialogTitle>
                      <DialogDescription>
                        Share your idea with our team. All suggestions are reviewed before being published.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Your Name</Label>
                          <Input
                            value={suggestionForm.author_name}
                            onChange={(e) => setSuggestionForm((p) => ({ ...p, author_name: e.target.value }))}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input type="email" value={getCurrentUserEmail()} readOnly disabled />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Feature Title *</Label>
                        <Input
                          value={suggestionForm.title}
                          onChange={(e) => setSuggestionForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="Brief, descriptive title"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Category *</Label>
                        <Select
                          value={suggestionForm.category}
                          onValueChange={(v) => setSuggestionForm((p) => ({ ...p, category: v }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description *</Label>
                        <Textarea
                          value={suggestionForm.description}
                          onChange={(e) => setSuggestionForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Describe your feature idea. What problem does it solve?"
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Why is this important? (Optional)</Label>
                        <Textarea
                          value={suggestionForm.justification}
                          onChange={(e) => setSuggestionForm((p) => ({ ...p, justification: e.target.value }))}
                          placeholder="Help us understand the value and impact"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSuggestionForm(false)}>Cancel</Button>
                      <Button onClick={handleSuggestionSubmit} disabled={submitting} className="gap-2">
                        <Send className="h-4 w-4" />
                        {submitting ? "Submitting…" : "Submit Suggestion"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-56"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ── Boards Tab ── */}
          {activeTab === "boards" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Boards</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map((board) => {
                  const Icon = board.icon;
                  const { ideaCount, totalVotes } = getCategoryCount(board.id);
                  return (
                    <div
                      key={board.id}
                      onClick={() => { setSelectedCategory(board.id); setActiveTab("feedback"); }}
                      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-lg ${board.color} text-white`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="text-right">
                          {loading ? (
                            <div className="h-7 w-10 animate-pulse bg-muted rounded" />
                          ) : (
                            <div className="text-2xl font-bold text-gray-900">{totalVotes}</div>
                          )}
                          <div className="text-xs text-gray-500">votes</div>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                        {board.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">{board.description}</p>
                      <div className="text-xs text-gray-500">
                        {loading ? (
                          <span className="inline-block h-3 w-12 animate-pulse bg-muted rounded" />
                        ) : (
                          `${ideaCount} idea${ideaCount !== 1 ? "s" : ""}`
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Roadmap Tab ── */}
          {activeTab === "roadmap" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Roadmap</h2>
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                {/* Planned */}
                <div>
                  <div className="bg-gray-50 rounded-t-lg p-4 border-l-4 border-teal-500">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-teal-500" /> Planned
                    </h3>
                  </div>
                  <div className="bg-white rounded-b-lg border border-gray-200 p-4 space-y-4">
                    {loading ? (
                      <SkeletonCard />
                    ) : roadmapIdeas.filter((i) => i.roadmap_status === "planned" || !i.roadmap_status).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No planned items yet</p>
                    ) : (
                      roadmapIdeas
                        .filter((i) => i.roadmap_status === "planned" || !i.roadmap_status)
                        .map((item) => (
                          <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Button
                                variant={votedIds.has(item.id) ? "default" : "outline"}
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => handleVote(item)}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                {item.upvotes}
                              </Button>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-2">{item.title}</h4>
                            <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">{getCategoryName(item.category)}</Badge>
                              {item.estimated_completion && (
                                <span className="text-xs text-gray-500">
                                  {new Date(item.estimated_completion).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* In Progress */}
                <div>
                  <div className="bg-gray-50 rounded-t-lg p-4 border-l-4 border-purple-500">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Code className="h-5 w-5 text-purple-500" /> In Progress
                    </h3>
                  </div>
                  <div className="bg-white rounded-b-lg border border-gray-200 p-4 space-y-4">
                    {loading ? (
                      <SkeletonCard />
                    ) : roadmapIdeas.filter((i) => i.roadmap_status === "in-progress").length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Nothing in progress yet</p>
                    ) : (
                      roadmapIdeas
                        .filter((i) => i.roadmap_status === "in-progress")
                        .map((item) => (
                          <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Button
                                variant={votedIds.has(item.id) ? "default" : "outline"}
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => handleVote(item)}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                {item.upvotes}
                              </Button>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-2">{item.title}</h4>
                            <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">{getCategoryName(item.category)}</Badge>
                              {item.estimated_completion && (
                                <span className="text-xs text-gray-500">
                                  {new Date(item.estimated_completion).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Completed */}
                <div>
                  <div className="bg-gray-50 rounded-t-lg p-4 border-l-4 border-green-500">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" /> Completed
                    </h3>
                  </div>
                  <div className="bg-white rounded-b-lg border border-gray-200 p-4 space-y-4">
                    {loading ? (
                      <SkeletonCard />
                    ) : roadmapIdeas.filter((i) => i.roadmap_status === "completed").length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Nothing completed yet</p>
                    ) : (
                      roadmapIdeas
                        .filter((i) => i.roadmap_status === "completed")
                        .map((item) => (
                          <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" disabled>
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                {item.upvotes}
                              </Button>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-2">{item.title}</h4>
                            <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">{getCategoryName(item.category)}</Badge>
                              <span className="text-xs text-green-600 font-medium">✓ Completed</span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Feedback Tab ── */}
          {activeTab === "feedback" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCategory ? getCategoryName(selectedCategory) : "All Ideas"}
                  </h2>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      ← Back to all ideas
                    </button>
                  )}
                </div>
                <span className="text-sm text-gray-500">{filteredIdeas.length} ideas</span>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No ideas yet</p>
                  <p className="text-sm mt-1">Be the first to suggest a feature!</p>
                  <Button className="mt-4 gap-2" onClick={() => setShowSuggestionForm(true)}>
                    <Plus className="h-4 w-4" /> Suggest Feature
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Vote */}
                        <div className="flex sm:flex-col items-center justify-center">
                          <Button
                            variant={votedIds.has(idea.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleVote(idea)}
                            className="h-8 px-2 text-xs"
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {idea.upvotes}
                          </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                                {idea.title}
                              </h3>
                              <p className="text-gray-600 text-sm leading-relaxed">{idea.description}</p>
                            </div>
                            <div className="flex-shrink-0">
                              {getStatusBadge(idea.status, idea.roadmap_status)}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {idea.author_name || "Anonymous"}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getCategoryName(idea.category)}
                              </Badge>
                              <span className="text-gray-400">
                                {new Date(idea.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {idea.comments_count > 0 && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                <span>{idea.comments_count} comments</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Changelog Tab ── */}
          {activeTab === "changelog" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Changelog</h2>
              {changelogLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : changelog.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No changelog entries yet</p>
                  <p className="text-sm mt-1">Updates will appear here as they are released.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {changelog.map((entry) => (
                    <div key={entry.id} className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-gray-900">{entry.title}</h3>
                            <Badge
                              variant={
                                entry.type === "feature" ? "default"
                                  : entry.type === "improvement" ? "secondary"
                                  : entry.type === "bugfix" ? "destructive"
                                  : "outline"
                              }
                              className="text-xs capitalize"
                            >
                              {entry.type}
                            </Badge>
                          </div>
                          {entry.description && (
                            <p className="text-gray-600 mb-3">{entry.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-sm font-medium text-gray-900">v{entry.version}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(entry.released_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {entry.items.length > 0 && (
                        <ul className="space-y-2">
                          {entry.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
