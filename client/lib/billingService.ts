/**
 * Billing service — client for the /api/billing/* endpoints (super-admin plan
 * management, revenue overview, per-business subscriptions/invoices) plus the
 * owner-facing read (`getMyBilling`).
 *
 * All mutations go through the server (service role) — the client never writes
 * `subscriptions` or `billing_records` directly. Plan reads still use the
 * public `plans` table (anon-readable) for the pricing UI.
 */
import { supabase } from "@/lib/dataService";
import { apiFetch } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

/** Row of the `plans` table. */
export interface PlanRow {
  id: string;
  name: string;
  /** Legacy display text (e.g. "$49"). Prefer `amount_cents`. Use planPriceNumber(). */
  price: string | number | null;
  features: string[] | null;
  max_users?: number | null;
  max_businesses?: number | null;
  is_active?: boolean;
  /** Billing interval: 'month' | 'year'. */
  interval?: "month" | "year" | null;
  /** Authoritative amount in cents (used for MRR + Stripe). */
  amount_cents?: number | null;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Row of the `billing_records` table (invoice). */
export interface BillingRecordRow {
  id: string;
  business_id: string;
  type: string | null;
  status: string | null; // paid | open | void | uncollectible | refunded | (legacy: succeeded)
  amount: number | null;
  amount_cents?: number | null;
  currency: string | null;
  description?: string | null;
  plan_name?: string | null;
  invoice_id?: string | null;
  stripe_invoice_id?: string | null;
  payment_provider?: string | null;
  provider_receipt_url?: string | null;
  hosted_invoice_url?: string | null;
  pdf_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at: string;
}

export interface SubscriptionRow {
  id: string;
  business_id: string;
  plan_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  plans?: { id: string; name: string; amount_cents: number | null; interval: string | null } | null;
}

export interface OverviewData {
  mrrCents: number;
  mrr: number;
  activeCount: number;
  byPlan: { planId: string | null; planName: string; count: number; mrrCents: number }[];
  revenueByMonth: { month: string; revenueCents: number }[];
  churn: { canceledLast30: number; activeCount: number; rate: number };
  stripeConfigured: boolean;
}

export type AssignMode = "stripe" | "comp" | "manual";

export interface PlanInput {
  name: string;
  interval: "month" | "year";
  amount_cents: number;
  features: string[];
  is_active: boolean;
  sort_order?: number;
  max_users?: number | null;
  max_businesses?: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse the legacy text `plans.price` column to a number; null if not numeric. */
export function planPriceNumber(price: string | number | null | undefined): number | null {
  if (price == null) return null;
  if (typeof price === "number") return price;
  const n = parseFloat(price.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Dollar amount from a plan, preferring the authoritative `amount_cents`. */
export function planAmount(plan: Pick<PlanRow, "amount_cents" | "price">): number | null {
  if (typeof plan.amount_cents === "number") return plan.amount_cents / 100;
  return planPriceNumber(plan.price);
}

export function formatMoney(amount: number | null | undefined, currency = "usd") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(Number(amount));
  } catch {
    return `${currency.toUpperCase()} ${Number(amount).toFixed(2)}`;
  }
}

export function formatCents(cents: number | null | undefined, currency = "usd") {
  if (cents == null) return "—";
  return formatMoney(cents / 100, currency);
}

// ── Super-admin: plans ───────────────────────────────────────────────────────

/** List ALL plans (incl. inactive) — super admin. */
export async function getPlans(): Promise<PlanRow[]> {
  const { plans } = await apiFetch<{ plans: PlanRow[] }>("/api/billing/plans");
  return plans ?? [];
}

/** Create (no id) or update (with id) a plan — super admin. */
export async function savePlan(input: PlanInput & { id?: string }): Promise<PlanRow> {
  const { id, ...body } = input;
  if (id) {
    const { plan } = await apiFetch<{ plan: PlanRow }>(`/api/billing/plans/${id}`, { method: "PATCH", body });
    return plan;
  }
  const { plan } = await apiFetch<{ plan: PlanRow }>("/api/billing/plans", { method: "POST", body });
  return plan;
}

/** Delete (or archive if referenced) a plan — super admin. */
export async function deletePlan(id: string): Promise<void> {
  await apiFetch(`/api/billing/plans/${id}`, { method: "DELETE" });
}

// ── Super-admin: overview + per-business ─────────────────────────────────────

export function getOverview(): Promise<OverviewData> {
  return apiFetch<OverviewData>("/api/billing/overview");
}

export function getBusinessBilling(
  businessId: string,
): Promise<{ subscription: SubscriptionRow | null; invoices: BillingRecordRow[] }> {
  return apiFetch(`/api/billing/business/${businessId}`);
}

export function assignPlan(
  businessId: string,
  planId: string,
  mode: AssignMode,
): Promise<{ ok: boolean; mode: AssignMode; status?: string; checkoutUrl?: string; requiresPaymentMethod?: boolean }> {
  return apiFetch(`/api/billing/business/${businessId}/assign`, { method: "POST", body: { planId, mode } });
}

export function cancel(
  businessId: string,
  atPeriodEnd = false,
): Promise<{ ok: boolean; atPeriodEnd: boolean }> {
  return apiFetch(`/api/billing/business/${businessId}/cancel`, { method: "POST", body: { atPeriodEnd } });
}

export function recordInvoice(
  businessId: string,
  input: { amount_cents: number; status?: string; period_start?: string | null; period_end?: string | null; description?: string },
): Promise<{ invoice: BillingRecordRow }> {
  return apiFetch(`/api/billing/business/${businessId}/invoices`, { method: "POST", body: input });
}

// ── Owner-readable: current business plan + invoices ─────────────────────────

export function getMyBilling(
  businessId?: string,
): Promise<{ businessId?: string; subscription: SubscriptionRow | null; planName: string | null; invoices: BillingRecordRow[] }> {
  const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  return apiFetch(`/api/billing/my${qs}`);
}

// ── Legacy read helpers (still used by client/pages/Settings.tsx) ────────────
// The plan list stays a direct public read of `plans`. The per-business
// invoice + current-plan reads are REPOINTED at getMyBilling() (server, RLS-
// aware) so owners no longer read billing_records directly.
// TODO(billing): fold these into a single getMyBilling() call in Settings.tsx
// when that page is no longer being edited by other work.

export async function fetchPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as PlanRow[];
  return rows.sort((a, b) => (planAmount(a) ?? 0) - (planAmount(b) ?? 0));
}

export async function fetchBillingRecords(businessId: string, limit = 100): Promise<BillingRecordRow[]> {
  const { invoices } = await getMyBilling(businessId);
  return (invoices ?? []).slice(0, limit);
}

export async function fetchCurrentPlanName(businessId: string): Promise<string | null> {
  const { planName } = await getMyBilling(businessId);
  return planName ?? null;
}
