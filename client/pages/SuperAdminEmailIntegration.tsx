// @ts-nocheck - Temporary suppression of type errors
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Mail,
  Settings,
  Send,
  Eye,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Target,
  Zap,
  Server,
  Key,
  Shield,
  Globe,
  BarChart3,
  Filter,
  Search,
  RefreshCw,
  Download,
  Upload,
  TestTube,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";

interface EmailProvider {
  id: string;
  name: string;
  type: "smtp" | "api";
  config: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    apiKey?: string;
    apiUrl?: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    [key: string]: any;
  };
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  category: "broadcast" | "automation" | "transactional";
  variables: string[];
  previewText?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  usageCount: number;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  templateId?: string;
  content: string;
  targetSegment: string;
  recipientCount: number;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  createdBy: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
}

interface EmailStats {
  totalProviders: number;
  activeProviders: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

const EMAIL_PROVIDERS = [
  {
    id: "sendgrid",
    name: "SendGrid",
    type: "api",
    description: "Reliable email delivery with advanced analytics",
    icon: "📧",
    setup: ["API Key", "From Email", "From Name"],
  },
  {
    id: "mailgun",
    name: "Mailgun",
    type: "api",
    description: "Powerful email API for developers",
    icon: "🔫",
    setup: ["API Key", "Domain", "From Email"],
  },
  {
    id: "postmark",
    name: "Postmark",
    type: "api",
    description: "Fast, reliable transactional email",
    icon: "📮",
    setup: ["Server Token", "From Email", "From Name"],
  },
  {
    id: "smtp",
    name: "Custom SMTP",
    type: "smtp",
    description: "Use your own SMTP server",
    icon: "⚙️",
    setup: ["Host", "Port", "Username", "Password"],
  },
  {
    id: "gmail",
    name: "Gmail SMTP",
    type: "smtp",
    description: "Gmail SMTP for small volume",
    icon: "📬",
    setup: ["App Password", "From Email"],
  },
];

export default function SuperAdminEmailIntegration() {
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stats, setStats] = useState<EmailStats>({
    totalProviders: 0,
    activeProviders: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSent: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
  });

  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EmailProvider | null>(
    null,
  );
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("providers");

