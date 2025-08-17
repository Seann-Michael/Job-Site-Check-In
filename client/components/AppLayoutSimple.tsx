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
  X,
  Menu,
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
  Maximize2,
  Minimize2,
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

  // Load business name on mount and listen for changes
  useEffect(() => {
    const loadBusinessName = () => {
      const name = localStorage.getItem("business_name") || "Local SEO Ranker";
      setBusinessName(name);
    };

    loadBusinessName();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "business_name") {
        setBusinessName(e.newValue || "My Business");
      }
    };

    const handleBusinessNameChange = (e: CustomEvent) => {
      setBusinessName(e.detail || "My Business");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "businessNameChanged",
      handleBusinessNameChange as EventListener,
    );

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

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  // Navigation items with conditional visibility
  const sidebarItems = [
    {
      id: "projects",
      label: "Projects",
      href: "/admin/projects",
      icon: FolderOpen,
      active: location.pathname === "/admin/projects" || location.pathname.startsWith("/project"),
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
      id: "reports",
      label: "Reports",
      href: "/admin/reports",
      icon: BarChart3,
      active: location.pathname === "/admin/reports",
      comingSoon: false,
    },
    {
      id: "audits",
      label: "Audits",
      href: "/admin/audits",
      icon: Shield,
      active: location.pathname.startsWith("/admin/audits"),
      comingSoon: false,
    },
    {
      id: "maps",
      label: "Maps",
      href: "/admin/maps/geo-grid-scan",
      icon: MapPin,
      active: location.pathname.startsWith("/admin/maps"),
      comingSoon: false,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/admin/settings",
      icon: Settings,
      active: location.pathname === "/admin/settings",
      comingSoon: false,
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex w-full">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm touch-none"
          onClick={() => setMobileSidebarOpen(false)}
          onTouchStart={(e) => e.preventDefault()}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-[70] w-60 bg-card border-r shadow-lg transform transition-transform duration-300 flex flex-col",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Mobile Sidebar Header */}
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="font-bold text-base text-foreground">
                  {businessName}
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
        </div>

        {/* Mobile Sidebar Items */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {sidebarItems.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                item.active
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
          ))}
        </div>

        {/* Mobile Sidebar Footer */}
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground text-center">
            Local SEO Ranker v2.0
          </div>
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
                "p-4 border-b bg-primary/5 flex items-center",
                sidebarCollapsed ? "justify-center" : "justify-between",
              )}
            >
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                    <Building2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-foreground">
                      {businessName}
                    </span>
                    <p className="text-xs text-muted-foreground">Pro Plan</p>
                  </div>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
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

            {/* Desktop Sidebar Items */}
            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {sidebarItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    sidebarCollapsed ? "justify-center" : "",
                    item.active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.comingSoon && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Soon
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop Sidebar Footer */}
            <div className="p-4 border-t">
              {!sidebarCollapsed && (
                <div className="text-xs text-muted-foreground text-center">
                  Local SEO Ranker v2.0
                </div>
              )}
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
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
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
                {/* Simplified User Menu */}
                <Link to="/admin/profile">
                  <Button variant="ghost" size="icon">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser?.avatar} />
                      <AvatarFallback className="text-xs">
                        {currentUser?.name ? (
                          currentUser.name
                            .split(" ")
                            .filter(n => n && n.length > 0)
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
        <main className="flex-1 overflow-auto w-full">
          <div
            className="w-full mobile-bottom-safe"
            style={{ minWidth: "max-content" }}
          >
            {children}
          </div>
        </main>

        {/* Simple Footer */}
        {showFooter && (
          <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-center px-4">
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <span>© 2025 Local SEO Ranker. All rights reserved.</span>
              </div>
            </div>
          </footer>
        )}

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden border-t bg-background p-2 mobile-bottom-safe">
          <div className="grid grid-cols-4 gap-1">
            {sidebarItems.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className={cn(
                  "flex flex-col items-center space-y-1 px-2 py-3 rounded-lg text-xs font-medium transition-colors min-h-[60px] justify-center",
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
