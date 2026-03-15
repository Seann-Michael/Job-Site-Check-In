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

/** Replace {{variable.path}} tokens in a string using a flat context object */
function interpolate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const parts = path.split(".");
    let val: any = context;
    for (const part of parts) {
      if (val == null) return "";
      val = val[part];
    }
    return val != null ? String(val) : "";
  });
}

/** Build a flat context object from trigger payload for variable substitution */
function buildContext(payload: WebhookPayload): Record<string, any> {
  return {
    contact: {
      id: payload.contact?.id || payload.contactId || "",
      name: payload.contact?.name || payload.contactName || "",
      email: payload.contact?.email || payload.contactEmail || "",
      phone: payload.contact?.phone || payload.contactPhone || "",
      firstName: payload.contact?.firstName || payload.firstName || "",
      lastName: payload.contact?.lastName || payload.lastName || "",
    },
    job: {
      id: payload.job?.id || payload.jobId || "",
      title: payload.job?.title || payload.jobTitle || "",
      status: payload.job?.status || payload.jobStatus || "",
      type: payload.job?.type || payload.jobType || "",
      location: payload.job?.location || payload.jobLocation || "",
    },
    // also expose raw payload fields at top level
    ...payload,
  };
}

// Send webhook action
async function sendWebhook(
  config: Record<string, any>,
  payload: WebhookPayload,
  executionId: string
) {
  const {
    target_url,
    // legacy key support
    targetUrl: legacyTargetUrl,
    method = "POST",
    auth_type = "none",
    auth_token,
    api_key_name,
    api_key_value,
    basic_username,
    basic_password,
    headers: headerItems = [],
    query_params: queryParamItems = [],
    content_type = "application/json",
    raw_body,
    custom_data: customDataItems = [],
  } = config;

  const resolvedUrl = target_url || legacyTargetUrl;

  if (!resolvedUrl) {
    throw new Error("Target URL is required for send webhook action");
  }

  const context = buildContext(payload);

  // ── Build headers ──────────────────────────────────────────────────────────
  const requestHeaders: Record<string, string> = {
    "Content-Type": content_type,
  };

  // Dynamic headers from key-value editor
  if (Array.isArray(headerItems)) {
    for (const h of headerItems) {
      if (h.key) requestHeaders[h.key] = interpolate(h.value || "", context);
    }
  }

  // Authorization header
  if (auth_type === "bearer" && auth_token) {
    requestHeaders["Authorization"] = `Bearer ${auth_token}`;
  } else if (auth_type === "api_key" && api_key_name && api_key_value) {
    requestHeaders[api_key_name] = api_key_value;
  } else if (auth_type === "basic" && basic_username) {
    const encoded = Buffer.from(`${basic_username}:${basic_password || ""}`).toString("base64");
    requestHeaders["Authorization"] = `Basic ${encoded}`;
  }

  // ── Build URL with query params ────────────────────────────────────────────
  let finalUrl = resolvedUrl;
  if (Array.isArray(queryParamItems) && queryParamItems.length > 0) {
    const qs = new URLSearchParams();
    for (const p of queryParamItems) {
      if (p.key) qs.append(p.key, interpolate(p.value || "", context));
    }
    finalUrl = `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}${qs.toString()}`;
  }

  // ── Build request body ─────────────────────────────────────────────────────
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (raw_body && raw_body.trim()) {
      // User-defined raw body with variable interpolation
      body = interpolate(raw_body, context);
    } else {
      // Merge trigger payload with any custom_data key-value pairs
      const mergedData: Record<string, any> = { ...payload };
      if (Array.isArray(customDataItems)) {
        for (const item of customDataItems) {
          if (item.key) mergedData[item.key] = interpolate(item.value || "", context);
        }
      }
      if (content_type === "application/x-www-form-urlencoded") {
        const form = new URLSearchParams();
        for (const [k, v] of Object.entries(mergedData)) {
          form.append(k, String(v ?? ""));
        }
        body = form.toString();
      } else {
        body = JSON.stringify(mergedData);
      }
    }
  }

  // ── Fire the request ───────────────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(finalUrl, {
      method,
      headers: requestHeaders,
      body,
      signal: controller.signal,
    });

    const responseBody = await response.text();

    await supabase.from("webhook_deliveries").insert({
      webhook_id: null,
      execution_id: executionId,
      payload,
      status: response.ok ? "delivered" : "failed",
      http_status_code: response.status,
      response_body: responseBody,
    });

    if (!response.ok) {
      console.warn(`Webhook responded with ${response.status}: ${responseBody.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeoutId);
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
