import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Save,
  Settings,
  User,
  Bell,
  Shield,
  DollarSign,
  Database,
  Mail,
  Server,
  Globe,
  Download,
  BarChart3,
  Building2,
  Camera,
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Play,
  Pause,
  Users,
  Key,
  Webhook,
  Monitor,
  Code,
  Palette,
  Activity,
  Calendar,
  MessageSquare,
  Phone,
  Lock,
  Upload,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import {
  BRANDING_KEY,
  type BrandingSettings,
  getSystemSetting,
  setSystemSetting,
  uploadBrandingAsset,
} from "@/lib/systemSettingsService";

interface LoginSlide {
  id?: string;
  sort_order: number;
  tag: string;
  headline: string;
  body: string;
  stat_value: string;
  stat_label: string;
  color: string;
  image_url?: string;
  active: boolean;
}

const SLIDE_COLORS = [
  { label: "Blue → Indigo", value: "from-blue-600 to-indigo-700" },
  { label: "Amber → Orange", value: "from-amber-500 to-orange-600" },
  { label: "Emerald → Teal", value: "from-emerald-500 to-teal-600" },
  { label: "Purple → Violet", value: "from-purple-600 to-violet-700" },
  { label: "Rose → Pink", value: "from-rose-500 to-pink-600" },
  { label: "Sky → Cyan", value: "from-sky-500 to-cyan-600" },
  { label: "Green → Lime", value: "from-green-500 to-lime-600" },
  { label: "Red → Rose", value: "from-red-600 to-rose-600" },
];

interface SuperAdminSettings {
  // System Information
  systemName: string;
  adminName: string;
  adminEmail: string;
  supportEmail: string;
  timezone: string;
  dateFormat: string;
  defaultCurrency: string;

  // System Settings
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  requireEmailVerification: boolean;
  enableApiAccess: boolean;
  dataRetentionDays: number;

  // Security Settings
  sessionTimeout: number;
  enableTwoFactor: boolean;
  apiRateLimit: number;
  enableAuditLogs: boolean;
}

const DEFAULT_SETTINGS: SuperAdminSettings = {
  systemName: "Local SEO Ranker",
  adminName: "",
  adminEmail: "",
  supportEmail: "",
  timezone: "UTC",
  dateFormat: "MM/DD/YYYY",
  defaultCurrency: "USD",
  maintenanceMode: false,
  allowNewSignups: true,
  requireEmailVerification: true,
  enableApiAccess: false,
  dataRetentionDays: 365,
  sessionTimeout: 60,
  enableTwoFactor: false,
  apiRateLimit: 1000,
  enableAuditLogs: true,
};

