// @ts-nocheck - Temporary suppression of type errors
import React, { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Send,
  Clock,
  Users,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Target,
  TrendingUp,
  Monitor,
  X,
  FileText,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate, formatDateTime } from "@/lib/dateUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabaseClient } from "@/lib/supabaseClient";

interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  target_audience: string;
  custom_user_ids?: string[];
  scheduled_for?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  sent_at?: string;
  view_count: number;
  dismiss_count: number;
  is_active: boolean;
}

interface BroadcastStats {
  totalMessages: number;
  activeMessages: number;
  totalViews: number;
  totalDismissals: number;
  averageEngagement: number;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  type: string;
  category: string;
  status: string;
  variables: string[];
  usage_count: number;
}

export default function SuperAdminBroadcast() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [stats, setStats] = useState<BroadcastStats>({
    totalMessages: 0,
    activeMessages: 0,
    totalViews: 0,
    totalDismissals: 0,
    averageEngagement: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMessage, setEditingMessage] = useState<BroadcastMessage | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showTemplateVars, setShowTemplateVars] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info" as const,
    targetAudience: "all" as const,
    scheduledFor: "",
    expiresAt: "",
    isImmediate: true,
  });

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("broadcast_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      setMessages(rows);

      const totalViews = rows.reduce((sum, m) => sum + (m.view_count || 0), 0);
      const totalDismissals = rows.reduce((sum, m) => sum + (m.dismiss_count || 0), 0);

      setStats({
        totalMessages: rows.length,
        activeMessages: rows.filter((m) => m.is_active).length,
        totalViews,
        totalDismissals,
        averageEngagement:
          totalViews > 0 ? ((totalViews - totalDismissals) / totalViews) * 100 : 0,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load broadcast messages");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data } = await supabaseClient
        .from("message_templates")
        .select("id, name, subject, content, type, category, status, variables, usage_count")
        .eq("status", "active")
        .order("name");
      setTemplates(data || []);
    } catch {
      // silently fail – templates are optional
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    fetchTemplates();
  }, [fetchMessages, fetchTemplates]);

  const handleTemplateSelect = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setFormData((prev) => ({
      ...prev,
      title: template.subject || template.name,
      content: template.content,
      type: (template.type === "in-app" ? "info" : template.type) as any,
      targetAudience: prev.targetAudience,
    }));

    const vars: Record<string, string> = {};
    (template.variables || []).forEach((v) => (vars[v] = ""));
    setTemplateVariables(vars);
    setShowTemplateVars((template.variables || []).length > 0);

    // Increment usage count (non-critical — log but don't block the UI)
    const { error: usageError } = await supabaseClient
      .from("message_templates")
      .update({ usage_count: (template.usage_count || 0) + 1, last_used: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", templateId);
    if (usageError) console.error("[Broadcast] Failed to update template usage count:", usageError.message);

    toast.success(`Template "${template.name}" applied!`);
    fetchTemplates();
  };

  const fillTemplateVariables = () => {
    let filledTitle = formData.title;
    let filledContent = formData.content;

    Object.entries(templateVariables).forEach(([variable, value]) => {
      const placeholder = `{{${variable}}}`;
      filledTitle = filledTitle.replace(new RegExp(placeholder, "g"), value || placeholder);
      filledContent = filledContent.replace(new RegExp(placeholder, "g"), value || placeholder);
    });

    setFormData((prev) => ({ ...prev, title: filledTitle, content: filledContent }));
    setShowTemplateVars(false);
    setTemplateVariables({});
    toast.success("Template variables filled!");
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      type: "info",
      targetAudience: "all",
      scheduledFor: "",
      expiresAt: "",
      isImmediate: true,
    });
    setEditingMessage(null);
    setShowPreview(false);
    setSelectedTemplate("");
    setShowTemplateVars(false);
    setTemplateVariables({});
  };

  const handlePreviewMessage = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Please fill in title and content to preview");
      return;
    }
    setShowPreview(true);
  };

  const handleCreateMessage = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        target_audience: formData.targetAudience,
        scheduled_for: formData.isImmediate ? null : formData.scheduledFor || null,
        expires_at: formData.expiresAt || null,
        created_by: "Super Admin",
        status: formData.isImmediate ? "sent" : "scheduled",
        sent_at: formData.isImmediate ? now : null,
        view_count: 0,
        dismiss_count: 0,
        is_active: formData.isImmediate,
      };

      const { error } = await supabaseClient.from("broadcast_messages").insert([payload]);
      if (error) throw error;

      toast.success(
        formData.isImmediate
          ? "Broadcast message sent successfully!"
          : "Broadcast message scheduled successfully!"
      );
      setShowCreateDialog(false);
      resetForm();
      fetchMessages();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create broadcast message");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditMessage = (message: BroadcastMessage) => {
    setEditingMessage(message);
    setFormData({
      title: message.title,
      content: message.content,
      type: message.type,
      targetAudience: message.target_audience as any,
      scheduledFor: message.scheduled_for
        ? message.scheduled_for.slice(0, 16)
        : "",
      expiresAt: message.expires_at ? message.expires_at.slice(0, 16) : "",
      isImmediate: !message.scheduled_for,
    });
    setShowCreateDialog(true);
  };

  const handleUpdateMessage = async () => {
    if (!editingMessage) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        target_audience: formData.targetAudience,
        scheduled_for: formData.isImmediate ? null : formData.scheduledFor || null,
        expires_at: formData.expiresAt || null,
        status: formData.isImmediate ? "sent" : "scheduled",
        sent_at:
          formData.isImmediate && !editingMessage.sent_at ? now : editingMessage.sent_at,
        is_active: formData.isImmediate,
        updated_at: now,
      };

      const { error } = await supabaseClient
        .from("broadcast_messages")
        .update(payload)
        .eq("id", editingMessage.id);

      if (error) throw error;

      toast.success("Broadcast message updated successfully!");
      setShowCreateDialog(false);
      resetForm();
      fetchMessages();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update broadcast message");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Delete this broadcast message?")) return;
    try {
      const { error } = await supabaseClient
        .from("broadcast_messages")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Broadcast message deleted successfully!");
      fetchMessages();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete message");
    }
  };

  const handleCancelMessage = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from("broadcast_messages")
        .update({ status: "cancelled", is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Broadcast message cancelled successfully!");
      fetchMessages();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to cancel message");
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
      case "sent":
        return <Badge className="bg-green-500">Sent</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500">Scheduled</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAudienceText = (targetAudience: string) => {
    switch (targetAudience) {
      case "all": return "All Users";
      case "business-owners": return "Business Owners";
      case "agency-admins": return "Agency Admins";
      case "staff": return "Staff Members";
      case "custom": return "Custom Selection";
      default: return targetAudience;
    }
  };

  const getPreviewAlertStyle = (type: string) => {
    switch (type) {
      case "info": return "border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600";
      case "warning": return "border-yellow-200 bg-yellow-50 text-yellow-800 [&>svg]:text-yellow-600";
      case "success": return "border-green-200 bg-green-50 text-green-800 [&>svg]:text-green-600";
      default: return "";
    }
  };

  const filteredMessages = messages.filter((message) => {
    if (statusFilter !== "all" && message.status !== statusFilter) return false;
    if (typeFilter !== "all" && message.type !== typeFilter) return false;
    if (
      searchTerm &&
      !message.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !message.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const skeletonRows = Array.from({ length: 5 });

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Broadcast Messages</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Send alerts and notifications to users across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMessages} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Broadcast</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMessage ? "Edit Broadcast Message" : "Create Broadcast Message"}
                </DialogTitle>
                <DialogDescription>
                  {editingMessage
                    ? "Update the broadcast message details."
                    : "Send a message or alert to users across the platform."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Template Selection */}
                {templates.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Use Template (Optional)</Label>
                    <div className="flex gap-2">
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Choose a template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>{template.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {template.category}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => selectedTemplate && handleTemplateSelect(selectedTemplate)}
                        disabled={!selectedTemplate}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                )}

                {showTemplateVars && Object.keys(templateVariables).length > 0 && (
                  <div className="grid gap-2 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label>Fill Template Variables</Label>
                      <Button type="button" size="sm" onClick={fillTemplateVariables}>
                        Apply Variables
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      {Object.keys(templateVariables).map((variable) => (
                        <div key={variable} className="grid gap-1">
                          <Label className="text-xs font-mono">{`{{${variable}}}`}</Label>
                          <Input
                            placeholder={`Enter value for ${variable}...`}
                            value={templateVariables[variable]}
                            onChange={(e) =>
                              setTemplateVariables((prev) => ({
                                ...prev,
                                [variable]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter message title..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Enter message content..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Message Type</Label>
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
                  <div className="grid gap-2">
                    <Label htmlFor="audience">Target Audience</Label>
                    <Select
                      value={formData.targetAudience}
                      onValueChange={(value: any) =>
                        setFormData((prev) => ({ ...prev, targetAudience: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="business-owners">Business Owners</SelectItem>
                        <SelectItem value="agency-admins">Agency Admins</SelectItem>
                        <SelectItem value="staff">Staff Members</SelectItem>
                        <SelectItem value="custom">Custom Selection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="immediate"
                    checked={formData.isImmediate}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isImmediate: !!checked }))
                    }
                  />
                  <Label htmlFor="immediate">Send immediately</Label>
                </div>
                {!formData.isImmediate && (
                  <div className="grid gap-2">
                    <Label htmlFor="scheduledFor">Schedule For</Label>
                    <Input
                      id="scheduledFor"
                      type="datetime-local"
                      value={formData.scheduledFor}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, scheduledFor: e.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, expiresAt: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={handlePreviewMessage}
                  className="gap-2"
                >
                  <Monitor className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  onClick={editingMessage ? handleUpdateMessage : handleCreateMessage}
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingMessage
                    ? "Update Message"
                    : formData.isImmediate
                    ? "Send Now"
                    : "Schedule Message"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Message Preview
            </DialogTitle>
            <DialogDescription>
              This is how your broadcast message will appear to users on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-muted/30 p-4 rounded-lg border-2 border-dashed border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-4 text-center">User Dashboard Preview</p>
              <Alert
                variant={formData.type === "error" ? "destructive" : "default"}
                className={`relative ${formData.type !== "error" ? getPreviewAlertStyle(formData.type) : ""}`}
              >
                {getTypeIcon(formData.type)}
                <div className="flex-1 pr-8">
                  <AlertTitle>{formData.title || "Your Message Title"}</AlertTitle>
                  <AlertDescription className="text-sm mb-3">
                    {formData.content || "Your message content will appear here..."}
                  </AlertDescription>
                  <div className="flex items-center gap-2 text-xs opacity-75">
                    <Calendar className="h-3 w-3" />
                    <span>Just now</span>
                    <Users className="h-3 w-3 ml-2" />
                    <span>{getAudienceText(formData.targetAudience)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" disabled>
                  <X className="h-4 w-4" />
                </Button>
              </Alert>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Back to Edit
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false);
                editingMessage ? handleUpdateMessage() : handleCreateMessage();
              }}
              disabled={isSaving}
            >
              {editingMessage ? "Update Message" : formData.isImmediate ? "Send Now" : "Schedule Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold">{stats.totalMessages}</p>
              </div>
              <Send className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Messages</p>
                <p className="text-2xl font-bold">{stats.activeMessages}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
              </div>
              <Eye className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
                <p className="text-2xl font-bold">{Math.round(stats.averageEngagement)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="info">Information</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Broadcast Messages</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="responsive-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Audience</TableHead>
                  <TableHead className="hidden lg:table-cell">Engagement</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? skeletonRows.map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(7)].map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted animate-pulse rounded w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filteredMessages.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          No broadcast messages found. Create one to get started.
                        </TableCell>
                      </TableRow>
                    )
                  : filteredMessages.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium truncate text-sm sm:text-base">
                              {message.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {message.content.substring(0, 80)}
                              {message.content.length > 80 ? "..." : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(message.type)}
                            <span className="capitalize">{message.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(message.status)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{getAudienceText(message.target_audience)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm">
                            <div>Views: {message.view_count}</div>
                            <div>Dismissed: {message.dismiss_count}</div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm">
                            {formatSystemDate(message.created_at)}
                            <p className="text-xs text-muted-foreground">{message.created_by}</p>
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
                              <DropdownMenuItem onClick={() => handleEditMessage(message)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {message.status === "scheduled" && (
                                <DropdownMenuItem
                                  onClick={() => handleCancelMessage(message.id)}
                                  className="text-yellow-600 focus:text-yellow-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteMessage(message.id)}
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
  );
}
