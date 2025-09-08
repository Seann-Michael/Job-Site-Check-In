import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount) || 0;
    const mode = body.mode || "one_time";
    const description = body.description || "Purchase";
    const metadata = body.metadata || {};

    const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
    const apiVersion = process.env.COINBASE_COMMERCE_API_VERSION || "2018-03-22";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!apiKey) {
      return {
        statusCode: 501,
        body: JSON.stringify({ message: "Coinbase Commerce not configured. Set COINBASE_COMMERCE_API_KEY in environment." }),
      };
    }

    const redirectSuccess = `${process.env.SITE_URL || "http://localhost:8888"}/payments/success?provider=coinbase`;
    const redirectCancel = `${process.env.SITE_URL || "http://localhost:8888"}/payments/cancel`;

    const chargeBody: any = {
      name: description,
      description,
      local_price: { amount: amount.toFixed(2), currency: "USD" },
      pricing_type: "fixed_price",
      metadata,
      redirect_url: redirectSuccess,
      cancel_url: redirectCancel,
    };

    const resp = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey,
        "X-CC-Version": apiVersion,
      },
      body: JSON.stringify(chargeBody),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Coinbase create charge failed:", text);
      return { statusCode: 502, body: JSON.stringify({ message: "Failed to create Coinbase charge" }) };
    }

    const json = await resp.json();
    const charge = json.data;
    const hostedUrl = charge?.hosted_url;

    // Persist session in Supabase if available
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("payments_sessions").insert([
          {
            id: charge?.id,
            provider: "coinbase",
            mode: mode,
            amount: amount,
            currency: "USD",
            metadata: JSON.stringify(metadata),
            status: "created",
            raw: JSON.stringify(charge),
          },
        ]);
      } catch (err) {
        console.warn("Failed to persist Coinbase session in Supabase:", err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ url: hostedUrl }) };
  } catch (error: any) {
    console.error("create-checkout-coinbase error:", error);
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
