// @ts-nocheck - Temporary suppression of type errors
import React, { useState, useEffect } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Zap,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  Clock,
  Users,
  Target,
  TrendingUp,
  Calendar,
  Bell,
  UserPlus,
  UserMinus,
  LogIn,
  MousePointer,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
  Filter,
  Search,
  Activity,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";

interface EventTrigger {
  id: string;
  name: string;
  description: string;
  event: string;
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  triggerCount: number;
  lastTriggered?: string;
  template?: string;
}

interface TriggerCondition {
  field: string;
  operator: string;
  value: string;
  type: "string" | "number" | "date" | "boolean";
}

interface TriggerAction {
  type: "send_message" | "send_email" | "update_user" | "create_task";
  config: {
    messageTitle?: string;
    messageContent?: string;
    messageType?: "info" | "warning" | "success" | "error";
    targetAudience?: string;
    template?: string;
    delay?: number;
    [key: string]: any;
  };
}

interface AutomationStats {
  totalTriggers: number;
  activeTriggers: number;
  totalExecutions: number;
  successRate: number;
}

const EVENT_TYPES = [
  {
    id: "user_login",
    name: "User Login",
    description: "When a user logs into the system",
    icon: LogIn,
    category: "user",
  },
  {
    id: "user_signup",
    name: "User Signup",
    description: "When a new user registers",
    icon: UserPlus,
    category: "user",
  },
  {
    id: "user_inactive",
    name: "User Inactive",
    description: "When a user hasn't logged in for X days",
    icon: UserMinus,
    category: "user",
  },
  {
    id: "project_created",
    name: "Project Created",
    description: "When a new project is created",
    icon: Plus,
    category: "project",
  },
  {
    id: "project_completed",
    name: "Project Completed",
    description: "When a project is marked as completed",
    icon: CheckCircle,
    category: "project",
  },
  {
    id: "review_submitted",
    name: "Review Submitted",
    description: "When a customer submits a review",
    icon: Target,
    category: "review",
  },
  {
    id: "system_error",
    name: "System Error",
    description: "When a system error occurs",
    icon: AlertTriangle,
    category: "system",
  },
  {
    id: "scheduled_time",
    name: "Scheduled Time",
    description: "At a specific time/date",
    icon: Clock,
    category: "time",
  },
  {
    id: "feature_usage",
    name: "Feature Usage",
    description: "When a user uses a specific feature",
    icon: MousePointer,
    category: "engagement",
  },
];

