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

    // Execute the workflow now, and report what actually happened. A caller
    // must be able to tell accepted-and-executed apart from
    // accepted-but-steps-failed, so we do not answer before the steps have run.
    const run = await executeWorkflow(execution.id, workflow, payload);
    const failedSteps = run.steps.filter((step) => step.status === "failed");

    // When the caller asked for specific publish destinations (the mobile
    // app's payload does), report an outcome for every one of them so nothing
    // falls back to an optimistic default on the client.
    const requestedDestinations: string[] = Array.isArray(payload?.destinations)
      ? payload.destinations.filter((d: unknown): d is string => typeof d === "string")
      : [];
    const results =
      requestedDestinations.length > 0
        ? requestedDestinations.map((destination) =>
            destinationOutcome(destination, run.steps)
          )
        : undefined;

    res.json({
      success: run.status === "completed",
      executionId: execution.id,
      status: run.status,
      steps: run.steps,
      ...(results ? { results } : {}),
      message:
        run.status === "completed"
          ? run.steps.length > 0
            ? "Workflow executed successfully"
            : "Workflow accepted, but it has no action steps — nothing was done"
          : `Workflow ran, but ${failedSteps.length > 0 ? `${failedSteps.length} of ${run.steps.length} step${run.steps.length === 1 ? "" : "s"} failed` : "it failed"}${run.errorMessage ? `: ${run.errorMessage}` : ""}`,
    });
  } catch (error) {
    console.error("Error in handleWorkflowWebhook:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "",
    });
  }
}

/** What actually happened when one workflow step ran. */
interface StepResult {
  stepId: string;
  app: string;
  action: string;
  status: "succeeded" | "failed";
  error?: string;
}

interface WorkflowRunResult {
  status: "completed" | "failed";
  steps: StepResult[];
  /** Set when the run failed before/outside individual steps. */
  errorMessage?: string;
}

// Execute workflow and its actions. Every step's real outcome is collected,
// and the execution record's status reflects it: a step that did no work is a
// FAILED step, never a silent success.
async function executeWorkflow(
  executionId: string,
  workflow: any,
  triggerData: WebhookPayload
): Promise<WorkflowRunResult> {
  try {
    const steps = (Array.isArray(workflow.steps) ? workflow.steps : []) as WorkflowStep[];

    // Find action steps (skip trigger)
    const actionSteps = steps.filter((step) => step.type === "action");

    // Execute each action and record what actually happened
    const results: StepResult[] = [];
    for (const step of actionSteps) {
      results.push(await executeAction(step, triggerData, executionId));
    }

    const failed = results.filter((result) => result.status === "failed");
    const status: "completed" | "failed" = failed.length > 0 ? "failed" : "completed";

    await supabase
      .from("workflow_executions")
      .update({
        status,
        ...(failed.length > 0
          ? {
              error_message: failed
                .map((result) => `${result.app}_${result.action}: ${result.error}`)
                .join("; "),
            }
          : {}),
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    return { status, steps: results };
  } catch (error) {
    console.error("Error in executeWorkflow:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);
    return { status: "failed", steps: [], errorMessage: message };
  }
}

// Execute individual action and report its real outcome. An action this
// server cannot perform (no handler, or a handler that is not implemented
// yet) is a FAILED step with a reason — never a pretend success.
async function executeAction(
  step: WorkflowStep,
  triggerData: WebhookPayload,
  executionId: string
): Promise<StepResult> {
  const { id, app, action, config } = step;
  const base = { stepId: id, app, action };

  try {
    switch (`${app}_${action}`) {
      case "webhook_send_webhook": {
        const failure = await sendWebhook(config, triggerData, executionId);
        return failure
          ? { ...base, status: "failed", error: failure }
          : { ...base, status: "succeeded" };
      }
      case "jobs_create_job":
        return {
          ...base,
          status: "failed",
          error: "jobs_create_job is not implemented yet — no job was created",
        };
      case "reviews_send_review_email":
        return {
          ...base,
          status: "failed",
          error:
            "reviews_send_review_email is not implemented yet — no email was sent",
        };
      // Add more action handlers as needed
      default:
        return {
          ...base,
          status: "failed",
          error: `no handler for ${app}_${action}`,
        };
    }
  } catch (error) {
    return {
      ...base,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Which builder apps publish to which destination a caller can request. The
 * mobile client's `destinations` are requests ('gmb' | 'website' |
 * 'gohighlevel'); only steps of these apps actually fulfil them. A generic
 * webhook step is deliberately NOT mapped to any destination — this server
 * cannot know where an arbitrary webhook points, so it never claims one
 * reached a named platform.
 */
const DESTINATION_STEP_APPS: Record<string, string[]> = {
  gmb: ["gmb"],
  website: ["rss"],
};

/**
 * The honest per-destination outcome for one requested destination, in the
 * shape the mobile client already understands ({ destination, status,
 * detail } with status 'sent' | 'failed'). A destination no step publishes
 * to, or whose step failed, is reported failed — never assumed delivered.
 */
function destinationOutcome(
  destination: string,
  steps: StepResult[]
): { destination: string; status: "sent" | "failed"; detail: string } {
  const apps = DESTINATION_STEP_APPS[destination] ?? [];
  const matching = steps.filter((step) => apps.includes(step.app));

  if (matching.length === 0) {
    return {
      destination,
      status: "failed",
      detail: `This workflow has no step that publishes to ${destination}, so nothing was published there.`,
    };
  }

  const failed = matching.find((step) => step.status === "failed");
  if (failed) {
    return {
      destination,
      status: "failed",
      detail: `Publishing step ${failed.app}_${failed.action} failed (${failed.error}) — nothing was published to ${destination}.`,
    };
  }

  return {
    destination,
    status: "sent",
    detail: `Workflow step ${matching[0].app}_${matching[0].action} completed.`,
  };
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

// Send webhook action. Returns null on success, or a reason string when the
// delivery did not succeed (the target answered with a non-2xx status).
async function sendWebhook(
  config: Record<string, any>,
  payload: WebhookPayload,
  executionId: string
): Promise<string | null> {
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
      return `webhook target responded with HTTP ${response.status}`;
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
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
