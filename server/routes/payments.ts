import type { Request, Response } from "express";

// ── Stripe Checkout ───────────────────────────────────────────────────────────

export async function handleStripeCheckout(req: Request, res: Response) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return res.status(503).json({
      error: "stripe_not_configured",
      message: "Stripe is not configured. Please add your STRIPE_SECRET_KEY environment variable.",
    });
  }

  try {
    // Dynamic import so the server doesn't crash if stripe pkg is missing
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" as any });

    const { mode = "subscription", priceId, amount = 4900, planName = "Pro", email } = req.body;

    const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    let sessionParams: any = {
      payment_method_types: ["card"],
      success_url: `${appUrl}/admin/payments?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/payments?cancelled=1`,
      metadata: { plan: planName },
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

// ── PayPal Checkout ───────────────────────────────────────────────────────────

export async function handlePaypalCheckout(req: Request, res: Response) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).json({
      error: "paypal_not_configured",
      message: "PayPal is not configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.",
    });
  }

  try {
    const { amount = 49, planName = "Pro", mode = "one_time" } = req.body;
    const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    // Get PayPal access token
    const tokenRes = await fetch(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      }
    );

    if (!tokenRes.ok) throw new Error("Failed to get PayPal access token");
    const { access_token } = await tokenRes.json();

    // Create a PayPal order
    const orderRes = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          description: planName,
          amount: {
            currency_code: "USD",
            value: String(Number(amount).toFixed(2)),
          },
        }],
        application_context: {
          return_url: `${appUrl}/admin/payments?success=1`,
          cancel_url: `${appUrl}/admin/payments?cancelled=1`,
          brand_name: "Local SEO Ranker",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.json();
      throw new Error(err?.message || "Failed to create PayPal order");
    }

    const order = await orderRes.json();
    const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;

    if (!approveLink) throw new Error("No PayPal approval URL returned");

    return res.json({ url: approveLink, orderId: order.id });
  } catch (err: any) {
    console.error("[paypal] checkout error:", err?.message);
    return res.status(500).json({ error: "paypal_error", message: err?.message || "PayPal checkout failed" });
  }
}

// ── Status endpoint — check which providers are configured ───────────────────

export async function handlePaymentStatus(_req: Request, res: Response) {
  return res.json({
    stripe: !!process.env.STRIPE_SECRET_KEY,
    paypal: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  });
}
