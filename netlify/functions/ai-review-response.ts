const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const {
      reviewText,
      rating,
      customerName,
      projectName,
      businessName,
      existingResponse,
      keywords,
    } = JSON.parse(event.body || '{}');

    if (!OPENAI_API_KEY) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          response: generateFallbackResponse({
            reviewText,
            rating,
            customerName,
            projectName,
            businessName,
            keywords,
          }),
          seoTips: generateFallbackSeoTips(keywords),
        }),
      };
    }

    const keywordList = Array.isArray(keywords) && keywords.length > 0
      ? keywords.join(', ')
      : 'quality service, professional work, customer satisfaction';

    const prompt = `You are an expert local SEO consultant helping a business owner write a response to a Google review.

Business: ${businessName || 'our business'}
Customer: ${customerName}
Project: ${projectName}
Star Rating: ${rating}/5
Review Text: "${reviewText || '(No written review)'}"
${existingResponse ? `Existing draft response: "${existingResponse}"` : ''}
Target SEO Keywords: ${keywordList}

Write a professional, authentic owner response (150–250 words) that:
1. Naturally incorporates 2–3 of the target keywords without sounding spammy
2. Thanks the customer by first name
3. Mentions the specific service/project
4. Addresses any concerns (if rating < 4) or reinforces positives
5. Includes a subtle call-to-action (e.g. refer a friend, leave another review)
6. Ends with the business name for local SEO signal

Only return the response text itself, no explanations or labels.`;

    const openaiRes = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert local SEO consultant who writes Google review responses for small businesses. Keep responses natural, warm, and keyword-rich without being spammy.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.72,
      }),
    });

    if (!openaiRes.ok) {
      throw new Error(`OpenAI error: ${openaiRes.status}`);
    }

    const data = await openaiRes.json();
    const responseText = data.choices[0].message.content.trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: responseText,
        seoTips: generateFallbackSeoTips(keywords),
      }),
    };
  } catch (err: any) {
    console.error('ai-review-response error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Failed to generate response' }),
    };
  }
};

// ── Fallback helpers (no API key) ─────────────────────────────────────────────

function generateFallbackResponse({
  reviewText,
  rating,
  customerName,
  projectName,
  businessName,
  keywords,
}: any): string {
  const name = customerName?.split(' ')[0] ?? 'there';
  const biz = businessName ?? 'our team';
  const project = projectName ?? 'your project';
  const kw = Array.isArray(keywords) && keywords.length > 0 ? keywords[0] : 'quality service';

  if (rating >= 4) {
    return `Thank you so much, ${name}! We truly appreciate you taking the time to share your experience with ${biz}. It was a pleasure working on ${project} for you, and we're thrilled to hear it met your expectations. Delivering ${kw} to every customer is what drives us every day. We hope to work with you again in the future — and please don't hesitate to refer us to friends or family! — ${biz}`;
  }

  return `Thank you for your honest feedback, ${name}. We're sorry to hear that your experience with ${project} didn't fully meet your expectations. At ${biz}, ${kw} and customer satisfaction are our top priorities, and we take every comment seriously. We'd love the opportunity to make things right — please reach out to us directly so we can address your concerns. — ${biz}`;
}

function generateFallbackSeoTips(keywords: string[]): string[] {
  return [
    'Include your city/neighborhood name naturally in the response',
    `Mention your service type (e.g. "${keywords?.[0] ?? 'roofing, plumbing, HVAC'}")`,
    'Keep the response 150–250 words for optimal Google indexing',
    'Use the customer\'s first name to show authenticity',
    'Sign off with your business name for local SEO signal',
  ];
}
