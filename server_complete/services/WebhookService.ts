import { supabase } from "../supabaseClient";

/**
 * WebhookService manages incoming and outgoing webhooks. The register
 * method validates that a given URL is reachable and stores the webhook
 * configuration. For outgoing events you would call deliverWebhook()
 * when certain actions occur. This implementation performs a basic
 * HEAD request to validate URLs and records the webhook configuration.
 */
import crypto from "crypto";

export class WebhookService {
  /**
   * Register a new webhook for a business. Performs a HEAD request to
   * ensure the endpoint is reachable before saving it.
   */
  static async register(webhookData: {
    businessId: string;
    url: string;
    events: string[];
  }) {
    const { businessId, url, events } = webhookData;
    // Validate URL reachability
    let reachable = false;
    try {
      const res = await fetch(url, { method: "HEAD" });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      throw new Error("Webhook URL is not reachable");
    }
    // Generate a secret for HMAC signature verification
    const secret = crypto.randomUUID();
    // Store in database
    const { data, error } = await supabase
      .from("webhooks")
      .insert({ business_id: businessId, url, events, secret, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Deliver a webhook payload to a registered endpoint. Not implemented.
   */
  static async deliver(_webhookId: string, _event: string, _payload: any) {
    // TODO: fetch webhook by id, generate signature with secret, POST payload
    return { success: true };
  }
}