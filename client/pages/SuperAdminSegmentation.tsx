import React, { useState, useEffect, useCallback } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Users,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  Target,
  TrendingUp,
  Filter,
  Search,
  Download,
  RefreshCw,
  UserCheck,
  UserX,
  PieChart,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";
import { supabaseClient } from "@/lib/supabaseClient";

interface SegmentCriteria {
  field: string;
  operator: string;
  value: string;
  type: "user" | "behavior" | "engagement" | "business";
  logicalOperator?: "AND" | "OR";
}

interface UserSegment {
  id: string;
  name: string;
  description: string | null;
  criteria: SegmentCriteria[];
  tags: string[] | null;
  user_count: number;
  is_active: boolean;
  is_static: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_calculated: string | null;
}

const CRITERIA_FIELDS = {
  user: [
    { value: "role", label: "User Role", type: "string" },
    { value: "signupDate", label: "Signup Date", type: "date" },
    { value: "lastLogin", label: "Last Login", type: "date" },
    { value: "subscriptionTier", label: "Subscription Tier", type: "string" },
    { value: "location", label: "Location", type: "string" },
    { value: "companySize", label: "Company Size", type: "string" },
    { value: "industry", label: "Industry", type: "string" },
  ],
  behavior: [
    { value: "projectCount", label: "Project Count", type: "number" },
    { value: "reviewCount", label: "Review Count", type: "number" },
    { value: "loginCount", label: "Login Count", type: "number" },
    { value: "daysInactive", label: "Days Inactive", type: "number" },
    { value: "featureUsage", label: "Feature Usage", type: "string" },
  ],
  engagement: [
    { value: "engagementScore", label: "Engagement Score", type: "number" },
    { value: "messageViews", label: "Message Views", type: "number" },
    { value: "messageDismissals", label: "Message Dismissals", type: "number" },
    { value: "notificationPrefs", label: "Notification Preferences", type: "boolean" },
  ],
  business: [
    { value: "revenue", label: "Revenue Generated", type: "number" },
    { value: "clientCount", label: "Client Count", type: "number" },
    { value: "businessAge", label: "Business Age (months)", type: "number" },
    { value: "businessType", label: "Business Type", type: "string" },
  ],
};

