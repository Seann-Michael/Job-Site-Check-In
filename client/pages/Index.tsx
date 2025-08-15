import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppLayout } from "@/components/AppLayout";
import { ProjectCard } from "@/components/ProjectCard";
import { EnhancedBroadcastAlert } from "@/components/EnhancedBroadcastAlert";
import { FolderOpen, Plus, Search, Filter, X, RotateCcw, AlertCircle } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { AdvancedSearch } from "@/components/AdvancedSearch";
import { VirtualProjectList } from "@/components/VirtualScroll";
import { ProjectGridSkeleton } from "@/components/SkeletonLoader";
import { useAnalytics } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeProvider";
import { dataService, Project, User, Business } from "@/lib/dataService";
import { fallbackDataService } from "@/lib/fallbackDataService";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Index() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [displayedProjects, setDisplayedProjects] = useState<Project[]>([]);
  const [usingFallbackData, setUsingFallbackData] = useState(false);

  const { track, trackPageView, trackFeatureUsage } = useAnalytics();
  const [projectSort, setProjectSort] = useState<
    "all" | "starred" | "my-projects" | "archived"
  >("all");
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">(
    "small",
  );
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "all",
    assignedUser: "all",
    tags: "",
  });

  // Redirect super admin users to super admin dashboard
  useEffect(() => {
    if (currentUser?.role === "superadmin" && !currentUser?.isImpersonated) {
      navigate("/super-admin", { replace: true });
      return;
    }

    // Track page view
    trackPageView();
    track("dashboard_loaded", {
      userRole: currentUser?.role,
      projectCount: projects.length,
    });
  }, [currentUser, navigate, trackPageView, track]);

  useEffect(() => {
    // Load data from Supabase or fallback service
    const loadData = async () => {
      try {
        console.log("Loading data...");
        setIsLoading(true);

        // Check if we should use fallback data
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          console.warn("⚠️ Supabase not configured, using fallback demo data");
          setUsingFallbackData(true);
          
          // Use fallback data service
          const businessData = await fallbackDataService.getBusinesses();
          setBusinesses(businessData);
          console.log("Loaded businesses (fallback):", businessData.length);

          // Load projects from all businesses
          const allProjects: Project[] = [];
          for (const business of businessData) {
            const businessProjects = await fallbackDataService.getProjects(business.id);
            allProjects.push(...businessProjects);
          }

          setProjects(allProjects);
          setFilteredProjects(allProjects);
          console.log("Loaded projects (fallback):", allProjects.length);

          // Show initial projects
          const initialProjects = allProjects.slice(0, showAllProjects ? allProjects.length : 6);
          setDisplayedProjects(initialProjects);

          // Track demo data usage
          track("demo_data_loaded", {
            businessCount: businessData.length,
            projectCount: allProjects.length,
          });

          return;
        }

        // Try to use real Supabase data
        try {
          // Check if user is authenticated
          const user = await dataService.getCurrentUser();
          if (!user) {
            console.warn("User not authenticated, using demo data");
            setUsingFallbackData(true);
            
            // Load demo data
            const businessData = await fallbackDataService.getBusinesses();
            setBusinesses(businessData);
            
            const allProjects: Project[] = [];
            for (const business of businessData) {
              const businessProjects = await fallbackDataService.getProjects(business.id);
              allProjects.push(...businessProjects);
            }
            
            setProjects(allProjects);
            setFilteredProjects(allProjects);
            const initialProjects = allProjects.slice(0, showAllProjects ? allProjects.length : 6);
            setDisplayedProjects(initialProjects);
            return;
          }

          // Load businesses first
          console.log("Loading businesses from Supabase...");
          const businessData = await dataService.getBusinesses();
          setBusinesses(businessData);
          console.log("Loaded businesses:", businessData.length);

          // Load projects from all user's businesses
          const allProjects: Project[] = [];
          for (const business of businessData) {
            const businessProjects = await dataService.getProjects(business.id);
            allProjects.push(...businessProjects);
          }

          setProjects(allProjects);
          setFilteredProjects(allProjects);
          console.log("Loaded projects:", allProjects.length);

          // Show initial projects
          const initialProjects = allProjects.slice(0, showAllProjects ? allProjects.length : 6);
          setDisplayedProjects(initialProjects);

          // Track successful data load
          track("data_loaded", {
            businessCount: businessData.length,
            projectCount: allProjects.length,
            userRole: user.role,
          });

        } catch (supabaseError) {
          console.error("Error loading from Supabase:", supabaseError);
          console.warn("Falling back to demo data");
          setUsingFallbackData(true);
          
          // Fallback to demo data
          const businessData = await fallbackDataService.getBusinesses();
          setBusinesses(businessData);
          
          const allProjects: Project[] = [];
          for (const business of businessData) {
            const businessProjects = await fallbackDataService.getProjects(business.id);
            allProjects.push(...businessProjects);
          }
          
          setProjects(allProjects);
          setFilteredProjects(allProjects);
          const initialProjects = allProjects.slice(0, showAllProjects ? allProjects.length : 6);
          setDisplayedProjects(initialProjects);
          
          toast.info("Using demo data. Configure Supabase for full functionality.");
        }

      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load projects. Using demo data instead.");
        setUsingFallbackData(true);
        
        // Load fallback data as last resort
        try {
          const businessData = await fallbackDataService.getBusinesses();
          setBusinesses(businessData);
          
          const allProjects: Project[] = [];
          for (const business of businessData) {
            const businessProjects = await fallbackDataService.getProjects(business.id);
            allProjects.push(...businessProjects);
          }
          
          setProjects(allProjects);
          setFilteredProjects(allProjects);
          const initialProjects = allProjects.slice(0, showAllProjects ? allProjects.length : 6);
          setDisplayedProjects(initialProjects);
        } catch (fallbackError) {
          console.error("Even fallback data failed:", fallbackError);
          toast.error("Unable to load any data. Please check your configuration.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [navigate, track, showAllProjects]);

  // Apply filters and search to projects
  useEffect(() => {
    let filtered = [...projects];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((project) =>
        project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.type.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.status !== "all") {
      filtered = filtered.filter((project) => project.status === filters.status);
    }

    if (filters.assignedUser !== "all") {
      filtered = filtered.filter((project) => project.assigned_to === filters.assignedUser);
    }

    if (filters.startDate) {
      filtered = filtered.filter(
        (project) => new Date(project.created_at) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(
        (project) => new Date(project.created_at) <= new Date(filters.endDate)
      );
    }

    // Apply project sort
    switch (projectSort) {
      case "my-projects":
        const currentUserId = currentUser?.id;
        if (currentUserId) {
          filtered = filtered.filter((project) => project.assigned_to === currentUserId);
        }
        break;
      case "archived":
        filtered = filtered.filter((project) => project.status === "completed" || project.status === "cancelled");
        break;
      case "starred":
        // For now, show high priority projects as "starred"
        filtered = filtered.filter((project) => project.priority === "high" || project.priority === "urgent");
        break;
    }

    setFilteredProjects(filtered);

    // Update displayed projects
    const displayed = filtered.slice(0, showAllProjects ? filtered.length : 6);
    setDisplayedProjects(displayed);

    // Track filter usage
    if (searchQuery || Object.values(filters).some(v => v && v !== "all")) {
      trackFeatureUsage("project_filtering", {
        hasSearch: !!searchQuery,
        filtersApplied: Object.entries(filters).filter(([_, v]) => v && v !== "all").length,
        resultCount: filtered.length
      });
    }
  }, [projects, searchQuery, filters, projectSort, showAllProjects, currentUser, trackFeatureUsage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    trackFeatureUsage("project_search", { queryLength: value.length });
  }, [trackFeatureUsage]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      status: "all",
      assignedUser: "all",
      tags: "",
    });
    setSearchQuery("");
    trackFeatureUsage("filters_cleared");
  };

  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() !== "" || 
           Object.entries(filters).some(([key, value]) => 
             key !== "tags" ? value !== "all" && value !== "" : value !== ""
           );
  }, [searchQuery, filters]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      if (usingFallbackData) {
        await fallbackDataService.deleteProject(id);
      } else {
        await dataService.deleteProject(id);
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success("Project deleted successfully");
      track("project_deleted", { projectId: id });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  }, [usingFallbackData, track]);

  const handleAdvancedSearch = (searchCriteria: any) => {
    console.log("Advanced search:", searchCriteria);
    setShowAdvancedSearch(false);
    trackFeatureUsage("advanced_search_used", searchCriteria);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === "active" || p.status === "in_progress").length;
    const completed = projects.filter(p => p.status === "completed").length;
    const businesses_count = businesses.length;

    return {
      total: total.toString(),
      active: active.toString(),
      completed: completed.toString(),
      businesses: businesses_count.toString()
    };
  }, [projects, businesses]);

  // Memoize the displayed projects to prevent unnecessary re-renders
  const memoizedDisplayedProjects = useMemo(() => displayedProjects, [displayedProjects]);

  if (isLoading) {
    return (
      <AppLayout
        title="Projects"
        breadcrumbs={[{ label: "Projects", href: "/" }]}
        actions={<ThemeToggle />}
      >
        <ProjectGridSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Projects"
      breadcrumbs={[{ label: "Projects", href: "/" }]}
      actions={<ThemeToggle />}
      quickStats={[
        { label: "Total", value: stats.total },
        {
          label: "Active",
          value: stats.active,
          color: "success",
        },
        {
          label: "Completed",
          value: stats.completed,
          color: "success",
        },
        {
          label: "Businesses",
          value: stats.businesses,
          color: "info",
        },
      ]}
    >
      <div className="space-y-6">
        {/* Demo Mode Alert */}
        {usingFallbackData && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Demo Mode:</strong> You're viewing sample data. To access full functionality, configure Supabase by setting up your environment variables and running <code>npm run setup</code>.
            </AlertDescription>
          </Alert>
        )}

        <EnhancedBroadcastAlert 
          onDismiss={() => trackFeatureUsage("broadcast_alert_dismissed")}
        />

        {/* Search and Filter Controls */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div className="flex flex-1 items-center space-x-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedSearch(true)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Advanced
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 rounded-full bg-primary w-2 h-2" />
                  )}
                </Button>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                )}

                <Link to="/add-project">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Project
                  </Button>
                </Link>
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => handleFilterChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="assigned-user">Assigned To</Label>
                  <Select
                    value={filters.assignedUser}
                    onValueChange={(value) => handleFilterChange("assignedUser", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Project Sorting and View Options */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Select value={projectSort} onValueChange={(value: any) => setProjectSort(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="my-projects">My Projects</SelectItem>
                <SelectItem value="starred">High Priority</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cardSize} onValueChange={(value: any) => setCardSize(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {displayedProjects.length} of {filteredProjects.length} projects
          </div>
        </div>

        {/* Projects Grid */}
        {displayedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {hasActiveFilters ? "No projects match your filters" : "No projects yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {hasActiveFilters
                  ? "Try adjusting your search criteria or clearing filters to see more projects."
                  : "Get started by creating your first project. It's quick and easy!"}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              ) : (
                <Link to="/add-project">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Project
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <VirtualProjectList
              projects={displayedProjects}
              onDeleteProject={handleDeleteProject}
              cardSize={cardSize}
            />

            {/* Show More Button */}
            {filteredProjects.length > displayedProjects.length && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowAllProjects(true)}
                >
                  Show All {filteredProjects.length} Projects
                </Button>
              </div>
            )}
          </>
        )}

        {/* Advanced Search Modal */}
        {showAdvancedSearch && (
          <AdvancedSearch
            onSearch={handleAdvancedSearch}
            onClose={() => setShowAdvancedSearch(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}
