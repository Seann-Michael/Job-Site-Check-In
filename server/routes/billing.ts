/**
 * Billing API — /api/billing/* and the Stripe webhook (/api/webhooks/stripe).
 *
 * Source of truth is Stripe WHEN CONFIGURED. Every Stripe call goes through
 * getStripe(); when STRIPE_SECRET_KEY is unset the client is null and any
 * endpoint that strictly needs Stripe returns 503 (`STRIPE_NOT_CONFIGURED`),
 * while the manual / comp controls keep working against the database.
 *
 * Authorization:
 *   - the whole router is behind requireAuth.
 *   - plan CRUD, overview, per-business views + mutations: super_admin only.
 *   - GET /my: any user who can_read_business the target business (owner/member).
 *
 * All writes to `subscriptions` and `billing_records` happen here with the
 * service role (PostgREST has SELECT-only for those tables — see migration
 * 20260820011000_billing.sql). Every plan/subscription change is audited.
 * Client-supplied money is never trusted for Stripe charges — amounts come
 * from the plan record or Stripe; the only place an admin-supplied amount is
 * stored is the explicitly-manual invoice endpoint.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import type Stripe from "stripe";

import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { getStripe, STRIPE_NOT_CONFIGURED, isStripeConfigured } from "../lib/stripe";
import { getAppUrl } from "../lib/env";
import {
  requireAuth,
  requireRole,
  canAccessBusiness,
} from "../middleware/requireAuth";

const log = logger.child({ module: "billing" });
const reqLog = (req: Request) => (req.log ?? log).child({ module: "billing" });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUB_STATUSES = ["trialing", "active", "past_due", "canceled", "comped", "incomplete"] as const;
type SubStatus = (typeof SUB_STATUSES)[number];

const INVOICE_STATUSES = ["paid", "open", "void", "uncollectible", "refunded"] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Statuses that count as a live subscription (for active count / by-plan). */
const LIVE_STATUSES: SubStatus[] = ["active", "trialing", "past_due", "comped"];
/** Statuses that contribute paid revenue to MRR (comped is free -> excluded). */
const MRR_STATUSES: SubStatus[] = ["active", "trialing", "past_due"];

// ── Rate limiting (per user) — mutations only ────────────────────────────────
const mutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many billing changes, please slow down and try again later" },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function validUuidParam(req: Request, res: Response, name: string): string | null {
  const id = req.params[name];
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    res.status(400).json({ error: `Invalid ${name}` });
    return null;
  }
  return id;
}

/** Monthly-normalized cents for a plan (yearly -> /12). */
function monthlyCents(amountCents: number | null | undefined, interval: string | null | undefined): number {
  const cents = Number(amountCents) || 0;
  return interval === "year" ? Math.round(cents / 12) : cents;
}

function centsToDisplay(amountCents: number | null | undefined): string {
  const cents = Number(amountCents) || 0;
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Coerce a client value to an integer number of cents, or null. */
function toCents(body: Record<string, unknown>): number | null {
  if (typeof body.amount_cents === "number" && Number.isFinite(body.amount_cents)) {
    return Math.round(body.amount_cents);
  }
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
    return Math.round(body.amount * 100);
  }
  return null;
}

function mapStripeStatus(s: string | null | undefined): SubStatus {
  switch (s) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "unpaid": return "past_due";
    case "paused": return "past_due";
    case "canceled": return "canceled";
    case "incomplete": return "incomplete";
    case "incomplete_expired": return "incomplete";
    default: return "incomplete";
  }
}

async function writeAudit(
  req: Request,
  entry: {
    action: "create" | "update" | "delete" | "permission_change";
    resourceType: string;
    resourceId?: string | null;
    businessId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const db: any = getSupabaseClient();
    const { error } = await db.from("audit_logs").insert({
      user_id: req.user?.id ?? null,
      business_id: entry.businessId ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId && UUID_RE.test(entry.resourceId) ? entry.resourceId : null,
      details: { actor_email: req.profile?.email ?? req.user?.email ?? null, ...(entry.details ?? {}) },
      ip_address: req.ip ?? null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    });
    if (error) reqLog(req).warn({ err: error }, "audit_logs insert failed");
  } catch (err) {
    reqLog(req).warn({ err }, "audit_logs insert threw");
  }
}

