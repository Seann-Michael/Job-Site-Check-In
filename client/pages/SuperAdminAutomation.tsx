import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Target,
  CheckCircle,
  AlertTriangle,
  Search,
  Activity,
  Workflow,
  UserPlus,
  UserMinus,
  LogIn,
  MousePointer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";
import { supabaseClient } from "@/lib/supabaseClient";
import { runTrigger, triggerRuns, type TriggerRunRow } from "@/lib/automationService";

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
    delay?: number;
    [key: string]: any;
  };
}

interface EventTrigger {
  id: string;
  name: string;
  description: string | null;
  event: string;
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  trigger_count: number;
  last_triggered: string | null;
}

const EVENT_TYPES = [
  { id: "user_login", name: "User Login", description: "When a user logs into the system", icon: LogIn, category: "user" },
  { id: "user_signup", name: "User Signup", description: "When a new user registers", icon: UserPlus, category: "user" },
  { id: "user_inactive", name: "User Inactive", description: "When a user hasn't logged in for X days", icon: UserMinus, category: "user" },
  { id: "project_created", name: "Project Created", description: "When a new project is created", icon: Plus, category: "project" },
  { id: "project_completed", name: "Project Completed", description: "When a project is marked as completed", icon: CheckCircle, category: "project" },
  { id: "review_submitted", name: "Review Submitted", description: "When a customer submits a review", icon: Target, category: "review" },
  { id: "system_error", name: "System Error", description: "When a system error occurs", icon: AlertTriangle, category: "system" },
  { id: "scheduled_time", name: "Scheduled Time", description: "At a specific time/date", icon: Clock, category: "time" },
  { id: "feature_usage", name: "Feature Usage", description: "When a user uses a specific feature", icon: MousePointer, category: "engagement" },
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

const EMPTY_FORM = {
  name: "",
  description: "",
  event: "",
  conditions: [] as TriggerCondition[],
  actions: [] as TriggerAction[],
  is_active: true,
};

export default function SuperAdminAutomation() {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Automation stats ───────────────────────────────────────────────────────
  const [autoStats, setAutoStats] = useState({ totalWorkflows: 0, activeWorkflows: 0, executions: 0 });
  const [autoStatsLoading, setAutoStatsLoading] = useState(true);
  const autoStatsFetched = useRef(false);

  useEffect(() => {
    if (autoStatsFetched.current) return;
    autoStatsFetched.current = true;
    (async () => {
      setAutoStatsLoading(true);
      const [wfRes, wfActiveRes, execRes] = await Promise.allSettled([
        supabaseClient.from("workflows").select("id", { count: "exact", head: true }),
        supabaseClient.from("workflows").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabaseClient.from("workflow_executions").select("id", { count: "exact", head: true }),
      ]);
      setAutoStats({
        totalWorkflows: wfRes.status === "fulfilled" && !wfRes.value.error ? (wfRes.value.count ?? 0) : 0,
        activeWorkflows: wfActiveRes.status === "fulfilled" && !wfActiveRes.value.error ? (wfActiveRes.value.count ?? 0) : 0,
        executions: execRes.status === "fulfilled" && !execRes.value.error ? (execRes.value.count ?? 0) : 0,
      });
      setAutoStatsLoading(false);
    })();
  }, []);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<EventTrigger | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Run-now + run-history state
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runsDialogTrigger, setRunsDialogTrigger] = useState<EventTrigger | null>(null);
  const [runs, setRuns] = useState<TriggerRunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const fetchTriggers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("event_triggers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTriggers(data || []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load event triggers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const stats = {
    totalTriggers: triggers.length,
    activeTriggers: triggers.filter((t) => t.is_active).length,
    totalExecutions: triggers.reduce((s, t) => s + (t.trigger_count || 0), 0),
    successRate:
      triggers.length > 0
        ? Math.round((triggers.filter((t) => t.is_active).length / triggers.length) * 100)
        : 0,
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingTrigger(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (trigger: EventTrigger) => {
    setEditingTrigger(trigger);
    setFormData({
      name: trigger.name,
      description: trigger.description || "",
      event: trigger.event,
      conditions: trigger.conditions || [],
      actions: trigger.actions || [],
      is_active: trigger.is_active,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.event) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (formData.actions.length === 0) {
      toast.error("Please add at least one action");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        event: formData.event,
        conditions: formData.conditions,
        actions: formData.actions,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingTrigger) {
        const { error } = await supabaseClient
          .from("event_triggers")
          .update(payload)
          .eq("id", editingTrigger.id);
        if (error) throw error;
        toast.success("Event trigger updated successfully!");
      } else {
        const { error } = await supabaseClient
          .from("event_triggers")
          .insert([{ ...payload, created_by: "Super Admin", trigger_count: 0 }]);
        if (error) throw error;
        toast.success("Event trigger created successfully!");
      }

      setShowDialog(false);
      resetForm();
      fetchTriggers();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save trigger");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (trigger: EventTrigger) => {
    try {
      const { error } = await supabaseClient
        .from("event_triggers")
        .update({ is_active: !trigger.is_active, updated_at: new Date().toISOString() })
        .eq("id", trigger.id);
      if (error) throw error;
      toast.success(`Trigger ${!trigger.is_active ? "enabled" : "disabled"}!`);
      fetchTriggers();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update trigger");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event trigger?")) return;
    try {
      const { error } = await supabaseClient
        .from("event_triggers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Event trigger deleted!");
      fetchTriggers();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete trigger");
    }
  };

  const handleRunNow = async (trigger: EventTrigger) => {
    setRunningId(trigger.id);
    try {
      const { result } = await runTrigger(trigger.id);
      const summary = `${result.status} — ${result.detail}`;
      if (result.status === "failed") toast.error(`Trigger "${trigger.name}": ${summary}`);
      else if (result.status === "skipped") toast(`Trigger "${trigger.name}": ${summary}`);
      else toast.success(`Trigger "${trigger.name}": ${summary}`);
      fetchTriggers();
      if (runsDialogTrigger?.id === trigger.id) loadRuns(trigger);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to run trigger");
    } finally {
      setRunningId(null);
    }
  };

  const loadRuns = async (trigger: EventTrigger) => {
    setRunsLoading(true);
    try {
      const { runs: rows } = await triggerRuns(trigger.id);
      setRuns(rows);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load runs");
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const handleViewRuns = (trigger: EventTrigger) => {
    setRunsDialogTrigger(trigger);
    setRuns([]);
    loadRuns(trigger);
  };

  const handleDuplicate = async (trigger: EventTrigger) => {
    try {
      const { error } = await supabaseClient.from("event_triggers").insert([
        {
          name: `${trigger.name} (Copy)`,
          description: trigger.description,
          event: trigger.event,
          conditions: trigger.conditions,
          actions: trigger.actions,
          is_active: false,
          created_by: "Super Admin",
          trigger_count: 0,
        },
      ]);
      if (error) throw error;
      toast.success("Trigger duplicated!");
      fetchTriggers();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to duplicate trigger");
    }
  };

  // Condition helpers
  const addCondition = () =>
    setFormData((p) => ({
      ...p,
      conditions: [...p.conditions, { field: "", operator: "", value: "", type: "string" }],
    }));

  const updateCondition = (index: number, field: string, value: any) =>
    setFormData((p) => ({
      ...p,
      conditions: p.conditions.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));

  const removeCondition = (index: number) =>
    setFormData((p) => ({ ...p, conditions: p.conditions.filter((_, i) => i !== index) }));

  // Action helpers
  const addAction = () =>
    setFormData((p) => ({
      ...p,
      actions: [
        ...p.actions,
        {
          type: "send_message",
          config: { messageTitle: "", messageContent: "", messageType: "info", targetAudience: "all", delay: 0 },
        },
      ],
    }));

  const updateActionConfig = (index: number, field: string, value: any) =>
    setFormData((p) => ({
      ...p,
      actions: p.actions.map((a, i) =>
        i === index ? { ...a, config: { ...a.config, [field]: value } } : a
      ),
    }));

  const updateActionType = (index: number, type: string) =>
    setFormData((p) => ({
      ...p,
      actions: p.actions.map((a, i) => (i === index ? { ...a, type: type as any } : a)),
    }));

  const removeAction = (index: number) =>
    setFormData((p) => ({ ...p, actions: p.actions.filter((_, i) => i !== index) }));

  const getEventIcon = (eventType: string) => {
    const e = EVENT_TYPES.find((ev) => ev.id === eventType);
    return e ? <e.icon className="h-4 w-4" /> : <Zap className="h-4 w-4" />;
  };

  const getEventName = (eventType: string) =>
    EVENT_TYPES.find((e) => e.id === eventType)?.name ?? eventType;

  const filteredTriggers = triggers.filter((trigger) => {
    if (statusFilter === "active" && !trigger.is_active) return false;
    if (statusFilter === "inactive" && trigger.is_active) return false;
    if (categoryFilter !== "all") {
      const ev = EVENT_TYPES.find((e) => e.id === trigger.event);
      if (ev?.category !== categoryFilter) return false;
    }
    if (
      searchTerm &&
      !trigger.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(trigger.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const skeletonRows = Array.from({ length: 4 });

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Workflow className="h-6 w-6" />
              Event Automation
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Create automated workflows triggered by user actions and system events
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchTriggers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={openCreate} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Trigger</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </div>

        {/* Automation Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Workflows", value: autoStats.totalWorkflows, sub: "All created" },
            { label: "Active Workflows", value: autoStats.activeWorkflows, sub: "Currently enabled" },
            { label: "Event Triggers", value: triggers.length, sub: "Configured triggers" },
            { label: "Trigger Fires", value: triggers.reduce((s, t) => s + (t.trigger_count || 0), 0), sub: "All-time executions" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium leading-snug">{label}</p>
              {autoStatsLoading || isLoading ? (
                <div className="h-7 w-12 mt-1 animate-pulse bg-muted rounded" />
              ) : (
                <p className="text-2xl font-bold mt-0.5">{value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTrigger ? "Edit Event Trigger" : "Create Event Trigger"}
              </DialogTitle>
              <DialogDescription>
                Set up automated actions that execute when specific events occur
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              {/* Basic Info */}
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Trigger Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Welcome New Users"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Describe what this trigger does..."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="event">Event Type *</Label>
                    <Select
                      value={formData.event}
                      onValueChange={(v) => setFormData((p) => ({ ...p, event: v }))}
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
                                <div className="font-medium">{event.name}</div>
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
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData((p) => ({ ...p, is_active: checked }))
                      }
                    />
                    <Label htmlFor="isActive">Enable this trigger</Label>
                  </div>
                </div>
              </TabsContent>

              {/* Conditions */}
              <TabsContent value="conditions" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Trigger Conditions</h3>
                    <p className="text-sm text-muted-foreground">
                      Define when this trigger should fire (leave empty to fire for all events)
                    </p>
                  </div>
                  <Button onClick={addCondition} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Condition
                  </Button>
                </div>
                {formData.conditions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Activity className="h-8 w-8 mx-auto mb-2" />
                    <p>No conditions — trigger will fire for all matching events</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.conditions.map((condition, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                        <div className="col-span-3">
                          <Label className="text-xs">Field</Label>
                          <Input
                            value={condition.field}
                            onChange={(e) => updateCondition(index, "field", e.target.value)}
                            placeholder="field name"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={condition.type}
                            onValueChange={(v) => updateCondition(index, "type", v)}
                          >
                            <SelectTrigger>
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
                            onValueChange={(v) => updateCondition(index, "operator", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(CONDITION_OPERATORS[condition.type as keyof typeof CONDITION_OPERATORS] || []).map(
                                (op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Value</Label>
                          <Input
                            value={condition.value}
                            onChange={(e) => updateCondition(index, "value", e.target.value)}
                            placeholder="value"
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(index)}
                            className="h-9 w-9 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Actions */}
              <TabsContent value="actions" className="space-y-4 pt-4">
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
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Zap className="h-8 w-8 mx-auto mb-2" />
                    <p>No actions defined — add at least one action</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.actions.map((action, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Action #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => removeAction(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label>Action Type</Label>
                            <Select
                              value={action.type}
                              onValueChange={(v) => updateActionType(index, v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="send_message">Send Message</SelectItem>
                                <SelectItem value="send_email">Send Email</SelectItem>
                                <SelectItem value="update_user">Update User</SelectItem>
                                <SelectItem value="create_task">Create Task</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {action.type === "send_message" && (
                            <>
                              <div className="grid gap-2">
                                <Label>Message Title</Label>
                                <Input
                                  value={action.config.messageTitle || ""}
                                  onChange={(e) => updateActionConfig(index, "messageTitle", e.target.value)}
                                  placeholder="Enter message title..."
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>Message Content</Label>
                                <Textarea
                                  value={action.config.messageContent || ""}
                                  onChange={(e) => updateActionConfig(index, "messageContent", e.target.value)}
                                  placeholder="Enter message content..."
                                  rows={3}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                  <Label>Message Type</Label>
                                  <Select
                                    value={action.config.messageType || "info"}
                                    onValueChange={(v) => updateActionConfig(index, "messageType", v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="info">Information</SelectItem>
                                      <SelectItem value="success">Success</SelectItem>
                                      <SelectItem value="warning">Warning</SelectItem>
                                      <SelectItem value="error">Error</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Target Audience</Label>
                                  <Select
                                    value={action.config.targetAudience || "all"}
                                    onValueChange={(v) => updateActionConfig(index, "targetAudience", v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All Users</SelectItem>
                                      <SelectItem value="business-owners">Business Owners</SelectItem>
                                      <SelectItem value="agency-admins">Agency Admins</SelectItem>
                                      <SelectItem value="staff">Staff</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid gap-2">
                                <Label>Delay (seconds)</Label>
                                <Input
                                  type="number"
                                  value={action.config.delay ?? 0}
                                  onChange={(e) =>
                                    updateActionConfig(index, "delay", parseInt(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                />
                              </div>
                            </>
                          )}
                          {action.type === "send_email" && (
                            <>
                              <div className="grid gap-2">
                                <Label>Email Subject</Label>
                                <Input
                                  value={action.config.emailSubject || ""}
                                  onChange={(e) => updateActionConfig(index, "emailSubject", e.target.value)}
                                  placeholder="Email subject..."
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>Email Body</Label>
                                <Textarea
                                  value={action.config.emailBody || ""}
                                  onChange={(e) => updateActionConfig(index, "emailBody", e.target.value)}
                                  placeholder="Email body..."
                                  rows={4}
                                />
                              </div>
                            </>
                          )}
                          {(action.type === "update_user" || action.type === "create_task") && (
                            <div className="grid gap-2">
                              <Label>Configuration (JSON)</Label>
                              <Textarea
                                value={
                                  typeof action.config.rawConfig === "string"
                                    ? action.config.rawConfig
                                    : JSON.stringify(action.config, null, 2)
                                }
                                onChange={(e) => updateActionConfig(index, "rawConfig", e.target.value)}
                                placeholder='{ "key": "value" }'
                                rows={4}
                                className="font-mono text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : editingTrigger ? "Update Trigger" : "Create Trigger"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Run history dialog */}
        <Dialog open={!!runsDialogTrigger} onOpenChange={(open) => !open && setRunsDialogTrigger(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Recent Runs — {runsDialogTrigger?.name}</DialogTitle>
              <DialogDescription>
                Execution log for this trigger (most recent first).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {runsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <Activity className="h-8 w-8 mx-auto mb-2" />
                  <p>No runs recorded yet. Use "Run now" to execute it.</p>
                </div>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {run.status === "success" ? (
                          <Badge className="bg-green-500">Success</Badge>
                        ) : run.status === "failed" ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : (
                          <Badge variant="secondary">Skipped</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{run.event}</span>
                      </div>
                      {run.detail && (
                        <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {JSON.stringify(run.detail, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatSystemDate(run.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => runsDialogTrigger && loadRuns(runsDialogTrigger)}
                disabled={runsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${runsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Triggers</p>
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
                  <p className="text-sm text-muted-foreground">Active Triggers</p>
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
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold">{stats.totalExecutions.toLocaleString()}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Rate</p>
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
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
                    <SelectItem value="engagement">Engagement Events</SelectItem>
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
                    <TableHead className="hidden sm:table-cell">Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Executions</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Triggered</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? skeletonRows.map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(6)].map((__, j) => (
                            <TableCell key={j}>
                              <div className="h-4 bg-muted animate-pulse rounded w-24" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : filteredTriggers.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            No event triggers found. Create one to get started.
                          </TableCell>
                        </TableRow>
                      )
                    : filteredTriggers.map((trigger) => (
                        <TableRow key={trigger.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate text-sm sm:text-base">
                                {trigger.name}
                              </p>
                              {trigger.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {trigger.description}
                                </p>
                              )}
                              <div className="sm:hidden mt-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  {getEventIcon(trigger.event)}
                                  <span className="text-xs text-muted-foreground">
                                    {getEventName(trigger.event)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              {getEventIcon(trigger.event)}
                              <span className="text-sm">{getEventName(trigger.event)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {trigger.is_active ? (
                              <Badge className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="font-medium">
                              {(trigger.trigger_count || 0).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">
                              {trigger.last_triggered ? (
                                <>
                                  <div>{formatSystemDate(trigger.last_triggered)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(trigger.last_triggered).toLocaleTimeString()}
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
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleRunNow(trigger)}
                                  disabled={runningId === trigger.id}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  {runningId === trigger.id ? "Running…" : "Run now"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewRuns(trigger)}>
                                  <Activity className="h-4 w-4 mr-2" />
                                  View runs
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(trigger)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(trigger)}>
                                  {trigger.is_active ? (
                                    <Pause className="h-4 w-4 mr-2" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                  )}
                                  {trigger.is_active ? "Disable" : "Enable"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(trigger)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(trigger.id)}
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
