import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Search,
  BookOpen,
  Users,
  Building2,
  Settings,
  Camera,
  FolderOpen,
  MessageSquare,
  CreditCard,
  BarChart3,
  Shield,
  HelpCircle,
  Star,
  Clock,
  User,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ExternalLink,
  FileText,
  RefreshCw,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { useLocation } from "react-router-dom";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface HelpArticle {
  id: string;
  title: string;
  description: string | null;
  category: string;
  user_type: "all" | "business" | "agency" | "admin";
  content: string;
  tags: string[];
  status: "published" | "draft" | "archived";
  views: number;
  rating: number;
  is_popular: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SupportTicket {
  id: string;
  ticket_number: number;
  title: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  description: string;
  submitted_by: string;
  created_at: string;
  updated_at: string;
}

// ── Category definitions (icons + descriptions only — article counts from DB) ──
const CATEGORIES = [
  { id: "getting-started", name: "Getting Started",         description: "Learn the basics and get up and running quickly",        icon: BookOpen },
  { id: "account",         name: "Account Management",      description: "Manage your profile, settings, and preferences",         icon: User },
  { id: "business",        name: "Business Management",     description: "Managing your business profile and listings",             icon: Building2 },
  { id: "agency",          name: "Agency Features",         description: "Managing clients, billing, and agency operations",        icon: Users },
  { id: "photos",          name: "Photo Management",        description: "Upload, organise, and optimise business photos",          icon: Camera },
  { id: "projects",        name: "Project Management",      description: "Managing projects, tasks, and documentation",             icon: FolderOpen },
  { id: "reviews",         name: "Review Management",       description: "Handle customer reviews and responses",                   icon: MessageSquare },
  { id: "billing",         name: "Billing & Subscriptions", description: "Understanding pricing, payments, and subscriptions",      icon: CreditCard },
  { id: "analytics",       name: "Analytics & Reports",     description: "Track performance and generate insights",                 icon: BarChart3 },
  { id: "security",        name: "Security & Privacy",      description: "Account security and privacy controls",                   icon: Shield },
  { id: "support",         name: "Support & Troubleshooting",description: "Get help when you need it most",                        icon: HelpCircle },
  { id: "api",             name: "API & Integrations",      description: "Connect with tools and external services",                icon: Settings },
  { id: "general",         name: "General",                 description: "General guidance and tips",                               icon: FileText },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function KnowledgeBase() {
  const currentUser = getCurrentUser();
  const location = useLocation();
  const isSuper = isSuperAdmin();

  // Layout
  const LayoutComponent = location.pathname.startsWith("/super-admin")
    ? SuperAdminLayout
    : location.pathname.startsWith("/agency")
    ? AgencyAdminLayout
    : AppLayout;

  // Data state
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);

  // Ticket form
  const [newTicket, setNewTicket] = useState({
    title: "",
    category: "general",
    priority: "medium" as SupportTicket["priority"],
    description: "",
  });
  const [ticketSaving, setTicketSaving] = useState(false);

  // ── Fetch articles ────────────────────────────────────────────────────────
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("help_articles")
        .select("*")
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setArticles((data ?? []) as HelpArticle[]);
    } catch (err: any) {
      toast.error("Failed to load help articles: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch tickets ─────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    if (!currentUser) return;
    setTicketsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("support_tickets")
        .select("id, ticket_number, title, category, priority, status, description, submitted_by, created_at, updated_at")
        .eq("submitted_by", currentUser.email ?? "")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setTickets((data ?? []) as SupportTicket[]);
    } catch (err: any) {
      // Non-critical: just hide the section
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchArticles();
    fetchTickets();
  }, [fetchArticles, fetchTickets]);

  // ── User-type filtering ───────────────────────────────────────────────────
  const userMatchesArticle = (userType: HelpArticle["user_type"]) => {
    if (userType === "all") return true;
    if (!currentUser) return false;
    if (userType === "business" && currentUser.role === "admin") return true;
    if (userType === "agency" && currentUser.role === "agency") return true;
    if (userType === "admin" && currentUser.role === "superadmin") return true;
    return false;
  };

  const filteredArticles = articles.filter((a) => {
    if (!userMatchesArticle(a.user_type)) return false;
    if (selectedCategory && a.category !== selectedCategory) return false;
    const q = searchQuery.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) &&
        !(a.description ?? "").toLowerCase().includes(q) &&
        !a.tags.some((t) => t.toLowerCase().includes(q))) return false;
    return true;
  });

  // Only show categories that have at least one matching article
  const visibleCategories = CATEGORIES.filter((cat) =>
    articles.some((a) => a.category === cat.id && userMatchesArticle(a.user_type))
  );

  const popularArticles = filteredArticles.filter((a) => a.is_popular);

  // ── Increment view count when article opened ──────────────────────────────
  const openArticle = async (article: HelpArticle) => {
    setSelectedArticle(article);
    try {
      await supabaseClient
        .from("help_articles")
        .update({ views: article.views + 1 })
        .eq("id", article.id);
    } catch {}
  };

  // ── Super admin: save article ─────────────────────────────────────────────
  const handleSaveArticle = async () => {
    if (!editingArticle || !editingArticle.title.trim() || !editingArticle.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      if (isCreating) {
        const { error } = await supabaseClient.from("help_articles").insert({
          title: editingArticle.title.trim(),
          description: editingArticle.description?.trim() || null,
          category: editingArticle.category,
          user_type: editingArticle.user_type,
          content: editingArticle.content.trim(),
          tags: editingArticle.tags,
          status: "published",
          views: 0,
          rating: 0,
          is_popular: false,
          created_by: currentUser?.name ?? "Super Admin",
        });
        if (error) throw error;
        toast.success("Article created");
      } else {
        const { error } = await supabaseClient
          .from("help_articles")
          .update({
            title: editingArticle.title.trim(),
            description: editingArticle.description?.trim() || null,
            category: editingArticle.category,
            user_type: editingArticle.user_type,
            content: editingArticle.content.trim(),
            tags: editingArticle.tags,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingArticle.id);
        if (error) throw error;
        toast.success("Article updated");
      }
      setEditingArticle(null);
      setIsCreating(false);
      fetchArticles();
    } catch (err: any) {
      toast.error("Save failed: " + (err?.message ?? "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  // ── Super admin: delete article ───────────────────────────────────────────
  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    try {
      const { error } = await supabaseClient.from("help_articles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Article deleted");
      setSelectedArticle(null);
      fetchArticles();
    } catch (err: any) {
      toast.error("Delete failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── Create support ticket ─────────────────────────────────────────────────
  const handleCreateTicket = async () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      toast.error("Please fill in subject and description");
      return;
    }
    setTicketSaving(true);
    try {
      const { error } = await supabaseClient.from("support_tickets").insert({
        title: newTicket.title.trim(),
        description: newTicket.description.trim(),
        category: newTicket.category,
        priority: newTicket.priority,
        status: "open",
        submitted_by: currentUser?.email ?? "anonymous",
        user_type: currentUser?.role ?? "admin",
      });
      if (error) throw error;
      toast.success("Support ticket created! Our team will be in touch soon.");
      setNewTicket({ title: "", category: "general", priority: "medium", description: "" });
      setShowCreateTicket(false);
      fetchTickets();
    } catch (err: any) {
      toast.error("Failed to create ticket: " + (err?.message ?? "Unknown"));
    } finally {
      setTicketSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const priorityColor = (p: string) => ({
    urgent: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-green-100 text-green-800",
  }[p] ?? "bg-gray-100 text-gray-800");

  const statusColor = (s: string) => ({
    "open": "bg-blue-100 text-blue-800",
    "in-progress": "bg-yellow-100 text-yellow-800",
    "resolved": "bg-green-100 text-green-800",
    "closed": "bg-gray-100 text-gray-800",
  }[s] ?? "bg-gray-100 text-gray-800");

  const SkeletonCard = () => (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
        <div className="h-3 bg-muted rounded w-full" />
      </CardHeader>
    </Card>
  );

  // ── Article editing view (super admin) ────────────────────────────────────
  if (editingArticle) {
    return (
      <LayoutComponent>
        <div className="container px-4 py-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setEditingArticle(null); setIsCreating(false); }}>
                ← Back to Help Center
              </Button>
              <h1 className="text-2xl font-bold">{isCreating ? "Create Article" : "Edit Article"}</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditingArticle(null); setIsCreating(false); }}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSaveArticle} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save Article"}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Title *</Label>
                    <Input
                      value={editingArticle.title}
                      onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                      placeholder="Article title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={editingArticle.category}
                      onValueChange={(v) => setEditingArticle({ ...editingArticle, category: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Audience</Label>
                    <Select
                      value={editingArticle.user_type}
                      onValueChange={(v: HelpArticle["user_type"]) => setEditingArticle({ ...editingArticle, user_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="business">Business Owners</SelectItem>
                        <SelectItem value="agency">Agency Admins</SelectItem>
                        <SelectItem value="admin">Super Admins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      value={editingArticle.tags.join(", ")}
                      onChange={(e) => setEditingArticle({
                        ...editingArticle,
                        tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                      })}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={editingArticle.description ?? ""}
                    onChange={(e) => setEditingArticle({ ...editingArticle, description: e.target.value })}
                    placeholder="Brief description shown in article listings"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label>Content (Markdown) *</Label>
                <Textarea
                  value={editingArticle.content}
                  onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                  className="h-96 font-mono text-sm"
                  placeholder="Article content in Markdown format…"
                />
              </div>
              <div className="mt-4 p-3 border rounded-md bg-muted/30 text-xs text-muted-foreground">
                <span className="font-medium">Markdown tips: </span>
                <code># Heading</code> · <code>**bold**</code> · <code>*italic*</code> ·
                <code> - list item</code> · <code>[link](url)</code> · <code>```code```</code>
              </div>
            </CardContent>
          </Card>
        </div>
      </LayoutComponent>
    );
  }

  // ── Article detail view ───────────────────────────────────────────────────
  if (selectedArticle) {
    return (
      <LayoutComponent>
        <div className="container px-4 py-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => setSelectedArticle(null)}>
              ← Back to Help Center
            </Button>
            {isSuper && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setEditingArticle({ ...selectedArticle }); setSelectedArticle(null); setIsCreating(false); }} className="gap-2">
                  <Edit className="h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" onClick={() => handleDeleteArticle(selectedArticle.id)} className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            )}
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="capitalize">
                  {CATEGORIES.find((c) => c.id === selectedArticle.category)?.name ?? selectedArticle.category}
                </Badge>
                {selectedArticle.is_popular && <Badge variant="default">Popular</Badge>}
              </div>
              <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
              {selectedArticle.description && (
                <CardDescription className="text-base">{selectedArticle.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                {selectedArticle.content}
              </div>
              <div className="mt-8 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>Updated {new Date(selectedArticle.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-1 flex-wrap">
                    {selectedArticle.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <span className="flex items-center gap-1"><Star className="h-3 w-3" />{selectedArticle.views} views</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </LayoutComponent>
    );
  }

  // ── Main help center ──────────────────────────────────────────────────────
  return (
    <LayoutComponent>
      <div className="container px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={fetchArticles} disabled={loading} className="gap-1">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              {isSuper && (
                <Button
                  onClick={() => {
                    setEditingArticle({
                      id: "", title: "", description: "", category: "getting-started",
                      user_type: "all", content: "", tags: [], status: "published",
                      views: 0, rating: 0, is_popular: false, created_by: "",
                      created_at: "", updated_at: "",
                    });
                    setIsCreating(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> Create Article
                </Button>
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Help Center</h1>
          <p className="text-muted-foreground text-lg">
            Find answers, guides, and resources to get the most out of the platform
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search help articles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories — only show categories that have articles */}
        {!searchQuery && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {loading ? (
              [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
            ) : visibleCategories.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No articles published yet</p>
                {isSuper && (
                  <Button
                    className="mt-3 gap-2"
                    size="sm"
                    onClick={() => {
                      setEditingArticle({
                        id: "", title: "", description: "", category: "getting-started",
                        user_type: "all", content: "", tags: [], status: "published",
                        views: 0, rating: 0, is_popular: false, created_by: "",
                        created_at: "", updated_at: "",
                      });
                      setIsCreating(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Create First Article
                  </Button>
                )}
              </div>
            ) : (
              visibleCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <Card
                    key={category.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedCategory === category.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{category.name}</CardTitle>
                          <CardDescription className="text-sm">{category.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Popular Articles — only when no category/search active */}
        {!selectedCategory && !searchQuery && popularArticles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Popular Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularArticles.map((article) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => openArticle(article)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">{article.title}</CardTitle>
                        <CardDescription className="text-sm line-clamp-2">{article.description}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {CATEGORIES.find((c) => c.id === article.category)?.name ?? article.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" />{article.views} views</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(article.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Articles */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {selectedCategory
              ? CATEGORIES.find((c) => c.id === selectedCategory)?.name ?? selectedCategory
              : searchQuery
              ? `Search results for "${searchQuery}"`
              : "All Articles"}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="ml-3 text-sm font-normal text-primary hover:underline"
              >
                Clear filter
              </button>
            )}
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No articles found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? "Try a different search term" : "Check back soon for new guides"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredArticles.map((article) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => openArticle(article)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">{article.title}</CardTitle>
                          {article.is_popular && <Badge variant="default" className="text-xs">Popular</Badge>}
                        </div>
                        {article.description && (
                          <CardDescription className="text-sm line-clamp-2">{article.description}</CardDescription>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {article.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-4 shrink-0 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="capitalize">
                          {CATEGORIES.find((c) => c.id === article.category)?.name ?? article.category}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(article.updated_at).toLocaleDateString()}
                        </span>
                        {isSuper && (
                          <button
                            className="text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingArticle({ ...article });
                              setIsCreating(false);
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Support Tickets (logged-in users only) */}
        {currentUser && (
          <div className="mb-8 pt-8 border-t">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Your Support Tickets</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTickets(!showTickets)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {showTickets ? "Hide Tickets" : `View Tickets (${tickets.length})`}
                </Button>
                <Button onClick={() => setShowCreateTicket(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> New Ticket
                </Button>
              </div>
            </div>

            {showTickets && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Support Tickets</CardTitle>
                  <CardDescription>Track and manage your support requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <div className="h-12 animate-pulse bg-muted rounded" />
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No support tickets yet</p>
                      <Button size="sm" className="mt-3 gap-2" onClick={() => setShowCreateTicket(true)}>
                        <Plus className="h-4 w-4" /> Create Your First Ticket
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead className="hidden sm:table-cell">Category</TableHead>
                            <TableHead className="hidden md:table-cell">Priority</TableHead>
                            <TableHead className="hidden md:table-cell">Status</TableHead>
                            <TableHead className="hidden lg:table-cell">Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.map((ticket) => (
                            <TableRow key={ticket.id}>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                #{ticket.ticket_number}
                              </TableCell>
                              <TableCell className="font-medium">{ticket.title}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="capitalize">{ticket.category}</Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge className={priorityColor(ticket.priority)}>{ticket.priority}</Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge className={statusColor(ticket.status)}>
                                  {ticket.status.replace("-", " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {showCreateTicket && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Create Support Ticket
                  </CardTitle>
                  <CardDescription>
                    Describe your issue and we'll get back to you as soon as possible.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Subject *</Label>
                      <Input
                        placeholder="Brief description of your issue"
                        value={newTicket.title}
                        onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                          <SelectItem value="Billing Question">Billing</SelectItem>
                          <SelectItem value="Feature Request">Feature Request</SelectItem>
                          <SelectItem value="Bug Report">Bug Report</SelectItem>
                          <SelectItem value="Account Access">Account Issue</SelectItem>
                          <SelectItem value="Other">General Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(v: SupportTicket["priority"]) => setNewTicket({ ...newTicket, priority: v })}
                    >
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description *</Label>
                    <Textarea
                      placeholder="Please provide detailed information about your issue…"
                      className="min-h-[120px]"
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowCreateTicket(false)}>Cancel</Button>
                    <Button onClick={handleCreateTicket} disabled={ticketSaving} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {ticketSaving ? "Submitting…" : "Create Ticket"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Additional Resources */}
        {!selectedCategory && !searchQuery && (
          <div className="mt-8 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-4">Additional Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Video Tutorials
                  </CardTitle>
                  <CardDescription>Watch step-by-step video guides</CardDescription>
                  <Button variant="outline" className="w-full mt-2">View Tutorials</Button>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Community Forum
                  </CardTitle>
                  <CardDescription>Connect with other users and share tips</CardDescription>
                  <Button variant="outline" className="w-full mt-2">Join Community</Button>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                  </CardTitle>
                  <CardDescription>Get personalised help from our support team</CardDescription>
                  <Button className="w-full mt-2" onClick={() => setShowCreateTicket(true)}>
                    Create Support Ticket
                  </Button>
                </CardHeader>
              </Card>
            </div>
          </div>
        )}
      </div>
    </LayoutComponent>
  );
}
