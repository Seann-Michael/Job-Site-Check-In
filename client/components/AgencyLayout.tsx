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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Users,
  Home,
  BarChart3,
  FileText,
  Globe,
  CreditCard,
  Briefcase,
  Settings,
  Search,
  Bell,
  User,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  UserCircle,
  MoreVertical,
  BookOpen,
  Menu,
  X,
  DollarSign,
  Monitor,
  Building2,
  UsersIcon,
  TrendingUp,
  Percent,
  FolderKanban,
  ClipboardCheck,
  Database,
  Link2,
  UserCheck,
} from "lucide-react";
import React, { useState, useEffect, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getCurrentUser,
  signOut,
  isSuperAdmin,
  getCurrentBusiness,
  getUserBusinesses,
  switchToBusiness,
  canSwitchBusinesses,
} from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AgencyLayoutProps {
  children: ReactNode;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Function to generate breadcrumbs based on current path for agency routes
function getAgencyBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const baseBreadcrumb: BreadcrumbItem = {
    label: "Dashboard",
    href: "/agency/admin/dashboard",
  };

  switch (pathname) {
    case "/agency/admin/dashboard":
      return [{ label: "Agency Dashboard" }];

    case "/agency/admin/clients":
    case "/agency/admin/business-owners":
      return [baseBreadcrumb, { label: "Business Owners" }];

    case "/agency/admin/clients/add":
    case "/agency/admin/business-owners/add":
      return [
        baseBreadcrumb,
        { label: "Business Owners", href: "/agency/admin/business-owners" },
        { label: "Add New" },
      ];

    case "/agency/admin/admin-users":
      return [baseBreadcrumb, { label: "Admin Users" }];

    case "/agency/admin/admin-users/add":
      return [
        baseBreadcrumb,
        { label: "Admin Users", href: "/agency/admin/admin-users" },
        { label: "Add New" },
      ];

    case "/agency/admin/commission":
      return [baseBreadcrumb, { label: "Commission" }];

    case "/agency/admin/analytics":
      return [baseBreadcrumb, { label: "Analytics" }];

    case "/agency/admin/reports":
      return [baseBreadcrumb, { label: "Reports" }];

    case "/agency/admin/billing":
      return [baseBreadcrumb, { label: "Billing" }];

    case "/agency/admin/settings":
      return [baseBreadcrumb, { label: "Settings" }];

    case "/agency/admin/help":
      return [baseBreadcrumb, { label: "Help Center" }];

    case "/agency/admin/projects":
      return [baseBreadcrumb, { label: "Projects" }];

    case "/agency/admin/projects/create":
      return [
        baseBreadcrumb,
        { label: "Projects", href: "/agency/admin/projects" },
        { label: "Create Project" },
      ];

    case "/agency/admin/tasks":
      return [baseBreadcrumb, { label: "Tasks" }];

    case "/agency/admin/client-access":
      return [baseBreadcrumb, { label: "Client Access" }];

    case "/agency/admin/client-access/create":
      return [
        baseBreadcrumb,
        { label: "Client Access", href: "/agency/admin/client-access" },
        { label: "Create Onboarding Link" },
      ];

    default:
      // Handle dynamic routes like /agency/admin/business-owners/:id
      if (
        pathname.includes("/agency/admin/business-owners/") &&
        pathname.includes("/edit")
      ) {
        return [
          baseBreadcrumb,
          { label: "Business Owners", href: "/agency/admin/business-owners" },
          { label: "Edit Owner" },
        ];
      } else if (pathname.includes("/agency/admin/business-owners/")) {
        return [
          baseBreadcrumb,
          { label: "Business Owners", href: "/agency/admin/business-owners" },
          { label: "Owner Details" },
        ];
      } else if (
        pathname.includes("/agency/admin/admin-users/") &&
        pathname.includes("/edit")
      ) {
        return [
          baseBreadcrumb,
          { label: "Admin Users", href: "/agency/admin/admin-users" },
          { label: "Edit User" },
        ];
      } else if (pathname.includes("/agency/admin/admin-users/")) {
        return [
          baseBreadcrumb,
          { label: "Admin Users", href: "/agency/admin/admin-users" },
          { label: "User Details" },
        ];
      } else if (
        pathname.includes("/agency/admin/projects/") &&
        pathname.includes("/edit")
      ) {
        return [
          baseBreadcrumb,
          { label: "Projects", href: "/agency/admin/projects" },
          { label: "Edit Project" },
        ];
      } else if (pathname.includes("/agency/admin/projects/")) {
        return [
          baseBreadcrumb,
          { label: "Projects", href: "/agency/admin/projects" },
          { label: "Project Details" },
        ];
      }

      return [baseBreadcrumb];
  }
}

