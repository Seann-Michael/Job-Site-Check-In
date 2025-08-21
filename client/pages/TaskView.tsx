import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AgencyLayout } from "@/components/AgencyLayout";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Users,
  Tag,
  Flag,
  Edit,
  Plus,
  Trash,
  Play,
  Pause,
  CheckCircle,
  Circle,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  Link,
  Activity,
  Timer,
  FileText,
  Upload,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  AtSign,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  AlertCircle,
  Info,
  Download,
  Share,
  Copy,
  Settings,
  Archive,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  AgencyProjectTask,
  AgencyTaskComment,
  AgencyProjectDocument,
  AgencyProjectSubtask,
  TASK_STATUSES,
  TASK_PRIORITIES,
} from "@/types/agency";

// Extended interfaces for the comprehensive task view
interface ExtendedTask extends AgencyProjectTask {
  sprint?: {
    id: string;
    name: string;
  };
  blockers?: TaskBlocker[];
  workLogs?: WorkLogEntry[];
  tags?: string[];
  watchers?: string[];
  linkedTasks?: LinkedTask[];
  activityLog?: ActivityLogEntry[];
  storyPoints?: number;
  startDate?: string;
}

interface TaskBlocker {
  id: string;
  type: "blocked-by" | "blocks";
  taskId: string;
  taskTitle: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
}

interface WorkLogEntry {
  id: string;
  userId: string;
  userName: string;
  timeSpent: number; // in minutes
  description: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  type: "related" | "duplicate" | "blocks" | "blocked-by";
}

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  description: string;
}

interface TaskNote {
  id: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  mentions?: string[];
}

// Mock data for demonstration
const mockTask: ExtendedTask = {
  id: "task-1",
  projectId: "project-1",
  title: "Implement comprehensive task management system",
  description:
    "Create a detailed task view page with JIRA-like functionality including notes, attachments, sub-tasks, work logs, and activity tracking.",
  status: "in-progress",
  priority: "high",
  assignedTo: "user-1",
  assignedToType: "internal",
  assignedToName: "John Smith",
  assignedToEmail: "john@example.com",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-20T14:30:00Z",
  dueDate: "2024-01-30",
  startDate: "2024-01-15",
  estimatedHours: 40,
  actualHours: 24,
  createdBy: "user-2",
  comments: [],
  attachments: [],
  subtasks: [
    {
      id: "subtask-1",
      title: "Design task view layout",
      completed: true,
      createdAt: "2024-01-15T10:00:00Z",
      completedAt: "2024-01-16T15:00:00Z",
    },
    {
      id: "subtask-2",
      title: "Implement notes functionality",
      completed: true,
      createdAt: "2024-01-16T09:00:00Z",
      completedAt: "2024-01-18T16:00:00Z",
    },
    {
      id: "subtask-3",
      title: "Add work logging feature",
      completed: false,
      createdAt: "2024-01-18T11:00:00Z",
    },
    {
      id: "subtask-4",
      title: "Implement activity tracking",
      completed: false,
      createdAt: "2024-01-19T14:00:00Z",
    },
  ],
  sprint: {
    id: "sprint-1",
    name: "Q1 Development Sprint",
  },
  tags: ["development", "ui", "feature"],
  storyPoints: 8,
  blockers: [
    {
      id: "blocker-1",
      type: "blocked-by",
      taskId: "task-2",
      taskTitle: "API endpoint development",
      reason: "Waiting for backend implementation",
      createdAt: "2024-01-17T10:00:00Z",
      createdBy: "user-1",
    },
  ],
  workLogs: [
    {
      id: "log-1",
      userId: "user-1",
      userName: "John Smith",
      timeSpent: 480, // 8 hours
      description: "Initial design and component structure",
      date: "2024-01-16",
      startTime: "09:00",
      endTime: "17:00",
    },
    {
      id: "log-2",
      userId: "user-1",
      userName: "John Smith",
      timeSpent: 360, // 6 hours
      description: "Implemented notes and comments functionality",
      date: "2024-01-18",
      startTime: "10:00",
      endTime: "16:00",
    },
  ],
  linkedTasks: [
    {
      id: "task-2",
      title: "API endpoint development",
      status: "in-progress",
      type: "blocks",
    },
    {
      id: "task-3",
      title: "Database schema updates",
      status: "completed",
      type: "related",
    },
  ],
  activityLog: [
    {
      id: "activity-1",
      userId: "user-1",
      userName: "John Smith",
      action: "status_changed",
      field: "status",
      oldValue: "todo",
      newValue: "in-progress",
      timestamp: "2024-01-16T09:00:00Z",
      description: "moved task from To Do to In Progress",
    },
    {
      id: "activity-2",
      userId: "user-2",
      userName: "Jane Doe",
      action: "comment_added",
      timestamp: "2024-01-17T14:00:00Z",
      description: "added a comment",
    },
    {
      id: "activity-3",
      userId: "user-1",
      userName: "John Smith",
      action: "subtask_completed",
      timestamp: "2024-01-18T16:00:00Z",
      description: "completed subtask 'Implement notes functionality'",
    },
  ],
  watchers: ["user-1", "user-2", "user-3"],
};

