import type { Request, Response } from "express";

import { getSupabaseClient } from "../supabaseClient";
import { getAppUrl } from "../lib/env";
import { getStripe } from "../lib/stripe";
import { logger } from "../lib/logger";
import { canWriteBusiness } from "../middleware/requireAuth";

const log = logger.child({ module: "payments" });

/**
 * A plan the server is willing to sell, looked up by the Stripe price id the
 * client asked for. The client never gets to name a plan or set a price — both
 * come from this row.
 */
type SellablePlan = {
  id: string;
  name: string;
  interval: string | null;
  stripe_price_id: string;
};

/**
 * Resolve a client-supplied Stripe price id against the `plans` table.
 * Returns null when the price is unknown or the plan is not active, which is
 * what stops a caller buying an arbitrary (e.g. cheapest) price on the account
 * and having it recorded as a higher tier.
 */
async function findSellablePlan(priceId: string): Promise<SellablePlan | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, interval, stripe_price_id, is_active")
    .eq("stripe_price_id", priceId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    interval: (data.interval as string) ?? null,
    stripe_price_id: data.stripe_price_id as string,
  };
}

// ── Stripe Checkout ───────────────────────────────────────────────────────────

export async function handleStripeCheckout(req: Request, res: Response) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return res.status(503).json({
      error: "stripe_not_configured",
      message: "Payments are not available right now. Please try again later or contact support.",
    });
  }

  // Throws EnvError (-> 500 via the global error handler) when APP_URL is unset.
  const appUrl = getAppUrl();

  try {
    // Shared client factory (dynamic import; never crashes if stripe pkg absent).
    const stripe = await getStripe();
    if (!stripe) {
      return res.status(503).json({
        error: "stripe_not_configured",
        message: "Payments are not available right now. Please try again later or contact support.",
      });
    }

    // SECURITY: everything that determines what is bought and who it is
    // recorded against is resolved on the server.
    //   - the price MUST be a Stripe Price that maps to an active row in
    //     `plans` (never a client-supplied amount, and never an arbitrary
    //     price id from the Stripe account);
    //   - the plan NAME comes from that row, not from the request body — the
    //     previous version let the caller label any purchase "Enterprise";
    //   - the business MUST be one the authenticated caller can write, so a
    //     purchase can no longer be recorded against someone else's tenant;
    //   - the receipt email comes from the session, not the body.
    // This route is mounted behind requireAuth, so req.profile is always set.
    const { priceId, businessId } = req.body ?? {};

    if (!priceId || typeof priceId !== "string") {
      return res.status(400).json({
        error: "price_id_required",
        message: "A plan is required to start checkout.",
      });
    }

    if (!businessId || typeof businessId !== "string") {
      return res.status(400).json({
        error: "business_id_required",
        message: "Select a business before starting checkout.",
      });
    }

    if (!canWriteBusiness(req, businessId)) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have access to this business.",
      });
    }

    const plan = await findSellablePlan(priceId);
    if (!plan) {
      return res.status(400).json({
        error: "unknown_plan",
        message: "That plan is not available for purchase.",
      });
    }

    const mode = plan.interval === "one_time" ? "payment" : "subscription";

    const sessionParams: any = {
      payment_method_types: ["card"],
      mode,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${appUrl}/admin/payments?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/payments?cancelled=1`,
      // Recorded on the session so the confirm step (below) knows what was
      // bought and for whom, without trusting the browser on the way back.
      metadata: {
        plan: plan.name,
        plan_id: plan.id,
        business_id: businessId,
        purchased_by: req.profile?.id ?? "",
      },
    };

    const email = req.profile?.email;
    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    log.error({ err: err?.message }, "checkout error");
    return res.status(500).json({ error: "stripe_error", message: "Checkout could not be started." });
  }
}

// ── Stripe Confirm — record the purchased plan on the business ────────────────

/**
 * Called by the client when Stripe redirects back with
 * ?success=1&session_id=... . Retrieves the session server-side (so the paid
 * status and metadata come from Stripe, not the browser) and, when paid,
 * writes the plan into businesses.metadata.plan — the key both the mobile app
 * (lib/workspace.ts toPlan) and the web admin screens already read.
 * Idempotent: re-confirming the same session rewrites the same value.
 *
 * Mounted behind requireAuth. The caller must be able to write the business
 * named on the session, so a leaked or guessed session id cannot be replayed
 * by a third party to move another tenant's plan.
 */
export async function handleStripeConfirm(req: Request, res: Response) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(503).json({
      error: "stripe_not_configured",
      message: "Payments are not available right now. Please try again later or contact support.",
    });
  }

  const sessionId = (req.body?.sessionId || req.query?.session_id) as string | undefined;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "missing_session_id", message: "session_id is required." });
  }

  try {
    const stripe = await getStripe();
    if (!stripe) {
      return res.status(503).json({
        error: "stripe_not_configured",
        message: "Payments are not available right now. Please try again later or contact support.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(402).json({
        error: "not_paid",
        message: "This checkout session hasn't been paid, so no plan was recorded.",
      });
    }

    const plan = session.metadata?.plan;
    const businessId = session.metadata?.business_id;
    if (!plan || !businessId) {
      // Older sessions (or checkouts started without a loaded business) carry
      // no business_id — nothing to record, and saying otherwise would lie.
      return res.json({
        applied: false,
        message:
          "Payment received, but the session isn't linked to a business, so the plan couldn't be recorded automatically.",
      });
    }

    if (!canWriteBusiness(req, businessId)) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have access to the business on this checkout session.",
      });
    }

    const supabase = getSupabaseClient();

    const { data: row, error: readError } = await supabase
      .from("businesses")
      .select("metadata")
      .eq("id", businessId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) {
      return res.status(404).json({
        error: "business_not_found",
        message: "Payment received, but the business on the session no longer exists.",
      });
    }

    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const { error: writeError } = await supabase
      .from("businesses")
      .update({ metadata: { ...metadata, plan }, updated_at: new Date().toISOString() })
      .eq("id", businessId);
    if (writeError) throw new Error(writeError.message);

    return res.json({ applied: true, plan, businessId });
  } catch (err: any) {
    log.error({ err: err?.message }, "confirm error");
    return res.status(500).json({ error: "stripe_error", message: "The payment could not be confirmed." });
  }
}

// ── Status endpoint — reports whether Stripe is configured ───────────────────

export async function handlePaymentStatus(_req: Request, res: Response) {
  return res.json({
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
}
