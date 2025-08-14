import { supabase } from "../supabaseClient";

/**
 * CommunicationService handles sending SMS and email messages. It uses
 * Twilio for SMS and SendGrid for email. The environment variables
 * TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and
 * SENDGRID_API_KEY must be set for the respective services to work.
 * For demonstration purposes these methods simply return mocked
 * responses and record the communication in the `communications`
 * table if available.
 */
export class CommunicationService {
  /**
   * Send an SMS message. In production this would call Twilio's API. Here
   * we mock the behavior and store the communication in Supabase.
   */
  static async sendSMS(data: {
    to: string;
    message: string;
    businessId?: string;
    campaignId?: string;
  }) {
    const { to, message, businessId, campaignId } = data;
    // Mock sending SMS
    const messageId = `sms_${Date.now()}`;
    // Store communication record
    await supabase.from("communications").insert({
      type: "sms",
      recipient: to,
      content: message,
      status: "sent",
      business_id: businessId,
      campaign_id: campaignId,
      external_id: messageId,
    });
    return { success: true, messageId };
  }

  /**
   * Send an email. In production this would call SendGrid's API. Here
   * we mock the behavior and record the email in Supabase.
   */
  static async sendEmail(data: {
    to: string;
    subject: string;
    htmlContent?: string;
    textContent?: string;
    businessId?: string;
    campaignId?: string;
  }) {
    const { to, subject, htmlContent, textContent, businessId, campaignId } = data;
    const messageId = `email_${Date.now()}`;
    await supabase.from("communications").insert({
      type: "email",
      recipient: to,
      subject,
      content: htmlContent || textContent,
      status: "sent",
      business_id: businessId,
      campaign_id: campaignId,
      external_id: messageId,
    });
    return { success: true, messageId };
  }
}