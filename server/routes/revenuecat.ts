// ============================================================================
// RevenueCat webhook — App Store + Google Play in-app subscriptions.
//
// The mobile app buys subscriptions through StoreKit / Play Billing via the
// RevenueCat SDK. RevenueCat validates the receipt and POSTs an event here.
// We normalise that event into the SAME entitlement model the Stripe web path
// uses: upsert the business's single `subscriptions` row (UNIQUE business_id)
// and append the charge to `billing_records`. Feature-gating never checks
// "which store paid" — only status + plan.
//
// Auth: RevenueCat sends a fixed `Authorization` header configured in its
// dashboard; we compare it to REVENUECAT_WEBHOOK_AUTH in constant time. The
// endpoint is dormant (503) until that secret is set, mirroring Stripe.
//
// Body: plain JSON (no signature-over-raw-body like Stripe), so this route
// lands in the normal express.json zone.
// ============================================================================

import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";

const log = logger.child({ module: "revenuecat" });

type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "comped" | "incomplete";

/** RevenueCat `store` -> our billing_records.payment_provider value. */
function providerForStore(store: string | undefined): "app_store" | "play_store" | null {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "app_store";
  if (store === "PLAY_STORE") return "play_store";
  return null;
}

/**
 * Map a RevenueCat event type (+ period type) to our subscription status.
 * CANCELLATION means auto-renew was turned off — access continues until the
 * period ends, so we keep the row active but flag cancel_at_period_end. Only
 * EXPIRATION actually revokes.
 */
function statusForEvent(type: string, periodType: string | undefined): { status: SubStatus; cancelAtPeriodEnd: boolean } {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "SUBSCRIPTION_EXTENDED":
      return { status: periodType === "TRIAL" ? "trialing" : "active", cancelAtPeriodEnd: false };
    case "CANCELLATION":
      // Auto-renew off; still entitled until expiration.
      return { status: "active", cancelAtPeriodEnd: true };
    case "BILLING_ISSUE":
    case "SUBSCRIPTION_PAUSED":
      return { status: "past_due", cancelAtPeriodEnd: false };
    case "EXPIRATION":
      return { status: "canceled", cancelAtPeriodEnd: false };
    default:
      return { status: "incomplete", cancelAtPeriodEnd: false };
  }
}

/** Constant-time compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Resolve the business this purchase belongs to. */
async function resolveBusinessId(
  db: any,
  appUserId: string | undefined,
  attrBusinessId: string | null,
): Promise<string | null> {
  // 1) The client sets a `business_id` subscriber attribute at purchase time.
  if (attrBusinessId) {
    const { data } = await db.from("businesses").select("id").eq("id", attrBusinessId).maybeSingle();
    if (data?.id) return data.id;
  }
  // 2) Fall back to the business owned by the purchasing user (app_user_id is
  //    the Supabase user id set via Purchases.logIn). Oldest owned business.
  if (appUserId) {
    const { data } = await db
      .from("businesses")
      .select("id")
      .eq("owner_id", appUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

/** Resolve our plan id from the store product id, then the RC entitlement. */
async function resolvePlanId(
  db: any,
  productId: string | undefined,
  entitlementIds: string[] | undefined,
): Promise<string | null> {
  if (productId) {
    const { data } = await db
      .from("plans")
      .select("id")
      .or(`apple_product_id.eq.${productId},google_product_id.eq.${productId}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  const ent = entitlementIds?.[0];
  if (ent) {
    const { data } = await db.from("plans").select("id").eq("revenuecat_entitlement_id", ent).limit(1).maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

/** Pull a subscriber-attribute value out of the RC event shape. */
function attrValue(ev: any, key: string): string | null {
  const raw = ev?.subscriber_attributes?.[key];
  const v = raw?.value ?? null;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function handleRevenueCatWebhook(req: Request, res: Response) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!secret) {
    return res.status(503).json({
      error: "revenuecat_not_configured",
      message: "RevenueCat webhook auth is not configured. Set REVENUECAT_WEBHOOK_AUTH.",
    });
  }

  const auth = (req.headers["authorization"] as string | undefined) ?? "";
  if (!safeEqual(auth, secret)) {
    log.warn("revenuecat webhook auth mismatch");
    return res.status(401).json({ error: "unauthorized" });
  }

  const ev = (req.body?.event ?? {}) as any;
  const type = String(ev?.type ?? "");
  if (!type) return res.status(400).json({ error: "missing_event_type" });

  const db: any = getSupabaseClient();
  if (!db) {
    return res.status(503).json({ error: "supabase_not_configured" });
  }

  try {
    // TEST events (sent by the RC dashboard "Send test" button) carry no
    // purchase — acknowledge so the dashboard shows success.
    if (type === "TEST") return res.json({ received: true, test: true });

    const appUserId = (ev.app_user_id as string) || (ev.original_app_user_id as string) || undefined;
    const attrBusinessId = attrValue(ev, "business_id");
    const businessId = await resolveBusinessId(db, appUserId, attrBusinessId);
    if (!businessId) {
      // Nothing to attach to. Acknowledge (2xx) so RC does not retry forever,
      // but log loudly so the mismatch is visible.
      log.warn({ appUserId, attrBusinessId, type }, "revenuecat event has no matching business; skipping");
      return res.json({ received: true, applied: false, reason: "no_business" });
    }

    const store = providerForStore(ev.store);
    const { status, cancelAtPeriodEnd } = statusForEvent(type, ev.period_type);
    const planId = await resolvePlanId(db, ev.product_id, ev.entitlement_ids);
    const periodEnd = ev.expiration_at_ms ? new Date(Number(ev.expiration_at_ms)).toISOString() : null;

    // Upsert the single subscription row for this business.
    const { error: subErr } = await db.from("subscriptions").upsert(
      {
        business_id: businessId,
        plan_id: planId,
        provider: store ?? "app_store",
        store: store,
        revenuecat_app_user_id: appUserId ?? null,
        store_product_id: ev.product_id ?? null,
        store_transaction_id: ev.transaction_id ?? null,
        status,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );
    if (subErr) throw new Error(subErr.message);

    // Record the charge for purchase/renewal events that carry money. Upsert on
    // the store transaction id so RC retries don't double-count.
    const isCharge = type === "INITIAL_PURCHASE" || type === "RENEWAL" || type === "NON_RENEWING_PURCHASE";
    const txnId = ev.transaction_id ? String(ev.transaction_id) : null;
    if (isCharge && txnId && store) {
      const priceCents =
        typeof ev.price_in_purchased_currency === "number"
          ? Math.round(ev.price_in_purchased_currency * 100)
          : typeof ev.price === "number"
            ? Math.round(ev.price * 100)
            : 0;
      const { error: recErr } = await db.from("billing_records").upsert(
        {
          business_id: businessId,
          type: "charge",
          status: "paid",
          amount: priceCents / 100,
          amount_cents: priceCents,
          currency: (ev.currency as string)?.toLowerCase() || "usd",
          payment_provider: store,
          store_transaction_id: txnId,
          invoice_id: txnId,
          period_end: periodEnd,
          billing_period_end: periodEnd,
        },
        { onConflict: "store_transaction_id" },
      );
      if (recErr) log.warn({ err: recErr.message, txnId }, "revenuecat billing_record upsert failed");
    }

    log.info({ type, businessId, status, store }, "revenuecat event applied");
    return res.json({ received: true, applied: true });
  } catch (err: any) {
    log.error({ err: err?.message, type }, "revenuecat webhook handler error");
    return res.status(500).json({ error: "webhook_handler_error" });
  }
}
