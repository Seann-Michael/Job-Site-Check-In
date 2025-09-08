import type { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    const webhookSecret = process.env.COINBASE_COMMERCE_SHARED_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!webhookSecret) {
      return { statusCode: 501, body: JSON.stringify({ message: "Coinbase Commerce webhook not configured." }) };
    }

    const signature = event.headers["x-cc-webhook-signature"] as string || event.headers["X-CC-Webhook-Signature"] as string;
    const rawBody = event.body || "";

    if (!signature) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing signature header" }) };
    }

    // Verify signature: HMAC SHA256 of raw body using shared secret
    const computed = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    if (computed !== signature) {
      console.error("Coinbase webhook signature mismatch", { computed, signature });
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid signature" }) };
    }

    const eventJson = rawBody ? JSON.parse(rawBody) : {};
    const eventType = eventJson.type;
    const resource = eventJson.data;

    // Persist to Supabase
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Insert into payments_sessions as a record of webhook
        await supabase.from("payments_sessions").insert([
          {
            id: eventJson.id || resource?.id || null,
            provider: "coinbase",
            mode: null,
            amount: resource?.pricing?.local?.amount || null,
            currency: resource?.pricing?.local?.currency || "USD",
            metadata: JSON.stringify(resource?.metadata || {}),
            status: eventType,
            raw: JSON.stringify(eventJson),
          },
        ]);

        // For charge confirmed or charge succeeded events, insert into payments table
        if (eventType === "charge:confirmed" || eventType === "charge:failed" || eventType === "charge:delayed") {
          const status = eventType === "charge:confirmed" ? "completed" : eventType;
          await supabase.from("payments").insert([
            {
              provider: "coinbase",
              provider_event: eventType,
              external_id: resource?.id || null,
              amount: resource?.pricing?.local?.amount ? Number(resource.pricing.local.amount) : null,
              currency: resource?.pricing?.local?.currency || "USD",
              status,
              metadata: JSON.stringify(resource || {}),
              raw: JSON.stringify(eventJson),
            },
          ]);
        }
      } catch (err) {
        console.error("Failed to persist Coinbase webhook in Supabase:", err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    console.error("webhook-coinbase error:", error);
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
