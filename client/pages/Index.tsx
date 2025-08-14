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
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { AdvancedSearch } from "@/components/AdvancedSearch";
import { VirtualProjectList } from "@/components/VirtualScroll";
import { ProjectGridSkeleton } from "@/components/SkeletonLoader";
import { useAnalytics } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeProvider";
import { mockDataService, MockProject } from "@/lib/mockData";

// Use MockProject interface from mockData
type Project = MockProject;

export default function Index() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Removed Builder.io editor detection to prevent forced mock data

  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [displayedProjects, setDisplayedProjects] = useState<Project[]>([]);

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

  // Mock users for filtering
  const users = [
    { id: "1", name: "John Smith" },
    { id: "2", name: "Jane Doe" },
    { id: "3", name: "Mike Johnson" },
  ];

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
  }, [currentUser, navigate, trackPageView, track, projects.length]);

  useEffect(() => {
    // Load projects from mock data service
    const loadProjects = async () => {
      try {
        console.log("Loading projects...");

        if (isBuilderIoEditor) {
          // Use minimal data for Builder.io editor
          console.log("Builder.io editor detected, using minimal data");
          const minimalProjects = [
            {
              id: "sample-1",
              name: "Sample Project",
              description: "A sample project for Builder.io preview",
              status: "completed" as const,
              priority: "medium" as const,
              clientName: "Sample Client",
              clientEmail: "client@example.com",
              startDate: "2024-01-01",
              endDate: "2024-02-15",
              lastActivity: "2024-02-15",
              progress: 100,
              starred: false,
              archived: false,
              tags: ["sample"],
              photos: [],
              teamMembers: [],
              documents: [],
              notes: [],
              budget: 25000,
              spent: 24500,
              estimatedHours: 120,
              actualHours: 115,
              metadata: {
                createdBy: "user-1",
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-02-15T00:00:00Z",
                version: 1,
              },
            },
          ];
          setProjects(minimalProjects);
          setFilteredProjects(minimalProjects);
          setIsLoading(false);
          return;
        }

        // Load projects from mock data service
        console.log("Loading projects from mock data service...");
        mockDataService.initialize(); // Ensure it's initialized
        const mockProjects = mockDataService.getProjects();
        console.log("Loaded projects:", mockProjects.length, "projects");

        if (mockProjects.length === 0) {
          console.warn("No projects found, forcing regeneration...");
          mockDataService.forceReinitialize();
          const newProjects = mockDataService.getProjects();
          console.log(
            "After force regeneration:",
            newProjects.length,
            "projects",
          );
          setProjects(newProjects);
          setFilteredProjects(newProjects.filter((p) => !p.archived));
        } else {
          setProjects(mockProjects);
          setFilteredProjects(mockProjects.filter((p) => !p.archived));
        }
      } catch (error) {
        console.error("Error loading projects:", error);
        toast.error("Failed to load projects");
        // Fallback to empty array
        setProjects([]);
        setFilteredProjects([]);
      }
      setIsLoading(false);
    };

    loadProjects();
  }, []);

  const applyFilters = () => {
    let filtered = projects;

    // Project sort filter (applied first)
    switch (projectSort) {
      case "starred":
        filtered = filtered.filter((project) => project.starred === true);
        break;
      case "my-projects":
        filtered = filtered.filter(
          (project) => project.createdBy === currentUser?.id,
        );
        break;
      case "archived":
        filtered = filtered.filter((project) => project.archived === true);
        break;
      case "all":
      default:
        // Show all non-archived projects by default
        filtered = filtered.filter((project) => project.archived !== true);
        break;
    }

    // Search query filter
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter(
        (project) =>
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          project.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.keywords.some((keyword) =>
            keyword.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      );
    }

    // Date filters
    if (filters.startDate) {
      filtered = filtered.filter(
        (project) =>
          new Date(project.startDate || project.createdAt) >=
          new Date(filters.startDate),
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(
        (project) =>
          new Date(project.completionDate || project.createdAt) <=
          new Date(filters.endDate),
      );
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(
        (project) => (project.status || "active") === filters.status,
      );
    }

    // Assigned user filter
    if (filters.assignedUser !== "all") {
      filtered = filtered.filter((project) =>
        project.assignedUsers?.includes(filters.assignedUser),
      );
    }

    // Tags filter
    if (filters.tags.trim() !== "") {
      const searchTags = filters.tags
        .toLowerCase()
        .split(",")
        .map((t) => t.trim());
      filtered = filtered.filter((project) =>
        searchTags.some((tag) =>
          project.keywords.some((keyword) =>
            keyword.toLowerCase().includes(tag),
          ),
        ),
      );
    }

    setFilteredProjects(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [projects, searchQuery, filters, projectSort]);

  // Update displayed projects when filtered projects change
  useEffect(() => {
    if (showAllProjects) {
      setDisplayedProjects(filteredProjects);
    } else {
      setDisplayedProjects(filteredProjects.slice(0, 20));
    }
  }, [filteredProjects, showAllProjects]);

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

  const markProjectIncomplete = (projectId: string) => {
    mockDataService.updateProject(projectId, {
      status: "active",
      completedDate: undefined,
    });
    const updatedProjects = mockDataService.getProjects();
    setProjects(updatedProjects);
    setFilteredProjects(updatedProjects.filter((p) => !p.archived));
    toast.success("Project marked as incomplete");
  };

  return (
    <AppLayout>
      <div className="w-full px-3 sm:px-4 py-6 max-w-full overflow-x-hidden min-w-0 bg-background">
        {/* Broadcast Messages */}
        <EnhancedBroadcastAlert />

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">
            Projects ({filteredProjects.length})
          </h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Project Sort Buttons */}
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 border rounded-lg p-1 min-w-max">
                <Button
                  variant={projectSort === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setProjectSort("all")}
                  className="text-xs whitespace-nowrap"
                >
                  All
                </Button>
                <Button
                  variant={projectSort === "starred" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setProjectSort("starred")}
                  className="text-xs whitespace-nowrap"
                >
                  Starred
                </Button>
                <Button
                  variant={projectSort === "my-projects" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setProjectSort("my-projects")}
                  className="text-xs whitespace-nowrap"
                >
                  My Projects
                </Button>
                <Button
                  variant={projectSort === "archived" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setProjectSort("archived")}
                  className="text-xs whitespace-nowrap"
                >
                  Archived
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Card Size Controls - Hidden on mobile */}
              <div className="hidden sm:flex border rounded-lg p-1 bg-muted/30">
                <Button
                  variant={cardSize === "small" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCardSize("small")}
                  className="px-3 h-8 text-xs"
                >
                  Small
                </Button>
                <Button
                  variant={cardSize === "medium" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCardSize("medium")}
                  className="px-3 h-8 text-xs"
                >
                  Medium
                </Button>
                <Button
                  variant={cardSize === "large" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCardSize("large")}
                  className="px-3 h-8 text-xs"
                >
                  Large
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 w-full sm:w-auto"
              >
                <Filter className="h-4 w-4" />
                <span className="sm:hidden">Show Filters</span>
                <span className="hidden sm:inline">Filters</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filter Projects</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned User</Label>
                  <Select
                    value={filters.assignedUser}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, assignedUser: value }))
                    }
                  >
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
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    placeholder="kitchen, bathroom..."
                    value={filters.tags}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, tags: e.target.value }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>

        {isLoading ? (
          <ProjectGridSkeleton />
        ) : filteredProjects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery.trim() ||
                Object.values(filters).some((v) => v !== "" && v !== "all")
                  ? "No projects match your search or filters."
                  : "Get started by creating your first project."}
              </p>
              <Link to="/admin/add-project">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile single column layout */}
            <div className="block md:hidden">
              {filteredProjects.length > 3 && (
                <div className="text-xs text-muted-foreground mb-3 text-center">
                  Showing {displayedProjects.length} of{" "}
                  {filteredProjects.length} projects
                </div>
              )}
              <div className="space-y-4">
                {displayedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={() => {
                      mockDataService.deleteProject(project.id);
                      const updatedProjects = mockDataService.getProjects();
                      setProjects(updatedProjects);
                      setFilteredProjects(
                        updatedProjects.filter((p) => !p.archived),
                      );
                    }}
                    onMarkIncomplete={
                      project.status === "completed"
                        ? () => markProjectIncomplete(project.id)
                        : undefined
                    }
                    onToggleStar={(starred) => {
                      mockDataService.updateProject(project.id, { starred });
                      const updatedProjects = mockDataService.getProjects();
                      setProjects(updatedProjects);
                      setFilteredProjects(
                        updatedProjects.filter((p) => !p.archived),
                      );
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Desktop grid layout */}
            <div
              className={`hidden md:grid gap-4 auto-rows-fr ${
                cardSize === "small"
                  ? "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : cardSize === "medium"
                    ? "md:grid-cols-2 lg:grid-cols-3"
                    : "md:grid-cols-1 lg:grid-cols-2"
              }`}
            >
              {displayedProjects.map((project) => (
                <div key={project.id} className="flex">
                  <ProjectCard
                    project={project}
                    onDelete={() => {
                      mockDataService.deleteProject(project.id);
                      const updatedProjects = mockDataService.getProjects();
                      setProjects(updatedProjects);
                      setFilteredProjects(
                        updatedProjects.filter((p) => !p.archived),
                      );
                    }}
                    onMarkIncomplete={
                      project.status === "completed"
                        ? () => markProjectIncomplete(project.id)
                        : undefined
                    }
                    onToggleStar={(starred) => {
                      mockDataService.updateProject(project.id, { starred });
                      const updatedProjects = mockDataService.getProjects();
                      setProjects(updatedProjects);
                      setFilteredProjects(
                        updatedProjects.filter((p) => !p.archived),
                      );
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Load More / View All Button */}
            {!showAllProjects && filteredProjects.length > 20 && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={() => setShowAllProjects(true)}
                  className="px-8"
                >
                  View All {filteredProjects.length} Projects
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
