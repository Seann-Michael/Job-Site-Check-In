import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount) || 0;
    const mode = body.mode || "one_time";

    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    if (!paypalClientId) {
      return {
        statusCode: 501,
        body: JSON.stringify({ message: "PayPal not configured. Set PAYPAL_CLIENT_ID in environment." }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: `/mock-checkout?provider=paypal&mode=${mode}&amount=${amount}` }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
