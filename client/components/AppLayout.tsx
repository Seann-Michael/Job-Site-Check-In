import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ContextualHeader } from "@/components/ContextualHeader";
import { HeaderSearch } from "@/components/SmartSearch";
import { ThemeToggle } from "@/components/ThemeProvider";
import { AppNotifications } from "@/components/UpdateNotification";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { Footer } from "@/components/Footer";
import { CreditProvider, useCredits } from "@/components/CreditProvider";
import { CompanySelector } from "@/components/CompanySelector";

import {
  Shield,
  Users,
  FolderOpen,
  Camera,
  Star,
  Settings,
  Search,
  Bell,
  User,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Home,
  Building2,
  MapPin,
  X,
  Menu,
  BarChart3,
  FileText,
  Zap,
  Clock,
  Target,
  TrendingUp,
  Database,
  Calendar,
  CreditCard,
  HelpCircle,
  Globe,
  Smartphone,
  Monitor,
  Maximize2,
  Minimize2,
  Wrench,
  Bot,
  UserCheck,
  Lightbulb,
  Share2,
} from "lucide-react";
import React, { useState, useEffect, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  actions?: ReactNode;
  showHeader?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isActive?: boolean;
  children?: NavItem[];
}

// Credit Balance Component
function CreditBalance({ collapsed }: { collapsed: boolean }) {
  const { balance, isLoading } = useCredits();

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center p-2 bg-muted/50 rounded-lg",
          collapsed ? "" : "space-x-2",
        )}
      >
        <div className="animate-pulse h-4 w-4 bg-muted-foreground/50 rounded"></div>
        {!collapsed && (
          <div className="animate-pulse h-3 w-16 bg-muted-foreground/50 rounded"></div>
        )}
      </div>
    );
  }

  const formatCredits = (credits: number) => {
    if (credits >= 1000000) {
      return `${(credits / 1000000).toFixed(1)}M`;
    } else if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}K`;
    }
    return credits.toString();
  };

  return (
    <div
      className={cn(
        "flex items-center p-2 bg-primary/10 rounded-lg border",
        collapsed ? "justify-center" : "justify-between",
      )}
    >
      <div className="flex items-center space-x-2">
        <CreditCard className="h-4 w-4 text-primary" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">
              {formatCredits(balance.remaining)} credits
            </span>
            <span className="text-xs text-muted-foreground">
              of {formatCredits(balance.total)}
            </span>
          </div>
        )}
      </div>
      {!collapsed && balance.remaining < balance.total * 0.2 && (
        <Badge variant="destructive" className="text-xs px-1 py-0">
          Low
        </Badge>
      )}
    </div>
  );
}

export function AppLayout({
  children,
  title,
  description,
  breadcrumbs = [],
  actions,
  showHeader = true,
  showSidebar = true,
  showFooter = true,
  maxWidth = "full",
  className = "",
}: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Check if current user is a superadmin (but exclude impersonated accounts)
  const showSuperAdmin =
    currentUser?.role === "superadmin" && !currentUser?.isImpersonated;

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  // Load business name and zoom level on mount and listen for changes
  useEffect(() => {
    const loadBusinessName = () => {
      const name = localStorage.getItem("business_name") || "Waypoint";
      console.log("Loading business name:", name);
      setBusinessName(name);
    };

    const loadZoomLevel = () => {
      const savedZoom = localStorage.getItem("system_zoom");
      if (savedZoom) {
        const zoom = parseInt(savedZoom);
        setZoomLevel(zoom);
        document.body.style.zoom = `${zoom}%`;
      }
    };

    // Load initially
    loadBusinessName();
    loadZoomLevel();

    // Listen for storage changes (in case updated from another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "business_name") {
        setBusinessName(e.newValue || "My Business");
      }
    };

    // Listen for custom business name change events (same tab updates)
    const handleBusinessNameChange = (e: CustomEvent) => {
      setBusinessName(e.detail || "My Business");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "businessNameChanged",
      handleBusinessNameChange as EventListener,
    );

    // Clean up listeners
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "businessNameChanged",
        handleBusinessNameChange as EventListener,
      );
    };
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileSidebarOpen]);

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    document.body.style.zoom = `${newZoom}%`;
    localStorage.setItem("system_zoom", newZoom.toString());
    toast.success(`Zoom set to ${newZoom}%`);
  };

  const toggleMenuExpansion = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId],
    );
  };

  const isMenuExpanded = (menuId: string) => {
    return expandedMenus.includes(menuId);
  };

  // Auto-expand Automation menu if we're on an automation page
  React.useEffect(() => {
    if (
      (location.pathname.startsWith("/admin/automation") ||
        location.pathname.startsWith("/admin/workflow-builder")) &&
      !expandedMenus.includes("automation")
    ) {
      setExpandedMenus((prev) => [...prev, "automation"]);
    }
  }, [location.pathname, expandedMenus]);


  // Auto-expand Tools menu if we're on tools pages
  React.useEffect(() => {
    if (
      location.pathname.startsWith("/admin/tools") &&
      !expandedMenus.includes("tools")
    ) {
      setExpandedMenus((prev) => [...prev, "tools"]);
    }
  }, [location.pathname, expandedMenus]);

  // Navigation items with conditional visibility
  const sidebarItems = [
    {
      id: "projects",
      label: "Projects",
      href: "/admin/projects",
      icon: FolderOpen,
      active:
        location.pathname === "/admin/projects" ||
        location.pathname.startsWith("/project"),
      comingSoon: false,
    },
    {
      id: "gallery",
      label: "Gallery",
      href: "/admin/gallery",
      icon: Camera,
      active: location.pathname === "/admin/gallery",
      comingSoon: false,
    },
    {
      id: "reviews",
      label: "Reviews",
      href: "", // No direct href - uses dropdown
      icon: Star,
      active: location.pathname.startsWith("/admin/reviews"),
      comingSoon: false,
      subItems: [
        {
          id: "reviews-dashboard",
          label: "Dashboard",
          href: "/admin/reviews",
          active: location.pathname === "/admin/reviews",
        },
        {
          id: "reviews-activity",
          label: "Activity",
          href: "/admin/reviews/activity",
          active: location.pathname.startsWith("/admin/reviews/activity"),
        },
      ],
    },
    {
      id: "automation",
      label: "Automation",
      href: "", // Remove direct href to enable dropdown
      icon: Zap,
      active: location.pathname.startsWith("/admin/automation"),
      comingSoon: false,
      subItems: [
        {
          id: "automations",
          label: "Automations",
          href: "/admin/automations",
          active: location.pathname === "/admin/automations",
        },
        {
          id: "workflow-builder",
          label: "Workflow Builder",
          href: "/admin/workflow-builder",
          active: location.pathname.startsWith("/admin/workflow-builder"),
        },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      href: "", // No direct href - dropdown placeholder
      icon: Wrench,
      active:
        location.pathname.startsWith("/admin/tools") ||
        location.pathname.startsWith("/admin/gmb-optimization"),
      comingSoon: false,
      subItems: [
        {
          id: "gmb-optimization",
          label: "GMB Optimization",
          href: "/admin/gmb-optimization",
          active: location.pathname.startsWith("/admin/gmb-optimization"),
        },
      ],
    },
    {
      id: "social-posting",
      label: "Social Posting",
      href: "/admin/social-posting",
      icon: Share2,
      active: location.pathname === "/admin/social-posting",
      comingSoon: false,
    },
    {
      id: "reports",
      label: "Reports",
      href: "/admin/reports",
      icon: BarChart3,
      active: location.pathname === "/admin/reports",
      comingSoon: false,
    },
  ];

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <CreditProvider>
      <div className="min-h-[100dvh] bg-background flex w-full">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={cn(
            "md:hidden fixed inset-y-0 left-0 z-[110] w-60 bg-card border-r shadow-lg transform transition-transform duration-300 flex flex-col max-h-[100svh] overflow-y-auto scrolling-touch pb-[env(safe-area-inset-bottom)]",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Mobile Sidebar Header */}
          <div className="border-b bg-primary/5">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="font-bold text-base text-foreground">
                    Local SEO Ranker
                  </span>
                  <p className="text-xs text-muted-foreground">Pro Plan</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileSidebarOpen(false)}
                className="h-10 w-10 min-h-[44px] min-w-[44px] hover:bg-muted text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {/* Company Selector for Mobile */}
            <CompanySelector collapsed={false} />
          </div>

          {/* Mobile Sidebar Items */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            {sidebarItems.map((item) => (
              <div key={item.id}>
                {/* Main Menu Item */}
                <div className="flex items-center">
                  {item.href && !item.subItems ? (
                    <Link
                      to={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex-1",
                        item.active && !item.subItems?.some((sub) => sub.active)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.comingSoon && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Soon
                        </Badge>
                      )}
                    </Link>
                  ) : (
                    <div
                      onClick={() => {
                        if (item.subItems) {
                          toggleMenuExpansion(item.id);
                        } else if (item.href) {
                          window.location.href = item.href;
                          setMobileSidebarOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex-1 cursor-pointer",
                        item.active && !item.subItems?.some((sub) => sub.active)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.comingSoon && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Soon
                        </Badge>
                      )}
                    </div>
                  )}
                  {/* Expand/Collapse Button for items with subItems */}
                  {item.subItems && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMenuExpansion(item.id)}
                      className="h-8 w-8 p-0 ml-1"
                    >
                      {isMenuExpanded(item.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Sub Menu Items */}
                {item.subItems && isMenuExpanded(item.id) && (
                  <div className="ml-6 pl-6 mt-2 space-y-1 border-l-2 border-muted">
                    {item.subItems.map((subItem) => (
                      <Link
                        key={subItem.id}
                        to={subItem.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={cn(
                          "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px]",
                          subItem.active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        )}
                      >
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile Sidebar Footer */}
          <div className="p-4 border-t space-y-2">
            <div className="text-xs text-muted-foreground text-center">
              Local SEO Ranker v2.0
            </div>
            <CreditBalance collapsed={false} />
          </div>
        </div>

        {/* Desktop Sidebar */}
        {showSidebar && (
          <div
            className={cn(
              "hidden md:block md:fixed md:inset-y-0 md:left-0 bg-card border-r shadow-sm transition-all duration-300 z-20",
              sidebarCollapsed ? "md:w-16" : "md:w-60",
            )}
          >
            <div className="flex flex-col h-full">
              {/* Desktop Sidebar Header */}
              <div
                className={cn(
                  "p-4 bg-primary/5 flex items-center",
                  sidebarCollapsed
                    ? "justify-center border-b"
                    : "justify-between",
                )}
              >
                {!sidebarCollapsed && (
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                      <MapPin className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <span className="font-bold text-base text-foreground">
                        Local SEO Ranker
                      </span>
                      <p className="text-xs text-muted-foreground">Pro Plan</p>
                    </div>
                  </div>
                )}
                {sidebarCollapsed && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                    <MapPin className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="h-8 w-8 hover:bg-muted"
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Company Selector for Desktop */}
              <CompanySelector collapsed={sidebarCollapsed} />

              {/* Desktop Sidebar Items */}
              <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                {sidebarItems.map((item) => (
                  <div key={item.id}>
                    {/* Main Menu Item */}
                    <div className="flex items-center">
                      {item.href && !item.subItems ? (
                        <Link
                          to={item.href}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1",
                            sidebarCollapsed ? "justify-center" : "",
                            item.active &&
                              !item.subItems?.some((sub) => sub.active)
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {!sidebarCollapsed && (
                            <>
                              <span>{item.label}</span>
                              {item.comingSoon && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto text-xs"
                                >
                                  Soon
                                </Badge>
                              )}
                            </>
                          )}
                        </Link>
                      ) : (
                        <div
                          onClick={() => {
                            if (item.subItems) {
                              toggleMenuExpansion(item.id);
                            } else if (item.href) {
                              window.location.href = item.href;
                            }
                          }}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 cursor-pointer",
                            sidebarCollapsed ? "justify-center" : "",
                            item.active &&
                              !item.subItems?.some((sub) => sub.active)
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {!sidebarCollapsed && (
                            <>
                              <span>{item.label}</span>
                              {item.comingSoon && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto text-xs"
                                >
                                  Soon
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {/* Expand/Collapse Button for items with subItems */}
                      {item.subItems && !sidebarCollapsed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMenuExpansion(item.id)}
                          className="h-8 w-8 p-0 ml-1"
                        >
                          {isMenuExpanded(item.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Sub Menu Items */}
                    {item.subItems &&
                      !sidebarCollapsed &&
                      isMenuExpanded(item.id) && (
                        <div className="ml-6 pl-6 mt-2 space-y-1 border-l-2 border-muted">
                          {item.subItems.map((subItem) => (
                            <Link
                              key={subItem.id}
                              to={subItem.href}
                              className={cn(
                                "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                subItem.active
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                              )}
                            >
                              <span>{subItem.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Desktop Sidebar Footer */}
              <div className="p-4 border-t space-y-2">
                {!sidebarCollapsed && (
                  <div className="text-xs text-muted-foreground text-center">
                    Local SEO Ranker v2.0
                  </div>
                )}
                <CreditBalance collapsed={sidebarCollapsed} />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div
          className={cn(
            "flex-1 flex flex-col transition-all duration-300 min-w-0",
            sidebarCollapsed ? "md:ml-16" : "md:ml-60",
          )}
        >
          {/* Header */}
          {showHeader && (
            <header className="sticky top-0 z-[100] bg-background border-b">
              <div className="flex h-16 items-center gap-4 px-4">
                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-10 w-10 min-h-[44px] min-w-[44px]"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>

                {/* Breadcrumbs */}
                {breadcrumbs.length > 0 && (
                  <Breadcrumb className="hidden md:flex">
                    <BreadcrumbList>
                      {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && <BreadcrumbSeparator />}
                          <BreadcrumbItem>
                            {crumb.href ? (
                              <BreadcrumbLink href={crumb.href}>
                                {crumb.label}
                              </BreadcrumbLink>
                            ) : (
                              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            )}
                          </BreadcrumbItem>
                        </React.Fragment>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                )}

                {/* Page Title */}
                {title && !breadcrumbs.length && (
                  <h1 className="text-xl font-semibold text-foreground">
                    {title}
                  </h1>
                )}

                {/* Header Actions */}
                <div className="ml-auto flex items-center space-x-2">
                  {/* Search */}
                  <HeaderSearch />

                  {/* Notifications */}
                  <NotificationDropdown />

                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={currentUser?.avatar} />
                          <AvatarFallback className="text-xs">
                            {currentUser?.name ? (
                              currentUser.name
                                .split(" ")
                                .filter((n) => n && n.length > 0)
                                .map((n) => n[0])
                                .join("")
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56"
                      align="end"
                      forceMount
                    >
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {currentUser?.name || "User"}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {currentUser?.email || "user@example.com"}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin/profile" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          <span>Profile</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/help" className="cursor-pointer">
                          <HelpCircle className="mr-2 h-4 w-4" />
                          <span>Help</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/ideas" className="cursor-pointer">
                          <Lightbulb className="mr-2 h-4 w-4" />
                          <span>Ideas</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Custom Actions */}
                  {actions}
                </div>
              </div>
            </header>
          )}

          {/* Page Content */}
          <main className="flex-1 flex flex-col overflow-auto w-full">
            <div className="flex-1 w-full mobile-bottom-safe">{children}</div>

            {/* Footer - Always at bottom */}
            {showFooter && <Footer />}
          </main>
        </div>

        {/* App Notifications */}
        <AppNotifications />
      </div>
    </CreditProvider>
  );
}