export function AgencyLayout({ children }: AgencyLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [businessName, setBusinessName] = useState("Agency Portal");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const user = getCurrentUser();
  const breadcrumbs = getAgencyBreadcrumbs(location.pathname);
  const userBusinesses = getUserBusinesses();
  const canSwitch = canSwitchBusinesses();

  useEffect(() => {
    const loadBusinessName = () => {
      const name = localStorage.getItem("business_name") || "Agency Portal";
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

    loadBusinessName();
    loadZoomLevel();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "business_name") {
        setBusinessName(e.newValue || "Agency Portal");
      }
    };

    const handleBusinessNameChange = (e: CustomEvent) => {
      setBusinessName(e.detail || "Agency Portal");
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

  const handleBusinessSwitch = (businessId: string) => {
    if (switchToBusiness(businessId)) {
      toast.success(
        `Switched to ${userBusinesses.find((b) => b.id === businessId)?.name}`,
      );
      window.location.reload();
    } else {
      toast.error("Failed to switch business profile");
    }
  };

  const notificationCount = 3;

  const handleSignOut = () => {
    signOut();
    localStorage.removeItem("superadmin_session");
    toast.success("Signed out successfully");
    navigate("/signin", { replace: true });
  };

  const returnToSuperAdmin = () => {
    const superAdminSession = localStorage.getItem("superadmin_session");
    if (superAdminSession) {
      localStorage.setItem("auth_user", superAdminSession);
      localStorage.removeItem("superadmin_session");
      navigate("/super-admin", { replace: true });
      toast.success("Returned to Super Admin");
    }
  };

  // Agency-specific sidebar items
  const sidebarItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/agency/admin/dashboard",
      icon: Home,
      active: location.pathname === "/agency/admin/dashboard",
      comingSoon: false,
    },
    {
      id: "projects",
      label: "Projects",
      href: "/agency/admin/projects",
      icon: FolderKanban,
      active:
        location.pathname === "/agency/admin/projects" ||
        location.pathname.startsWith("/agency/admin/projects/"),
      comingSoon: false,
    },
    {
      id: "tasks",
      label: "Tasks",
      href: "/agency/admin/tasks",
      icon: CheckCircle,
      active: location.pathname === "/agency/admin/tasks",
      comingSoon: false,
    },
    {
      id: "leads",
      label: "Get Leads",
      href: "/agency/admin/leads",
      icon: Database,
      active: location.pathname.startsWith("/agency/admin/leads"),
      comingSoon: false,
    },
    {
      id: "client-access",
      label: "Client Access",
      href: "/agency/admin/client-access",
      icon: Link2,
      active: location.pathname.startsWith("/agency/admin/client-access"),
      comingSoon: false,
    },
    {
      id: "business-owners",
      label: "Business Owners",
      href: "/agency/admin/business-owners",
      icon: Building2,
      active:
        location.pathname === "/agency/admin/business-owners" ||
        location.pathname.startsWith("/agency/admin/business-owners/") ||
        location.pathname === "/agency/admin/clients" ||
        location.pathname.startsWith("/agency/admin/clients/"),
      comingSoon: false,
    },
    {
      id: "admin-users",
      label: "Admin Users",
      href: "/agency/admin/admin-users",
      icon: UsersIcon,
      active:
        location.pathname === "/agency/admin/admin-users" ||
        location.pathname.startsWith("/agency/admin/admin-users/"),
      comingSoon: false,
    },
    {
      id: "commission",
      label: "Commission",
      href: "/agency/admin/commission",
      icon: Percent,
      active: location.pathname === "/agency/admin/commission",
      comingSoon: false,
    },
    {
      id: "analytics",
      label: "Analytics",
      href: "/agency/admin/analytics",
      icon: TrendingUp,
      active: location.pathname === "/agency/admin/analytics",
      comingSoon: false,
    },
    {
      id: "reports",
      label: "Reports",
      href: "/agency/admin/reports",
      icon: FileText,
      active: location.pathname === "/agency/admin/reports",
      comingSoon: false,
    },
    {
      id: "wordpress-pages",
      label: "WordPress Pages",
      href: "/admin/wordpress-pages",
      icon: Globe,
      active: location.pathname.startsWith("/admin/wordpress-pages"),
      comingSoon: false,
    },
    {
      id: "wordpress-sites",
      label: "WP Sites",
      href: "/admin/wordpress-pages/sites",
      icon: Globe,
      active: location.pathname.startsWith("/admin/wordpress-pages/sites"),
      comingSoon: false,
    },
    {
      id: "audits",
      label: "Audits",
      href: "/agency/admin/audits",
      icon: ClipboardCheck,
      active: location.pathname === "/agency/admin/audits",
      comingSoon: true,
    },
    {
      id: "crm",
      label: "CRM",
      href: "/agency/admin/crm",
      icon: UserCheck,
      active: location.pathname.startsWith("/agency/admin/crm"),
      comingSoon: false,
    },
    {
      id: "billing",
      label: "Billing",
      href: "/agency/admin/billing",
      icon: CreditCard,
      active: location.pathname === "/agency/admin/billing",
      comingSoon: false,
    },
  ];

  const bottomSidebarItems = [
    {
      id: "help",
      label: "Help Center",
      href: "/agency/admin/help",
      icon: BookOpen,
      active: location.pathname === "/agency/admin/help",
    },
    {
      id: "settings",
      label: "Settings",
      href: "/agency/admin/settings",
      icon: Settings,
      active: location.pathname === "/agency/admin/settings",
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
                <Briefcase className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="font-bold text-base text-foreground">
                  Agency Portal
                </span>
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

        {/* Mobile Sidebar Bottom Items */}
        <div className="p-4 border-t space-y-2">
          {bottomSidebarItems.map((item) => (
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
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop Sidebar */}
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
                  <Briefcase className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="font-bold text-base text-foreground">
                    Agency Portal
                  </span>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                <Briefcase className="h-5 w-5 text-primary-foreground" />
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

          {/* Desktop Sidebar Bottom Items */}
          <div className="p-4 border-t space-y-2">
            {bottomSidebarItems.map((item) => (
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
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 min-w-0",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60",
        )}
      >
        {/* Header */}
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
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={user?.avatar}
                        alt={user?.name || "User"}
                      />
                      <AvatarFallback>
                        {user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email || "user@example.com"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Business Switching */}
                  {canSwitch && userBusinesses.length > 1 && (
                    <>
                      <DropdownMenuLabel>Switch Business</DropdownMenuLabel>
                      {userBusinesses.map((business) => (
                        <DropdownMenuItem
                          key={business.id}
                          onClick={() => handleBusinessSwitch(business.id)}
                          className="cursor-pointer"
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          {business.name}
                          {business.id === getCurrentBusiness()?.id && (
                            <CheckCircle className="ml-auto h-4 w-4 text-green-600" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem asChild>
                    <Link to="/admin/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>

                  {/* Super Admin Return */}
                  {localStorage.getItem("superadmin_session") && (
                    <DropdownMenuItem
                      onClick={returnToSuperAdmin}
                      className="cursor-pointer"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Return to Super Admin
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto w-full">
          <div
            className="w-full mobile-bottom-safe"
            style={{ minWidth: "max-content" }}
          >
            {children}
          </div>
        </main>

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

      {/* App Notifications */}
      <AppNotifications />
    </div>
  );
}
