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
import { FolderOpen, Plus, Search, Filter, X, RotateCcw } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { AdvancedSearch } from "@/components/AdvancedSearch";
import { ProjectGridSkeleton } from "@/components/SkeletonLoader";
import { useAnalytics } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeProvider";
import { mockApiService, Project, User, Business } from "@/lib/mockApiService";

export default function Index() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

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
    });
  }, [currentUser, navigate]);

  useEffect(() => {
    // Load data from backend
    const loadData = async () => {
      try {
        console.log("Loading data from backend...");
        setIsLoading(true);

        // Load businesses first
        const businessData = await mockApiService.getBusinesses();
        setBusinesses(businessData);
        console.log("Loaded businesses:", businessData.length);

        // Load all projects
        const allProjects = await mockApiService.getProjects();

        setProjects(allProjects);
        setFilteredProjects(allProjects);
        console.log("Loaded projects:", allProjects.length);

        // Track successful data load
        track("data_loaded", {
          businessCount: businessData.length,
          projectCount: allProjects.length,
        });
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load projects. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [showAllProjects]);

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

    // Track filter usage
    if (searchQuery || Object.values(filters).some(v => v && v !== "all")) {
      trackFeatureUsage("project_filtering", {
        hasSearch: !!searchQuery,
        filtersApplied: Object.entries(filters).filter(([_, v]) => v && v !== "all").length,
        resultCount: filtered.length
      });
    }
  }, [projects, searchQuery, filters, projectSort, currentUser]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    trackFeatureUsage("project_search", { queryLength: value.length });
  }, []);

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
  };

  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() !== "" || 
           Object.entries(filters).some(([key, value]) => 
             key !== "tags" ? value !== "all" && value !== "" : value !== ""
           );
  }, [searchQuery, filters]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await mockApiService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success("Project deleted successfully");
      track("project_deleted", { projectId: id });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  }, [track]);

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

  // Get displayed projects (limit for performance)
  const displayedProjects = useMemo(() => {
    return showAllProjects ? filteredProjects : filteredProjects.slice(0, 12);
  }, [filteredProjects, showAllProjects]);

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
    >
      <div className="container mx-auto p-6 space-y-6">
        <EnhancedBroadcastAlert />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Businesses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.businesses}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-accent" : ""}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => setShowAdvancedSearch(true)}
            >
              Advanced Search
            </Button>
            
            <Button asChild>
              <Link to="/add-project">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="project-sort">Project Sort</Label>
                  <Select value={projectSort} onValueChange={(value: any) => setProjectSort(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      <SelectItem value="my-projects">My Projects</SelectItem>
                      <SelectItem value="starred">Starred</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="assigned-filter">Assigned User</Label>
                  <Select value={filters.assignedUser} onValueChange={(value) => handleFilterChange("assignedUser", value)}>
                    <SelectTrigger>
                      <SelectValue />
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
            </CardContent>
          </Card>
        )}

        {/* Projects Grid */}
        {displayedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {projects.length === 0
                  ? "Get started by creating your first project"
                  : "Try adjusting your search or filters"}
              </p>
              <Button asChild>
                <Link to="/add-project">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Projects Grid - Simple grid layout without virtual scrolling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={() => handleDeleteProject(project.id)}
                />
              ))}
            </div>

            {/* Show More Button */}
            {filteredProjects.length > displayedProjects.length && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowAllProjects(true)}
                >
                  Show {filteredProjects.length - displayedProjects.length} More Projects
                </Button>
              </div>
            )}
          </>
        )}

        {/* Advanced Search Modal */}
        {showAdvancedSearch && (
          <AdvancedSearch
            isOpen={showAdvancedSearch}
            onClose={() => setShowAdvancedSearch(false)}
            onSearch={handleAdvancedSearch}
            businesses={businesses}
            users={users}
          />
        )}
      </div>
    </AppLayout>
  );
}
