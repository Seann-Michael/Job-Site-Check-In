import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface WebhookPayload {
  [key: string]: any;
}

interface WorkflowStep {
  id: string;
  type: "trigger" | "action";
  app: string;
  action: string;
  configured: boolean;
  config: Record<string, any>;
}

// Register a webhook endpoint
export async function handleRegisterWebhook(req: Request, res: Response) {
  try {
    const { url, events, headers } = req.body;
    const businessId = req.headers["x-business-id"] as string;

    if (!url || !businessId) {
      return res.status(400).json({
        error: "Missing required fields: url and business_id",
      });
    }

    // Verify webhook URL is reachable
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal
        });
        if (!response.ok && response.status !== 404) {
          console.warn(`Webhook URL returned status ${response.status}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      return res.status(400).json({
        error: "Webhook URL is not reachable",
        details: error instanceof Error ? error.message : "",
      });
    }

    // Generate secret
    const secret = crypto.randomBytes(32).toString("hex");

    // Insert webhook
    const { data, error } = await supabase
      .from("webhooks")
      .insert({
        business_id: businessId,
        url,
        events: events || [],
        secret,
        headers: headers || {},
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating webhook:", error);
      return res.status(500).json({ error: "Failed to create webhook" });
    }

    res.status(201).json({
      success: true,
      webhook: {
        id: data.id,
        url: data.url,
        secret: data.secret,
      },
    });
  } catch (error) {
    console.error("Error in handleRegisterWebhook:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "",
    });
  }
}

// Generate webhook URL for a workflow
export async function handleGenerateWebhookUrl(req: Request, res: Response) {
  try {
    const { workflowId } = req.body;
    const businessId = req.headers["x-business-id"] as string;

    if (!workflowId || !businessId) {
      return res.status(400).json({
        error: "Missing required fields: workflowId and business_id",
      });
    }

    // Check workflow exists
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("id")
      .eq("id", workflowId)
      .eq("business_id", businessId)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    // Generate webhook URL
    const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";
    const webhookPath = `/api/workflows/webhook/${workflowId}`;
    const webhookUrl = `${baseUrl}${webhookPath}`;

    res.json({
      success: true,
      webhookUrl,
      path: webhookPath,
    });
  } catch (error) {
    console.error("Error in handleGenerateWebhookUrl:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "",
    });
  }
}

// Receive webhook and trigger workflow
export async function handleWorkflowWebhook(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;
    const payload = req.body;
    const signature = req.headers["x-webhook-signature"] as string;

    if (!workflowId) {
      return res.status(400).json({ error: "Workflow ID is required" });
    }

    // Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("is_active", true)
      .eq("is_published", true)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: "Workflow not found or inactive" });
    }

    // Create execution record
    const { data: execution, error: executionError } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        business_id: workflow.business_id,
        trigger_data: payload,
        status: "pending",
      })
      .select()
      .single();

    if (executionError) {
      console.error("Error creating execution:", executionError);
      return res.status(500).json({ error: "Failed to create execution" });
    }

    // Queue workflow execution (async)
    executeWorkflow(execution.id, workflow, payload).catch((error) => {
      console.error("Error executing workflow:", error);
    });

    // Return immediately with execution ID
    res.json({
      success: true,
      executionId: execution.id,
      message: "Workflow triggered successfully",
    });
  } catch (error) {
    console.error("Error in handleWorkflowWebhook:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "",
    });
  }
}

// Execute workflow and its actions
async function executeWorkflow(
  executionId: string,
  workflow: any,
  triggerData: WebhookPayload
) {
  try {
    const steps = workflow.steps as WorkflowStep[];

    // Find action steps (skip trigger)
    const actionSteps = steps.filter((step) => step.type === "action");

    // Execute each action
    for (const step of actionSteps) {
      try {
        await executeAction(step, triggerData, executionId);
      } catch (error) {
        console.error(`Error executing action ${step.id}:`, error);
      }
    }

    // Mark execution as complete
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);
  } catch (error) {
    console.error("Error in executeWorkflow:", error);
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);
  }
}

// Execute individual action
async function executeAction(
  step: WorkflowStep,
  triggerData: WebhookPayload,
  executionId: string
) {
  const { app, action, config } = step;

  switch (`${app}_${action}`) {
    case "webhook_send_webhook": {
      await sendWebhook(config, triggerData, executionId);
      break;
    }
    case "jobs_create_job": {
      await createJobAction(config, triggerData, executionId);
      break;
    }
    case "reviews_send_review_email": {
      await sendReviewEmail(config, triggerData, executionId);
      break;
    }
    // Add more action handlers as needed
    default:
      console.log(`No handler for action: ${app}_${action}`);
  }
}

// Send webhook action
async function sendWebhook(
  config: Record<string, any>,
  payload: WebhookPayload,
  executionId: string
) {
  try {
    const { targetUrl, method = "POST", headers = {} } = config;

    if (!targetUrl) {
      throw new Error("Target URL is required for send webhook action");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(targetUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseBody = await response.text();

      // Log delivery
      await supabase.from("webhook_deliveries").insert({
        webhook_id: null,
        execution_id: executionId,
        payload,
        status: response.ok ? "delivered" : "failed",
        http_status_code: response.status,
        response_body: responseBody,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Error sending webhook:", error);
    await supabase.from("webhook_deliveries").insert({
      execution_id: executionId,
      payload,
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Create job action
async function createJobAction(
  config: Record<string, any>,
  triggerData: WebhookPayload,
  executionId: string
) {
  try {
    const { jobTitle, jobDescription, assignedTo } = config;

    console.log("Creating job:", {
      jobTitle,
      jobDescription,
      assignedTo,
      triggerData,
      executionId,
    });

    // TODO: Integrate with jobs system
    // For now, just log the action
  } catch (error) {
    console.error("Error creating job:", error);
  }
}

// Send review email action
async function sendReviewEmail(
  config: Record<string, any>,
  triggerData: WebhookPayload,
  executionId: string
) {
  try {
    const { emailTemplate, delayHours } = config;

    console.log("Sending review email:", {
      emailTemplate,
      delayHours,
      triggerData,
      executionId,
    });

    // TODO: Integrate with email system
    // For now, just log the action
  } catch (error) {
    console.error("Error sending review email:", error);
  }
}

// Get webhook deliveries
export async function handleGetWebhookDeliveries(req: Request, res: Response) {
  try {
    const { executionId } = req.params;
    const businessId = req.headers["x-business-id"] as string;

    if (!executionId || !businessId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("execution_id", executionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deliveries:", error);
      return res.status(500).json({ error: "Failed to fetch deliveries" });
    }

    res.json({ success: true, deliveries: data || [] });
  } catch (error) {
    console.error("Error in handleGetWebhookDeliveries:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "",
    });
  }
}