/** Shape returned for a plan row (all columns). */
function planSelect() {
  return "id, name, price, features, max_users, max_businesses, is_active, interval, amount_cents, stripe_price_id, stripe_product_id, sort_order, created_at, updated_at";
}

function subscriptionSelect() {
  return "id, business_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_end, cancel_at_period_end, created_at, updated_at, plans(id, name, amount_cents, interval)";
}

// ── Plans CRUD (super admin) ─────────────────────────────────────────────────

async function listPlans(_req: Request, res: Response) {
  const db: any = getSupabaseClient();
  const { data, error } = await db
    .from("plans")
    .select(planSelect())
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ plans: data ?? [] });
}

async function createPlan(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const interval = body.interval === "year" ? "year" : "month";
  const amountCents = toCents(body);
  if (amountCents === null || amountCents < 0) {
    return res.status(400).json({ error: "amount (or amount_cents) must be a non-negative number" });
  }
  const features = Array.isArray(body.features)
    ? (body.features as unknown[]).filter((f) => typeof f === "string").map((f) => (f as string).slice(0, 200)).slice(0, 50)
    : [];
  const isActive = body.is_active === undefined ? true : !!body.is_active;
  const sortOrder = typeof body.sort_order === "number" ? Math.round(body.sort_order) : 0;
  const maxUsers = typeof body.max_users === "number" ? Math.round(body.max_users) : null;
  const maxBusinesses = typeof body.max_businesses === "number" ? Math.round(body.max_businesses) : null;

  let stripeProductId: string | null = null;
  let stripePriceId: string | null = null;
  const stripe = await getStripe();
  if (stripe && amountCents > 0) {
    try {
      const product = await stripe.products.create({ name });
      const price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: amountCents,
        recurring: { interval: interval as "month" | "year" },
      });
      stripeProductId = product.id;
      stripePriceId = price.id;
    } catch (err: any) {
      reqLog(req).error({ err }, "stripe product/price create failed");
      return res.status(502).json({ error: "stripe_error", message: err?.message || "Stripe product creation failed" });
    }
  }

  const db: any = getSupabaseClient();
  const { data, error } = await db
    .from("plans")
    .insert({
      name,
      interval,
      amount_cents: amountCents,
      price: centsToDisplay(amountCents),
      features,
      is_active: isActive,
      sort_order: sortOrder,
      max_users: maxUsers,
      max_businesses: maxBusinesses,
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    })
    .select(planSelect())
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, { action: "create", resourceType: "plan", resourceId: data.id, details: { name, amount_cents: amountCents, interval, stripe: !!stripePriceId } });
  return res.status(201).json({ plan: data });
}

async function updatePlan(req: Request, res: Response) {
  const id = validUuidParam(req, res, "id");
  if (!id) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const db: any = getSupabaseClient();
  const { data: existing, error: readErr } = await db.from("plans").select(planSelect()).eq("id", id).maybeSingle();
  if (readErr) return res.status(500).json({ error: readErr.message });
  if (!existing) return res.status(404).json({ error: "Plan not found" });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (body.interval === "year" || body.interval === "month") patch.interval = body.interval;
  if (Array.isArray(body.features)) {
    patch.features = (body.features as unknown[]).filter((f) => typeof f === "string").map((f) => (f as string).slice(0, 200)).slice(0, 50);
  }
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;
  if (typeof body.sort_order === "number") patch.sort_order = Math.round(body.sort_order);
  if (typeof body.max_users === "number") patch.max_users = Math.round(body.max_users);
  if (typeof body.max_businesses === "number") patch.max_businesses = Math.round(body.max_businesses);

  const newAmount = toCents(body);
  const amountChanged = newAmount !== null && newAmount !== existing.amount_cents;
  const intervalChanged = patch.interval !== undefined && patch.interval !== existing.interval;
  if (newAmount !== null) {
    if (newAmount < 0) return res.status(400).json({ error: "amount must be non-negative" });
    patch.amount_cents = newAmount;
    patch.price = centsToDisplay(newAmount);
  }

  // Stripe prices are immutable: when the amount or interval changes, create a
  // NEW price, point stripe_price_id at it, and archive the old one.
  const stripe = await getStripe();
  if (stripe) {
    try {
      const effectiveInterval = (patch.interval as string) ?? existing.interval ?? "month";
      const effectiveAmount = newAmount ?? existing.amount_cents ?? 0;
      let productId = existing.stripe_product_id as string | null;
      if (!productId && effectiveAmount > 0) {
        const product = await stripe.products.create({ name: (patch.name as string) ?? existing.name });
        productId = product.id;
        patch.stripe_product_id = productId;
      } else if (productId && patch.name) {
        await stripe.products.update(productId, { name: patch.name as string });
      }
      if (productId && (amountChanged || intervalChanged) && effectiveAmount > 0) {
        const price = await stripe.prices.create({
          product: productId,
          currency: "usd",
          unit_amount: effectiveAmount,
          recurring: { interval: effectiveInterval as "month" | "year" },
        });
        if (existing.stripe_price_id) {
          try { await stripe.prices.update(existing.stripe_price_id as string, { active: false }); } catch { /* archive best-effort */ }
        }
        patch.stripe_price_id = price.id;
      }
    } catch (err: any) {
      reqLog(req).error({ err }, "stripe plan sync failed");
      return res.status(502).json({ error: "stripe_error", message: err?.message || "Stripe plan sync failed" });
    }
  }

  if (Object.keys(patch).length === 0) return res.json({ plan: existing });

  const { data, error } = await db.from("plans").update(patch).eq("id", id).select(planSelect()).single();
  if (error) return res.status(500).json({ error: error.message });
  await writeAudit(req, { action: "update", resourceType: "plan", resourceId: id, details: { changed: Object.keys(patch) } });
  return res.json({ plan: data });
}

