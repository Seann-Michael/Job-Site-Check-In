import React, { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
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
import { useNavigate } from "react-router-dom";

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

interface AdminTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  tags: string[];
  columnId: string;
  attachments?: number;
  comments?: number;
  checklist?: {
    total: number;
    completed: number;
  };
  timeTracked?: number;
  estimatedTime?: number;
}

// Mock data
const mockColumns: TaskColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    color: "gray",
    order: 0,
  },
  {
    id: "todo",
    title: "To Do",
    color: "blue",
    order: 1,
  },
  {
    id: "in-progress",
    title: "In Progress",
    color: "yellow",
    order: 2,
    limit: 3,
  },
  {
    id: "review",
    title: "Review",
    color: "purple",
    order: 3,
  },
  {
    id: "done",
    title: "Done",
    color: "green",
    order: 4,
  },
];

const mockTasks: AdminTask[] = [
  {
    id: "1",
    title: "Optimize geo-grid scan performance",
    description: "Improve scan performance for large datasets",
    status: "in-progress",
    priority: "high",
    assignee: "John Smith",
    dueDate: "2024-01-25",
    createdAt: "2024-01-15T09:00:00Z",
    tags: ["optimization", "backend"],
    columnId: "in-progress",
    comments: 3,
    checklist: {
      total: 5,
      completed: 2,
    },
    timeTracked: 240,
    estimatedTime: 480,
  },
  {
    id: "2",
    title: "Add bulk actions to scan history",
    description: "Implement bulk delete and export functionality",
    status: "done",
    priority: "medium",
    assignee: "Jane Doe",
    dueDate: "2024-01-20",
    createdAt: "2024-01-10T14:30:00Z",
    tags: ["feature", "ui"],
    columnId: "done",
    attachments: 2,
    comments: 1,
    checklist: {
      total: 3,
      completed: 3,
    },
    timeTracked: 180,
    estimatedTime: 240,
  },
  {
    id: "3",
    title: "Fix dropdown positioning issues",
    description: "Resolve Radix UI dropdown alignment problems",
    status: "todo",
    priority: "medium",
    assignee: "Mike Johnson",
    dueDate: "2024-01-22",
    createdAt: "2024-01-18T11:15:00Z",
    tags: ["bug", "ui"],
    columnId: "todo",
    comments: 2,
  },
  {
    id: "4",
    title: "Implement AI keyword suggestions",
    description: "Add smart keyword recommendations based on GMB data",
    status: "backlog",
    priority: "low",
    createdAt: "2024-01-12T16:00:00Z",
    tags: ["ai", "feature"],
    columnId: "backlog",
  },
];

export default function AdminTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AdminTask[]>(mockTasks);
  const [columns] = useState<TaskColumn[]>(mockColumns);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === draggableId
            ? { ...task, columnId: destination.droppableId }
            : task
        )
      );
      toast.success("Task moved successfully");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || task.columnId === filterStatus;
    const matchesPriority = filterPriority === "all" || task.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getTasksByColumn = (columnId: string) => {
    return filteredTasks.filter((task) => task.columnId === columnId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const TaskCard = ({ task }: { task: AdminTask }) => (
    <Card
      className="mb-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/admin/tasks/${task.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/tasks/${task.id}`);
              }}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/tasks/${task.id}`);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          <Badge variant={getPriorityColor(task.priority)} className="text-xs">
            {task.priority}
          </Badge>
          {task.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {task.checklist && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>
                {task.checklist.completed}/{task.checklist.total}
              </span>
            </div>
            <Progress
              value={(task.checklist.completed / task.checklist.total) * 100}
              className="h-1"
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            {task.assignee && (
              <div className="flex items-center space-x-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {task.assignee.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center space-x-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {task.comments && (
              <div className="flex items-center space-x-1">
                <MessageSquare className="h-3 w-3" />
                <span>{task.comments}</span>
              </div>
            )}
            {task.attachments && (
              <div className="flex items-center space-x-1">
                <Paperclip className="h-3 w-3" />
                <span>{task.attachments}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
            <p className="text-gray-600">Manage and track your team's tasks</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="h-4 w-4 mr-2" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input placeholder="Enter task title" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea placeholder="Enter task description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Priority</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input type="date" />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      toast.success("Task created successfully");
                      setIsCreateDialogOpen(false);
                    }}>
                      Create Task
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {columns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Kanban View */}
        {viewMode === "kanban" && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 overflow-x-auto">
              {columns.map((column) => (
                <div key={column.id} className="min-w-[280px]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full bg-${column.color}-500`}
                      />
                      <h3 className="font-medium text-sm">{column.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {getTasksByColumn(column.id).length}
                      </Badge>
                    </div>
                    {column.limit && (
                      <Badge
                        variant={
                          getTasksByColumn(column.id).length >= column.limit
                            ? "destructive"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {getTasksByColumn(column.id).length}/{column.limit}
                      </Badge>
                    )}
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] p-2 rounded-lg border-2 border-dashed transition-colors ${
                          snapshot.isDraggingOver
                            ? "border-primary bg-primary/5"
                            : "border-gray-200"
                        }`}
                      >
                        {getTasksByColumn(column.id).map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`${
                                  snapshot.isDragging ? "rotate-2 shadow-lg" : ""
                                }`}
                              >
                                <TaskCard task={task} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4 font-medium">Task</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Priority</th>
                      <th className="text-left p-4 font-medium">Assignee</th>
                      <th className="text-left p-4 font-medium">Due Date</th>
                      <th className="text-left p-4 font-medium">Progress</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {columns.find((c) => c.id === task.columnId)?.title}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {task.assignee && (
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {task.assignee.split(" ").map((n) => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{task.assignee}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {task.dueDate && (
                            <span className="text-sm">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {task.checklist && (
                            <div className="w-24">
                              <Progress
                                value={(task.checklist.completed / task.checklist.total) * 100}
                                className="h-2"
                              />
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
