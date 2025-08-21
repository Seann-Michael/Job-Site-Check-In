import React, { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { useLocation } from "react-router-dom";
import { AgencyLayout } from "@/components/AgencyLayout";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  Clock,
  User,
  Users,
  Target,
  TrendingUp,
  CheckCircle,
  Circle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Kanban,
  List,
  BarChart3,
  Filter,
  Eye,
  Edit,
  Trash,
  Play,
  Pause,
  RotateCcw,
  Settings,
  FolderKanban,
  X,
  GripVertical,
  Zap,
  Timer,
  Rocket,
  CalendarClock,
  MessageSquare,
  Paperclip,
  Tag,
  Star,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { AgencySprint, SprintTask, SPRINT_STATUSES } from "@/types/agency";

// Task Pipeline Types
interface TaskPipeline {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  columns: TaskColumn[];
}

interface TaskColumn {
  id: string;
  title: string;
  color: string;
  order: number;
  limit?: number;
}

interface AgencyTask {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  pipelineId: string;
  priority: "low" | "medium" | "high" | "urgent";
  order: number;
  assignedTo: string;
  assignedToName: string;
  assignedToEmail: string;
  assignedToAvatar?: string;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  sprintId?: string;
  sprintName?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  completedDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  createdBy: string;
  category?: string;
  tags?: string[];
  subtasks: AgencySubtask[];
  attachments?: number;
  comments?: number;
}

interface AgencySubtask {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

const TASK_PRIORITIES = [
  {
    value: "low",
    label: "Low",
    color: "bg-gray-100 text-gray-700",
    icon: Flag,
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-blue-100 text-blue-700",
    icon: Flag,
  },
  {
    value: "high",
    label: "High",
    color: "bg-yellow-100 text-yellow-700",
    icon: Flag,
  },
  {
    value: "urgent",
    label: "Urgent",
    color: "bg-red-100 text-red-700",
    icon: Flag,
  },
] as const;

const DEFAULT_PIPELINES: TaskPipeline[] = [
  {
    id: "general-tasks",
    name: "General Tasks",
    description: "Default task management pipeline",
    isDefault: true,
    createdAt: new Date().toISOString(),
    columns: [
      { id: "backlog", title: "Backlog", color: "#6B7280", order: 1 },
      { id: "todo", title: "To Do", color: "#3B82F6", order: 2 },
      { id: "in-progress", title: "In Progress", color: "#F59E0B", order: 3 },
      { id: "review", title: "Review", color: "#8B5CF6", order: 4 },
      { id: "completed", title: "Done", color: "#10B981", order: 5 },
    ],
  },
  {
    id: "client-projects",
    name: "Client Projects",
    description: "Project-specific task management",
    isDefault: false,
    createdAt: new Date().toISOString(),
    columns: [
      { id: "planning", title: "Planning", color: "#6B7280", order: 1 },
      { id: "design", title: "Design", color: "#EC4899", order: 2 },
      { id: "development", title: "Development", color: "#3B82F6", order: 3 },
      { id: "testing", title: "Testing", color: "#F59E0B", order: 4 },
      { id: "deployed", title: "Deployed", color: "#10B981", order: 5 },
    ],
  },
];

export default function AgencyTasks() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin/');

  // Core state
  const [pipelines, setPipelines] = useState<TaskPipeline[]>(DEFAULT_PIPELINES);
  const [currentPipelineId, setCurrentPipelineId] =
    useState<string>("general-tasks");
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [sprints, setSprints] = useState<AgencySprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<AgencySprint | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [isLoading, setIsLoading] = useState(false);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    priority: "all",
    assignedTo: "all",
    client: "all",
    project: "all",
    sprint: "all",
    category: "all",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Sorting for list view
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Dialog states
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [isCreateSprintDialogOpen, setIsCreateSprintDialogOpen] =
    useState(false);
  const [isCreatePipelineDialogOpen, setIsCreatePipelineDialogOpen] =
    useState(false);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] =
    useState(false);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [isEditPipelineDialogOpen, setIsEditPipelineDialogOpen] =
    useState(false);
  const [isEditColumnDialogOpen, setIsEditColumnDialogOpen] = useState(false);

  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);
  const [editingPipeline, setEditingPipeline] = useState<TaskPipeline | null>(
    null,
  );
  const [editingColumn, setEditingColumn] = useState<TaskColumn | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [pipelineToDelete, setPipelineToDelete] = useState<string | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

  // Form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    assignedTo: "",
    assignedToName: "",
    assignedToEmail: "",
    clientId: "",
    clientName: "",
    projectId: "",
    projectName: "",
    sprintId: "",
    dueDate: "",
    estimatedHours: "",
    category: "",
    tags: [] as string[],
    newTag: "",
  });

  const [newSprint, setNewSprint] = useState({
    name: "",
    description: "",
    goal: "",
    startDate: "",
    endDate: "",
    plannedHours: "",
    capacity: "",
    projectId: "",
    teamMembers: [] as string[],
  });

  const [newPipeline, setNewPipeline] = useState({
    name: "",
    description: "",
  });

  const [newColumn, setNewColumn] = useState({
    title: "",
    color: "#3B82F6",
  });

  // Mock data
  useEffect(() => {
    // Mock tasks
    const mockTasks: AgencyTask[] = [
      {
        id: "task-1",
        title: "Design homepage wireframes",
        description: "Create wireframes for the new homepage layout",
        columnId: "todo",
        pipelineId: "general-tasks",
        priority: "high",
        order: 1,
        assignedTo: "user-1",
        assignedToName: "Sarah Johnson",
        assignedToEmail: "sarah@agency.com",
        assignedToAvatar: "/api/placeholder/32/32",
        clientId: "client-1",
        clientName: "TechCorp",
        projectId: "project-1",
        projectName: "Website Redesign",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: "2024-12-25",
        estimatedHours: 8,
        createdBy: "admin",
        category: "design",
        tags: ["ui", "homepage", "wireframes"],
        subtasks: [
          {
            id: "subtask-1",
            title: "Research competitor designs",
            completed: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: "subtask-2",
            title: "Create mobile wireframes",
            completed: false,
            createdAt: new Date().toISOString(),
          },
        ],
        attachments: 3,
        comments: 2,
      },
      {
        id: "task-2",
        title: "Implement user authentication",
        description: "Set up login/register functionality with JWT",
        columnId: "in-progress",
        pipelineId: "general-tasks",
        priority: "urgent",
        order: 1,
        assignedTo: "user-2",
        assignedToName: "Mike Chen",
        assignedToEmail: "mike@agency.com",
        clientId: "client-1",
        clientName: "TechCorp",
        projectId: "project-1",
        projectName: "Website Redesign",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: "2024-12-20",
        estimatedHours: 12,
        createdBy: "admin",
        category: "development",
        tags: ["auth", "backend", "security"],
        subtasks: [
          {
            id: "subtask-3",
            title: "Set up JWT middleware",
            completed: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: "subtask-4",
            title: "Create login form",
            completed: false,
            createdAt: new Date().toISOString(),
          },
        ],
        attachments: 1,
        comments: 5,
      },
      {
        id: "task-3",
        title: "Content strategy document",
        description: "Develop content strategy for Q1 marketing campaigns",
        columnId: "review",
        pipelineId: "general-tasks",
        priority: "medium",
        order: 1,
        assignedTo: "user-3",
        assignedToName: "Emma Davis",
        assignedToEmail: "emma@agency.com",
        clientId: "client-2",
        clientName: "StartupXYZ",
        projectId: "project-2",
        projectName: "Marketing Campaign",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedHours: 6,
        createdBy: "admin",
        category: "content",
        tags: ["strategy", "content", "marketing"],
        subtasks: [],
        attachments: 2,
        comments: 1,
      },
    ];

    // Mock sprint
    const mockSprint: AgencySprint = {
      id: "sprint-1",
      name: "Sprint 1 - Homepage Redesign",
      description:
        "First sprint focusing on homepage wireframes and authentication",
      goal: "Complete homepage design and implement user authentication",
      status: "active",
      startDate: "2024-12-10",
      endDate: "2024-12-24",
      plannedHours: 80,
      actualHours: 35,
      teamMembers: ["user-1", "user-2", "user-3"],
      capacity: 120,
      projectId: "project-1",
      projectName: "Website Redesign",
      taskIds: ["task-1", "task-2"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin",
    };

    setTasks(mockTasks);
    setSprints([mockSprint]);
    setActiveSprint(mockSprint);
  }, []);

  const currentPipeline = pipelines.find((p) => p.id === currentPipelineId);

  const getTasksByColumn = (columnId: string) => {
    return tasks
      .filter(
        (task) =>
          task.columnId === columnId &&
          task.pipelineId === currentPipelineId &&
          (filters.sprint === "all" ||
            task.sprintId === filters.sprint ||
            (filters.sprint === "no-sprint" && !task.sprintId)) &&
          (filters.priority === "all" || task.priority === filters.priority) &&
          (filters.assignedTo === "all" ||
            task.assignedTo === filters.assignedTo) &&
          (filters.client === "all" || task.clientId === filters.client) &&
          (filters.project === "all" || task.projectId === filters.project) &&
          (searchQuery === "" ||
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.description
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            task.tags?.some((tag) =>
              tag.toLowerCase().includes(searchQuery.toLowerCase()),
            )),
      )
      .sort((a, b) => a.order - b.order);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "column") {
      // Handle column reordering
      if (!currentPipeline) return;

      const newColumns = Array.from(currentPipeline.columns);
      const [reorderedColumn] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, reorderedColumn);

      const updatedColumns = newColumns.map((col, index) => ({
        ...col,
        order: index + 1,
      }));

      const updatedPipeline = {
        ...currentPipeline,
        columns: updatedColumns,
      };

      setPipelines((prev) =>
        prev.map((p) => (p.id === currentPipeline.id ? updatedPipeline : p)),
      );
      return;
    }

    if (type === "task") {
      const sourceColumnTasks = getTasksByColumn(source.droppableId);
      const destColumnTasks = getTasksByColumn(destination.droppableId);

      const taskToMove = sourceColumnTasks[source.index];

      if (source.droppableId === destination.droppableId) {
        // Same column reordering
        const reorderedTasks = Array.from(sourceColumnTasks);
        reorderedTasks.splice(source.index, 1);
        reorderedTasks.splice(destination.index, 0, taskToMove);

        const updatedTasks = reorderedTasks.map((task, index) => ({
          ...task,
          order: index + 1,
        }));

        setTasks((prev) =>
          prev.map((task) => {
            const updatedTask = updatedTasks.find((ut) => ut.id === task.id);
            return updatedTask || task;
          }),
        );
      } else {
        // Moving between columns
        const updatedTask = {
          ...taskToMove,
          columnId: destination.droppableId,
          order: destination.index + 1,
        };

        setTasks((prev) =>
          prev.map((task) => (task.id === taskToMove.id ? updatedTask : task)),
        );
      }
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    const task: AgencyTask = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      description: newTask.description,
      columnId: currentPipeline?.columns[0]?.id || "todo",
      pipelineId: currentPipelineId,
      priority: newTask.priority,
      order:
        tasks.filter((t) => t.columnId === currentPipeline?.columns[0]?.id)
          .length + 1,
      assignedTo: newTask.assignedTo,
      assignedToName: newTask.assignedToName,
      assignedToEmail: newTask.assignedToEmail,
      clientId: newTask.clientId,
      clientName: newTask.clientName,
      projectId: newTask.projectId,
      projectName: newTask.projectName,
      sprintId: newTask.sprintId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: newTask.dueDate,
      estimatedHours: newTask.estimatedHours
        ? parseInt(newTask.estimatedHours)
        : undefined,
      createdBy: "current-user",
      category: newTask.category,
      tags: newTask.tags,
      subtasks: [],
      attachments: 0,
      comments: 0,
    };

    setTasks((prev) => [...prev, task]);
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      assignedTo: "",
      assignedToName: "",
      assignedToEmail: "",
      clientId: "",
      clientName: "",
      projectId: "",
      projectName: "",
      sprintId: "",
      dueDate: "",
      estimatedHours: "",
      category: "",
      tags: [],
      newTag: "",
    });
    setIsCreateTaskDialogOpen(false);
    toast.success("Task created successfully");
  };

  const handleEditTask = (task: AgencyTask) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      assignedTo: task.assignedTo,
      assignedToName: task.assignedToName,
      assignedToEmail: task.assignedToEmail,
      clientId: task.clientId || "",
      clientName: task.clientName || "",
      projectId: task.projectId || "",
      projectName: task.projectName || "",
      sprintId: task.sprintId || "",
      dueDate: task.dueDate || "",
      estimatedHours: task.estimatedHours?.toString() || "",
      category: task.category || "",
      tags: task.tags || [],
      newTag: "",
    });
    setIsEditTaskDialogOpen(true);
  };

  const handleUpdateTask = () => {
    if (!editingTask || !newTask.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    const updatedTask: AgencyTask = {
      ...editingTask,
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      assignedTo: newTask.assignedTo,
      assignedToName: newTask.assignedToName,
      assignedToEmail: newTask.assignedToEmail,
      clientId: newTask.clientId,
      clientName: newTask.clientName,
      projectId: newTask.projectId,
      projectName: newTask.projectName,
      sprintId: newTask.sprintId,
      dueDate: newTask.dueDate,
      estimatedHours: newTask.estimatedHours
        ? parseInt(newTask.estimatedHours)
        : undefined,
      category: newTask.category,
      tags: newTask.tags,
      updatedAt: new Date().toISOString(),
    };

    setTasks((prev) =>
      prev.map((task) => (task.id === editingTask.id ? updatedTask : task)),
    );
    setEditingTask(null);
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      assignedTo: "",
      assignedToName: "",
      assignedToEmail: "",
      clientId: "",
      clientName: "",
      projectId: "",
      projectName: "",
      sprintId: "",
      dueDate: "",
      estimatedHours: "",
      category: "",
      tags: [],
      newTag: "",
    });
    setIsEditTaskDialogOpen(false);
    toast.success("Task updated successfully");
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setTaskToDelete(null);
    toast.success("Task deleted successfully");
  };

  const handleCreateSprint = () => {
    if (!newSprint.name.trim() || !newSprint.goal.trim()) {
      toast.error("Sprint name and goal are required");
      return;
    }

    const sprint: AgencySprint = {
      id: `sprint-${Date.now()}`,
      name: newSprint.name,
      description: newSprint.description,
      goal: newSprint.goal,
      status: "planning",
      startDate: newSprint.startDate,
      endDate: newSprint.endDate,
      plannedHours: newSprint.plannedHours
        ? parseInt(newSprint.plannedHours)
        : 0,
      capacity: newSprint.capacity ? parseInt(newSprint.capacity) : 0,
      teamMembers: newSprint.teamMembers,
      projectId: newSprint.projectId,
      taskIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "current-user",
    };

    setSprints((prev) => [...prev, sprint]);
    setNewSprint({
      name: "",
      description: "",
      goal: "",
      startDate: "",
      endDate: "",
      plannedHours: "",
      capacity: "",
      projectId: "",
      teamMembers: [],
    });
    setIsCreateSprintDialogOpen(false);
    toast.success("Sprint created successfully");
  };

  const handleCreatePipeline = () => {
    if (!newPipeline.name.trim()) {
      toast.error("Pipeline name is required");
      return;
    }

    const pipeline: TaskPipeline = {
      id: `pipeline-${Date.now()}`,
      name: newPipeline.name,
      description: newPipeline.description,
      isDefault: false,
      createdAt: new Date().toISOString(),
      columns: DEFAULT_PIPELINES[0].columns.map((col) => ({
        ...col,
        id: `${Date.now()}-${col.id}`,
      })),
    };

    setPipelines((prev) => [...prev, pipeline]);
    setNewPipeline({ name: "", description: "" });
    setIsCreatePipelineDialogOpen(false);
    toast.success("Pipeline created successfully");
  };

  const handleEditPipeline = (pipeline: TaskPipeline) => {
    setEditingPipeline(pipeline);
    setNewPipeline({
      name: pipeline.name,
      description: pipeline.description || "",
    });
    setIsEditPipelineDialogOpen(true);
  };

  const handleUpdatePipeline = () => {
    if (!editingPipeline || !newPipeline.name.trim()) {
      toast.error("Pipeline name is required");
      return;
    }

    const updatedPipeline = {
      ...editingPipeline,
      name: newPipeline.name,
      description: newPipeline.description,
    };

    setPipelines((prev) =>
      prev.map((p) => (p.id === editingPipeline.id ? updatedPipeline : p)),
    );
    setEditingPipeline(null);
    setNewPipeline({ name: "", description: "" });
    setIsEditPipelineDialogOpen(false);
    toast.success("Pipeline updated successfully");
  };

  const handleDeletePipeline = (pipelineId: string) => {
    if (pipelines.length <= 1) {
      toast.error("Cannot delete the last pipeline");
      return;
    }

    // Move tasks to the first remaining pipeline
    const remainingPipeline = pipelines.find((p) => p.id !== pipelineId);
    if (remainingPipeline) {
      setTasks((prev) =>
        prev.map((task) =>
          task.pipelineId === pipelineId
            ? {
                ...task,
                pipelineId: remainingPipeline.id,
                columnId: remainingPipeline.columns[0].id,
              }
            : task,
        ),
      );
    }

    setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));

    // Switch to remaining pipeline if deleting current one
    if (currentPipelineId === pipelineId && remainingPipeline) {
      setCurrentPipelineId(remainingPipeline.id);
    }

    setPipelineToDelete(null);
    toast.success("Pipeline deleted successfully");
  };

  const handleCreateColumn = () => {
    if (!newColumn.title.trim() || !currentPipeline) {
      toast.error("Column title is required");
      return;
    }

    const column: TaskColumn = {
      id: `column-${Date.now()}`,
      title: newColumn.title,
      color: newColumn.color,
      order: currentPipeline.columns.length + 1,
    };

    const updatedPipeline = {
      ...currentPipeline,
      columns: [...currentPipeline.columns, column],
    };

    setPipelines((prev) =>
      prev.map((p) => (p.id === currentPipeline.id ? updatedPipeline : p)),
    );
    setNewColumn({ title: "", color: "#3B82F6" });
    setIsCreateColumnDialogOpen(false);
    toast.success("Column created successfully");
  };

  const handleEditColumn = (column: TaskColumn) => {
    setEditingColumn(column);
    setNewColumn({
      title: column.title,
      color: column.color,
    });
    setIsEditColumnDialogOpen(true);
  };

  const handleUpdateColumn = () => {
    if (!editingColumn || !newColumn.title.trim() || !currentPipeline) {
      toast.error("Column title is required");
      return;
    }

    const updatedColumn = {
      ...editingColumn,
      title: newColumn.title,
      color: newColumn.color,
    };

    const updatedPipeline = {
      ...currentPipeline,
      columns: currentPipeline.columns.map((col) =>
        col.id === editingColumn.id ? updatedColumn : col,
      ),
    };

    setPipelines((prev) =>
      prev.map((p) => (p.id === currentPipeline.id ? updatedPipeline : p)),
    );
    setEditingColumn(null);
    setNewColumn({ title: "", color: "#3B82F6" });
    setIsEditColumnDialogOpen(false);
    toast.success("Column updated successfully");
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!currentPipeline || currentPipeline.columns.length <= 2) {
      toast.error("Pipeline must have at least 2 columns");
      return;
    }

    // Move tasks to the first column
    const firstColumn = currentPipeline.columns.find(
      (col) => col.id !== columnId,
    );
    if (firstColumn) {
      setTasks((prev) =>
        prev.map((task) =>
          task.columnId === columnId
            ? { ...task, columnId: firstColumn.id }
            : task,
        ),
      );
    }

    const updatedPipeline = {
      ...currentPipeline,
      columns: currentPipeline.columns.filter((col) => col.id !== columnId),
    };

    setPipelines((prev) =>
      prev.map((p) => (p.id === currentPipeline.id ? updatedPipeline : p)),
    );
    setColumnToDelete(null);
    toast.success("Column deleted successfully");
  };

  const getPriorityColor = (priority: string) => {
    const priorityConfig = TASK_PRIORITIES.find((p) => p.value === priority);
    return priorityConfig?.color || "bg-gray-100 text-gray-700";
  };

  const isTaskOverdue = (task: AgencyTask) => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.columnId !== "completed";
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const sortTasks = (tasks: AgencyTask[]) => {
    return [...tasks].sort((a, b) => {
      let aValue: any = "";
      let bValue: any = "";

      switch (sortBy) {
        case "name":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "assignee":
          aValue = a.assignedToName.toLowerCase();
          bValue = b.assignedToName.toLowerCase();
          break;
        case "dueDate":
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder];
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
        case "status":
          aValue = a.columnId;
          bValue = b.columnId;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );

    return isAdminRoute ? (
      <AppLayout>{loadingContent}</AppLayout>
    ) : (
      <AgencyLayout>{loadingContent}</AgencyLayout>
    );
  }

  const mainContent = (
    <div className="w-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
              </div>

              {activeSprint && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <Rocket className="h-4 w-4" />
                  <span className="font-medium">{activeSprint.name}</span>
                  <Badge
                    variant="outline"
                    className="bg-white border-green-300"
                  >
                    Active Sprint
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Controls Row - Visible on both Board and List */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between w-full overflow-x-auto">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Pipeline Selector */}
              <Select
                value={currentPipelineId}
                onValueChange={setCurrentPipelineId}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        {pipeline.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Pipeline Management */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Boards
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => setIsCreatePipelineDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Board
                  </DropdownMenuItem>
                  {currentPipeline && (
                    <>
                      <DropdownMenuItem
                        onClick={() => handleEditPipeline(currentPipeline)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Board
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsCreateColumnDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Column
                      </DropdownMenuItem>
                      {!currentPipeline.isDefault && (
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() =>
                            setPipelineToDelete(currentPipeline.id)
                          }
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Board
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filter Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "bg-gray-100" : ""}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>

              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1 shadow-sm border">
                <Button
                  variant={view === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("kanban")}
                  className="px-4 py-2 font-medium"
                >
                  <Kanban className="h-4 w-4 mr-2" />
                  Board
                </Button>
                <Button
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("list")}
                  className="px-4 py-2 font-medium"
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
              </div>
            </div>

            {/* Right side actions and search */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 h-8 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Dialog
                  open={isCreateSprintDialogOpen}
                  onOpenChange={setIsCreateSprintDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Rocket className="h-4 w-4 mr-2" />
                      New Sprint
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create New Sprint</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Sprint Name</Label>
                        <Input
                          value={newSprint.name}
                          onChange={(e) =>
                            setNewSprint((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Sprint 1 - Feature Development"
                        />
                      </div>
                      <div>
                        <Label>Sprint Goal</Label>
                        <Textarea
                          value={newSprint.goal}
                          onChange={(e) =>
                            setNewSprint((prev) => ({
                              ...prev,
                              goal: e.target.value,
                            }))
                          }
                          placeholder="What should be accomplished in this sprint?"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={newSprint.startDate}
                            onChange={(e) =>
                              setNewSprint((prev) => ({
                                ...prev,
                                startDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={newSprint.endDate}
                            onChange={(e) =>
                              setNewSprint((prev) => ({
                                ...prev,
                                endDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Planned Hours</Label>
                          <Input
                            type="number"
                            value={newSprint.plannedHours}
                            onChange={(e) =>
                              setNewSprint((prev) => ({
                                ...prev,
                                plannedHours: e.target.value,
                              }))
                            }
                            placeholder="80"
                          />
                        </div>
                        <div>
                          <Label>Team Capacity</Label>
                          <Input
                            type="number"
                            value={newSprint.capacity}
                            onChange={(e) =>
                              setNewSprint((prev) => ({
                                ...prev,
                                capacity: e.target.value,
                              }))
                            }
                            placeholder="120"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateSprintDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateSprint}>
                          Create Sprint
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isCreateTaskDialogOpen}
                  onOpenChange={setIsCreateTaskDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Task Title</Label>
                        <Input
                          value={newTask.title}
                          onChange={(e) =>
                            setNewTask((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Enter task title..."
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={newTask.description}
                          onChange={(e) =>
                            setNewTask((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Task description..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Priority</Label>
                          <Select
                            value={newTask.priority}
                            onValueChange={(
                              value: "low" | "medium" | "high" | "urgent",
                            ) =>
                              setNewTask((prev) => ({
                                ...prev,
                                priority: value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_PRIORITIES.map((priority) => (
                                <SelectItem
                                  key={priority.value}
                                  value={priority.value}
                                >
                                  <div className="flex items-center gap-2">
                                    <priority.icon className="h-4 w-4" />
                                    {priority.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Assignee</Label>
                          <Select
                            value={newTask.assignedTo}
                            onValueChange={(value) => {
                              const users = [
                                {
                                  id: "user-1",
                                  name: "Sarah Johnson",
                                  email: "sarah@agency.com",
                                },
                                {
                                  id: "user-2",
                                  name: "Mike Chen",
                                  email: "mike@agency.com",
                                },
                                {
                                  id: "user-3",
                                  name: "Emma Davis",
                                  email: "emma@agency.com",
                                },
                              ];
                              const user = users.find((u) => u.id === value);
                              setNewTask((prev) => ({
                                ...prev,
                                assignedTo: value,
                                assignedToName: user?.name || "",
                                assignedToEmail: user?.email || "",
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user-1">
                                Sarah Johnson
                              </SelectItem>
                              <SelectItem value="user-2">Mike Chen</SelectItem>
                              <SelectItem value="user-3">Emma Davis</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Client</Label>
                          <Select
                            value={newTask.clientId}
                            onValueChange={(value) => {
                              const clients = [
                                { id: "client-1", name: "TechCorp" },
                                { id: "client-2", name: "StartupXYZ" },
                              ];
                              const client = clients.find(
                                (c) => c.id === value,
                              );
                              setNewTask((prev) => ({
                                ...prev,
                                clientId: value,
                                clientName: client?.name || "",
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="client-1">TechCorp</SelectItem>
                              <SelectItem value="client-2">
                                StartupXYZ
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Sprint</Label>
                          <Select
                            value={newTask.sprintId}
                            onValueChange={(value) =>
                              setNewTask((prev) => ({
                                ...prev,
                                sprintId: value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select sprint (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {sprints.map((sprint) => (
                                <SelectItem key={sprint.id} value={sprint.id}>
                                  {sprint.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={newTask.dueDate}
                            onChange={(e) =>
                              setNewTask((prev) => ({
                                ...prev,
                                dueDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>Estimated Hours</Label>
                          <Input
                            type="number"
                            value={newTask.estimatedHours}
                            onChange={(e) =>
                              setNewTask((prev) => ({
                                ...prev,
                                estimatedHours: e.target.value,
                              }))
                            }
                            placeholder="8"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateTaskDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateTask}>Create Task</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">Priority</Label>
                  <Select
                    value={filters.priority}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600">Assignee</Label>
                  <Select
                    value={filters.assignedTo}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, assignedTo: value }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {[...new Set(tasks.map((t) => t.assignedToName))].map(
                        (name) => (
                          <SelectItem
                            key={name}
                            value={
                              tasks.find((t) => t.assignedToName === name)
                                ?.assignedTo || ""
                            }
                          >
                            {name}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600">Client</Label>
                  <Select
                    value={filters.client}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, client: value }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {[
                        ...new Set(
                          tasks.map((t) => t.clientName).filter(Boolean),
                        ),
                      ].map((name) => (
                        <SelectItem
                          key={name}
                          value={
                            tasks.find((t) => t.clientName === name)
                              ?.clientId || ""
                          }
                        >
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600">Project</Label>
                  <Select
                    value={filters.project}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, project: value }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {[
                        ...new Set(
                          tasks.map((t) => t.projectName).filter(Boolean),
                        ),
                      ].map((name) => (
                        <SelectItem
                          key={name}
                          value={
                            tasks.find((t) => t.projectName === name)
                              ?.projectId || ""
                          }
                        >
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600">Sprint</Label>
                  <Select
                    value={filters.sprint}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, sprint: value }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sprints</SelectItem>
                      <SelectItem value="no-sprint">No Sprint</SelectItem>
                      {sprints.map((sprint) => (
                        <SelectItem key={sprint.id} value={sprint.id}>
                          {sprint.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilters({
                        priority: "all",
                        assignedTo: "all",
                        client: "all",
                        project: "all",
                        sprint: "all",
                        category: "all",
                      })
                    }
                    className="h-8"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Kanban Board */}
        {view === "kanban" && currentPipeline && (
          <div className="w-full">
            {/* Mobile scroll hint */}
            <div className="md:hidden text-center text-xs text-muted-foreground mb-2">
              ← Swipe left and right to view all columns →
            </div>
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto overflow-y-auto p-4 w-full mobile-projects-scroll mobile-hide-scrollbar">
                <Droppable
                  droppableId="board"
                  type="column"
                  direction="horizontal"
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex gap-6 min-h-[600px] kanban-container"
                      style={{
                        width: "max-content",
                        minWidth: `${currentPipeline ? currentPipeline.columns.length * 320 : 1000}px`
                      }}
                    >
                      {currentPipeline.columns
                        .sort((a, b) => a.order - b.order)
                        .map((column, index) => (
                          <div
                            key={column.id}
                            className="kanban-column flex flex-col"
                          >
                            {/* Column Header */}
                            <div className="bg-white rounded-lg border border-gray-200 mb-4 p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: column.color }}
                                  />
                                  <h3 className="font-semibold text-gray-900">
                                    {column.title}
                                  </h3>
                                  <Badge
                                    variant="secondary"
                                    className="bg-gray-100 text-gray-700"
                                  >
                                    {getTasksByColumn(column.id).length}
                                    {column.limit && `/${column.limit}`}
                                  </Badge>
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Add Task
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleEditColumn(column)}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Column
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() =>
                                        setColumnToDelete(column.id)
                                      }
                                    >
                                      <Trash className="h-4 w-4 mr-2" />
                                      Delete Column
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Tasks */}
                            <Droppable droppableId={column.id} type="task">
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`flex-1 space-y-3 transition-colors rounded-lg p-2 ${
                                    snapshot.isDraggingOver
                                      ? "bg-purple-50 border-2 border-dashed border-purple-300"
                                      : ""
                                  }`}
                                >
                                  {getTasksByColumn(column.id).map(
                                    (task, taskIndex) => (
                                      <Draggable
                                        key={task.id}
                                        draggableId={task.id}
                                        index={taskIndex}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={`bg-white rounded-lg border border-gray-200 p-4 transition-all hover:shadow-md cursor-pointer group ${
                                              snapshot.isDragging
                                                ? "shadow-lg rotate-2 scale-105"
                                                : ""
                                            }`}
                                          >
                                            {/* Task Header */}
                                            <div className="flex items-start justify-between mb-3">
                                              <div className="flex items-center gap-2">
                                                <Badge
                                                  className={`text-xs ${getPriorityColor(task.priority)}`}
                                                >
                                                  <Flag className="h-3 w-3 mr-1" />
                                                  {task.priority.toUpperCase()}
                                                </Badge>
                                                {task.sprintName && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                  >
                                                    <Rocket className="h-3 w-3 mr-1" />
                                                    Sprint
                                                  </Badge>
                                                )}
                                              </div>

                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Details
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      handleEditTask(task)
                                                    }
                                                  >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit Task
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() =>
                                                      setTaskToDelete(task.id)
                                                    }
                                                  >
                                                    <Trash className="h-4 w-4 mr-2" />
                                                    Delete Task
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>

                                            {/* Task Title */}
                                            <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                                              {task.title}
                                            </h4>

                                            {/* Task Meta */}
                                            <div className="space-y-2">
                                              {task.description && (
                                                <p className="text-sm text-gray-600 line-clamp-2">
                                                  {task.description}
                                                </p>
                                              )}

                                              {/* Tags */}
                                              {task.tags &&
                                                task.tags.length > 0 && (
                                                  <div className="flex flex-wrap gap-1">
                                                    {task.tags
                                                      .slice(0, 3)
                                                      .map((tag) => (
                                                        <Badge
                                                          key={tag}
                                                          variant="outline"
                                                          className="text-xs bg-gray-50"
                                                        >
                                                          <Tag className="h-3 w-3 mr-1" />
                                                          {tag}
                                                        </Badge>
                                                      ))}
                                                    {task.tags.length > 3 && (
                                                      <Badge
                                                        variant="outline"
                                                        className="text-xs"
                                                      >
                                                        +{task.tags.length - 3}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                )}

                                              {/* Progress */}
                                              {task.subtasks.length > 0 && (
                                                <div className="space-y-1">
                                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <span>Subtasks</span>
                                                    <span>
                                                      {
                                                        task.subtasks.filter(
                                                          (st) => st.completed,
                                                        ).length
                                                      }
                                                      /{task.subtasks.length}
                                                    </span>
                                                  </div>
                                                  <Progress
                                                    value={
                                                      (task.subtasks.filter(
                                                        (st) => st.completed,
                                                      ).length /
                                                        task.subtasks.length) *
                                                      100
                                                    }
                                                    className="h-1"
                                                  />
                                                </div>
                                              )}
                                            </div>

                                            {/* Task Footer */}
                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                                              <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                  <AvatarImage
                                                    src={task.assignedToAvatar}
                                                  />
                                                  <AvatarFallback className="text-xs">
                                                    {task.assignedToName
                                                      .split(" ")
                                                      .map((n) => n[0])
                                                      .join("")}
                                                  </AvatarFallback>
                                                </Avatar>

                                                {task.dueDate && (
                                                  <div
                                                    className={`flex items-center gap-1 text-xs ${
                                                      isTaskOverdue(task)
                                                        ? "text-red-600"
                                                        : "text-gray-500"
                                                    }`}
                                                  >
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(
                                                      task.dueDate,
                                                    ).toLocaleDateString(
                                                      "en-US",
                                                      {
                                                        month: "short",
                                                        day: "numeric",
                                                      },
                                                    )}
                                                  </div>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-2">
                                                {task.attachments &&
                                                  task.attachments > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                      <Paperclip className="h-3 w-3" />
                                                      {task.attachments}
                                                    </div>
                                                  )}

                                                {task.comments &&
                                                  task.comments > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                      <MessageSquare className="h-3 w-3" />
                                                      {task.comments}
                                                    </div>
                                                  )}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ),
                                  )}
                                  {provided.placeholder}

                                  {/* Add Task Button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-dashed border-gray-200 hover:border-gray-300 py-2 text-xs"
                                    onClick={() =>
                                      setIsCreateTaskDialogOpen(true)
                                    }
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Task
                                  </Button>
                                </div>
                              )}
                            </Droppable>
                          </div>
                        ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </DragDropContext>
          </div>
        )}

        {/* List View - ClickUp Style */}
        {view === "list" && (
          <div className="w-full overflow-auto p-6">
            <div
              className="bg-white rounded-lg border border-gray-200 w-full"
              style={{ minWidth: "1200px" }}
            >
              {/* Table Header */}
              <div className="border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-12 gap-4 p-3 text-sm font-medium text-gray-700">
                  <button
                    className="col-span-4 flex items-center gap-1 hover:text-gray-900 text-left"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    {sortBy === "name" && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  <button
                    className="col-span-2 flex items-center gap-1 hover:text-gray-900 text-left"
                    onClick={() => handleSort("assignee")}
                  >
                    Assignee
                    {sortBy === "assignee" && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  <button
                    className="col-span-2 flex items-center gap-1 hover:text-gray-900 text-left"
                    onClick={() => handleSort("dueDate")}
                  >
                    Due date
                    {sortBy === "dueDate" && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  <button
                    className="col-span-1 flex items-center gap-1 hover:text-gray-900 text-left"
                    onClick={() => handleSort("priority")}
                  >
                    Priority
                    {sortBy === "priority" && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  <button
                    className="col-span-2 flex items-center gap-1 hover:text-gray-900 text-left"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    {sortBy === "status" && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  <div className="col-span-1">Actions</div>
                </div>
              </div>

              {/* Pipeline Groups */}
              <div className="divide-y divide-gray-100">
                {pipelines.map((pipeline) => {
                  const pipelineTasks = tasks.filter(
                    (task) => task.pipelineId === pipeline.id,
                  );

                  if (pipelineTasks.length === 0) return null;

                  return (
                    <div key={pipeline.id} className="bg-white">
                      {/* Pipeline Header */}
                      <div className="bg-gray-50 border-b border-gray-100 p-3">
                        <div className="flex items-center gap-3">
                          <FolderKanban className="h-4 w-4 text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {pipeline.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {pipelineTasks.length} tasks
                          </Badge>
                        </div>
                      </div>

                      {/* Column Groups within Pipeline */}
                      {pipeline.columns.map((column) => {
                        const columnTasks = pipelineTasks.filter(
                          (task) =>
                            task.columnId === column.id &&
                            (filters.sprint === "all" ||
                              task.sprintId === filters.sprint ||
                              (filters.sprint === "no-sprint" &&
                                !task.sprintId)) &&
                            (filters.priority === "all" ||
                              task.priority === filters.priority) &&
                            (filters.assignedTo === "all" ||
                              task.assignedTo === filters.assignedTo) &&
                            (filters.client === "all" ||
                              task.clientId === filters.client) &&
                            (filters.project === "all" ||
                              task.projectId === filters.project) &&
                            (searchQuery === "" ||
                              task.title
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              task.description
                                ?.toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              task.tags?.some((tag) =>
                                tag
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase()),
                              )),
                        );

                        if (columnTasks.length === 0) return null;

                        return (
                          <div
                            key={column.id}
                            className="border-l-4"
                            style={{ borderLeftColor: column.color }}
                          >
                            {/* Column Header */}
                            <div className="bg-gray-25 p-3 border-b border-gray-50">
                              <div className="flex items-center gap-3">
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: column.color }}
                                />
                                <span className="font-medium text-gray-700 uppercase text-xs tracking-wide">
                                  {column.title}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-gray-100"
                                  style={{ color: column.color }}
                                >
                                  {columnTasks.length}
                                </Badge>
                              </div>
                            </div>

                            {/* Tasks in Column */}
                            {sortTasks(columnTasks).map((task) => (
                              <div
                                key={task.id}
                                className="grid grid-cols-12 gap-4 p-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                              >
                                {/* Name */}
                                <div className="col-span-4 flex items-center gap-2">
                                  <div className="w-3 h-3 border border-gray-300 rounded"></div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm text-gray-900 truncate">
                                      {task.title}
                                    </h4>
                                    {task.description && (
                                      <p className="text-xs text-gray-500 truncate">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Assignee */}
                                <div className="col-span-2 flex items-center">
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage
                                        src={task.assignedToAvatar}
                                      />
                                      <AvatarFallback className="text-xs">
                                        {task.assignedToName
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-gray-700 truncate">
                                      {task.assignedToName}
                                    </span>
                                  </div>
                                </div>

                                {/* Due Date */}
                                <div className="col-span-2 flex items-center">
                                  {task.dueDate ? (
                                    <div
                                      className={`flex items-center gap-1 text-xs ${
                                        isTaskOverdue(task)
                                          ? "text-red-600"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      <Calendar className="h-3 w-3" />
                                      {new Date(
                                        task.dueDate,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      -
                                    </span>
                                  )}
                                </div>

                                {/* Priority */}
                                <div className="col-span-1 flex items-center">
                                  <Badge
                                    className={`text-xs px-1 py-0.5 ${getPriorityColor(task.priority)}`}
                                  >
                                    {task.priority === "urgent" && "🔴"}
                                    {task.priority === "high" && "🟡"}
                                    {task.priority === "medium" && "🔵"}
                                    {task.priority === "low" && "⚪"}
                                  </Badge>
                                </div>

                                {/* Status */}
                                <div className="col-span-2 flex items-center">
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-1 py-0.5"
                                    style={{
                                      backgroundColor: `${column.color}15`,
                                      borderColor: column.color,
                                      color: column.color,
                                    }}
                                  >
                                    {column.title}
                                  </Badge>
                                </div>

                                {/* Actions */}
                                <div className="col-span-1 flex items-center justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                      >
                                        <MoreHorizontal className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleEditTask(task)}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit Task
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() => setTaskToDelete(task.id)}
                                      >
                                        <Trash className="h-4 w-4 mr-2" />
                                        Delete Task
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            ))}

                            {/* Add Task Button for Column */}
                            <div className="p-3 border-b border-gray-50 last:border-b-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                onClick={() => setIsCreateTaskDialogOpen(true)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Task
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No tasks yet
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Get started by creating your first task
                      </p>
                      <Button
                        onClick={() => setIsCreateTaskDialogOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Task
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Management Dialogs */}

        {/* Edit Task Dialog */}
        <Dialog
          open={isEditTaskDialogOpen}
          onOpenChange={setIsEditTaskDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Task Title</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Enter task title..."
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Task description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(
                      value: "low" | "medium" | "high" | "urgent",
                    ) => setNewTask((prev) => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <priority.icon className="h-4 w-4" />
                            {priority.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assignee</Label>
                  <Select
                    value={newTask.assignedTo}
                    onValueChange={(value) => {
                      const users = [
                        {
                          id: "user-1",
                          name: "Sarah Johnson",
                          email: "sarah@agency.com",
                        },
                        {
                          id: "user-2",
                          name: "Mike Chen",
                          email: "mike@agency.com",
                        },
                        {
                          id: "user-3",
                          name: "Emma Davis",
                          email: "emma@agency.com",
                        },
                      ];
                      const user = users.find((u) => u.id === value);
                      setNewTask((prev) => ({
                        ...prev,
                        assignedTo: value,
                        assignedToName: user?.name || "",
                        assignedToEmail: user?.email || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user-1">Sarah Johnson</SelectItem>
                      <SelectItem value="user-2">Mike Chen</SelectItem>
                      <SelectItem value="user-3">Emma Davis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client</Label>
                  <Select
                    value={newTask.clientId}
                    onValueChange={(value) => {
                      const clients = [
                        { id: "client-1", name: "TechCorp" },
                        { id: "client-2", name: "StartupXYZ" },
                      ];
                      const client = clients.find((c) => c.id === value);
                      setNewTask((prev) => ({
                        ...prev,
                        clientId: value,
                        clientName: client?.name || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client-1">TechCorp</SelectItem>
                      <SelectItem value="client-2">StartupXYZ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sprint</Label>
                  <Select
                    value={newTask.sprintId}
                    onValueChange={(value) =>
                      setNewTask((prev) => ({ ...prev, sprintId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sprint (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {sprints.map((sprint) => (
                        <SelectItem key={sprint.id} value={sprint.id}>
                          {sprint.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Estimated Hours</Label>
                  <Input
                    type="number"
                    value={newTask.estimatedHours}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        estimatedHours: e.target.value,
                      }))
                    }
                    placeholder="8"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditTaskDialogOpen(false);
                    setEditingTask(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateTask}>Update Task</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Pipeline Dialog */}
        <Dialog
          open={isCreatePipelineDialogOpen}
          onOpenChange={setIsCreatePipelineDialogOpen}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Board Name</Label>
                <Input
                  value={newPipeline.name}
                  onChange={(e) =>
                    setNewPipeline((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Development Board"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newPipeline.description}
                  onChange={(e) =>
                    setNewPipeline((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Board description..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreatePipelineDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreatePipeline}>Create Board</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Pipeline Dialog */}
        <Dialog
          open={isEditPipelineDialogOpen}
          onOpenChange={setIsEditPipelineDialogOpen}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Board Name</Label>
                <Input
                  value={newPipeline.name}
                  onChange={(e) =>
                    setNewPipeline((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Development Board"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newPipeline.description}
                  onChange={(e) =>
                    setNewPipeline((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Board description..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditPipelineDialogOpen(false);
                    setEditingPipeline(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdatePipeline}>Update Board</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Column Dialog */}
        <Dialog
          open={isCreateColumnDialogOpen}
          onOpenChange={setIsCreateColumnDialogOpen}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Column</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Column Title</Label>
                <Input
                  value={newColumn.title}
                  onChange={(e) =>
                    setNewColumn((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="In Testing"
                />
              </div>
              <div>
                <Label>Color</Label>
                <Input
                  type="color"
                  value={newColumn.color}
                  onChange={(e) =>
                    setNewColumn((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateColumnDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateColumn}>Add Column</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Column Dialog */}
        <Dialog
          open={isEditColumnDialogOpen}
          onOpenChange={setIsEditColumnDialogOpen}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Column</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Column Title</Label>
                <Input
                  value={newColumn.title}
                  onChange={(e) =>
                    setNewColumn((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="In Testing"
                />
              </div>
              <div>
                <Label>Color</Label>
                <Input
                  type="color"
                  value={newColumn.color}
                  onChange={(e) =>
                    setNewColumn((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditColumnDialogOpen(false);
                    setEditingColumn(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateColumn}>Update Column</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmations */}
        <Dialog
          open={!!taskToDelete}
          onOpenChange={() => setTaskToDelete(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to delete this task? This action cannot be
                undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTaskToDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => taskToDelete && handleDeleteTask(taskToDelete)}
                >
                  Delete Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!pipelineToDelete}
          onOpenChange={() => setPipelineToDelete(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to delete this board? All tasks will be
                moved to another board.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPipelineToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    pipelineToDelete && handleDeletePipeline(pipelineToDelete)
                  }
                >
                  Delete Board
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!columnToDelete}
          onOpenChange={() => setColumnToDelete(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Column</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to delete this column? All tasks will be
                moved to the first column.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setColumnToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    columnToDelete && handleDeleteColumn(columnToDelete)
                  }
                >
                  Delete Column
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );

  return isAdminRoute ? (
    <AppLayout>{mainContent}</AppLayout>
  ) : (
    <AgencyLayout>{mainContent}</AgencyLayout>
  );
}
