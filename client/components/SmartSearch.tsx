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
  User,
  Zap,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import supabaseClient from "@/lib/supabaseClient";
import { workspaceService } from "@/lib/workspaceService";

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

const APP_PAGES = [
  { label: "Jobs", href: "/admin/jobs", icon: FolderOpen },
  { label: "Clients", href: "/admin/clients", icon: User },
  { label: "Gallery", href: "/admin/gallery", icon: Camera },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Automations", href: "/admin/automations", icon: Zap },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

/** Escape a user string for use inside a PostgREST ilike pattern. */
function escapeLike(value: string): string {
  // Commas and parentheses are PostgREST filter syntax inside .or(); drop them.
  return value.replace(/[,()]/g, " ").replace(/[%_\\]/g, (m) => `\\${m}`);
}

/**
 * Search this business's jobs and clients by name. Returns up to 10 rows
 * of each, already shaped as SearchResult entries.
 */
async function searchBusinessRecords(query: string): Promise<SearchResult[]> {
  const ws = await workspaceService.whenReady();
  const businessId = ws.currentBusinessId;
  if (!businessId) return [];
  const pattern = `%${escapeLike(query)}%`;

  const [jobsRes, clientsRes] = await Promise.all([
    supabaseClient
      .from("jobs")
      .select("id, name, status, type")
      .eq("business_id", businessId)
      .ilike("name", pattern)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseClient
      .from("clients")
      .select("id, name, business_name, email")
      .eq("business_id", businessId)
      .or(`name.ilike.${pattern},business_name.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (jobsRes.error) throw jobsRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const results: SearchResult[] = [];
  (jobsRes.data ?? []).forEach((job: any) => {
    results.push({
      id: `job-${job.id}`,
      title: job.name,
      subtitle: [job.status, job.type].filter(Boolean).join(" • ") || "Job",
      type: "project",
      icon: FolderOpen,
      href: `/job/${job.id}`,
    });
  });
  (clientsRes.data ?? []).forEach((c: any) => {
    results.push({
      id: `client-${c.id}`,
      title: c.name || c.business_name || c.email || "Client",
      subtitle: [c.business_name && c.name ? c.business_name : null, c.email]
        .filter(Boolean)
        .join(" • ") || "Client",
      type: "contact",
      icon: User,
      href: `/admin/clients/${c.id}`,
    });
  });
  return results;
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
    { label: "New Workflow", href: "/admin/workflow-builder", icon: Plus },
  ], []);

  const pages = useMemo(() => APP_PAGES, []);

  // Load this business's recent jobs from Supabase when search opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadJobs = async () => {
      try {
        const ws = await workspaceService.whenReady();
        if (!ws.currentBusinessId) {
          setLiveJobs([]);
          return;
        }
        const { data, error } = await supabaseClient
          .from("jobs")
          .select("id, name, status, type, client_contact")
          .eq("business_id", ws.currentBusinessId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (!cancelled) setLiveJobs(data ?? []);
      } catch (err) {
        console.error("Search: failed to load jobs", err);
        if (!cancelled) setLiveJobs([]);
      }
    };
    loadJobs();
    return () => {
      cancelled = true;
    };
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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setShowResults(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const lq = trimmed.toLowerCase();
        const pageHits: SearchResult[] = APP_PAGES.filter((p) =>
          p.label.toLowerCase().includes(lq),
        ).map((p) => ({
          id: `page-${p.label}`,
          title: p.label,
          subtitle: "Page",
          type: "page",
          icon: p.icon,
          href: p.href,
        }));
        const records = await searchBusinessRecords(trimmed);
        if (requestId !== requestIdRef.current) return;
        setResults([...records, ...pageHits].slice(0, 10));
        setShowResults(true);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Header search failed:", err);
        setError("Search failed");
        setResults([]);
        setShowResults(true);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

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
          placeholder="Search jobs, clients..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-9 h-9"
        />
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {searching && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          )}
          {error && (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          )}
          {!searching && !error && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
          )}
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
