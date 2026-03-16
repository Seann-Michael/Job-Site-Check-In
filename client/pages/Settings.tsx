// @ts-nocheck - Temporary suppression of type errors
import React, { useState, useEffect } from "react";
import { workspaceService } from "@/lib/workspaceService";
import { useSearchParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/AppLayout";
import { UserManagementSystem } from "@/components/UserManagementSystem";
import { StateSelect } from "@/components/ui/state-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { BusinessPlacesSearch } from "@/components/GoogleMaps/BusinessPlacesSearch";
import { AddressAutocomplete } from "@/components/GoogleMaps/AddressAutocomplete";
import { GoogleBusinessProfileFinder } from "@/components/GoogleMaps/GoogleBusinessProfileFinder";
import { USStatesSelect } from "@/components/ui/us-states-select";
import { BusinessTypesSelect } from "@/components/ui/business-types-select";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Save,
  Building2,
  Settings as SettingsIcon,
  Globe,
  Bot,
  Tag,
  MapPin,
  Image,
  Bell,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  X,
  Star,
  CreditCard,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Users,
  Download,
  Calendar,
  Mail,
  Zap,
  Activity,
  Volume2,
  VolumeX,
  MessageSquare,
  Smartphone,
  Monitor,
  Clock,
  AlertTriangle,
  Info,
  Shield,
  Upload,
  RefreshCw,
  RotateCcw,
  Video,
  FileImage,
  HardDrive,
  Webhook,
  Palette,
  Archive,
  Copy,
  Hash,
  TrendingUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCheckoutSession } from "@/lib/paymentService";

// Comprehensive Types
interface SettingsData {
  // Business Info
  businessName: string;
  businessTypes: string[]; // Changed to array for multiple categories
  subAccountId: string;
  businessLogo: string;
  firstName: string; // Split contact name
  lastName: string;
  email: string;
  phone: string;
  website: string;
  // Address fields
  addressSearch: string; // Search input
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  // Google Business Profile fields
  googlePlaceId?: string;
  googleCid?: string; // Customer ID
  googleBusinessUrl?: string;
  businessRating?: number;
  businessReviewsTotal?: number;
  businessHours?: string[];
  // Coordinates
  latitude?: number;
  longitude?: number;
  // Regional settings
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: string; // 12h or 24h

  // Project Settings
  autoPostGoogleMyBusiness: boolean;
  autoPostRssFeed: boolean;
  aiPromptForDescriptions: boolean;
  aiProjectRewritePrompt: string;
  autoArchiveDays: number;

  // Integrations
  googleMyBusinessConnected: boolean;
  googleOAuthEmail?: string;
  googleOAuthName?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: number | null;
  gmbAccounts?: GmbAccount[];
  selectedGmbAccountName?: string;
  selectedGmbAccountId?: string;
  goHighLevelApiKey: string;
  webhooks: WebhookItem[];
  rssIncludeImages: boolean;

  // AI Assistant
  aiPromptTemplate: string;
  aiInstructions: string;
  aiVariables: string[];

  // Tags
  businessTags: TagItem[];

  // Keywords
  seoKeywords: KeywordItem[];

  // Media Settings
  allowedImageTypes: string[];
  allowedVideoTypes: string[];
  maxFileSize: number;

  // Review Settings
  reviewReminderEnabled: boolean;
  reviewReminderDays: number;
  autoRequestReviews: boolean;
  reviewEmailTemplate: string;
  reviewSmsTemplate: string;
  minimumProjectValue: number;
  reviewAiPrompt: string;
  reviewGateLogoUrl: string;
  reviewGateHeading: string;
  reviewGateTitle: string;
  reviewGateDescription: string;
  reviewGateThreshold: number;
  reviewGateGoogleUrl: string;
  reviewGateSeoKeywords: string;
  reviewGateButtonText: string;
  reviewGateThankYouMessage: string;
  reviewGateVideoUrl: string;

  // Notifications
  enableNotifications: boolean;
  enableSounds: boolean;
  desktopNotifications: boolean;
  messageTypes: {
    info: boolean;
    warning: boolean;
    success: boolean;
    error: boolean;
  };
  categories: {
    system: boolean;
    marketing: boolean;
    support: boolean;
    emergency: boolean;
  };
  deliveryMethods: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  notificationFrequency: string;
  digestTime: string;
  doNotDisturb: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    weekendsOnly: boolean;
  };
  autoMarkAsRead: boolean;
  showPreviews: boolean;
  groupSimilar: boolean;

  // File Optimization
  autoOptimization: boolean;
  compressionLevel: number;
  allowedFileTypes: string[];
  totalSpaceSaved: number;

  // Users
  users: UserItem[];

  // Billing
  billingContact: string;
  billingEmail: string;
  autoRenewal: boolean;
  currentPlan: string;
  planFeatures: string[];
  creditCard: CreditCardInfo;
  invoices: InvoiceItem[];
}

interface GmbAccount {
  name: string; // e.g. "accounts/123456789"
  accountName?: string;
  type?: string;
  role?: string;
  state?: { status?: string };
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface KeywordItem {
  id: string;
  keyword: string;
  category: "primary" | "secondary" | "location" | "service" | "brand";
  volume?: string;
  notes?: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "pending" | "suspended";
  lastLogin: string;
  permissions: string[];
}

interface CreditCardInfo {
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
}

interface InvoiceItem {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  downloadUrl: string;
}

const KEYWORD_CATEGORIES: { value: KeywordItem["category"]; label: string; color: string }[] = [
  { value: "primary",   label: "Primary",  color: "bg-blue-100 text-blue-800" },
  { value: "secondary", label: "Secondary", color: "bg-purple-100 text-purple-800" },
  { value: "location",  label: "Location",  color: "bg-green-100 text-green-800" },
  { value: "service",   label: "Service",   color: "bg-orange-100 text-orange-800" },
  { value: "brand",     label: "Brand",     color: "bg-pink-100 text-pink-800" },
];

// Navigation Tabs
const navigationTabs = [
  { id: "general", label: "General", icon: Building2 },
  { id: "project", label: "Project Settings", icon: SettingsIcon },
  { id: "integrations", label: "Integrations", icon: Globe },
  { id: "ai", label: "AI Assistant", icon: Bot },
  { id: "keywords", label: "Keywords", icon: Hash },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "media", label: "Media Settings", icon: Image },
  { id: "reviews", label: "Review Settings", icon: Star },
  { id: "notifications", label: "Notifications", icon: Bell },

  { id: "users", label: "Users", icon: Users },
  { id: "billing", label: "Billing", icon: DollarSign },
];