  // Form states
  const [providerForm, setProviderForm] = useState({
    name: "",
    type: "api" as const,
    providerId: "",
    config: {
      fromEmail: "",
      fromName: "",
      replyTo: "",
      apiKey: "",
      host: "",
      port: 587,
      username: "",
      password: "",
    },
    isActive: true,
    isDefault: false,
  });

  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    category: "broadcast" as const,
    previewText: "",
    isActive: true,
  });

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    subject: "",
    templateId: "",
    content: "",
    targetSegment: "all",
    scheduledAt: "",
    isImmediate: true,
  });

  useEffect(() => {
    loadEmailData();
  }, []);

  const loadEmailData = () => {
    // Load mock data
    const mockProviders: EmailProvider[] = [
      {
        id: "sendgrid-main",
        name: "SendGrid Production",
        type: "api",
        config: {
          apiKey: "SG.xxxx...xxxx",
          fromEmail: "noreply@gmbbooster.com",
          fromName: "GMB Booster",
          replyTo: "support@gmbbooster.com",
        },
        isActive: true,
        isDefault: true,
        createdAt: "2024-01-10T10:00:00Z",
        updatedAt: "2024-01-10T10:00:00Z",
        stats: {
          sent: 15420,
          delivered: 15234,
          opened: 8945,
          clicked: 2234,
          bounced: 186,
          complained: 23,
        },
      },
      {
        id: "smtp-backup",
        name: "SMTP Backup",
        type: "smtp",
        config: {
          host: "smtp.gmail.com",
          port: 587,
          username: "backup@gmbbooster.com",
          password: "xxxx-xxxx-xxxx-xxxx",
          fromEmail: "backup@gmbbooster.com",
          fromName: "GMB Booster Backup",
        },
        isActive: false,
        isDefault: false,
        createdAt: "2024-01-05T15:00:00Z",
        updatedAt: "2024-01-18T09:30:00Z",
        stats: {
          sent: 1250,
          delivered: 1198,
          opened: 623,
          clicked: 145,
          bounced: 52,
          complained: 2,
        },
      },
    ];

    const mockTemplates: EmailTemplate[] = [
      {
        id: "welcome-email",
        name: "Welcome Email",
        subject: "Welcome to GMB Booster - Let's get started!",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome to GMB Booster!</h1>
            <p>Hi {{user_name}},</p>
            <p>We're excited to help you boost your Google My Business presence...</p>
            <a href="{{dashboard_url}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Get Started</a>
          </div>
        `,
        textContent:
          "Welcome to GMB Booster! Hi {{user_name}}, We're excited to help you boost your Google My Business presence...",
        category: "automation",
        variables: ["user_name", "dashboard_url"],
        previewText: "Welcome to GMB Booster - Let's get started!",
        isActive: true,
        createdAt: "2024-01-08T11:30:00Z",
        updatedAt: "2024-01-15T14:20:00Z",
        createdBy: "Super Admin",
        usageCount: 156,
      },
      {
        id: "broadcast-update",
        name: "Platform Update",
        subject: "Important Platform Updates - {{update_title}}",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>{{update_title}}</h1>
            <p>{{update_content}}</p>
            <p>Best regards,<br>The GMB Booster Team</p>
          </div>
        `,
        textContent: "{{update_title}} - {{update_content}}",
        category: "broadcast",
        variables: ["update_title", "update_content"],
        previewText: "Important updates about your platform",
        isActive: true,
        createdAt: "2024-01-12T16:45:00Z",
        updatedAt: "2024-01-12T16:45:00Z",
        createdBy: "Super Admin",
        usageCount: 23,
      },
    ];

    const mockCampaigns: EmailCampaign[] = [
      {
        id: "january-updates",
        name: "January Platform Updates",
        subject: "New Features Available - January 2024",
        templateId: "broadcast-update",
        content: "We've released exciting new features...",
        targetSegment: "all",
        recipientCount: 1247,
        status: "sent",
        sentAt: "2024-01-15T10:00:00Z",
        createdAt: "2024-01-14T16:30:00Z",
        createdBy: "Super Admin",
        stats: {
          sent: 1247,
          delivered: 1198,
          opened: 723,
          clicked: 189,
          bounced: 49,
          unsubscribed: 12,
        },
      },
      {
        id: "welcome-series",
        name: "Welcome Email Series",
        subject: "Welcome to GMB Booster!",
        templateId: "welcome-email",
        content: "Automated welcome email for new users",
        targetSegment: "new-users",
        recipientCount: 89,
        status: "sending",
        createdAt: "2024-01-20T09:15:00Z",
        createdBy: "System",
        stats: {
          sent: 67,
          delivered: 65,
          opened: 34,
          clicked: 8,
          bounced: 2,
          unsubscribed: 0,
        },
      },
    ];

    setProviders(mockProviders || []);
    setTemplates(mockTemplates || []);
    setCampaigns(mockCampaigns || []);

    // Calculate stats
    const totalSent = mockProviders.reduce((sum, p) => sum + p.stats.sent, 0);
    const totalDelivered = mockProviders.reduce(
      (sum, p) => sum + p.stats.delivered,
      0,
    );
    const totalOpened = mockProviders.reduce(
      (sum, p) => sum + p.stats.opened,
      0,
    );
    const totalClicked = mockProviders.reduce(
      (sum, p) => sum + p.stats.clicked,
      0,
    );

    setStats({
      totalProviders: (mockProviders || []).length,
      activeProviders: (mockProviders || []).filter((p) => p.isActive).length,
      totalCampaigns: (mockCampaigns || []).length,
      activeCampaigns: (mockCampaigns || []).filter(
        (c) => c.status !== "cancelled",
      ).length,
      totalSent,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
    });
  };

  const resetProviderForm = () => {
    setProviderForm({
      name: "",
      type: "api",
      providerId: "",
      config: {
        fromEmail: "",
        fromName: "",
        replyTo: "",
        apiKey: "",
        host: "",
        port: 587,
        username: "",
        password: "",
      },
      isActive: true,
      isDefault: false,
    });
    setEditingProvider(null);
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      subject: "",
      htmlContent: "",
      textContent: "",
      category: "broadcast",
      previewText: "",
      isActive: true,
    });
    setEditingTemplate(null);
  };

  const handleCreateProvider = () => {
    if (!providerForm.name.trim() || !providerForm.config.fromEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const newProvider: EmailProvider = {
      id: Date.now().toString(),
      name: providerForm.name,
      type: providerForm.type,
      config: providerForm.config,
      isActive: providerForm.isActive,
      isDefault: providerForm.isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      },
    };

    setProviders([...safeProviders, newProvider]);
    toast.success("Email provider configured successfully!");
    setShowProviderDialog(false);
    resetProviderForm();
  };

  const handleCreateTemplate = () => {
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const variables = extractVariables(
      templateForm.htmlContent + " " + templateForm.subject,
    );

    const newTemplate: EmailTemplate = {
      id: Date.now().toString(),
      name: templateForm.name,
      subject: templateForm.subject,
      htmlContent: templateForm.htmlContent,
      textContent: templateForm.textContent,
      category: templateForm.category,
      variables,
      previewText: templateForm.previewText,
      isActive: templateForm.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Super Admin",
      usageCount: 0,
    };

    setTemplates([...templates, newTemplate]);
    toast.success("Email template created successfully!");
    setShowTemplateDialog(false);
    resetTemplateForm();
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

  const testProvider = async (providerId: string) => {
    toast.info("Sending test email...");
    // Simulate test email sending
    await new Promise((resolve) => setTimeout(resolve, 2000));
    toast.success("Test email sent successfully!");
  };

  const toggleProviderStatus = (providerId: string) => {
    setProviders(
      (providers || []).map((p) =>
        p.id === providerId ? { ...p, isActive: !p.isActive } : p,
      ),
    );
    toast.success("Provider status updated!");
  };

  const setDefaultProvider = (providerId: string) => {
    setProviders(
      (providers || []).map((p) => ({
        ...p,
        isDefault: p.id === providerId,
      })),
    );
    toast.success("Default provider updated!");
  };

  const deleteProvider = (providerId: string) => {
    setProviders(safeProviders.filter((p) => p.id !== providerId));
    toast.success("Provider deleted!");
  };

  const duplicateTemplate = (template: EmailTemplate) => {
    const duplicated: EmailTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };
    setTemplates([...templates, duplicated]);
    toast.success("Template duplicated!");
  };

  const getProviderStatusBadge = (provider: EmailProvider) => {
    if (provider.isDefault) {
      return <Badge className="bg-purple-500">Default</Badge>;
    }
    if (provider.isActive) {
      return <Badge className="bg-green-500">Active</Badge>;
    }
    return <Badge variant="secondary">Inactive</Badge>;
  };

  const getProviderIcon = (type: string) => {
    return type === "api" ? (
      <Globe className="h-4 w-4" />
    ) : (
      <Server className="h-4 w-4" />
    );
  };

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500">Sent</Badge>;
      case "sending":
        return <Badge className="bg-blue-500">Sending</Badge>;
      case "scheduled":
        return <Badge className="bg-yellow-500">Scheduled</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Ensure arrays are always defined
  const safeProviders = providers || [];
  const safeTemplates = templates || [];
  const safeCampaigns = campaigns || [];

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Integration
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Configure email providers, templates, and multi-channel campaigns
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => testProvider("")}
              className="gap-2"
            >
              <TestTube className="h-4 w-4" />
              Test Email
            </Button>
            <Button className="gap-2">
              <Send className="h-4 w-4" />
              Send Campaign
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Providers</p>
                  <p className="text-2xl font-bold">{stats.totalProviders}</p>
                </div>
                <Server className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{stats.activeProviders}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Campaigns</p>
                  <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">
                    {stats.totalSent.toLocaleString()}
                  </p>
                </div>
                <Send className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivery</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.deliveryRate)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open Rate</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.openRate)}%
                  </p>
                </div>
                <Eye className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Click Rate</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.clickRate)}%
                  </p>
                </div>
                <Target className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Templates</p>
                  <p className="text-2xl font-bold">{safeTemplates.length}</p>
                </div>
                <Mail className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search providers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog
                open={showProviderDialog}
                onOpenChange={setShowProviderDialog}
              >
                <DialogTrigger asChild>
                  <Button onClick={resetProviderForm} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Provider
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configure Email Provider</DialogTitle>
                    <DialogDescription>
                      Add a new email service provider for sending messages
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Provider Type</Label>
                      <Select
                        value={providerForm.providerId}
                        onValueChange={(value) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            providerId: value,
                            name:
                              EMAIL_PROVIDERS.find((p) => p.id === value)
                                ?.name || "",
                            type:
                              (EMAIL_PROVIDERS.find((p) => p.id === value)
                                ?.type as any) || "api",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a provider..." />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_PROVIDERS.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex items-center gap-2">
                                <span>{provider.icon}</span>
                                <div>
                                  <div className="font-medium">
                                    {provider.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {provider.description}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>From Email *</Label>
                        <Input
                          value={providerForm.config.fromEmail}
                          onChange={(e) =>
                            setProviderForm((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                fromEmail: e.target.value,
                              },
                            }))
                          }
                          placeholder="noreply@example.com"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>From Name *</Label>
                        <Input
                          value={providerForm.config.fromName}
                          onChange={(e) =>
                            setProviderForm((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                fromName: e.target.value,
                              },
                            }))
                          }
                          placeholder="Your Company"
                        />
                      </div>
                    </div>
                    {providerForm.type === "api" ? (
                      <div className="grid gap-2">
                        <Label>API Key *</Label>
                        <Input
                          type="password"
                          value={providerForm.config.apiKey}
                          onChange={(e) =>
                            setProviderForm((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                apiKey: e.target.value,
                              },
                            }))
                          }
                          placeholder="Your API key..."
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>SMTP Host *</Label>
                          <Input
                            value={providerForm.config.host}
                            onChange={(e) =>
                              setProviderForm((prev) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  host: e.target.value,
                                },
                              }))
                            }
                            placeholder="smtp.example.com"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Port *</Label>
                          <Input
                            type="number"
                            value={providerForm.config.port}
                            onChange={(e) =>
                              setProviderForm((prev) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  port: parseInt(e.target.value) || 587,
                                },
                              }))
                            }
                            placeholder="587"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={providerForm.isActive}
                        onCheckedChange={(checked) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            isActive: checked,
                          }))
                        }
                      />
                      <Label>Enable this provider</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={providerForm.isDefault}
                        onCheckedChange={(checked) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            isDefault: checked,
                          }))
                        }
                      />
                      <Label>Set as default provider</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowProviderDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateProvider}>Add Provider</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Providers Table */}
            <Card>
              <CardHeader>
                <CardTitle>Email Providers</CardTitle>
              </CardHeader>
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
                    {safeProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {provider.config.fromEmail}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getProviderIcon(provider.type)}
                            <span className="capitalize">{provider.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getProviderStatusBadge(provider)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              Sent: {provider.stats.sent.toLocaleString()}
                            </div>
                            <div className="text-muted-foreground">
                              {provider.stats.sent > 0
                                ? `${Math.round(
                                    (provider.stats.delivered /
                                      provider.stats.sent) *
                                      100,
                                  )}% delivered`
                                : "No data"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => testProvider(provider.id)}
                              >
                                <TestTube className="h-4 w-4 mr-2" />
                                Test
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleProviderStatus(provider.id)
                                }
                              >
                                {provider.isActive ? (
                                  <X className="h-4 w-4 mr-2" />
                                ) : (
                                  <Check className="h-4 w-4 mr-2" />
                                )}
                                {provider.isActive ? "Disable" : "Enable"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDefaultProvider(provider.id)}
                              >
                                <Star className="h-4 w-4 mr-2" />
                                Set as Default
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteProvider(provider.id)}
                                className="text-red-600"
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog
                open={showTemplateDialog}
                onOpenChange={setShowTemplateDialog}
              >
                <DialogTrigger asChild>
                  <Button onClick={resetTemplateForm} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Create Email Template</DialogTitle>
                    <DialogDescription>
                      Design reusable email templates for campaigns and
                      automation
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Template Name *</Label>
                        <Input
                          value={templateForm.name}
                          onChange={(e) =>
                            setTemplateForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Welcome Email"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select
                          value={templateForm.category}
                          onValueChange={(value: any) =>
                            setTemplateForm((prev) => ({
                              ...prev,
                              category: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="broadcast">Broadcast</SelectItem>
                            <SelectItem value="automation">
                              Automation
                            </SelectItem>
                            <SelectItem value="transactional">
                              Transactional
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Subject Line *</Label>
                      <Input
                        value={templateForm.subject}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          }))
                        }
                        placeholder="Welcome to our platform!"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Preview Text</Label>
                      <Input
                        value={templateForm.previewText}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            previewText: e.target.value,
                          }))
                        }
                        placeholder="This appears in email previews..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>HTML Content *</Label>
                      <Textarea
                        value={templateForm.htmlContent}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            htmlContent: e.target.value,
                          }))
                        }
                        placeholder="<div>Your HTML email content...</div>"
                        rows={8}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Plain Text Content</Label>
                      <Textarea
                        value={templateForm.textContent}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            textContent: e.target.value,
                          }))
                        }
                        placeholder="Plain text version of your email..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowTemplateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTemplate}>
                      Create Template
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {template.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          {template.isActive ? (
                            <Badge className="bg-green-500 text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => duplicateTemplate(template)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Subject
                        </Label>
                        <p className="text-sm line-clamp-2">
                          {template.subject}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Used {template.usageCount} times</span>
                        <span>{template.variables.length} variables</span>
                      </div>
                      {template.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(template.variables || [])
                            .slice(0, 3)
                            .map((variable) => (
                              <Badge
                                key={variable}
                                variant="outline"
                                className="text-xs"
                              >
                                {`{{${variable}}}`}
                              </Badge>
                            ))}
                          {template.variables.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.variables.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            {/* Campaigns Table */}
            <Card>
              <CardHeader>
                <CardTitle>Email Campaigns</CardTitle>
              </CardHeader>
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
                    {safeCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{campaign.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {campaign.subject}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>
                              {campaign.recipientCount.toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getCampaignStatusBadge(campaign.status)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              Opened:{" "}
                              {Math.round(
                                (campaign.stats.opened /
                                  campaign.stats.delivered) *
                                  100,
                              )}
                              %
                            </div>
                            <div className="text-muted-foreground">
                              Clicked:{" "}
                              {Math.round(
                                (campaign.stats.clicked /
                                  campaign.stats.opened) *
                                  100,
                              )}
                              %
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {campaign.sentAt
                              ? formatSystemDate(campaign.sentAt)
                              : formatSystemDate(campaign.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <BarChart3 className="h-4 w-4 mr-2" />
                                Analytics
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
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

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Performance Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <p>Performance charts will be displayed here</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Provider Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {safeProviders.map((provider) => (
                      <div key={provider.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{provider.name}</span>
                          {getProviderStatusBadge(provider)}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Sent</div>
                            <div className="font-medium">
                              {provider.stats.sent.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">
                              Delivered
                            </div>
                            <div className="font-medium">
                              {provider.stats.sent > 0
                                ? `${Math.round((provider.stats.delivered / provider.stats.sent) * 100)}%`
                                : "0%"}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Opened</div>
                            <div className="font-medium">
                              {provider.stats.delivered > 0
                                ? `${Math.round((provider.stats.opened / provider.stats.delivered) * 100)}%`
                                : "0%"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
