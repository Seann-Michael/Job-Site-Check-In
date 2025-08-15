import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Zap,
  Users,
  DollarSign,
  BarChart3,
  Phone,
  Mail,
  Calendar,
  FileText,
  Clock,
  Target,
  TrendingUp,
  Search,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  href?: string;
  onClick?: () => void;
  description: string;
  category: "create" | "view" | "analyze" | "communicate";
  hotkey?: string;
}

export function QuickActionBar() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const quickActions: QuickAction[] = [
    // Create Actions
    {
      id: "new-project",
      label: "New Project",
      icon: Plus,
      href: "/admin/add-project",
      description: "Create a new project quickly",
      category: "create",
      hotkey: "Ctrl+N",
    },
    {
      id: "new-lead",
      label: "Add Lead",
      icon: Users,
      href: "/admin/add-project",
      description: "Add a new lead to your pipeline",
      category: "create",
      hotkey: "Ctrl+L",
    },

    // Quick Views
    {
      id: "leads-pipeline",
      label: "Pipeline",
      icon: Target,
      href: "/admin/projects",
      description: "View your sales pipeline",
      category: "view",
    },
    {
      id: "project-value",
      label: "Revenue",
      icon: DollarSign,
      href: "/admin/reports",
      description: "Check project values and revenue",
      category: "analyze",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      href: "/admin/reports",
      description: "View performance analytics",
      category: "analyze",
    },

    // Communication
    {
      id: "schedule-call",
      label: "Schedule",
      icon: Calendar,
      onClick: () => {
        // Open calendar or scheduling modal
        console.log("Schedule call");
      },
      description: "Schedule a call or meeting",
      category: "communicate",
    },
  ];

  const getCategoryActions = (category: string) =>
    quickActions.filter((action) => action.category === category);

  const ActionButton = ({ action }: { action: QuickAction }) => {
    const button = (
      <Button
        variant="outline"
        size="sm"
        className="h-12 px-3 flex flex-col gap-1 hover:bg-primary/5 hover:border-primary/20"
        asChild={!!action.href}
      >
        {action.href ? (
          <Link to={action.href}>
            <action.icon className="h-4 w-4" />
            <span className="text-xs">{action.label}</span>
          </Link>
        ) : (
          <div onClick={action.onClick}>
            <action.icon className="h-4 w-4" />
            <span className="text-xs">{action.label}</span>
          </div>
        )}
      </Button>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-center">
              <div className="font-medium">{action.label}</div>
              <div className="text-xs text-muted-foreground">
                {action.description}
              </div>
              {action.hotkey && (
                <div className="text-xs text-muted-foreground mt-1">
                  {action.hotkey}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Don't show on certain pages where it might interfere
  if (
    location.pathname.includes("/add-project") ||
    location.pathname.includes("/edit")
  ) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 shadow-lg border-2">
      <div className="p-2">
        {isExpanded ? (
          <div className="space-y-3">
            {/* Create Section */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                CREATE
              </div>
              <div className="flex gap-2">
                {getCategoryActions("create").map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            </div>

            {/* View Section */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                QUICK ACCESS
              </div>
              <div className="flex gap-2">
                {getCategoryActions("view").map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
                {getCategoryActions("analyze").map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            </div>

            {/* Communication Section */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                ACTIONS
              </div>
              <div className="flex gap-2">
                {getCategoryActions("communicate").map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="w-full text-xs"
            >
              Collapse
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {/* Always visible primary actions */}
            <ActionButton action={quickActions[0]} /> {/* New Project */}
            <ActionButton action={quickActions[1]} /> {/* Add Lead */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-12 px-3">
                  <Zap className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  VIEW & ANALYZE
                </DropdownMenuLabel>
                {getCategoryActions("view")
                  .concat(getCategoryActions("analyze"))
                  .map((action) => (
                    <DropdownMenuItem key={action.id} asChild>
                      {action.href ? (
                        <Link to={action.href} className="flex items-center">
                          <action.icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </Link>
                      ) : (
                        <div
                          onClick={action.onClick}
                          className="flex items-center"
                        >
                          <action.icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </div>
                      )}
                    </DropdownMenuItem>
                  ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  COMMUNICATE
                </DropdownMenuLabel>
                {getCategoryActions("communicate").map((action) => (
                  <DropdownMenuItem key={action.id} asChild>
                    {action.href ? (
                      <Link to={action.href} className="flex items-center">
                        <action.icon className="h-4 w-4 mr-2" />
                        {action.label}
                      </Link>
                    ) : (
                      <div
                        onClick={action.onClick}
                        className="flex items-center"
                      >
                        <action.icon className="h-4 w-4 mr-2" />
                        {action.label}
                      </div>
                    )}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsExpanded(true)}>
                  <Zap className="h-4 w-4 mr-2" />
                  Expand Actions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </Card>
  );
}
