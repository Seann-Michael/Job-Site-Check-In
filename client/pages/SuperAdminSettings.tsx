// @ts-nocheck - Temporary suppression of type errors
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

  // System Settings
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  requireEmailVerification: boolean;
  enableApiAccess: boolean;
  maxUsersPerAccount: number;
  dataRetentionDays: number;

  // Security Settings
  sessionTimeout: number;
  passwordComplexity: string;
  enableTwoFactor: boolean;
  apiRateLimit: number;
  enableAuditLogs: boolean;

  // Email Settings
  emailProvider: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;

  // Notification Settings
  systemAlerts: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
  userNotifications: boolean;

  // Financial Settings
  defaultCurrency: string;
  taxRate: number;
  enableInvoicing: boolean;
  paymentGateway: string;
  enableSubscriptions: boolean;

  // AI Settings
  openaiApiKey: string;
  openaiOrganization: string;
  enableAiFeatures: boolean;
}

export default function SuperAdminSettings() {
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState([
    {
      id: "1",
      name: "Marketing Pro",
      users: 15,
      storage: "8.5 GB",
      modules: ["Projects", "Gallery"],
    },
    {
      id: "2",
      name: "Sales Team",
      users: 8,
      storage: "3.2 GB",
      modules: ["Projects"],
    },
    {
      id: "3",
      name: "Enterprise Corp",
      users: 50,
      storage: "25 GB",
      modules: ["Projects", "Gallery"],
    },
  ]);
  const [plans, setPlans] = useState([
    {
      id: "1",
      name: "Starter",
      price: "$29",
      features: ["5 Users", "10GB Storage", "Basic Support"],
    },
    {
      id: "2",
      name: "Professional",
      price: "$79",
      features: [
        "25 Users",
        "100GB Storage",
        "Priority Support",
        "Advanced Features",
      ],
    },
    {
      id: "3",
      name: "Enterprise",
      price: "$199",
      features: [
        "Unlimited Users",
        "1TB Storage",
        "24/7 Support",
        "Custom Integration",
      ],
    },
  ]);
  const [promoCodes, setPromoCodes] = useState([
    {
      id: "1",
      name: "New Year",
      code: "NEWYEAR2024",
      discount: "20",
      discountType: "%",
      usageLimit: "100",
      expiryDate: "2024-12-31",
      used: 45,
    },
  ]);

  const [settings, setSettings] = useState<SuperAdminSettings>({
    // System Information
    systemName: "Local GMB Booster",
    adminName: "Super Admin",
    adminEmail: "admin@localgmbbooster.com",
    supportEmail: "support@localgmbbooster.com",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",

    // System Settings
    maintenanceMode: false,
    allowNewSignups: true,
    requireEmailVerification: true,
    enableApiAccess: true,
    maxUsersPerAccount: 50,
    dataRetentionDays: 365,

    // Security Settings
    sessionTimeout: 60,
    passwordComplexity: "strong",
    enableTwoFactor: true,
    apiRateLimit: 1000,
    enableAuditLogs: true,

    // Email Settings
    emailProvider: "smtp",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "noreply@localgmbbooster.com",
    fromName: "Local GMB Booster",

    // Notification Settings
    systemAlerts: true,
    securityAlerts: true,
    marketingEmails: false,
    userNotifications: true,

    // Financial Settings
    defaultCurrency: "USD",
    taxRate: 8.25,
    enableInvoicing: true,
    paymentGateway: "stripe",
    enableSubscriptions: true,

    // AI Settings
    openaiApiKey: "",
    openaiOrganization: "",
    enableAiFeatures: true,
  });

  const [activeTab, setActiveTab] = useState("system");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem("super_admin_settings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save to localStorage
      localStorage.setItem("super_admin_settings", JSON.stringify(settings));

      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
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
    { id: "integrations", label: "Integrations", icon: Globe },
    { id: "reviews", label: "Review System", icon: MessageSquare },
    { id: "login-slides", label: "Login Slides", icon: Monitor },
    { id: "signup-slides", label: "Signup Slides", icon: Monitor },
    { id: "branding", label: "Branding", icon: Camera },
    { id: "features", label: "Feature Control", icon: BarChart3 },
    { id: "security", label: "Security", icon: Shield },
    { id: "monitoring", label: "Monitoring", icon: Bell },
    { id: "developer", label: "Developer", icon: Database },
    { id: "communication", label: "Communication", icon: Mail },
    { id: "legal", label: "Legal", icon: FileText },
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
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

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

                  {/* Preferences */}
                  <div className="space-y-4">
                    <h4 className="font-medium">System Preferences</h4>
                    <div className="grid gap-4 md:grid-cols-2">
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
                              defaultValue={editingWorkspace?.name}
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Storage Limit (GB)</Label>
                              <Input type="number" defaultValue="10" />
                            </div>
                            <div className="space-y-2">
                              <Label>User Limit</Label>
                              <Input type="number" defaultValue="5" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Available Modules</Label>
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm">Projects</span>
                                <Switch defaultChecked />
                              </div>
                              <div className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm">Gallery</span>
                                <Switch defaultChecked />
                              </div>
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
                            onClick={() => {
                              if (!editingWorkspace) {
                                const newWorkspace = {
                                  id: Date.now().toString(),
                                  name: "New Workspace",
                                  users: 0,
                                  storage: "0 GB",
                                  modules: ["Projects", "Gallery"],
                                };
                                setWorkspaces([...workspaces, newWorkspace]);
                              }
                              setShowWorkspaceDialog(false);
                              toast.success(
                                editingWorkspace
                                  ? "Workspace updated!"
                                  : "Workspace created!",
                              );
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
                              onClick={() => {
                                setWorkspaces(
                                  workspaces.filter(
                                    (w) => w.id !== workspace.id,
                                  ),
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

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Default Resource Allocation</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Default Storage Limit (GB)</Label>
                        <Input type="number" defaultValue="10" />
                      </div>
                      <div className="space-y-2">
                        <Label>API Usage Limit (per month)</Label>
                        <Input type="number" defaultValue="10000" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Available Modules</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">Projects</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">Gallery</span>
                        <Switch defaultChecked />
                      </div>
                    </div>
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
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="p-4">
                      <h4 className="font-medium mb-2">Monthly Revenue</h4>
                      <div className="text-2xl font-bold">$45,230</div>
                      <p className="text-sm text-green-600">+12% this month</p>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-medium mb-2">Active Subscriptions</h4>
                      <div className="text-2xl font-bold">347</div>
                      <p className="text-sm text-blue-600">+8 new this week</p>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-medium mb-2">Trial Accounts</h4>
                      <div className="text-2xl font-bold">23</div>
                      <p className="text-sm text-orange-600">
                        5 converting soon
                      </p>
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
                                  defaultValue={editingPlan?.name}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Price</Label>
                                <Input
                                  placeholder="$99"
                                  defaultValue={editingPlan?.price}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Features (one per line)</Label>
                              <Textarea
                                placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                                rows={4}
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
                              onClick={() => {
                                if (!editingPlan) {
                                  const newPlan = {
                                    id: Date.now().toString(),
                                    name: "New Plan",
                                    price: "$0",
                                    features: ["New Feature"],
                                  };
                                  setPlans([...plans, newPlan]);
                                }
                                setShowPlanDialog(false);
                                toast.success(
                                  editingPlan
                                    ? "Plan updated!"
                                    : "Plan created!",
                                );
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
                                setShowPlanDialog(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const clonedPlan = {
                                  ...plan,
                                  id: Date.now().toString(),
                                  name: plan.name + " Copy",
                                };
                                setPlans([...plans, clonedPlan]);
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
                                <Input placeholder="Summer Sale" />
                              </div>
                              <div className="space-y-2">
                                <Label>Promo Code</Label>
                                <Input placeholder="SUMMER2024" />
                              </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>Discount Amount</Label>
                                <Input placeholder="20" type="number" />
                              </div>
                              <div className="space-y-2">
                                <Label>Discount Type</Label>
                                <Select defaultValue="%">
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="%">
                                      Percentage (%)
                                    </SelectItem>
                                    <SelectItem value="$">
                                      Fixed Amount ($)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Usage Limit</Label>
                                <Input placeholder="100" type="number" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Expiry Date</Label>
                              <Input type="date" />
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
                              onClick={() => {
                                const newPromo = {
                                  id: Date.now().toString(),
                                  name: "New Promo",
                                  code: "NEWCODE",
                                  discount: "10",
                                  discountType: "%",
                                  usageLimit: "100",
                                  expiryDate: "2024-12-31",
                                  used: 0,
                                };
                                setPromoCodes([...promoCodes, newPromo]);
                                setShowPromoDialog(false);
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
                              onClick={() => {
                                setPromoCodes(
                                  promoCodes.filter((p) => p.id !== promo.id),
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
                  <CardTitle>Branding & White Label</CardTitle>
                  <CardDescription>
                    Customize platform appearance, logos, and branding elements
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-medium">Platform Branding</h4>

                      <div className="space-y-2">
                        <Label>Platform Logo</Label>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <Button variant="outline" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload Logo
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Favicon</Label>
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 border border-muted-foreground rounded flex items-center justify-center">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Button variant="outline" size="sm">
                            Upload Favicon
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Color Scheme</h4>

                      <div className="grid gap-2">
                        <div className="flex items-center gap-3">
                          <Label className="w-20">Primary</Label>
                          <div className="w-8 h-8 bg-blue-600 rounded border"></div>
                          <Input
                            type="color"
                            defaultValue="#2563eb"
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label className="w-20">Secondary</Label>
                          <div className="w-8 h-8 bg-gray-600 rounded border"></div>
                          <Input
                            type="color"
                            defaultValue="#64748b"
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label className="w-20">Accent</Label>
                          <div className="w-8 h-8 bg-green-600 rounded border"></div>
                          <Input
                            type="color"
                            defaultValue="#16a34a"
                            className="w-20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Typography</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Primary Font</Label>
                        <Select defaultValue="inter">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inter">Inter</SelectItem>
                            <SelectItem value="roboto">Roboto</SelectItem>
                            <SelectItem value="opensans">Open Sans</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Secondary Font</Label>
                        <Select defaultValue="system">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="arial">Arial</SelectItem>
                            <SelectItem value="helvetica">Helvetica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Email Templates</h4>
                    <div className="grid gap-2">
                      <Button variant="outline" className="justify-start">
                        Welcome Email Template
                      </Button>
                      <Button variant="outline" className="justify-start">
                        Password Reset Template
                      </Button>
                      <Button variant="outline" className="justify-start">
                        Invoice Template
                      </Button>
                      <Button variant="outline" className="justify-start">
                        Notification Template
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Login Page Customization</h4>
                    <div className="space-y-2">
                      <Label>Background Image</Label>
                      <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Background
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feature Control */}
            {activeTab === "features" && (
              <Card>
                <CardHeader>
                  <CardTitle>Feature Toggles & Module Control</CardTitle>
                  <CardDescription>
                    Enable/disable features, manage rollouts, and control access
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Core Features</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          name: "AI Content Writer",
                          status: true,
                          users: "All Users",
                        },
                        {
                          name: "Advanced Analytics",
                          status: true,
                          users: "Pro & Enterprise",
                        },
                        {
                          name: "Custom Integrations",
                          status: false,
                          users: "Enterprise Only",
                        },
                        {
                          name: "White Label Access",
                          status: true,
                          users: "Enterprise Only",
                        },
                        {
                          name: "API Access",
                          status: true,
                          users: "All Users",
                        },
                        {
                          name: "Mobile App",
                          status: false,
                          users: "Beta Users",
                        },
                      ].map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{feature.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {feature.users}
                            </div>
                          </div>
                          <Switch checked={feature.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Beta Features</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Enhanced Gallery</div>
                            <div className="text-sm text-muted-foreground">
                              Advanced image management features
                            </div>
                            <div className="text-xs text-blue-600">
                              15 Beta Users
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              Manage Access
                            </Button>
                            <Switch />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Scheduled Releases</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">Mobile App v2.0</div>
                          <div className="text-sm text-muted-foreground">
                            Scheduled for March 15, 2024
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Pause className="h-4 w-4" />
                          </Button>
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

                  <div className="space-y-4">
                    <h4 className="font-medium">IP Access Control</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Whitelist IP Addresses</Label>
                        <Textarea
                          placeholder="192.168.1.0/24&#10;10.0.0.0/16&#10;203.0.113.0/24"
                          rows={3}
                        />
                        <p className="text-sm text-muted-foreground">
                          Allowed IP ranges for admin access. One per line.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Blacklist IP Addresses</Label>
                        <Textarea
                          placeholder="192.168.2.0/24&#10;Bad actor IPs"
                          rows={3}
                        />
                        <p className="text-sm text-muted-foreground">
                          Blocked IP ranges. One per line.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">White Label Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Allow White Label Access</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable white labeling features for enterprise
                            clients
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Custom Domain Support</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow clients to use custom domains
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Hide Platform Branding</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow clients to hide platform branding
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">GDPR & Compliance</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Cookie Consent Banner</Label>
                          <p className="text-sm text-muted-foreground">
                            Display GDPR-compliant cookie consent
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="space-y-2">
                        <Label>Data Retention Period (days)</Label>
                        <Input type="number" defaultValue="365" />
                        <p className="text-sm text-muted-foreground">
                          Automatically purge user data after this period
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Privacy Policy URL</Label>
                        <Input placeholder="https://yoursite.com/privacy" />
                      </div>

                      <div className="space-y-2">
                        <Label>Terms of Service URL</Label>
                        <Input placeholder="https://yoursite.com/terms" />
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

            {/* Monitoring & Logs */}
            {activeTab === "monitoring" && (
              <Card>
                <CardHeader>
                  <CardTitle>System Monitoring & Logs</CardTitle>
                  <CardDescription>
                    Monitor system health, webhooks, user reports, and resource
                    usage
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-green-500" />
                        <span className="font-medium">System Health</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        99.9%
                      </div>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Webhook className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Webhooks</span>
                      </div>
                      <div className="text-2xl font-bold">1,234</div>
                      <p className="text-sm text-muted-foreground">Today</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">API Calls</span>
                      </div>
                      <div className="text-2xl font-bold">45.2K</div>
                      <p className="text-sm text-muted-foreground">This hour</p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Storage</span>
                      </div>
                      <div className="text-2xl font-bold">2.4TB</div>
                      <p className="text-sm text-muted-foreground">Used</p>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Webhook Logs</h4>
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-3 text-left">Endpoint</th>
                            <th className="p-3 text-left">Event</th>
                            <th className="p-3 text-left">Status</th>
                            <th className="p-3 text-left">Response Time</th>
                            <th className="p-3 text-left">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-3">api.example.com/webhook</td>
                            <td className="p-3">user.created</td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                200
                              </span>
                            </td>
                            <td className="p-3">145ms</td>
                            <td className="p-3">2 min ago</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">hooks.client.com/events</td>
                            <td className="p-3">payment.failed</td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                500
                              </span>
                            </td>
                            <td className="p-3">timeout</td>
                            <td className="p-3">5 min ago</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Resource Usage</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Bandwidth (Monthly)</span>
                          <span className="text-sm font-medium">
                            847 GB / 1 TB
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: "84.7%" }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">AI Tokens (Monthly)</span>
                          <span className="text-sm font-medium">1.2M / 2M</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: "60%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Error Reports</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-red-600">
                              Database Connection Timeout
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Affected 12 users • 5 minutes ago
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Developer Tools */}
            {activeTab === "developer" && (
              <Card>
                <CardHeader>
                  <CardTitle>Developer Tools</CardTitle>
                  <CardDescription>
                    Environment variables, custom code injection, and testing
                    tools
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Environment Variables</h4>
                    <div className="space-y-3">
                      {[
                        {
                          key: "DATABASE_URL",
                          value: "postgresql://***",
                          type: "Backend",
                        },
                        {
                          key: "STRIPE_SECRET_KEY",
                          value: "sk_***",
                          type: "Backend",
                        },
                        {
                          key: "REACT_APP_API_URL",
                          value: "https://api.example.com",
                          type: "Frontend",
                        },
                      ].map((env, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{env.key}</div>
                            <div className="text-sm text-muted-foreground">
                              {env.value}
                            </div>
                            <div className="text-xs text-blue-600">
                              {env.type}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Variable
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Custom Code Injection</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Global JavaScript</Label>
                        <Textarea
                          placeholder="// Custom JavaScript code here"
                          rows={4}
                        />
                        <p className="text-sm text-muted-foreground">
                          Injected into all pages before &lt;/body&gt;
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Global CSS</Label>
                        <Textarea
                          placeholder="/* Custom CSS styles here */"
                          rows={4}
                        />
                        <p className="text-sm text-muted-foreground">
                          Injected into all pages in &lt;head&gt;
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">API Testing Tools</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="p-4">
                        <h5 className="font-medium mb-2">Webhook Tester</h5>
                        <div className="space-y-2">
                          <Input placeholder="Webhook URL" />
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Event Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user.created">
                                user.created
                              </SelectItem>
                              <SelectItem value="payment.success">
                                payment.success
                              </SelectItem>
                              <SelectItem value="project.completed">
                                project.completed
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button className="w-full">Send Test</Button>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h5 className="font-medium mb-2">CLI Tools</h5>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                          >
                            <Code className="h-4 w-4" />
                            Open Terminal
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download Logs
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                          >
                            <Database className="h-4 w-4" />
                            Database Console
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Communication */}
            {activeTab === "communication" && (
              <Card>
                <CardHeader>
                  <CardTitle>Communication & Messaging</CardTitle>
                  <CardDescription>
                    Configure system-wide communication settings and social
                    media
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">System Contact Information</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Primary Phone Number</Label>
                        <Input placeholder="+1 (555) 123-4567" />
                      </div>
                      <div className="space-y-2">
                        <Label>Support Email</Label>
                        <Input placeholder="support@yourplatform.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Sales Phone</Label>
                        <Input placeholder="+1 (555) 123-4568" />
                      </div>
                      <div className="space-y-2">
                        <Label>Sales Email</Label>
                        <Input placeholder="sales@yourplatform.com" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">
                      SMS & Communication Settings
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>SMS Provider</Label>
                        <Select defaultValue="twilio">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="twilio">Twilio</SelectItem>
                            <SelectItem value="aws">AWS SNS</SelectItem>
                            <SelectItem value="messagebird">
                              MessageBird
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Default Sender ID</Label>
                        <Input placeholder="YourBrand" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Legal & Admin */}
            {activeTab === "legal" && (
              <Card>
                <CardHeader>
                  <CardTitle>Legal & Administrative Settings</CardTitle>
                  <CardDescription>
                    Manage terms of service, privacy policy, and legal
                    compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Legal Documents</h4>
                    <div className="space-y-3">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">Terms of Service</h5>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last updated: March 1, 2024
                        </p>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload New Version
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">Privacy Policy</h5>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last updated: March 1, 2024
                        </p>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload New Version
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">Cookie Policy</h5>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last updated: February 15, 2024
                        </p>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload New Version
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Compliance Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>GDPR Compliance Mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable EU data protection compliance features
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>CCPA Compliance Mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable California privacy compliance features
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Age Verification Required</Label>
                          <p className="text-sm text-muted-foreground">
                            Require age verification for new accounts
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Legal Contact Information</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Legal Entity Name</Label>
                        <Input placeholder="Your Company Legal Name LLC" />
                      </div>
                      <div className="space-y-2">
                        <Label>Legal Contact Email</Label>
                        <Input placeholder="legal@yourcompany.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Business Registration Number</Label>
                        <Input placeholder="12345678" />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax ID / VAT Number</Label>
                        <Input placeholder="US123456789" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Copyright & Disclaimers</h4>
                    <div className="space-y-2">
                      <Label>Copyright Notice</Label>
                      <Textarea
                        placeholder="© 2024 Your Company Name. All rights reserved."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>General Disclaimer</Label>
                      <Textarea
                        placeholder="The information provided on this platform is for general informational purposes only..."
                        rows={4}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Email Settings */}
            {activeTab === "email" && (
              <Card>
                <CardHeader>
                  <CardTitle>Email Configuration</CardTitle>
                  <CardDescription>
                    Configure email delivery and SMTP settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fromEmail">From Email</Label>
                      <Input
                        id="fromEmail"
                        type="email"
                        value={settings.fromEmail}
                        onChange={(e) =>
                          updateSetting("fromEmail", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromName">From Name</Label>
                      <Input
                        id="fromName"
                        value={settings.fromName}
                        onChange={(e) =>
                          updateSetting("fromName", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">SMTP Configuration</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="smtpHost">SMTP Host</Label>
                        <Input
                          id="smtpHost"
                          value={settings.smtpHost}
                          onChange={(e) =>
                            updateSetting("smtpHost", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpPort">SMTP Port</Label>
                        <Input
                          id="smtpPort"
                          type="number"
                          value={settings.smtpPort}
                          onChange={(e) =>
                            updateSetting("smtpPort", parseInt(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpUser">SMTP Username</Label>
                        <Input
                          id="smtpUser"
                          value={settings.smtpUser}
                          onChange={(e) =>
                            updateSetting("smtpUser", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpPassword">SMTP Password</Label>
                        <Input
                          id="smtpPassword"
                          type="password"
                          value={settings.smtpPassword}
                          onChange={(e) =>
                            updateSetting("smtpPassword", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notification Settings */}
            {activeTab === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Configure system-wide notification settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>System Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Critical system notifications and alerts
                        </p>
                      </div>
                      <Switch
                        checked={settings.systemAlerts}
                        onCheckedChange={(checked) =>
                          updateSetting("systemAlerts", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Security Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Security-related notifications and warnings
                        </p>
                      </div>
                      <Switch
                        checked={settings.securityAlerts}
                        onCheckedChange={(checked) =>
                          updateSetting("securityAlerts", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>User Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          User activity and account notifications
                        </p>
                      </div>
                      <Switch
                        checked={settings.userNotifications}
                        onCheckedChange={(checked) =>
                          updateSetting("userNotifications", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Marketing Emails</Label>
                        <p className="text-sm text-muted-foreground">
                          Product updates and marketing communications
                        </p>
                      </div>
                      <Switch
                        checked={settings.marketingEmails}
                        onCheckedChange={(checked) =>
                          updateSetting("marketingEmails", checked)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Settings */}
            {activeTab === "ai" && (
              <Card>
                <CardHeader>
                  <CardTitle>AI Configuration</CardTitle>
                  <CardDescription>
                    Configure AI services and API keys for the platform
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableAiFeatures">
                        Enable AI Features
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow AI-powered features across the platform
                      </p>
                    </div>
                    <Switch
                      id="enableAiFeatures"
                      checked={settings.enableAiFeatures}
                      onCheckedChange={(checked) =>
                        updateSetting("enableAiFeatures", checked)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                    <Input
                      id="openaiApiKey"
                      type="password"
                      value={settings.openaiApiKey}
                      onChange={(e) =>
                        updateSetting("openaiApiKey", e.target.value)
                      }
                      placeholder="sk-..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Your OpenAI API key for AI-powered features. Keep this
                      secure and never share it.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openaiOrganization">
                      OpenAI Organization ID (Optional)
                    </Label>
                    <Input
                      id="openaiOrganization"
                      value={settings.openaiOrganization}
                      onChange={(e) =>
                        updateSetting("openaiOrganization", e.target.value)
                      }
                      placeholder="org-..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Optional organization ID for OpenAI API usage tracking
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">AI Features</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Project description enhancement</li>
                      <li>• Content generation and improvement</li>
                      <li>• Smart categorization and tagging</li>
                      <li>• Automated image analysis</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-yellow-600" />
                      <h4 className="font-medium text-yellow-800">
                        Security Notice
                      </h4>
                    </div>
                    <p className="text-sm text-yellow-700">
                      API keys are encrypted and stored securely. Only super
                      administrators can view and modify these settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Financial Settings */}
            {activeTab === "financial" && (
              <Card>
                <CardHeader>
                  <CardTitle>Financial Configuration</CardTitle>
                  <CardDescription>
                    Manage billing, payments, and financial settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="defaultCurrency">Default Currency</Label>
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
                          <SelectItem value="GBP">GBP (��)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxRate">Tax Rate (%)</Label>
                      <Input
                        id="taxRate"
                        type="number"
                        step="0.01"
                        value={settings.taxRate}
                        onChange={(e) =>
                          updateSetting("taxRate", parseFloat(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentGateway">Payment Gateway</Label>
                      <Select
                        value={settings.paymentGateway}
                        onValueChange={(value) =>
                          updateSetting("paymentGateway", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                          <SelectItem value="square">Square</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Invoicing</Label>
                        <p className="text-sm text-muted-foreground">
                          Generate and send automated invoices
                        </p>
                      </div>
                      <Switch
                        checked={settings.enableInvoicing}
                        onCheckedChange={(checked) =>
                          updateSetting("enableInvoicing", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Subscriptions</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow recurring subscription billing
                        </p>
                      </div>
                      <Switch
                        checked={settings.enableSubscriptions}
                        onCheckedChange={(checked) =>
                          updateSetting("enableSubscriptions", checked)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Integrations Settings */}
            {activeTab === "integrations" && (
              <Card>
                <CardHeader>
                  <CardTitle>Integration Configuration</CardTitle>
                  <CardDescription>
                    Manage third-party integrations and API connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Globe className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">Google My Business</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Connect to Google My Business API for location
                        management
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">Stripe</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Payment processing and subscription management
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Integration Settings</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Third-Party Integrations</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow external services to connect via API
                          </p>
                        </div>
                        <Switch checked={true} onCheckedChange={() => {}} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-sync Data</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically synchronize data with connected
                            services
                          </p>
                        </div>
                        <Switch checked={true} onCheckedChange={() => {}} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Webhooks</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow real-time notifications from integrated
                            services
                          </p>
                        </div>
                        <Switch checked={false} onCheckedChange={() => {}} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">API Management</h4>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full gap-2">
                        <Globe className="h-4 w-4" />
                        Manage API Keys
                      </Button>
                      <Button variant="outline" className="w-full gap-2">
                        <Database className="h-4 w-4" />
                        View Integration Logs
                      </Button>
                      <Button variant="outline" className="w-full gap-2">
                        <Settings className="h-4 w-4" />
                        Configure Webhooks
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Review System Settings */}
            {activeTab === "reviews" && (
              <Card>
                <CardHeader>
                  <CardTitle>Review System Configuration</CardTitle>
                  <CardDescription>
                    Manage review collection, thresholds, and integrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Global Review Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Global Review Settings</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Default Rating Threshold</Label>
                        <Select defaultValue="4">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 Stars</SelectItem>
                            <SelectItem value="4">4 Stars</SelectItem>
                            <SelectItem value="5">5 Stars</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Minimum rating to redirect to Google Reviews
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Review Link Expiration (days)</Label>
                        <Input type="number" defaultValue="30" />
                        <p className="text-xs text-muted-foreground">
                          How long review links remain active
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Twilio Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Twilio SMS Configuration</h4>
                      <Badge variant="outline" className="text-xs">
                        Environment Variables
                      </Badge>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-3">
                        Twilio is configured via environment variables on the server.
                        The following variables should be set in your deployment environment:
                      </p>
                      <div className="grid gap-2 text-sm font-mono">
                        <div>TWILIO_ACCOUNT_SID</div>
                        <div>TWILIO_AUTH_TOKEN</div>
                        <div>TWILIO_PHONE_NUMBER</div>
                        <div>TWILIO_WEBHOOK_URL</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const { twilioService } = await import('@/lib/twilio');
                            const result = await twilioService.testConnection();
                            if (result.success) {
                              toast.success('Twilio connection successful!');
                            } else {
                              toast.error(`Twilio test failed: ${result.error}`);
                            }
                          } catch (error) {
                            toast.error('Failed to test Twilio connection');
                          }
                        }}
                      >
                        Test Connection
                      </Button>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-muted-foreground">
                          Not configured
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Google Maps API */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Google Maps API</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          placeholder="AIza...your-api-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Places API</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Switch defaultChecked />
                          <span className="text-sm">Enable Places API</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Business Owner Video */}
                  <div className="space-y-4">
                    <h4 className="font-medium">
                      Business Owner Video (Optional)
                    </h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Upload Personal Video</Label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <div className="space-y-2">
                            <Upload className="mx-auto h-8 w-8 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Upload a personal video message from the business
                              owner
                            </p>
                            <p className="text-xs text-gray-500">
                              MP4, MOV, or WebM • Max 50MB • Recommended: 30-60
                              seconds
                            </p>
                            <Button variant="outline" size="sm">
                              Choose Video File
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-700">
                          💡 <strong>Tip:</strong> A short, personal video from
                          the business owner thanking customers can
                          significantly increase positive review completion
                          rates. Keep it authentic and under 60 seconds.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Review Templates */}
                  <div className="space-y-4">
                    <h4 className="font-medium">SMS Templates</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Review Request Message</Label>
                        <Textarea
                          placeholder="Hi {customerName}, thanks for choosing {businessName}! We'd love your feedback on {projectName}. Please click: {reviewLink}"
                          className="min-h-[80px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Available variables: {"{customerName}"},{" "}
                          {"{businessName}"}, {"{projectName}"},{" "}
                          {"{reviewLink}"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Follow-up Message (optional)</Label>
                        <Textarea
                          placeholder="Hi {customerName}, we noticed you haven't left a review yet. Your feedback helps us improve!"
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* SEO Enhancement */}
                  <div className="space-y-4">
                    <h4 className="font-medium">SEO Enhancement Settings</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable SEO Review Optimization</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically enhance reviews with SEO-friendly text
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Keywords (comma separated)</Label>
                        <Input placeholder="contractor, renovation, construction, local business" />
                      </div>
                      <div className="space-y-2">
                        <Label>Business Categories</Label>
                        <Input placeholder="Home Improvement, Construction, Renovation Services" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Analytics & Reporting */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Analytics & Reporting</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Track Review Performance</Label>
                          <p className="text-sm text-muted-foreground">
                            Monitor completion rates and trends
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Google Reviews Integration</Label>
                          <p className="text-sm text-muted-foreground">
                            Sync with Google My Business reviews
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
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

            {activeTab === "database" && (
              <Card>
                <CardHeader>
                  <CardTitle>Database Configuration</CardTitle>
                  <CardDescription>
                    Database maintenance and backup settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Database className="h-5 w-5 text-green-500" />
                        <h4 className="font-medium">Database Status</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Primary database connection status
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Online</span>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Server className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">Last Backup</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Most recent database backup
                      </p>
                      <span className="text-sm font-medium">
                        {new Date().toLocaleDateString()} 3:00 AM
                      </span>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Database Maintenance</h4>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full gap-2">
                        <Database className="h-4 w-4" />
                        Run Database Optimization
                      </Button>
                      <Button variant="outline" className="w-full gap-2">
                        <Download className="h-4 w-4" />
                        Create Manual Backup
                      </Button>
                      <Button variant="outline" className="w-full gap-2">
                        <BarChart3 className="h-4 w-4" />
                        View Database Statistics
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
