import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  FolderOpen,
  Plus,
  Camera,
  Settings,
  Users,
  Building2,
  Shield,
  CreditCard,
  FileText,
  MessageSquare,
  HelpCircle,
  Star,
  Activity,
  Bot,
  Workflow,
  Monitor,
  Target,
  BookOpen,
  Database,
  Mail,
  Lock,
  AlertTriangle,
  Globe,
  Zap,
  User,
  Lightbulb,
  Radio,
  Megaphone,
  Gauge,
  CheckCircle,
  LifeBuoy,
  Layers,
  MapPin,
  Contact,
} from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

interface PageLink {
  name: string;
  path: string;
  description: string;
  icon: React.ElementType;
}

interface ModuleSection {
  title: string;
  description: string;
  icon: React.ElementType;
  pages: PageLink[];
  badge?: "Essential" | "System Admin" | "Public";
}

/**
 * Directory of every routable page in the app. Keep this in sync with the
 * route table in client/App.tsx: only paths that exist there belong here.
 */
export default function AppPages() {
  const modules: ModuleSection[] = [
    {
      title: "Jobs & Media",
      description: "Day-to-day job management, photos and documents",
      icon: FolderOpen,
      badge: "Essential",
      pages: [
        { name: "Jobs", path: "/admin/jobs", description: "All jobs for the current business", icon: FolderOpen },
        { name: "Add Job", path: "/admin/add-job", description: "Create a new job", icon: Plus },
        { name: "Job Detail", path: "/job/:id", description: "Photos, documents, tasks and activity for one job", icon: FileText },
        { name: "Gallery", path: "/admin/gallery", description: "Photo and video gallery across all jobs", icon: Camera },
        { name: "Public Job Page", path: "/public/job/:id", description: "Shareable public view of a job", icon: Globe },
        { name: "Public Gallery", path: "/g/:token", description: "Shareable gallery link", icon: Camera },
      ],
    },
    {
      title: "Clients & Reviews",
      description: "Customer records and review collection",
      icon: Star,
      badge: "Essential",
      pages: [
        { name: "Clients", path: "/admin/clients", description: "Client list", icon: Contact },
        { name: "Client Detail", path: "/admin/clients/:id", description: "One client's jobs, notes and contact info", icon: User },
        { name: "Reviews", path: "/admin/reviews", description: "Review requests and submitted reviews", icon: Star },
        { name: "Review Detail", path: "/admin/reviews/:id", description: "Respond to a single review", icon: MessageSquare },
        { name: "Review Gate Editor", path: "/admin/review-gate-editor", description: "Customize the customer review page", icon: Settings },
        { name: "Review Gate (customer)", path: "/review/:id", description: "Public page customers land on from a review request", icon: Globe },
        { name: "GMB Optimization", path: "/admin/gmb-optimization", description: "Google Business Profile audit and content", icon: MapPin },
      ],
    },
    {
      title: "Automation",
      description: "Workflows and triggers",
      icon: Bot,
      pages: [
        { name: "Automations", path: "/admin/automations", description: "Workflow list and execution history", icon: Zap },
        { name: "Workflow Builder", path: "/admin/workflow-builder", description: "Build a new workflow", icon: Workflow },
        { name: "Edit Workflow", path: "/admin/workflow-builder/:id", description: "Edit an existing workflow", icon: Workflow },
      ],
    },
    {
      title: "Account",
      description: "Profile, settings and billing",
      icon: Settings,
      pages: [
        { name: "Profile", path: "/admin/profile", description: "Your user profile", icon: User },
        { name: "Settings", path: "/admin/settings", description: "Business settings", icon: Settings },
        { name: "Payments", path: "/admin/payments", description: "Billing and payments", icon: CreditCard },
        { name: "Crash Logs", path: "/admin/crash-logs", description: "Client-side error reports", icon: AlertTriangle },
        { name: "App Pages", path: "/admin/app-pages", description: "This directory", icon: Layers },
      ],
    },
    {
      title: "Help & Community",
      description: "Support, knowledge base and feature ideas",
      icon: HelpCircle,
      pages: [
        { name: "Support", path: "/support", description: "Open and track support tickets", icon: LifeBuoy },
        { name: "Knowledge Base", path: "/knowledge-base", description: "Help articles", icon: BookOpen },
        { name: "Ideas", path: "/ideas", description: "Feature requests and voting", icon: Lightbulb },
        { name: "Idea Detail", path: "/ideas/:id", description: "Discussion on a single idea", icon: MessageSquare },
      ],
    },
    {
      title: "Authentication",
      description: "Sign in and account recovery",
      icon: Lock,
      badge: "Public",
      pages: [
        { name: "Login", path: "/login", description: "Sign in", icon: Lock },
        { name: "Sign Up", path: "/signup", description: "Create an account", icon: Plus },
        { name: "Forgot Password", path: "/forgot-password", description: "Reset your password", icon: HelpCircle },
      ],
    },
    {
      title: "Super Admin",
      description: "Platform-wide administration",
      icon: Shield,
      badge: "System Admin",
      pages: [
        { name: "Super Admin Dashboard", path: "/super-admin", description: "Platform overview", icon: Home },
        { name: "Businesses", path: "/super-admin/businesses", description: "All businesses on the platform", icon: Building2 },
        { name: "Business Detail", path: "/super-admin/business/:businessId", description: "One business's details", icon: Building2 },
        { name: "Workspaces", path: "/super-admin/workspaces", description: "Workspace list", icon: Layers },
        { name: "Workspace Detail", path: "/super-admin/workspaces/:id", description: "One workspace", icon: Layers },
        { name: "Users", path: "/super-admin/users", description: "All platform users", icon: Users },
        { name: "Staff", path: "/super-admin/staff", description: "Internal staff accounts", icon: Users },
        { name: "Segments", path: "/super-admin/segments", description: "User segments", icon: Target },
        { name: "Leads", path: "/super-admin/leads", description: "Inbound leads", icon: Contact },
        { name: "Ideas", path: "/super-admin/ideas", description: "Moderate feature ideas", icon: Lightbulb },
        { name: "Broadcast", path: "/super-admin/broadcast", description: "Platform-wide announcements", icon: Megaphone },
        { name: "Communications", path: "/super-admin/communications", description: "Outbound communications", icon: Radio },
        { name: "Message Templates", path: "/super-admin/templates", description: "Reusable message templates", icon: FileText },
        { name: "Email Integration", path: "/super-admin/email", description: "Email provider configuration", icon: Mail },
        { name: "Automation", path: "/super-admin/automation", description: "Platform automation", icon: Bot },
        { name: "Analytics", path: "/super-admin/analytics", description: "Platform analytics", icon: Activity },
        { name: "Performance", path: "/super-admin/performance", description: "System performance", icon: Gauge },
        { name: "Quality", path: "/super-admin/quality", description: "QA checks", icon: CheckCircle },
        { name: "Support", path: "/super-admin/support", description: "Support ticket queue", icon: LifeBuoy },
        { name: "Help Articles", path: "/super-admin/help", description: "Manage knowledge base", icon: BookOpen },
        { name: "Settings", path: "/super-admin/settings", description: "Platform settings", icon: Settings },
      ],
    },
  ];

  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case "Essential":
        return "bg-blue-100 text-blue-800";
      case "System Admin":
        return "bg-red-100 text-red-800";
      case "Public":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalPages = modules.reduce((acc, m) => acc + m.pages.length, 0);
  const directPages = modules.reduce(
    (acc, m) => acc + m.pages.filter((p) => !p.path.includes(":")).length,
    0,
  );

  return (
    <AppLayout>
      <div className="container px-4 py-6 max-w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">App Pages Directory</h1>
          <p className="text-muted-foreground">
            Every routable page in the application, grouped by area.
          </p>
        </div>

        <div className="grid gap-6">
          {modules.map((module) => (
            <Card key={module.title} className="w-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <module.icon className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {module.description}
                      </p>
                    </div>
                  </div>
                  {module.badge && (
                    <Badge className={getBadgeColor(module.badge)}>
                      {module.badge}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {module.pages.map((page) => {
                    const hasParam = page.path.includes(":");
                    return (
                      <div
                        key={page.path}
                        className="group border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <page.icon className="h-4 w-4 text-primary" />
                          <div className="flex-1 min-w-0">
                            {hasParam ? (
                              <span className="font-medium text-sm text-muted-foreground">
                                {page.name}
                              </span>
                            ) : (
                              <Link
                                to={page.path}
                                className="font-medium text-sm hover:text-primary transition-colors"
                              >
                                {page.name}
                              </Link>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {page.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {page.path}
                          </code>
                          {!hasParam && (
                            <Link to={page.path}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                              >
                                Visit
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{modules.length}</div>
                <div className="text-sm text-muted-foreground">Areas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalPages}</div>
                <div className="text-sm text-muted-foreground">Pages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{directPages}</div>
                <div className="text-sm text-muted-foreground">Directly linkable</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
              <code className="bg-muted px-2 py-1 rounded">:id</code>
              Pages with a parameter are opened from within the app (e.g. from a
              job or client list) rather than from this directory.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
