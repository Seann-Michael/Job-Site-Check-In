import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Plus,
  Filter,
  Download,
  RefreshCw,
  MoreHorizontal,
  Search,
  Bell,
  DollarSign,
  BarChart3,
  Target,
  Calendar,
  FileText,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import React from "react";

interface PageConfig {
  title: string;
  subtitle: string;
  icon: any;
  primaryAction?: {
    label: string;
    icon: any;
    href?: string;
    onClick?: () => void;
  };
  secondaryActions?: Array<{
    label: string;
    icon: any;
    href?: string;
    onClick?: () => void;
  }>;
  quickStats?: Array<{
    label: string;
    value: string;
    trend?: "up" | "down" | "neutral";
    color?: "default" | "success" | "warning" | "danger";
  }>;
  breadcrumbs: Array<{
    label: string;
    href?: string;
  }>;
}

export function ContextualHeader() {
  const location = useLocation();
  const [pageConfig, setPageConfig] = useState<PageConfig | null>(null);

  useEffect(() => {
    const config = getPageConfig(location.pathname);
    setPageConfig(config);
  }, [location.pathname]);

  if (!pageConfig) return null;

  const {
    title,
    subtitle,
    icon: PageIcon,
    primaryAction,
    secondaryActions,
    quickStats,
    breadcrumbs,
  } = pageConfig;

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"></div>
  );
}

function getPageConfig(pathname: string): PageConfig | null {
  // Mock data - in real app, this could come from an API or context
  const mockStats = {
    projects: { total: "23", active: "8", revenue: "$147K" },
    leads: { total: "15", qualified: "6", pipeline: "$89K" },
  };

  switch (true) {
    case pathname === "/admin/projects":
      return {
        title: "Projects",
        subtitle: "Manage your construction projects",
        icon: Target,
        primaryAction: {
          label: "New Project",
          icon: Plus,
          href: "/admin/add-project",
        },
        secondaryActions: [
          { label: "Export Data", icon: Download, onClick: () => {} },
          { label: "Filter Projects", icon: Filter, onClick: () => {} },
          { label: "Refresh", icon: RefreshCw, onClick: () => {} },
        ],
        quickStats: [
          { label: "Total", value: mockStats.projects.total },
          {
            label: "Active",
            value: mockStats.projects.active,
            color: "success",
          },
          {
            label: "Revenue",
            value: mockStats.projects.revenue,
            color: "success",
          },
        ],
        breadcrumbs: [
          { label: "Dashboard", href: "/admin/projects" },
          { label: "Projects" },
        ],
      };

    case pathname === "/admin/project-value":
      return {
        title: "Project Value & Revenue",
        subtitle: "Track project profitability and revenue",
        icon: DollarSign,
        primaryAction: {
          label: "Add Project Value",
          icon: Plus,
          onClick: () => {},
        },
        secondaryActions: [
          { label: "Financial Report", icon: FileText, onClick: () => {} },
          { label: "Profit Analysis", icon: BarChart3, onClick: () => {} },
          { label: "Export Data", icon: Download, onClick: () => {} },
        ],
        quickStats: [
          { label: "Total Revenue", value: "$247K", color: "success" },
          { label: "Profit Margin", value: "28.5%", color: "success" },
          { label: "Outstanding", value: "$45K", color: "warning" },
        ],
        breadcrumbs: [
          { label: "Dashboard", href: "/admin/projects" },
          { label: "Project Value" },
        ],
      };

    case pathname === "/admin/settings":
      return {
        title: "Settings",
        subtitle: "Configure your account and preferences",
        icon: Settings,
        secondaryActions: [
          { label: "Help & Support", icon: HelpCircle, href: "/admin/help" },
          {
            label: "Notification Preferences",
            icon: Bell,
            href: "/notification-preferences",
          },
        ],
        breadcrumbs: [
          { label: "Dashboard", href: "/admin/projects" },
          { label: "Settings" },
        ],
      };

    case pathname === "/admin/reports":
      return {
        title: "Reports",
        subtitle: "Generate and analyze business reports",
        icon: BarChart3,
        primaryAction: {
          label: "Schedule Report",
          icon: Calendar,
          onClick: () => {},
        },
        secondaryActions: [
          { label: "Export Data", icon: Download, onClick: () => {} },
          { label: "Report Settings", icon: Settings, onClick: () => {} },
        ],
        breadcrumbs: [
          { label: "Dashboard", href: "/admin/projects" },
          { label: "Reports" },
        ],
      };

    case pathname === "/admin/gallery":
      return {
        title: "Gallery",
        subtitle: "Manage your project photos and media",
        icon: FileText,
        primaryAction: {
          label: "Upload Photos",
          icon: Plus,
          onClick: () => {},
        },
        secondaryActions: [
          { label: "Organize Albums", icon: Filter, onClick: () => {} },
          { label: "Download All", icon: Download, onClick: () => {} },
        ],
        breadcrumbs: [
          { label: "Dashboard", href: "/admin/projects" },
          { label: "Gallery" },
        ],
      };

    case pathname === "/admin/reviews":
      return {
        title: "Reviews",
        subtitle: "Manage customer reviews and feedback",
        icon: BarChart3,
        primaryAction: {
          label: "Request Review",
          icon: Plus,
          onClick: () => {},
        },
        secondaryActions: [
          { label: "Review Analytics", icon: BarChart3, onClick: () => {} },
          { label: "Export Reviews", icon: Download, onClick: () => {} },
        ],
        breadcrumbs: [
          { label: "Dashboard", href: "/admin/projects" },
          { label: "Reviews" },
        ],
      };

    default:
      return null;
  }
}
