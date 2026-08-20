import { supabase } from "@/lib/dataService";

/** Row of the `plans` table (managed in Super Admin > Settings > Plans). */
export interface PlanRow {
  id: string;
  name: string;
  /** Stored as text in the DB (e.g. "$49" or "49"). Use planPriceNumber(). */
  price: string | number | null;
  features: string[] | null;
  max_users?: number | null;
  max_businesses?: number | null;
  is_active?: boolean;
  created_at?: string;
}

/** Parse the text `plans.price` column to a number; null if not numeric. */
export function planPriceNumber(price: string | number | null | undefined): number | null {
  if (price == null) return null;
  if (typeof price === "number") return price;
  const n = parseFloat(price.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Row of the `billing_records` table (written by the payment webhooks). */
export interface BillingRecordRow {
  id: string;
  business_id: string;
  type: string | null; // charge | refund | credit | ...
  status: string | null; // succeeded | failed | pending | refunded | ...
  amount: number | null;
  currency: string | null;
  description?: string | null;
  plan_name?: string | null;
  invoice_id?: string | null;
  payment_provider?: string | null;
  provider_receipt_url?: string | null;
  created_at: string;
}

export async function fetchPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as PlanRow[];
  return rows.sort(
    (a, b) => (planPriceNumber(a.price) ?? 0) - (planPriceNumber(b.price) ?? 0),
  );
}

export async function fetchBillingRecords(
  businessId: string,
  limit = 100,
): Promise<BillingRecordRow[]> {
  const { data, error } = await supabase
    .from("billing_records")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BillingRecordRow[];
}

/** The business' current plan name, as recorded by the payment confirmation. */
export async function fetchCurrentPlanName(
  businessId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("metadata")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  const meta = (data?.metadata ?? {}) as Record<string, any>;
  return meta.plan ?? meta.subscription_plan ?? null;
}

export function formatMoney(amount: number | null | undefined, currency = "usd") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(Number(amount));
  } catch {
    return `${currency.toUpperCase()} ${Number(amount).toFixed(2)}`;
  }
}