// Safe Default Settings
function generateAccountId(): string {
  const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

const createDefaultSettings = (): SettingsData => ({
  // Business Info
  businessName: "Joe's Pizza",
  businessTypes: ["restaurant"], // Changed to array
  subAccountId: generateAccountId(), // Auto-generated unique Business Account ID
  businessLogo: "",
  firstName: "Joe", // Split contact name
  lastName: "Smith",
  email: "joe@joespizza.com",
  phone: "(555) 123-4567",
  website: "https://joespizza.com",
  addressSearch: "",
  address: "123 Main Street",
  city: "New York",
  state: "NY",
  zipCode: "10001",
  country: "United States",
  timezone: "America/New_York",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h", // Added time format

  // Project Settings
  autoPostGoogleMyBusiness: true,
  autoPostRssFeed: false,
  aiPromptForDescriptions: true,
  aiProjectRewritePrompt:
    "Rewrite this project description to be more engaging and professional. Highlight the key benefits and quality of work while maintaining the original facts and details.",
  autoArchiveDays: 30,

  // Integrations
  googleMyBusinessConnected: true,
  googleOAuthEmail: "",
  googleOAuthName: "",
  googleAccessToken: "",
  googleRefreshToken: "",
  googleTokenExpiresAt: null,
  gmbAccounts: [],
  selectedGmbAccountName: "",
  selectedGmbAccountId: "",
  goHighLevelApiKey: "",
  webhooks: [],
  rssIncludeImages: true,

  // AI Assistant
  aiPromptTemplate:
    "Create a professional description for a {PROJECT_TYPE} project at {ADDRESS}. Include details about {SERVICES} and highlight the quality of work.",
  aiInstructions:
    "Write engaging, professional descriptions that highlight the benefits and quality of the work. Use a friendly but professional tone.",
  aiVariables: [
    "PROJECT_TYPE",
    "ADDRESS",
    "SERVICES",
    "CUSTOMER_NAME",
    "COMPLETION_DATE",
  ],

  // Tags
  businessTags: [
    { id: "1", name: "Pizza", color: "#ef4444" },
    { id: "2", name: "Italian", color: "#3b82f6" },
    { id: "3", name: "Delivery", color: "#10b981" },
  ],

  // Keywords
  seoKeywords: [
    { id: "kw1", keyword: "local pizza delivery", category: "primary", volume: "1.2K" },
    { id: "kw2", keyword: "Italian restaurant near me", category: "location", volume: "880" },
    { id: "kw3", keyword: "best pizza Springfield", category: "location", volume: "320" },
  ],

  // Media Settings
  allowedImageTypes: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  allowedVideoTypes: [".mp4", ".mov", ".avi"],
  maxFileSize: 10,

  // Review Settings
  reviewReminderEnabled: true,
  reviewReminderDays: 7,
  autoRequestReviews: true,
  reviewEmailTemplate:
    "Hi {CUSTOMER_NAME}, we'd love to hear about your experience with our {PROJECT_TYPE} project!",
  reviewSmsTemplate:
    "Hi {CUSTOMER_NAME}! How was your experience with {BUSINESS_NAME}? Leave a review: {REVIEW_LINK}",
  minimumProjectValue: 500,
  reviewAiPrompt: "",
  reviewGateLogoUrl: "",
  reviewGateHeading: "",
  reviewGateTitle: "",
  reviewGateDescription: "",
  reviewGateThreshold: 4,
  reviewGateGoogleUrl: "",
  reviewGateSeoKeywords: "",
  reviewGateButtonText: "",
  reviewGateThankYouMessage: "",
  reviewGateVideoUrl: "",

  // Notifications
  enableNotifications: true,
  enableSounds: true,
  desktopNotifications: true,
  messageTypes: { info: true, warning: true, success: true, error: true },
  categories: { system: true, marketing: true, support: true, emergency: true },
  deliveryMethods: { inApp: true, email: true, sms: false, push: true },
  notificationFrequency: "immediate",
  digestTime: "09:00",
  doNotDisturb: {
    enabled: false,
    startTime: "22:00",
    endTime: "08:00",
    weekendsOnly: false,
  },
  autoMarkAsRead: false,
  showPreviews: true,
  groupSimilar: true,

  // File Optimization
  autoOptimization: true,
  compressionLevel: 80,
  allowedFileTypes: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov"],
  totalSpaceSaved: 2.4,

  // Users
  users: [
    {
      id: "1",
      name: "Joe Smith",
      email: "joe@joespizza.com",
      role: "owner",
      status: "active",
      lastLogin: "2024-01-15",
      permissions: ["all"],
    },
  ],

  // Billing
  billingContact: "Joe Smith",
  billingEmail: "billing@joespizza.com",
  autoRenewal: true,
  currentPlan: "pro",
  planFeatures: [
    "Unlimited Projects",
    "Advanced Analytics",
    "Priority Support",
  ],
  creditCard: { last4: "4242", brand: "Visa", expMonth: 12, expYear: 2025 },
  invoices: [
    {
      id: "inv_001",
      date: "2024-01-01",
      amount: 49.0,
      status: "paid",
      downloadUrl: "/api/invoices/inv_001/download",
    },
  ],
});

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") || "general",
  );
  const [settings, setSettings] = useState<SettingsData>(
    createDefaultSettings(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(
    null,
  );
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);

  // Keyword state
  const [showKeywordForm, setShowKeywordForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState({ keyword: "", category: "general" as KeywordItem["category"], notes: "" });
  const [keywordSearch, setKeywordSearch] = useState("");
  const [keywordCategoryFilter, setKeywordCategoryFilter] = useState<string>("all");

  // Upgrade dialog state
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<{
    name: string;
    price: number;
    description: string;
  } | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const handleConnectGoogle = () => {
    const authUrl = `/api/oauth/google_my_business/authorize?workspace_id=${encodeURIComponent(settings.subAccountId || "")}`;
    const popup = window.open(
      authUrl,
      "google_oauth",
      "width=540,height=660,scrollbars=yes,resizable=yes,left=" +
        Math.round(window.screen.width / 2 - 270) +
        ",top=" +
        Math.round(window.screen.height / 2 - 330),
    );

    if (!popup) {
      toast.error("Popup blocked — please allow popups for this site and try again.");
      return;
    }

    setIsConnectingGoogle(true);

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, platform, data, error } = event.data;
      if (platform !== "google") return;

      window.removeEventListener("message", handler);
      setIsConnectingGoogle(false);

      if (type === "oauth_success" && data) {
        updateSetting("googleMyBusinessConnected", true);
        updateSetting("googleOAuthEmail", data.email || "");
        updateSetting("googleOAuthName", data.name || "");
        updateSetting("googleAccessToken", data.accessToken || "");
        updateSetting("googleRefreshToken", data.refreshToken || "");
        updateSetting("googleTokenExpiresAt", data.expiresAt || null);
        updateSetting("gmbAccounts", data.gmbAccounts || []);
        // Auto-select if only one business
        if (data.gmbAccounts?.length === 1) {
          updateSetting("selectedGmbAccountName", data.gmbAccounts[0].name || "");
          updateSetting("selectedGmbAccountId", data.gmbAccounts[0].name || "");
        } else {
          updateSetting("selectedGmbAccountName", "");
          updateSetting("selectedGmbAccountId", "");
        }
        toast.success(`Google connected as ${data.email}`);
      } else if (type === "oauth_error") {
        toast.error(error || "Google connection failed.");
      }
    };

    window.addEventListener("message", handler);

    // Cleanup if user closes popup without completing
    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed);
        window.removeEventListener("message", handler);
        setIsConnectingGoogle(false);
      }
    }, 800);
  };

  const handleUpgradeClick = (name: string, price: number, description: string) => {
    setSelectedUpgradePlan({ name, price, description });
    setUpgradeDialogOpen(true);
  };

  const handleUpgradeConfirm = async () => {
    if (!selectedUpgradePlan) return;
    setIsUpgrading(true);
    try {
      const result = await createCheckoutSession({
        provider: "stripe",
        mode: "subscription",
        amount: selectedUpgradePlan.price,
      });
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error(result?.message || "Checkout failed. Please check your Stripe configuration.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsUpgrading(false);
      setUpgradeDialogOpen(false);
    }
  };

  // Safe data loading — reads subAccountId from Supabase workspace
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = localStorage.getItem("business_settings");
        const loadedSettings = saved
          ? { ...createDefaultSettings(), ...JSON.parse(saved) }
          : createDefaultSettings();

        // Always prefer the authoritative sub_account_id from Supabase
        let wsState = workspaceService.getState();
        if (!wsState.initialized) {
          wsState = await workspaceService.initialize();
        }
        if (wsState.user?.subAccountId) {
          loadedSettings.subAccountId = wsState.user.subAccountId;
        } else if (loadedSettings.subAccountId && !loadedSettings.subAccountId.includes("-")) {
          // Format any legacy unformatted ID in localStorage
          const d = loadedSettings.subAccountId.replace(/\D/g, "").slice(0, 9).padEnd(9, "0");
          loadedSettings.subAccountId = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}`;
        }

        setSettings(loadedSettings);
        localStorage.setItem("business_settings", JSON.stringify(loadedSettings));
        // Also save business name to separate localStorage key
        localStorage.setItem(
          "business_name",
          loadedSettings.businessName || "",
        );
      } catch (error) {
        console.error(
          "Failed to load settings:",
          error instanceof Error ? error.message : String(error),
        );
        toast.error("Failed to load settings, using defaults");
      }
    };
    loadSettings();
  }, []);

  // Safe setting updates
  const updateSetting = (key: keyof SettingsData, value: any) => {
    try {
      setSettings((prev) => ({ ...prev, [key]: value }));

      // Special handling for business name - save to localStorage immediately
      if (key === "businessName") {
        localStorage.setItem("business_name", value || "");
        // Dispatch custom event to update UI immediately
        window.dispatchEvent(
          new CustomEvent("businessNameChanged", { detail: value || "" }),
        );
      }
    } catch (error) {
      console.error(
        "Failed to update setting:",
        error instanceof Error ? error.message : String(error),
      );
      toast.error("Failed to update setting");
    }
  };

  // Safe save operation
  const handleSave = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      localStorage.setItem("business_settings", JSON.stringify(settings));
      localStorage.setItem("business_name", settings.businessName || "");
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error(
        "Failed to save settings:",
        error instanceof Error ? error.message : String(error),
      );
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Webhook management
  const addWebhook = (webhook: Omit<WebhookItem, "id">) => {
    try {
      const newWebhook = { ...webhook, id: Date.now().toString() };
      updateSetting("webhooks", [...(settings.webhooks || []), newWebhook]);
      setShowWebhookForm(false);
      setEditingWebhook(null);
      toast.success("Webhook added successfully");
    } catch (error) {
      toast.error("Failed to add webhook");
    }
  };

  const updateWebhook = (id: string, updates: Partial<WebhookItem>) => {
    try {
      const updatedWebhooks = (settings.webhooks || []).map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      );
      updateSetting("webhooks", updatedWebhooks);
      setEditingWebhook(null);
      setShowWebhookForm(false);
      toast.success("Webhook updated successfully");
    } catch (error) {
      toast.error("Failed to update webhook");
    }
  };

  const deleteWebhook = (id: string) => {
    try {
      const updatedWebhooks = (settings.webhooks || []).filter(
        (w) => w.id !== id,
      );
      updateSetting("webhooks", updatedWebhooks);
      toast.success("Webhook deleted successfully");
    } catch (error) {
      toast.error("Failed to delete webhook");
    }
  };

  // Tag management
  const addTag = (tag: Omit<TagItem, "id">) => {
    try {
      const newTag = { ...tag, id: Date.now().toString() };
      updateSetting("businessTags", [...(settings.businessTags || []), newTag]);
      setShowTagForm(false);
      setEditingTag(null);
      toast.success("Tag added successfully");
    } catch (error) {
      toast.error("Failed to add tag");
    }
  };

  const deleteTag = (id: string) => {
    try {
      const updatedTags = (settings.businessTags || []).filter(
        (t) => t.id !== id,
      );
      updateSetting("businessTags", updatedTags);
      toast.success("Tag deleted successfully");
    } catch (error) {
      toast.error("Failed to delete tag");
    }
  };

  // Keyword CRUD
  const addKeyword = () => {
    if (!newKeyword.keyword.trim()) {
      toast.error("Keyword cannot be empty");
      return;
    }
    const existing = (settings.seoKeywords || []).find(
      (k) => k.keyword.toLowerCase() === newKeyword.keyword.trim().toLowerCase()
    );
    if (existing) {
      toast.error("This keyword already exists");
      return;
    }
    const item: KeywordItem = {
      id: Date.now().toString(),
      keyword: newKeyword.keyword.trim(),
      category: newKeyword.category,
      notes: newKeyword.notes.trim() || undefined,
    };
    updateSetting("seoKeywords", [...(settings.seoKeywords || []), item]);
    setNewKeyword({ keyword: "", category: "general", notes: "" });
    setShowKeywordForm(false);
    toast.success("Keyword added");
  };

  const deleteKeyword = (id: string) => {
    updateSetting("seoKeywords", (settings.seoKeywords || []).filter((k) => k.id !== id));
    toast.success("Keyword removed");
  };

  const addAiVariable = (variable: string) => {
    try {
      if (variable && !(settings.aiVariables || []).includes(variable)) {
        updateSetting("aiVariables", [
          ...(settings.aiVariables || []),
          variable,
        ]);
      }
    } catch (error) {
      toast.error("Failed to add AI variable");
    }
  };

  const removeAiVariable = (index: number) => {
    try {
      const updated = (settings.aiVariables || []).filter(
        (_, i) => i !== index,
      );
      updateSetting("aiVariables", updated);
    } catch (error) {
      toast.error("Failed to remove AI variable");
    }
  };

  return (
    <AppLayout>
      <div className="w-full px-3 sm:px-6 py-4 sm:py-6 space-y-6 max-w-full overflow-x-hidden min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Settings
              </h1>
              {settings.subAccountId && (
                <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground select-all">
                  ID: {settings.subAccountId}
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your business settings and preferences
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="gap-2 w-full sm:w-auto min-h-[44px]"
          >
            <Save className="h-4 w-4" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Mobile horizontal scroll navigation */}
          <div className="lg:hidden">
            <div className="overflow-x-auto scrollbar-hide pb-2">
              <nav className="flex gap-2 min-w-max">
                {navigationTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 min-h-[44px] ${
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Desktop Sidebar Navigation */}
          <div className="hidden lg:block lg:w-[215px] space-y-1">
            <nav className="space-y-1">
              {navigationTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* General Settings */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Business Information</CardTitle>
                    <CardDescription>
                      Basic information about your business
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <FileUpload
                        label="Business Logo"
                        value={settings.businessLogo || ""}
                        onChange={(fileUrl) =>
                          updateSetting("businessLogo", fileUrl)
                        }
                        accept="image/*"
                        maxSize={5}
                        description="Upload a logo for your business (max 5MB)"
                        previewClassName="w-20 h-20"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={settings.firstName || ""}
                          onChange={(e) =>
                            updateSetting("firstName", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={settings.lastName || ""}
                          onChange={(e) =>
                            updateSetting("lastName", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Business Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={settings.email || ""}
                          onChange={(e) =>
                            updateSetting("email", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Business Phone</Label>
                        <Input
                          id="phone"
                          value={settings.phone || ""}
                          onChange={(e) =>
                            updateSetting("phone", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={settings.website || ""}
                          onChange={(e) =>
                            updateSetting("website", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Google Business Profile Details
                    </CardTitle>
                    <CardDescription>
                      Google-specific business information and identifiers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="sm:col-span-2">
                      <GoogleBusinessProfileFinder
                        onProfileFound={(profile) => {
                          console.log(
                            "Google Business Profile found:",
                            profile,
                          );

                          // Auto-populate all business information
                          updateSetting("businessName", profile.name);

                          // Parse and update address information
                          if (profile.formattedAddress) {
                            const addressParts =
                              profile.formattedAddress.split(", ");
                            const fullAddress = addressParts
                              .slice(0, -2)
                              .join(", ");
                            const city = addressParts.length > 1
                              ? addressParts[addressParts.length - 2]
                              : "";
                            const stateZip = addressParts.length > 0
                              ? addressParts[addressParts.length - 1]
                              : "";

                            let state = "";
                            let zipCode = "";
                            if (stateZip) {
                              const stateZipMatch = stateZip.match(
                                /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,
                              );
                              if (stateZipMatch) {
                                state = stateZipMatch[1];
                                zipCode = stateZipMatch[2];
                              } else {
                                const parts = stateZip.split(" ");
                                state = parts[0] || "";
                                zipCode = parts[1] || "";
                              }
                            }

                            updateSetting(
                              "addressSearch",
                              profile.formattedAddress,
                            );
                            updateSetting("address", fullAddress || "");
                            updateSetting("city", city || "");
                            updateSetting("state", state);
                            updateSetting("zipCode", zipCode);
                          }

                          // Update contact information
                          if (profile.phoneNumber) {
                            updateSetting("phone", profile.phoneNumber);
                          }

                          if (profile.website) {
                            updateSetting("website", profile.website);
                          }

                          // Update coordinates
                          updateSetting("latitude", profile.lat);
                          updateSetting("longitude", profile.lng);

                          // Store Google-specific data
                          updateSetting("googlePlaceId", profile.placeId);
                          updateSetting("googleCid", profile.cid || "");
                          updateSetting(
                            "googleBusinessUrl",
                            profile.url || "",
                          );
                          updateSetting(
                            "businessRating",
                            profile.rating || 0,
                          );
                          updateSetting(
                            "businessReviewsTotal",
                            profile.userRatingsTotal || 0,
                          );
                          updateSetting(
                            "businessHours",
                            profile.openingHours || [],
                          );

                          // Auto-detect business types from Google Places types
                          if (profile.types && profile.types.length > 0) {
                            const typeMapping: { [key: string]: string } = {
                              restaurant: "restaurant",
                              food: "food",
                              meal_takeaway: "restaurant",
                              store: "retail",
                              clothing_store: "retail",
                              shopping_mall: "shopping",
                              car_dealer: "automotive",
                              car_repair: "automotive",
                              gas_station: "automotive",
                              hospital: "healthcare",
                              dentist: "healthcare",
                              doctor: "healthcare",
                              pharmacy: "healthcare",
                              beauty_salon: "beauty",
                              spa: "beauty",
                              hair_care: "beauty",
                              gym: "fitness",
                              health: "fitness",
                              real_estate_agency: "real-estate",
                              lawyer: "legal",
                              accounting: "financial",
                              bank: "financial",
                              insurance_agency: "financial",
                              plumber: "home-services",
                              electrician: "home-services",
                              general_contractor: "construction",
                              school: "education",
                              university: "education",
                              lodging: "lodging",
                              travel_agency: "travel",
                              tourist_attraction: "entertainment",
                            };

                            const detectedTypes = [];
                            for (const type of profile.types) {
                              if (
                                typeMapping[type] &&
                                !detectedTypes.includes(typeMapping[type])
                              ) {
                                detectedTypes.push(typeMapping[type]);
                              }
                            }

                            if (detectedTypes.length > 0) {
                              updateSetting("businessTypes", detectedTypes);
                            }
                          }
                        }}
                        onAddressChange={(address, addressComponents) => {
                          if (addressComponents) {
                            updateSetting("addressSearch", address);
                            updateSetting(
                              "address",
                              addressComponents.street || "",
                            );
                            updateSetting(
                              "city",
                              addressComponents.city || "",
                            );
                            updateSetting(
                              "state",
                              addressComponents.state || "",
                            );
                            updateSetting(
                              "zipCode",
                              addressComponents.zipCode || "",
                            );
                          }
                        }}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="googlePlaceId">Google Places ID</Label>
                        <Input
                          id="googlePlaceId"
                          value={settings.googlePlaceId || ""}
                          onChange={(e) =>
                            updateSetting("googlePlaceId", e.target.value)
                          }
                          placeholder="ChIJdQzM4UKvhYAR-A7s..."
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Unique identifier from Google Places API
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="googleCid">
                          Google Customer ID (CID)
                        </Label>
                        <Input
                          id="googleCid"
                          value={settings.googleCid || ""}
                          onChange={(e) =>
                            updateSetting("googleCid", e.target.value)
                          }
                          placeholder="123456789012345"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Google My Business customer identifier
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          value={settings.latitude || ""}
                          onChange={(e) =>
                            updateSetting(
                              "latitude",
                              parseFloat(e.target.value) || undefined,
                            )
                          }
                          placeholder="40.7128"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="longitude">Longitude</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          value={settings.longitude || ""}
                          onChange={(e) =>
                            updateSetting(
                              "longitude",
                              parseFloat(e.target.value) || undefined,
                            )
                          }
                          placeholder="-74.0060"
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <BusinessTypesSelect
                        values={settings.businessTypes || []}
                        onValuesChange={(values) =>
                          updateSetting("businessTypes", values)
                        }
                        label="Business Categories"
                        placeholder="Select business categories"
                      />
                      {settings.googlePlaceId && (
                        <p className="text-xs text-green-600">
                          Categories detected from Google Business Profile
                        </p>
                      )}
                    </div>

                    {settings.googlePlaceId && (
                      <div className="p-3 border rounded-lg bg-green-50">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">
                            Google Business Profile Connected
                          </span>
                        </div>
                        {settings.businessRating && (
                          <div className="mt-2 text-sm text-green-600">
                            Rating: {settings.businessRating} stars (
                            {settings.businessReviewsTotal} reviews)
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Regional Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select
                          value={settings.timezone || "America/New_York"}
                          onValueChange={(value) =>
                            updateSetting("timezone", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/New_York">
                              Eastern Time
                            </SelectItem>
                            <SelectItem value="America/Chicago">
                              Central Time
                            </SelectItem>
                            <SelectItem value="America/Denver">
                              Mountain Time
                            </SelectItem>
                            <SelectItem value="America/Los_Angeles">
                              Pacific Time
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="timeFormat">Time Format</Label>
                        <Select
                          value={settings.timeFormat || "12h"}
                          onValueChange={(value) =>
                            updateSetting("timeFormat", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12h">
                              12-hour (1:30 PM)
                            </SelectItem>
                            <SelectItem value="24h">24-hour (13:30)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="currency">Currency</Label>
                        <Select
                          value={settings.currency || "USD"}
                          onValueChange={(value) =>
                            updateSetting("currency", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="CAD">CAD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="dateFormat">Date Format</Label>
                        <Select
                          value={settings.dateFormat || "MM/DD/YYYY"}
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Project Settings */}
            {activeTab === "project" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Automation Settings</CardTitle>
                    <CardDescription>
                      Configure automatic actions for your projects
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-post to Google My Business</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically post completed projects to Google My
                          Business
                        </p>
                      </div>
                      <Switch
                        checked={settings.autoPostGoogleMyBusiness || false}
                        onCheckedChange={(checked) =>
                          updateSetting("autoPostGoogleMyBusiness", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-post via RSS Feed</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically publish completed projects to RSS feed
                        </p>
                      </div>
                      <Switch
                        checked={settings.autoPostRssFeed || false}
                        onCheckedChange={(checked) =>
                          updateSetting("autoPostRssFeed", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>AI-generated descriptions</Label>
                        <p className="text-sm text-muted-foreground">
                          Use AI to generate project descriptions
                        </p>
                      </div>
                      <Switch
                        checked={settings.aiPromptForDescriptions || false}
                        onCheckedChange={(checked) =>
                          updateSetting("aiPromptForDescriptions", checked)
                        }
                      />
                    </div>

                    {settings.aiPromptForDescriptions && (
                      <div className="pt-4 border-t">
                        <Label htmlFor="aiProjectRewritePrompt">
                          AI Project Rewrite Prompt
                        </Label>
                        <Textarea
                          id="aiProjectRewritePrompt"
                          value={settings.aiProjectRewritePrompt || ""}
                          onChange={(e) =>
                            updateSetting(
                              "aiProjectRewritePrompt",
                              e.target.value,
                            )
                          }
                          placeholder="Enter your custom AI prompt for rewriting project descriptions..."
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-archive projects after completion</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically archive completed projects after
                          specified days
                        </p>
                      </div>
                      <div className="w-24">
                        <Select
                          value={(settings.autoArchiveDays || 30).toString()}
                          onValueChange={(value) =>
                            updateSetting("autoArchiveDays", parseInt(value))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                            <SelectItem value="365">365 days</SelectItem>
                            <SelectItem value="0">Never</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Integrations */}
            {activeTab === "integrations" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Social Media Integrations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <span className="text-red-600 font-bold">G</span>
                        </div>
                        <div>
                          <h3 className="font-medium">Google My Business</h3>
                          <p className="text-sm text-muted-foreground">
                            {settings.googleMyBusinessConnected && settings.googleOAuthEmail
                              ? `Connected as ${settings.googleOAuthEmail}`
                              : settings.googleMyBusinessConnected
                              ? "Connected to your Google My Business account"
                              : "Connect your Google account to manage your Business Profile"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {settings.googleMyBusinessConnected && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Connected
                          </Badge>
                        )}
                        <Button
                          variant={settings.googleMyBusinessConnected ? "outline" : "default"}
                          disabled={isConnectingGoogle}
                          onClick={() => {
                            if (settings.googleMyBusinessConnected) {
                              updateSetting("googleMyBusinessConnected", false);
                              updateSetting("googleOAuthEmail", "");
                              updateSetting("googleAccessToken", "");
                              updateSetting("googleRefreshToken", "");
                              updateSetting("gmbAccounts", []);
                              updateSetting("selectedGmbAccountName", "");
                              updateSetting("selectedGmbAccountId", "");
                              toast.success("Google disconnected");
                            } else {
                              handleConnectGoogle();
                            }
                          }}
                        >
                          {isConnectingGoogle ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting…
                            </>
                          ) : settings.googleMyBusinessConnected ? (
                            <>
                              <X className="h-4 w-4 mr-2" />
                              Disconnect
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Connect Google
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Business location picker — shown after OAuth connects */}
                    {settings.googleMyBusinessConnected && settings.gmbAccounts && settings.gmbAccounts.length > 0 && (
                      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Select Business Location</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Choose which Google Business Profile to use for posting and reviews.
                          </p>
                        </div>
                        <Select
                          value={settings.selectedGmbAccountId || ""}
                          onValueChange={(val) => {
                            const account = settings.gmbAccounts?.find((a) => a.name === val);
                            updateSetting("selectedGmbAccountId", val);
                            updateSetting("selectedGmbAccountName", account?.accountName || account?.name || val);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a business location…" />
                          </SelectTrigger>
                          <SelectContent>
                            {settings.gmbAccounts.map((account) => (
                              <SelectItem key={account.name} value={account.name}>
                                {account.accountName || account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {settings.selectedGmbAccountId && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Using: <span className="font-medium text-foreground">{settings.selectedGmbAccountName || settings.selectedGmbAccountId}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Prompt to reconnect if connected but no accounts came back */}
                    {settings.googleMyBusinessConnected && (!settings.gmbAccounts || settings.gmbAccounts.length === 0) && (
                      <p className="text-xs text-muted-foreground px-1">
                        No Business Profile locations found on this Google account. Make sure you have access to a Google Business Profile and try reconnecting.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>RSS Feed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span className="text-orange-600 font-bold">
                              RSS
                            </span>
                          </div>
                          <div>
                            <h3 className="font-medium">RSS Feed</h3>
                            <p className="text-sm text-muted-foreground">
                              Generate and manage RSS feed for your projects
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                          <Button variant="outline">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Feed
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="rssFeedUrl">RSS Feed URL</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="rssFeedUrl"
                            value={`${window.location.origin}/api/rss/${settings.subAccountId}`}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                if (navigator.clipboard) {
                                  await navigator.clipboard.writeText(
                                    `${window.location.origin}/api/rss/${settings.subAccountId}`,
                                  );
                                  toast.success("RSS URL copied to clipboard");
                                } else {
                                  toast.error("Clipboard not available");
                                }
                              } catch (error) {
                                toast.error("Failed to copy to clipboard");
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Include Project Images</Label>
                          <p className="text-sm text-muted-foreground">
                            Include project images in RSS feed
                          </p>
                        </div>
                        <Switch
                          checked={settings.rssIncludeImages !== false}
                          onCheckedChange={(checked) =>
                            updateSetting("rssIncludeImages", checked)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>GoHighLevel Integration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="goHighLevelApiKey">API Key</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="goHighLevelApiKey"
                          type="password"
                          value={settings.goHighLevelApiKey || ""}
                          onChange={(e) =>
                            updateSetting("goHighLevelApiKey", e.target.value)
                          }
                          placeholder="Enter your GoHighLevel API key"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          disabled={!settings.goHighLevelApiKey}
                          onClick={() =>
                            toast.success("Connection tested successfully")
                          }
                        >
                          Test
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Webhooks</span>
                      <Button
                        size="sm"
                        onClick={() => setShowWebhookForm(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Webhook
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(settings.webhooks || []).map((webhook) => (
                        <div key={webhook.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{webhook.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {webhook.url}
                              </p>
                              <div className="flex gap-1 mt-1">
                                {(webhook.events || []).map((event) => (
                                  <Badge
                                    key={event}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  webhook.active ? "default" : "secondary"
                                }
                              >
                                {webhook.active ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingWebhook(webhook);
                                  setShowWebhookForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteWebhook(webhook.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(settings.webhooks || []).length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No webhooks configured yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Webhook Form Modal */}
                {showWebhookForm && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6">
                      <h3 className="text-lg font-semibold mb-4">
                        {editingWebhook ? "Edit Webhook" : "Add Webhook"}
                      </h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const selectedEvents = formData.getAll(
                            "selectedEvents",
                          ) as string[];
                          const webhook = {
                            name: (formData.get("name") as string) || "",
                            url: (formData.get("url") as string) || "",
                            events: selectedEvents,
                            active: formData.get("active") === "on",
                          };
                          if (editingWebhook) {
                            updateWebhook(editingWebhook.id, webhook);
                          } else {
                            addWebhook(webhook);
                          }
                        }}
                      >
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="webhookName">Name</Label>
                            <Input
                              id="webhookName"
                              name="name"
                              defaultValue={editingWebhook?.name || ""}
                              placeholder="Webhook name"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="webhookUrl">URL</Label>
                            <Input
                              id="webhookUrl"
                              name="url"
                              type="url"
                              defaultValue={editingWebhook?.url || ""}
                              placeholder="https://example.com/webhook"
                              required
                            />
                          </div>
                          <div>
                            <Label>Select Events</Label>
                            <div className="mt-2 space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                  {
                                    id: "project.created",
                                    label: "Project Created",
                                    description:
                                      "When a new project is created",
                                    icon: "🔧",
                                  },
                                  {
                                    id: "project.completed",
                                    label: "Project Completed",
                                    description:
                                      "When a project is marked complete",
                                    icon: "✅",
                                  },
                                  {
                                    id: "project.updated",
                                    label: "Project Updated",
                                    description:
                                      "When project details are modified",
                                    icon: "��",
                                  },
                                  {
                                    id: "project.archived",
                                    label: "Project Archived",
                                    description: "When a project is archived",
                                    icon: "📦",
                                  },
                                  {
                                    id: "photo.uploaded",
                                    label: "Photo Uploaded",
                                    description: "When new photos are added",
                                    icon: "📸",
                                  },
                                  {
                                    id: "review.received",
                                    label: "Review Received",
                                    description:
                                      "When a new review is submitted",
                                    icon: "⭐",
                                  },
                                ].map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50"
                                  >
                                    <input
                                      type="checkbox"
                                      id={`event-${event.id}`}
                                      name="selectedEvents"
                                      value={event.id}
                                      defaultChecked={
                                        editingWebhook?.events?.includes(
                                          event.id,
                                        ) || false
                                      }
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">
                                          {event.icon}
                                        </span>
                                        <Label
                                          htmlFor={`event-${event.id}`}
                                          className="font-medium"
                                        >
                                          {event.label}
                                        </Label>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {event.description}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="webhookActive"
                              name="active"
                              defaultChecked={editingWebhook?.active !== false}
                            />
                            <Label htmlFor="webhookActive">Active</Label>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowWebhookForm(false);
                              setEditingWebhook(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            {editingWebhook ? "Update" : "Add"} Webhook
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Template Configuration</CardTitle>
                    <CardDescription>
                      Configure AI prompts and templates for generating content
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="aiPromptTemplate">
                        AI Prompt Template
                      </Label>
                      <Textarea
                        id="aiPromptTemplate"
                        value={settings.aiPromptTemplate || ""}
                        onChange={(e) =>
                          updateSetting("aiPromptTemplate", e.target.value)
                        }
                        placeholder="Create a professional description for a {PROJECT_TYPE} project..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="aiInstructions">AI Instructions</Label>
                      <Textarea
                        id="aiInstructions"
                        value={settings.aiInstructions || ""}
                        onChange={(e) =>
                          updateSetting("aiInstructions", e.target.value)
                        }
                        placeholder="Write engaging, professional descriptions..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>AI Variables</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(settings.aiVariables || []).map((variable, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            {variable}
                            <button
                              onClick={() => removeAiVariable(index)}
                              className="hover:bg-red-100 rounded p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Add new variable"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const input = e.target as HTMLInputElement;
                              if (input.value) {
                                addAiVariable(input.value);
                                input.value = "";
                              }
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            const input = (e.target as HTMLElement)
                              .previousElementSibling as HTMLInputElement;
                            if (input?.value) {
                              addAiVariable(input.value);
                              input.value = "";
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Keywords */}
            {activeTab === "keywords" && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Hash className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{(settings.seoKeywords || []).length}</p>
                          <p className="text-sm text-muted-foreground">Total Keywords</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {(settings.seoKeywords || []).filter((k) => k.category === "general").length}
                          </p>
                          <p className="text-sm text-muted-foreground">General Keywords</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {(settings.seoKeywords || []).filter((k) => k.category === "location").length}
                          </p>
                          <p className="text-sm text-muted-foreground">Location Keywords</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Keyword list */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle>Keywords</CardTitle>
                        <CardDescription>Manage keywords associated with your business</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setShowKeywordForm(!showKeywordForm)} className="gap-2 w-full sm:w-auto">
                        <Plus className="h-4 w-4" />
                        Add Keyword
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add keyword inline form */}
                    {showKeywordForm && (
                      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                        <h4 className="font-medium text-sm">New Keyword</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="kw-keyword">Keyword</Label>
                            <Input
                              id="kw-keyword"
                              placeholder="e.g. kitchen renovation Springfield"
                              value={newKeyword.keyword}
                              onChange={(e) => setNewKeyword((p) => ({ ...p, keyword: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kw-category">Category</Label>
                            <select
                              id="kw-category"
                              value={newKeyword.category}
                              onChange={(e) => setNewKeyword((p) => ({ ...p, category: e.target.value as KeywordItem["category"] }))}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {KEYWORD_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label htmlFor="kw-notes">Notes (optional)</Label>
                            <Input
                              id="kw-notes"
                              placeholder="e.g. Used in welcome emails"
                              value={newKeyword.notes}
                              onChange={(e) => setNewKeyword((p) => ({ ...p, notes: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={addKeyword}>Save Keyword</Button>
                          <Button size="sm" variant="outline" onClick={() => { setShowKeywordForm(false); setNewKeyword({ keyword: "", category: "general", notes: "" }); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Search keywords..."
                        value={keywordSearch}
                        onChange={(e) => setKeywordSearch(e.target.value)}
                        className="sm:max-w-xs"
                      />
                      <select
                        value={keywordCategoryFilter}
                        onChange={(e) => setKeywordCategoryFilter(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="all">All categories</option>
                        {KEYWORD_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Keyword rows */}
                    <div className="space-y-2">
                      {(settings.seoKeywords || [])
                        .filter((k) =>
                          (keywordCategoryFilter === "all" || k.category === keywordCategoryFilter) &&
                          (keywordSearch === "" || k.keyword.toLowerCase().includes(keywordSearch.toLowerCase()))
                        )
                        .map((k) => {
                          const cat = KEYWORD_CATEGORIES.find((c) => c.value === k.category);
                          return (
                            <div key={k.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{k.keyword}</p>
                                  {k.notes && <p className="text-xs text-muted-foreground truncate">{k.notes}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                {k.volume && (
                                  <span className="text-xs text-muted-foreground hidden sm:inline">{k.volume}/mo</span>
                                )}
                                {cat && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>
                                    {cat.label}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteKeyword(k.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      {(settings.seoKeywords || []).filter((k) =>
                        (keywordCategoryFilter === "all" || k.category === keywordCategoryFilter) &&
                        (keywordSearch === "" || k.keyword.toLowerCase().includes(keywordSearch.toLowerCase()))
                      ).length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <Hash className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No keywords found</p>
                        </div>
                      )}
                    </div>

                    {/* Export row */}
                    {(settings.seoKeywords || []).length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">All keywords (comma-separated)</p>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={(settings.seoKeywords || []).map((k) => k.keyword).join(", ")}
                            className="text-xs text-muted-foreground font-mono"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText((settings.seoKeywords || []).map((k) => k.keyword).join(", "));
                              toast.success("Copied to clipboard");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tags */}
            {activeTab === "tags" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Business Tags</span>
                      <Button
                        size="sm"
                        onClick={() => setShowTagForm(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Tag
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {(settings.businessTags || []).map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="font-medium">{tag.name}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteTag(tag.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {(settings.businessTags || []).length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No tags created yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Tag Form Modal */}
                {showTagForm && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6">
                      <h3 className="text-lg font-semibold mb-4">Add Tag</h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const tag = {
                            name: (formData.get("name") as string) || "",
                            color:
                              (formData.get("color") as string) || "#000000",
                          };
                          addTag(tag);
                          setShowTagForm(false);
                        }}
                      >
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="tagName">Tag Name</Label>
                            <Input
                              id="tagName"
                              name="name"
                              placeholder="Enter tag name"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="tagColor">Color</Label>
                            <Input
                              id="tagColor"
                              name="color"
                              type="color"
                              defaultValue="#3b82f6"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowTagForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">Add Tag</Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Media Settings */}
            {activeTab === "media" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileImage className="h-5 w-5" />
                      Image Settings
                    </CardTitle>
                    <CardDescription>
                      Configure supported image formats and settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">
                        Supported File Types
                      </Label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          { ext: ".jpg", desc: "JPEG Image", platform: "all" },
                          { ext: ".jpeg", desc: "JPEG Image", platform: "all" },
                          { ext: ".png", desc: "PNG Image", platform: "all" },
                          { ext: ".gif", desc: "GIF Image", platform: "all" },
                          { ext: ".webp", desc: "WebP Image", platform: "all" },
                          {
                            ext: ".heic",
                            desc: "HEIC Image (iPhone)",
                            platform: "apple",
                          },
                          {
                            ext: ".heif",
                            desc: "HEIF Image (iPhone)",
                            platform: "apple",
                          },
                        ].map((format) => (
                          <div
                            key={format.ext}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <FileImage className="h-4 w-4 text-blue-600" />
                                <code className="bg-muted px-2 py-1 rounded text-sm">
                                  {format.ext}
                                </code>
                              </div>
                              <div>
                                <span className="font-medium">
                                  {format.desc}
                                </span>
                                {format.platform === "apple" && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-xs"
                                  >
                                    🍎 Apple
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Switch
                              checked={(
                                settings.allowedImageTypes || []
                              ).includes(format.ext)}
                              onCheckedChange={(checked) => {
                                const current =
                                  settings.allowedImageTypes || [];
                                const updated = checked
                                  ? [...current, format.ext]
                                  : current.filter((t) => t !== format.ext);
                                updateSetting("allowedImageTypes", updated);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Settings
                    </CardTitle>
                    <CardDescription>
                      Configure supported video formats and settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">
                        Supported File Types
                      </Label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          { ext: ".mp4", desc: "MP4 Video", platform: "all" },
                          {
                            ext: ".mov",
                            desc: "QuickTime Video",
                            platform: "apple",
                          },
                          {
                            ext: ".avi",
                            desc: "AVI Video",
                            platform: "windows",
                          },
                          {
                            ext: ".wmv",
                            desc: "Windows Media Video",
                            platform: "windows",
                          },
                        ].map((format) => (
                          <div
                            key={format.ext}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Video className="h-4 w-4 text-purple-600" />
                                <code className="bg-muted px-2 py-1 rounded text-sm">
                                  {format.ext}
                                </code>
                              </div>
                              <div>
                                <span className="font-medium">
                                  {format.desc}
                                </span>
                                {format.platform === "apple" && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-xs"
                                  >
                                    🍎 Apple
                                  </Badge>
                                )}
                                {format.platform === "windows" && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-xs"
                                  >
                                    🪟 Windows
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Switch
                              checked={(
                                settings.allowedVideoTypes || []
                              ).includes(format.ext)}
                              onCheckedChange={(checked) => {
                                const current =
                                  settings.allowedVideoTypes || [];
                                const updated = checked
                                  ? [...current, format.ext]
                                  : current.filter((t) => t !== format.ext);
                                updateSetting("allowedVideoTypes", updated);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Label
                        htmlFor="maxFileSize"
                        className="text-base font-medium"
                      >
                        Maximum File Size
                      </Label>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <Input
                            id="maxFileSize"
                            type="number"
                            value={settings.maxFileSize || 10}
                            onChange={(e) =>
                              updateSetting(
                                "maxFileSize",
                                parseInt(e.target.value),
                              )
                            }
                            min="1"
                            max="500"
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            MB
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Recommended: 50MB for videos, 10MB for images
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* File Optimization (moved from separate tab) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      File Optimization
                    </CardTitle>
                    <CardDescription>
                      Automatically optimize and compress uploaded files to save
                      storage space
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-primary" />
                        <div>
                          <Label className="text-base">Auto Optimization</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically optimize uploaded files for better
                            performance
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.autoOptimization !== false}
                        onCheckedChange={(checked) =>
                          updateSetting("autoOptimization", checked)
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label
                          htmlFor="compressionLevel"
                          className="text-base font-medium"
                        >
                          Compression Level
                        </Label>
                        <div className="flex items-center gap-4 mt-2">
                          <Input
                            id="compressionLevel"
                            type="range"
                            min="10"
                            max="100"
                            value={settings.compressionLevel || 80}
                            onChange={(e) =>
                              updateSetting(
                                "compressionLevel",
                                parseInt(e.target.value),
                              )
                            }
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-12">
                            {settings.compressionLevel || 80}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Higher values = better quality, larger files
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-900">
                            Storage Saved
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-green-700">
                          {settings.totalSpaceSaved || 0} GB
                        </div>
                        <p className="text-sm text-green-600 mt-1">
                          Through file optimization
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-base font-medium">
                        Optimization Settings by File Type
                      </Label>
                      <div className="mt-3 space-y-3">
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileImage className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">Images</span>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Convert to WebP format, resize large images, remove
                            metadata
                          </div>
                        </div>

                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4 text-purple-600" />
                              <span className="font-medium">Videos</span>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Compress videos, optimize bitrate, generate
                            thumbnails
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Media Schema Editor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Automated Media Schema
                    </CardTitle>
                    <CardDescription>
                      Configure the metadata schema that will be automatically
                      generated for uploaded media files
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Schema Template Editor */}
                    <div>
                      <Label
                        htmlFor="mediaSchema"
                        className="text-base font-medium"
                      >
                        Schema Template
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1 mb-3">
                        Define the JSON schema structure for automated media
                        metadata. Use variables in double curly braces.
                      </p>
                      <Textarea
                        id="mediaSchema"
                        value={
                          settings.mediaSchemaTemplate ||
                          `{
  "title": "{{fileName}}",
  "description": "{{description}}",
  "project": {
    "id": "{{projectId}}",
    "name": "{{projectName}}",
    "address": "{{projectAddress}}",
    "customer": "{{customerName}}"
  },
  "upload": {
    "timestamp": "{{uploadTimestamp}}",
    "user": "{{uploadedBy}}",
    "userEmail": "{{uploaderEmail}}"
  },
  "media": {
    "type": "{{mediaType}}",
    "format": "{{fileFormat}}",
    "size": "{{fileSize}}",
    "dimensions": "{{dimensions}}",
    "duration": "{{duration}}"
  },
  "metadata": {
    "tags": [{{tags}}],
    "keywords": [{{keywords}}],
    "location": "{{gpsLocation}}",
    "device": "{{deviceInfo}}",
    "camera": "{{cameraModel}}"
  },
  "business": {
    "name": "{{businessName}}",
    "address": "{{businessAddress}}",
    "contact": "{{businessContact}}"
  },
  "seo": {
    "altText": "{{altText}}",
    "caption": "{{caption}}",
    "slug": "{{slug}}",
    "schema": {
      "@context": "https://schema.org",
      "@type": "{{schemaType}}",
      "name": "{{title}}",
      "description": "{{description}}",
      "image": "{{imageUrl}}",
      "url": "{{canonicalUrl}}",
      "contentUrl": "{{contentUrl}}",
      "creator": {
        "@type": "Organization",
        "name": "{{businessName}}",
        "url": "{{businessWebsite}}"
      },
      "about": {
        "@type": "{{projectSchemaType}}",
        "name": "{{projectName}}",
        "address": "{{projectAddress}}"
      },
      "dateCreated": "{{uploadTimestamp}}",
      "encodingFormat": "{{fileFormat}}",
      "contentSize": "{{fileSize}}",
      "width": "{{imageWidth}}",
      "height": "{{imageHeight}}"
    },
    "openGraph": {
      "og:type": "{{ogType}}",
      "og:title": "{{ogTitle}}",
      "og:description": "{{ogDescription}}",
      "og:image": "{{ogImage}}",
      "og:image:width": "{{imageWidth}}",
      "og:image:height": "{{imageHeight}}",
      "og:url": "{{canonicalUrl}}",
      "og:site_name": "{{businessName}}",
      "article:author": "{{uploadedBy}}",
      "article:published_time": "{{uploadTimestamp}}",
      "article:tag": [{{ogTags}}]
    },
    "twitter": {
      "twitter:card": "{{twitterCard}}",
      "twitter:title": "{{twitterTitle}}",
      "twitter:description": "{{twitterDescription}}",
      "twitter:image": "{{twitterImage}}",
      "twitter:site": "{{twitterHandle}}",
      "twitter:creator": "{{twitterCreator}}"
    }
  }
}`
                        }
                        onChange={(e) =>
                          updateSetting("mediaSchemaTemplate", e.target.value)
                        }
                        className="min-h-[400px] font-mono text-sm"
                        placeholder="Enter your custom schema template..."
                      />
                    </div>

                    {/* Available Variables */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          System Variables
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              fileName
                            </code>
                            <span className="text-muted-foreground">
                              Original filename
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              fileSize
                            </code>
                            <span className="text-muted-foreground">
                              File size in bytes
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              fileFormat
                            </code>
                            <span className="text-muted-foreground">
                              File extension
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              mediaType
                            </code>
                            <span className="text-muted-foreground">
                              image/video
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              uploadTimestamp
                            </code>
                            <span className="text-muted-foreground">
                              Upload date/time
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              dimensions
                            </code>
                            <span className="text-muted-foreground">
                              Width x Height
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              duration
                            </code>
                            <span className="text-muted-foreground">
                              Video length
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              gpsLocation
                            </code>
                            <span className="text-muted-foreground">
                              GPS coordinates
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              deviceInfo
                            </code>
                            <span className="text-muted-foreground">
                              Device/browser
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              cameraModel
                            </code>
                            <span className="text-muted-foreground">
                              Camera make/model
                            </span>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          User & Project Variables
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              uploadedBy
                            </code>
                            <span className="text-muted-foreground">
                              User full name
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              uploaderEmail
                            </code>
                            <span className="text-muted-foreground">
                              User email
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              projectId
                            </code>
                            <span className="text-muted-foreground">
                              Project ID
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              projectName
                            </code>
                            <span className="text-muted-foreground">
                              Project title
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              projectAddress
                            </code>
                            <span className="text-muted-foreground">
                              Project location
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              customerName
                            </code>
                            <span className="text-muted-foreground">
                              Customer name
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              businessName
                            </code>
                            <span className="text-muted-foreground">
                              Company name
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              businessAddress
                            </code>
                            <span className="text-muted-foreground">
                              Company address
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded">
                              businessContact
                            </code>
                            <span className="text-muted-foreground">
                              Company contact
                            </span>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          SEO & Social Media Variables
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              slug
                            </code>
                            <span className="text-muted-foreground text-xs">
                              🤖 Auto-generated URL slug
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              altText
                            </code>
                            <span className="text-muted-foreground text-xs">
                              🤖 AI-generated description
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              keywords
                            </code>
                            <span className="text-muted-foreground text-xs">
                              🤖 Auto-extracted keywords
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              tags
                            </code>
                            <span className="text-muted-foreground text-xs">
                              🤖 Project-based suggestions
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              schemaType
                            </code>
                            <span className="text-muted-foreground text-xs">
                              Schema.org type
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              ogTitle
                            </code>
                            <span className="text-muted-foreground text-xs">
                              OpenGraph title
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              ogDescription
                            </code>
                            <span className="text-muted-foreground text-xs">
                              OpenGraph description
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              twitterCard
                            </code>
                            <span className="text-muted-foreground text-xs">
                              Twitter card type
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              canonicalUrl
                            </code>
                            <span className="text-muted-foreground text-xs">
                              Canonical URL
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* User-Defined Variables */}
                    <div>
                      <Label className="text-base font-medium">
                        Custom Variables
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1 mb-3">
                        Define your own variables that users can fill when
                        uploading media
                      </p>
                      <div className="space-y-3">
                        {(settings.customSchemaVariables || []).map(
                          (variable, index) => (
                            <div
                              key={index}
                              className="flex gap-3 items-center p-3 border rounded-lg"
                            >
                              <Input
                                placeholder="Variable name (e.g., category)"
                                value={variable.name || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(settings.customSchemaVariables || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    name: e.target.value,
                                  };
                                  updateSetting(
                                    "customSchemaVariables",
                                    updated,
                                  );
                                }}
                                className="flex-1"
                              />
                              <Input
                                placeholder="Description"
                                value={variable.description || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(settings.customSchemaVariables || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    description: e.target.value,
                                  };
                                  updateSetting(
                                    "customSchemaVariables",
                                    updated,
                                  );
                                }}
                                className="flex-1"
                              />
                              <Select
                                value={variable.type || "text"}
                                onValueChange={(value) => {
                                  const updated = [
                                    ...(settings.customSchemaVariables || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    type: value,
                                  };
                                  updateSetting(
                                    "customSchemaVariables",
                                    updated,
                                  );
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">
                                    Yes/No
                                  </SelectItem>
                                  <SelectItem value="select">
                                    Dropdown
                                  </SelectItem>
                                  <SelectItem value="tags">Tags</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const updated = [
                                    ...(settings.customSchemaVariables || []),
                                  ];
                                  updated.splice(index, 1);
                                  updateSetting(
                                    "customSchemaVariables",
                                    updated,
                                  );
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ),
                        )}
                        <Button
                          variant="outline"
                          onClick={() => {
                            const updated = [
                              ...(settings.customSchemaVariables || []),
                            ];
                            updated.push({
                              name: "",
                              description: "",
                              type: "text",
                            });
                            updateSetting("customSchemaVariables", updated);
                          }}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Custom Variable
                        </Button>
                      </div>
                    </div>

                    {/* Auto-Population Settings */}
                    <div>
                      <Label className="text-base font-medium">
                        Auto-Population Configuration
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">
                        Configure automatic generation and suggestion features
                        for metadata fields
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Card className="p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Bot className="h-4 w-4 text-blue-600" />
                            AI-Powered Features
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium">
                                  AI Alt Text Generation
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Use AI vision API to describe images
                                </p>
                              </div>
                              <Switch
                                checked={settings.enableAIAltText !== false}
                                onCheckedChange={(checked) =>
                                  updateSetting("enableAIAltText", checked)
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium">
                                  Smart Keyword Extraction
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Extract keywords from description + business
                                  type
                                </p>
                              </div>
                              <Switch
                                checked={settings.enableSmartKeywords !== false}
                                onCheckedChange={(checked) =>
                                  updateSetting("enableSmartKeywords", checked)
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium">
                                  Project-Based Tag Suggestions
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Auto-suggest tags based on project type
                                </p>
                              </div>
                              <Switch
                                checked={settings.enableProjectTags !== false}
                                onCheckedChange={(checked) =>
                                  updateSetting("enableProjectTags", checked)
                                }
                              />
                            </div>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-600" />
                            Auto-Generation Settings
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium">
                                  Auto-Generate Slugs
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Create SEO-friendly URLs from titles
                                </p>
                              </div>
                              <Switch
                                checked={settings.enableAutoSlug !== false}
                                onCheckedChange={(checked) =>
                                  updateSetting("enableAutoSlug", checked)
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium">
                                  Auto Schema.org Types
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Automatically select Schema.org types
                                </p>
                              </div>
                              <Switch
                                checked={
                                  settings.enableAutoSchemaTypes !== false
                                }
                                onCheckedChange={(checked) =>
                                  updateSetting(
                                    "enableAutoSchemaTypes",
                                    checked,
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm font-medium">
                                  Social Media Optimization
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Auto-optimize for OpenGraph/Twitter
                                </p>
                              </div>
                              <Switch
                                checked={
                                  settings.enableSocialOptimization !== false
                                }
                                onCheckedChange={(checked) =>
                                  updateSetting(
                                    "enableSocialOptimization",
                                    checked,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </Card>
                      </div>

                      {/* AI Configuration */}
                      {settings.enableAIAltText && (
                        <Card className="p-4 mt-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <SettingsIcon className="h-4 w-4" />
                            AI Service Configuration
                          </h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="aiProvider">
                                AI Vision Provider
                              </Label>
                              <Select
                                value={settings.aiVisionProvider || "openai"}
                                onValueChange={(value) =>
                                  updateSetting("aiVisionProvider", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="openai">
                                    OpenAI GPT-4 Vision
                                  </SelectItem>
                                  <SelectItem value="google">
                                    Google Vision AI
                                  </SelectItem>
                                  <SelectItem value="azure">
                                    Azure Computer Vision
                                  </SelectItem>
                                  <SelectItem value="aws">
                                    AWS Rekognition
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="aiApiKey">API Key</Label>
                              <Input
                                id="aiApiKey"
                                type="password"
                                placeholder="Enter your AI service API key"
                                value={settings.aiApiKey || ""}
                                onChange={(e) =>
                                  updateSetting("aiApiKey", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>

                    {/* Schema Validation & Preview */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-base font-medium">
                          Schema Validation
                        </Label>
                        <div className="mt-2 p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-700 font-medium">
                              Valid JSON Schema
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Schema syntax is correct and ready to use
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label className="text-base font-medium">
                          Settings
                        </Label>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Auto-apply schema</span>
                            <Switch
                              checked={settings.autoApplySchema !== false}
                              onCheckedChange={(checked) =>
                                updateSetting("autoApplySchema", checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Allow user edits</span>
                            <Switch
                              checked={settings.allowSchemaEdits !== false}
                              onCheckedChange={(checked) =>
                                updateSetting("allowSchemaEdits", checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Include EXIF data</span>
                            <Switch
                              checked={settings.includeExifData !== false}
                              onCheckedChange={(checked) =>
                                updateSetting("includeExifData", checked)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        onClick={() => {
                          // Preview functionality
                          alert(
                            "Schema preview functionality would show a sample generated metadata object here",
                          );
                        }}
                        variant="outline"
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Preview Schema
                      </Button>
                      <Button
                        onClick={() => {
                          // Reset to default
                          updateSetting(
                            "mediaSchemaTemplate",
                            `{
  "title": "{{fileName}}",
  "description": "{{description}}",
  "project": {
    "id": "{{projectId}}",
    "name": "{{projectName}}",
    "address": "{{projectAddress}}",
    "customer": "{{customerName}}"
  },
  "upload": {
    "timestamp": "{{uploadTimestamp}}",
    "user": "{{uploadedBy}}",
    "userEmail": "{{uploaderEmail}}"
  },
  "media": {
    "type": "{{mediaType}}",
    "format": "{{fileFormat}}",
    "size": "{{fileSize}}",
    "dimensions": "{{dimensions}}",
    "duration": "{{duration}}"
  },
  "metadata": {
    "tags": [{{tags}}],
    "keywords": [{{keywords}}],
    "location": "{{gpsLocation}}",
    "device": "{{deviceInfo}}",
    "camera": "{{cameraModel}}"
  },
  "business": {
    "name": "{{businessName}}",
    "address": "{{businessAddress}}",
    "contact": "{{businessContact}}"
  },
  "seo": {
    "altText": "{{altText}}",
    "caption": "{{caption}}",
    "slug": "{{slug}}",
    "schema": {
      "@context": "https://schema.org",
      "@type": "{{schemaType}}",
      "name": "{{title}}",
      "description": "{{description}}",
      "image": "{{imageUrl}}",
      "url": "{{canonicalUrl}}",
      "contentUrl": "{{contentUrl}}",
      "creator": {
        "@type": "Organization",
        "name": "{{businessName}}",
        "url": "{{businessWebsite}}"
      },
      "about": {
        "@type": "{{projectSchemaType}}",
        "name": "{{projectName}}",
        "address": "{{projectAddress}}"
      },
      "dateCreated": "{{uploadTimestamp}}",
      "encodingFormat": "{{fileFormat}}",
      "contentSize": "{{fileSize}}",
      "width": "{{imageWidth}}",
      "height": "{{imageHeight}}"
    },
    "openGraph": {
      "og:type": "{{ogType}}",
      "og:title": "{{ogTitle}}",
      "og:description": "{{ogDescription}}",
      "og:image": "{{ogImage}}",
      "og:image:width": "{{imageWidth}}",
      "og:image:height": "{{imageHeight}}",
      "og:url": "{{canonicalUrl}}",
      "og:site_name": "{{businessName}}",
      "article:author": "{{uploadedBy}}",
      "article:published_time": "{{uploadTimestamp}}",
      "article:tag": [{{ogTags}}]
    },
    "twitter": {
      "twitter:card": "{{twitterCard}}",
      "twitter:title": "{{twitterTitle}}",
      "twitter:description": "{{twitterDescription}}",
      "twitter:image": "{{twitterImage}}",
      "twitter:site": "{{twitterHandle}}",
      "twitter:creator": "{{twitterCreator}}"
    }
  }
}`,
                          );
                        }}
                        variant="outline"
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset to Default
                      </Button>
                      <Button
                        onClick={() => {
                          // Export schema
                          const schema = settings.mediaSchemaTemplate || "";
                          const blob = new Blob([schema], {
                            type: "application/json",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "media-schema-template.json";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        variant="outline"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export Schema
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Reviews */}
            {activeTab === "reviews" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Review Communication Settings</CardTitle>
                    <CardDescription>
                      Configure how review requests are sent to customers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Review Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Send automatic review request reminders
                        </p>
                      </div>
                      <Switch
                        checked={settings.reviewReminderEnabled || false}
                        onCheckedChange={(checked) =>
                          updateSetting("reviewReminderEnabled", checked)
                        }
                      />
                    </div>

                    {settings.reviewReminderEnabled && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="reviewReminderDays">
                            Reminder Frequency (days)
                          </Label>
                          <Input
                            id="reviewReminderDays"
                            type="number"
                            value={settings.reviewReminderDays || 7}
                            onChange={(e) =>
                              updateSetting(
                                "reviewReminderDays",
                                parseInt(e.target.value),
                              )
                            }
                            min="1"
                            max="30"
                            className="mt-1"
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Send reminders every{" "}
                            {settings.reviewReminderDays || 7} days after
                            project completion
                          </p>
                        </div>

                        <div>
                          <Label>Communication Methods</Label>
                          <div className="flex flex-col gap-3 mt-1">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">Email</span>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-green-600" />
                                <span className="font-medium">SMS</span>
                              </div>
                              <Switch />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="reviewEmailTemplate">
                          Email Template
                        </Label>
                        <Textarea
                          id="reviewEmailTemplate"
                          value={settings.reviewEmailTemplate || ""}
                          onChange={(e) =>
                            updateSetting("reviewEmailTemplate", e.target.value)
                          }
                          placeholder="Hi {CUSTOMER_NAME}, we'd love to hear about your experience with {PROJECT_NAME}..."
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="reviewSmsTemplate">SMS Template</Label>
                        <Textarea
                          id="reviewSmsTemplate"
                          value={settings.reviewSmsTemplate || ""}
                          onChange={(e) =>
                            updateSetting("reviewSmsTemplate", e.target.value)
                          }
                          placeholder="Hi {CUSTOMER_NAME}! How was your experience with {BUSINESS_NAME}? Leave a review: {REVIEW_LINK}"
                          className="mt-1"
                          maxLength={160}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          SMS messages are limited to 160 characters
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label>Follow-up System Configuration</Label>
                      <div className="grid gap-3 mt-2">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">Auto Follow-up</span>
                            <p className="text-sm text-muted-foreground">
                              Send follow-up if no response within 7 days
                            </p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">
                              Escalation System
                            </span>
                            <p className="text-sm text-muted-foreground">
                              Switch to SMS after 2 email attempts
                            </p>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">Smart Timing</span>
                            <p className="text-sm text-muted-foreground">
                              Send during optimal hours based on customer
                              timezone
                            </p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reviewAiPrompt">
                        AI Review Request Prompt
                      </Label>
                      <Textarea
                        id="reviewAiPrompt"
                        value={settings.reviewAiPrompt || ""}
                        onChange={(e) =>
                          updateSetting("reviewAiPrompt", e.target.value)
                        }
                        placeholder="Generate a personalized review request for this project..."
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Review Gate Customization</CardTitle>
                    <CardDescription>
                      Customize the review gate page that clients see
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Business Logo */}
                    <div>
                      <Label htmlFor="reviewGateLogoUrl">Business Logo URL</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="reviewGateLogoUrl"
                          value={settings.reviewGateLogoUrl || ""}
                          onChange={(e) => updateSetting("reviewGateLogoUrl", e.target.value)}
                          placeholder="https://yourdomain.com/logo.png"
                        />
                        {settings.reviewGateLogoUrl && (
                          <img
                            src={settings.reviewGateLogoUrl}
                            alt="Logo preview"
                            className="h-9 w-9 rounded object-contain border flex-shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Displayed at the top of the review page your customers see</p>
                    </div>

                    {/* Heading */}
                    <div>
                      <Label htmlFor="reviewGateHeading">Heading</Label>
                      <Input
                        id="reviewGateHeading"
                        value={settings.reviewGateHeading || ""}
                        onChange={(e) => updateSetting("reviewGateHeading", e.target.value)}
                        placeholder="How did we do?"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Large headline shown above the star rating</p>
                    </div>

                    <div>
                      <Label htmlFor="reviewGateTitle">Subheading / Title</Label>
                      <Input
                        id="reviewGateTitle"
                        value={settings.reviewGateTitle || ""}
                        onChange={(e) =>
                          updateSetting("reviewGateTitle", e.target.value)
                        }
                        placeholder="We'd Love Your Feedback!"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="reviewGateDescription">Description</Label>
                      <Textarea
                        id="reviewGateDescription"
                        value={settings.reviewGateDescription || ""}
                        onChange={(e) =>
                          updateSetting("reviewGateDescription", e.target.value)
                        }
                        placeholder="Your feedback helps us improve..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Review Gate Video</Label>
                      <div className="space-y-3 mt-2">
                        <div className="flex gap-2">
                          <Input
                            id="reviewGateVideoUrl"
                            value={settings.reviewGateVideoUrl || ""}
                            onChange={(e) =>
                              updateSetting(
                                "reviewGateVideoUrl",
                                e.target.value,
                              )
                            }
                            placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                          />
                          {settings.reviewGateVideoUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateSetting("reviewGateVideoUrl", "")
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </div>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">
                            Or upload your own video file
                          </p>
                          <Button variant="outline" size="sm">
                            <Upload className="h-4 w-4 mr-2" />
                            Choose Video File
                          </Button>
                          <p className="text-xs text-gray-500 mt-2">
                            Supports MP4, MOV, AVI up to 50MB
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Star Threshold */}
                    <div>
                      <Label htmlFor="reviewGateThreshold">
                        Positive Review Threshold (stars)
                      </Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Input
                          id="reviewGateThreshold"
                          type="number"
                          min={1}
                          max={5}
                          value={settings.reviewGateThreshold ?? 4}
                          onChange={(e) =>
                            updateSetting(
                              "reviewGateThreshold",
                              Math.min(5, Math.max(1, Number(e.target.value))),
                            )
                          }
                          className="w-24"
                        />
                        <p className="text-xs text-muted-foreground">
                          Customers who rate {settings.reviewGateThreshold ?? 4}★ or higher are redirected to Google
                        </p>
                      </div>
                    </div>

                    {/* Google Review URL */}
                    <div>
                      <Label htmlFor="reviewGateGoogleUrl">Google Review URL</Label>
                      <Input
                        id="reviewGateGoogleUrl"
                        value={settings.reviewGateGoogleUrl || ""}
                        onChange={(e) =>
                          updateSetting("reviewGateGoogleUrl", e.target.value)
                        }
                        placeholder="https://g.page/r/your-business/review"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Where high-rated customers are sent to leave their public review
                      </p>
                    </div>

                    {/* SEO Keywords */}
                    <div>
                      <Label htmlFor="reviewGateSeoKeywords">SEO Keywords</Label>
                      <Input
                        id="reviewGateSeoKeywords"
                        value={settings.reviewGateSeoKeywords || ""}
                        onChange={(e) =>
                          updateSetting("reviewGateSeoKeywords", e.target.value)
                        }
                        placeholder="kitchen renovation, custom cabinets, Springfield contractor"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated keywords the AI uses when enhancing customer reviews
                      </p>
                    </div>

                    {/* Submit Button Text */}
                    <div>
                      <Label htmlFor="reviewGateButtonText">Submit Button Text</Label>
                      <Input
                        id="reviewGateButtonText"
                        value={settings.reviewGateButtonText || ""}
                        onChange={(e) =>
                          updateSetting("reviewGateButtonText", e.target.value)
                        }
                        placeholder="Submit My Review"
                        className="mt-1"
                      />
                    </div>

                    {/* Thank You Message */}
                    <div>
                      <Label htmlFor="reviewGateThankYouMessage">Thank You Message</Label>
                      <Textarea
                        id="reviewGateThankYouMessage"
                        value={settings.reviewGateThankYouMessage || ""}
                        onChange={(e) =>
                          updateSetting("reviewGateThankYouMessage", e.target.value)
                        }
                        placeholder="Thank you for your feedback! We truly appreciate it."
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Shown to customers after they submit a low-star rating (kept internal)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Notifications - Comprehensive System */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                {/* Notification Center Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Center
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Manage all notifications, alerts and communication
                      preferences from this central hub
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-900">
                            System Updates
                          </span>
                        </div>
                        <p className="text-sm text-blue-700">
                          System alerts and maintenance notifications
                        </p>
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            3 Today
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-900">
                            Project Updates
                          </span>
                        </div>
                        <p className="text-sm text-green-700">
                          Updates on project status and milestones
                        </p>
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            12 This Week
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-purple-900">
                            Communications
                          </span>
                        </div>
                        <p className="text-sm text-purple-700">
                          Client messages and team communications
                        </p>
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            2 Unread
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Master Controls */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Master Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bell className="h-4 w-4 text-primary" />
                        <div>
                          <Label className="text-base">
                            Enable All Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Master switch for all notification types
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.enableNotifications !== false}
                        onCheckedChange={(checked) =>
                          updateSetting("enableNotifications", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {settings.enableSounds ? (
                          <Volume2 className="h-4 w-4 text-primary" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <Label className="text-base">
                            Notification Sounds
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Play audio alerts for notifications
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.enableSounds !== false}
                        onCheckedChange={(checked) =>
                          updateSetting("enableSounds", checked)
                        }
                        disabled={!settings.enableNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-4 w-4 text-primary" />
                        <div>
                          <Label className="text-base">
                            Desktop Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Show browser notifications
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.desktopNotifications !== false}
                        onCheckedChange={(checked) =>
                          updateSetting("desktopNotifications", checked)
                        }
                        disabled={!settings.enableNotifications}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Notification Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Notification Categories
                    </CardTitle>
                    <CardDescription>
                      Control which types of notifications you receive
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Message Types</h4>
                        <div className="space-y-3">
                          {Object.entries(settings.messageTypes || {}).map(
                            ([type, enabled]) => (
                              <div
                                key={type}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  {type === "info" && (
                                    <Info className="h-4 w-4 text-blue-600" />
                                  )}
                                  {type === "warning" && (
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                  )}
                                  {type === "success" && (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                  {type === "error" && (
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="text-sm capitalize">
                                    {type}
                                  </span>
                                </div>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(checked) => {
                                    const newMessageTypes = {
                                      ...(settings.messageTypes || {}),
                                      [type]: checked,
                                    };
                                    updateSetting(
                                      "messageTypes",
                                      newMessageTypes,
                                    );
                                  }}
                                  disabled={!settings.enableNotifications}
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Categories</h4>
                        <div className="space-y-3">
                          {Object.entries(settings.categories || {}).map(
                            ([category, enabled]) => (
                              <div
                                key={category}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  {category === "system" && (
                                    <SettingsIcon className="h-4 w-4 text-gray-600" />
                                  )}
                                  {category === "marketing" && (
                                    <MessageSquare className="h-4 w-4 text-purple-600" />
                                  )}
                                  {category === "support" && (
                                    <Users className="h-4 w-4 text-blue-600" />
                                  )}
                                  {category === "emergency" && (
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="text-sm capitalize">
                                    {category}
                                  </span>
                                </div>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(checked) => {
                                    const newCategories = {
                                      ...(settings.categories || {}),
                                      [category]: checked,
                                    };
                                    updateSetting("categories", newCategories);
                                  }}
                                  disabled={!settings.enableNotifications}
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Methods */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Delivery Methods
                    </CardTitle>
                    <CardDescription>
                      Choose how you want to receive notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Object.entries(settings.deliveryMethods || {}).map(
                        ([method, enabled]) => (
                          <div
                            key={method}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {method === "email" && (
                                <Mail className="h-4 w-4 text-blue-600" />
                              )}
                              {method === "sms" && (
                                <Smartphone className="h-4 w-4 text-green-600" />
                              )}
                              {method === "inApp" && (
                                <Monitor className="h-4 w-4 text-purple-600" />
                              )}
                              {method === "push" && (
                                <Bell className="h-4 w-4 text-orange-600" />
                              )}
                              <div>
                                <span className="font-medium capitalize">
                                  {method === "inApp" ? "In-App" : method}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {method === "email" &&
                                    "Get notifications via email"}
                                  {method === "sms" &&
                                    "Urgent notifications via text"}
                                  {method === "inApp" &&
                                    "Notifications within the app"}
                                  {method === "push" &&
                                    "Browser push notifications"}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) => {
                                const newDeliveryMethods = {
                                  ...(settings.deliveryMethods || {}),
                                  [method]: checked,
                                };
                                updateSetting(
                                  "deliveryMethods",
                                  newDeliveryMethods,
                                );
                              }}
                              disabled={!settings.enableNotifications}
                            />
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Timing & Frequency */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Timing & Frequency
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-3">
                        <Label>Notification Frequency</Label>
                        <Select
                          value={settings.notificationFrequency || "immediate"}
                          onValueChange={(value) =>
                            updateSetting("notificationFrequency", value)
                          }
                          disabled={!settings.enableNotifications}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Immediate</SelectItem>
                            <SelectItem value="hourly">
                              Hourly Digest
                            </SelectItem>
                            <SelectItem value="daily">Daily Digest</SelectItem>
                            <SelectItem value="weekly">
                              Weekly Summary
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label>Digest Time</Label>
                        <Input
                          type="time"
                          value={settings.digestTime || "09:00"}
                          onChange={(e) =>
                            updateSetting("digestTime", e.target.value)
                          }
                          disabled={
                            !settings.enableNotifications ||
                            settings.notificationFrequency === "immediate"
                          }
                        />
                      </div>
                    </div>

                    {/* Do Not Disturb */}
                    <div className="pt-4 border-t space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base">Do Not Disturb</Label>
                          <p className="text-sm text-muted-foreground">
                            Set quiet hours for notifications
                          </p>
                        </div>
                        <Switch
                          checked={settings.doNotDisturb?.enabled !== false}
                          onCheckedChange={(checked) =>
                            updateSetting("doNotDisturb", {
                              ...(settings.doNotDisturb || {}),
                              enabled: checked,
                            })
                          }
                          disabled={!settings.enableNotifications}
                        />
                      </div>

                      {settings.doNotDisturb?.enabled && (
                        <div className="grid gap-4 sm:grid-cols-2 pl-6">
                          <div>
                            <Label>Start Time</Label>
                            <Input
                              type="time"
                              value={
                                settings.doNotDisturb?.startTime || "22:00"
                              }
                              onChange={(e) =>
                                updateSetting("doNotDisturb", {
                                  ...(settings.doNotDisturb || {}),
                                  startTime: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>End Time</Label>
                            <Input
                              type="time"
                              value={settings.doNotDisturb?.endTime || "08:00"}
                              onChange={(e) =>
                                updateSetting("doNotDisturb", {
                                  ...(settings.doNotDisturb || {}),
                                  endTime: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Advanced Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Auto Mark as Read</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically mark notifications as read after viewing
                        </p>
                      </div>
                      <Switch
                        checked={settings.autoMarkAsRead || false}
                        onCheckedChange={(checked) =>
                          updateSetting("autoMarkAsRead", checked)
                        }
                        disabled={!settings.enableNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Show Previews</Label>
                        <p className="text-sm text-muted-foreground">
                          Show notification content in previews
                        </p>
                      </div>
                      <Switch
                        checked={settings.showPreviews !== false}
                        onCheckedChange={(checked) =>
                          updateSetting("showPreviews", checked)
                        }
                        disabled={!settings.enableNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">
                          Group Similar Messages
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Combine similar notifications into groups
                        </p>
                      </div>
                      <Switch
                        checked={settings.groupSimilar !== false}
                        onCheckedChange={(checked) =>
                          updateSetting("groupSimilar", checked)
                        }
                        disabled={!settings.enableNotifications}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                    <CardDescription>
                      Required for email and SMS notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="contactEmail">Email Address</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          value={settings.email || ""}
                          onChange={(e) =>
                            updateSetting("email", e.target.value)
                          }
                          placeholder="your.email@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactPhone">Phone Number</Label>
                        <PhoneInput
                          id="contactPhone"
                          value={settings.phone || ""}
                          onChange={(value) => updateSetting("phone", value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Users */}
            {activeTab === "users" && <UserManagementSystem />}

            {/* Billing */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Billing & Subscription
                    </h2>
                    <p className="text-muted-foreground">
                      Manage your plan and billing information
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download Invoice
                    </Button>
                    <Button className="gap-2">
                      <Edit className="h-4 w-4" />
                      Update Payment Method
                    </Button>
                  </div>
                </div>

                {/* Current Plan Overview */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Current Plan
                      </CardTitle>
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {settings.currentPlan || "Professional"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        3/10 users
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Monthly Total
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">$147</div>
                      <p className="text-xs text-muted-foreground">
                        Next bill: April 15, 2024
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Available Slots
                      </CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">7</div>
                      <p className="text-xs text-muted-foreground">
                        Add more users anytime
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Pricing Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pricing Breakdown</CardTitle>
                    <CardDescription>
                      Understand how your monthly bill is calculated
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div>
                          <h4 className="font-medium">Base Users (1-5)</h4>
                          <p className="text-sm text-muted-foreground">
                            3 users × $49/month
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">$147</div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center text-lg font-semibold">
                          <span>Monthly Total</span>
                          <span>$147</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Billed monthly �� Next bill date: April 15, 2024
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Available Plans */}
                <Card>
                  <CardHeader>
                    <CardTitle>Available Plans</CardTitle>
                    <CardDescription>
                      Upgrade or downgrade your plan based on your needs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-6 border rounded-lg relative">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-xl font-bold">Starter</h3>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold">$39</span>
                              <span className="text-sm text-muted-foreground">
                                /user/month
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Up to 5 users
                            </p>
                          </div>

                          <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Up to 5 admin users
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Basic client management
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Standard support
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Monthly reporting
                            </li>
                          </ul>

                          <Button
                            className="w-full"
                            variant="default"
                            onClick={() => handleUpgradeClick("Starter", 39, "Up to 5 users · Basic client management · Standard support")}
                          >
                            Upgrade to Starter
                          </Button>
                        </div>
                      </div>

                      <div className="p-6 border border-blue-500 bg-blue-50 rounded-lg relative">
                        <Badge className="absolute -top-2 left-4 bg-blue-500">
                          Recommended
                        </Badge>
                        <Badge className="absolute -top-2 right-4 bg-green-500">
                          Current Plan
                        </Badge>

                        <div className="space-y-4">
                          <div>
                            <h3 className="text-xl font-bold">Professional</h3>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold">$49</span>
                              <span className="text-sm text-muted-foreground">
                                /user/month
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Up to 15 users
                            </p>
                          </div>

                          <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Up to 15 admin users
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Advanced client management
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Priority support
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Real-time analytics
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Custom branding
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Tiered discounts after 5 users
                            </li>
                          </ul>

                          <Button
                            className="w-full"
                            variant="secondary"
                            disabled
                          >
                            Current Plan
                          </Button>
                        </div>
                      </div>

                      <div className="p-6 border rounded-lg relative">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-xl font-bold">Enterprise</h3>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold">$39</span>
                              <span className="text-sm text-muted-foreground">
                                /user/month
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Up to 50 users
                            </p>
                          </div>

                          <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Up to 50 admin users
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Full feature access
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              24/7 priority support
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              White-label solution
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Advanced integrations
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Volume discounts
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Dedicated account manager
                            </li>
                          </ul>

                          <Button
                            className="w-full"
                            variant="default"
                            onClick={() => handleUpgradeClick("Enterprise", 69, "Up to 50 users · White-label · 24/7 support · Dedicated account manager")}
                          >
                            Upgrade to Enterprise
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Upgrade Confirmation Dialog */}
                <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Upgrade to {selectedUpgradePlan?.name}</DialogTitle>
                      <DialogDescription>
                        {selectedUpgradePlan?.description}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">${selectedUpgradePlan?.price}</span>
                        <span className="text-muted-foreground">/user/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You'll be taken to a secure Stripe checkout to complete your upgrade. You can cancel anytime from this billing page.
                      </p>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setUpgradeDialogOpen(false)}
                        disabled={isUpgrading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpgradeConfirm}
                        disabled={isUpgrading}
                        className="gap-2"
                      >
                        {isUpgrading ? "Redirecting..." : "Proceed to Checkout"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Billing History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Billing History</CardTitle>
                    <CardDescription>
                      View your past invoices and payments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">Date</th>
                            <th className="text-left p-3 font-medium">
                              Description
                            </th>
                            <th className="text-left p-3 font-medium">
                              Amount
                            </th>
                            <th className="text-left p-3 font-medium">
                              Status
                            </th>
                            <th className="text-left p-3 font-medium">
                              Invoice
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-3">March 15, 2024</td>
                            <td className="p-3">Professional Plan - 3 Users</td>
                            <td className="p-3 font-medium">$147.00</td>
                            <td className="p-3">
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Paid
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">February 15, 2024</td>
                            <td className="p-3">Professional Plan - 3 Users</td>
                            <td className="p-3 font-medium">$147.00</td>
                            <td className="p-3">
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Paid
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">January 15, 2024</td>
                            <td className="p-3">Professional Plan - 2 Users</td>
                            <td className="p-3 font-medium">$98.00</td>
                            <td className="p-3">
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Paid
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Information</CardTitle>
                    <CardDescription>
                      Manage your payment methods and billing details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Payment Method</h4>
                          <div className="flex items-center gap-3 p-3 border rounded-lg">
                            <CreditCard className="h-5 w-5" />
                            <div>
                              <p className="font-medium">•••• •••• •••• 4242</p>
                              <p className="text-sm text-muted-foreground">
                                Expires 12/25
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto"
                            >
                              Update
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Billing Address</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Smith Construction LLC</p>
                            <p>123 Business St</p>
                            <p>San Francisco, CA 94105</p>
                            <p>United States</p>
                          </div>
                          <Button variant="ghost" size="sm" className="mt-2">
                            Update Address
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Next Payment</h4>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="flex justify-between items-center">
                              <span>Amount Due:</span>
                              <span className="font-medium">$147</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Due Date:</span>
                              <span className="font-medium">
                                April 15, 2024
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Auto-renewal</h4>
                          <p className="text-sm text-muted-foreground">
                            Your subscription will automatically renew on April
                            15, 2024. You can cancel anytime.
                          </p>
                          <Button variant="outline" size="sm" className="mt-2">
                            Manage Auto-renewal
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Separate Payments Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Payment History</span>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export Payments
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Track all payments and transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">
                              Transaction ID
                            </th>
                            <th className="text-left p-3 font-medium">Date</th>
                            <th className="text-left p-3 font-medium">
                              Amount
                            </th>
                            <th className="text-left p-3 font-medium">
                              Method
                            </th>
                            <th className="text-left p-3 font-medium">
                              Status
                            </th>
                            <th className="text-left p-3 font-medium">
                              Receipt
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-3 font-mono text-sm">
                              txn_1234567890
                            </td>
                            <td className="p-3">2024-01-15</td>
                            <td className="p-3 font-medium">$49.00</td>
                            <td className="p-3">Visa •••• 4242</td>
                            <td className="p-3">
                              <Badge variant="default">Completed</Badge>
                            </td>
                            <td className="p-3">
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-3 font-mono text-sm">
                              txn_0987654321
                            </td>
                            <td className="p-3">2024-01-01</td>
                            <td className="p-3 font-medium">$49.00</td>
                            <td className="p-3">Visa •••• 4242</td>
                            <td className="p-3">
                              <Badge variant="default">Completed</Badge>
                            </td>
                            <td className="p-3">
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-3 font-mono text-sm">
                              txn_1122334455
                            </td>
                            <td className="p-3">2023-12-15</td>
                            <td className="p-3 font-medium">$49.00</td>
                            <td className="p-3">Visa •••• 4242</td>
                            <td className="p-3">
                              <Badge variant="secondary">Refunded</Badge>
                            </td>
                            <td className="p-3">
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Service Management */}
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-900">
                      Service Management
                    </CardTitle>
                    <CardDescription>
                      Manage your subscription and service settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <h4 className="font-medium text-red-900 mb-2">
                        Cancel Service
                      </h4>
                      <p className="text-sm text-red-700 mb-3">
                        Canceling will disable your account at the end of the
                        current billing period. Your data will be retained for
                        30 days.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Cancel Subscription
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <RefreshCw className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Auto-Renewal</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Automatically renew subscription
                        </p>
                        <Switch defaultChecked />
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Billing Alerts</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Email notifications for payments
                        </p>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
