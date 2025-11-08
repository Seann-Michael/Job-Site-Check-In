import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface SMSRequest {
  to: string;
  message?: string;
  template?: 'project-update' | 'system-alert';
  templateData?: Record<string, any>;
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

const SMS_TEMPLATES = {
  'project-update': {
    message: `📊 Project Update

Your project "{{projectName}}" status: {{status}}

{{#if message}}
Message: {{message}}
{{/if}}

View project: {{projectUrl}}

- Local SEO Ranker`,
  },
  'system-alert': {
    message: `🚨 System Alert

Alert: {{alertType}}
Time: {{timestamp}}

{{#if details}}
Details: {{details}}
{{/if}}

Please review your account.

- Local SEO Ranker`,
  },
};

const compileTemplate = (template: string, data: Record<string, any>): string => {
  let compiled = template;
  
  // Simple Handlebars-like template compilation
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    compiled = compiled.replace(regex, String(value));
  });
  
  // Handle each loops (basic implementation)
  const eachRegex = /{{#each (\w+)}}([\s\S]*?){{\/each}}/g;
  compiled = compiled.replace(eachRegex, (match, arrayName, template) => {
    const array = data[arrayName];
    if (Array.isArray(array)) {
      return array.map(item => {
        let itemTemplate = template;
        Object.entries(item).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemTemplate = itemTemplate.replace(regex, String(value));
        });
        return itemTemplate;
      }).join('');
    }
    return '';
  });
  
  // Handle if conditions (basic implementation)
  const ifRegex = /{{#if (\w+)}}([\s\S]*?){{\/if}}/g;
  compiled = compiled.replace(ifRegex, (match, condition, content) => {
    return data[condition] ? content : '';
  });
  
  return compiled;
};

const sendSMS = async (smsData: SMSRequest): Promise<any> => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not set');
  }

  let { message } = smsData;

  // Use template if specified
  if (smsData.template && SMS_TEMPLATES[smsData.template]) {
    const template = SMS_TEMPLATES[smsData.template];
    message = smsData.templateData ? compileTemplate(template.message, smsData.templateData) : template.message;
  }

  if (!message) {
    throw new Error('Message content is required');
  }

  // Validate phone number format
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(smsData.to)) {
    throw new Error('Invalid phone number format. Use E.164 format (e.g., +1234567890)');
  }

  const authString = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  
  const formData = new URLSearchParams();
  formData.append('From', TWILIO_PHONE_NUMBER);
  formData.append('To', smsData.to);
  formData.append('Body', message);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Twilio API error: ${response.status} - ${error.message || 'Unknown error'}`);
  }

  return await response.json();
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const smsData: SMSRequest = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!smsData.to) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: to' }),
      };
    }

    if (!smsData.template && !smsData.message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: message or template' }),
      };
    }

    const result = await sendSMS(smsData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        messageId: result.sid,
        status: result.status,
        message: 'SMS sent successfully',
      }),
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
