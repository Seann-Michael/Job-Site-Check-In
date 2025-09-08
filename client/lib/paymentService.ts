export interface CheckoutRequest {
  provider: "stripe" | "paypal" | "coinbase";
  mode: "one_time" | "subscription";
  amount: number;
}

export async function createCheckoutSession(body: CheckoutRequest) {
  const provider = body.provider;
  // Netlify functions are exposed under /.netlify/functions/<name>
  const endpoint = `/.netlify/functions/create-checkout-${provider}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    try {
      const err = await res.json();
      return { message: err?.message || "Server error" };
    } catch {
      return { message: "Server error" };
    }
  }

  return res.json();
}
