import React, { useState, useEffect } from "react";
import { AgencyLayout } from "@/components/AgencyLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  CheckCircle,
  Play,
  Pause,
  Eye,
  Edit,
  Copy,
  Archive,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AgencyProject,
  AgencyProjectFilters,
  AgencyProjectSortOptions,
  PROJECT_STATUSES,
  AGENCY_SERVICES,
} from "@/types/agency";
import { mockApiService, Project as MockProject } from "@/lib/mockApiService";

export default function AgencyProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<AgencyProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<AgencyProjectFilters>({});
  const [sortOptions, setSortOptions] = useState<AgencyProjectSortOptions>({
    field: "createdAt",
    direction: "desc",
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockProjects: AgencyProject[] = [
      {
        id: "proj-1",
        name: "Website Redesign for TechCorp",
        description:
          "Complete website redesign and development for TechCorp's new product launch",
        type: "one-off",
        status: "active",
        clientId: "client-1",
        clientName: "TechCorp Ltd",
        clientEmail: "john@techcorp.com",
        clientPhone: "+1-555-0123",
        services: ["website-design", "website-development"],
        budget: 15000,
        estimatedHours: 120,
        actualHours: 68,
        startDate: "2024-01-15",
        dueDate: "2024-03-15",
        documents: [],
        images: [],
        tasks: [],
        notes: [],
        createdAt: "2024-01-10T09:00:00Z",
        updatedAt: "2024-01-25T15:30:00Z",
        createdBy: "user-1",
        assignedTeam: ["user-1", "user-2"],
        progress: 65,
      },
      {
        id: "proj-2",
        name: "Monthly Local Optimization Services",
        description:
          "Ongoing local visibility optimization and content marketing for RetailPlus",
        type: "recurring",
        status: "active",
        clientId: "client-2",
        clientName: "RetailPlus Inc",
        clientEmail: "marketing@retailplus.com",
        services: ["local-optimization", "content-marketing"],
        budget: 2500,
        estimatedHours: 20,
        actualHours: 18,
        startDate: "2024-01-01",
        recurringSettings: {
          frequency: "monthly",
          nextDueDate: "2024-02-01",
          lastCompletedDate: "2024-01-30",
        },
        documents: [],
        images: [],
        tasks: [],
        notes: [],
        createdAt: "2023-12-15T10:00:00Z",
        updatedAt: "2024-01-30T16:45:00Z",
        createdBy: "user-1",
        assignedTeam: ["user-3"],
        progress: 90,
      },
      {
        id: "proj-3",
        name: "Google Ads Campaign Setup",
        description: "Launch and optimize Google Ads campaigns for LocalBiz",
        type: "one-off",
        status: "completed",
        clientId: "client-3",
        clientName: "LocalBiz Co",
        clientEmail: "owner@localbiz.com",
        services: ["paid-advertising"],
        budget: 5000,
        estimatedHours: 40,
        actualHours: 42,
        startDate: "2023-12-01",
        endDate: "2024-01-15",
        dueDate: "2024-01-10",
        completedDate: "2024-01-15",
        documents: [],
        images: [],
        tasks: [],
        notes: [],
        createdAt: "2023-11-28T08:00:00Z",
        updatedAt: "2024-01-15T12:00:00Z",
        createdBy: "user-2",
        assignedTeam: ["user-2"],
        progress: 100,
      },
    ];

    setProjects(mockProjects);
    setFilteredProjects(mockProjects);
    setIsLoading(false);
  }, []);

  // Filter and search logic
  useEffect(() => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (project) =>
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.clientName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          project.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Status filter
    if (filters.status?.length) {
      filtered = filtered.filter((project) =>
        filters.status!.includes(project.status),
      );
    }

    // Type filter
    if (filters.type?.length) {
      filtered = filtered.filter((project) =>
        filters.type!.includes(project.type),
      );
    }

    // Services filter
    if (filters.services?.length) {
      filtered = filtered.filter((project) =>
        project.services.some((service) => filters.services!.includes(service)),
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const { field, direction } = sortOptions;
      let aValue: any = a[field];
      let bValue: any = b[field];

      if (field === "createdAt" || field === "dueDate") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      if (direction === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredProjects(filtered);
  }, [projects, searchQuery, filters, sortOptions]);

  const getStatusColor = (status: string) => {
    const statusConfig = PROJECT_STATUSES.find((s) => s.value === status);
    return statusConfig?.color || "gray";
  };

  const getStatusVariant = (status: string) => {
    switch (getStatusColor(status)) {
      case "green":
        return "default";
      case "blue":
        return "secondary";
      case "yellow":
        return "outline";
      case "red":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getServiceLabels = (services: string[]) => {
    return services
      .map((service) => {
        const serviceConfig = AGENCY_SERVICES.find((s) => s.value === service);
        return serviceConfig?.label || service;
      })
      .join(", ");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleProjectAction = (action: string, projectId: string) => {
    switch (action) {
      case "view":
        navigate(`/agency/admin/projects/${projectId}`);
        break;
      case "edit":
        navigate(`/agency/admin/projects/${projectId}/edit`);
        break;
      case "duplicate":
        toast.success("Project duplicated successfully");
        break;
      case "archive":
        toast.success("Project archived");
        break;
      default:
        break;
    }
  };

  // Calculate summary stats
  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
    totalRevenue: projects.reduce((sum, p) => sum + p.budget, 0),
  };

  if (isLoading) {
    return (
      <AgencyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AgencyLayout>
    );
  }

  return (
    <AgencyLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your agency's projects and deliverables
            </p>
          </div>
          <Button asChild>
            <Link to="/agency/admin/projects/create">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Projects
                  </p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Projects
                  </p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Play className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={filters.status?.[0] || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  status: value === "all" ? undefined : [value],
                }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.type?.[0] || "all"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  type: value === "all" ? undefined : [value],
                }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="one-off">One-off</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/agency/admin/projects/${project.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">
                      {project.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {project.clientName}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleProjectAction("view", project.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleProjectAction("edit", project.id)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleProjectAction("duplicate", project.id)
                        }
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleProjectAction("archive", project.id)
                        }
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>

                {/* Status and Type */}
                <div className="flex gap-2">
                  <Badge variant={getStatusVariant(project.status)}>
                    {
                      PROJECT_STATUSES.find((s) => s.value === project.status)
                        ?.label
                    }
                  </Badge>
                  <Badge variant="outline">
                    {project.type === "one-off" ? "One-off" : "Recurring"}
                  </Badge>
                </div>

                {/* Services */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Services</p>
                  <p className="text-sm line-clamp-1">
                    {getServiceLabels(project.services)}
                  </p>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Budget and Timeline */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Budget</p>
                    <p className="font-medium">
                      {formatCurrency(project.budget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {project.type === "recurring" ? "Next Due" : "Due Date"}
                    </p>
                    <p className="font-medium">
                      {project.type === "recurring"
                        ? project.recurringSettings?.nextDueDate
                          ? formatDate(project.recurringSettings.nextDueDate)
                          : "N/A"
                        : project.dueDate
                          ? formatDate(project.dueDate)
                          : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Team */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Team</p>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">
                      {project.assignedTeam.length} members
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No projects found</p>
            <Button asChild className="mt-4">
              <Link to="/agency/admin/projects/create">
                <Plus className="h-4 w-4 mr-2" />
                Create your first project
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}
