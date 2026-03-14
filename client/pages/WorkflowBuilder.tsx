import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
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
    app: "workflow",
    name: "Workflow",
    icon: GitBranch,
    color: "bg-indigo-500",
    actions: [
      {
        id: "add_to_workflow",
        name: "Add to Workflow",
        description: "When contact is added to workflow",
      },
      {
        id: "remove_from_workflow",
        name: "Remove from Workflow",
        description: "When contact is removed from workflow",
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
  {
    type: "action",
    app: "rss",
    name: "RSS",
    icon: Database,
    color: "bg-orange-600",
    actions: [
      { id: "rss", name: "RSS Feed", description: "Add item to RSS feed" },
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
  {
    type: "action",
    app: "facebook",
    name: "Facebook",
    icon: MessageSquare,
    color: "bg-blue-600",
    actions: [
      {
        id: "post_to_facebook",
        name: "Post to Facebook",
        description: "Create a post on Facebook",
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
  const [workflowId, setWorkflowId] = useState(id || null);
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
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      type: app.type,
      app: app.app,
      action: actionData.id,
      configured: false,
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
    const appData = availableApps.find((a) => a.app === app);
    const actionData = appData?.actions.find((act) => act.id === action);
    return actionData?.name || "Unknown Action";
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
        // Create new workflow
        const workflow = await dataService.createWorkflow(
          user.id,
          workflowName,
          steps,
          workflowDescription,
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => editStep(step)}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
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
                  {!step.configured && (
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

// Step Configuration Form Component
function StepConfigForm({
  step,
  onSave,
  onCancel,
}: {
  step: WorkflowStep;
  onSave: (config: Record<string, any>) => void;
  onCancel: () => void;
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
            <div>
              <Label htmlFor="delay_hours">Delay (hours)</Label>
              <Input
                id="delay_hours"
                type="number"
                value={config.delay_hours || "24"}
                onChange={(e) => updateConfig("delay_hours", e.target.value)}
                placeholder="24"
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
            <div>
              <Label htmlFor="delay_hours">Delay (hours)</Label>
              <Input
                id="delay_hours"
                type="number"
                value={config.delay_hours || "24"}
                onChange={(e) => updateConfig("delay_hours", e.target.value)}
                placeholder="24"
              />
            </div>
          </div>
        );

      case "webhook_receive":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook_url">Webhook URL</Label>
              <Input
                id="webhook_url"
                value={config.webhook_url || ""}
                onChange={(e) => updateConfig("webhook_url", e.target.value)}
                placeholder="https://example.com/webhook"
              />
            </div>
            <div>
              <Label htmlFor="secret_key">Secret Key (Optional)</Label>
              <Input
                id="secret_key"
                type="password"
                value={config.secret_key || ""}
                onChange={(e) => updateConfig("secret_key", e.target.value)}
                placeholder="Enter secret key"
              />
            </div>
          </div>
        );

      case "webhook_send_webhook":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="target_url">Target URL</Label>
              <Input
                id="target_url"
                value={config.target_url || ""}
                onChange={(e) => updateConfig("target_url", e.target.value)}
                placeholder="https://api.example.com/webhook"
              />
            </div>
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <Input
                id="method"
                value={config.method || "POST"}
                onChange={(e) => updateConfig("method", e.target.value)}
                placeholder="POST"
              />
            </div>
          </div>
        );

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
              <Input
                id="unit"
                value={config.unit || "hours"}
                onChange={(e) => updateConfig("unit", e.target.value)}
                placeholder="minutes, hours, days"
              />
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="job_type">Job Type (Optional)</Label>
              <Input
                id="job_type"
                value={config.job_type || ""}
                onChange={(e) => updateConfig("job_type", e.target.value)}
                placeholder="e.g., SEO, Maintenance, Cleaning"
              />
            </div>
            <div>
              <Label htmlFor="job_priority">Priority Level (Optional)</Label>
              <Input
                id="job_priority"
                value={config.job_priority || ""}
                onChange={(e) => updateConfig("job_priority", e.target.value)}
                placeholder="e.g., High, Medium, Low"
              />
            </div>
          </div>
        );

      case "jobs_job_completed":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="completion_notification">
                Send Notification
              </Label>
              <Input
                id="completion_notification"
                type="checkbox"
                checked={config.send_notification || false}
                onChange={(e) =>
                  updateConfig("send_notification", e.target.checked)
                }
              />
            </div>
            <div>
              <Label htmlFor="follow_up_action">Follow-up Action (Optional)</Label>
              <Input
                id="follow_up_action"
                value={config.follow_up_action || ""}
                onChange={(e) => updateConfig("follow_up_action", e.target.value)}
                placeholder="e.g., Send invoice, Request review"
              />
            </div>
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="review_platform">Review Platform</Label>
              <Input
                id="review_platform"
                value={config.review_platform || ""}
                onChange={(e) => updateConfig("review_platform", e.target.value)}
                placeholder="e.g., Google, Yelp, Facebook"
              />
            </div>
            <div>
              <Label htmlFor="contact_method">Contact Method</Label>
              <Input
                id="contact_method"
                value={config.contact_method || ""}
                onChange={(e) => updateConfig("contact_method", e.target.value)}
                placeholder="e.g., Email, SMS"
              />
            </div>
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
