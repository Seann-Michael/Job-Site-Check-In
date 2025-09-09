import { Handler } from "@netlify/functions";
import { authMiddleware } from "./auth-middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: Handler = async (event, context) => {
  try {
    const { httpMethod, body, path } = event;

    // List connected sites for authenticated user
    if (httpMethod === "GET") {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      const { data, error } = await supabase
        .from("wordpress_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching wordpress connections:", error);
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Failed to fetch wordpress connections" }),
        };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ sites: data }),
      };
    }

    // Create a new connection
    if (httpMethod === "POST" && path?.endsWith("/connect")) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      if (!body) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };
      }

      const { site_url, site_name, api_key, metadata } = JSON.parse(body);

      if (!site_url) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "site_url is required" }) };
      }

      const { data, error } = await supabase
        .from("wordpress_connections")
        .insert({ user_id: user.id, site_url, site_name, api_key, metadata, created_at: new Date().toISOString() })
        .select()
        .single();

      if (error) {
        console.error("Error creating wordpress connection:", error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to create wordpress connection" }) };
      }

      return { statusCode: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, site: data }) };
    }

    // Test connection - validate reachability and optionally credentials
    if (httpMethod === "POST" && path?.endsWith("/test")) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;

      if (!body) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };
      }

      const { site_url, api_key } = JSON.parse(body);
      if (!site_url) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "site_url is required" }) };
      }

      try {
        const endpointsToTry = ["/wp-json/wp/v2/pages?per_page=1", "/wp-json/"].map((p) => site_url.replace(/\/$/, "") + p);

        let lastError: any = null;
        for (const url of endpointsToTry) {
          try {
            const headers: any = { "Content-Type": "application/json" };
            if (api_key) {
              // Try to guess auth method: if api_key contains ':' treat as basic (username:password)
              if (api_key.includes(":")) {
                const encoded = Buffer.from(api_key).toString("base64");
                headers["Authorization"] = `Basic ${encoded}`;
              } else {
                headers["Authorization"] = `Bearer ${api_key}`;
              }
            }

            const res = await fetch(url, { method: "GET", headers });
            const text = await res.text();
            if (res.ok) {
              return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, url, status: res.status, body: text.slice(0, 2000) }) };
            }

            lastError = { url, status: res.status, body: text };
          } catch (err) {
            lastError = err;
          }
        }

        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: false, error: "Failed to connect to WordPress site", details: lastError }) };
      } catch (err) {
        console.error("Error testing wordpress connection:", err);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to test connection" }) };
      }
    }

    // Delete a connection
    if (httpMethod === "DELETE") {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      const parts = path?.split("/") || [];
      const id = parts[parts.length - 1];
      if (!id) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Site id is required" }) };
      }

      // Ensure ownership
      const { data: existing, error: fetchError } = await supabase
        .from("wordpress_connections")
        .select("user_id")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Site not found" }) };
      }

      if (existing.user_id !== user.id) {
        return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Not authorized to delete this site" }) };
      }

      const { error } = await supabase.from("wordpress_connections").delete().eq("id", id);
      if (error) {
        console.error("Error deleting wordpress connection:", error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to delete site" }) };
      }

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
    }

    // CORS preflight
    if (httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" }, body: "" };
    }

    return { statusCode: 405, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error) {
    console.error("Unhandled error in wordpress-connections:", error);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal server error" }) };
  }
};

export { handler };
