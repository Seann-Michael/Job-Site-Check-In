import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  DollarSign,
  FolderOpen,
  Star,
  Camera,
  Settings,
  Bell,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Info,
  Play,
  Pause,
  BarChart3,
  FileText,
  Briefcase,
  Building2,
} from "lucide-react";

interface IconDefinition {
  icon: any;
  label: string;
  description: string;
  category: "navigation" | "actions" | "status" | "data" | "communication";
  color?: string;
}

const iconDefinitions: IconDefinition[] = [
  // Navigation
  {
    icon: FolderOpen,
    label: "Projects",
    description: "View and manage your construction projects",
    category: "navigation",
    color: "text-blue-600",
  },
  {
    icon: Users,
    label: "Leads",
    description: "Manage your sales pipeline and prospects",
    category: "navigation",
    color: "text-green-600",
  },
  {
    icon: DollarSign,
    label: "Revenue",
    description: "Track project values and financial performance",
    category: "navigation",
    color: "text-emerald-600",
  },
  {
    icon: Camera,
    label: "Gallery",
    description: "Manage project photos and media files",
    category: "navigation",
    color: "text-purple-600",
  },
  {
    icon: Star,
    label: "Reviews",
    description: "Customer reviews and feedback management",
    category: "navigation",
    color: "text-yellow-600",
  },
  {
    icon: Settings,
    label: "Settings",
    description: "Configure your account and preferences",
    category: "navigation",
    color: "text-gray-600",
  },

  // Actions
  {
    icon: Plus,
    label: "Add/Create",
    description: "Create new projects, leads, or other items",
    category: "actions",
    color: "text-blue-600",
  },
  {
    icon: Edit,
    label: "Edit",
    description: "Modify or update existing information",
    category: "actions",
    color: "text-blue-600",
  },
  {
    icon: Eye,
    label: "View Details",
    description: "View detailed information about an item",
    category: "actions",
    color: "text-gray-600",
  },
  {
    icon: Trash2,
    label: "Delete",
    description: "Remove or delete an item permanently",
    category: "actions",
    color: "text-red-600",
  },
  {
    icon: Download,
    label: "Export/Download",
    description: "Download or export data and reports",
    category: "actions",
    color: "text-green-600",
  },
  {
    icon: RefreshCw,
    label: "Refresh",
    description: "Reload or update current data",
    category: "actions",
    color: "text-blue-600",
  },
  {
    icon: Filter,
    label: "Filter",
    description: "Filter and sort data by criteria",
    category: "actions",
    color: "text-gray-600",
  },
  {
    icon: Search,
    label: "Search",
    description: "Search for specific items or information",
    category: "actions",
    color: "text-gray-600",
  },

  // Status Indicators
  {
    icon: CheckCircle,
    label: "Success/Complete",
    description: "Indicates successful completion or positive status",
    category: "status",
    color: "text-green-600",
  },
  {
    icon: AlertTriangle,
    label: "Warning/Attention",
    description: "Requires attention or indicates a warning",
    category: "status",
    color: "text-yellow-600",
  },
  {
    icon: Info,
    label: "Information",
    description: "Provides additional information or context",
    category: "status",
    color: "text-blue-600",
  },
  {
    icon: Clock,
    label: "Pending/Time",
    description: "Indicates time-related or pending status",
    category: "status",
    color: "text-orange-600",
  },
  {
    icon: Play,
    label: "Active/Running",
    description: "Indicates an active or running process",
    category: "status",
    color: "text-green-600",
  },
  {
    icon: Pause,
    label: "Paused/On Hold",
    description: "Indicates a paused or on-hold status",
    category: "status",
    color: "text-yellow-600",
  },

  // Data & Analytics
  {
    icon: BarChart3,
    label: "Analytics",
    description: "View charts, graphs, and analytical data",
    category: "data",
    color: "text-purple-600",
  },
  {
    icon: TrendingUp,
    label: "Growth/Increase",
    description: "Indicates positive growth or increase",
    category: "data",
    color: "text-green-600",
  },
  {
    icon: TrendingDown,
    label: "Decline/Decrease",
    description: "Indicates decline or decrease in values",
    category: "data",
    color: "text-red-600",
  },
  {
    icon: Target,
    label: "Goals/Targets",
    description: "Represents goals, targets, or objectives",
    category: "data",
    color: "text-blue-600",
  },
  {
    icon: FileText,
    label: "Reports/Documents",
    description: "Documents, reports, and text-based content",
    category: "data",
    color: "text-gray-600",
  },

  // Communication
  {
    icon: Phone,
    label: "Phone/Call",
    description: "Phone numbers and call-related actions",
    category: "communication",
    color: "text-blue-600",
  },
  {
    icon: Mail,
    label: "Email",
    description: "Email addresses and email-related actions",
    category: "communication",
    color: "text-blue-600",
  },
  {
    icon: Calendar,
    label: "Schedule/Calendar",
    description: "Dates, scheduling, and calendar events",
    category: "communication",
    color: "text-purple-600",
  },
  {
    icon: Bell,
    label: "Notifications",
    description: "Alerts, notifications, and reminders",
    category: "communication",
    color: "text-orange-600",
  },
  {
    icon: MapPin,
    label: "Location",
    description: "Addresses and location information",
    category: "communication",
    color: "text-red-600",
  },
];