const CONDITION_OPERATORS = {
  string: [
    { value: "equals", label: "Equals" },
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
  ],
  number: [
    { value: "equals", label: "Equals" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
    { value: "between", label: "Between" },
  ],
  date: [
    { value: "equals", label: "On date" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "days_ago", label: "Days ago" },
  ],
  boolean: [
    { value: "is_true", label: "Is true" },
    { value: "is_false", label: "Is false" },
  ],
};

export default function SuperAdminAutomation() {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [stats, setStats] = useState<AutomationStats>({
    totalTriggers: 0,
    activeTriggers: 0,
    totalExecutions: 0,
    successRate: 0,
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<EventTrigger | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event: "",
    conditions: [] as TriggerCondition[],
    actions: [] as TriggerAction[],
    isActive: true,
  });

  useEffect(() => {
    loadAutomationData();
  }, []);

  const loadAutomationData = () => {
    const storedTriggers = localStorage.getItem("eventTriggers");
    const mockTriggers: EventTrigger[] = storedTriggers
      ? JSON.parse(storedTriggers)
      : [
          {
            id: "welcome-new-users",
            name: "Welcome New Users",
            description: "Send welcome message to newly registered users",
            event: "user_signup",
            conditions: [],
            actions: [
              {
                type: "send_message",
                config: {
                  messageTitle: "Welcome to GMB Booster!",
                  messageContent:
                    "Welcome to our platform! We're excited to help you boost your Google My Business presence. Here are some quick tips to get started...",
                  messageType: "success",
                  targetAudience: "all",
                  delay: 0,
                },
              },
            ],
            isActive: true,
            createdAt: "2024-01-10T10:00:00Z",
            updatedAt: "2024-01-10T10:00:00Z",
            createdBy: "Super Admin",
            triggerCount: 45,
            lastTriggered: "2024-01-20T14:30:00Z",
          },
          {
            id: "inactive-user-reminder",
            name: "Inactive User Reminder",
            description: "Remind users who haven't logged in for 7 days",
            event: "user_inactive",
            conditions: [
              {
                field: "days_inactive",
                operator: "equals",
                value: "7",
                type: "number",
              },
            ],
            actions: [
              {
                type: "send_message",
                config: {
                  messageTitle: "We miss you!",
                  messageContent:
                    "You haven't logged in for a week. Check out what's new and continue building your online presence!",
                  messageType: "info",
                  targetAudience: "all",
                  delay: 0,
                },
              },
            ],
            isActive: true,
            createdAt: "2024-01-05T15:00:00Z",
            updatedAt: "2024-01-15T12:00:00Z",
            createdBy: "Super Admin",
            triggerCount: 23,
            lastTriggered: "2024-01-19T09:15:00Z",
          },
          {
            id: "project-completion-celebration",
            name: "Project Completion Celebration",
            description: "Celebrate when users complete their first project",
            event: "project_completed",
            conditions: [
              {
                field: "project_count",
                operator: "equals",
                value: "1",
                type: "number",
              },
            ],
            actions: [
              {
                type: "send_message",
                config: {
                  messageTitle: "🎉 Congratulations on your first project!",
                  messageContent:
                    "Amazing work! You've completed your first project. This is just the beginning of your success story. Keep going!",
                  messageType: "success",
                  targetAudience: "all",
                  delay: 300,
                },
              },
            ],
            isActive: true,
            createdAt: "2024-01-08T11:30:00Z",
            updatedAt: "2024-01-08T11:30:00Z",
            createdBy: "Super Admin",
            triggerCount: 12,
            lastTriggered: "2024-01-18T16:45:00Z",
          },
          {
            id: "review-thank-you",
            name: "Review Thank You",
            description: "Thank users when they submit a positive review",
            event: "review_submitted",
            conditions: [
              {
                field: "rating",
                operator: "greater_than",
                value: "3",
                type: "number",
              },
            ],
            actions: [
              {
                type: "send_message",
                config: {
                  messageTitle: "Thank you for your positive review!",
                  messageContent:
                    "We're thrilled that you're happy with our platform! Your feedback helps us continue improving.",
                  messageType: "success",
                  targetAudience: "all",
                  delay: 600,
                },
              },
            ],
            isActive: false,
            createdAt: "2024-01-12T09:00:00Z",
            updatedAt: "2024-01-16T14:20:00Z",
            createdBy: "Super Admin",
            triggerCount: 8,
            lastTriggered: "2024-01-17T11:30:00Z",
          },
        ];

    setTriggers(mockTriggers);

    // Calculate stats
    const totalExecutions = mockTriggers.reduce(
      (sum, t) => sum + t.triggerCount,
      0,
    );
    setStats({
      totalTriggers: mockTriggers.length,
      activeTriggers: mockTriggers.filter((t) => t.isActive).length,
      totalExecutions,
      successRate: 94.5, // Mock success rate
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      event: "",
      conditions: [],
      actions: [],
      isActive: true,
    });
    setEditingTrigger(null);
  };

  const handleCreateTrigger = () => {
    if (!formData.name.trim() || !formData.event) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.actions.length === 0) {
      toast.error("Please add at least one action");
      return;
    }

    const newTrigger: EventTrigger = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      event: formData.event,
      conditions: formData.conditions,
      actions: formData.actions,
      isActive: formData.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Super Admin",
      triggerCount: 0,
    };

    const updatedTriggers = [...triggers, newTrigger];
    setTriggers(updatedTriggers);
    localStorage.setItem("eventTriggers", JSON.stringify(updatedTriggers));

    toast.success("Event trigger created successfully!");
    setShowCreateDialog(false);
    resetForm();
    loadAutomationData();
  };

  const handleEditTrigger = (trigger: EventTrigger) => {
    setEditingTrigger(trigger);
    setFormData({
      name: trigger.name,
      description: trigger.description,
      event: trigger.event,
      conditions: trigger.conditions,
      actions: trigger.actions,
      isActive: trigger.isActive,
    });
    setShowCreateDialog(true);
  };

  const handleUpdateTrigger = () => {
    if (!editingTrigger) return;

    const updatedTrigger: EventTrigger = {
      ...editingTrigger,
      name: formData.name,
      description: formData.description,
      event: formData.event,
      conditions: formData.conditions,
      actions: formData.actions,
      isActive: formData.isActive,
      updatedAt: new Date().toISOString(),
    };

    const updatedTriggers = triggers.map((t) =>
      t.id === editingTrigger.id ? updatedTrigger : t,
    );
    setTriggers(updatedTriggers);
    localStorage.setItem("eventTriggers", JSON.stringify(updatedTriggers));

    toast.success("Event trigger updated successfully!");
    setShowCreateDialog(false);
    resetForm();
    loadAutomationData();
  };

  const handleToggleActive = (triggerId: string) => {
    const updatedTriggers = triggers.map((t) =>
      t.id === triggerId ? { ...t, isActive: !t.isActive } : t,
    );
    setTriggers(updatedTriggers);
    localStorage.setItem("eventTriggers", JSON.stringify(updatedTriggers));
    toast.success("Trigger status updated!");
    loadAutomationData();
  };

  const handleDeleteTrigger = (triggerId: string) => {
    const updatedTriggers = triggers.filter((t) => t.id !== triggerId);
    setTriggers(updatedTriggers);
    localStorage.setItem("eventTriggers", JSON.stringify(updatedTriggers));
    toast.success("Event trigger deleted successfully!");
    loadAutomationData();
  };

  const handleDuplicateTrigger = (trigger: EventTrigger) => {
    const duplicatedTrigger: EventTrigger = {
      ...trigger,
      id: Date.now().toString(),
      name: `${trigger.name} (Copy)`,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggerCount: 0,
      lastTriggered: undefined,
    };

    const updatedTriggers = [...triggers, duplicatedTrigger];
    setTriggers(updatedTriggers);
    localStorage.setItem("eventTriggers", JSON.stringify(updatedTriggers));
    toast.success("Event trigger duplicated successfully!");
    loadAutomationData();
  };

  const addCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { field: "", operator: "", value: "", type: "string" },
      ],
    }));
  };

  const updateCondition = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) =>
        i === index ? { ...condition, [field]: value } : condition,
      ),
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const addAction = () => {
    setFormData((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          type: "send_message",
          config: {
            messageTitle: "",
            messageContent: "",
            messageType: "info",
            targetAudience: "all",
            delay: 0,
          },
        },
      ],
    }));
  };

  const updateAction = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index
          ? { ...action, config: { ...action.config, [field]: value } }
          : action,
      ),
    }));
  };

  const removeAction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const getEventIcon = (eventType: string) => {
    const event = EVENT_TYPES.find((e) => e.id === eventType);
    return event ? (
      <event.icon className="h-4 w-4" />
    ) : (
      <Zap className="h-4 w-4" />
    );
  };

  const getEventName = (eventType: string) => {
    const event = EVENT_TYPES.find((e) => e.id === eventType);
    return event ? event.name : eventType;
  };

  const filteredTriggers = triggers.filter((trigger) => {
    if (statusFilter !== "all") {
      if (statusFilter === "active" && !trigger.isActive) return false;
      if (statusFilter === "inactive" && trigger.isActive) return false;
    }
    if (categoryFilter !== "all") {
      const eventType = EVENT_TYPES.find((e) => e.id === trigger.event);
      if (eventType?.category !== categoryFilter) return false;
    }
    if (
      searchTerm &&
      !trigger.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !trigger.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Workflow className="h-6 w-6" />
              Event Automation
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Create automated workflows triggered by user actions and system
              events
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Trigger</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTrigger
                    ? "Edit Event Trigger"
                    : "Create Event Trigger"}
                </DialogTitle>
                <DialogDescription>
                  Set up automated actions that execute when specific events
                  occur
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="conditions">Conditions</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Trigger Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., Welcome New Users"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Describe what this trigger does..."
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="event">Event Type *</Label>
                      <Select
                        value={formData.event}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, event: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              <div className="flex items-center gap-2">
                                <event.icon className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">
                                    {event.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {event.description}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            isActive: checked,
                          }))
                        }
                      />
                      <Label htmlFor="isActive">Enable this trigger</Label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="conditions" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Trigger Conditions</h3>
                      <p className="text-sm text-muted-foreground">
                        Define when this trigger should fire
                      </p>
                    </div>
                    <Button onClick={addCondition} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Condition
                    </Button>
                  </div>
                  {formData.conditions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2" />
                      <p>
                        No conditions set - trigger will fire for all events
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.conditions.map((condition, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg"
                        >
                          <div className="col-span-3">
                            <Label className="text-xs">Field</Label>
                            <Input
                              value={condition.field}
                              onChange={(e) =>
                                updateCondition(index, "field", e.target.value)
                              }
                              placeholder="field name"
                              size="sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={condition.type}
                              onValueChange={(value) =>
                                updateCondition(index, "type", value)
                              }
                            >
                              <SelectTrigger size="sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Operator</Label>
                            <Select
                              value={condition.operator}
                              onValueChange={(value) =>
                                updateCondition(index, "operator", value)
                              }
                            >
                              <SelectTrigger size="sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPERATORS[
                                  condition.type as keyof typeof CONDITION_OPERATORS
                                ]?.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Value</Label>
                            <Input
                              value={condition.value}
                              onChange={(e) =>
                                updateCondition(index, "value", e.target.value)
                              }
                              placeholder="value"
                              size="sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCondition(index)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Actions to Execute</h3>
                      <p className="text-sm text-muted-foreground">
                        Define what happens when the trigger fires
                      </p>
                    </div>
                    <Button onClick={addAction} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Action
                    </Button>
                  </div>
                  {formData.actions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-8 w-8 mx-auto mb-2" />
                      <p>No actions defined - add at least one action</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.actions.map((action, index) => (
                        <div
                          key={index}
                          className="p-4 border rounded-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Action #{index + 1}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAction(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-3">
                            <div className="grid gap-2">
                              <Label>Action Type</Label>
                              <Select
                                value={action.type}
                                onValueChange={(value) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    actions: prev.actions.map((a, i) =>
                                      i === index
                                        ? { ...a, type: value as any }
                                        : a,
                                    ),
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="send_message">
                                    Send Message
                                  </SelectItem>
                                  <SelectItem value="send_email">
                                    Send Email
                                  </SelectItem>
                                  <SelectItem value="update_user">
                                    Update User
                                  </SelectItem>
                                  <SelectItem value="create_task">
                                    Create Task
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {action.type === "send_message" && (
                              <>
                                <div className="grid gap-2">
                                  <Label>Message Title</Label>
                                  <Input
                                    value={action.config.messageTitle || ""}
                                    onChange={(e) =>
                                      updateAction(
                                        index,
                                        "messageTitle",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Enter message title..."
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Message Content</Label>
                                  <Textarea
                                    value={action.config.messageContent || ""}
                                    onChange={(e) =>
                                      updateAction(
                                        index,
                                        "messageContent",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Enter message content..."
                                    rows={3}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="grid gap-2">
                                    <Label>Message Type</Label>
                                    <Select
                                      value={
                                        action.config.messageType || "info"
                                      }
                                      onValueChange={(value) =>
                                        updateAction(
                                          index,
                                          "messageType",
                                          value,
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="info">
                                          Information
                                        </SelectItem>
                                        <SelectItem value="success">
                                          Success
                                        </SelectItem>
                                        <SelectItem value="warning">
                                          Warning
                                        </SelectItem>
                                        <SelectItem value="error">
                                          Error
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Target Audience</Label>
                                    <Select
                                      value={
                                        action.config.targetAudience || "all"
                                      }
                                      onValueChange={(value) =>
                                        updateAction(
                                          index,
                                          "targetAudience",
                                          value,
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">
                                          All Users
                                        </SelectItem>
                                        <SelectItem value="business-owners">
                                          Business Owners
                                        </SelectItem>
                                        <SelectItem value="agency-admins">
                                          Agency Admins
                                        </SelectItem>
                                        <SelectItem value="staff">
                                          Staff
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Delay (seconds)</Label>
                                  <Input
                                    type="number"
                                    value={action.config.delay || 0}
                                    onChange={(e) =>
                                      updateAction(
                                        index,
                                        "delay",
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    placeholder="0"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={
                    editingTrigger ? handleUpdateTrigger : handleCreateTrigger
                  }
                >
                  {editingTrigger ? "Update Trigger" : "Create Trigger"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Triggers
                  </p>
                  <p className="text-2xl font-bold">{stats.totalTriggers}</p>
                </div>
                <Workflow className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Triggers
                  </p>
                  <p className="text-2xl font-bold">{stats.activeTriggers}</p>
                </div>
                <Play className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Executions
                  </p>
                  <p className="text-2xl font-bold">{stats.totalExecutions}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{stats.successRate}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search triggers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="user">User Events</SelectItem>
                    <SelectItem value="project">Project Events</SelectItem>
                    <SelectItem value="review">Review Events</SelectItem>
                    <SelectItem value="system">System Events</SelectItem>
                    <SelectItem value="time">Time Events</SelectItem>
                    <SelectItem value="engagement">
                      Engagement Events
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Triggers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Event Triggers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="responsive-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Event
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Executions
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Last Triggered
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTriggers.map((trigger) => (
                    <TableRow key={trigger.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm sm:text-base">
                            {trigger.name}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {trigger.description}
                          </p>
                          <div className="sm:hidden mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {getEventIcon(trigger.event)}
                              <span className="text-xs text-muted-foreground">
                                {getEventName(trigger.event)}
                              </span>
                            </div>
                            <div className="md:hidden text-xs text-muted-foreground">
                              {trigger.triggerCount} executions
                            </div>
                            <div className="lg:hidden text-xs text-muted-foreground">
                              {trigger.lastTriggered
                                ? `Last: ${formatSystemDate(trigger.lastTriggered)}`
                                : "Never triggered"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          {getEventIcon(trigger.event)}
                          <span className="text-sm">
                            {getEventName(trigger.event)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trigger.isActive ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="font-medium">
                          {trigger.triggerCount}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          {trigger.lastTriggered ? (
                            <>
                              <div>
                                {formatSystemDate(trigger.lastTriggered)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(
                                  trigger.lastTriggered,
                                ).toLocaleTimeString()}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditTrigger(trigger)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(trigger.id)}
                            >
                              {trigger.isActive ? (
                                <Pause className="h-4 w-4 mr-2" />
                              ) : (
                                <Play className="h-4 w-4 mr-2" />
                              )}
                              {trigger.isActive ? "Disable" : "Enable"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicateTrigger(trigger)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteTrigger(trigger.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
