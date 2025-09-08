import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount) || 0;
    const mode = body.mode || "one_time";
    const description = body.description || "Purchase";
    const interval = body.interval || "month"; // for subscriptions
    const metadata = body.metadata || {};

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!stripeKey) {
      return {
        statusCode: 501,
        body: JSON.stringify({ message: "Stripe not configured. Set STRIPE_SECRET_KEY in environment." }),
      };
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2022-11-15" });

    const successUrl = `${process.env.SITE_URL || "https://localhost:8888"}/payments/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.SITE_URL || "https://localhost:8888"}/payments/cancel`;

    // Build line items
    const line_items: any[] = [];

    if (mode === "one_time") {
      line_items.push({
        price_data: {
          currency: "usd",
          product_data: { name: description },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      });
    } else {
      // Subscription price data
      line_items.push({
        price_data: {
          currency: "usd",
          product_data: { name: description },
          recurring: { interval: interval },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: mode === "subscription" ? "subscription" : "payment",
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    // Optionally persist checkout session in Supabase for tracking
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("payments_sessions").insert([
          {
            id: session.id,
            provider: "stripe",
            mode: mode,
            amount: amount,
            currency: "usd",
            metadata: JSON.stringify(metadata),
            status: "created",
            raw: JSON.stringify(session),
          },
        ]);
      } catch (err) {
        console.warn("Failed to persist session in Supabase:", err);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error("create-checkout-stripe error:", error);
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
