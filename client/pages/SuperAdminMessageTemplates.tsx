import React, { useState, useEffect } from "react";
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
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  FileText,
  Edit,
  Trash2,
  Copy,
  Eye,
  MoreHorizontal,
  Filter,
  Search,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Shield,
  Megaphone,
  Wrench,
  Star,
  GitBranch,
  Users,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";
import supabaseClient from "@/lib/supabaseClient";

interface MessageTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  category: "system" | "marketing" | "support" | "emergency";
  variables: string[];
  version: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  usageCount: number;
  description?: string;
}

interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  pendingApproval: number;
  totalUsage: number;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "system-maintenance",
    name: "System Maintenance",
    title: "Scheduled System Maintenance",
    content:
      "We will be performing scheduled maintenance on {{date}} from {{start_time}} to {{end_time}} {{timezone}}. During this time, {{affected_services}} may be temporarily unavailable. We apologize for any inconvenience.",
    type: "warning",
    category: "system",
    variables: [
      "date",
      "start_time",
      "end_time",
      "timezone",
      "affected_services",
    ],
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "System",
    approvalStatus: "approved",
    approvedBy: "System",
    approvedAt: "2024-01-01T00:00:00Z",
    usageCount: 15,
    description: "Template for scheduled maintenance notifications",
  },
  {
    id: "feature-launch",
    name: "New Feature Launch",
    title: "Exciting New Feature: {{feature_name}}",
    content:
      "We're thrilled to announce the launch of {{feature_name}}! {{feature_description}} You can access this new feature by {{access_instructions}}. Check out our documentation for more details.",
    type: "success",
    category: "marketing",
    variables: ["feature_name", "feature_description", "access_instructions"],
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "System",
    approvalStatus: "approved",
    approvedBy: "System",
    approvedAt: "2024-01-01T00:00:00Z",
    usageCount: 8,
    description: "Template for announcing new feature releases",
  },
  {
    id: "security-alert",
    name: "Security Alert",
    title: "Important Security Alert",
    content:
      "We've detected {{security_issue}} and have taken immediate action to {{action_taken}}. Your account remains secure. Please {{user_action}} as a precautionary measure. Contact support if you have any concerns.",
    type: "error",
    category: "emergency",
    variables: ["security_issue", "action_taken", "user_action"],
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "System",
    approvalStatus: "approved",
    approvedBy: "System",
    approvedAt: "2024-01-01T00:00:00Z",
    usageCount: 3,
    description: "Template for security-related alerts",
  },
  {
    id: "support-update",
    name: "Support Hours Update",
    title: "Support Hours Update",
    content:
      "Our support hours have been updated. We're now available {{new_hours}} {{timezone}}. You can still submit tickets anytime through {{ticket_system}}, and we'll respond during business hours.",
    type: "info",
    category: "support",
    variables: ["new_hours", "timezone", "ticket_system"],
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "System",
    approvalStatus: "approved",
    approvedBy: "System",
    approvedAt: "2024-01-01T00:00:00Z",
    usageCount: 5,
    description: "Template for support-related updates",
  },
  {
    id: "system-upgrade",
    name: "System Upgrade",
    title: "System Upgrade Complete",
    content:
      "We've successfully upgraded our system to improve {{improvement_areas}}. You may notice {{visible_changes}}. If you experience any issues, please contact our support team.",
    type: "success",
    category: "system",
    variables: ["improvement_areas", "visible_changes"],
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "System",
    approvalStatus: "approved",
    approvedBy: "System",
    approvedAt: "2024-01-01T00:00:00Z",
    usageCount: 12,
    description: "Template for system upgrade notifications",
  },
];

