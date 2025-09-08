import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!stripeSecret || !stripeKey) {
      return { statusCode: 501, body: JSON.stringify({ message: "Stripe webhook or secret not configured." }) };
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2022-11-15" });

    const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
    if (!sig) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing stripe signature header" }) };
    }

    // event.body should be the raw request body string
    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body || "", sig as string, stripeSecret);
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err?.message || err);
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid signature" }) };
    }

    // Handle the event
    console.log("Stripe webhook received:", stripeEvent.type);

    // Use Supabase to persist transaction records if configured
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;

      // Retrieve payment intent or subscription details for more info
      let paymentIntent: Stripe.PaymentIntent | null = null;
      if (session.payment_intent) {
        try {
          paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        } catch (err) {
          console.warn("Failed to retrieve payment intent:", err);
        }
      }

      const amount = paymentIntent?.amount_received ?? session.amount_total ?? null;
      const currency = paymentIntent?.currency ?? session.currency ?? "usd";

      if (supabase) {
        try {
          await supabase.from("payments").insert([
            {
              provider: "stripe",
              provider_event: stripeEvent.type,
              external_id: session.id,
              amount: amount ? Number(amount) : null,
              currency,
              status: "completed",
              metadata: JSON.stringify(session.metadata || {}),
              raw: JSON.stringify(session),
            },
          ]);
        } catch (err) {
          console.error("Failed to persist Stripe payment in Supabase:", err);
        }
      }
    }

    // Handle subscription payment events
    if (stripeEvent.type === "invoice.paid") {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      const amount = invoice.amount_paid ?? null;
      const currency = invoice.currency ?? "usd";

      if (supabase) {
        try {
          await supabase.from("payments").insert([
            {
              provider: "stripe",
              provider_event: stripeEvent.type,
              external_id: invoice.id,
              amount: amount ? Number(amount) : null,
              currency,
              status: "paid",
              metadata: JSON.stringify(invoice.metadata || {}),
              raw: JSON.stringify(invoice),
            },
          ]);
        } catch (err) {
          console.error("Failed to persist Stripe invoice in Supabase:", err);
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    console.error("webhook-stripe error:", error);
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
