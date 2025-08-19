import { Handler } from "@netlify/functions";
import { authMiddleware } from "./auth-middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        },
        body: "",
      };
    }

    // Handle GET requests - fetch all custom platforms for authenticated user
    if (httpMethod === "GET") {
      // Apply auth middleware
      const authResult = await authMiddleware(event);
      if (authResult.statusCode !== 200) {
        return authResult;
      }

      try {
        const user = JSON.parse(authResult.body).user;

        const { data: customPlatforms, error } = await supabase
          .from("custom_platforms")
          .select("*")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching custom platforms:", error);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Failed to fetch custom platforms" }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            success: true,
            data: customPlatforms || [],
          }),
        };
      } catch (error) {
        console.error("Error processing GET request:", error);
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Internal server error" }),
        };
      }
    }

    // Handle POST requests - create new custom platform
    if (httpMethod === "POST") {
      // Apply auth middleware
      const authResult = await authMiddleware(event);
      if (authResult.statusCode !== 200) {
        return authResult;
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
        const user = JSON.parse(authResult.body).user;
        const platformData = JSON.parse(body);

        // Validate required fields
        if (!platformData.name || !platformData.fields) {
          return {
            statusCode: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Name and fields are required" }),
          };
        }

        const { data, error } = await supabase
          .from("custom_platforms")
          .insert({
            ...platformData,
            created_by: user.id,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating custom platform:", error);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Failed to create custom platform" }),
          };
        }

        return {
          statusCode: 201,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            success: true,
            data,
          }),
        };
      } catch (error) {
        console.error("Error processing POST request:", error);
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Internal server error" }),
        };
      }
    }

    // Handle PUT requests - update custom platform
    if (httpMethod === "PUT") {
      // Apply auth middleware
      const authResult = await authMiddleware(event);
      if (authResult.statusCode !== 200) {
        return authResult;
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
        const user = JSON.parse(authResult.body).user;
        const platformData = JSON.parse(body);

        if (!platformData.id) {
          return {
            statusCode: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Platform ID is required" }),
          };
        }

        const { data, error } = await supabase
          .from("custom_platforms")
          .update({
            ...platformData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", platformData.id)
          .eq("created_by", user.id) // Ensure user can only update their own platforms
          .select()
          .single();

        if (error) {
          console.error("Error updating custom platform:", error);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Failed to update custom platform" }),
          };
        }

        if (!data) {
          return {
            statusCode: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              error: "Platform not found or access denied",
            }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            success: true,
            data,
          }),
        };
      } catch (error) {
        console.error("Error processing PUT request:", error);
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Internal server error" }),
        };
      }
    }

    // Handle DELETE requests - delete custom platform
    if (httpMethod === "DELETE") {
      // Apply auth middleware
      const authResult = await authMiddleware(event);
      if (authResult.statusCode !== 200) {
        return authResult;
      }

      const platformId = event.queryStringParameters?.id;
      if (!platformId) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Platform ID is required" }),
        };
      }

      try {
        const user = JSON.parse(authResult.body).user;

        const { error } = await supabase
          .from("custom_platforms")
          .delete()
          .eq("id", platformId)
          .eq("created_by", user.id); // Ensure user can only delete their own platforms

        if (error) {
          console.error("Error deleting custom platform:", error);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Failed to delete custom platform" }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            success: true,
            message: "Platform deleted successfully",
          }),
        };
      } catch (error) {
        console.error("Error processing DELETE request:", error);
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Internal server error" }),
        };
      }
    }

    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Unhandled error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export { handler };
