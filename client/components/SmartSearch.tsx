import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Search,
  DollarSign,
  FolderOpen,
  Star,
  Camera,
  Settings,
  Plus,
  Clock,
  TrendingUp,
  Target,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import supabaseClient from "@/lib/supabaseClient";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: "project" | "contact" | "action" | "page";
  icon: any;
  href?: string;
  action?: () => void;
  metadata?: Record<string, any>;
}

interface SearchProps {
  trigger?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export function SmartSearch({
  trigger,
  placeholder = "Search everything...",
  className,
}: SearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [liveJobs, setLiveJobs] = useState<any[]>([]);
  const navigate = useNavigate();

  const quickActions = useMemo(() => [
    { label: "New Job", href: "/admin/add-job", icon: Plus },
    { label: "Revenue Report", href: "/admin/project-value?tab=analytics", icon: DollarSign },
  ], []);

  const pages = useMemo(() => [
    { label: "Jobs", href: "/admin/jobs", icon: FolderOpen },
    { label: "Project Value", href: "/admin/project-value", icon: DollarSign },
    { label: "Gallery", href: "/admin/gallery", icon: Camera },
    { label: "Reviews", href: "/admin/reviews", icon: Star },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ], []);

  // Load real jobs from Supabase when search opens
  useEffect(() => {
    if (!open) return;
    const loadJobs = async () => {
      try {
        const { data } = await supabaseClient
          .from("jobs")
          .select("id, name, status, type, client_contact")
          .order("created_at", { ascending: false })
          .limit(50);
        setLiveJobs(data ?? []);
      } catch {
        setLiveJobs([]);
      }
    };
    loadJobs();
  }, [open]);

  useEffect(() => {
    if (!query) {
      setResults([
        ...quickActions.map((a) => ({ id: `action-${a.label}`, title: a.label, subtitle: "Quick Action", type: "action" as const, icon: a.icon, href: a.href })),
        ...pages.slice(0, 4).map((p) => ({ id: `page-${p.label}`, title: p.label, subtitle: "Page", type: "page" as const, icon: p.icon, href: p.href })),
      ]);
      return;
    }

    const lq = query.toLowerCase();
    const filtered: SearchResult[] = [];

    liveJobs.forEach((job) => {
      const clientName = job.client_contact?.name ?? "";
      if (job.name?.toLowerCase().includes(lq) || clientName.toLowerCase().includes(lq) || job.type?.toLowerCase().includes(lq)) {
        filtered.push({
          id: job.id,
          title: job.name,
          subtitle: [clientName, job.status, job.type].filter(Boolean).join(" • "),
          type: "project",
          icon: FolderOpen,
          href: `/job/${job.id}`,
          metadata: job,
        });
      }
    });

    quickActions.forEach((a) => {
      if (a.label.toLowerCase().includes(lq)) {
        filtered.push({ id: `action-${a.label}`, title: a.label, subtitle: "Quick Action", type: "action", icon: a.icon, href: a.href });
      }
    });

    pages.forEach((p) => {
      if (p.label.toLowerCase().includes(lq)) {
        filtered.push({ id: `page-${p.label}`, title: p.label, subtitle: "Page", type: "page", icon: p.icon, href: p.href });
      }
    });

    setResults(filtered);
  }, [query, liveJobs, quickActions, pages]);

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.href) {
      navigate(result.href);
    }
    setOpen(false);
    setQuery("");
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "project":
        return "Jobs";
      case "contact":
        return "Contacts";
      case "action":
        return "Quick Actions";
      case "page":
        return "Pages";
      default:
        return "Results";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "project":
        return "bg-blue-100 text-blue-800";
      case "contact":
        return "bg-purple-100 text-purple-800";
      case "action":
        return "bg-orange-100 text-orange-800";
      case "page":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  return (
    <>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          className={`relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 ${className}`}
          onClick={() => setOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="hidden lg:inline-flex">{placeholder}</span>
          <span className="inline-flex lg:hidden">Search...</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      )}

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg">
          <DialogHeader className="px-4 pb-0 pt-4">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Search projects and more. Use{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>{" "}
              to open anytime.
            </DialogDescription>
          </DialogHeader>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
            <CommandInput
              placeholder="Type to search..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-[400px] overflow-y-auto">
              {results.length === 0 && query ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : (
                Object.entries(groupedResults).map(([type, items]) => (
                  <div key={type}>
                    <CommandGroup heading={getTypeLabel(type)}>
                      {items.map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <result.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="font-medium">{result.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {result.subtitle}
                            </div>
                          </div>
                          <Badge
                            className={`text-xs ${getTypeColor(result.type)}`}
                            variant="secondary"
                          >
                            {result.type}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </div>
                ))
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Simple search input for header (no popup)
export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  const searchData = useMemo(
    () => ({
      projects: [
        {
          id: "1",
          name: "Kitchen Renovation - Smith Residence",
          client: "John Smith",
          status: "Active",
          value: "$25,000",
          type: "Residential",
        },
        {
          id: "2",
          name: "Bathroom Remodel - Johnson Home",
          client: "Sarah Johnson",
          status: "Completed",
          value: "$15,000",
          type: "Residential",
        },
      ],
      pages: [
        { label: "Jobs", href: "/admin/jobs", icon: FolderOpen },
        { label: "Gallery", href: "/admin/gallery", icon: Camera },
        { label: "Reviews", href: "/admin/reviews", icon: Star },
        { label: "Settings", href: "/admin/settings", icon: Settings },
      ],
    }),
    [],
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered: SearchResult[] = [];

    // Search projects
    searchData.projects.forEach((project) => {
      if (
        project.name.toLowerCase().includes(lowerQuery) ||
        project.client.toLowerCase().includes(lowerQuery)
      ) {
        filtered.push({
          id: project.id,
          title: project.name,
          subtitle: `${project.client} • ${project.status}`,
          type: "project",
          icon: FolderOpen,
          href: `/job/${project.id}`,
        });
      }
    });

    // Search pages
    searchData.pages.forEach((page) => {
      if (page.label.toLowerCase().includes(lowerQuery)) {
        filtered.push({
          id: `page-${page.label}`,
          title: page.label,
          subtitle: "Page",
          type: "page",
          icon: page.icon,
          href: page.href,
        });
      }
    });

    setResults(filtered.slice(0, 8)); // Limit to 8 results
    setShowResults(true);
  }, [query, searchData]);

  const handleSelect = (result: SearchResult) => {
    if (result.href) {
      navigate(result.href);
    }
    setQuery("");
    setShowResults(false);
  };

  return (
    <div className="relative w-32 md:w-40 lg:w-64">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-9 h-9"
        />
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
              onClick={() => handleSelect(result)}
            >
              <result.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {result.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {result.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Button trigger version
export function SearchButton() {
  return (
    <SmartSearch
      trigger={
        <Button variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      }
    />
  );
}
