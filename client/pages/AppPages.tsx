import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  FolderOpen,
  Plus,
  Edit,
  Camera,
  BarChart3,
  Settings,
  Users,
  Building2,
  Shield,
  CreditCard,
  Search,
  FileText,
  Bell,
  MessageSquare,
  HelpCircle,
  Star,
  Activity,
  Map,
  Bot,
  Workflow,
  Monitor,
  Target,
  LineChart,
  BookOpen,
  Code,
  Database,
  Mail,
  Phone,
  Calendar,
  Filter,
  Download,
  Upload,
  Archive,
  Trash2,
  Eye,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Globe,
  Zap,
} from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

interface PageLink {
  name: string;
  path: string;
  description: string;
  icon: React.ElementType;
  status?: "active" | "coming-soon" | "deprecated";
}

interface ModuleSection {
  title: string;
  description: string;
  icon: React.ElementType;
  pages: PageLink[];
  badge?: string;
}

export default function AppPages() {
  const modules: ModuleSection[] = [
    {
      title: "Core Dashboard",
      description: "Main application dashboards and home pages",
      icon: Home,
      badge: "Essential",
      pages: [
        {
          name: "Home Dashboard",
          path: "/",
          description: "Main dashboard with overview",
          icon: Home,
        },
        {
          name: "Admin Projects",
          path: "/admin/projects",
          description: "Project management dashboard",
          icon: FolderOpen,
        },
        {
          name: "Gallery",
          path: "/admin/gallery",
          description: "Photo gallery and media management",
          icon: Camera,
        },
      ],
    },
    {
      title: "Project Management",
      description: "Project creation, editing, and management",
      icon: FolderOpen,
      pages: [
        {
          name: "Add Project",
          path: "/admin/projects/add",
          description: "Create new project",
          icon: Plus,
        },
        {
          name: "Project Detail",
          path: "/admin/projects/:id",
          description: "View project details (requires ID)",
          icon: Eye,
        },
        {
          name: "Edit Project",
          path: "/admin/projects/:id/edit",
          description: "Edit project (requires ID)",
          icon: Edit,
        },
        {
          name: "Public Project",
          path: "/public/project/:id",
          description: "Public project view (requires ID)",
          icon: Globe,
        },
      ],
    },
    {
      title: "Analytics & Reports",
      description: "Business intelligence and reporting tools",
      icon: BarChart3,
      pages: [
        {
          name: "Reports",
          path: "/admin/reports",
          description: "Main reports dashboard",
          icon: FileText,
        },
        {
          name: "Basic Report Generator",
          path: "/admin/reports/generator",
          description: "Generate custom reports",
          icon: LineChart,
        },
        {
          name: "Audits",
          path: "/admin/audits",
          description: "Audit dashboard",
          icon: Shield,
        },
        {
          name: "Audit Report",
          path: "/admin/audits/report",
          description: "Detailed audit reports",
          icon: FileText,
        },
        {
          name: "One Time Scan",
          path: "/admin/audits/one-time",
          description: "Single audit scan",
          icon: Search,
        },
        {
          name: "Recurring Scans",
          path: "/admin/audits/recurring",
          description: "Scheduled audit scans",
          icon: Clock,
        },
        {
          name: "Scan History",
          path: "/admin/audits/scan-history",
          description: "Historical scan data",
          icon: Activity,
        },
      ],
    },
    {
      title: "Business Management",
      description: "Business profiles and management tools",
      icon: Building2,
      pages: [
        {
          name: "Business Management",
          path: "/admin/business-management",
          description: "Manage business profiles",
          icon: Building2,
        },
        {
          name: "Business Detail",
          path: "/admin/business/:id",
          description: "Business details (requires ID)",
          icon: Eye,
        },
        {
          name: "Grid Overlay Demo",
          path: "/admin/grid-overlay",
          description: "Map grid overlay demonstration",
          icon: Monitor,
        },
      ],
    },
    {
      title: "User Management",
      description: "User accounts, permissions, and administration",
      icon: Users,
      pages: [
        {
          name: "User Management",
          path: "/admin/user-management",
          description: "Manage user accounts",
          icon: Users,
        },
        {
          name: "Profile",
          path: "/admin/profile",
          description: "User profile management",
          icon: UserCheck,
        },
        {
          name: "Sign In",
          path: "/signin",
          description: "User authentication",
          icon: Lock,
        },
        {
          name: "Sign Up",
          path: "/signup",
          description: "User registration",
          icon: UserX,
        },
        {
          name: "Login",
          path: "/login",
          description: "Alternative login page",
          icon: Lock,
        },
        {
          name: "Forgot Password",
          path: "/forgot-password",
          description: "Password recovery",
          icon: Unlock,
        },
      ],
    },
    {
      title: "Agency Management",
      description: "Multi-tenant agency administration",
      icon: Shield,
      badge: "Enterprise",
      pages: [
        {
          name: "Agency Admin",
          path: "/agency/admin",
          description: "Main agency dashboard",
          icon: Shield,
        },
        {
          name: "Agency Analytics",
          path: "/agency/admin/analytics",
          description: "Agency performance metrics",
          icon: BarChart3,
        },
        {
          name: "Agency Reports",
          path: "/agency/admin/reports",
          description: "Agency reporting tools",
          icon: FileText,
        },
        {
          name: "Agency Audits",
          path: "/agency/admin/audits",
          description: "Agency audit management",
          icon: Search,
        },
        {
          name: "Agency Billing",
          path: "/agency/admin/billing",
          description: "Billing and invoicing",
          icon: CreditCard,
        },
        {
          name: "Agency Settings",
          path: "/agency/admin/settings",
          description: "Agency configuration",
          icon: Settings,
        },
        {
          name: "Client Management",
          path: "/agency/admin/clients",
          description: "Manage agency clients",
          icon: Users,
        },
        {
          name: "Add Agency Client",
          path: "/agency/admin/clients/add",
          description: "Add new client",
          icon: Plus,
        },
        {
          name: "Business Owners",
          path: "/agency/admin/business-owners",
          description: "Manage business owners",
          icon: Building2,
        },
        {
          name: "Admin Users",
          path: "/agency/admin/admin-users",
          description: "Manage admin users",
          icon: UserCheck,
        },
        {
          name: "Add Admin User",
          path: "/agency/admin/admin-users/add",
          description: "Add new admin user",
          icon: Plus,
        },
        {
          name: "Commission",
          path: "/agency/admin/commission",
          description: "Commission management",
          icon: DollarSign,
        },
        {
          name: "Agency Signup",
          path: "/agency/signup",
          description: "Agency registration",
          icon: Building2,
        },
      ],
    },
    {
      title: "Agency Projects",
      description: "Agency-specific project management",
      icon: FolderOpen,
      badge: "Enterprise",
      pages: [
        {
          name: "Agency Projects",
          path: "/agency/admin/projects",
          description: "Agency project dashboard",
          icon: FolderOpen,
        },
        {
          name: "Create Agency Project",
          path: "/agency/admin/projects/create",
          description: "Create agency project",
          icon: Plus,
        },
        {
          name: "Agency Project Detail",
          path: "/agency/admin/projects/:id",
          description: "Agency project details",
          icon: Eye,
        },
        {
          name: "Edit Agency Project",
          path: "/agency/admin/projects/:id/edit",
          description: "Edit agency project",
          icon: Edit,
        },
      ],
    },
    {
      title: "Super Admin",
      description: "System-wide administration and management",
      icon: Shield,
      badge: "System Admin",
      pages: [
        {
          name: "Super Admin",
          path: "/super-admin",
          description: "Main super admin dashboard",
          icon: Shield,
        },
        {
          name: "Agency Management",
          path: "/super-admin/agencies",
          description: "Manage all agencies",
          icon: Building2,
        },
        {
          name: "Super Admin Settings",
          path: "/super-admin/settings",
          description: "System settings",
          icon: Settings,
        },
        {
          name: "Super Admin Staff",
          path: "/super-admin/staff",
          description: "Manage staff members",
          icon: Users,
        },
        {
          name: "Super Admin Users",
          path: "/super-admin/users",
          description: "Manage all users",
          icon: UserCheck,
        },
        {
          name: "Super Admin Ideas",
          path: "/super-admin/ideas",
          description: "Feature request management",
          icon: MessageSquare,
        },
        {
          name: "Super Admin Broadcast",
          path: "/super-admin/broadcast",
          description: "System-wide messaging",
          icon: Bell,
        },
        {
          name: "Super Admin Templates",
          path: "/super-admin/templates",
          description: "Message templates",
          icon: FileText,
        },
        {
          name: "Super Admin Analytics",
          path: "/super-admin/analytics",
          description: "System analytics",
          icon: BarChart3,
        },
        {
          name: "Super Admin Automation",
          path: "/super-admin/automation",
          description: "System automation",
          icon: Bot,
        },
        {
          name: "Super Admin Segmentation",
          path: "/super-admin/segmentation",
          description: "User segmentation",
          icon: Filter,
        },
        {
          name: "Super Admin Email",
          path: "/super-admin/email",
          description: "Email integration",
          icon: Mail,
        },
        {
          name: "Super Admin API",
          path: "/super-admin/api",
          description: "API management",
          icon: Code,
        },
        {
          name: "Super Admin Performance",
          path: "/super-admin/performance",
          description: "Performance monitoring",
          icon: Activity,
        },
        {
          name: "Super Admin Quality",
          path: "/super-admin/quality",
          description: "Quality assurance",
          icon: CheckCircle,
        },
        {
          name: "Super Admin Help",
          path: "/super-admin/help",
          description: "Help system management",
          icon: HelpCircle,
        },
        {
          name: "Super Admin Support",
          path: "/super-admin/support",
          description: "Support management",
          icon: MessageSquare,
        },
        {
          name: "Super Admin Financial",
          path: "/super-admin/financial",
          description: "Financial management",
          icon: DollarSign,
        },
        {
          name: "Super Admin Communications",
          path: "/super-admin/communications",
          description: "Communication tools",
          icon: MessageSquare,
        },
      ],
    },
    {
      title: "Credits & Billing",
      description: "Credit system and payment management",
      icon: CreditCard,
      pages: [
        {
          name: "Credit Purchase",
          path: "/admin/credits/purchase",
          description: "Purchase credits",
          icon: CreditCard,
        },
        {
          name: "Credit History",
          path: "/admin/credits/history",
          description: "Credit usage history",
          icon: Activity,
        },
        {
          name: "Credit Analytics",
          path: "/admin/credits/analytics",
          description: "Credit analytics",
          icon: LineChart,
        },
      ],
    },
    {
      title: "Automation & Workflows",
      description: "Process automation and workflow management",
      icon: Bot,
      pages: [
        {
          name: "Automation",
          path: "/admin/automation",
          description: "Automation dashboard",
          icon: Bot,
        },
        {
          name: "Workflow Builder",
          path: "/admin/workflow",
          description: "Build custom workflows",
          icon: Workflow,
        },
      ],
    },
    {
      title: "Support & Help",
      description: "Customer support and knowledge base",
      icon: HelpCircle,
      pages: [
        {
          name: "Support",
          path: "/support",
          description: "Support dashboard",
          icon: HelpCircle,
        },
        {
          name: "Support Ticket Detail",
          path: "/support/ticket/:id",
          description: "Support ticket details",
          icon: MessageSquare,
        },
        {
          name: "Knowledge Base",
          path: "/knowledge-base",
          description: "Self-service help",
          icon: BookOpen,
        },
        {
          name: "Ideas",
          path: "/ideas",
          description: "Feature requests",
          icon: MessageSquare,
        },
        {
          name: "Idea Detail",
          path: "/ideas/:id",
          description: "Feature request details",
          icon: Eye,
        },
        {
          name: "Crash Logs",
          path: "/admin/crash-logs",
          description: "System error logs",
          icon: AlertTriangle,
        },
      ],
    },
    {
      title: "Reviews & Ratings",
      description: "Review management and rating systems",
      icon: Star,
      pages: [
        {
          name: "Review Gate",
          path: "/review-gate",
          description: "Review collection interface",
          icon: Star,
        },
        {
          name: "Admin Reviews",
          path: "/admin/reviews",
          description: "Review management",
          icon: Star,
        },
      ],
    },
    {
      title: "Settings & Configuration",
      description: "Application settings and preferences",
      icon: Settings,
      pages: [
        {
          name: "Settings",
          path: "/admin/settings",
          description: "Main application settings",
          icon: Settings,
        },
      ],
    },
    {
      title: "Testing & Development",
      description: "Development and testing tools",
      icon: Monitor,
      badge: "Development",
      pages: [
        {
          name: "Address Test",
          path: "/admin/address-test",
          description: "Address autocomplete testing",
          icon: Map,
        },
        {
          name: "Coming Soon",
          path: "/coming-soon",
          description: "Coming soon placeholder",
          icon: Clock,
        },
      ],
    },
    {
      title: "Error Pages",
      description: "Error handling and fallback pages",
      icon: AlertTriangle,
      pages: [
        {
          name: "Not Found (404)",
          path: "/404",
          description: "Page not found error",
          icon: AlertTriangle,
        },
      ],
    },
  ];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "coming-soon":
        return "bg-yellow-100 text-yellow-800";
      case "deprecated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case "Essential":
        return "bg-blue-100 text-blue-800";
      case "Enterprise":
        return "bg-purple-100 text-purple-800";
      case "System Admin":
        return "bg-red-100 text-red-800";
      case "Development":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <AppLayout>
      <div className="container px-4 py-6 max-w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">App Pages Directory</h1>
          <p className="text-muted-foreground">
            Complete directory of all application pages organized by module and
            user type. Use this to navigate and understand the system structure.
          </p>
        </div>

        <div className="grid gap-6">
          {modules.map((module, index) => (
            <Card key={index} className="w-full">
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
                  {module.pages.map((page, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="group border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <page.icon className="h-4 w-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          {page.path.includes(":") ? (
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
                        {page.status && (
                          <Badge
                            className={`text-xs ${getStatusColor(page.status)}`}
                          >
                            {page.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {page.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {page.path}
                        </code>
                        {!page.path.includes(":") && (
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
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {modules.length}
                </div>
                <div className="text-sm text-muted-foreground">Modules</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {modules.reduce(
                    (acc, module) => acc + module.pages.length,
                    0,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Total Pages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {modules.filter((m) => m.badge === "Enterprise").length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Enterprise Modules
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {modules.reduce(
                    (acc, module) =>
                      acc +
                      module.pages.filter((p) => !p.path.includes(":")).length,
                    0,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Accessible Pages
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Navigation Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Green badges indicate active, fully functional pages</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span>Yellow badges indicate pages that are coming soon</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>
                Red badges indicate deprecated or system admin only pages
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">:id</code>
              <span>Pages with parameters require specific IDs to access</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
