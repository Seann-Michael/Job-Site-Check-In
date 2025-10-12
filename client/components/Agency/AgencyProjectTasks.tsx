import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Clock,
  User,
  CheckCircle,
  Circle,
  AlertCircle,
  Trash,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  AgencyProjectTask,
  AgencyTaskComment,
  TASK_STATUSES,
  TASK_PRIORITIES,
} from "@/types/agency";

interface AgencyProjectTasksProps {
  projectId: string;
  tasks: AgencyProjectTask[];
  onTasksChange: (tasks: AgencyProjectTask[]) => void;
}

export function AgencyProjectTasks({
  projectId,
  tasks,
  onTasksChange,
}: AgencyProjectTasksProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyProjectTask | null>(
    null,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    status?: string;
    assignedTo?: string;
    priority?: string;
  }>({});

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    assignedToType: "internal" as "internal" | "client",
    assignedToName: "",
    assignedToEmail: "",
    dueDate: "",
    estimatedHours: "",
  });

  const handleCreateTask = async () => {
    try {
      if (!newTask.title.trim()) {
        throw new Error("Task title is required");
      }

      if (!newTask.assignedToName.trim() || !newTask.assignedToEmail.trim()) {
        throw new Error("Please specify who the task is assigned to");
      }

      const task: AgencyProjectTask = {
        id: `task-${Date.now()}`,
        projectId,
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        status: "todo",
        priority: newTask.priority,
        assignedTo:
          newTask.assignedToType === "internal" ? "user-new" : "client-new",
        assignedToType: newTask.assignedToType,
        assignedToName: newTask.assignedToName.trim(),
        assignedToEmail: newTask.assignedToEmail.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: newTask.dueDate || undefined,
        estimatedHours: newTask.estimatedHours
          ? Number(newTask.estimatedHours)
          : undefined,
        createdBy: "current-user",
        comments: [],
        attachments: [],
      };

      onTasksChange([...tasks, task]);

      // Reset form
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        assignedToType: "internal",
        assignedToName: "",
        assignedToEmail: "",
        dueDate: "",
        estimatedHours: "",
      });

      setIsCreateDialogOpen(false);
      toast.success("Task created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create task",
      );
    }
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: string) => {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: newStatus as any,
            updatedAt: new Date().toISOString(),
            completedDate:
              newStatus === "completed" ? new Date().toISOString() : undefined,
          }
        : task,
    );
    onTasksChange(updatedTasks);
    toast.success("Task status updated");
  };

  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter((task) => task.id !== taskId);
    onTasksChange(updatedTasks);
    toast.success("Task deleted");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in-progress":
        return <Circle className="h-4 w-4 text-blue-600" />;
      case "review":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "cancelled":
        return <Circle className="h-4 w-4 text-red-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "outline";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in-progress":
        return "secondary";
      case "review":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isTaskOverdue = (task: AgencyProjectTask) => {
    if (!task.dueDate || task.status === "completed") return false;
    return new Date(task.dueDate) < new Date();
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter.status && task.status !== filter.status) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.assignedTo && task.assignedToType !== filter.assignedTo)
      return false;
    return true;
  });

  // Group tasks by status
  const tasksByStatus = {
    todo: filteredTasks.filter((t) => t.status === "todo"),
    "in-progress": filteredTasks.filter((t) => t.status === "in-progress"),
    review: filteredTasks.filter((t) => t.status === "review"),
    completed: filteredTasks.filter((t) => t.status === "completed"),
    cancelled: filteredTasks.filter((t) => t.status === "cancelled"),
  };

  return (
    <div className="space-y-4">
      {/* Header with filters and create button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          <Select
            value={filter.status || "all"}
            onValueChange={(value) =>
              setFilter((prev) => ({
                ...prev,
                status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filter.assignedTo || "all"}
            onValueChange={(value) =>
              setFilter((prev) => ({
                ...prev,
                assignedTo: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="internal">Internal Team</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title *</Label>
                <Input
                  id="task-title"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Enter task title..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Task description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value: any) =>
                      setNewTask((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assign to</Label>
                  <Select
                    value={newTask.assignedToType}
                    onValueChange={(value: any) =>
                      setNewTask((prev) => ({ ...prev, assignedToType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Team</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignee-name">Assignee Name *</Label>
                  <Input
                    id="assignee-name"
                    value={newTask.assignedToName}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        assignedToName: e.target.value,
                      }))
                    }
                    placeholder="Enter name..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee-email">Email *</Label>
                  <Input
                    id="assignee-email"
                    type="email"
                    value={newTask.assignedToEmail}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        assignedToEmail: e.target.value,
                      }))
                    }
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
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

                <div className="space-y-2">
                  <Label htmlFor="estimated-hours">Estimated Hours</Label>
                  <Input
                    id="estimated-hours"
                    type="number"
                    value={newTask.estimatedHours}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        estimatedHours: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTask}>Create Task</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <Card key={status}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {TASK_STATUSES.find((s) => s.value === status)?.label}
                  </p>
                  <p className="text-2xl font-bold">{statusTasks.length}</p>
                </div>
                {getStatusIcon(status)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No tasks found</p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first task
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={`transition-colors hover:shadow-md ${
                isTaskOverdue(task) ? "border-red-200 bg-red-50/50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={(checked) =>
                        handleUpdateTaskStatus(
                          task.id,
                          checked ? "completed" : "todo",
                        )
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge variant={getStatusVariant(task.status)}>
                          {
                            TASK_STATUSES.find((s) => s.value === task.status)
                              ?.label
                          }
                        </Badge>
                        <Badge variant={getPriorityColor(task.priority) as any}>
                          {
                            TASK_PRIORITIES.find(
                              (p) => p.value === task.priority,
                            )?.label
                          }
                        </Badge>
                        {isTaskOverdue(task) && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>
                            {task.assignedToName} (
                            {task.assignedToType === "internal"
                              ? "Team"
                              : "Client"}
                            )
                          </span>
                        </div>

                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Due {formatDate(task.dueDate)}</span>
                          </div>
                        )}

                        {task.estimatedHours && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {task.actualHours || 0}/{task.estimatedHours}h
                            </span>
                          </div>
                        )}

                        {task.comments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            <span>{task.comments.length} comments</span>
                          </div>
                        )}

                        {task.attachments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            <span>{task.attachments.length} files</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {TASK_STATUSES.map((status) => (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() =>
                            handleUpdateTaskStatus(task.id, status.value)
                          }
                          disabled={task.status === status.value}
                        >
                          {getStatusIcon(status.value)}
                          <span className="ml-2">{status.label}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-600"
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
