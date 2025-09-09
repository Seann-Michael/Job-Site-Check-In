import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Building2,
  FileText,
  LogOut,
  User,
  UserPlus,
  DollarSign,
  Bell,
  Search,
  Home,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { useState, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface AgencyAdminLayoutProps {
  children: ReactNode;
}

export function AgencyAdminLayout({ children }: AgencyAdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Mock notification count
  const notificationCount = 2;

  const handleSignOut = () => {
    signOut();
    localStorage.removeItem("agency_session");
    toast.success("Signed out successfully");
    navigate("/signin", { replace: true });
  };

  const sidebarItems = [
    {
      label: "Dashboard",
      href: "/agency/admin/dashboard",
      icon: Home,
      active: location.pathname === "/agency/admin/dashboard",
    },
    {
      label: "Client Management",
      href: "/agency/admin/clients",
      icon: Users,
      active: location.pathname.startsWith("/agency/admin/clients"),
    },
    {
      label: "Business Owners",
      href: "/agency/admin/business-owners",
      icon: Building2,
      active: location.pathname.startsWith("/agency/admin/business-owners"),
    },
    {
      label: "Analytics",
      href: "/agency/admin/analytics",
      icon: BarChart3,
      active: location.pathname === "/agency/admin/analytics",
    },
    {
      label: "Billing",
      href: "/agency/admin/billing",
      icon: CreditCard,
      active: location.pathname.startsWith("/agency/admin/billing"),
    },
    {
      label: "Admin Users",
      href: "/agency/admin/admin-users",
      icon: Users,
      active: location.pathname.startsWith("/agency/admin/admin-users"),
    },
    {
      label: "Help Center",
      href: "/agency/admin/help",
      icon: BookOpen,
      active: location.pathname === "/agency/admin/help",
    },
    {
      label: "Support",
      href: "/support",
      icon: MessageSquare,
      active: location.pathname === "/support",
    },
    {
      label: "WordPress Pages",
      href: "/admin/wordpress-pages",
      icon: BookOpen,
      active: location.pathname.startsWith("/admin/wordpress-pages"),
    },
    {
      label: "WP Sites",
      href: "/admin/wordpress-pages/sites",
      icon: BookOpen,
      active: location.pathname.startsWith("/admin/wordpress-pages/sites"),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Hidden on mobile */}
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-sm">Agency Portal</span>
                  <p className="text-xs text-muted-foreground">
                    GMB Booster Partner
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Client Button */}
        <div className="p-2">
          <Link to="/agency/admin/clients/add">
            <Button
              className={cn("w-full gap-2", sidebarCollapsed && "px-2")}
              size="sm"
            >
              <UserPlus className="h-4 w-4" />
              {!sidebarCollapsed && <span>Add Client</span>}
            </Button>
          </Link>
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

        {/* Sidebar Footer - Removed settings */}
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
              {/* Mobile app title - only show on mobile */}
              <div className="md:hidden flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-lg">Agency Portal</span>
              </div>

              {/* Agency Badge */}
              <Badge variant="outline" className="hidden md:flex">
                <Building2 className="h-3 w-3 mr-1" />
                Agency Partner
              </Badge>

              {/* Breadcrumbs - hidden on mobile */}
              <div className="hidden lg:block">
                <Breadcrumbs />
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              {/* Search - Hide on small mobile */}
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Search className="h-5 w-5" />
              </Button>

              {/* Notifications */}
              <Link to="/agency/admin/notifications">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4 md:h-5 md:w-5" />
                  {notificationCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </Badge>
                  )}
                </Button>
              </Link>

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                  >
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
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {currentUser?.name || "Agency User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser?.email}
                      </p>
                      <Badge variant="secondary" className="w-fit text-xs mt-1">
                        Agency Partner
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/agency/admin/profile"
                      className="flex items-center"
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/agency/admin/settings"
                      className="flex items-center"
                    >
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

        {/* Breadcrumbs for mobile */}
        <div className="lg:hidden bg-background border-b p-4">
          <Breadcrumbs />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 pb-16 md:pb-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation - Only visible on mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
          <div className="flex items-center justify-around px-2 py-2">
            {sidebarItems.slice(0, 4).map((item) => (
              <Link key={item.href} to={item.href} className="flex-1">
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className="w-full flex flex-col items-center gap-1 h-auto py-2 px-1"
                  size="sm"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Button>
              </Link>
            ))}

            {/* Settings moved to gear icon in header */}
          </div>
        </nav>
      </div>
    </div>
  );
}