const OPERATORS = {
  string: [
    { value: "equals", label: "Equals" },
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
    { value: "in", label: "Is one of" },
    { value: "not_in", label: "Is not one of" },
  ],
  number: [
    { value: "equals", label: "Equals" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
    { value: "between", label: "Between" },
    { value: "greater_equal", label: "≥" },
    { value: "less_equal", label: "≤" },
  ],
  date: [
    { value: "equals", label: "On date" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "between", label: "Between" },
    { value: "days_ago", label: "Days ago" },
    { value: "weeks_ago", label: "Weeks ago" },
  ],
  boolean: [
    { value: "is_true", label: "Is true" },
    { value: "is_false", label: "Is false" },
  ],
};

const EMPTY_FORM = {
  name: "",
  description: "",
  criteria: [] as SegmentCriteria[],
  is_active: true,
  is_static: false,
  tags: [] as string[],
  newTag: "",
};

function getFieldType(field: string): string {
  for (const category of Object.values(CRITERIA_FIELDS)) {
    const found = category.find((f) => f.value === field);
    if (found) return found.type;
  }
  return "string";
}

function getSizeCategory(count: number) {
  if (count > 300) return "large";
  if (count > 100) return "medium";
  return "small";
}

function getSizeBadge(count: number) {
  const cat = getSizeCategory(count);
  if (cat === "large") return <Badge className="bg-purple-500">Large</Badge>;
  if (cat === "medium") return <Badge className="bg-blue-500">Medium</Badge>;
  return <Badge variant="secondary">Small</Badge>;
}

export default function SuperAdminSegmentation() {
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<UserSegment | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [segRes, userRes] = await Promise.all([
        supabaseClient
          .from("user_segments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("users")
          .select("id", { count: "exact", head: true }),
      ]);

      if (segRes.error) throw segRes.error;
      setSegments(segRes.data || []);
      setTotalUsers(userRes.count || 0);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load segments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = {
    totalSegments: segments.length,
    activeSegments: segments.filter((s) => s.is_active).length,
    totalUsers,
    segmentedUsers: Math.min(
      segments.reduce((s, seg) => s + (seg.user_count || 0), 0),
      totalUsers
    ),
    averageSegmentSize:
      segments.length > 0
        ? Math.round(segments.reduce((s, seg) => s + (seg.user_count || 0), 0) / segments.length)
        : 0,
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingSegment(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (segment: UserSegment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || "",
      criteria: segment.criteria || [],
      is_active: segment.is_active,
      is_static: segment.is_static,
      tags: segment.tags || [],
      newTag: "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a segment name");
      return;
    }
    if (formData.criteria.length === 0) {
      toast.error("Please add at least one criteria");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        criteria: formData.criteria,
        tags: formData.tags.length > 0 ? formData.tags : null,
        is_active: formData.is_active,
        is_static: formData.is_static,
        updated_at: new Date().toISOString(),
      };

      if (editingSegment) {
        const { error } = await supabaseClient
          .from("user_segments")
          .update({ ...payload, last_calculated: new Date().toISOString() })
          .eq("id", editingSegment.id);
        if (error) throw error;
        toast.success("Segment updated successfully!");
      } else {
        const { error } = await supabaseClient
          .from("user_segments")
          .insert([{ ...payload, created_by: "Super Admin", user_count: 0 }]);
        if (error) throw error;
        toast.success("Segment created successfully!");
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save segment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (segment: UserSegment) => {
    try {
      const { error } = await supabaseClient
        .from("user_segments")
        .update({ is_active: !segment.is_active, updated_at: new Date().toISOString() })
        .eq("id", segment.id);
      if (error) throw error;
      toast.success(`Segment ${!segment.is_active ? "activated" : "deactivated"}!`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update segment");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user segment?")) return;
    try {
      const { error } = await supabaseClient
        .from("user_segments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Segment deleted!");
      fetchData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete segment");
    }
  };

  const handleDuplicate = async (segment: UserSegment) => {
    try {
      const { error } = await supabaseClient.from("user_segments").insert([
        {
          name: `${segment.name} (Copy)`,
          description: segment.description,
          criteria: segment.criteria,
          tags: segment.tags,
          is_active: false,
          is_static: segment.is_static,
          created_by: "Super Admin",
          user_count: 0,
        },
      ]);
      if (error) throw error;
      toast.success("Segment duplicated!");
      fetchData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to duplicate segment");
    }
  };

  const handleRecalculate = async (segment: UserSegment) => {
    try {
      const { error } = await supabaseClient
        .from("user_segments")
        .update({ last_calculated: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", segment.id);
      if (error) throw error;
      toast.success("Segment recalculated!");
      fetchData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to recalculate");
    }
  };

  const handleExport = (segment: UserSegment) => {
    const blob = new Blob(
      [JSON.stringify({ segment, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segment-${segment.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Segment exported!");
  };

  // Criteria helpers
  const addCriteria = () =>
    setFormData((p) => ({
      ...p,
      criteria: [
        ...p.criteria,
        { field: "", operator: "", value: "", type: "user", logicalOperator: p.criteria.length > 0 ? "AND" : undefined },
      ],
    }));

  const updateCriteria = (index: number, field: string, value: any) =>
    setFormData((p) => ({
      ...p,
      criteria: p.criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));

  const removeCriteria = (index: number) =>
    setFormData((p) => ({ ...p, criteria: p.criteria.filter((_, i) => i !== index) }));

  const addTag = () => {
    const tag = formData.newTag.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((p) => ({ ...p, tags: [...p.tags, tag], newTag: "" }));
    }
  };

  const removeTag = (tag: string) =>
    setFormData((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));

  const filteredSegments = segments.filter((segment) => {
    if (statusFilter === "active" && !segment.is_active) return false;
    if (statusFilter === "inactive" && segment.is_active) return false;
    if (sizeFilter !== "all" && getSizeCategory(segment.user_count) !== sizeFilter) return false;
    if (
      searchTerm &&
      !segment.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(segment.description || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(segment.tags || []).some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
    )
      return false;
    return true;
  });

  const skeletonRows = Array.from({ length: 4 });

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              User Segmentation
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Create and manage user segments for targeted messaging campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={openCreate} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Segment</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSegment ? "Edit User Segment" : "Create User Segment"}
              </DialogTitle>
              <DialogDescription>
                Define criteria to automatically group users for targeted messaging
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="criteria">Criteria</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Basic Info */}
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Segment Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., High-Value Customers"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Describe this user segment..."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.newTag}
                        onChange={(e) => setFormData((p) => ({ ...p, newTag: e.target.value }))}
                        placeholder="Add a tag..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" onClick={addTag} variant="outline">
                        Add
                      </Button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {tag}
                            <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500">
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Criteria */}
              <TabsContent value="criteria" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Segment Criteria</h3>
                    <p className="text-sm text-muted-foreground">
                      Define conditions to identify users for this segment
                    </p>
                  </div>
                  <Button onClick={addCriteria} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Criteria
                  </Button>
                </div>
                {formData.criteria.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Target className="h-8 w-8 mx-auto mb-2" />
                    <p>No criteria — add at least one to define the segment</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.criteria.map((criteria, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        {index > 0 && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={criteria.logicalOperator || "AND"}
                              onValueChange={(v) => updateCriteria(index, "logicalOperator", v)}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">previous condition</span>
                          </div>
                        )}
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-3">
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={criteria.type}
                              onValueChange={(v) => updateCriteria(index, "type", v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User Info</SelectItem>
                                <SelectItem value="behavior">Behavior</SelectItem>
                                <SelectItem value="engagement">Engagement</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Field</Label>
                            <Select
                              value={criteria.field}
                              onValueChange={(v) => updateCriteria(index, "field", v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {CRITERIA_FIELDS[criteria.type as keyof typeof CRITERIA_FIELDS]?.map((f) => (
                                  <SelectItem key={f.value} value={f.value}>
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Operator</Label>
                            <Select
                              value={criteria.operator}
                              onValueChange={(v) => updateCriteria(index, "operator", v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {criteria.field &&
                                  OPERATORS[
                                    getFieldType(criteria.field) as keyof typeof OPERATORS
                                  ]?.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>
                                      {op.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Value</Label>
                            <Input
                              value={criteria.value}
                              onChange={(e) => updateCriteria(index, "value", e.target.value)}
                              placeholder="Enter value..."
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCriteria(index)}
                              className="h-9 w-9 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Settings */}
              <TabsContent value="settings" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Active Segment</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable this segment for use in campaigns
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Static Segment</Label>
                    <p className="text-sm text-muted-foreground">
                      Don't update membership automatically (manual only)
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_static}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, is_static: v }))}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : editingSegment ? "Update Segment" : "Create Segment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Segments</p>
                  <p className="text-2xl font-bold">{stats.totalSegments}</p>
                </div>
                <Target className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Segments</p>
                  <p className="text-2xl font-bold">{stats.activeSegments}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Segmented Users</p>
                  <p className="text-2xl font-bold">{stats.segmentedUsers.toLocaleString()}</p>
                </div>
                <Filter className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Size</p>
                  <p className="text-2xl font-bold">{stats.averageSegmentSize}</p>
                </div>
                <PieChart className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search segments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    <SelectItem value="large">Large (300+)</SelectItem>
                    <SelectItem value="medium">Medium (100-300)</SelectItem>
                    <SelectItem value="small">Small (&lt;100)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Segments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">User Segments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="responsive-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead className="hidden sm:table-cell">Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Criteria</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? skeletonRows.map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(6)].map((__, j) => (
                            <TableCell key={j}>
                              <div className="h-4 bg-muted animate-pulse rounded w-24" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : filteredSegments.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            No segments found. Create one to get started.
                          </TableCell>
                        </TableRow>
                      )
                    : filteredSegments.map((segment) => (
                        <TableRow key={segment.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate text-sm sm:text-base">
                                {segment.name}
                              </p>
                              {segment.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {segment.description}
                                </p>
                              )}
                              {(segment.tags || []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(segment.tags || []).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {(segment.user_count || 0).toLocaleString()}
                              </span>
                              {getSizeBadge(segment.user_count || 0)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {segment.is_active ? (
                                <Badge className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                              {segment.is_static && (
                                <Badge variant="outline" className="text-xs">Static</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm">
                              {(segment.criteria || []).length} criteria
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">
                              <div>{formatSystemDate(segment.updated_at)}</div>
                              {segment.last_calculated && (
                                <div className="text-xs text-muted-foreground">
                                  Calculated: {formatSystemDate(segment.last_calculated)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(segment)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRecalculate(segment)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Recalculate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(segment)}>
                                  {segment.is_active ? (
                                    <UserX className="h-4 w-4 mr-2" />
                                  ) : (
                                    <UserCheck className="h-4 w-4 mr-2" />
                                  )}
                                  {segment.is_active ? "Deactivate" : "Activate"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport(segment)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Export
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(segment)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(segment.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
