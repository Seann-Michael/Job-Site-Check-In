import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount) || 0;
    const mode = body.mode || "one_time";
    const description = body.description || "Purchase";
    const metadata = body.metadata || {};

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalApiBase = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 501,
        body: JSON.stringify({ message: "PayPal not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment." }),
      };
    }

    // Get access token
    const tokenResp = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error("PayPal token error:", err);
      return { statusCode: 502, body: JSON.stringify({ message: "Failed to fetch PayPal token" }) };
    }

    const tokenJson = await tokenResp.json();
    const accessToken = tokenJson.access_token;

    if (mode === "one_time") {
      // Create order
      const orderResp = await fetch(`${paypalApiBase}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: amount.toFixed(2),
              },
              description,
              // attach application-level metadata to help map orders to users
              custom_id: metadata?.user_id ? String(metadata.user_id) : undefined,
            },
          ],
          application_context: {
            return_url: `${process.env.SITE_URL || "http://localhost:8888"}/payments/success?provider=paypal`,
            cancel_url: `${process.env.SITE_URL || "http://localhost:8888"}/payments/cancel`,
          },
        }),
      });

      if (!orderResp.ok) {
        const err = await orderResp.text();
        console.error("PayPal create order error:", err);
        return { statusCode: 502, body: JSON.stringify({ message: "Failed to create PayPal order" }) };
      }

      const order = await orderResp.json();
      const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;

      // Persist session in Supabase if available
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from("payments_sessions").insert([
            {
              id: order.id,
              provider: "paypal",
              mode: mode,
              amount: amount,
              currency: "USD",
              metadata: JSON.stringify(metadata),
              status: "created",
              raw: JSON.stringify(order),
            },
          ]);
        } catch (err) {
          console.warn("Failed to persist PayPal session in Supabase:", err);
        }
      }

      return { statusCode: 200, body: JSON.stringify({ url: approveLink }) };
    }

    // Subscription flow - requires PAYPAL_PLAN_ID env var
    if (mode === "subscription") {
      const planId = process.env.PAYPAL_PLAN_ID;
      if (!planId) {
        return { statusCode: 501, body: JSON.stringify({ message: "Subscription plan not configured. Set PAYPAL_PLAN_ID." }) };
      }

      const subResp = await fetch(`${paypalApiBase}/v1/billing/subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: planId,
          // attach app user id if provided in metadata so webhooks can map subscriptions
          custom_id: metadata?.user_id ? String(metadata.user_id) : undefined,
          application_context: {
            brand_name: process.env.SITE_NAME || "My App",
            return_url: `${process.env.SITE_URL || "http://localhost:8888"}/payments/success?provider=paypal`,
            cancel_url: `${process.env.SITE_URL || "http://localhost:8888"}/payments/cancel`,
          },
        }),
      });

      if (!subResp.ok) {
        const err = await subResp.text();
        console.error("PayPal create subscription error:", err);
        return { statusCode: 502, body: JSON.stringify({ message: "Failed to create PayPal subscription" }) };
      }

      const subscription = await subResp.json();
      const approveLink = subscription.links?.find((l: any) => l.rel === "approve")?.href;

      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from("payments_sessions").insert([
            {
              id: subscription.id,
              provider: "paypal",
              mode: mode,
              amount: amount,
              currency: "USD",
              metadata: JSON.stringify(metadata),
              status: "created",
              raw: JSON.stringify(subscription),
            },
          ]);
        } catch (err) {
          console.warn("Failed to persist PayPal subscription in Supabase:", err);
        }
      }

      return { statusCode: 200, body: JSON.stringify({ url: approveLink }) };
    }

    return { statusCode: 400, body: JSON.stringify({ message: "Invalid mode" }) };
  } catch (error: any) {
    console.error("create-checkout-paypal error:", error);
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
