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

import { ContextualHeader } from "@/components/ContextualHeader";
import { HeaderSearch } from "@/components/SmartSearch";
import { ThemeToggle } from "@/components/ThemeProvider";
import { AppNotifications } from "@/components/UpdateNotification";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { Footer } from "@/components/Footer";
import { CreditProvider } from "@/components/CreditProvider";
import { CreditDisplay } from "@/components/CreditDisplay";

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
  MessageSquare,
  BarChart3,
  FileText,
  Zap,
  Clock,
  Target,
  TrendingUp,
  MapPin,
  Calendar,
  CreditCard,
  Globe,
  Smartphone,
  Monitor,
  Menu,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import React, { useState, useEffect, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from "@/lib/auth";
import { toast } from "sonner";

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
  const [auditsDropdownOpen, setAuditsDropdownOpen] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Check if current user is a superadmin (but exclude impersonated accounts)
  const showSuperAdmin =
    currentUser?.role === "superadmin" && !currentUser?.isImpersonated;

  // Load business name and zoom level on mount and listen for changes
  useEffect(() => {
    const loadBusinessName = () => {
      const name = localStorage.getItem("business_name") || "Local SEO Ranker";
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

  // Business switching temporarily disabled

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    document.body.style.zoom = `${newZoom}%`;
    localStorage.setItem("system_zoom", newZoom.toString());
    toast.success(`Zoom set to ${newZoom}%`);
  };

  // Navigation items with conditional visibility
  const navigationItems: NavItem[] = [
    {
      label: "Projects",
      href: "/admin/projects",
      icon: FolderOpen,
      isActive: location.pathname === "/admin/projects" || location.pathname.startsWith("/project"),
    },
    {
      label: "Gallery",
      href: "/admin/gallery",
      icon: Camera,
      isActive: location.pathname === "/admin/gallery",
    },
    {
      label: "Reports",
      href: "/admin/reports",
      icon: BarChart3,
      isActive: location.pathname === "/admin/reports",
    },
    {
      label: "Audits",
      href: "/admin/audits",
      icon: Shield,
      isActive: location.pathname.startsWith("/admin/audits"),
    },
    {
      label: "Maps",
      href: "/admin/maps",
      icon: MapPin,
      isActive: location.pathname.startsWith("/admin/maps"),
    },
    {
      label: "Settings",
      href: "/admin/settings",
      icon: Settings,
      isActive: location.pathname === "/admin/settings",
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
      <div className="min-h-screen bg-gray-50">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        {showSidebar && (
          <aside
            className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300 md:relative md:translate-x-0 ${
              sidebarCollapsed ? "w-16" : "w-64"
            } ${
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } md:translate-x-0`}
          >
            <div className="flex flex-col h-full">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-4 border-b">
                {!sidebarCollapsed && (
                  <h1 className="text-xl font-bold text-gray-900">
                    {businessName}
                  </h1>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden md:flex"
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="md:hidden"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-4 space-y-2">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      item.isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-gray-700 hover:bg-gray-100"
                    } ${sidebarCollapsed ? "justify-center" : ""}`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                ))}
              </nav>

              {/* Sidebar Footer */}
              <div className="p-4 border-t">
                {!sidebarCollapsed && (
                  <div className="text-xs text-gray-500 text-center">
                    Local SEO Ranker v2.0
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <div
          className={`min-h-screen transition-all duration-300 ${
            showSidebar
              ? sidebarCollapsed
                ? "md:ml-16"
                : "md:ml-64"
              : ""
          }`}
        >
          {/* Header */}
          {showHeader && (
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  {/* Mobile Menu Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>

                  {/* Breadcrumbs */}
                  {breadcrumbs.length > 0 && (
                    <Breadcrumb>
                      <BreadcrumbList>
                        {breadcrumbs.map((crumb, index) => (
                          <React.Fragment key={index}>
                            <BreadcrumbItem>
                              {crumb.href ? (
                                <BreadcrumbLink href={crumb.href}>
                                  {crumb.label}
                                </BreadcrumbLink>
                              ) : (
                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                              )}
                            </BreadcrumbItem>
                            {index < breadcrumbs.length - 1 && (
                              <BreadcrumbSeparator />
                            )}
                          </React.Fragment>
                        ))}
                      </BreadcrumbList>
                    </Breadcrumb>
                  )}

                  {/* Page Title */}
                  {title && !breadcrumbs.length && (
                    <h1 className="text-xl font-semibold text-gray-900">
                      {title}
                    </h1>
                  )}
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <HeaderSearch />

                  {/* Notifications */}
                  <NotificationDropdown />

                  {/* Credit Display */}
                  <CreditDisplay />

                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* User Menu - Simplified */}
                  <Link to="/admin/profile">
                    <Button variant="ghost" size="icon">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={currentUser?.avatar} />
                        <AvatarFallback className="text-xs">
                          {currentUser?.name ? (
                            currentUser.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </Link>

                  {/* Custom Actions */}
                  {actions}
                </div>
              </div>
            </header>
          )}

          {/* Page Content */}
          <main className={`${maxWidthClass} mx-auto ${className}`}>
            {children}
          </main>

          {/* Footer */}
          {showFooter && <Footer />}
        </div>

        {/* App Notifications */}
        <AppNotifications />
      </div>
    </CreditProvider>
  );
}
