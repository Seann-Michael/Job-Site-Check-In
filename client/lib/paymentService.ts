export interface CheckoutRequest {
  provider: "stripe" | "paypal";
  mode: "one_time" | "subscription";
  amount: number;
  /** Plan label recorded on the business once the payment is confirmed. */
  planName?: string;
  /** Business the purchase is for — without it the plan can't be recorded. */
  businessId?: string;
  email?: string;
}

export async function createCheckoutSession(body: CheckoutRequest) {
  const provider = body.provider;
  // API endpoints are exposed under /api/<name>
  const endpoint = `/api/create-checkout-${provider}`;

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