export default function SuperAdminSettings() {
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [billingStats, setBillingStats] = useState<{ monthlyRevenue: number; activeSubscriptions: number } | null>(null);

  // Controlled form state for create/edit dialogs
  const [workspaceForm, setWorkspaceForm] = useState({ name: "", storageLimit: "10", userLimit: "5" });
  const [planForm, setPlanForm] = useState({ name: "", price: "", features: "" });
  const [promoForm, setPromoForm] = useState({ name: "", code: "", discount: "", discountType: "%", usageLimit: "100", expiryDate: "" });

  const [settings, setSettings] = useState<SuperAdminSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>({});
  const [brandingUploading, setBrandingUploading] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("system");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setSettingsLoading(true);
      setSettingsError(null);
      try {
        const [global, brandingRow] = await Promise.all([
          getSystemSetting<Partial<SuperAdminSettings>>("global"),
          getSystemSetting<BrandingSettings>(BRANDING_KEY),
        ]);
        if (global) {
          // Only keep known keys so stale/removed fields (e.g. old SMTP
          // credentials) never come back into the form.
          const picked: Partial<SuperAdminSettings> = {};
          (Object.keys(DEFAULT_SETTINGS) as (keyof SuperAdminSettings)[]).forEach((k) => {
            if (global[k] !== undefined) (picked as any)[k] = global[k];
          });
          setSettings({ ...DEFAULT_SETTINGS, ...picked });
        }
        setBranding(brandingRow ?? {});
      } catch (err: any) {
        setSettingsError(err?.message ?? "Failed to load system settings");
        toast.error("Failed to load system settings: " + (err?.message ?? "unknown error"));
      } finally {
        setSettingsLoading(false);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const [wsRes, plRes, pcRes] = await Promise.all([
        supabaseClient.from("workspaces").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("plans").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("promo_codes").select("*").order("created_at", { ascending: false }),
      ]);
      for (const [label, res] of [["workspaces", wsRes], ["plans", plRes], ["promo codes", pcRes]] as const) {
        if (res.error) toast.error(`Failed to load ${label}: ${res.error.message}`);
      }
      if (wsRes.data) {
        setWorkspaces(wsRes.data.map((w: any) => ({
          id: w.id,
          name: w.name,
          users: w.user_count,
          storage: w.storage_used,
          modules: w.modules ?? [],
        })));
      }
      if (plRes.data) {
        setPlans(plRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          features: p.features ?? [],
        })));
      }
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [chargesRes, bizRes] = await Promise.all([
          supabaseClient
            .from("billing_records")
            .select("amount")
            .eq("type", "charge")
            .eq("status", "succeeded")
            .gte("created_at", monthStart.toISOString()),
          supabaseClient.from("businesses").select("metadata").eq("status", "active"),
        ]);
        if (chargesRes.error) throw chargesRes.error;
        if (bizRes.error) throw bizRes.error;
        const monthlyRevenue = (chargesRes.data ?? []).reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);
        const activeSubscriptions = (bizRes.data ?? []).filter((b: any) => {
          const meta = (b.metadata ?? {}) as Record<string, any>;
          return Boolean(meta.plan ?? meta.subscription_plan);
        }).length;
        setBillingStats({ monthlyRevenue, activeSubscriptions });
      } catch (err: any) {
        toast.error(`Failed to load billing stats: ${err?.message ?? "Unknown error"}`);
      }
      if (pcRes.data) {
        setPromoCodes(pcRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          discount: p.discount,
          discountType: p.discount_type,
          usageLimit: p.usage_limit,
          expiryDate: p.expiry_date ?? "",
          used: p.used,
        })));
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await setSystemSetting("global", settings);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save settings: " + (err?.message ?? "unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandingUpload = async (
    kind: "logo" | "favicon" | "login-background",
    file: File | undefined,
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    setBrandingUploading(kind);
    try {
      const url = await uploadBrandingAsset(kind, file);
      const keyMap = {
        logo: "logoUrl",
        favicon: "faviconUrl",
        "login-background": "loginBackgroundUrl",
      } as const;
      const next = { ...branding, [keyMap[kind]]: url };
      await setSystemSetting(BRANDING_KEY, next);
      setBranding(next);
      toast.success("Branding updated");
    } catch (err: any) {
      toast.error("Upload failed: " + (err?.message ?? "unknown error"));
    } finally {
      setBrandingUploading(null);
    }
  };

  const handleBrandingRemove = async (key: keyof BrandingSettings) => {
    try {
      const next = { ...branding };
      delete next[key];
      await setSystemSetting(BRANDING_KEY, next);
      setBranding(next);
      toast.success("Removed");
    } catch (err: any) {
      toast.error("Couldn't remove: " + (err?.message ?? "unknown error"));
    }
  };

  const updateSetting = (key: keyof SuperAdminSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const tabs = [
    { id: "system", label: "System", icon: Settings },
    { id: "workspaces", label: "Workspaces", icon: Building2 },
    { id: "billing", label: "Billing & Plans", icon: DollarSign },
    { id: "login-slides", label: "Login Slides", icon: Monitor },
    { id: "signup-slides", label: "Signup Slides", icon: Monitor },
    { id: "branding", label: "Branding", icon: Camera },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Settings</h1>
            <p className="text-muted-foreground">
              Manage system-wide configurations and preferences
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isLoading || settingsLoading || !!settingsError}
            className="gap-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

        {settingsLoading && (
          <p className="text-sm text-muted-foreground">Loading system settings…</p>
        )}
        {settingsError && !settingsLoading && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <span>Couldn't load system settings: {settingsError}</span>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar Navigation */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>

          {/* Settings Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* System Settings */}
            {activeTab === "system" && (
              <Card>
                <CardHeader>
                  <CardTitle>System Configuration</CardTitle>
                  <CardDescription>
                    Basic system information and global settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="systemName">System Name</Label>
                      <Input
                        id="systemName"
                        value={settings.systemName}
                        onChange={(e) =>
                          updateSetting("systemName", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminName">Admin Name</Label>
                      <Input
                        id="adminName"
                        value={settings.adminName}
                        onChange={(e) =>
                          updateSetting("adminName", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Admin Email</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={settings.adminEmail}
                        onChange={(e) =>
                          updateSetting("adminEmail", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supportEmail">Support Email</Label>
                      <Input
                        id="supportEmail"
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) =>
                          updateSetting("supportEmail", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* System Preferences */}
                  <div className="space-y-4">
                    <h4 className="font-medium">System Preferences</h4>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select
                          value={settings.timezone}
                          onValueChange={(value) =>
                            updateSetting("timezone", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/Los_Angeles">
                              Pacific Time
                            </SelectItem>
                            <SelectItem value="America/Denver">
                              Mountain Time
                            </SelectItem>
                            <SelectItem value="America/Chicago">
                              Central Time
                            </SelectItem>
                            <SelectItem value="America/New_York">
                              Eastern Time
                            </SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateFormat">Date Format</Label>
                        <Select
                          value={settings.dateFormat}
                          onValueChange={(value) =>
                            updateSetting("dateFormat", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MM/DD/YYYY">
                              MM/DD/YYYY
                            </SelectItem>
                            <SelectItem value="DD/MM/YYYY">
                              DD/MM/YYYY
                            </SelectItem>
                            <SelectItem value="YYYY-MM-DD">
                              YYYY-MM-DD
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="defaultCurrency">
                          Default Currency
                        </Label>
                        <Select
                          value={settings.defaultCurrency}
                          onValueChange={(value) =>
                            updateSetting("defaultCurrency", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CAD">CAD (C$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* System Controls */}
                  <div className="space-y-4">
                    <h4 className="font-medium">System Controls</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Maintenance Mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Temporarily disable access for maintenance
                          </p>
                        </div>
                        <Switch
                          checked={settings.maintenanceMode}
                          onCheckedChange={(checked) =>
                            updateSetting("maintenanceMode", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Allow New Signups</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable new user registrations
                          </p>
                        </div>
                        <Switch
                          checked={settings.allowNewSignups}
                          onCheckedChange={(checked) =>
                            updateSetting("allowNewSignups", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Require Email Verification</Label>
                          <p className="text-sm text-muted-foreground">
                            Users must verify email before accessing system
                          </p>
                        </div>
                        <Switch
                          checked={settings.requireEmailVerification}
                          onCheckedChange={(checked) =>
                            updateSetting("requireEmailVerification", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable API Access</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow third-party integrations via API
                          </p>
                        </div>
                        <Switch
                          checked={settings.enableApiAccess}
                          onCheckedChange={(checked) =>
                            updateSetting("enableApiAccess", checked)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Data Retention */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Data Retention</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Active Users</Label>
                        <Input value="Indefinite" disabled />
                        <p className="text-sm text-muted-foreground">
                          Data retained indefinitely for active users
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="canceledUserRetention">
                          Canceled Users (Days)
                        </Label>
                        <Input
                          id="canceledUserRetention"
                          type="number"
                          value={settings.dataRetentionDays}
                          onChange={(e) =>
                            updateSetting(
                              "dataRetentionDays",
                              parseInt(e.target.value),
                            )
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          Days to retain data after account cancellation
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Workspace Control */}
            {activeTab === "workspaces" && (
              <Card>
                <CardHeader>
                  <CardTitle>Subaccount / Workspace Control</CardTitle>
                  <CardDescription>
                    Manage subaccounts, allocate resources, and control module
                    access
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Active Workspaces</h4>
                    <Dialog
                      open={showWorkspaceDialog}
                      onOpenChange={setShowWorkspaceDialog}
                    >
                      <DialogTrigger asChild>
                        <Button
                          className="gap-2"
                          onClick={() => {
                            setEditingWorkspace(null);
                            setShowWorkspaceDialog(true);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Create Workspace
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {editingWorkspace
                              ? "Edit Workspace"
                              : "Create New Workspace"}
                          </DialogTitle>
                          <DialogDescription>
                            Configure workspace settings and module access
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Workspace Name</Label>
                            <Input
                              placeholder="Enter workspace name"
                              value={workspaceForm.name}
                              onChange={(e) => setWorkspaceForm((f) => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Storage Limit (GB)</Label>
                              <Input
                                type="number"
                                value={workspaceForm.storageLimit}
                                onChange={(e) => setWorkspaceForm((f) => ({ ...f, storageLimit: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>User Limit</Label>
                              <Input
                                type="number"
                                value={workspaceForm.userLimit}
                                onChange={(e) => setWorkspaceForm((f) => ({ ...f, userLimit: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowWorkspaceDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={async () => {
                              const name = workspaceForm.name.trim() || "New Workspace";
                              if (editingWorkspace) {
                                const { error } = await supabaseClient
                                  .from("workspaces")
                                  .update({ name, user_count: parseInt(workspaceForm.userLimit) || 5, storage_used: workspaceForm.storageLimit + " GB" })
                                  .eq("id", editingWorkspace.id);
                                if (!error) setWorkspaces((prev) => prev.map((w) => w.id === editingWorkspace.id ? { ...w, name, users: parseInt(workspaceForm.userLimit) || 5, storage: workspaceForm.storageLimit + " GB" } : w));
                              } else {
                                const { data } = await supabaseClient
                                  .from("workspaces")
                                  .insert({ name, user_count: parseInt(workspaceForm.userLimit) || 5, storage_used: workspaceForm.storageLimit + " GB", modules: ["Projects", "Gallery"] })
                                  .select().single();
                                if (data) setWorkspaces((prev) => [...prev, { id: data.id, name: data.name, users: data.user_count, storage: data.storage_used, modules: data.modules ?? [] }]);
                              }
                              setShowWorkspaceDialog(false);
                              setWorkspaceForm({ name: "", storageLimit: "10", userLimit: "5" });
                              toast.success(editingWorkspace ? "Workspace updated!" : "Workspace created!");
                            }}
                          >
                            {editingWorkspace ? "Update" : "Create"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-3">
                    {workspaces.map((workspace) => (
                      <div key={workspace.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{workspace.name}</h5>
                            <p className="text-sm text-muted-foreground">
                              {workspace.users} users • {workspace.storage}{" "}
                              storage used
                            </p>
                            <div className="flex gap-2 mt-2">
                              {workspace.modules.map((module) => (
                                <span
                                  key={module}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                >
                                  {module}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingWorkspace(workspace);
                                setWorkspaceForm({ name: workspace.name, storageLimit: String(workspace.storage?.replace(" GB", "") ?? "10"), userLimit: String(workspace.users ?? 5) });
                                setShowWorkspaceDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingWorkspace(workspace);
                                setShowWorkspaceDialog(true);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await supabaseClient
                                  .from("workspaces")
                                  .delete()
                                  .eq("id", workspace.id);
                                setWorkspaces((prev) =>
                                  prev.filter((w) => w.id !== workspace.id),
                                );
                                toast.success("Workspace deleted");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </CardContent>
              </Card>
            )}

            {/* Billing & Plans */}
            {activeTab === "billing" && (
              <Card>
                <CardHeader>
                  <CardTitle>Billing & Plans Management</CardTitle>
                  <CardDescription>
                    Configure pricing tiers, subscription plans, and billing
                    controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <h4 className="font-medium mb-2">Revenue This Month</h4>
                      <div className="text-2xl font-bold">
                        {billingStats
                          ? billingStats.monthlyRevenue.toLocaleString(undefined, { style: "currency", currency: "USD" })
                          : "—"}
                      </div>
                      <p className="text-sm text-muted-foreground">Succeeded charges since the 1st</p>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-medium mb-2">Active Subscriptions</h4>
                      <div className="text-2xl font-bold">{billingStats ? billingStats.activeSubscriptions : "—"}</div>
                      <p className="text-sm text-muted-foreground">Active businesses with a plan on file</p>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Pricing Tiers</h4>
                      <Dialog
                        open={showPlanDialog}
                        onOpenChange={setShowPlanDialog}
                      >
                        <DialogTrigger asChild>
                          <Button
                            className="gap-2"
                            onClick={() => {
                              setEditingPlan(null);
                              setShowPlanDialog(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Create Plan
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {editingPlan ? "Edit Plan" : "Create New Plan"}
                            </DialogTitle>
                            <DialogDescription>
                              Configure plan details, pricing, and features
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Plan Name</Label>
                                <Input
                                  placeholder="Plan name"
                                  value={planForm.name}
                                  onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Price</Label>
                                <Input
                                  placeholder="$99"
                                  value={planForm.price}
                                  onChange={(e) => setPlanForm((f) => ({ ...f, price: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Features (one per line)</Label>
                              <Textarea
                                placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                                rows={4}
                                value={planForm.features}
                                onChange={(e) => setPlanForm((f) => ({ ...f, features: e.target.value }))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setShowPlanDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={async () => {
                                const name = planForm.name.trim() || "New Plan";
                                const price = planForm.price.trim() || "$0";
                                const features = planForm.features.trim()
                                  ? planForm.features.split("\n").map((f) => f.trim()).filter(Boolean)
                                  : ["New Feature"];
                                if (editingPlan) {
                                  const { error } = await supabaseClient.from("plans").update({ name, price, features }).eq("id", editingPlan.id);
                                  if (!error) setPlans((prev) => prev.map((p) => p.id === editingPlan.id ? { ...p, name, price, features } : p));
                                } else {
                                  const { data } = await supabaseClient.from("plans").insert({ name, price, features }).select().single();
                                  if (data) setPlans((prev) => [...prev, { id: data.id, name: data.name, price: data.price, features: data.features }]);
                                }
                                setShowPlanDialog(false);
                                setPlanForm({ name: "", price: "", features: "" });
                                toast.success(editingPlan ? "Plan updated!" : "Plan created!");
                              }}
                            >
                              {editingPlan ? "Update" : "Create"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {plans.map((plan) => (
                        <div key={plan.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium">{plan.name}</h5>
                            <span className="text-lg font-bold">
                              {plan.price}
                            </span>
                          </div>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {plan.features.map((feature, idx) => (
                              <li key={idx}>• {feature}</li>
                            ))}
                          </ul>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingPlan(plan);
                                setPlanForm({ name: plan.name, price: plan.price, features: (plan.features ?? []).join("\n") });
                                setShowPlanDialog(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const { data } = await supabaseClient
                                  .from("plans")
                                  .insert({ name: plan.name + " Copy", price: plan.price, features: plan.features })
                                  .select()
                                  .single();
                                if (data) {
                                  setPlans((prev) => [...prev, { id: data.id, name: data.name, price: data.price, features: data.features }]);
                                }
                                toast.success("Plan cloned!");
                              }}
                            >
                              Clone
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Promo Codes & Discounts</h4>
                      <Dialog
                        open={showPromoDialog}
                        onOpenChange={setShowPromoDialog}
                      >
                        <DialogTrigger asChild>
                          <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Promo Code
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create Promo Code</DialogTitle>
                            <DialogDescription>
                              Configure promo code details and restrictions
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Promo Name</Label>
                                <Input
                                  placeholder="Summer Sale"
                                  value={promoForm.name}
                                  onChange={(e) => setPromoForm((f) => ({ ...f, name: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Promo Code</Label>
                                <Input
                                  placeholder="SUMMER2024"
                                  value={promoForm.code}
                                  onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                />
                              </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>Discount Amount</Label>
                                <Input
                                  placeholder="20"
                                  type="number"
                                  value={promoForm.discount}
                                  onChange={(e) => setPromoForm((f) => ({ ...f, discount: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Discount Type</Label>
                                <Select
                                  value={promoForm.discountType}
                                  onValueChange={(v) => setPromoForm((f) => ({ ...f, discountType: v }))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="%">Percentage (%)</SelectItem>
                                    <SelectItem value="$">Fixed Amount ($)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Usage Limit</Label>
                                <Input
                                  placeholder="100"
                                  type="number"
                                  value={promoForm.usageLimit}
                                  onChange={(e) => setPromoForm((f) => ({ ...f, usageLimit: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Expiry Date</Label>
                              <Input
                                type="date"
                                value={promoForm.expiryDate}
                                onChange={(e) => setPromoForm((f) => ({ ...f, expiryDate: e.target.value }))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setShowPromoDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={async () => {
                                const name = promoForm.name.trim() || "New Promo";
                                const code = promoForm.code.trim() || ("CODE" + Date.now());
                                const { data } = await supabaseClient
                                  .from("promo_codes")
                                  .insert({ name, code, discount: promoForm.discount || "10", discount_type: promoForm.discountType, usage_limit: promoForm.usageLimit || "100", expiry_date: promoForm.expiryDate || null, used: 0 })
                                  .select().single();
                                if (data) {
                                  setPromoCodes((prev) => [...prev, { id: data.id, name: data.name, code: data.code, discount: data.discount, discountType: data.discount_type, usageLimit: data.usage_limit, expiryDate: data.expiry_date ?? "", used: data.used }]);
                                }
                                setShowPromoDialog(false);
                                setPromoForm({ name: "", code: "", discount: "", discountType: "%", usageLimit: "100", expiryDate: "" });
                                toast.success("Promo code created!");
                              }}
                            >
                              Create
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-3">
                      {promoCodes.map((promo) => (
                        <div key={promo.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{promo.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Code: {promo.code} • {promo.discount}
                                {promo.discountType} off • Used: {promo.used}/
                                {promo.usageLimit} • Expires: {promo.expiryDate}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await supabaseClient
                                  .from("promo_codes")
                                  .delete()
                                  .eq("id", promo.id);
                                setPromoCodes((prev) =>
                                  prev.filter((p) => p.id !== promo.id),
                                );
                                toast.success("Promo code deleted");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">
                      Account-Specific Billing Actions
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Billing overrides are applied to specific user accounts in
                      the User Management section.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Branding & White Label */}
            {activeTab === "branding" && (
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>
                    Platform logo, favicon and login background. Files are stored in the media bucket and saved immediately.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Platform Logo</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center bg-muted/40">
                          {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Platform Logo" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            id="branding-logo"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              handleBrandingUpload("logo", f);
                            }}
                          />
                          <Button
                            variant="outline"
                            className="gap-2"
                            disabled={brandingUploading === "logo"}
                            onClick={() => document.getElementById("branding-logo")?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            {brandingUploading === "logo" ? "Uploading…" : branding.logoUrl ? "Replace" : "Upload"}
                          </Button>
                          {branding.logoUrl && (
                            <Button variant="ghost" size="sm" onClick={() => handleBrandingRemove("logoUrl")}>
                              Remove
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground">PNG, SVG or WebP, up to 5MB</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Favicon</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 border rounded-lg overflow-hidden flex items-center justify-center bg-muted/40">
                          {branding.faviconUrl ? (
                            <img src={branding.faviconUrl} alt="Favicon" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            id="branding-favicon"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              handleBrandingUpload("favicon", f);
                            }}
                          />
                          <Button
                            variant="outline"
                            className="gap-2"
                            disabled={brandingUploading === "favicon"}
                            onClick={() => document.getElementById("branding-favicon")?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            {brandingUploading === "favicon" ? "Uploading…" : branding.faviconUrl ? "Replace" : "Upload"}
                          </Button>
                          {branding.faviconUrl && (
                            <Button variant="ghost" size="sm" onClick={() => handleBrandingRemove("faviconUrl")}>
                              Remove
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground">Square PNG or ICO, 32–512px</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Login Background</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-40 h-24 border rounded-lg overflow-hidden flex items-center justify-center bg-muted/40">
                          {branding.loginBackgroundUrl ? (
                            <img src={branding.loginBackgroundUrl} alt="Login Background" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            id="branding-login-background"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              handleBrandingUpload("login-background", f);
                            }}
                          />
                          <Button
                            variant="outline"
                            className="gap-2"
                            disabled={brandingUploading === "login-background"}
                            onClick={() => document.getElementById("branding-login-background")?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            {brandingUploading === "login-background" ? "Uploading…" : branding.loginBackgroundUrl ? "Replace" : "Upload"}
                          </Button>
                          {branding.loginBackgroundUrl && (
                            <Button variant="ghost" size="sm" onClick={() => handleBrandingRemove("loginBackgroundUrl")}>
                              Remove
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground">Wide JPG or WebP, up to 5MB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Settings */}
            {activeTab === "security" && (
              <Card>
                <CardHeader>
                  <CardTitle>Security & Compliance</CardTitle>
                  <CardDescription>
                    Enhanced security controls, compliance settings, and access
                    restrictions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Authentication & Access</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>2FA Enforcement</Label>
                          <p className="text-sm text-muted-foreground">
                            Force all users to enable two-factor authentication
                          </p>
                        </div>
                        <Switch
                          checked={settings.enableTwoFactor}
                          onCheckedChange={(checked) =>
                            updateSetting("enableTwoFactor", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Audit Logging</Label>
                          <p className="text-sm text-muted-foreground">
                            Track all system-level events and user actions
                          </p>
                        </div>
                        <Switch
                          checked={settings.enableAuditLogs}
                          onCheckedChange={(checked) =>
                            updateSetting("enableAuditLogs", checked)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">
                        Session Timeout (minutes)
                      </Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) =>
                          updateSetting(
                            "sessionTimeout",
                            parseInt(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiRateLimit">
                        API Rate Limit (per hour)
                      </Label>
                      <Input
                        id="apiRateLimit"
                        type="number"
                        value={settings.apiRateLimit}
                        onChange={(e) =>
                          updateSetting(
                            "apiRateLimit",
                            parseInt(e.target.value),
                          )
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Database Settings */}
            {activeTab === "login-slides" && (
              <LoginSlidesManager />
            )}

            {activeTab === "signup-slides" && (
              <SignupSlidesManager />
            )}

          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}

// ── Signup Slides Manager ─────────────────────────────────────────────────────
function SignupSlidesManager() {
  const [slides, setSlides] = useState<LoginSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSlide, setEditingSlide] = useState<LoginSlide | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const blankSlide = (): LoginSlide => ({
    sort_order: slides.length,
    tag: "",
    headline: "",
    body: "",
    stat_value: "",
    stat_label: "",
    color: "from-blue-600 to-indigo-700",
    image_url: "",
    active: true,
  });

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("signup_slides")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error("Failed to load slides: " + error.message);
    } else {
      setSlides((data as LoginSlide[]) || []);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditingSlide(blankSlide());
    setIsDialogOpen(true);
  };

  const openEdit = (slide: LoginSlide) => {
    setEditingSlide({ ...slide });
    setIsDialogOpen(true);
  };

  const saveSlide = async () => {
    if (!editingSlide) return;
    setSaving(true);
    try {
      if (editingSlide.id) {
        const { error } = await supabaseClient
          .from("signup_slides")
          .update({
            tag: editingSlide.tag,
            headline: editingSlide.headline,
            body: editingSlide.body,
            stat_value: editingSlide.stat_value,
            stat_label: editingSlide.stat_label,
            color: editingSlide.color,
            image_url: editingSlide.image_url || null,
            active: editingSlide.active,
            sort_order: editingSlide.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSlide.id);
        if (error) throw error;
        toast.success("Slide updated");
      } else {
        const { error } = await supabaseClient.from("signup_slides").insert({
          tag: editingSlide.tag,
          headline: editingSlide.headline,
          body: editingSlide.body,
          stat_value: editingSlide.stat_value,
          stat_label: editingSlide.stat_label,
          color: editingSlide.color,
          image_url: editingSlide.image_url || null,
          active: editingSlide.active,
          sort_order: editingSlide.sort_order,
        });
        if (error) throw error;
        toast.success("Slide created");
      }
      setIsDialogOpen(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteSlide = async (id: string) => {
    if (!confirm("Delete this slide?")) return;
    const { error } = await supabaseClient.from("signup_slides").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed: " + error.message);
    } else {
      toast.success("Slide deleted");
      fetchSlides();
    }
  };

  const toggleActive = async (slide: LoginSlide) => {
    const { error } = await supabaseClient
      .from("signup_slides")
      .update({ active: !slide.active, updated_at: new Date().toISOString() })
      .eq("id", slide.id!);
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      fetchSlides();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sign Up Page Slides</CardTitle>
            <CardDescription>
              Manage the feature highlight slides shown on the right side of the sign up screen. These are separate from the login slides. If no slides are configured, the system defaults are used.
            </CardDescription>
          </div>
          <Button onClick={openNew} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Slide
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              Loading slides…
            </div>
          ) : slides.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Monitor className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No custom slides yet</p>
              <p className="text-sm mt-1">The sign up page is using the built-in default slides.</p>
              <Button onClick={openNew} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Create First Slide
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {slides.map((slide) => (
                <div
                  key={slide.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg ${!slide.active ? "opacity-50" : ""}`}
                >
                  <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${slide.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{slide.tag}</span>
                      {!slide.active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </div>
                    <p className="font-semibold truncate">{slide.headline}</p>
                    <p className="text-sm text-muted-foreground truncate">{slide.body}</p>
                  </div>
                  <div className="hidden md:block text-right shrink-0">
                    <div className="font-bold text-lg">{slide.stat_value}</div>
                    <div className="text-xs text-muted-foreground">{slide.stat_label}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(slide)} title={slide.active ? "Hide slide" : "Show slide"}>
                      {slide.active ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 opacity-40" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(slide)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteSlide(slide.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlide?.id ? "Edit Slide" : "New Slide"}</DialogTitle>
            <DialogDescription>
              Fill in the slide content. Changes are reflected on the sign up page immediately.
            </DialogDescription>
          </DialogHeader>

          {editingSlide && (
            <div className="space-y-4">
              <div className={`h-16 rounded-xl bg-gradient-to-br ${editingSlide.color} flex items-end p-3`}>
                <span className="text-white font-bold text-sm truncate">{editingSlide.headline || "Headline preview"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tag / Category</Label>
                  <Input placeholder="e.g. Local SEO" value={editingSlide.tag} onChange={(e) => setEditingSlide({ ...editingSlide, tag: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Display Order</Label>
                  <Input type="number" min={0} value={editingSlide.sort_order} onChange={(e) => setEditingSlide({ ...editingSlide, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input placeholder="e.g. Dominate Local Search Results" value={editingSlide.headline} onChange={(e) => setEditingSlide({ ...editingSlide, headline: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Body Text</Label>
                <Textarea placeholder="A short description of this feature…" rows={3} value={editingSlide.body} onChange={(e) => setEditingSlide({ ...editingSlide, body: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Stat Value</Label>
                  <Input placeholder="e.g. 3.2× or 500+" value={editingSlide.stat_value} onChange={(e) => setEditingSlide({ ...editingSlide, stat_value: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Stat Label</Label>
                  <Input placeholder="e.g. more calls in 90 days" value={editingSlide.stat_label} onChange={(e) => setEditingSlide({ ...editingSlide, stat_label: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Background Gradient</Label>
                <Select value={editingSlide.color} onValueChange={(v) => setEditingSlide({ ...editingSlide, color: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SLIDE_COLORS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`h-4 w-8 rounded bg-gradient-to-r ${c.value}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Image URL (optional)</Label>
                <Input placeholder="https://… (overrides gradient background)" value={editingSlide.image_url || ""} onChange={(e) => setEditingSlide({ ...editingSlide, image_url: e.target.value })} />
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={editingSlide.active} onCheckedChange={(v) => setEditingSlide({ ...editingSlide, active: v })} />
                <Label>Visible on sign up page</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSlide} disabled={saving} className="gap-2">
              {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {editingSlide?.id ? "Save Changes" : "Create Slide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Login Slides Manager ──────────────────────────────────────────────────────
function LoginSlidesManager() {
  const [slides, setSlides] = useState<LoginSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSlide, setEditingSlide] = useState<LoginSlide | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const blankSlide = (): LoginSlide => ({
    sort_order: slides.length,
    tag: "",
    headline: "",
    body: "",
    stat_value: "",
    stat_label: "",
    color: "from-blue-600 to-indigo-700",
    image_url: "",
    active: true,
  });

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("login_slides")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error("Failed to load slides: " + error.message);
    } else {
      setSlides((data as LoginSlide[]) || []);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditingSlide(blankSlide());
    setIsDialogOpen(true);
  };

  const openEdit = (slide: LoginSlide) => {
    setEditingSlide({ ...slide });
    setIsDialogOpen(true);
  };

  const saveSlide = async () => {
    if (!editingSlide) return;
    setSaving(true);
    try {
      if (editingSlide.id) {
        const { error } = await supabaseClient
          .from("login_slides")
          .update({
            tag: editingSlide.tag,
            headline: editingSlide.headline,
            body: editingSlide.body,
            stat_value: editingSlide.stat_value,
            stat_label: editingSlide.stat_label,
            color: editingSlide.color,
            image_url: editingSlide.image_url || null,
            active: editingSlide.active,
            sort_order: editingSlide.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSlide.id);
        if (error) throw error;
        toast.success("Slide updated");
      } else {
        const { error } = await supabaseClient.from("login_slides").insert({
          tag: editingSlide.tag,
          headline: editingSlide.headline,
          body: editingSlide.body,
          stat_value: editingSlide.stat_value,
          stat_label: editingSlide.stat_label,
          color: editingSlide.color,
          image_url: editingSlide.image_url || null,
          active: editingSlide.active,
          sort_order: editingSlide.sort_order,
        });
        if (error) throw error;
        toast.success("Slide created");
      }
      setIsDialogOpen(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteSlide = async (id: string) => {
    if (!confirm("Delete this slide?")) return;
    const { error } = await supabaseClient.from("login_slides").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed: " + error.message);
    } else {
      toast.success("Slide deleted");
      fetchSlides();
    }
  };

  const toggleActive = async (slide: LoginSlide) => {
    const { error } = await supabaseClient
      .from("login_slides")
      .update({ active: !slide.active, updated_at: new Date().toISOString() })
      .eq("id", slide.id!);
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      fetchSlides();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Login Page Slides</CardTitle>
            <CardDescription>
              Manage the feature highlight slides shown on the right side of the login screen. If no slides are configured, the system defaults are used.
            </CardDescription>
          </div>
          <Button onClick={openNew} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Slide
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              Loading slides…
            </div>
          ) : slides.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Monitor className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No custom slides yet</p>
              <p className="text-sm mt-1">The login page is using the built-in default slides.</p>
              <Button onClick={openNew} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Create First Slide
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg ${!slide.active ? "opacity-50" : ""}`}
                >
                  {/* Color swatch */}
                  <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${slide.color} shrink-0`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{slide.tag}</span>
                      {!slide.active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </div>
                    <p className="font-semibold truncate">{slide.headline}</p>
                    <p className="text-sm text-muted-foreground truncate">{slide.body}</p>
                  </div>

                  {/* Stat */}
                  <div className="hidden md:block text-right shrink-0">
                    <div className="font-bold text-lg">{slide.stat_value}</div>
                    <div className="text-xs text-muted-foreground">{slide.stat_label}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleActive(slide)}
                      title={slide.active ? "Hide slide" : "Show slide"}
                    >
                      {slide.active ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 opacity-40" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(slide)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteSlide(slide.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlide?.id ? "Edit Slide" : "New Slide"}</DialogTitle>
            <DialogDescription>
              Fill in the slide content. Changes are reflected on the login page immediately.
            </DialogDescription>
          </DialogHeader>

          {editingSlide && (
            <div className="space-y-4">
              {/* Preview swatch */}
              <div className={`h-16 rounded-xl bg-gradient-to-br ${editingSlide.color} flex items-end p-3`}>
                <span className="text-white font-bold text-sm truncate">{editingSlide.headline || "Headline preview"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tag / Category</Label>
                  <Input
                    placeholder="e.g. Local SEO"
                    value={editingSlide.tag}
                    onChange={(e) => setEditingSlide({ ...editingSlide, tag: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editingSlide.sort_order}
                    onChange={(e) => setEditingSlide({ ...editingSlide, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input
                  placeholder="e.g. Dominate Local Search Results"
                  value={editingSlide.headline}
                  onChange={(e) => setEditingSlide({ ...editingSlide, headline: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Body Text</Label>
                <Textarea
                  placeholder="A short description of this feature…"
                  rows={3}
                  value={editingSlide.body}
                  onChange={(e) => setEditingSlide({ ...editingSlide, body: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Stat Value</Label>
                  <Input
                    placeholder="e.g. 3.2× or 500+"
                    value={editingSlide.stat_value}
                    onChange={(e) => setEditingSlide({ ...editingSlide, stat_value: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Stat Label</Label>
                  <Input
                    placeholder="e.g. more calls in 90 days"
                    value={editingSlide.stat_label}
                    onChange={(e) => setEditingSlide({ ...editingSlide, stat_label: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Background Gradient</Label>
                <Select
                  value={editingSlide.color}
                  onValueChange={(v) => setEditingSlide({ ...editingSlide, color: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLIDE_COLORS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`h-4 w-8 rounded bg-gradient-to-r ${c.value}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Image URL (optional)</Label>
                <Input
                  placeholder="https://… (overrides gradient background)"
                  value={editingSlide.image_url || ""}
                  onChange={(e) => setEditingSlide({ ...editingSlide, image_url: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={editingSlide.active}
                  onCheckedChange={(v) => setEditingSlide({ ...editingSlide, active: v })}
                />
                <Label>Visible on login page</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSlide} disabled={saving} className="gap-2">
              {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {editingSlide?.id ? "Save Changes" : "Create Slide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