async function deletePlan(req: Request, res: Response) {
  const id = validUuidParam(req, res, "id");
  if (!id) return;
  const db: any = getSupabaseClient();
  const { data: existing } = await db.from("plans").select(planSelect()).eq("id", id).maybeSingle();
  if (!existing) return res.status(404).json({ error: "Plan not found" });

  // Archive the Stripe price/product (best-effort) so it stops being purchasable.
  const stripe = await getStripe();
  if (stripe) {
    try {
      if (existing.stripe_price_id) await stripe.prices.update(existing.stripe_price_id as string, { active: false });
      if (existing.stripe_product_id) await stripe.products.update(existing.stripe_product_id as string, { active: false });
    } catch (err) {
      reqLog(req).warn({ err }, "stripe archive on plan delete failed (continuing)");
    }
  }

  // Hard-delete when unreferenced; otherwise archive (is_active=false) so we
  // never orphan a subscription's plan_id.
  const { error } = await db.from("plans").delete().eq("id", id);
  if (error) {
    const { data: archived, error: archErr } = await db
      .from("plans").update({ is_active: false }).eq("id", id).select(planSelect()).single();
    if (archErr) return res.status(500).json({ error: archErr.message });
    await writeAudit(req, { action: "update", resourceType: "plan", resourceId: id, details: { archived: true, reason: "referenced_by_subscriptions" } });
    return res.json({ plan: archived, archived: true });
  }
  await writeAudit(req, { action: "delete", resourceType: "plan", resourceId: id, details: { name: existing.name } });
  return res.status(204).end();
}

// ── Overview / revenue dashboard (super admin) ───────────────────────────────

