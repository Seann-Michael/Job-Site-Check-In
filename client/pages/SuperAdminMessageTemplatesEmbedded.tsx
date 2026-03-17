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
import {
  Plus,
  FileText,
  Edit,
  Trash2,
  Copy,
  Eye,
  MoreHorizontal,
  Search,
  RefreshCw,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";

interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  content: string;
  type: "email" | "sms" | "push" | "in-app";
  category: "welcome" | "notification" | "marketing" | "transactional";
  status: "active" | "draft" | "archived";
  usage_count: number;
  last_used: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  variables: string[] | null;
}

interface TemplateForm {
  name: string;
  subject: string;
  content: string;
  type: "email" | "sms" | "push" | "in-app";
  category: "welcome" | "notification" | "marketing" | "transactional";
  status: "active" | "draft" | "archived";
  variables: string;
}

const EMPTY_FORM: TemplateForm = {
  name: "",
  subject: "",
  content: "",
  type: "email",
  category: "notification",
  status: "draft",
  variables: "",
};

export default function SuperAdminMessageTemplatesEmbedded() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState<TemplateForm>(EMPTY_FORM);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingTemplate(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject || "",
      content: template.content,
      type: template.type,
      category: template.category,
      status: template.status,
      variables: (template.variables || []).join(", "),
    });
    setIsCreateDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error("Name and content are required");
      return;
    }

    setIsSaving(true);
    try {
      const parsedVariables = formData.variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const payload = {
        name: formData.name.trim(),
        subject: formData.subject.trim() || null,
        content: formData.content.trim(),
        type: formData.type,
        category: formData.category,
        status: formData.status,
        variables: parsedVariables.length > 0 ? parsedVariables : null,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        const { error } = await supabaseClient
          .from("message_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template updated successfully!");
      } else {
        const { error } = await supabaseClient
          .from("message_templates")
          .insert([{ ...payload, created_by: "Super Admin", usage_count: 0 }]);
        if (error) throw error;
        toast.success("Template created successfully!");
      }

      setIsCreateDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (template: MessageTemplate) => {
    try {
      const { error } = await supabaseClient.from("message_templates").insert([
        {
          name: `${template.name} (Copy)`,
          subject: template.subject,
          content: template.content,
          type: template.type,
          category: template.category,
          status: "draft",
          variables: template.variables,
          created_by: "Super Admin",
          usage_count: 0,
        },
      ]);
      if (error) throw error;
      toast.success("Template duplicated!");
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to duplicate template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const { error } = await supabaseClient
        .from("message_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Template deleted!");
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete template");
    }
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Subject", "Type", "Category", "Status", "Usage Count", "Created At"],
      ...templates.map((t) => [
        t.name,
        t.subject || "",
        t.type,
        t.category,
        t.status,
        String(t.usage_count),
        new Date(t.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "message-templates.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Templates exported!");
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchTerm ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.subject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || template.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || template.status === statusFilter;

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const skeletonRows = Array.from({ length: 5 });

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground">
              Create and manage email, SMS, and push notification templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={fetchTemplates} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit Template" : "Create Message Template"}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate
                  ? "Update the template details."
                  : "Create a new template for emails, SMS, or push notifications."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="template-name">Template Name *</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g. Welcome Email"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="template-type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v: TemplateForm["type"]) => setFormData((p) => ({ ...p, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push Notification</SelectItem>
                      <SelectItem value="in-app">In-App Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v: TemplateForm["category"]) => setFormData((p) => ({ ...p, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: TemplateForm["status"]) => setFormData((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template-subject">Subject / Title</Label>
                  <Input
                    id="template-subject"
                    placeholder="Email subject or message title"
                    value={formData.subject}
                    onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="template-content">Content *</Label>
                <Textarea
                  id="template-content"
                  placeholder="Template content. Use {{variableName}} for dynamic values."
                  rows={6}
                  value={formData.content}
                  onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="template-variables">
                  Variables (comma-separated)
                </Label>
                <Input
                  id="template-variables"
                  placeholder="e.g. firstName, lastName, email"
                  value={formData.variables}
                  onChange={(e) => setFormData((p) => ({ ...p, variables: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  List variable names used in the content (without {"{{ }}"})
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selectedTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                Template preview — variables shown as placeholders
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <Badge variant="outline" className="capitalize ml-1">
                      {selectedTemplate.type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category: </span>
                    <Badge variant="secondary" className="capitalize ml-1">
                      {selectedTemplate.category}
                    </Badge>
                  </div>
                  {selectedTemplate.subject && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Subject: </span>
                      <strong>{selectedTemplate.subject}</strong>
                    </div>
                  )}
                </div>
                {(selectedTemplate.variables || []).length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Variables: </span>
                    {(selectedTemplate.variables || []).map((v) => (
                      <Badge key={v} variant="outline" className="mr-1 font-mono text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="border rounded-lg p-4 bg-muted/30 whitespace-pre-wrap text-sm">
                  {selectedTemplate.content}
                </div>
                <div className="text-xs text-muted-foreground">
                  Created by {selectedTemplate.created_by} •{" "}
                  {new Date(selectedTemplate.created_at).toLocaleDateString()} •{" "}
                  Used {selectedTemplate.usage_count} times
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="in-app">In-App</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>Templates ({isLoading ? "…" : filteredTemplates.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Last Used</TableHead>
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
                    : filteredTemplates.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            No templates found. Create one to get started.
                          </TableCell>
                        </TableRow>
                      )
                    : filteredTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              {template.subject && (
                                <div className="text-sm text-muted-foreground">{template.subject}</div>
                              )}
                              {(template.variables || []).length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Variables:{" "}
                                  {(template.variables || []).map((v) => `{{${v}}}`).join(", ")}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {template.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {template.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                template.status === "active"
                                  ? "default"
                                  : template.status === "draft"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="capitalize"
                            >
                              {template.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{template.usage_count.toLocaleString()}</div>
                          </TableCell>
                          <TableCell>
                            {template.last_used
                              ? new Date(template.last_used).toLocaleDateString()
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setIsPreviewOpen(true);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(template)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(template.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
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
    </div>
  );
}
