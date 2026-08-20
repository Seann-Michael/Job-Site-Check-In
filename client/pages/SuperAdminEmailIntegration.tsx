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
  Mail,
  Send,
  Eye,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  Check,
  X,
  CheckCircle,
  TrendingUp,
  Users,
  Target,
  Server,
  Globe,
  BarChart3,
  Search,
  RefreshCw,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";
import { supabaseClient } from "@/lib/supabaseClient";
import { testProvider, sendCampaign } from "@/lib/emailService";
import { isApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface EmailProvider {
  id: string;
  name: string;
  type: "smtp" | "api";
  provider_key: string | null;
  config: {
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    host?: string;
    port?: number;
    username?: string;
    [key: string]: any;
  };
  is_active: boolean;
  is_default: boolean;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  };
  created_at: string;
  updated_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string | null;
  text_content: string | null;
  preview_text: string | null;
  category: "broadcast" | "automation" | "transactional";
  variables: string[] | null;
  is_active: boolean;
  usage_count: number;
  last_used: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  template_id: string | null;
  content: string | null;
  target_segment: string;
  recipient_count: number;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  created_by: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
}

const EMAIL_PROVIDERS_LIST = [
  { id: "sendgrid", name: "SendGrid", type: "api", description: "Reliable email delivery with advanced analytics", icon: "📧" },
  { id: "mailgun", name: "Mailgun", type: "api", description: "Powerful email API for developers", icon: "🔫" },
  { id: "postmark", name: "Postmark", type: "api", description: "Fast, reliable transactional email", icon: "📮" },
  { id: "smtp", name: "Custom SMTP", type: "smtp", description: "Use your own SMTP server", icon: "⚙️" },
  { id: "gmail", name: "Gmail SMTP", type: "smtp", description: "Gmail SMTP for small volume", icon: "📬" },
];

const EMPTY_PROVIDER_FORM = {
  name: "",
  type: "api" as EmailProvider["type"],
  provider_key: "",
  config: { fromEmail: "", fromName: "", replyTo: "", host: "", port: 587, username: "" },
  is_active: true,
  is_default: false,
};

const EMPTY_TEMPLATE_FORM = {
  name: "",
  subject: "",
  html_content: "",
  text_content: "",
  preview_text: "",
  category: "broadcast" as EmailTemplate["category"],
  is_active: true,
};

const EMPTY_CAMPAIGN_FORM = {
  name: "",
  subject: "",
  template_id: "",
  content: "",
  target_segment: "all",
  scheduled_at: "",
};

function extractVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const vars: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const v = match[1].trim();
    if (!vars.includes(v)) vars.push(v);
  }
  return vars;
}

