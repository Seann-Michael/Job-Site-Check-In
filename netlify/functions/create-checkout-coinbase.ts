import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount) || 0;
    const mode = body.mode || "one_time";

    const coinbaseKey = process.env.COINBASE_COMMERCE_API_KEY;
    if (!coinbaseKey) {
      return {
        statusCode: 501,
        body: JSON.stringify({ message: "Coinbase Commerce not configured. Set COINBASE_COMMERCE_API_KEY in environment." }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: `/mock-checkout?provider=coinbase&mode=${mode}&amount=${amount}` }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ message: error?.message || "Server error" }) };
  }
};
