import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Settings,
  Play,
  Save,
  Trash2,
  Zap,
  Mail,
  MessageSquare,
  Webhook,
  Database,
  Clock,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Briefcase,
  Code2,
  Layers,
  Copy,
  Eye,
  X,
  Phone,
  Timer,
  Rss,
} from "lucide-react";

interface WorkflowStep {
  id: string;
  type: "trigger" | "action";
  app: string;
  action: string;
  configured: boolean;
  config: Record<string, any>;
}

interface AppAction {
  id: string;
  name: string;
  description: string;
  secondary?: boolean;
}

const availableApps = [
  // Triggers
  {
    type: "trigger",
    app: "webhook",
    name: "Webhook",
    icon: Webhook,
    color: "bg-blue-500",
    actions: [
      {
        id: "receive",
        name: "Receive Webhook",
        description: "Trigger when webhook is received",
      },
      {
        id: "send_webhook",
        name: "Send Webhook",
        description: "Send webhook to external service (secondary trigger)",
        secondary: true,
      },
    ],
  },
  {
    type: "trigger",
    app: "tags",
    name: "Tags",
    icon: Settings,
    color: "bg-pink-500",
    actions: [
      {
        id: "tag_added",
        name: "Tag Added",
        description: "When tag is added to contact",
      },
      {
        id: "tag_removed",
        name: "Tag Removed",
        description: "When tag is removed from contact",
      },
      {
        id: "add_tag",
        name: "Add Tag",
        description: "Trigger workflow when a tag is applied to a contact",
      },
      {
        id: "remove_tag",
        name: "Remove Tag",
        description: "Trigger workflow when a tag is removed from a contact",
      },
    ],
  },
  {
    type: "trigger",
    app: "jobs",
    name: "Jobs",
    icon: Briefcase,
    color: "bg-teal-500",
    actions: [
      {
        id: "job_created",
        name: "Job Created",
        description: "When a new job is created",
      },
      {
        id: "job_completed",
        name: "Job Completed",
        description: "When a job is completed",
      },
      {
        id: "create_job",
        name: "Create Job",
        description: "Create a new job (secondary trigger)",
        secondary: true,
      },
    ],
  },
  {
    type: "trigger",
    app: "reviews",
    name: "Reviews",
    icon: Mail,
    color: "bg-green-500",
    actions: [
      {
        id: "review_request_sent",
        name: "Review Request Sent",
        description: "When a review request is sent",
      },
      {
        id: "positive_review_received",
        name: "Positive Review Received",
        description: "When a positive review is received",
      },
      {
        id: "negative_review_received",
        name: "Negative Review Received",
        description: "When a negative review is received",
      },
    ],
  },

  {
    type: "trigger",
    app: "communication",
    name: "Communication",
    icon: Phone,
    color: "bg-violet-500",
    actions: [
      {
        id: "send_sms",
        name: "Send SMS",
        description: "Send an SMS message to a contact",
        secondary: true,
      },
      {
        id: "send_email",
        name: "Send Email",
        description: "Send an email to a contact",
        secondary: true,
      },
    ],
  },
  {
    type: "trigger",
    app: "time",
    name: "Time",
    icon: Timer,
    color: "bg-amber-500",
    actions: [
      {
        id: "wait",
        name: "Wait",
        description: "Pause the workflow for a set amount of time",
        secondary: true,
      },
    ],
  },

  // Actions - Reviews
  {
    type: "action",
    app: "reviews",
    name: "Reviews",
    icon: Mail,
    color: "bg-green-500",
    actions: [
      {
        id: "send_review_email",
        name: "Send Review Email",
        description: "Send review request via email",
      },
      {
        id: "send_review_sms",
        name: "Send Review SMS",
        description: "Send review request via SMS",
      },
    ],
  },

  // Actions - Communication
  {
    type: "action",
    app: "communication",
    name: "Communication",
    icon: Phone,
    color: "bg-violet-500",
    actions: [
      {
        id: "send_sms",
        name: "Send SMS",
        description: "Send an SMS message to a contact",
      },
      {
        id: "send_email",
        name: "Send Email",
        description: "Send an email to a contact",
      },
    ],
  },
  {
    type: "action",
    app: "webhook",
    name: "Webhook",
    icon: Webhook,
    color: "bg-blue-500",
    actions: [
      {
        id: "send_webhook",
        name: "Send Webhook",
        description: "Send data to external service",
      },
    ],
  },
  // Actions - Social Media
  {
    type: "action",
    app: "gmb",
    name: "Google My Business",
    icon: Database,
    color: "bg-red-500",
    actions: [
      {
        id: "post_to_gmb",
        name: "Post to Google My Business",
        description: "Create a post on Google My Business",
      },
    ],
  },
  // Actions - Workflow Management
  {
    type: "action",
    app: "workflow",
    name: "Workflow",
    icon: GitBranch,
    color: "bg-indigo-500",
    actions: [
      {
        id: "add_to_workflow",
        name: "Add to Workflow",
        description: "Add contact to another workflow",
      },
      {
        id: "remove_from_workflow",
        name: "Remove from Workflow",
        description: "Remove contact from workflow",
      },
    ],
  },
  {
    type: "action",
    app: "tags",
    name: "Tags",
    icon: Settings,
    color: "bg-pink-500",
    actions: [
      { id: "add_tag", name: "Add Tag", description: "Add tag to contact" },
      {
        id: "remove_tag",
        name: "Remove Tag",
        description: "Remove tag from contact",
      },
    ],
  },

  // Actions - Utilities
  {
    type: "action",
    app: "delay",
    name: "Wait",
    icon: Clock,
    color: "bg-yellow-500",
    actions: [
      {
        id: "wait",
        name: "Wait",
        description: "Wait for specified time before next action",
      },
    ],
  },
  {
    type: "action",
    app: "api",
    name: "API",
    icon: Database,
    color: "bg-gray-500",
    actions: [
      {
        id: "api_call",
        name: "API Call",
        description: "Make custom API request",
      },
    ],
  },
  {
    type: "action",
    app: "rss",
    name: "RSS Feed",
    icon: Rss,
    color: "bg-orange-500",
    actions: [
      {
        id: "publish_item",
        name: "Publish to RSS Feed",
        description: "Add a new item to your hosted RSS feed (WordPress can subscribe)",
      },
    ],
  },
];

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [workflowName, setWorkflowName] = useState(
    id ? `Workflow ${id}` : "New Workflow",
  );
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [showAppSelector, setShowAppSelector] = useState(false);
  const [selectorType, setSelectorType] = useState<"trigger" | "action">(
    "trigger",
  );
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [showStepConfig, setShowStepConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  // Pre-generate an ID for new workflows so the webhook URL is available immediately
  const [workflowId, setWorkflowId] = useState<string | null>(
    id || crypto.randomUUID()
  );
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  // Load workflow if editing existing one
  useEffect(() => {
    if (id) {
      loadWorkflow(id);
    }
  }, [id]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      const workflow = await dataService.getWorkflow(workflowId);
      if (workflow) {
        setWorkflowName(workflow.name as string);
        setWorkflowDescription((workflow.description || "") as string);
        setSteps((workflow.steps || []) as WorkflowStep[]);
      }
    } catch (error) {
      console.error("Error loading workflow:", error);
      toast({
        title: "Error",
        description: "Failed to load workflow",
        variant: "destructive",
      });
    }
  };

  const addStep = (app: any, actionData: any) => {
    const noConfigNeeded =
      (app.app === "jobs" && actionData.id === "job_completed") ||
      (app.app === "jobs" && actionData.id === "job_created") ||
      (app.app === "reviews" && actionData.id === "review_request_sent");
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      type: app.type,
      app: app.app,
      action: actionData.id,
      configured: noConfigNeeded,
      config: {},
    };
    setSteps([...steps, newStep]);
    setShowAppSelector(false);
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((step) => step.id !== stepId));
  };

  const editStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setShowStepConfig(true);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(
      steps.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step,
      ),
    );
  };

  const saveStepConfig = (config: Record<string, any>) => {
    if (editingStep) {
      updateStep(editingStep.id, {
        config,
        configured: Object.keys(config).length > 0,
      });
      setShowStepConfig(false);
      setEditingStep(null);
    }
  };

  const getStepIcon = (app: string) => {
    const appData = availableApps.find((a) => a.app === app);
    return appData?.icon || Settings;
  };

  const getStepColor = (app: string) => {
    const appData = availableApps.find((a) => a.app === app);
    return appData?.color || "bg-gray-500";
  };

  const getStepName = (app: string, action: string) => {
    // availableApps has duplicate app identifiers (e.g. "reviews" as trigger & action),
    // so we must check ALL entries with a matching app, not just the first.
    for (const appData of availableApps) {
      if (appData.app === app) {
        const actionData = appData.actions.find((act) => act.id === action);
        if (actionData) return actionData.name;
      }
    }
    return "Unknown Action";
  };

  const canAddTrigger = steps.filter((s) => s.type === "trigger").length === 0;
  const hasTrigger = steps.some((s) => s.type === "trigger");

  const saveWorkflow = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to save workflows",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (workflowId) {
        // Update existing workflow
        await dataService.updateWorkflow(workflowId, {
          name: workflowName,
          description: workflowDescription,
          steps,
        });
        toast({
          title: "Success",
          description: "Workflow updated successfully",
        });
      } else {
        // Create new workflow using the pre-generated ID
        const workflow = await dataService.createWorkflow(
          user.id,
          workflowName,
          steps,
          workflowDescription,
          workflowId ?? undefined,
        );
        setWorkflowId(workflow.id as string);
        toast({
          title: "Success",
          description: "Workflow created successfully",
        });
      }
    } catch (error) {
      console.error("Error saving workflow:", error);
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const publishWorkflow = async () => {
    if (!user || !workflowId) {
      toast({
        title: "Error",
        description: "Save workflow before publishing",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPublishing(true);
      await dataService.publishWorkflow(workflowId);

      // Generate webhook URL if there's a webhook trigger
      const webhookTrigger = steps.find(
        (s) => s.type === "trigger" && s.app === "webhook",
      );
      if (webhookTrigger) {
        const urlData = await dataService.generateWebhookUrl(
          workflowId,
          user.id,
        );
        setWebhookUrl(urlData.webhookUrl as string);
      }

      toast({
        title: "Success",
        description: "Workflow published successfully",
      });
    } catch (error) {
      console.error("Error publishing workflow:", error);
      toast({
        title: "Error",
        description: "Failed to publish workflow",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/automations")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Workflow Builder</h1>
              <p className="text-muted-foreground">
                {id ? `Editing workflow ${id}` : "Create a new workflow"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveWorkflow}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              size="sm"
              disabled={!hasTrigger || isPublishing}
              onClick={publishWorkflow}
            >
              <Play className="mr-2 h-4 w-4" />
              {isPublishing ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>

        {/* Workflow Name */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Enter workflow name"
                className="text-lg font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Input
                id="workflow-description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="What does this workflow do?"
              />
            </div>
            {workflowId && (
              <div className="text-xs text-muted-foreground">
                Workflow ID: {workflowId}
              </div>
            )}
            {webhookUrl && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Webhook URL
                </p>
                <code className="text-xs bg-white p-2 rounded block break-all border border-blue-200">
                  {webhookUrl}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast({
                      title: "Copied",
                      description: "Webhook URL copied to clipboard",
                    });
                  }}
                >
                  Copy URL
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Steps */}
        <div className="space-y-4">
          {/* Empty State */}
          {steps.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Start building your workflow
                </h3>
                <p className="text-muted-foreground mb-4">
                  Every workflow starts with a trigger. Choose when your
                  workflow should run.
                </p>
                <Button
                  onClick={() => {
                    setSelectorType("trigger");
                    setShowAppSelector(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Choose a Trigger
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Workflow Steps */}
          {steps.map((step, index) => {
            const StepIcon = getStepIcon(step.app);
            const stepColor = getStepColor(step.app);
            const stepName = getStepName(step.app, step.action);

            return (
              <div key={step.id} className="relative">
                <Card
                  className="border-l-4"
                  style={{ borderLeftColor: stepColor.replace("bg-", "#") }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${stepColor} text-white`}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {step.type}
                            </Badge>
                            <span className="font-medium">{stepName}</span>
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {step.app}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.configured ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">Configured</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">Setup required</span>
                          </div>
                        )}
                        {!(
                          (step.app === "jobs" && (step.action === "job_completed" || step.action === "job_created")) ||
                          (step.app === "reviews" && step.action === "review_request_sent")
                        ) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => editStep(step)}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {!step.configured && !(
                    (step.app === "jobs" && (step.action === "job_completed" || step.action === "job_created")) ||
                    (step.app === "reviews" && step.action === "review_request_sent")
                  ) && (
                    <CardContent className="pt-0">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Configuration required
                          </span>
                        </div>
                        <p className="text-xs text-amber-600 mt-1">
                          Click the settings icon to configure this step.
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="w-px h-6 bg-border"></div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Step Button */}
          {hasTrigger && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="border-dashed border-2"
                onClick={() => {
                  setSelectorType("action");
                  setShowAppSelector(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Action
              </Button>
            </div>
          )}
        </div>

        {/* App Selector Modal */}
        {showAppSelector && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Choose{" "}
                    {selectorType === "trigger" ? "a Trigger" : "an Action"}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAppSelector(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="grid gap-3">
                  {selectorType === "trigger" && canAddTrigger && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Secondary triggers (greyed out) can only be used after you've set up your initial trigger.
                      </p>
                    </div>
                  )}
                  {availableApps
                    .filter((app) =>
                      selectorType === "trigger"
                        ? app.type === "trigger"
                        : app.type === "action",
                    )
                    .map((app) => (
                      <div key={app.app} className="space-y-2">
                        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                          <div
                            className={`p-1 rounded ${app.color} text-white`}
                          >
                            <app.icon className="h-3 w-3" />
                          </div>
                          {app.name}
                        </div>
                        {app.actions.map((action: AppAction) => {
                          const isSecondaryDisabled = selectorType === "trigger" && canAddTrigger && action.secondary;
                          return (
                            <Card
                              key={action.id}
                              className={`${isSecondaryDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"} transition-shadow`}
                              onClick={() => !isSecondaryDisabled && addStep(app, action)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`p-2 rounded-lg ${app.color} text-white`}
                                  >
                                    <app.icon className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">{action.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {action.description}
                                    </p>
                                  </div>
                                  {isSecondaryDisabled && (
                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded whitespace-nowrap">
                                      Add trigger first
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                        {app !== availableApps[availableApps.length - 1] && (
                          <Separator className="my-4" />
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step Configuration Modal */}
        {showStepConfig && editingStep && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Configure {getStepName(editingStep.app, editingStep.action)}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowStepConfig(false);
                      setEditingStep(null);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <StepConfigForm
                  step={editingStep}
                  onSave={saveStepConfig}
                  workflowId={workflowId}
                  onCancel={() => {
                    setShowStepConfig(false);
                    setEditingStep(null);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ─── SMS Message Editor with variable chips ──────────────────────────────────

const SMS_VARIABLES = [
  { label: "First Name", value: "{{contact.firstName}}" },
  { label: "Last Name", value: "{{contact.lastName}}" },
  { label: "Full Name", value: "{{contact.name}}" },
  { label: "Phone", value: "{{contact.phone}}" },
  { label: "Email", value: "{{contact.email}}" },
  { label: "Job Title", value: "{{job.title}}" },
  { label: "Job Status", value: "{{job.status}}" },
  { label: "Job ID", value: "{{job.id}}" },
];

function SmsMessageEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + variable);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + variable + value.slice(end);
    onChange(next);
    // Restore cursor after inserted variable
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const charCount = value.length;
  const segments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-2">
      <Label>Message</Label>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Hi {{contact.firstName}}, your job \"{{job.title}}\" has been completed. Thanks for choosing us!"}
        className="min-h-[120px] resize-y text-sm font-mono"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{charCount} characters · {segments} SMS segment{segments !== 1 ? "s" : ""}</span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Click to insert variable:</p>
        <div className="flex flex-wrap gap-1.5">
          {SMS_VARIABLES.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => insertVariable(v.value)}
              className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Key-Value Pair Editor ───────────────────────────────────────────────────

function KeyValueEditor({
  label,
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  label: string;
  items: { key: string; value: string }[];
  onChange: (items: { key: string; value: string }[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const addItem = () => onChange([...items, { key: "", value: "" }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: "key" | "value", v: string) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, [field]: v } : item)));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">No items yet.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder={keyPlaceholder}
            value={item.key}
            onChange={(e) => updateItem(i, "key", e.target.value)}
            className="flex-1 text-sm h-8"
          />
          <Input
            placeholder={valuePlaceholder}
            value={item.value}
            onChange={(e) => updateItem(i, "value", e.target.value)}
            className="flex-1 text-sm h-8"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
            onClick={() => removeItem(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-blue-600 hover:text-blue-700 h-7 px-2 text-xs"
        onClick={addItem}
      >
        <Plus className="h-3 w-3" />
        Add Item
      </Button>
    </div>
  );
}

// ─── Webhook Payload Mapper ─────────────────────────────────────────────────

interface FieldMapping {
  path: string;
  alias: string;
  sampleValue: string;
}

/** Recursively flatten a JSON object into dot-path keys */
function flattenObject(
  obj: Record<string, any>,
  prefix = "",
): { path: string; value: any }[] {
  const entries: { path: string; value: any }[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      entries.push(...flattenObject(val, fullPath));
    } else {
      entries.push({ path: fullPath, value: val });
    }
  }
  return entries;
}

function WebhookPayloadMapper({
  config,
  updateConfig,
}: {
  config: Record<string, any>;
  updateConfig: (key: string, value: any) => void;
}) {
  const [tab, setTab] = useState<"payload" | "mapping">("payload");
  const [rawPayload, setRawPayload] = useState<string>(
    config.samplePayload ? JSON.stringify(config.samplePayload, null, 2) : "",
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [detectedFields, setDetectedFields] = useState<
    { path: string; value: any }[]
  >(config.samplePayload ? flattenObject(config.samplePayload) : []);
  const [mappings, setMappings] = useState<FieldMapping[]>(
    config.fieldMappings || [],
  );
  const { toast } = useToast();

  const detectFields = useCallback(() => {
    try {
      const parsed = JSON.parse(rawPayload);
      const fields = flattenObject(parsed);
      setDetectedFields(fields);
      setParseError(null);
      updateConfig("samplePayload", parsed);

      // Auto-create mappings for fields not yet mapped
      const existingPaths = new Set(mappings.map((m) => m.path));
      const newMappings: FieldMapping[] = [
        ...mappings,
        ...fields
          .filter((f) => !existingPaths.has(f.path))
          .map((f) => ({
            path: f.path,
            alias: f.path.split(".").pop() || f.path,
            sampleValue: String(f.value ?? ""),
          })),
      ];
      setMappings(newMappings);
      updateConfig("fieldMappings", newMappings);
      setTab("mapping");
    } catch {
      setParseError("Invalid JSON — please check your payload and try again.");
    }
  }, [rawPayload, mappings, updateConfig]);

  const updateAlias = (index: number, alias: string) => {
    const updated = mappings.map((m, i) => (i === index ? { ...m, alias } : m));
    setMappings(updated);
    updateConfig("fieldMappings", updated);
  };

  const removeMapping = (index: number) => {
    const updated = mappings.filter((_, i) => i !== index);
    setMappings(updated);
    updateConfig("fieldMappings", updated);
  };

  const addBlankMapping = () => {
    const updated = [
      ...mappings,
      { path: "", alias: "", sampleValue: "" },
    ];
    setMappings(updated);
    updateConfig("fieldMappings", updated);
  };

  const copyVariable = (alias: string) => {
    navigator.clipboard.writeText(`{{${alias}}}`);
    toast({ title: "Copied", description: `{{${alias}}} copied to clipboard` });
  };

  const SAMPLE_PAYLOAD = JSON.stringify(
    {
      id: "evt_123",
      event: "job.created",
      data: {
        customer: { name: "Jane Smith", email: "jane@example.com", phone: "+1555000000" },
        job: { title: "SEO Audit", priority: "high", notes: "Urgent request" },
      },
      timestamp: new Date().toISOString(),
    },
    null,
    2,
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setTab("payload")}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "payload"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Test Payload
        </button>
        <button
          type="button"
          onClick={() => setTab("mapping")}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "mapping"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Field Mapping
          {mappings.length > 0 && (
            <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
              {mappings.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Test Payload */}
      {tab === "payload" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Sample Payload (JSON)</Label>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setRawPayload(SAMPLE_PAYLOAD)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Load Example
            </Button>
          </div>

          <Textarea
            value={rawPayload}
            onChange={(e) => {
              setRawPayload(e.target.value);
              setParseError(null);
            }}
            placeholder={`Paste a real webhook payload here, e.g.:\n{\n  "event": "job.created",\n  "data": { "name": "Jane" }\n}`}
            className="font-mono text-xs min-h-[200px] resize-y"
          />

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          <Button
            onClick={detectFields}
            disabled={!rawPayload.trim()}
            className="w-full"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Detect Fields &amp; Map
          </Button>

          {detectedFields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" />
                {detectedFields.length} fields detected
              </div>
              <div className="divide-y max-h-[160px] overflow-y-auto">
                {detectedFields.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between px-3 py-2 text-xs"
                  >
                    <code className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded">
                      {f.path}
                    </code>
                    <span className="text-muted-foreground truncate max-w-[140px] ml-2">
                      {String(f.value ?? "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Field Mapping */}
      {tab === "mapping" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Field Mappings</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Map payload paths to named variables you can use as{" "}
                <code className="text-blue-600">{"{{variable}}"}</code> in later steps.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={addBlankMapping}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Field
            </Button>
          </div>

          {mappings.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No fields mapped yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Go to the <strong>Test Payload</strong> tab, paste a sample payload, then click{" "}
                <strong>Detect Fields</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>Payload Path</span>
                <span />
                <span>Variable Name</span>
                <span />
              </div>

              {mappings.map((mapping, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center"
                >
                  <Input
                    value={mapping.path}
                    onChange={(e) => {
                      const updated = mappings.map((m, idx) =>
                        idx === i ? { ...m, path: e.target.value } : m,
                      );
                      setMappings(updated);
                      updateConfig("fieldMappings", updated);
                    }}
                    placeholder="data.customer.email"
                    className="font-mono text-xs h-8"
                  />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1">
                    <Input
                      value={mapping.alias}
                      onChange={(e) => updateAlias(i, e.target.value)}
                      placeholder="email"
                      className="font-mono text-xs h-8"
                    />
                    {mapping.alias && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title={`Copy {{${mapping.alias}}}`}
                        onClick={() => copyVariable(mapping.alias)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    onClick={() => removeMapping(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Variable preview */}
          {mappings.filter((m) => m.alias).length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/40">
              <p className="text-xs font-medium mb-2 text-muted-foreground">
                Available variables in subsequent steps:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mappings
                  .filter((m) => m.alias)
                  .map((m) => (
                    <button
                      key={m.path}
                      type="button"
                      title={`Click to copy — from path: ${m.path}`}
                      onClick={() => copyVariable(m.alias)}
                      className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                    >
                      <span>{`{{${m.alias}}}`}</span>
                      <Copy className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Step Configuration Form Component
function StepConfigForm({
  step,
  onSave,
  onCancel,
  workflowId,
}: {
  step: WorkflowStep;
  onSave: (config: Record<string, any>) => void;
  onCancel: () => void;
  workflowId?: string | null;
}) {
  const [config, setConfig] = useState(step.config);

  const handleSave = () => {
    onSave(config);
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const renderConfigFields = () => {
    switch (`${step.app}_${step.action}`) {
      case "reviews_send_review_email":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email_template">Email Template</Label>
              <Input
                id="email_template"
                value={config.email_template || ""}
                onChange={(e) => updateConfig("email_template", e.target.value)}
                placeholder="Select email template"
              />
            </div>
          </div>
        );

      case "reviews_send_review_sms":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms_template">SMS Template</Label>
              <Input
                id="sms_template"
                value={config.sms_template || ""}
                onChange={(e) => updateConfig("sms_template", e.target.value)}
                placeholder="Select SMS template"
              />
            </div>
          </div>
        );

      case "webhook_receive": {
        const inboundUrl = workflowId
          ? `${window.location.origin}/api/workflows/webhook/${workflowId}`
          : null;
        return (
          <div className="space-y-4">
            {inboundUrl ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-wide">
                  Your Inbound Webhook URL
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                  Paste this URL into the external system (e.g. Zapier, Make, Stripe) to send data to this workflow.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white dark:bg-black/30 border border-blue-200 dark:border-blue-700 rounded px-3 py-2 break-all select-all">
                    {inboundUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 gap-1.5 border-blue-300 hover:bg-blue-100"
                    onClick={() => {
                      navigator.clipboard.writeText(inboundUrl);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Save the workflow first to generate your webhook URL.
                </p>
              </div>
            )}
            <WebhookPayloadMapper
              config={config}
              updateConfig={updateConfig}
            />
          </div>
        );
      }

      case "webhook_send_webhook": {
        const authType = config.auth_type || "none";
        return (
          <div className="space-y-4">
            {/* Action Name */}
            <div>
              <Label htmlFor="wh_action_name">Action Name</Label>
              <Input
                id="wh_action_name"
                value={config.action_name || "Webhook"}
                onChange={(e) => updateConfig("action_name", e.target.value)}
                placeholder="Webhook"
              />
            </div>

            {/* Method + URL */}
            <div className="flex gap-2">
              <div className="w-28 flex-shrink-0">
                <Label htmlFor="wh_method">Method</Label>
                <select
                  id="wh_method"
                  value={config.method || "POST"}
                  onChange={(e) => updateConfig("method", e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background h-10"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
              </div>
              <div className="flex-1">
                <Label htmlFor="wh_url">URL</Label>
                <Input
                  id="wh_url"
                  value={config.target_url || ""}
                  onChange={(e) => updateConfig("target_url", e.target.value)}
                  placeholder="https://example.com/webhook"
                />
              </div>
            </div>

            {/* Authorization */}
            <div>
              <Label htmlFor="wh_auth">Authorization</Label>
              <select
                id="wh_auth"
                value={authType}
                onChange={(e) => updateConfig("auth_type", e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="basic">Basic Auth (username:password)</option>
              </select>
            </div>
            {authType === "bearer" && (
              <div>
                <Label htmlFor="wh_token">Bearer Token</Label>
                <Input
                  id="wh_token"
                  value={config.auth_token || ""}
                  onChange={(e) => updateConfig("auth_token", e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>
            )}
            {authType === "api_key" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Header Name</Label>
                  <Input
                    value={config.api_key_name || "X-API-Key"}
                    onChange={(e) => updateConfig("api_key_name", e.target.value)}
                    placeholder="X-API-Key"
                  />
                </div>
                <div className="flex-1">
                  <Label>API Key Value</Label>
                  <Input
                    value={config.api_key_value || ""}
                    onChange={(e) => updateConfig("api_key_value", e.target.value)}
                    placeholder="your-api-key"
                  />
                </div>
              </div>
            )}
            {authType === "basic" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Username</Label>
                  <Input
                    value={config.basic_username || ""}
                    onChange={(e) => updateConfig("basic_username", e.target.value)}
                    placeholder="username"
                  />
                </div>
                <div className="flex-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={config.basic_password || ""}
                    onChange={(e) => updateConfig("basic_password", e.target.value)}
                    placeholder="password"
                  />
                </div>
              </div>
            )}

            {/* Headers */}
            <KeyValueEditor
              label="Headers"
              items={config.headers || []}
              onChange={(v) => updateConfig("headers", v)}
              keyPlaceholder="Header name"
              valuePlaceholder="Header value"
            />

            {/* Query Parameters */}
            <KeyValueEditor
              label="Query Parameters"
              items={config.query_params || []}
              onChange={(v) => updateConfig("query_params", v)}
              keyPlaceholder="Param name"
              valuePlaceholder="Param value"
            />

            {/* Content-Type */}
            <div>
              <Label htmlFor="wh_content_type">Content-Type</Label>
              <select
                id="wh_content_type"
                value={config.content_type || "application/json"}
                onChange={(e) => updateConfig("content_type", e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="application/json">application/json</option>
                <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                <option value="text/plain">text/plain</option>
              </select>
            </div>

            {/* Raw Body */}
            <div>
              <Label htmlFor="wh_body">Raw Body</Label>
              <Textarea
                id="wh_body"
                value={config.raw_body || ""}
                onChange={(e) => updateConfig("raw_body", e.target.value)}
                placeholder={'{\n  "id": "{{contact.id}}",\n  "name": "{{contact.name}}",\n  "email": "{{contact.email}}",\n  "phone": "{{contact.phone}}"\n}'}
                className="min-h-[140px] resize-y text-xs font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="text-blue-600">{"{{contact.name}}"}</code>, <code className="text-blue-600">{"{{job.title}}"}</code>, <code className="text-blue-600">{"{{job.id}}"}</code>, etc. Variables are replaced at runtime.
              </p>
            </div>

            {/* Custom Data */}
            <KeyValueEditor
              label="Custom Data"
              items={config.custom_data || []}
              onChange={(v) => updateConfig("custom_data", v)}
              keyPlaceholder="Key"
              valuePlaceholder="Value"
            />

            {/* Test button */}
            <div className="rounded-lg border border-muted bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Available variables:</strong>{" "}
                <code className="text-blue-600">{"{{contact.id}}"}</code>{" "}
                <code className="text-blue-600">{"{{contact.name}}"}</code>{" "}
                <code className="text-blue-600">{"{{contact.email}}"}</code>{" "}
                <code className="text-blue-600">{"{{contact.phone}}"}</code>{" "}
                <code className="text-blue-600">{"{{job.title}}"}</code>{" "}
                <code className="text-blue-600">{"{{job.id}}"}</code>{" "}
                <code className="text-blue-600">{"{{job.status}}"}</code>
              </p>
            </div>
          </div>
        );
      }

      case "delay_wait":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                type="number"
                value={config.duration || "1"}
                onChange={(e) => updateConfig("duration", e.target.value)}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={config.unit || "hours"}
                onValueChange={(value) => updateConfig("unit", value)}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "tags_add_tag":
      case "tags_remove_tag":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="tag_name">Tag Name</Label>
              <Input
                id="tag_name"
                value={config.tag_name || ""}
                onChange={(e) => updateConfig("tag_name", e.target.value)}
                placeholder="Enter tag name"
              />
            </div>
          </div>
        );

      case "gmb_post_to_gmb":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="post_content">Post Content</Label>
              <Input
                id="post_content"
                value={config.post_content || ""}
                onChange={(e) => updateConfig("post_content", e.target.value)}
                placeholder="What's the update?"
              />
            </div>
            <div>
              <Label htmlFor="include_image">Include Image</Label>
              <Input
                id="include_image"
                type="checkbox"
                checked={config.include_image || false}
                onChange={(e) =>
                  updateConfig("include_image", e.target.checked)
                }
              />
            </div>
          </div>
        );

      case "jobs_job_created":
        return (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-teal-600" />
              <p className="text-sm font-medium text-teal-800">No configuration needed</p>
            </div>
            <p className="text-xs text-teal-700">
              This trigger fires automatically whenever a new job is created. Add actions below to define what happens next.
            </p>
          </div>
        );

      case "jobs_job_completed":
        return (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-teal-600" />
              <p className="text-sm font-medium text-teal-800">No configuration needed</p>
            </div>
            <p className="text-xs text-teal-700">
              This trigger fires automatically whenever a job is marked as completed. Add actions below to define what happens next.
            </p>
          </div>
        );

      case "jobs_create_job":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                value={config.job_title || ""}
                onChange={(e) => updateConfig("job_title", e.target.value)}
                placeholder="e.g., Website Design, SEO Audit"
              />
            </div>
            <div>
              <Label htmlFor="job_description">Job Description</Label>
              <Input
                id="job_description"
                value={config.job_description || ""}
                onChange={(e) => updateConfig("job_description", e.target.value)}
                placeholder="Describe the job details"
              />
            </div>
            <div>
              <Label htmlFor="assigned_to">Assign To (Optional)</Label>
              <Input
                id="assigned_to"
                value={config.assigned_to || ""}
                onChange={(e) => updateConfig("assigned_to", e.target.value)}
                placeholder="Team member or department"
              />
            </div>
          </div>
        );

      case "reviews_review_request_sent":
        return (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-teal-600" />
              <p className="text-sm font-medium text-teal-800">No configuration needed</p>
            </div>
            <p className="text-xs text-teal-700">
              This trigger fires automatically whenever a review request is sent. Add actions below to define what happens next.
            </p>
          </div>
        );

      case "reviews_positive_review_received":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="min_rating">Minimum Rating (Optional)</Label>
              <Input
                id="min_rating"
                type="number"
                value={config.min_rating || ""}
                onChange={(e) => updateConfig("min_rating", e.target.value)}
                placeholder="e.g., 4 stars"
              />
            </div>
            <div>
              <Label htmlFor="action_on_positive">Action on Positive Review</Label>
              <Input
                id="action_on_positive"
                value={config.action_on_positive || ""}
                onChange={(e) => updateConfig("action_on_positive", e.target.value)}
                placeholder="e.g., Share on social, Send thank you"
              />
            </div>
          </div>
        );

      case "reviews_negative_review_received":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="max_rating">Maximum Rating (Optional)</Label>
              <Input
                id="max_rating"
                type="number"
                value={config.max_rating || ""}
                onChange={(e) => updateConfig("max_rating", e.target.value)}
                placeholder="e.g., 3 stars"
              />
            </div>
            <div>
              <Label htmlFor="notify_team">Notify Team</Label>
              <Input
                id="notify_team"
                type="checkbox"
                checked={config.notify_team || false}
                onChange={(e) => updateConfig("notify_team", e.target.checked)}
              />
            </div>
            <div>
              <Label htmlFor="action_on_negative">Action on Negative Review</Label>
              <Input
                id="action_on_negative"
                value={config.action_on_negative || ""}
                onChange={(e) => updateConfig("action_on_negative", e.target.value)}
                placeholder="e.g., Create support ticket, Send response"
              />
            </div>
          </div>
        );

      case "communication_send_sms":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms_to">To (Phone Number)</Label>
              <Input
                id="sms_to"
                value={config.sms_to || ""}
                onChange={(e) => updateConfig("sms_to", e.target.value)}
                placeholder="+15550001234 or {{contact.phone}}"
              />
            </div>
            <SmsMessageEditor
              value={config.sms_message || ""}
              onChange={(v) => updateConfig("sms_message", v)}
            />
          </div>
        );

      case "communication_send_email":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email_to">To (Email Address)</Label>
              <Input
                id="email_to"
                value={config.email_to || ""}
                onChange={(e) => updateConfig("email_to", e.target.value)}
                placeholder="e.g., {{email}} or jane@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">Use <code className="text-blue-600">{"{{variable}}"}</code> from a mapped webhook field.</p>
            </div>
            <div>
              <Label htmlFor="email_subject">Subject</Label>
              <Input
                id="email_subject"
                value={config.email_subject || ""}
                onChange={(e) => updateConfig("email_subject", e.target.value)}
                placeholder="e.g., Your job {{job_title}} is ready"
              />
            </div>
            <div>
              <Label htmlFor="email_body">Body</Label>
              <Textarea
                id="email_body"
                value={config.email_body || ""}
                onChange={(e) => updateConfig("email_body", e.target.value)}
                placeholder={"Hi {{first_name}},\n\nYour job has been created.\n\nThanks!"}
                className="min-h-[140px] resize-y text-sm"
              />
            </div>
            <div>
              <Label htmlFor="email_from">From (Optional)</Label>
              <Input
                id="email_from"
                value={config.email_from || ""}
                onChange={(e) => updateConfig("email_from", e.target.value)}
                placeholder="noreply@yourdomain.com"
              />
            </div>
          </div>
        );

      case "time_wait":
        return (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                The workflow will pause at this step for the specified duration before continuing to the next action.
              </p>
            </div>
            <div>
              <Label htmlFor="wait_duration">Duration</Label>
              <Input
                id="wait_duration"
                type="number"
                min="1"
                value={config.wait_duration || "1"}
                onChange={(e) => updateConfig("wait_duration", e.target.value)}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="wait_unit">Unit</Label>
              <select
                id="wait_unit"
                value={config.wait_unit || "hours"}
                onChange={(e) => updateConfig("wait_unit", e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </div>
            <div className="text-xs text-muted-foreground bg-muted rounded-md p-2">
              Wait: <strong>{config.wait_duration || 1} {config.wait_unit || "hours"}</strong> before proceeding
            </div>
          </div>
        );

      case "rss_publish_item": {
        const feedUrl = workflowId
          ? `${window.location.origin}/api/rss/${workflowId}`
          : null;
        return (
          <div className="space-y-4">
            {feedUrl ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-semibold text-orange-800 mb-1 uppercase tracking-wide">
                  Your RSS Feed URL
                </p>
                <p className="text-xs text-orange-700 mb-3">
                  Subscribe to this URL in WordPress or any RSS reader. New items are added each time this workflow step runs.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-orange-200 rounded px-3 py-2 break-all select-all">
                    {feedUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 gap-1.5 border-orange-300 hover:bg-orange-100"
                    onClick={() => navigator.clipboard.writeText(feedUrl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-800">
                  Save the workflow first to generate your RSS feed URL.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="rss_item_title">Item Title</Label>
              <Input
                id="rss_item_title"
                value={config.rss_item_title || ""}
                onChange={(e) => updateConfig("rss_item_title", e.target.value)}
                placeholder="e.g., Job Completed: {{job_title}}"
              />
              <p className="text-xs text-muted-foreground mt-1">Use <code className="text-orange-600">{"{{variable}}"}</code> from workflow data (e.g. <code className="text-orange-600">{"{{job_title}}"}</code>, <code className="text-orange-600">{"{{customer_name}}"}</code>).</p>
            </div>
            <div>
              <Label htmlFor="rss_item_description">Item Description</Label>
              <Textarea
                id="rss_item_description"
                value={config.rss_item_description || ""}
                onChange={(e) => updateConfig("rss_item_description", e.target.value)}
                placeholder={"We just completed a job for {{customer_name}}.\n\nService: {{job_title}}\nLocation: {{job_location}}\n\nContact us to schedule your own service!"}
                className="min-h-[120px] resize-y text-sm"
              />
            </div>
            <div>
              <Label htmlFor="rss_item_link">Item Link (Optional)</Label>
              <Input
                id="rss_item_link"
                value={config.rss_item_link || ""}
                onChange={(e) => updateConfig("rss_item_link", e.target.value)}
                placeholder="https://yoursite.com/jobs/{{job_id}}"
              />
              <p className="text-xs text-muted-foreground mt-1">URL that WordPress will link to when importing this item.</p>
            </div>
            <div>
              <Label htmlFor="rss_feed_title">Feed Title (shown in WordPress)</Label>
              <Input
                id="rss_feed_title"
                value={config.rss_feed_title || ""}
                onChange={(e) => updateConfig("rss_feed_title", e.target.value)}
                placeholder="Completed Jobs Feed"
              />
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No configuration options available for this step.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {renderConfigFields()}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Configuration</Button>
      </div>
    </div>
  );
}
