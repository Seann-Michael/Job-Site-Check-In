import type { Request, Response } from "express";

import { getSupabaseClient } from "../supabaseClient";
import { getAppUrl } from "../lib/env";
import { getStripe } from "../lib/stripe";

// ── Stripe Checkout ───────────────────────────────────────────────────────────

export async function handleStripeCheckout(req: Request, res: Response) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return res.status(503).json({
      error: "stripe_not_configured",
      message: "Stripe is not configured. Please add your STRIPE_SECRET_KEY environment variable.",
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
        message: "Stripe is not configured. Please add your STRIPE_SECRET_KEY environment variable.",
      });
    }

    const { mode = "subscription", priceId, amount = 4900, planName = "Pro", email, businessId } = req.body;

    let sessionParams: any = {
      payment_method_types: ["card"],
      success_url: `${appUrl}/admin/payments?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/payments?cancelled=1`,
      // business_id lets the success-redirect confirm step record the plan on
      // the purchasing business (see handleStripeConfirm below).
      metadata: { plan: planName, business_id: businessId || "" },
    };

    if (email) {
      sessionParams.customer_email = email;
    }

    if (mode === "subscription" && priceId) {
      // Use an existing Stripe Price ID
      sessionParams.mode = "subscription";
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    } else if (mode === "subscription") {
      // Create an ad-hoc recurring price
      sessionParams.mode = "subscription";
      sessionParams.line_items = [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          product_data: { name: planName },
          unit_amount: Math.round(amount * 100), // convert dollars to cents
        },
        quantity: 1,
      }];
    } else {
      // One-time payment
      sessionParams.mode = "payment";
      sessionParams.line_items = [{
        price_data: {
          currency: "usd",
          product_data: { name: planName },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("[stripe] checkout error:", err?.message);
    return res.status(500).json({ error: "stripe_error", message: err?.message || "Stripe checkout failed" });
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
 */
export async function handleStripeConfirm(req: Request, res: Response) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(503).json({
      error: "stripe_not_configured",
      message: "Stripe is not configured. Please add your STRIPE_SECRET_KEY environment variable.",
    });
  }

  const sessionId = (req.body?.sessionId || req.query?.session_id) as string | undefined;
  if (!sessionId) {
    return res.status(400).json({ error: "missing_session_id", message: "session_id is required." });
  }

  try {
    const stripe = await getStripe();
    if (!stripe) {
      return res.status(503).json({
        error: "stripe_not_configured",
        message: "Stripe is not configured. Please add your STRIPE_SECRET_KEY environment variable.",
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
        message: "Payment received, but the session isn't linked to a business, so the plan couldn't be recorded automatically.",
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "supabase_not_configured",
        message: "Payment received, but the database isn't configured on the server, so the plan couldn't be recorded.",
      });
    }

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
    console.error("[stripe] confirm error:", err?.message);
    return res.status(500).json({ error: "stripe_error", message: err?.message || "Couldn't confirm the payment." });
  }
}

// ── Status endpoint — reports whether Stripe is configured ───────────────────

export async function handlePaymentStatus(_req: Request, res: Response) {
  return res.json({
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
}