const mockNotes: TaskNote[] = [
  {
    id: "note-1",
    content:
      "Initial implementation is progressing well. The UI components are coming together nicely. @jane.doe please review the design mockups when ready.",
    isInternal: false,
    authorId: "user-1",
    authorName: "John Smith",
    createdAt: "2024-01-17T10:00:00Z",
    updatedAt: "2024-01-17T10:00:00Z",
    mentions: ["jane.doe"],
  },
  {
    id: "note-2",
    content:
      "There's a dependency on the backend API that might cause delays. We should prioritize the API development.",
    isInternal: true,
    authorId: "user-2",
    authorName: "Jane Doe",
    createdAt: "2024-01-18T14:00:00Z",
    updatedAt: "2024-01-18T14:00:00Z",
  },
  {
    id: "note-3",
    content:
      "Client requested additional features for the notes section. @john.smith let's discuss in our next meeting.",
    isInternal: false,
    authorId: "user-3",
    authorName: "Mike Johnson",
    createdAt: "2024-01-19T11:30:00Z",
    updatedAt: "2024-01-19T11:30:00Z",
    mentions: ["john.smith"],
  },
];

const availableUsers = [
  { id: "user-1", name: "John Smith", email: "john@example.com" },
  { id: "user-2", name: "Jane Doe", email: "jane@example.com" },
  { id: "user-3", name: "Mike Johnson", email: "mike@example.com" },
  { id: "user-4", name: "Sarah Wilson", email: "sarah@example.com" },
];

const availableSprints = [
  { id: "sprint-1", name: "Q1 Development Sprint" },
  { id: "sprint-2", name: "Feature Enhancement Sprint" },
  { id: "sprint-3", name: "Bug Fix Sprint" },
];