async function overview(_req: Request, res: Response) {
  const db: any = getSupabaseClient();

  const [{ data: subs, error: subErr }, { data: invoices, error: invErr }] = await Promise.all([
    db.from("subscriptions").select("status, plan_id, updated_at, plans(name, amount_cents, interval)"),
    db.from("billing_records").select("amount_cents, amount, status, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  if (subErr) return res.status(500).json({ error: subErr.message });
  if (invErr) return res.status(500).json({ error: invErr.message });

  const subRows = (subs ?? []) as any[];

  let mrrCents = 0;
  let activeCount = 0;
  const byPlan = new Map<string, { planId: string | null; planName: string; count: number; mrrCents: number }>();

  for (const s of subRows) {
    const status = s.status as SubStatus;
    if (!LIVE_STATUSES.includes(status)) continue;
    activeCount += 1;
    const plan = s.plans || {};
    const m = monthlyCents(plan.amount_cents, plan.interval);
    const contributes = MRR_STATUSES.includes(status) ? m : 0;
    mrrCents += contributes;
    const key = s.plan_id || "none";
    const entry = byPlan.get(key) || { planId: s.plan_id ?? null, planName: plan.name || "—", count: 0, mrrCents: 0 };
    entry.count += 1;
    entry.mrrCents += contributes;
    byPlan.set(key, entry);
  }

  // Trailing revenue by month (paid invoices), last 12 calendar months.
  const now = new Date();
  const months: { month: string; revenueCents: number }[] = [];
  const monthIndex = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthIndex.set(key, months.length);
    months.push({ month: key, revenueCents: 0 });
  }
  for (const inv of (invoices ?? []) as any[]) {
    if (inv.status !== "paid") continue;
    if (!inv.created_at) continue;
    const d = new Date(inv.created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx === undefined) continue;
    const cents = typeof inv.amount_cents === "number" ? inv.amount_cents : Math.round((Number(inv.amount) || 0) * 100);
    months[idx].revenueCents += cents;
  }

  // Churn: canceled in last 30d / (active now + canceled in last 30d).
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let canceledLast30 = 0;
  for (const s of subRows) {
    if (s.status === "canceled" && s.updated_at && new Date(s.updated_at).getTime() >= cutoff) canceledLast30 += 1;
  }
  const churnDenom = activeCount + canceledLast30;
  const churnRate = churnDenom > 0 ? canceledLast30 / churnDenom : 0;

  return res.json({
    mrrCents,
    mrr: mrrCents / 100,
    activeCount,
    byPlan: Array.from(byPlan.values()).sort((a, b) => b.mrrCents - a.mrrCents),
    revenueByMonth: months,
    churn: { canceledLast30, activeCount, rate: Number(churnRate.toFixed(4)) },
    stripeConfigured: isStripeConfigured(),
  });
}

// ── Per-business views + mutations (super admin) ─────────────────────────────

async function businessBilling(req: Request, res: Response) {
  const businessId = validUuidParam(req, res, "businessId");
  if (!businessId) return;
  const db: any = getSupabaseClient();
  const [{ data: sub }, { data: records, error: recErr }] = await Promise.all([
    db.from("subscriptions").select(subscriptionSelect()).eq("business_id", businessId).maybeSingle(),
    db.from("billing_records").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200),
  ]);
  if (recErr) return res.status(500).json({ error: recErr.message });
  return res.json({ subscription: sub ?? null, invoices: records ?? [] });
}

/** Ensure the business has a Stripe customer; returns the id (creating one if needed). */
async function ensureStripeCustomer(stripe: Stripe, businessId: string): Promise<string> {
  const db: any = getSupabaseClient();
  const { data: biz } = await db.from("businesses").select("id, name, email, stripe_customer_id").eq("id", businessId).maybeSingle();
  if (!biz) throw new Error("business_not_found");
  if (biz.stripe_customer_id) return biz.stripe_customer_id as string;
  const customer = await stripe.customers.create({
    name: biz.name || undefined,
    email: biz.email || undefined,
    metadata: { business_id: businessId },
  });
  await db.from("businesses").update({ stripe_customer_id: customer.id }).eq("id", businessId);
  return customer.id;
}

async function upsertSubscriptionRow(row: Record<string, unknown>) {
  const db: any = getSupabaseClient();
  return db.from("subscriptions").upsert(row, { onConflict: "business_id" }).select("id").single();
}

async function assignPlan(req: Request, res: Response) {
  const businessId = validUuidParam(req, res, "businessId");
  if (!businessId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const planId = typeof body.planId === "string" ? body.planId : "";
  const mode = body.mode;
  if (!UUID_RE.test(planId)) return res.status(400).json({ error: "planId must be a valid uuid" });
  if (mode !== "stripe" && mode !== "comp" && mode !== "manual") {
    return res.status(400).json({ error: "mode must be one of 'stripe' | 'comp' | 'manual'" });
  }

  const db: any = getSupabaseClient();
  const [{ data: biz }, { data: plan }] = await Promise.all([
    db.from("businesses").select("id, metadata").eq("id", businessId).maybeSingle(),
    db.from("plans").select(planSelect()).eq("id", planId).maybeSingle(),
  ]);
  if (!biz) return res.status(404).json({ error: "Business not found" });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  // Mirror the plan name onto businesses.metadata.plan (the key the app reads).
  const meta = biz.metadata && typeof biz.metadata === "object" && !Array.isArray(biz.metadata) ? (biz.metadata as Record<string, unknown>) : {};
  const mirrorPlanName = async () => {
    await db.from("businesses").update({ metadata: { ...meta, plan: plan.name } }).eq("id", businessId);
  };

  if (mode === "comp" || mode === "manual") {
    const status: SubStatus = mode === "comp" ? "comped" : "active";
    const { error } = await upsertSubscriptionRow({
      business_id: businessId,
      plan_id: planId,
      status,
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return res.status(500).json({ error: error.message });
    await mirrorPlanName();
    await writeAudit(req, { action: "update", resourceType: "subscription", businessId, details: { mode, plan_id: planId, status } });
    return res.json({ ok: true, mode, status, planId });
  }

  // mode === 'stripe'
  const stripe = await getStripe();
  if (!stripe) return res.status(503).json(STRIPE_NOT_CONFIGURED);
  if (!plan.stripe_price_id) {
    return res.status(400).json({ error: "plan_not_synced", message: "This plan has no Stripe price. Re-save the plan with Stripe configured, or use comp/manual." });
  }

  let customerId: string;
  try {
    customerId = await ensureStripeCustomer(stripe, businessId);
  } catch (err: any) {
    if (err?.message === "business_not_found") return res.status(404).json({ error: "Business not found" });
    reqLog(req).error({ err }, "ensureStripeCustomer failed");
    return res.status(502).json({ error: "stripe_error", message: err?.message || "Could not create Stripe customer" });
  }

  try {
    // Does the customer already have a usable payment method? If not, send them
    // through Checkout instead of trying (and failing) to charge immediately.
    const customer = await stripe.customers.retrieve(customerId);
    const hasPaymentMethod =
      !(customer as any).deleted &&
      (!!(customer as Stripe.Customer).invoice_settings?.default_payment_method ||
        !!(customer as Stripe.Customer).default_source);

    if (!hasPaymentMethod) {
      const appUrl = getAppUrl();
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: plan.stripe_price_id as string, quantity: 1 }],
        success_url: `${appUrl}/super-admin/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/super-admin/billing?cancelled=1`,
        metadata: { business_id: businessId, plan_id: planId },
        subscription_data: { metadata: { business_id: businessId, plan_id: planId } },
      });
      await writeAudit(req, { action: "update", resourceType: "subscription", businessId, details: { mode: "stripe", step: "checkout", plan_id: planId } });
      return res.json({ ok: true, mode: "stripe", checkoutUrl: session.url, requiresPaymentMethod: true });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripe_price_id as string }],
      metadata: { business_id: businessId, plan_id: planId },
    });

    const { error } = await upsertSubscriptionRow({
      business_id: businessId,
      plan_id: planId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: mapStripeStatus(subscription.status),
      current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: !!subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    });
    if (error) return res.status(500).json({ error: error.message });
    await mirrorPlanName();
    await writeAudit(req, { action: "update", resourceType: "subscription", businessId, details: { mode: "stripe", plan_id: planId, stripe_subscription_id: subscription.id } });
    return res.json({ ok: true, mode: "stripe", status: mapStripeStatus(subscription.status), stripeSubscriptionId: subscription.id });
  } catch (err: any) {
    reqLog(req).error({ err }, "stripe subscription create failed");
    return res.status(502).json({ error: "stripe_error", message: err?.message || "Stripe subscription failed" });
  }
}

