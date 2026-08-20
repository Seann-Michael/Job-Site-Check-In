import { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { getAppUrl } from "../lib/env";
import { safeFetch, SafeFetchError } from "../lib/safeFetch";
import { generateSecret, signPayload, verifySignature } from "../lib/webhookSignature";
import { canAccessBusiness } from "../middleware/requireAuth";

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

const log = logger.child({ module: "workflows" });

/** Resolve the business the caller is acting on and verify they may. */
function resolveBusinessId(req: Request, requested?: unknown): string | null {
  const profile = req.profile;
  if (!profile) return null;
  const wanted = typeof requested === "string" && requested ? requested : null;
  if (wanted) return canAccessBusiness(req, wanted) ? wanted : null;
  return profile.businessIds[0] ?? null;
}

// ── Outbound webhook registration ────────────────────────────────────────────
// POST /api/webhooks/register  (auth)  { url, events?, headers?, business_id? }
export async function handleRegisterWebhook(req: Request, res: Response) {
  try {
    const { url, events, headers, business_id } = req.body ?? {};
    const businessId = resolveBusinessId(req, business_id);

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing required field: url" });
    }
    if (!businessId) {
      return res.status(403).json({ error: "No accessible business for this account" });
    }

    // Verify the URL is public and reachable.
    try {
      const response = await safeFetch(url, { method: "HEAD", timeoutMs: 5000 });
      if (!response.ok && response.status !== 404 && response.status !== 405) {
        log.warn({ status: response.status }, "Webhook URL returned non-OK status on registration");
      }
    } catch (error) {
      const reason = error instanceof SafeFetchError ? error.message : "Webhook URL is not reachable";
      return res.status(400).json({ error: reason });
    }

    const secret = generateSecret();
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("webhooks")
      .insert({
        business_id: businessId,
        url,
        events: Array.isArray(events) ? events : [],
        secret,
        headers: headers && typeof headers === "object" ? headers : {},
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      log.error({ err: error }, "Error creating webhook");
      return res.status(500).json({ error: "Failed to create webhook" });
    }

    res.status(201).json({
      success: true,
      webhook: { id: data.id, url: data.url, secret: data.secret },
    });
  } catch (error) {
    log.error({ err: error }, "handleRegisterWebhook failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Inbound webhook URL + secret for a workflow ──────────────────────────────
// POST /api/workflows/webhook-url  (auth)  { workflowId, business_id?, rotateSecret? }
//
// The workflows table has no secret column, so the inbound secret is stored on
// the trigger step's config (`steps[].config.webhook_secret`). It is generated
// the first time a URL is requested and returned to the caller so they can
// configure the sender.
export async function handleGenerateWebhookUrl(req: Request, res: Response) {
  try {
    const { workflowId, business_id, rotateSecret } = req.body ?? {};
    const businessId = resolveBusinessId(req, business_id);

    if (!workflowId || typeof workflowId !== "string") {
      return res.status(400).json({ error: "Missing required field: workflowId" });
    }
    if (!businessId) {
      return res.status(403).json({ error: "No accessible business for this account" });
    }

    const db = getSupabaseClient();
    const { data: workflow, error: workflowError } = await db
      .from("workflows")
      .select("id, steps")
      .eq("id", workflowId)
      .eq("business_id", businessId)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    let { secret, steps, changed } = ensureWebhookSecret(workflow.steps, Boolean(rotateSecret));
    if (changed) {
      const { error: updateError } = await db.from("workflows").update({ steps }).eq("id", workflowId);
      if (updateError) {
        log.error({ err: updateError }, "Failed to persist webhook secret");
        return res.status(500).json({ error: "Failed to generate webhook secret" });
      }
    }

    const webhookPath = `/api/workflows/webhook/${workflowId}`;
    res.json({
      success: true,
      webhookUrl: `${getAppUrl()}${webhookPath}`,
      path: webhookPath,
      secret,
      signatureHeader: "x-webhook-signature",
      signatureScheme: "sha256=HMAC_SHA256(secret, raw_body) hex",
    });
  } catch (error) {
    log.error({ err: error }, "handleGenerateWebhookUrl failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

function getWebhookSecret(steps: unknown): string | null {
  const list = Array.isArray(steps) ? (steps as WorkflowStep[]) : [];
  const trigger = list.find((s) => s?.type === "trigger") ?? list[0];
  const secret = trigger?.config?.webhook_secret;
  return typeof secret === "string" && secret.length >= 32 ? secret : null;
}

function ensureWebhookSecret(steps: unknown, rotate: boolean): { secret: string; steps: WorkflowStep[]; changed: boolean } {
  const list: WorkflowStep[] = Array.isArray(steps) ? JSON.parse(JSON.stringify(steps)) : [];
  const existing = rotate ? null : getWebhookSecret(list);
  if (existing) return { secret: existing, steps: list, changed: false };

  const secret = generateSecret();
  let trigger = list.find((s) => s?.type === "trigger");
  if (!trigger) {
    trigger = { id: "trigger", type: "trigger", app: "webhook", action: "receive", configured: true, config: {} };
    list.unshift(trigger);
  }
  trigger.config = { ...(trigger.config ?? {}), webhook_secret: secret };
  return { secret, steps: list, changed: true };
}

// ── Inbound webhook (public, HMAC-verified) ──────────────────────────────────
// POST /api/workflows/webhook/:workflowId   header: x-webhook-signature
export async function handleWorkflowWebhook(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;
    const payload = (req.body ?? {}) as WebhookPayload;
    const signature = req.headers["x-webhook-signature"];

    if (!workflowId) {
      return res.status(400).json({ error: "Workflow ID is required" });
    }

    const db = getSupabaseClient();
    const { data: workflow, error: workflowError } = await db
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("is_active", true)
      .eq("is_published", true)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: "Workflow not found or inactive" });
    }

    const secret = getWebhookSecret(workflow.steps);
    if (!secret) {
      return res.status(403).json({
        error: "Webhook secret not configured for this workflow. Generate a webhook URL first.",
      });
    }
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    if (!verifySignature(secret, rawBody, typeof signature === "string" ? signature : undefined)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const { data: execution, error: executionError } = await db
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
      log.error({ err: executionError }, "Error creating execution");
      return res.status(500).json({ error: "Failed to create execution" });
    }

    // Execute now and report what actually happened so callers can tell
    // accepted-and-executed apart from accepted-but-steps-failed.
    const run = await executeWorkflow(execution.id, workflow, payload);
    const failedSteps = run.steps.filter((step) => step.status === "failed");

    const requestedDestinations: string[] = Array.isArray(payload?.destinations)
      ? payload.destinations.filter((d: unknown): d is string => typeof d === "string")
      : [];
    const results =
      requestedDestinations.length > 0
        ? requestedDestinations.map((destination) => destinationOutcome(destination, run.steps))
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
            : "Workflow accepted, but it has no action steps; nothing was done"
          : `Workflow ran, but ${failedSteps.length > 0 ? `${failedSteps.length} of ${run.steps.length} step${run.steps.length === 1 ? "" : "s"} failed` : "it failed"}${run.errorMessage ? `: ${run.errorMessage}` : ""}`,
    });
  } catch (error) {
    log.error({ err: error }, "handleWorkflowWebhook failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

/** What actually happened when one workflow step ran. */
interface StepResult {
  stepId: string;
  app: string;
  action: string;
  status: "succeeded" | "failed";
  error?: string;
  /** Optional handler output (e.g. created job id). */
  output?: Record<string, any>;
}

interface WorkflowRunResult {
  status: "completed" | "failed";
  steps: StepResult[];
  errorMessage?: string;
}

async function executeWorkflow(
  executionId: string,
  workflow: any,
  triggerData: WebhookPayload,
): Promise<WorkflowRunResult> {
  const db = getSupabaseClient();
  try {
    const steps = (Array.isArray(workflow.steps) ? workflow.steps : []) as WorkflowStep[];
    const actionSteps = steps.filter((step) => step.type === "action");

    const results: StepResult[] = [];
    for (const step of actionSteps) {
      results.push(await executeAction(step, triggerData, executionId, workflow));
    }

    const failed = results.filter((result) => result.status === "failed");
    const status: "completed" | "failed" = failed.length > 0 ? "failed" : "completed";

    await db
      .from("workflow_executions")
      .update({
        status,
        ...(failed.length > 0
          ? { error_message: failed.map((r) => `${r.app}_${r.action}: ${r.error}`).join("; ") }
          : {}),
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    return { status, steps: results };
  } catch (error) {
    log.error({ err: error, executionId }, "executeWorkflow failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .from("workflow_executions")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", executionId);
    return { status: "failed", steps: [], errorMessage: message };
  }
}

/** Action handlers this server implements, keyed `${app}_${action}`. */
export const AVAILABLE_ACTIONS = ["webhook_send_webhook", "jobs_create_job", "rss_add_item"] as const;

async function executeAction(
  step: WorkflowStep,
  triggerData: WebhookPayload,
  executionId: string,
  workflow: any,
): Promise<StepResult> {
  const { id, app, action, config } = step;
  const base = { stepId: id, app, action };

  try {
    switch (`${app}_${action}`) {
      case "webhook_send_webhook": {
        const failure = await sendWebhook(config ?? {}, triggerData, executionId);
        return failure ? { ...base, status: "failed", error: failure } : { ...base, status: "succeeded" };
      }
      case "jobs_create_job": {
        const output = await createJob(config ?? {}, triggerData, workflow);
        return { ...base, status: "succeeded", output };
      }
      case "rss_add_item": {
        const output = await addRssItem(config ?? {}, triggerData, workflow);
        return { ...base, status: "succeeded", output };
      }
      default:
        return { ...base, status: "failed", error: `no handler for ${app}_${action}` };
    }
  } catch (error) {
    log.warn({ err: error, step: `${app}_${action}`, executionId }, "Workflow step failed");
    return { ...base, status: "failed", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Which builder apps publish to which destination a caller can request.
 * Only destinations with a real handler are mapped.
 */
const DESTINATION_STEP_APPS: Record<string, string[]> = {
  website: ["rss"],
};

function destinationOutcome(
  destination: string,
  steps: StepResult[],
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
      detail: `Publishing step ${failed.app}_${failed.action} failed (${failed.error}); nothing was published to ${destination}.`,
    };
  }
  return {
    destination,
    status: "sent",
    detail: `Workflow step ${matching[0].app}_${matching[0].action} completed.`,
  };
}

/** Replace {{variable.path}} tokens in a string using a context object */
function interpolate(template: string, context: Record<string, any>): string {
  return String(template).replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const parts = path.split(".");
    let val: any = context;
    for (const part of parts) {
      if (val == null) return "";
      val = val[part];
    }
    return val != null ? String(val) : "";
  });
}

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
    ...payload,
  };
}

function firstString(...values: unknown[]): string {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

// ── jobs_create_job ──────────────────────────────────────────────────────────
// Inserts into `jobs` for the workflow's business. Field precedence:
// step config templates (interpolated) > payload job.* / top-level fields.
async function createJob(
  config: Record<string, any>,
  payload: WebhookPayload,
  workflow: any,
): Promise<Record<string, any>> {
  const db = getSupabaseClient();
  const ctx = buildContext(payload);
  const job = payload.job ?? {};
  const client = payload.client ?? payload.contact ?? {};

  const name = firstString(
    config.name && interpolate(config.name, ctx),
    config.title && interpolate(config.title, ctx),
    job.name, job.title, payload.name, payload.title, payload.jobTitle, payload.jobName,
  );
  if (!name) throw new Error("job name/title is required to create a job");

  const description = firstString(
    config.description && interpolate(config.description, ctx),
    job.description, payload.description, payload.jobDescription,
  );
  const clientName = firstString(
    config.client_name && interpolate(config.client_name, ctx),
    client.name, payload.clientName, payload.contactName, payload.customerName,
    [client.firstName, client.lastName].filter(Boolean).join(" "),
  );
  const address = firstString(
    config.address && interpolate(config.address, ctx),
    typeof job.address === "string" ? job.address : "",
    typeof client.address === "string" ? client.address : "",
    payload.address, payload.jobAddress, payload.location, payload.jobLocation,
  );
  const clientEmail = firstString(client.email, payload.clientEmail, payload.contactEmail, payload.email);
  const clientPhone = firstString(client.phone, payload.clientPhone, payload.contactPhone, payload.phone);

  const row: Record<string, any> = {
    business_id: workflow.business_id,
    name: name.slice(0, 255),
    description: description || null,
    status: typeof config.status === "string" ? config.status : "draft",
    ...(typeof config.type === "string" && config.type ? { type: config.type } : {}),
    ...(typeof config.priority === "string" && config.priority ? { priority: config.priority } : {}),
    client_contact: {
      name: clientName || null,
      email: clientEmail || null,
      phone: clientPhone || null,
      address: address || null,
    },
    metadata: {
      source: "workflow",
      workflow_id: workflow.id,
      address: address || null,
      external_id: firstString(job.id, payload.jobId, payload.id) || null,
    },
  };

  const { data, error } = await db.from("jobs").insert(row).select("id").single();
  if (error) {
    log.error({ err: error }, "jobs_create_job insert failed");
    throw new Error("failed to create job");
  }
  return { jobId: data.id };
}

// ── rss_add_item ─────────────────────────────────────────────────────────────
async function addRssItem(
  config: Record<string, any>,
  payload: WebhookPayload,
  workflow: any,
): Promise<Record<string, any>> {
  const db = getSupabaseClient();
  const ctx = buildContext(payload);
  const title = firstString(
    config.item_title && interpolate(config.item_title, ctx),
    payload.item_title, payload.title, payload.job?.title, payload.jobTitle,
  );
  if (!title) throw new Error("item_title is required");
  const { data, error } = await db
    .from("rss_feed_items")
    .insert({
      workflow_id: String(workflow.id),
      sub_account_id: payload.sub_account_id || null,
      feed_title: firstString(config.feed_title && interpolate(config.feed_title, ctx), payload.feed_title) || "Completed Jobs Feed",
      item_title: title,
      item_description: firstString(config.item_description && interpolate(config.item_description, ctx), payload.item_description, payload.description),
      item_link: firstString(config.item_link && interpolate(config.item_link, ctx), payload.item_link, payload.link) || null,
    })
    .select("id")
    .single();
  if (error) {
    log.error({ err: error }, "rss_add_item insert failed");
    throw new Error("failed to add RSS item");
  }
  return { itemId: data.id };
}

// ── webhook_send_webhook ─────────────────────────────────────────────────────
// Returns null on success, or a reason string when delivery did not succeed.
async function sendWebhook(
  config: Record<string, any>,
  payload: WebhookPayload,
  executionId: string,
): Promise<string | null> {
  const {
    target_url,
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
    signing_secret,
  } = config;

  const resolvedUrl = target_url || legacyTargetUrl;
  if (!resolvedUrl) throw new Error("Target URL is required for send webhook action");

  const context = buildContext(payload);
  const requestHeaders: Record<string, string> = { "Content-Type": content_type };

  if (Array.isArray(headerItems)) {
    for (const h of headerItems) {
      if (h?.key) requestHeaders[h.key] = interpolate(h.value || "", context);
    }
  }

  if (auth_type === "bearer" && auth_token) {
    requestHeaders["Authorization"] = `Bearer ${auth_token}`;
  } else if (auth_type === "api_key" && api_key_name && api_key_value) {
    requestHeaders[api_key_name] = api_key_value;
  } else if (auth_type === "basic" && basic_username) {
    requestHeaders["Authorization"] = `Basic ${Buffer.from(`${basic_username}:${basic_password || ""}`).toString("base64")}`;
  }

  let finalUrl = resolvedUrl;
  if (Array.isArray(queryParamItems) && queryParamItems.length > 0) {
    const qs = new URLSearchParams();
    for (const p of queryParamItems) {
      if (p?.key) qs.append(p.key, interpolate(p.value || "", context));
    }
    finalUrl = `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}${qs.toString()}`;
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (raw_body && String(raw_body).trim()) {
      body = interpolate(raw_body, context);
    } else {
      const mergedData: Record<string, any> = { ...payload };
      if (Array.isArray(customDataItems)) {
        for (const item of customDataItems) {
          if (item?.key) mergedData[item.key] = interpolate(item.value || "", context);
        }
      }
      if (content_type === "application/x-www-form-urlencoded") {
        const form = new URLSearchParams();
        for (const [k, v] of Object.entries(mergedData)) form.append(k, String(v ?? ""));
        body = form.toString();
      } else {
        body = JSON.stringify(mergedData);
      }
    }
  }
  if (body !== undefined && typeof signing_secret === "string" && signing_secret) {
    requestHeaders["X-Webhook-Signature"] = signPayload(signing_secret, body);
  }

  const db = getSupabaseClient();
  let response: globalThis.Response;
  try {
    response = await safeFetch(finalUrl, { method, headers: requestHeaders, body, timeoutMs: 10_000 });
  } catch (err) {
    const reason = err instanceof SafeFetchError ? err.message : "request failed";
    await db.from("webhook_deliveries").insert({
      webhook_id: null,
      execution_id: executionId,
      payload,
      status: "failed",
      error_message: reason,
    });
    return `webhook delivery failed: ${reason}`;
  }

  const responseBody = (await response.text()).slice(0, 10_000);
  await db.from("webhook_deliveries").insert({
    webhook_id: null,
    execution_id: executionId,
    payload,
    status: response.ok ? "delivered" : "failed",
    http_status_code: response.status,
    response_body: responseBody,
  });

  if (!response.ok) {
    log.warn({ status: response.status }, "Webhook target responded with non-2xx");
    return `webhook target responded with HTTP ${response.status}`;
  }
  return null;
}

// GET /api/workflows/deliveries/:executionId  (auth)
export async function handleGetWebhookDeliveries(req: Request, res: Response) {
  try {
    const { executionId } = req.params;
    if (!executionId) return res.status(400).json({ error: "Missing executionId" });

    const db = getSupabaseClient();
    const { data: execution } = await db
      .from("workflow_executions")
      .select("id, business_id")
      .eq("id", executionId)
      .maybeSingle();

    if (!execution || !canAccessBusiness(req, execution.business_id as string)) {
      return res.status(404).json({ error: "Execution not found" });
    }

    const { data, error } = await db
      .from("webhook_deliveries")
      .select("*")
      .eq("execution_id", executionId)
      .order("created_at", { ascending: false });

    if (error) {
      log.error({ err: error }, "Error fetching deliveries");
      return res.status(500).json({ error: "Failed to fetch deliveries" });
    }

    res.json({ success: true, deliveries: data || [] });
  } catch (error) {
    log.error({ err: error }, "handleGetWebhookDeliveries failed");
    res.status(500).json({ error: "Internal server error" });
  }
}
