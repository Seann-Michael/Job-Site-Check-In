import { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";

// Twilio Configuration
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl?: string;
}

interface SMSRequest {
  to: string;
  message: string;
  campaignId?: string;
  businessId?: string;
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Get Twilio configuration from environment variables
const getTwilioConfig = (): TwilioConfig | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL;

  if (accountSid && authToken && phoneNumber) {
    return {
      accountSid,
      authToken,
      phoneNumber,
      webhookUrl
    };
  }

  return null;
};

// Send SMS via Twilio API
export const handleSendSMS = async (req: Request, res: Response) => {
  try {
    const config = getTwilioConfig();
    
    if (!config) {
      return res.status(500).json({
        success: false,
        error: "Twilio credentials not configured"
      });
    }

    const { to, message, campaignId, businessId }: SMSRequest = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: "Phone number and message are required"
      });
    }

    // Prepare Twilio API request
    const authString = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString('base64');

    const params = new URLSearchParams({
      From: config.phoneNumber,
      To: to,
      Body: message,
      ...(config.webhookUrl && { StatusCallback: config.webhookUrl })
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio API error: ${data.message || response.status}`);
    }

    // Persist SMS log to Supabase
    const db = getSupabaseClient();
    if (db) {
      await db.from("sms_logs").insert({
        twilio_sid: data.sid,
        direction: "outbound",
        to_number: to,
        from_number: config.phoneNumber,
        message,
        status: data.status ?? "sent",
        campaign_id: campaignId ?? null,
        business_id: businessId ?? null,
      }).then(({ error }) => {
        if (error) console.error("[twilio] Failed to log SMS:", error.message);
      });
    }

    res.json({
      success: true,
      messageId: data.sid,
      status: data.status
    });

  } catch (error) {
    console.error("Twilio SMS error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Handle Twilio webhook for message status updates
export const handleTwilioWebhook = async (req: Request, res: Response) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    console.log('Twilio webhook received:', {
      messageId: MessageSid,
      status: MessageStatus,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage
    });

    // Update message status in Supabase
    const db = getSupabaseClient();
    if (db && MessageSid) {
      await db
        .from("sms_logs")
        .update({
          status: MessageStatus ?? "unknown",
          error_code: ErrorCode ?? null,
          error_message: ErrorMessage ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("twilio_sid", MessageSid)
        .then(({ error }) => {
          if (error) console.error("[twilio] Failed to update SMS status:", error.message);
        });
    }

    // Respond to Twilio
    res.status(200).send('OK');

  } catch (error) {
    console.error("Twilio webhook error:", error);
    res.status(500).send('Error processing webhook');
  }
};

// Test Twilio connection
export const handleTwilioTest = async (_req: Request, res: Response) => {
  try {
    const config = getTwilioConfig();
    
    if (!config) {
      return res.status(500).json({
        success: false,
        error: "Twilio credentials not configured"
      });
    }

    // Test by fetching account information
    const authString = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio API error: ${data.message || response.status}`);
    }

    res.json({
      success: true,
      accountInfo: {
        friendlyName: data.friendly_name,
        status: data.status,
        type: data.type
      }
    });

  } catch (error) {
    console.error("Twilio test error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed"
    });
  }
};

// Check if Twilio is configured
export const handleTwilioStatus = async (_req: Request, res: Response) => {
  const config = getTwilioConfig();
  
  res.json({
    success: true,
    configured: !!config,
    hasPhoneNumber: !!(config?.phoneNumber)
  });
};

// Send review request SMS
export const handleSendReviewRequest = async (req: Request, res: Response) => {
  try {
    const { 
      to, 
      businessName, 
      customerName, 
      reviewLink,
      businessId 
    } = req.body;

    if (!to || !businessName || !reviewLink) {
      return res.status(400).json({
        success: false,
        error: "Phone number, business name, and review link are required"
      });
    }

    const message = `Hi ${customerName || 'there'}! Thank you for choosing ${businessName}. We'd love to hear about your experience. Please leave us a review: ${reviewLink}`;

    // Use the existing SMS handler
    req.body = {
      to,
      message,
      businessId,
      campaignId: 'review_request'
    };

    return handleSendSMS(req, res);

  } catch (error) {
    console.error("Review request SMS error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to send review request"
    });
  }
};
