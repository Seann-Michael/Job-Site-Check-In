import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      return { statusCode: 501, body: JSON.stringify({ message: "PayPal webhook not configured." }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Webhook received (scaffold)" }) };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
