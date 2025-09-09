import { Handler } from "@netlify/functions";
import { authMiddleware } from "./auth-middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function renderTemplate(content: string, data: Record<string, any>) {
  return content.replace(/\{\{?\s*([^\}\s]+)\s*\}?\}/g, (match, key) => {
    const val = data[key];
    if (val === undefined || val === null) return match;
    return String(val);
  });
}

const handler: Handler = async (event, context) => {
  try {
    const { httpMethod, body, path } = event;

    // List templates
    if (httpMethod === "GET") {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      const { data, error } = await supabase
        .from("page_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching templates:", error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to fetch templates" }) };
      }

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ templates: data }) };
    }

    // Create template
    if (httpMethod === "POST" && path?.endsWith("/preview") === false) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };
      const { template_name, template_content, variables, page_type, metadata } = JSON.parse(body);
      if (!template_name || !template_content) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "template_name and template_content are required" }) };

      const { data, error } = await supabase
        .from("page_templates")
        .insert({ user_id: user.id, template_name, template_content, variables: variables || [], page_type: page_type || 'custom', metadata: metadata || {}, created_at: new Date().toISOString() })
        .select()
        .single();

      if (error) {
        console.error("Error creating template:", error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to create template" }) };
      }

      return { statusCode: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, template: data }) };
    }

    // Update template
    if (httpMethod === "PUT") {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;
      if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };

      const payload = JSON.parse(body);
      const { id, template_name, template_content, variables, page_type, metadata } = payload;
      if (!id) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "template id is required" }) };

      // Ensure ownership
      const { data: existing, error: fetchError } = await supabase.from("page_templates").select("user_id").eq("id", id).single();
      if (fetchError || !existing) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Template not found" }) };
      if (existing.user_id !== user.id) return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Not authorized to update this template" }) };

      const { data, error } = await supabase.from("page_templates").update({ template_name, template_content, variables, page_type, metadata, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) {
        console.error("Error updating template:", error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to update template" }) };
      }

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, template: data }) };
    }

    // Delete template
    if (httpMethod === "DELETE") {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;
      const user = JSON.parse(authResult.body).user;

      const parts = path?.split("/") || [];
      const id = parts[parts.length - 1];
      if (!id) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Template id is required" }) };

      const { data: existing, error: fetchError } = await supabase.from("page_templates").select("user_id").eq("id", id).single();
      if (fetchError || !existing) return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Template not found" }) };
      if (existing.user_id !== user.id) return { statusCode: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Not authorized to delete this template" }) };

      const { error } = await supabase.from("page_templates").delete().eq("id", id);
      if (error) {
        console.error("Error deleting template:", error);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to delete template" }) };
      }

      return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
    }

    // Preview template - replace variables using provided sample data
    if (httpMethod === "POST" && path?.endsWith("/preview")) {
      const authResult = await authMiddleware(event as any);
      if (authResult.statusCode !== 200) return authResult;

      if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Request body is required" }) };

      const { template_content, sample_data } = JSON.parse(body);
      if (!template_content) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "template_content is required" }) };

      try {
        const preview = renderTemplate(template_content, sample_data || {});
        return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ preview }) };
      } catch (err) {
        console.error("Error rendering template preview:", err);
        return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Failed to render preview" }) };
      }
    }

    // CORS preflight
    if (httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" }, body: "" };
    }

    return { statusCode: 405, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error) {
    console.error("Unhandled error in page-templates:", error);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal server error" }) };
  }
};

export { handler };
