import { Handler } from "@netlify/functions";
import { authMiddleware } from "./auth-middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// DataForSEO credentials (these should be set in Netlify environment variables)
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

interface AIRequest {
  message: string;
}

interface DataForSEOResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      se: string;
      language_name: string;
      language_code: string;
      se_domain: string;
    };
    result: Array<{
      input: string;
      output: string;
    }>;
  }>;
}

const handler: Handler = async (event, context) => {
  try {
    const { httpMethod, body } = event;

    // Handle OPTIONS requests (CORS preflight)
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        body: "",
      };
    }

    // Only allow POST requests
    if (httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    // Apply auth middleware
    const authResult = await authMiddleware(event);
    if (authResult.statusCode !== 200) {
      return authResult;
    }

    // Check for DataForSEO credentials
    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "DataForSEO credentials not configured",
        }),
      };
    }

    if (!body) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Request body is required" }),
      };
    }

    try {
      const { message }: AIRequest = JSON.parse(body);

      if (!message || !message.trim()) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Message is required" }),
        };
      }

      const user = JSON.parse(authResult.body).user;

      // Check user's credit balance
      const { data: creditData, error: creditError } = await supabase
        .from("user_credits")
        .select("credits_remaining")
        .eq("user_id", user.id)
        .single();

      if (creditError || !creditData || creditData.credits_remaining <= 0) {
        return {
          statusCode: 402,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "Insufficient credits",
            credits_remaining: creditData?.credits_remaining || 0,
          }),
        };
      }

      // Make request to DataForSEO Chat API
      const dataForSEORequest = {
        data: [
          {
            input: message.trim(),
            max_tokens: 2000,
            temperature: 0.7,
          },
        ],
      };

      const auth = Buffer.from(
        `${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`,
      ).toString("base64");

      const response = await fetch(
        "https://api.dataforseo.com/v3/serp/ai_summary/live",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataForSEORequest),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("DataForSEO API error:", response.status, errorText);
        return {
          statusCode: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "External AI service unavailable",
            details: `API returned ${response.status}`,
          }),
        };
      }

      const dataForSEOResponse: DataForSEOResponse = await response.json();

      if (dataForSEOResponse.status_code !== 20000) {
        console.error(
          "DataForSEO API error:",
          dataForSEOResponse.status_message,
        );
        return {
          statusCode: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "AI service error",
            details: dataForSEOResponse.status_message,
          }),
        };
      }

      // Extract the AI response
      let aiResponse = "Sorry, I could not generate a response at this time.";
      let actualCost = 0;

      if (dataForSEOResponse.tasks && dataForSEOResponse.tasks.length > 0) {
        const task = dataForSEOResponse.tasks[0];
        actualCost = task.cost || 0;

        if (task.result && task.result.length > 0) {
          aiResponse = task.result[0].output || aiResponse;
        }
      }

      // Calculate credits to deduct (markup the cost by 50%)
      const creditsToDeduct = Math.ceil(actualCost * 1.5);

      // Deduct credits from user account
      const { error: deductError } = await supabase
        .from("user_credits")
        .update({
          credits_remaining: creditData.credits_remaining - creditsToDeduct,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (deductError) {
        console.error("Error deducting credits:", deductError);
        // Continue anyway, we don't want to fail the AI response
      }

      // Log the transaction
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        transaction_type: "debit",
        amount: creditsToDeduct,
        description: "AI Agent query",
        metadata: {
          message_length: message.length,
          response_length: aiResponse.length,
          actual_cost: actualCost,
          markup_rate: 1.5,
        },
        created_at: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          response: aiResponse,
          cost: actualCost,
          credits_used: creditsToDeduct,
          credits_remaining: creditData.credits_remaining - creditsToDeduct,
          processing_time: dataForSEOResponse.time || "0",
        }),
      };
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }
  } catch (error) {
    console.error("Unhandled error in AI chat:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred while processing your request",
      }),
    };
  }
};

export { handler };