export default function SuperAdminEmailIntegration() {
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("providers");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EmailProvider | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Forms
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER_FORM);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN_FORM);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [provRes, tplRes, campRes] = await Promise.all([
        supabaseClient.from("email_providers").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("email_templates").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      ]);
      if (provRes.error) throw provRes.error;
      if (tplRes.error) throw tplRes.error;
      if (campRes.error) throw campRes.error;
      setProviders(provRes.data || []);
      setTemplates(tplRes.data || []);
      setCampaigns(campRes.data || []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load email data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Computed stats ──────────────────────────────────────────────────────────
  const totalSent = providers.reduce((s, p) => s + (p.stats?.sent || 0), 0);
  const totalDelivered = providers.reduce((s, p) => s + (p.stats?.delivered || 0), 0);
  const totalOpened = providers.reduce((s, p) => s + (p.stats?.opened || 0), 0);
  const totalClicked = providers.reduce((s, p) => s + (p.stats?.clicked || 0), 0);

  const emailStats = {
    totalProviders: providers.length,
    activeProviders: providers.filter((p) => p.is_active).length,
    totalCampaigns: campaigns.length,
    totalTemplates: templates.length,
    totalSent,
    deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
    openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
    clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
  };

  // ─── Provider CRUD ───────────────────────────────────────────────────────────
  const openCreateProvider = () => {
    setEditingProvider(null);
    setProviderForm(EMPTY_PROVIDER_FORM);
    setShowProviderDialog(true);
  };

  const openEditProvider = (p: EmailProvider) => {
    setEditingProvider(p);
    setProviderForm({
      name: p.name,
      type: p.type,
      provider_key: p.provider_key || "",
      config: { ...EMPTY_PROVIDER_FORM.config, ...p.config },
      is_active: p.is_active,
      is_default: p.is_default,
    });
    setShowProviderDialog(true);
  };

  const handleSaveProvider = async () => {
    if (!providerForm.name.trim() || !providerForm.config.fromEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: providerForm.name.trim(),
        type: providerForm.type,
        provider_key: providerForm.provider_key || null,
        // Credentials never pass through the browser; drop any legacy keys.
        config: (({ apiKey, password, ...rest }) => rest)(providerForm.config as Record<string, any>),
        is_active: providerForm.is_active,
        is_default: providerForm.is_default,
        updated_at: new Date().toISOString(),
      };

      // If setting as default, unset the current defaults first (by id)
      if (providerForm.is_default) {
        const otherDefaults = providers
          .filter((p) => p.is_default && p.id !== editingProvider?.id)
          .map((p) => p.id);
        if (otherDefaults.length > 0) {
          const { error: unsetError } = await supabaseClient
            .from("email_providers")
            .update({ is_default: false, updated_at: new Date().toISOString() })
            .in("id", otherDefaults);
          if (unsetError) throw unsetError;
        }
      }

      if (editingProvider) {
        const { error } = await supabaseClient.from("email_providers").update(payload).eq("id", editingProvider.id);
        if (error) throw error;
        toast.success("Provider updated!");
      } else {
        const { error } = await supabaseClient.from("email_providers").insert([{
          ...payload,
          stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 },
        }]);
        if (error) throw error;
        toast.success("Email provider configured!");
      }
      setShowProviderDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save provider");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleProvider = async (provider: EmailProvider) => {
    try {
      const { error } = await supabaseClient
        .from("email_providers")
        .update({ is_active: !provider.is_active, updated_at: new Date().toISOString() })
        .eq("id", provider.id);
      if (error) throw error;
      toast.success(`Provider ${!provider.is_active ? "enabled" : "disabled"}!`);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update provider");
    }
  };

  const handleSetDefaultProvider = async (id: string) => {
    try {
      const otherDefaults = providers.filter((p) => p.is_default && p.id !== id).map((p) => p.id);
      if (otherDefaults.length > 0) {
        const { error: unsetError } = await supabaseClient
          .from("email_providers")
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .in("id", otherDefaults);
        if (unsetError) throw unsetError;
      }
      const { error } = await supabaseClient.from("email_providers").update({ is_default: true, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Default provider updated!");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to set default provider");
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Delete this email provider?")) return;
    try {
      const { error } = await supabaseClient.from("email_providers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Provider deleted!");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete provider");
    }
  };

  // ─── Template CRUD ───────────────────────────────────────────────────────────
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      subject: t.subject,
      html_content: t.html_content || "",
      text_content: t.text_content || "",
      preview_text: t.preview_text || "",
      category: t.category,
      is_active: t.is_active,
    });
    setShowTemplateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const variables = extractVariables(
        (templateForm.html_content || "") + " " + templateForm.subject
      );
      const payload = {
        name: templateForm.name.trim(),
        subject: templateForm.subject.trim(),
        html_content: templateForm.html_content || null,
        text_content: templateForm.text_content || null,
        preview_text: templateForm.preview_text || null,
        category: templateForm.category,
        variables: variables.length > 0 ? variables : null,
        is_active: templateForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        const { error } = await supabaseClient.from("email_templates").update(payload).eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template updated!");
      } else {
        const { error } = await supabaseClient.from("email_templates").insert([{
          ...payload, created_by: "Super Admin", usage_count: 0,
        }]);
        if (error) throw error;
        toast.success("Template created!");
      }
      setShowTemplateDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTemplate = async (t: EmailTemplate) => {
    try {
      const { error } = await supabaseClient.from("email_templates").insert([{
        name: `${t.name} (Copy)`,
        subject: t.subject,
        html_content: t.html_content,
        text_content: t.text_content,
        preview_text: t.preview_text,
        category: t.category,
        variables: t.variables,
        is_active: false,
        usage_count: 0,
        created_by: "Super Admin",
      }]);
      if (error) throw error;
      toast.success("Template duplicated!");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to duplicate template");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this email template?")) return;
    try {
      const { error } = await supabaseClient.from("email_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Template deleted!");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete template");
    }
  };

  // ─── Campaign CRUD ───────────────────────────────────────────────────────────
  const handleSaveCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.subject.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: campaignForm.name.trim(),
        subject: campaignForm.subject.trim(),
        template_id: campaignForm.template_id || null,
        content: campaignForm.content || null,
        target_segment: campaignForm.target_segment,
        recipient_count: 0,
        status: campaignForm.scheduled_at ? "scheduled" : "draft",
        scheduled_at: campaignForm.scheduled_at || null,
        sent_at: null,
        created_by: "Super Admin",
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
      };
      const { error } = await supabaseClient.from("email_campaigns").insert([payload]);
      if (error) throw error;
      toast.success(campaignForm.scheduled_at ? "Campaign scheduled" : "Campaign saved as draft");
      setShowCampaignDialog(false);
      setCampaignForm(EMPTY_CAMPAIGN_FORM);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create campaign");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      const { error } = await supabaseClient.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
      toast.success("Campaign deleted!");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete campaign");
    }
  };

  // ─── Real sending (server-backed) ────────────────────────────────────────────
  const handleTestProvider = async (provider: EmailProvider) => {
    const suggested = getCurrentUser()?.email || provider.config?.fromEmail || "";
    const to = window.prompt("Send a test email to:", suggested);
    if (!to || !to.trim()) return;
    setTestingProviderId(provider.id);
    try {
      const result = await testProvider(provider.id, to.trim());
      toast.success(`Test email sent via ${result.provider}`);
      fetchAll();
    } catch (err: any) {
      const msg = isApiError(err) ? err.message : err?.message ?? "Failed to send test email";
      toast.error(msg);
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleSendCampaign = async (campaign: EmailCampaign) => {
    if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()) {
      if (!confirm("This campaign is scheduled for later. Send it now anyway?")) return;
    } else if (!confirm(`Send "${campaign.name}" now?`)) {
      return;
    }
    setSendingCampaignId(campaign.id);
    try {
      const result = await sendCampaign(campaign.id);
      toast.success(`Campaign sent — ${result.sent} delivered${result.failed ? `, ${result.failed} failed` : ""}`);
      fetchAll();
    } catch (err: any) {
      if (isApiError(err) && err.isUnavailable) {
        toast.error("No email provider configured — add one first");
      } else {
        toast.error(isApiError(err) ? err.message : err?.message ?? "Failed to send campaign");
      }
    } finally {
      setSendingCampaignId(null);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getProviderStatusBadge = (p: EmailProvider) => {
    if (p.is_default) return <Badge className="bg-purple-500">Default</Badge>;
    if (p.is_active) return <Badge className="bg-green-500">Active</Badge>;
    return <Badge variant="secondary">Inactive</Badge>;
  };

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-green-500">Sent</Badge>;
      case "sending": return <Badge className="bg-blue-500">Sending</Badge>;
      case "scheduled": return <Badge className="bg-yellow-500">Scheduled</Badge>;
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredProviders = providers.filter((p) =>
    !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredTemplates = templates.filter(
    (t) =>
      !searchTerm ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCampaigns = campaigns.filter(
    (c) =>
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const skeletonRows = Array.from({ length: 4 });

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Integration
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Configure email providers, templates, and campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button className="gap-2" onClick={() => { setCampaignForm(EMPTY_CAMPAIGN_FORM); setShowCampaignDialog(true); }}>
              <Send className="h-4 w-4" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          {[
            { label: "Providers", value: emailStats.totalProviders, icon: Server, color: "text-primary" },
            { label: "Active", value: emailStats.activeProviders, icon: CheckCircle, color: "text-green-500" },
            { label: "Campaigns", value: emailStats.totalCampaigns, icon: Target, color: "text-blue-500" },
            { label: "Total Sent", value: emailStats.totalSent.toLocaleString(), icon: Send, color: "text-purple-500" },
            { label: "Delivery", value: `${Math.round(emailStats.deliveryRate)}%`, icon: TrendingUp, color: "text-green-500" },
            { label: "Open Rate", value: `${Math.round(emailStats.openRate)}%`, icon: Eye, color: "text-blue-500" },
            { label: "Click Rate", value: `${Math.round(emailStats.clickRate)}%`, icon: Target, color: "text-orange-500" },
            { label: "Templates", value: emailStats.totalTemplates, icon: Mail, color: "text-indigo-500" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold">{isLoading ? "…" : stat.value}</p>
                  </div>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Provider Dialog */}
        <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProvider ? "Edit Provider" : "Add Email Provider"}</DialogTitle>
              <DialogDescription>Configure an email service provider for sending messages</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Provider Type</Label>
                <Select
                  value={providerForm.provider_key}
                  onValueChange={(v) => {
                    const found = EMAIL_PROVIDERS_LIST.find((p) => p.id === v);
                    setProviderForm((prev) => ({
                      ...prev,
                      provider_key: v,
                      name: found?.name || prev.name,
                      type: (found?.type as any) || "api",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_PROVIDERS_LIST.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.icon}</span>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Display Name *</Label>
                <Input
                  value={providerForm.name}
                  onChange={(e) => setProviderForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., SendGrid Production"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>From Email *</Label>
                  <Input
                    value={providerForm.config.fromEmail}
                    onChange={(e) => setProviderForm((p) => ({ ...p, config: { ...p.config, fromEmail: e.target.value } }))}
                    placeholder="noreply@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>From Name *</Label>
                  <Input
                    value={providerForm.config.fromName}
                    onChange={(e) => setProviderForm((p) => ({ ...p, config: { ...p.config, fromName: e.target.value } }))}
                    placeholder="Your Company"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Reply-To (Optional)</Label>
                <Input
                  value={providerForm.config.replyTo}
                  onChange={(e) => setProviderForm((p) => ({ ...p, config: { ...p.config, replyTo: e.target.value } }))}
                  placeholder="support@example.com"
                />
              </div>
              <p className="text-xs text-muted-foreground rounded border bg-muted/40 p-2">
                API keys and SMTP passwords are configured in the server environment and are never stored in the database or entered here.
              </p>
              {providerForm.type === "api" ? null : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>SMTP Host *</Label>
                    <Input
                      value={providerForm.config.host}
                      onChange={(e) => setProviderForm((p) => ({ ...p, config: { ...p.config, host: e.target.value } }))}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={providerForm.config.port}
                      onChange={(e) => setProviderForm((p) => ({ ...p, config: { ...p.config, port: parseInt(e.target.value) || 587 } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Username</Label>
                    <Input
                      value={providerForm.config.username}
                      onChange={(e) => setProviderForm((p) => ({ ...p, config: { ...p.config, username: e.target.value } }))}
                      placeholder="SMTP username"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch checked={providerForm.is_active} onCheckedChange={(v) => setProviderForm((p) => ({ ...p, is_active: v }))} />
                <Label>Enable this provider</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch checked={providerForm.is_default} onCheckedChange={(v) => setProviderForm((p) => ({ ...p, is_default: v }))} />
                <Label>Set as default provider</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProviderDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveProvider} disabled={isSaving}>
                {isSaving ? "Saving..." : editingProvider ? "Update Provider" : "Add Provider"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Dialog */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Email Template"}</DialogTitle>
              <DialogDescription>Design reusable email templates for campaigns and automation</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Template Name *</Label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Welcome Email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={templateForm.category} onValueChange={(v: any) => setTemplateForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broadcast">Broadcast</SelectItem>
                      <SelectItem value="automation">Automation</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Subject Line *</Label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Welcome to our platform!"
                />
              </div>
              <div className="grid gap-2">
                <Label>Preview Text</Label>
                <Input
                  value={templateForm.preview_text}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, preview_text: e.target.value }))}
                  placeholder="This appears in email client previews..."
                />
              </div>
              <div className="grid gap-2">
                <Label>HTML Content</Label>
                <Textarea
                  value={templateForm.html_content}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, html_content: e.target.value }))}
                  placeholder={"<div>Your HTML email. Use {{variable}} for dynamic values.</div>"}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label>Plain Text Content</Label>
                <Textarea
                  value={templateForm.text_content}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, text_content: e.target.value }))}
                  placeholder="Plain text fallback version..."
                  rows={4}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch checked={templateForm.is_active} onCheckedChange={(v) => setTemplateForm((p) => ({ ...p, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={isSaving}>
                {isSaving ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Campaign Dialog */}
        <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Email Campaign</DialogTitle>
              <DialogDescription>Set up a new email campaign to send to your users</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Campaign Name *</Label>
                <Input value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} placeholder="January Newsletter" />
              </div>
              <div className="grid gap-2">
                <Label>Subject Line *</Label>
                <Input value={campaignForm.subject} onChange={(e) => setCampaignForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Check out what's new!" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Template (Optional)</Label>
                  <Select value={campaignForm.template_id} onValueChange={(v) => setCampaignForm((p) => ({ ...p, template_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="None — custom content" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None — custom content</SelectItem>
                      {templates.filter((t) => t.is_active).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Target Segment</Label>
                  <Select value={campaignForm.target_segment} onValueChange={(v) => setCampaignForm((p) => ({ ...p, target_segment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="business-owners">Business Owners</SelectItem>
                      <SelectItem value="agency-admins">Agency Admins</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!campaignForm.template_id && (
                <div className="grid gap-2">
                  <Label>Email Content</Label>
                  <Textarea
                    value={campaignForm.content}
                    onChange={(e) => setCampaignForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Custom email content..."
                    rows={5}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label>Schedule For (optional)</Label>
                <Input type="datetime-local" value={campaignForm.scheduled_at} onChange={(e) => setCampaignForm((p) => ({ ...p, scheduled_at: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Leave empty to keep the campaign as a draft.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveCampaign} disabled={isSaving}>
                {isSaving ? "Saving..." : campaignForm.scheduled_at ? "Schedule Campaign" : "Save Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewTemplate?.name}</DialogTitle>
              <DialogDescription>Subject: {previewTemplate?.subject}</DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div className="space-y-4 py-2">
                <div className="flex gap-2 text-sm flex-wrap">
                  <Badge variant="outline" className="capitalize">{previewTemplate.category}</Badge>
                  {previewTemplate.is_active ? <Badge className="bg-green-500">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  {(previewTemplate.variables || []).map((v) => (
                    <Badge key={v} variant="outline" className="font-mono text-xs">{`{{${v}}}`}</Badge>
                  ))}
                </div>
                {previewTemplate.preview_text && (
                  <p className="text-sm text-muted-foreground italic">{previewTemplate.preview_text}</p>
                )}
                {previewTemplate.html_content ? (
                  <div className="border rounded-lg p-4 bg-white text-sm overflow-auto max-h-64" dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }} />
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30 text-sm whitespace-pre-wrap">
                    {previewTemplate.text_content || "No content"}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Created by {previewTemplate.created_by} · {formatSystemDate(previewTemplate.created_at)} · Used {previewTemplate.usage_count} times
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* ── Providers ─────────────────────────────────────────────────────── */}
          <TabsContent value="providers" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search providers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={openCreateProvider} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Provider
              </Button>
            </div>

            <Card>
              <CardHeader><CardTitle>Email Providers</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? skeletonRows.map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(5)].map((__, j) => (
                              <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      : filteredProviders.length === 0
                      ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                              No providers configured. Add one to start sending emails.
                            </TableCell>
                          </TableRow>
                        )
                      : filteredProviders.map((provider) => (
                          <TableRow key={provider.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{provider.name}</div>
                                <div className="text-sm text-muted-foreground">{provider.config?.fromEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {provider.type === "api" ? <Globe className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                                <span className="capitalize">{provider.type}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getProviderStatusBadge(provider)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>Sent: {(provider.stats?.sent || 0).toLocaleString()}</div>
                                <div className="text-muted-foreground">
                                  {provider.stats?.sent > 0
                                    ? `${Math.round(((provider.stats?.delivered || 0) / provider.stats.sent) * 100)}% delivered`
                                    : "No data yet"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleTestProvider(provider)}
                                    disabled={testingProviderId === provider.id}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    {testingProviderId === provider.id ? "Sending…" : "Send Test Email"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditProvider(provider)}>
                                    <Edit className="h-4 w-4 mr-2" />Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleProvider(provider)}>
                                    {provider.is_active ? <X className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    {provider.is_active ? "Disable" : "Enable"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSetDefaultProvider(provider.id)}>
                                    <Star className="h-4 w-4 mr-2" />Set as Default
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteProvider(provider.id)} className="text-red-600 focus:text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Templates ─────────────────────────────────────────────────────── */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search templates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={openCreateTemplate} className="gap-2">
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skeletonRows.map((_, i) => (
                  <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card><CardContent className="text-center py-12 text-muted-foreground">No templates found. Create one to get started.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">{template.category}</Badge>
                            {template.is_active
                              ? <Badge className="bg-green-500 text-xs">Active</Badge>
                              : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setPreviewTemplate(template); setShowPreviewDialog(true); }}>
                              <Eye className="h-4 w-4 mr-2" />Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditTemplate(template)}>
                              <Edit className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                              <Copy className="h-4 w-4 mr-2" />Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 focus:text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Subject</Label>
                          <p className="text-sm line-clamp-2">{template.subject}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Used {template.usage_count} times</span>
                          <span>{(template.variables || []).length} variables</span>
                        </div>
                        {(template.variables || []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(template.variables || []).slice(0, 3).map((v) => (
                              <Badge key={v} variant="outline" className="text-xs font-mono">{`{{${v}}}`}</Badge>
                            ))}
                            {(template.variables || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">+{(template.variables || []).length - 3} more</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Campaigns ─────────────────────────────────────────────────────── */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search campaigns..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={() => { setCampaignForm(EMPTY_CAMPAIGN_FORM); setShowCampaignDialog(true); }} className="gap-2">
                <Plus className="h-4 w-4" />
                New Campaign
              </Button>
            </div>

            <Card>
              <CardHeader><CardTitle>Email Campaigns</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? skeletonRows.map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(6)].map((__, j) => (
                              <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      : filteredCampaigns.length === 0
                      ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                              No campaigns yet. Create one to start emailing users.
                            </TableCell>
                          </TableRow>
                        )
                      : filteredCampaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{campaign.name}</div>
                                <div className="text-sm text-muted-foreground line-clamp-1">{campaign.subject}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>{campaign.recipient_count.toLocaleString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getCampaignStatusBadge(campaign.status)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>
                                  Open:{" "}
                                  {campaign.stats?.delivered > 0
                                    ? `${Math.round((campaign.stats.opened / campaign.stats.delivered) * 100)}%`
                                    : "—"}
                                </div>
                                <div className="text-muted-foreground">
                                  Click:{" "}
                                  {campaign.stats?.opened > 0
                                    ? `${Math.round((campaign.stats.clicked / campaign.stats.opened) * 100)}%`
                                    : "—"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {formatSystemDate(campaign.sent_at || campaign.scheduled_at || campaign.created_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {campaign.status !== "sent" && campaign.status !== "sending" && (
                                    <DropdownMenuItem
                                      onClick={() => handleSendCampaign(campaign)}
                                      disabled={sendingCampaignId === campaign.id}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      {sendingCampaignId === campaign.id ? "Sending…" : "Send Now"}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleDeleteCampaign(campaign.id)} className="text-red-600 focus:text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Analytics ─────────────────────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Provider Comparison</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-32 bg-muted animate-pulse rounded" />
                  ) : providers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No providers configured.</p>
                  ) : (
                    <div className="space-y-4">
                      {providers.map((provider) => (
                        <div key={provider.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{provider.name}</span>
                            {getProviderStatusBadge(provider)}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Sent</div>
                              <div className="font-medium">{(provider.stats?.sent || 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Delivered</div>
                              <div className="font-medium">
                                {provider.stats?.sent > 0
                                  ? `${Math.round(((provider.stats?.delivered || 0) / provider.stats.sent) * 100)}%`
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Opened</div>
                              <div className="font-medium">
                                {provider.stats?.delivered > 0
                                  ? `${Math.round(((provider.stats?.opened || 0) / provider.stats.delivered) * 100)}%`
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Campaign Performance</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-32 bg-muted animate-pulse rounded" />
                  ) : campaigns.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No campaigns yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {campaigns.slice(0, 5).map((campaign) => (
                        <div key={campaign.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium truncate">{campaign.name}</span>
                            {getCampaignStatusBadge(campaign.status)}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <div className="text-muted-foreground">Sent</div>
                              <div className="font-medium">{(campaign.stats?.sent || 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Opened</div>
                              <div className="font-medium">
                                {campaign.stats?.delivered > 0
                                  ? `${Math.round(((campaign.stats?.opened || 0) / campaign.stats.delivered) * 100)}%`
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Clicked</div>
                              <div className="font-medium">
                                {campaign.stats?.opened > 0
                                  ? `${Math.round(((campaign.stats?.clicked || 0) / campaign.stats.opened) * 100)}%`
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
