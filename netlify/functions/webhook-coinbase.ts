import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const webhookSecret = process.env.COINBASE_COMMERCE_SHARED_SECRET;
    if (!webhookSecret) {
      return { statusCode: 501, body: JSON.stringify({ message: "Coinbase Commerce webhook not configured." }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Webhook received (scaffold)" }) };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
