import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    const paypalApiBase = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!clientId || !clientSecret || !webhookId) {
      return { statusCode: 501, body: JSON.stringify({ message: "PayPal not fully configured (client id/secret/webhook id required)." }) };
    }

    // Obtain access token
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

    // Verify webhook signature
    const transmissionId = event.headers["paypal-transmission-id"] as string;
    const transmissionTime = event.headers["paypal-transmission-time"] as string;
    const certUrl = event.headers["paypal-cert-url"] as string;
    const authAlgo = event.headers["paypal-auth-algo"] as string;
    const transmissionSig = event.headers["paypal-transmission-sig"] as string;

    const webhookEvent = event.body ? JSON.parse(event.body) : {};

    const verifyResp = await fetch(`${paypalApiBase}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });

    if (!verifyResp.ok) {
      const err = await verifyResp.text();
      console.error("PayPal verify webhook error:", err);
      return { statusCode: 400, body: JSON.stringify({ message: "Webhook signature verification failed" }) };
    }

    const verifyJson = await verifyResp.json();
    if (verifyJson.verification_status !== "SUCCESS") {
      console.warn("PayPal webhook verification_status:", verifyJson.verification_status);
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid webhook signature" }) };
    }

    // Persist event to Supabase
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // For certain event types, persist payment record
        const eventType = webhookEvent.event_type;
        if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
          const resource = webhookEvent.resource;
          await supabase.from("payments").insert([
            {
              provider: "paypal",
              provider_event: eventType,
              external_id: resource.id || resource.order_id || null,
              amount: resource.amount?.value || resource.purchase_units?.[0]?.amount?.value || null,
              currency: resource.amount?.currency_code || "USD",
              status: "completed",
              metadata: JSON.stringify(resource || {}),
              raw: JSON.stringify(webhookEvent),
            },
          ]);
        }

        // Always log the webhook
        await supabase.from("payments_sessions").insert([
          {
            id: webhookEvent.id || transmissionId,
            provider: "paypal",
            mode: null,
            amount: null,
            currency: null,
            metadata: JSON.stringify({ event_type: webhookEvent.event_type }),
            status: "webhook_received",
            raw: JSON.stringify(webhookEvent),
          },
        ]);
      } catch (err) {
        console.error("Failed to persist PayPal webhook in Supabase:", err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    console.error("webhook-paypal error:", error);
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