async function cancelSubscription(req: Request, res: Response) {
  const businessId = validUuidParam(req, res, "businessId");
  if (!businessId) return;
  const atPeriodEnd = !!(req.body && (req.body as any).atPeriodEnd);

  const db: any = getSupabaseClient();
  const { data: sub } = await db.from("subscriptions").select("*").eq("business_id", businessId).maybeSingle();
  if (!sub) return res.status(404).json({ error: "No subscription for this business" });

  if (sub.stripe_subscription_id) {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json(STRIPE_NOT_CONFIGURED);
    try {
      if (atPeriodEnd) {
        const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
        await db.from("subscriptions").update({
          cancel_at_period_end: true,
          status: mapStripeStatus(updated.status),
          updated_at: new Date().toISOString(),
        }).eq("business_id", businessId);
      } else {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        await db.from("subscriptions").update({
          status: "canceled",
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq("business_id", businessId);
      }
    } catch (err: any) {
      reqLog(req).error({ err }, "stripe cancel failed");
      return res.status(502).json({ error: "stripe_error", message: err?.message || "Stripe cancel failed" });
    }
  } else {
    // comp / manual subscription — just mark it.
    await db.from("subscriptions").update({
      status: atPeriodEnd ? sub.status : "canceled",
      cancel_at_period_end: atPeriodEnd,
      updated_at: new Date().toISOString(),
    }).eq("business_id", businessId);
  }

  await writeAudit(req, { action: "update", resourceType: "subscription", businessId, details: { event: "cancel", atPeriodEnd } });
  return res.json({ ok: true, atPeriodEnd });
}

async function recordManualInvoice(req: Request, res: Response) {
  const businessId = validUuidParam(req, res, "businessId");
  if (!businessId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const amountCents = toCents(body);
  if (amountCents === null || amountCents < 0) {
    return res.status(400).json({ error: "amount (or amount_cents) is required and must be non-negative" });
  }
  const status = typeof body.status === "string" && (INVOICE_STATUSES as readonly string[]).includes(body.status)
    ? (body.status as InvoiceStatus)
    : "paid";
  const periodStart = typeof body.period_start === "string" ? body.period_start : null;
  const periodEnd = typeof body.period_end === "string" ? body.period_end : null;
  const description = typeof body.description === "string" ? body.description.slice(0, 500) : null;

  const db: any = getSupabaseClient();
  const { data: biz } = await db.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (!biz) return res.status(404).json({ error: "Business not found" });

  const { data, error } = await db.from("billing_records").insert({
    business_id: businessId,
    type: "charge",
    status,
    amount: amountCents / 100,
    amount_cents: amountCents,
    currency: "usd",
    description,
    payment_provider: "manual",
    period_start: periodStart,
    period_end: periodEnd,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
  }).select("*").single();
  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, { action: "create", resourceType: "billing_record", resourceId: data.id, businessId, details: { manual: true, amount_cents: amountCents, status } });
  return res.status(201).json({ invoice: data });
}

// ── Owner-readable: current business's plan + invoices ───────────────────────

async function myBilling(req: Request, res: Response) {
  // businessId from the query; validated against can_read_business. Falls back
  // to the caller's first accessible business.
  let businessId = typeof req.query.businessId === "string" ? req.query.businessId : "";
  if (businessId && !UUID_RE.test(businessId)) return res.status(400).json({ error: "Invalid businessId" });
  if (!businessId) businessId = req.profile?.businessIds?.[0] ?? "";
  if (!businessId) return res.json({ subscription: null, planName: null, invoices: [] });
  if (!canAccessBusiness(req, businessId)) return res.status(404).json({ error: "Business not found" });

  const db: any = getSupabaseClient();
  const [{ data: sub }, { data: records, error: recErr }, { data: biz }] = await Promise.all([
    db.from("subscriptions").select(subscriptionSelect()).eq("business_id", businessId).maybeSingle(),
    db.from("billing_records").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
    db.from("businesses").select("metadata").eq("id", businessId).maybeSingle(),
  ]);
  if (recErr) return res.status(500).json({ error: recErr.message });
  const meta = (biz?.metadata ?? {}) as Record<string, any>;
  const planName = (sub as any)?.plans?.name ?? meta.plan ?? meta.subscription_plan ?? null;
  return res.json({ businessId, subscription: sub ?? null, planName, invoices: records ?? [] });
}

// ── Stripe webhook (no auth; signature-verified) ─────────────────────────────

/** Resolve the business id for a Stripe customer id. */
async function businessIdForCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const db: any = getSupabaseClient();
  const { data } = await db.from("businesses").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.id ?? null;
}

async function planIdForPrice(priceId: string | null | undefined): Promise<string | null> {
  if (!priceId) return null;
  const db: any = getSupabaseClient();
  const { data } = await db.from("plans").select("id").eq("stripe_price_id", priceId).maybeSingle();
  return data?.id ?? null;
}

async function upsertSubscriptionFromStripe(sub: Stripe.Subscription) {
  const db: any = getSupabaseClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const metaBusinessId = (sub.metadata?.business_id as string) || null;
  const businessId = metaBusinessId || (await businessIdForCustomer(customerId));
  if (!businessId) {
    log.warn({ subscription: sub.id, customer: customerId }, "stripe subscription has no matching business; skipping");
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const planId = await planIdForPrice(priceId);
  await db.from("subscriptions").upsert({
    business_id: businessId,
    plan_id: planId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId ?? null,
    status: mapStripeStatus(sub.status),
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "business_id" });
}

async function upsertInvoiceFromStripe(invoice: Stripe.Invoice, status: InvoiceStatus) {
  const db: any = getSupabaseClient();
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const businessId = (invoice.metadata?.business_id as string) || (await businessIdForCustomer(customerId));
  const amountCents = typeof invoice.amount_paid === "number" && invoice.amount_paid > 0
    ? invoice.amount_paid
    : (invoice.amount_due ?? invoice.total ?? 0);
  await db.from("billing_records").upsert({
    business_id: businessId,
    type: "charge",
    status,
    amount: (amountCents || 0) / 100,
    amount_cents: amountCents || 0,
    currency: invoice.currency || "usd",
    stripe_invoice_id: invoice.id,
    invoice_id: invoice.number ?? invoice.id,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    pdf_url: invoice.invoice_pdf ?? null,
    provider_invoice_url: invoice.hosted_invoice_url ?? null,
    payment_provider: "stripe",
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
  }, { onConflict: "stripe_invoice_id" });
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = await getStripe();
  // No-op cleanly when the integration is dormant.
  if (!secret || !stripe) {
    return res.status(503).json({ error: "stripe_not_configured", message: "Stripe webhook secret not configured." });
  }

  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    // req.body is the raw Buffer (express.raw mounted for this path in index.ts).
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, secret);
  } catch (err: any) {
    (req.log ?? log).warn({ err: err?.message }, "stripe webhook signature verification failed");
    return res.status(400).json({ error: "invalid_signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const businessId = (session.metadata?.business_id as string) || null;
        // Link the customer to the business if we know both.
        if (businessId && customerId) {
          const db: any = getSupabaseClient();
          await db.from("businesses").update({ stripe_customer_id: customerId }).eq("id", businessId);
        }
        if (session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          if (businessId && !sub.metadata?.business_id) sub.metadata = { ...(sub.metadata || {}), business_id: businessId };
          await upsertSubscriptionFromStripe(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const businessId = (sub.metadata?.business_id as string) || (await businessIdForCustomer(customerId));
        if (businessId) {
          const db: any = getSupabaseClient();
          await db.from("subscriptions").update({
            status: "canceled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          }).eq("business_id", businessId);
        }
        break;
      }
      case "invoice.paid": {
        await upsertInvoiceFromStripe(event.data.object as Stripe.Invoice, "paid");
        break;
      }
      case "invoice.payment_failed": {
        await upsertInvoiceFromStripe(event.data.object as Stripe.Invoice, "open");
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const businessId = await businessIdForCustomer(customerId);
        if (businessId) {
          const db: any = getSupabaseClient();
          await db.from("subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("business_id", businessId);
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err: any) {
    (req.log ?? log).error({ err, type: event.type }, "stripe webhook handler error");
    return res.status(500).json({ error: "webhook_handler_error" });
  }

  return res.json({ received: true });
}

// ── Router ───────────────────────────────────────────────────────────────────

/** Mount at /api/billing */
export const billingRouter = Router();
billingRouter.use(requireAuth);

// Owner-readable
billingRouter.get("/my", myBilling);

// Super-admin only
const admin = requireRole("super_admin");
billingRouter.get("/plans", admin, listPlans);
billingRouter.post("/plans", admin, mutationLimiter, createPlan);
billingRouter.patch("/plans/:id", admin, mutationLimiter, updatePlan);
billingRouter.delete("/plans/:id", admin, mutationLimiter, deletePlan);
billingRouter.get("/overview", admin, overview);
billingRouter.get("/business/:businessId", admin, businessBilling);
billingRouter.post("/business/:businessId/assign", admin, mutationLimiter, assignPlan);
billingRouter.post("/business/:businessId/cancel", admin, mutationLimiter, cancelSubscription);
billingRouter.post("/business/:businessId/invoices", admin, mutationLimiter, recordManualInvoice);
