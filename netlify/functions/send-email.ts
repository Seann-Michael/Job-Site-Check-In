import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: 'geo-grid-share' | 'project-notification' | 'system-alert';
  templateData?: Record<string, any>;
}

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mg.yourdomain.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

const EMAIL_TEMPLATES = {
  'geo-grid-share': {
    subject: 'Geo Grid Ranking Results Shared',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Geo Grid Ranking Results</h2>
        <p>Hello,</p>
        <p>{{userName}} has shared geo grid ranking results with you:</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Results Summary</h3>
          <ul>
            {{#each results}}
            <li><strong>{{businessName}}</strong> - {{keyword}} (Avg Ranking: #{{averageRanking}})</li>
            {{/each}}
          </ul>
        </div>
        
        <p>
          <a href="{{publicUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Full Results
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This email was sent from Local SEO Ranker. If you have any questions, please contact support.
        </p>
      </div>
    `,
  },
  'project-notification': {
    subject: 'Project Update - {{projectName}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Project Update</h2>
        <p>Hello,</p>
        <p>Your project <strong>{{projectName}}</strong> has been updated:</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Status:</strong> {{status}}</p>
          <p><strong>Updated:</strong> {{updatedAt}}</p>
          {{#if message}}
          <p><strong>Message:</strong> {{message}}</p>
          {{/if}}
        </div>
        
        <p>
          <a href="{{projectUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Project
          </a>
        </p>
      </div>
    `,
  },
  'system-alert': {
    subject: 'System Alert - {{alertType}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">System Alert</h2>
        <p>A system alert has been triggered:</p>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Alert Type:</strong> {{alertType}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
          <p><strong>Details:</strong> {{details}}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated system alert. Please review and take appropriate action if necessary.
        </p>
      </div>
    `,
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

const sendEmail = async (emailData: EmailRequest): Promise<any> => {
  if (!MAILGUN_API_KEY) {
    throw new Error('MAILGUN_API_KEY environment variable is not set');
  }

  let { subject, html, text } = emailData;

  // Use template if specified
  if (emailData.template && EMAIL_TEMPLATES[emailData.template]) {
    const template = EMAIL_TEMPLATES[emailData.template];
    subject = emailData.templateData ? compileTemplate(template.subject, emailData.templateData) : template.subject;
    html = emailData.templateData ? compileTemplate(template.html, emailData.templateData) : template.html;
  }

  const formData = new FormData();
  formData.append('from', FROM_EMAIL);
  formData.append('to', emailData.to);
  formData.append('subject', subject);
  
  if (html) {
    formData.append('html', html);
  }
  
  if (text) {
    formData.append('text', text);
  }

  const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mailgun API error: ${response.status} - ${error}`);
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
    const emailData: EmailRequest = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!emailData.to) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: to' }),
      };
    }

    if (!emailData.template && !emailData.subject) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: subject or template' }),
      };
    }

    if (!emailData.template && !emailData.html && !emailData.text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: html, text, or template' }),
      };
    }

    const result = await sendEmail(emailData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        messageId: result.id,
        message: 'Email sent successfully',
      }),
    };
  } catch (error) {
    console.error('Email sending error:', error);
    
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
