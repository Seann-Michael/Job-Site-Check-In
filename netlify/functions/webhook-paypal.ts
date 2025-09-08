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
        const eventType = webhookEvent.event_type;
        const resource = webhookEvent.resource;

        // Handle subscription lifecycle events
        if (eventType && eventType.startsWith("BILLING.SUBSCRIPTION.")) {
          const subscriptionId = resource?.id || null;
          const status = (resource?.status || eventType) as string | null;

          // Try to resolve user: prefer custom_id (application set on subscription creation), then subscriber.payer_id
          let userId: string | null = null;
          if (resource?.custom_id) {
            // assume custom_id contains app user id
            userId = String(resource.custom_id);
          } else if (resource?.subscriber?.payer_id) {
            const payerId = resource.subscriber.payer_id;
            try {
              const { data: user, error } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('paypal_payer_id', payerId)
                .single();
              if (user && user.id) userId = user.id;
            } catch (err) {
              console.warn('Error finding user by PayPal payer id:', err);
            }
          }

          // Persist a payments record for subscription event
          try {
            await supabase.from('payments').insert([
              {
                provider: 'paypal',
                provider_event: eventType,
                external_id: subscriptionId,
                amount: resource?.billing_info?.last_payment?.amount?.value || null,
                currency: resource?.billing_info?.last_payment?.amount?.currency_code || null,
                status: status,
                metadata: JSON.stringify(resource || {}),
                raw: JSON.stringify(webhookEvent),
              },
            ]);
          } catch (err) {
            console.error('Failed to persist PayPal subscription payment record:', err);
          }

          // If we resolved a user, attempt to upsert into user_subscriptions.
          // This will add a mapping from app user -> PayPal subscription id.
          if (userId) {
            try {
              await supabase.from('user_subscriptions').upsert({
                user_id: userId,
                paypal_subscription_id: subscriptionId,
                provider: 'paypal',
                status: status,
                current_period_start: resource?.billing_info?.next_billing_time || null,
                current_period_end: resource?.billing_info?.next_billing_time || null,
                plan_id: resource?.plan_id || null,
                updated_at: new Date().toISOString(),
              });
            } catch (err) {
              // If upsert fails (table may not have paypal_subscription_id column), log and continue
              console.warn('Failed to upsert PayPal subscription into user_subscriptions (this may be due to missing column):', err);
            }
          }
        }

        // For certain event types, persist payment record for one-off captures
        if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
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

        // Always log the webhook to payments_sessions
        try {
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
          console.warn('Failed to persist PayPal webhook session record:', err);
        }
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
