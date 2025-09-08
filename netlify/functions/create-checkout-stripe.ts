import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount) || 0;
    const mode = body.mode || "one_time";

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      // Keys not configured yet - return mock URL for scaffolding
      return {
        statusCode: 501,
        body: JSON.stringify({ message: "Stripe not configured. Set STRIPE_SECRET_KEY in environment." }),
      };
    }

    // Real implementation would create a Stripe Checkout session here.
    // For now return a placeholder response to be used until keys are available.
    return {
      statusCode: 200,
      body: JSON.stringify({ url: `/mock-checkout?provider=stripe&mode=${mode}&amount=${amount}` }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