export default function TaskView() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin/');

  const [task, setTask] = useState<ExtendedTask>(mockTask);
  const [notes, setNotes] = useState<TaskNote[]>(mockNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<ExtendedTask>(mockTask);
  const [newNote, setNewNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "external">(
    "external",
  );
  const [newSubtask, setNewSubtask] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newWorkLog, setNewWorkLog] = useState({
    timeSpent: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [isAddingWorkLog, setIsAddingWorkLog] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showInternalNotes, setShowInternalNotes] = useState(true);
  const [timeTracking, setTimeTracking] = useState({
    isActive: false,
    startTime: null as Date | null,
    elapsedTime: 0,
  });

  useEffect(() => {
    // In a real app, fetch task data based on taskId
    if (taskId && taskId !== task.id) {
      // Fetch task data from API
      console.log(`Loading task ${taskId}`);
    }
  }, [taskId, task.id]);

  // Time tracking effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeTracking.isActive && timeTracking.startTime) {
      interval = setInterval(() => {
        setTimeTracking((prev) => ({
          ...prev,
          elapsedTime: Date.now() - (prev.startTime?.getTime() || 0),
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeTracking.isActive, timeTracking.startTime]);

  const handleSaveTask = () => {
    setTask(editedTask);
    setIsEditing(false);
    toast.success("Task updated successfully");
  };

  const handleStatusChange = (newStatus: string) => {
    const updatedTask = {
      ...task,
      status: newStatus as any,
      updatedAt: new Date().toISOString(),
      completedDate:
        newStatus === "completed" ? new Date().toISOString() : undefined,
    };
    setTask(updatedTask);
    setEditedTask(updatedTask);
    toast.success(`Task status changed to ${newStatus}`);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const note: TaskNote = {
      id: `note-${Date.now()}`,
      content: newNote,
      isInternal: noteVisibility === "internal",
      authorId: "current-user",
      authorName: "Current User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mentions: extractMentions(newNote),
    };

    setNotes([...notes, note]);
    setNewNote("");
    toast.success("Note added successfully");
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+(?:\.\w+)?)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;

    const subtask: AgencyProjectSubtask = {
      id: `subtask-${Date.now()}`,
      title: newSubtask,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const updatedTask = {
      ...task,
      subtasks: [...(task.subtasks || []), subtask],
    };
    setTask(updatedTask);
    setEditedTask(updatedTask);
    setNewSubtask("");
    setIsAddingSubtask(false);
    toast.success("Subtask added successfully");
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks =
      task.subtasks?.map((st) =>
        st.id === subtaskId
          ? {
              ...st,
              completed: !st.completed,
              completedAt: !st.completed ? new Date().toISOString() : undefined,
            }
          : st,
      ) || [];

    const updatedTask = { ...task, subtasks: updatedSubtasks };
    setTask(updatedTask);
    setEditedTask(updatedTask);
    toast.success("Subtask updated");
  };

  const handleAddWorkLog = () => {
    if (!newWorkLog.timeSpent || !newWorkLog.description.trim()) return;

    const workLog: WorkLogEntry = {
      id: `log-${Date.now()}`,
      userId: "current-user",
      userName: "Current User",
      timeSpent: parseInt(newWorkLog.timeSpent) * 60, // convert hours to minutes
      description: newWorkLog.description,
      date: newWorkLog.date,
    };

    const updatedTask = {
      ...task,
      workLogs: [...(task.workLogs || []), workLog],
      actualHours: (task.actualHours || 0) + parseInt(newWorkLog.timeSpent),
    };
    setTask(updatedTask);
    setEditedTask(updatedTask);
    setNewWorkLog({
      timeSpent: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
    setIsAddingWorkLog(false);
    toast.success("Work log added successfully");
  };

  const handleAddTag = () => {
    if (!newTag.trim() || task.tags?.includes(newTag)) return;

    const updatedTask = {
      ...task,
      tags: [...(task.tags || []), newTag],
    };
    setTask(updatedTask);
    setEditedTask(updatedTask);
    setNewTag("");
    toast.success("Tag added successfully");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTask = {
      ...task,
      tags: task.tags?.filter((tag) => tag !== tagToRemove) || [],
    };
    setTask(updatedTask);
    setEditedTask(updatedTask);
    toast.success("Tag removed");
  };

  const startTimeTracking = () => {
    setTimeTracking({
      isActive: true,
      startTime: new Date(),
      elapsedTime: 0,
    });
    toast.success("Time tracking started");
  };

  const stopTimeTracking = () => {
    if (timeTracking.startTime && timeTracking.elapsedTime > 0) {
      const hours =
        Math.round((timeTracking.elapsedTime / (1000 * 60 * 60)) * 100) / 100;
      setNewWorkLog({
        ...newWorkLog,
        timeSpent: hours.toString(),
        description: "Time tracked work session",
      });
      setIsAddingWorkLog(true);
    }
    setTimeTracking({
      isActive: false,
      startTime: null,
      elapsedTime: 0,
    });
    toast.success("Time tracking stopped");
  };

  const formatTimeSpent = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatElapsedTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in-progress":
        return <Circle className="h-4 w-4 text-blue-600" />;
      case "review":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "cancelled":
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
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

  const completedSubtasks =
    task.subtasks?.filter((st) => st.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const progressPercentage =
    totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <p className="text-sm text-gray-600">Task #{task.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {timeTracking.isActive ? (
              <div className="flex items-center space-x-2">
                <div className="text-sm font-mono bg-green-100 text-green-800 px-2 py-1 rounded">
                  {formatElapsedTime(timeTracking.elapsedTime)}
                </div>
                <Button size="sm" variant="outline" onClick={stopTimeTracking}>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={startTimeTracking}>
                <Play className="h-4 w-4 mr-2" />
                Start Timer
              </Button>
            )}
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? "Save" : "Edit"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share className="h-4 w-4 mr-2" />
                  Share Task
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Task Details</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(task.status)}
                    <Badge variant={getPriorityColor(task.priority) as any}>
                      {
                        TASK_PRIORITIES.find((p) => p.value === task.priority)
                          ?.label
                      }
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editedTask.title}
                        onChange={(e) =>
                          setEditedTask({
                            ...editedTask,
                            title: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={editedTask.description || ""}
                        onChange={(e) =>
                          setEditedTask({
                            ...editedTask,
                            description: e.target.value,
                          })
                        }
                        rows={4}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleSaveTask}>Save Changes</Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-700">{task.description}</p>
                  </div>
                )}

                {/* Progress Bar */}
                {totalSubtasks > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>
                        {completedSubtasks}/{totalSubtasks} subtasks completed
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subtasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    Subtasks ({completedSubtasks}/{totalSubtasks})
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingSubtask(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subtask
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isAddingSubtask && (
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Enter subtask title..."
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                    />
                    <Button size="sm" onClick={handleAddSubtask}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddingSubtask(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {task.subtasks?.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={subtask.completed}
                      onCheckedChange={() => handleToggleSubtask(subtask.id)}
                    />
                    <span
                      className={
                        subtask.completed ? "line-through text-gray-500" : ""
                      }
                    >
                      {subtask.title}
                    </span>
                    {subtask.completedAt && (
                      <span className="text-xs text-gray-400">
                        Completed{" "}
                        {new Date(subtask.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
                {(!task.subtasks || task.subtasks.length === 0) &&
                  !isAddingSubtask && (
                    <p className="text-gray-500 text-center py-4">
                      No subtasks yet
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Tabs for Notes, Activity, Work Log */}
            <Card>
              <Tabs defaultValue="notes" className="w-full">
                <CardHeader>
                  <TabsList>
                    <TabsTrigger value="notes">Notes & Comments</TabsTrigger>
                    <TabsTrigger value="activity">Activity Log</TabsTrigger>
                    <TabsTrigger value="worklog">Work Log</TabsTrigger>
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                  </TabsList>
                </CardHeader>

                <TabsContent value="notes">
                  <CardContent className="space-y-4">
                    {/* Add Note */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Add Note</Label>
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">Visibility:</Label>
                          <Select
                            value={noteVisibility}
                            onValueChange={(value: any) =>
                              setNoteVisibility(value)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="external">
                                <div className="flex items-center">
                                  <Eye className="h-4 w-4 mr-2" />
                                  External
                                </div>
                              </SelectItem>
                              <SelectItem value="internal">
                                <div className="flex items-center">
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Internal Only
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Write a note... Use @username to mention someone"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                    </div>

                    <Separator />

                    {/* Filter Toggle */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={showInternalNotes}
                        onCheckedChange={(checked) =>
                          setShowInternalNotes(checked === true)
                        }
                      />
                      <Label>Show internal notes</Label>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-4">
                      {notes
                        .filter((note) => showInternalNotes || !note.isInternal)
                        .map((note) => (
                          <div
                            key={note.id}
                            className="border rounded-lg p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {note.authorName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">
                                  {note.authorName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(note.createdAt).toLocaleString()}
                                </span>
                                {note.isInternal && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Internal
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {note.content}
                            </p>
                            {note.mentions && note.mentions.length > 0 && (
                              <div className="flex items-center space-x-1 text-xs text-blue-600">
                                <AtSign className="h-3 w-3" />
                                <span>
                                  Mentioned: {note.mentions.join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </TabsContent>

                <TabsContent value="activity">
                  <CardContent>
                    <div className="space-y-4">
                      {task.activityLog?.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start space-x-3 pb-3 border-b last:border-b-0"
                        >
                          <Avatar className="h-6 w-6 mt-1">
                            <AvatarFallback className="text-xs">
                              {activity.userName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-medium">
                                {activity.userName}
                              </span>{" "}
                              {activity.description}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </TabsContent>

                <TabsContent value="worklog">
                  <CardContent className="space-y-4">
                    {/* Add Work Log */}
                    {isAddingWorkLog && (
                      <div className="border rounded-lg p-4 space-y-3">
                        <h4 className="font-medium">Log Work</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Time Spent (hours)</Label>
                            <Input
                              type="number"
                              placeholder="e.g., 2.5"
                              value={newWorkLog.timeSpent}
                              onChange={(e) =>
                                setNewWorkLog({
                                  ...newWorkLog,
                                  timeSpent: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Date</Label>
                            <Input
                              type="date"
                              value={newWorkLog.date}
                              onChange={(e) =>
                                setNewWorkLog({
                                  ...newWorkLog,
                                  date: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            placeholder="What work was done?"
                            value={newWorkLog.description}
                            onChange={(e) =>
                              setNewWorkLog({
                                ...newWorkLog,
                                description: e.target.value,
                              })
                            }
                            rows={2}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button onClick={handleAddWorkLog}>Log Work</Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddingWorkLog(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {!isAddingWorkLog && (
                      <Button onClick={() => setIsAddingWorkLog(true)}>
                        <Timer className="h-4 w-4 mr-2" />
                        Log Work
                      </Button>
                    )}

                    {/* Work Log Entries */}
                    <div className="space-y-3">
                      {task.workLogs?.map((log) => (
                        <div key={log.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {log.userName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">
                                {log.userName}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {formatTimeSpent(log.timeSpent)}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-500">
                              {log.date}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {log.description}
                          </p>
                        </div>
                      ))}
                      {(!task.workLogs || task.workLogs.length === 0) && (
                        <p className="text-gray-500 text-center py-4">
                          No work logged yet
                        </p>
                      )}
                    </div>

                    {/* Work Summary */}
                    {task.workLogs && task.workLogs.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="font-medium mb-2">Time Summary</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Total Logged:</span>
                            <span className="ml-2 font-medium">
                              {formatTimeSpent(
                                task.workLogs.reduce(
                                  (sum, log) => sum + log.timeSpent,
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Estimated:</span>
                            <span className="ml-2 font-medium">
                              {task.estimatedHours}h
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </TabsContent>

                <TabsContent value="attachments">
                  <CardContent className="space-y-4">
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Attachment
                    </Button>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No attachments yet</p>
                      <p className="text-sm text-gray-400">
                        Drag and drop files here or click upload
                      </p>
                    </div>
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status and Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Status & Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={task.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center">
                            {getStatusIcon(status.value)}
                            <span className="ml-2">{status.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select
                    value={task.priority}
                    onValueChange={(value) =>
                      setTask({ ...task, priority: value as any })
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

                <div>
                  <Label>Assignee</Label>
                  <Select
                    value={task.assignedTo || "unassigned"}
                    onValueChange={(value) => {
                      const user = availableUsers.find((u) => u.id === value);
                      if (user) {
                        setTask({
                          ...task,
                          assignedTo: value,
                          assignedToName: user.name,
                          assignedToEmail: user.email,
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sprint</Label>
                  <Select
                    value={task.sprint?.id || "none"}
                    onValueChange={(value) => {
                      const sprint = availableSprints.find(
                        (s) => s.id === value,
                      );
                      setTask({
                        ...task,
                        sprint: sprint
                          ? { id: sprint.id, name: sprint.name }
                          : undefined,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Sprint</SelectItem>
                      {availableSprints.map((sprint) => (
                        <SelectItem key={sprint.id} value={sprint.id}>
                          {sprint.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={task.startDate?.split("T")[0] || ""}
                    onChange={(e) =>
                      setTask({ ...task, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={task.dueDate?.split("T")[0] || ""}
                    onChange={(e) =>
                      setTask({ ...task, dueDate: e.target.value })
                    }
                  />
                </div>
                {task.completedDate && (
                  <div>
                    <Label>Completed Date</Label>
                    <Input
                      type="date"
                      value={task.completedDate.split("T")[0]}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Created: {new Date(task.createdAt).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                  Updated: {new Date(task.updatedAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>

            {/* Time Tracking */}
            <Card>
              <CardHeader>
                <CardTitle>Time Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Estimated</Label>
                    <Input
                      type="number"
                      value={task.estimatedHours || ""}
                      onChange={(e) =>
                        setTask({
                          ...task,
                          estimatedHours: parseInt(e.target.value) || undefined,
                        })
                      }
                      placeholder="Hours"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Actual</Label>
                    <Input
                      value={`${task.actualHours || 0}h`}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                {task.estimatedHours && task.actualHours && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>
                        {Math.round(
                          (task.actualHours / task.estimatedHours) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <Progress
                      value={(task.actualHours / task.estimatedHours) * 100}
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {task.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button size="sm" onClick={handleAddTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Blockers */}
            {task.blockers && task.blockers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
                    Blockers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {task.blockers.map((blocker) => (
                      <div
                        key={blocker.id}
                        className="p-2 bg-yellow-50 rounded border"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {blocker.taskTitle}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {blocker.type}
                          </Badge>
                        </div>
                        {blocker.reason && (
                          <p className="text-xs text-gray-600 mt-1">
                            {blocker.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Tasks */}
            {task.linkedTasks && task.linkedTasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Link className="h-4 w-4 mr-2" />
                    Linked Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {task.linkedTasks.map((linkedTask) => (
                      <div
                        key={linkedTask.id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <span className="text-sm">{linkedTask.title}</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {linkedTask.type}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {linkedTask.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