export default function SuperAdminMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats>({
    totalTemplates: 0,
    activeTemplates: 0,
    pendingApproval: 0,
    totalUsage: 0,
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<MessageTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    content: "",
    type: "info" as MessageTemplate["type"],
    category: "system" as MessageTemplate["category"],
    description: "",
    variables: [] as string[],
    newVariable: "",
  });

  useEffect(() => {
    loadTemplateData();
  }, []);

  const loadTemplateData = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("notification_templates")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const allTemplates: MessageTemplate[] = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        title: r.title,
        content: r.content,
        type: r.type,
        category: r.category,
        variables: r.variables ?? [],
        version: r.version ?? 1,
        isActive: r.is_active ?? false,
        isDefault: r.is_default ?? false,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        createdBy: r.created_by ?? "Super Admin",
        approvalStatus: r.approval_status ?? "pending",
        approvedBy: r.approved_by,
        approvedAt: r.approved_at,
        usageCount: r.usage_count ?? 0,
        description: r.description,
      }));

      setTemplates(allTemplates);

      const totalUsage = allTemplates.reduce((sum, t) => sum + t.usageCount, 0);
      setStats({
        totalTemplates: allTemplates.length,
        activeTemplates: allTemplates.filter((t) => t.isActive).length,
        pendingApproval: allTemplates.filter((t) => t.approvalStatus === "pending").length,
        totalUsage,
      });
    } catch (err: any) {
      console.error("Failed to load templates:", err?.message);
      toast.error("Failed to load templates");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      title: "",
      content: "",
      type: "info",
      category: "system",
      description: "",
      variables: [],
      newVariable: "",
    });
    setEditingTemplate(null);
  };

  const extractVariables = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1].trim())) {
        variables.push(match[1].trim());
      }
    }
    return variables;
  };

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.title.trim() || !formData.content.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const titleVars = extractVariables(formData.title);
    const contentVars = extractVariables(formData.content);
    const allVariables = [...new Set([...titleVars, ...contentVars, ...formData.variables])];

    try {
      const { error } = await supabaseClient.from("notification_templates").insert({
        name: formData.name,
        title: formData.title,
        content: formData.content,
        type: formData.type,
        category: formData.category,
        variables: allVariables,
        version: 1,
        is_active: false,
        is_default: false,
        approval_status: "pending",
        created_by: "Super Admin",
        usage_count: 0,
        description: formData.description,
      });
      if (error) throw error;
      toast.success("Template created and submitted for approval!");
      setShowCreateDialog(false);
      resetForm();
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to create template: " + (err?.message ?? "Unknown error"));
    }
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      title: template.title,
      content: template.content,
      type: template.type,
      category: template.category,
      description: template.description || "",
      variables: template.variables,
      newVariable: "",
    });
    setShowCreateDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    const titleVars = extractVariables(formData.title);
    const contentVars = extractVariables(formData.content);
    const allVariables = [...new Set([...titleVars, ...contentVars, ...formData.variables])];

    try {
      const { error } = await supabaseClient
        .from("notification_templates")
        .update({
          name: formData.name,
          title: formData.title,
          content: formData.content,
          type: formData.type,
          category: formData.category,
          variables: allVariables,
          version: editingTemplate.version + 1,
          updated_at: new Date().toISOString(),
          approval_status: editingTemplate.isDefault ? "approved" : "pending",
          description: formData.description,
        })
        .eq("id", editingTemplate.id);
      if (error) throw error;
      toast.success("Template updated successfully!");
      setShowCreateDialog(false);
      resetForm();
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to update template: " + (err?.message ?? "Unknown error"));
    }
  };

  const handleApproveTemplate = async (templateId: string) => {
    try {
      const { error } = await supabaseClient
        .from("notification_templates")
        .update({
          approval_status: "approved",
          is_active: true,
          approved_by: "Super Admin",
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId);
      if (error) throw error;
      toast.success("Template approved and activated!");
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to approve template");
    }
  };

  const handleRejectTemplate = async (templateId: string) => {
    try {
      const { error } = await supabaseClient
        .from("notification_templates")
        .update({ approval_status: "rejected", is_active: false, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      if (error) throw error;
      toast.success("Template rejected!");
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to reject template");
    }
  };

  const handleToggleActive = async (templateId: string) => {
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;
    try {
      const { error } = await supabaseClient
        .from("notification_templates")
        .update({ is_active: !t.isActive, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      if (error) throw error;
      toast.success("Template status updated!");
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to update template status");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template?.isDefault) {
      toast.error("Cannot delete default templates");
      return;
    }
    try {
      const { error } = await supabaseClient
        .from("notification_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
      toast.success("Template deleted successfully!");
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to delete template");
    }
  };

  const handleDuplicateTemplate = async (template: MessageTemplate) => {
    try {
      const { error } = await supabaseClient.from("notification_templates").insert({
        name: `${template.name} (Copy)`,
        title: template.title,
        content: template.content,
        type: template.type,
        category: template.category,
        variables: template.variables,
        version: 1,
        is_active: false,
        is_default: false,
        approval_status: "pending",
        created_by: "Super Admin",
        usage_count: 0,
        description: template.description,
      });
      if (error) throw error;
      toast.success("Template duplicated successfully!");
      loadTemplateData();
    } catch (err: any) {
      toast.error("Failed to duplicate template");
    }
  };

  const addVariable = () => {
    if (
      formData.newVariable.trim() &&
      !formData.variables.includes(formData.newVariable.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        variables: [...prev.variables, prev.newVariable.trim()],
        newVariable: "",
      }));
    }
  };

  const removeVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      variables: prev.variables.filter((v) => v !== variable),
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "system":
        return <Wrench className="h-4 w-4" />;
      case "marketing":
        return <Megaphone className="h-4 w-4" />;
      case "support":
        return <Users className="h-4 w-4" />;
      case "emergency":
        return <Shield className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTemplates = templates.filter((template) => {
    if (categoryFilter !== "all" && template.category !== categoryFilter)
      return false;
    if (statusFilter !== "all" && template.approvalStatus !== statusFilter)
      return false;
    if (
      searchTerm &&
      !template.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !template.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !template.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Create and manage reusable message templates with variables
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Template</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate
                    ? "Edit Template"
                    : "Create Message Template"}
                </DialogTitle>
                <DialogDescription>
                  {editingTemplate
                    ? "Update the template details and variables."
                    : "Create a reusable message template with placeholder variables."}
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Template Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., System Maintenance"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value: any) =>
                          setFormData((prev) => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Brief description of when to use this template..."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">Message Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) =>
                        setFormData((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Information</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Message Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="e.g., Scheduled System Maintenance"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {`{{variable_name}}`} for placeholders
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="content">Message Content *</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="e.g., We will be performing maintenance on {{date}} from {{start_time}} to {{end_time}}..."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables will be automatically detected from your content
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="variables" className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Detected Variables</Label>
                    <div className="flex flex-wrap gap-2">
                      {extractVariables(
                        formData.title + " " + formData.content,
                      ).map((variable) => (
                        <Badge
                          key={variable}
                          variant="secondary"
                          className="gap-1"
                        >
                          {variable}
                          <span className="text-xs text-muted-foreground">
                            auto
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Manual Variables</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.newVariable}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            newVariable: e.target.value,
                          }))
                        }
                        placeholder="Add custom variable..."
                        onKeyPress={(e) => e.key === "Enter" && addVariable()}
                      />
                      <Button
                        type="button"
                        onClick={addVariable}
                        variant="outline"
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.variables.map((variable) => (
                        <Badge
                          key={variable}
                          variant="outline"
                          className="gap-1"
                        >
                          {variable}
                          <button
                            onClick={() => removeVariable(variable)}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={
                    editingTemplate
                      ? handleUpdateTemplate
                      : handleCreateTemplate
                  }
                >
                  {editingTemplate ? "Update Template" : "Create Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Templates
                  </p>
                  <p className="text-2xl font-bold">{stats.totalTemplates}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Templates
                  </p>
                  <p className="text-2xl font-bold">{stats.activeTemplates}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Pending Approval
                  </p>
                  <p className="text-2xl font-bold">{stats.pendingApproval}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Usage</p>
                  <p className="text-2xl font-bold">{stats.totalUsage}</p>
                </div>
                <Star className="h-8 w-8 text-purple-500" />
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
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Message Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="responsive-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Version
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Usage
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate text-sm sm:text-base">
                              {template.name}
                            </p>
                            {template.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                            {!template.isActive && (
                              <Badge variant="outline" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {template.title}
                          </p>
                          <div className="sm:hidden mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(template.category)}
                              <span className="text-xs text-muted-foreground capitalize">
                                {template.category}
                              </span>
                            </div>
                            <div className="md:hidden flex items-center gap-2">
                              {getTypeIcon(template.type)}
                              <span className="text-xs text-muted-foreground capitalize">
                                {template.type}
                              </span>
                            </div>
                            <div className="lg:hidden text-xs text-muted-foreground">
                              v{template.version} | Used {template.usageCount}{" "}
                              times
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(template.category)}
                          <span className="capitalize">
                            {template.category}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(template.type)}
                          <span className="capitalize">{template.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(template.approvalStatus)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          <span>v{template.version}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span>{template.usageCount} times</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setPreviewTemplate(template);
                                setShowPreviewDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicateTemplate(template)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            {template.approvalStatus === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleApproveTemplate(template.id)
                                  }
                                  className="text-green-600 focus:text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleRejectTemplate(template.id)
                                  }
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {template.approvalStatus === "approved" && (
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(template.id)}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                {template.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                            )}
                            {!template.isDefault && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDeleteTemplate(template.id)
                                }
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
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

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                Preview of the template with variable placeholders
              </DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Template Information</Label>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {previewTemplate.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(previewTemplate.category)}
                        <span className="text-sm capitalize">
                          {previewTemplate.category}
                        </span>
                      </div>
                    </div>
                    {previewTemplate.description && (
                      <p className="text-sm text-muted-foreground">
                        {previewTemplate.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Version {previewTemplate.version}</span>
                      <span>Used {previewTemplate.usageCount} times</span>
                      {getStatusBadge(previewTemplate.approvalStatus)}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Message Preview</Label>
                  <div className="bg-muted/30 p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">
                      {previewTemplate.title}
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {previewTemplate.content}
                    </p>
                  </div>
                </div>
                {previewTemplate.variables.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Variables ({previewTemplate.variables.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {previewTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="outline">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(false)}
              >
                Close
              </Button>
              {previewTemplate && (
                <Button
                  onClick={() => {
                    setShowPreviewDialog(false);
                    handleEditTemplate(previewTemplate);
                  }}
                >
                  Edit Template
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