interface IconLegendProps {
  categories?: Array<
    "navigation" | "actions" | "status" | "data" | "communication"
  >;
  compact?: boolean;
  className?: string;
}

export function IconLegend({
  categories = ["navigation", "actions", "status", "data", "communication"],
  compact = false,
  className,
}: IconLegendProps) {
  const filteredIcons = iconDefinitions.filter((icon) =>
    categories.includes(icon.category),
  );

  const groupedIcons = filteredIcons.reduce(
    (acc, icon) => {
      if (!acc[icon.category]) {
        acc[icon.category] = [];
      }
      acc[icon.category].push(icon);
      return acc;
    },
    {} as Record<string, IconDefinition[]>,
  );

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "navigation":
        return "Navigation";
      case "actions":
        return "Actions";
      case "status":
        return "Status Indicators";
      case "data":
        return "Data & Analytics";
      case "communication":
        return "Communication";
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "navigation":
        return "bg-blue-50 border-blue-200";
      case "actions":
        return "bg-green-50 border-green-200";
      case "status":
        return "bg-yellow-50 border-yellow-200";
      case "data":
        return "bg-purple-50 border-purple-200";
      case "communication":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Object.entries(groupedIcons).map(([category, icons]) => (
          <div key={category} className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {getCategoryLabel(category)}
            </h4>
            <div className="flex flex-wrap gap-1">
              {icons.map((iconDef) => (
                <TooltipProvider key={iconDef.label}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted/50 hover:bg-muted">
                        <iconDef.icon
                          className={`h-3 w-3 ${iconDef.color || "text-gray-600"}`}
                        />
                        <span className="font-medium">{iconDef.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">{iconDef.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5" />
          Icon Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedIcons).map(([category, icons]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={getCategoryColor(category)} variant="outline">
                {getCategoryLabel(category)}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {icons.map((iconDef) => (
                <div
                  key={iconDef.label}
                  className="flex items-start gap-3 p-2 rounded border hover:bg-muted/50"
                >
                  <iconDef.icon
                    className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconDef.color || "text-gray-600"}`}
                  />
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{iconDef.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {iconDef.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Quick reference component for specific contexts
export function QuickIconReference({
  context,
}: {
  context: "projects" | "leads" | "general";
}) {
  const getContextIcons = (): ("data" | "navigation" | "status" | "actions" | "communication")[] => {
    switch (context) {
      case "projects":
        return ["navigation", "actions", "status"];
      case "leads":
        return ["actions", "status", "communication"];
      default:
        return ["navigation", "actions", "status"];
    }
  };

  return (
    <IconLegend
      categories={getContextIcons()}
      compact
      className="p-3 bg-muted/20 rounded-lg"
    />
  );
}
