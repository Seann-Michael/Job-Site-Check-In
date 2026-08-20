import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { HeaderSearch } from "@/components/SmartSearch";
import {
  Shield,
  BarChart3,
  Users,
  Building2,
  Settings,
  DollarSign,
  Database,
  LogOut,
  User,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  BookOpen,
  Lightbulb,
  Megaphone,
  Globe,
  FileText,
  Workflow,
  Target,
  Menu,
  X,
  Mail,
  Code,
  FolderOpen,
  TestTube,
  Zap,
} from "lucide-react";
import { useState, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCurrentUser, signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface SuperAdminLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function SuperAdminLayout({
  children,
  title,
  breadcrumbs,
}: SuperAdminLayoutProps) {
  const location = useLocation();
  const currentUser = getCurrentUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSignOut = () => {
    // signOut() clears the Supabase session and redirects to /login.
    void signOut();
  };

  const sidebarItems = [
    {
      label: "Dashboard",
      href: "/super-admin",
      icon: BarChart3,
      active: location.pathname === "/super-admin",
    },
    {
      label: "User Management",
      href: "/super-admin/users",
      icon: Users,
      active: location.pathname.startsWith("/super-admin/users"),
    },
    {
      label: "Workspaces",
      href: "/super-admin/workspaces",
      icon: Building2,
      active: location.pathname.startsWith("/super-admin/workspaces"),
    },
    {
      label: "Super Admin Staff",
      href: "/super-admin/staff",
      icon: User,
      active: location.pathname.startsWith("/super-admin/staff"),
    },
    {
      label: "Ideas Management",
      href: "/super-admin/ideas",
      icon: Lightbulb,
      active: location.pathname.startsWith("/super-admin/ideas"),
    },
    {
      label: "Analytics",
      href: "/super-admin/analytics",
      icon: BarChart3,
      active: location.pathname.startsWith("/super-admin/analytics"),
    },
    {
      label: "Communications",
      href: "/super-admin/communications",
      icon: Megaphone,
      active: location.pathname.startsWith("/super-admin/communications"),
    },
    {
      label: "Automation",
      href: "/super-admin/automation",
      icon: Workflow,
      active: location.pathname.startsWith("/super-admin/automation"),
    },
    {
      label: "User Segments",
      href: "/super-admin/segments",
      icon: Target,
      active: location.pathname.startsWith("/super-admin/segments"),
    },
    {
      label: "Email Integration",
      href: "/super-admin/email",
      icon: Mail,
      active: location.pathname.startsWith("/super-admin/email"),
    },
    {
      label: "Performance & Scale",
      href: "/super-admin/performance",
      icon: Zap,
      active: location.pathname.startsWith("/super-admin/performance"),
    },
    {
      label: "Quality Assurance",
      href: "/super-admin/quality",
      icon: Shield,
      active: location.pathname.startsWith("/super-admin/quality"),
    },
    {
      label: "Help Center",
      href: "/super-admin/help",
      icon: BookOpen,
      active: location.pathname === "/super-admin/help",
    },
    {
      label: "Support",
      href: "/super-admin/support",
      icon: MessageSquare,
      active: location.pathname === "/super-admin/support",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex max-w-full overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-lg transform transition-transform duration-300 flex flex-col",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Mobile Sidebar Header */}
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-base text-foreground">
                Super Admin
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSidebarOpen(false)}
              className="h-8 w-8 hover:bg-primary/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Main Navigation */}
        <nav className="flex-1 px-3 py-2">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10 font-medium px-4",
                    item.active &&
                      "bg-primary/10 text-primary border-r-2 border-primary",
                    !item.active &&
                      "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                  size="sm"
                >
                  <item.icon
                    className={cn("h-5 w-5", item.active && "text-primary")}
                  />
                  <span className="font-medium">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </nav>

        {/* Mobile User Info */}
        <div className="p-3 border-t bg-muted/20">
          <div className="flex items-center space-x-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src="/placeholder-avatar.jpg"
                alt={currentUser?.name || "User"}
              />
              <AvatarFallback>
                {currentUser?.name?.charAt(0) || "SA"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-none truncate">
                {currentUser?.name || "Super Admin"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentUser?.email || ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full gap-2"
            size="sm"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden md:flex bg-card border-r transition-all duration-300 flex-col",
          sidebarCollapsed ? "w-16" : "w-64",
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg">Super Admin</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-2">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Link key={item.href} to={item.href}>
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2",
                    sidebarCollapsed && "px-2",
                  )}
                  size="sm"
                >
                  <item.icon className="h-4 w-4" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Button>
              </Link>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer - Settings moved to header */}
        <div className="p-2 border-t space-y-1">
          {/* Settings moved to top header */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-background border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Mobile app title - only show on mobile */}
              <div className="md:hidden flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg">Super Admin</span>
              </div>

              {/* Super Admin Badge */}
              <Badge variant="destructive" className="hidden md:flex">
                <Shield className="h-3 w-3 mr-1" />
                Super Administrator
              </Badge>

              {/* Breadcrumbs */}
              <div className="hidden lg:block">
                <Breadcrumbs items={breadcrumbs} />
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              {/* Search */}
              <div className="hidden sm:block">
                <HeaderSearch />
              </div>

              {/* Notifications */}
              <NotificationDropdown />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src="/placeholder-avatar.jpg"
                        alt={currentUser?.name || "User"}
                      />
                      <AvatarFallback>
                        {currentUser?.name?.charAt(0) || "SA"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {currentUser?.name || "Super Admin"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser?.email || ""}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/super-admin/settings" className="cursor-pointer">
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
            </div>
          </div>
        </header>

        {/* Page Title */}
        {title && (
          <div className="bg-background border-b p-4">
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
        )}

        {/* Breadcrumbs for mobile */}
        <div className="lg:hidden bg-background border-b p-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto mobile-bottom-safe md:pb-6">
          {children}
        </main>

        {/* Footer - desktop only */}
        <div className="hidden md:block">
          <Footer />
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50 pb-safe">
          <div className="flex items-center justify-around px-2 py-3">
            {sidebarItems.slice(0, 4).map((item) => (
              <Link key={item.href} to={item.href} className="flex-1">
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className="w-full flex flex-col items-center gap-1 h-12 px-2"
                  size="sm"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-xs truncate">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
