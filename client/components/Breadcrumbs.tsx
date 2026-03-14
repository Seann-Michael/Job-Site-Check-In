import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const location = useLocation();

  // Auto-generate breadcrumbs from URL if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: "Home", href: "/admin/jobs" }];

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Format segment names
      let label = segment.replace(/-/g, " ");

      // Handle special cases
      const labelMap: Record<string, string> = {
        "super-admin": "Super Admin",
        "agency-admin": "Agency Admin",
        "admin-users": "Admin Users",
        "business-owners": "Business Owners",
        "add-job": "Add Job",
        "admin/jobs": "Jobs",
      };

      if (labelMap[segment]) {
        label = labelMap[segment];
      } else {
        // Capitalize first letter of each word
        label = label.replace(/\b\w/g, (char) => char.toUpperCase());
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
        current: isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  return (
    <nav
      className={cn(
        "flex items-center space-x-1 text-sm text-muted-foreground",
        className,
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
            )}
            {item.href ? (
              <Link
                to={item.href}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                {index === 0 && <Home className="h-3 w-3" />}
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium flex items-center gap-1">
                {index === 0 && <Home className="h-3 w-3" />}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
