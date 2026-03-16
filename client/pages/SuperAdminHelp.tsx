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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Eye,
  Calendar,
  RefreshCw,
  MoreHorizontal,
  Archive,
  Globe,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
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
  rating_count: number;
  is_popular: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "general",
  user_type: "all" as HelpArticle["user_type"],
  content: "",
  tags: "",
  status: "draft" as HelpArticle["status"],
  is_popular: false,
};

const CATEGORIES = [
  { id: "getting-started", name: "Getting Started", icon: BookOpen },
  { id: "account", name: "Account Management", icon: User },
  { id: "business", name: "Business Management", icon: Building2 },
  { id: "agency", name: "Agency Features", icon: Users },
  { id: "photos", name: "Photo Management", icon: Camera },
  { id: "projects", name: "Project Management", icon: FolderOpen },
  { id: "reviews", name: "Review Management", icon: MessageSquare },
  { id: "billing", name: "Billing & Subscriptions", icon: CreditCard },
  { id: "analytics", name: "Analytics & Reports", icon: BarChart3 },
  { id: "security", name: "Security & Privacy", icon: Shield },
  { id: "support", name: "Support & Troubleshooting", icon: HelpCircle },
  { id: "api", name: "API & Integrations", icon: Settings },
  { id: "general", name: "General", icon: FileText },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminHelp() {
  const [activeTab, setActiveTab] = useState("browse");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewArticle, setPreviewArticle] = useState<HelpArticle | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HelpArticle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("help_articles")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setArticles((data ?? []) as HelpArticle[]);
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error("Failed to load articles: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // ── CRUD: Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.content.trim()) { toast.error("Content is required"); return; }
    setSaving(true);
    try {
      const tagsArr = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        user_type: form.user_type,
        content: form.content.trim(),
        tags: tagsArr,
        status: form.status,
        is_popular: form.is_popular,
        updated_at: new Date().toISOString(),
      };

      if (editingArticle) {
        const { error } = await supabaseClient
          .from("help_articles")
          .update(payload)
          .eq("id", editingArticle.id);
        if (error) throw error;
        toast.success("Article updated");
      } else {
        const { error } = await supabaseClient
          .from("help_articles")
          .insert({ ...payload, created_by: "Super Admin" });
        if (error) throw error;
        toast.success("Article created");
      }

      setDialogOpen(false);
      setEditingArticle(null);
      setForm(EMPTY_FORM);
      fetchArticles();
    } catch (err: any) {
      toast.error("Save failed: " + (err?.message ?? "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD: Toggle status ────────────────────────────────────────────────────
  const toggleStatus = async (article: HelpArticle, newStatus: HelpArticle["status"]) => {
    try {
      const { error } = await supabaseClient
        .from("help_articles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", article.id);
      if (error) throw error;
      toast.success(`Article ${newStatus}`);
      fetchArticles();
    } catch (err: any) {
      toast.error("Update failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── CRUD: Toggle popular ────────────────────────────────────────────────────
  const togglePopular = async (article: HelpArticle) => {
    try {
      const { error } = await supabaseClient
        .from("help_articles")
        .update({ is_popular: !article.is_popular, updated_at: new Date().toISOString() })
        .eq("id", article.id);
      if (error) throw error;
      toast.success(article.is_popular ? "Removed from popular" : "Marked as popular");
      fetchArticles();
    } catch (err: any) {
      toast.error("Update failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── CRUD: Delete ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabaseClient
        .from("help_articles")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Article deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchArticles();
    } catch (err: any) {
      toast.error("Delete failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingArticle(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (article: HelpArticle) => {
    setEditingArticle(article);
    setForm({
      title: article.title,
      description: article.description ?? "",
      category: article.category,
      user_type: article.user_type,
      content: article.content,
      tags: article.tags.join(", "),
      status: article.status,
      is_popular: article.is_popular,
    });
    setDialogOpen(true);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredArticles = articles.filter((a) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      a.title.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q));
    const matchCat = selectedCategory === "all" || a.category === selectedCategory;
    const matchStatus = selectedStatus === "all" || a.status === selectedStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const popularArticles = articles
    .filter((a) => a.is_popular && a.status === "published")
    .sort((a, b) => b.views - a.views);

  const recentArticles = [...articles]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  const totalViews = articles.reduce((s, a) => s + a.views, 0);
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const avgRating = articles.length > 0
    ? (articles.reduce((s, a) => s + Number(a.rating), 0) / articles.length).toFixed(1)
    : "0.0";

  // ── Helpers ────────────────────────────────────────────────────────────────
  const categoryName = (id: string) =>
    CATEGORIES.find((c) => c.id === id)?.name ?? id;

  const statusVariant = (status: string) =>
    status === "published" ? "default" : status === "archived" ? "secondary" : "outline";

  const SkeletonRow = ({ cols }: { cols: number }) => (
    <TableRow>
      {[...Array(cols)].map((_, i) => (
        <TableCell key={i}><div className="h-4 w-full animate-pulse bg-muted rounded" /></TableCell>
      ))}
    </TableRow>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Help Center Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live data · Last refreshed {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchArticles} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Article
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : articles.length}
              </div>
              <p className="text-xs text-muted-foreground">{publishedCount} published</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : totalViews.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Across all articles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-12 animate-pulse bg-muted rounded" /> : `${avgRating}★`}
              </div>
              <p className="text-xs text-muted-foreground">User satisfaction</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{CATEGORIES.length}</div>
              <p className="text-xs text-muted-foreground">Available topics</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search articles by title, description or tag…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="browse">All Articles</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          {/* ── All Articles ── */}
          <TabsContent value="browse" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[260px]">Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Audience</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={8} />)
                      ) : filteredArticles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No articles found</p>
                            <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={openCreate}>
                              <Plus className="h-4 w-4" /> Create First Article
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredArticles.map((article) => (
                          <TableRow key={article.id}>
                            <TableCell>
                              <div className="font-medium leading-tight">{article.title}</div>
                              {article.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                                  {article.description}
                                </div>
                              )}
                              {article.is_popular && (
                                <Badge className="mt-1 text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                                  Popular
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {categoryName(article.category)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {article.user_type === "all" ? "All Users" : article.user_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(article.status)} className="text-xs capitalize">
                                {article.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{article.views.toLocaleString()}</TableCell>
                            <TableCell className="text-sm">
                              {Number(article.rating) > 0 ? `${Number(article.rating).toFixed(1)}★` : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(article.updated_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setPreviewArticle(article); setPreviewOpen(true); }}>
                                      <Eye className="mr-2 h-4 w-4" /> Preview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEdit(article)}>
                                      <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    {article.status !== "published" && (
                                      <DropdownMenuItem onClick={() => toggleStatus(article, "published")}>
                                        <Globe className="mr-2 h-4 w-4" /> Publish
                                      </DropdownMenuItem>
                                    )}
                                    {article.status === "published" && (
                                      <DropdownMenuItem onClick={() => toggleStatus(article, "draft")}>
                                        <FileText className="mr-2 h-4 w-4" /> Unpublish
                                      </DropdownMenuItem>
                                    )}
                                    {article.status !== "archived" && (
                                      <DropdownMenuItem onClick={() => toggleStatus(article, "archived")}>
                                        <Archive className="mr-2 h-4 w-4" /> Archive
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => togglePopular(article)}>
                                      <Star className="mr-2 h-4 w-4" />
                                      {article.is_popular ? "Remove from Popular" : "Mark as Popular"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => { setDeleteTarget(article); setDeleteDialogOpen(true); }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Popular ── */}
          <TabsContent value="popular" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Popular Articles</CardTitle>
                <CardDescription>
                  Articles marked as popular — sorted by view count
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(3)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : popularArticles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No popular articles yet</p>
                            <p className="text-sm mt-1">Mark articles as popular via the All Articles tab</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        popularArticles.map((article) => (
                          <TableRow key={article.id}>
                            <TableCell>
                              <div className="font-medium">{article.title}</div>
                              {article.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                                  {article.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{categoryName(article.category)}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{article.views.toLocaleString()}</TableCell>
                            <TableCell>
                              {Number(article.rating) > 0 ? `${Number(article.rating).toFixed(1)}★` : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setPreviewArticle(article); setPreviewOpen(true); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Recent ── */}
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recently Updated</CardTitle>
                <CardDescription>Last 10 articles sorted by update time</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : recentArticles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No articles yet</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentArticles.map((article) => (
                          <TableRow key={article.id}>
                            <TableCell className="font-medium">{article.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{categoryName(article.category)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(article.status)} className="text-xs capitalize">
                                {article.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(article.updated_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Categories ── */}
          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const catArticles = articles.filter((a) => a.category === cat.id);
                const catViews = catArticles.reduce((s, a) => s + a.views, 0);
                const published = catArticles.filter((a) => a.status === "published").length;
                return (
                  <Card
                    key={cat.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => { setSelectedCategory(cat.id); setActiveTab("browse"); }}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Icon className="h-8 w-8 text-primary" />
                        <div>
                          <CardTitle className="text-base">{cat.name}</CardTitle>
                          <CardDescription>
                            {loading ? (
                              <div className="h-3 w-16 animate-pulse bg-muted rounded mt-1" />
                            ) : (
                              `${catArticles.length} article${catArticles.length !== 1 ? "s" : ""} · ${published} published`
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {loading ? (
                          <span className="inline-block h-3 w-24 animate-pulse bg-muted rounded" />
                        ) : (
                          `${catViews.toLocaleString()} total views`
                        )}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Edit Article" : "Create New Article"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Article title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select value={form.user_type} onValueChange={(v) => setForm((f) => ({ ...f, user_type: v as HelpArticle["user_type"] }))}>
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
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as HelpArticle["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief summary shown in listings"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="getting-started, setup, basics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content (Markdown) *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Write your article content in Markdown format..."
                rows={16}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_popular"
                type="checkbox"
                checked={form.is_popular}
                onChange={(e) => setForm((f) => ({ ...f, is_popular: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_popular" className="cursor-pointer">Mark as Popular article</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingArticle(null); setForm(EMPTY_FORM); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingArticle ? "Update Article" : "Create Article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewArticle?.title}</DialogTitle>
          </DialogHeader>
          {previewArticle && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{categoryName(previewArticle.category)}</Badge>
                <Badge variant={statusVariant(previewArticle.status)} className="capitalize">{previewArticle.status}</Badge>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{previewArticle.views.toLocaleString()} views</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Updated {new Date(previewArticle.updated_at).toLocaleDateString()}</span>
              </div>
              {previewArticle.description && (
                <p className="text-muted-foreground border-l-2 pl-3">{previewArticle.description}</p>
              )}
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{previewArticle.content}</pre>
              </div>
              {previewArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t">
                  {previewArticle.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            {previewArticle && (
              <Button onClick={() => { setPreviewOpen(false); openEdit(previewArticle); }}>
                <Edit className="mr-2 h-4 w-4" /> Edit Article
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
