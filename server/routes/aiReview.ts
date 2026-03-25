import { Request, Response } from "express";

interface AIReviewRequest {
  reviewText?: string;
  rating?: number;
  customerName?: string;
  projectName?: string;
  businessName?: string;
  existingResponse?: string;
  keywords?: string[];
}

/**
 * POST /api/ai-review-response
 * Generates an SEO-optimised review response using OpenAI if configured,
 * or falls back to a well-crafted template response.
 */
export async function handleAIReviewResponse(req: Request, res: Response) {
  const {
    reviewText = "",
    rating = 5,
    customerName = "valued customer",
    projectName = "",
    businessName = "our business",
    existingResponse = "",
    keywords = [],
  } = req.body as AIReviewRequest;

  const openAiKey = process.env.OPENAI_API_KEY;

  if (openAiKey) {
    try {
      const prompt = buildPrompt({
        reviewText,
        rating,
        customerName,
        projectName,
        businessName,
        existingResponse,
        keywords,
      });

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert at writing professional, SEO-optimized responses to customer reviews for local service businesses. Keep responses genuine, grateful, and concise (2-4 sentences). Include relevant keywords naturally.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        throw new Error(`OpenAI API error: ${openaiRes.status} ${errText}`);
      }

      const data = (await openaiRes.json()) as any;
      const aiResponse: string = data.choices?.[0]?.message?.content?.trim() ?? "";

      if (!aiResponse) throw new Error("Empty response from OpenAI");

      const seoTips = buildSeoTips(keywords);
      return res.json({ response: aiResponse, seoTips });
    } catch (err: any) {
      console.error("[aiReview] OpenAI call failed, falling back to template:", err.message);
      // Fall through to template response
    }
  }

  // ── Template fallback (no OpenAI key or call failed) ─────────────────────
  const templateResponse = buildTemplateResponse({
    reviewText,
    rating,
    customerName,
    projectName,
    businessName,
    keywords,
  });

  const seoTips = buildSeoTips(keywords);
  return res.json({ response: templateResponse, seoTips });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildPrompt(opts: {
  reviewText: string;
  rating: number;
  customerName: string;
  projectName: string;
  businessName: string;
  existingResponse: string;
  keywords: string[];
}): string {
  const keywordStr =
    opts.keywords.length > 0 ? `Naturally include some of these keywords: ${opts.keywords.join(", ")}.` : "";
  const projectStr = opts.projectName ? ` for their ${opts.projectName}` : "";
  const existingStr = opts.existingResponse
    ? `\n\nExisting draft response to improve: "${opts.existingResponse}"`
    : "";

  return `Write a professional owner response to this ${opts.rating}-star customer review${projectStr} for ${opts.businessName}.

Customer name: ${opts.customerName}
Customer review: "${opts.reviewText || "(no text provided)"}"
${existingStr}

${keywordStr}
Keep the response warm, professional, and 2-4 sentences long.`;
}

function buildTemplateResponse(opts: {
  reviewText: string;
  rating: number;
  customerName: string;
  projectName: string;
  businessName: string;
  keywords: string[];
}): string {
  const { customerName, projectName, businessName, rating, keywords } = opts;
  const name = customerName || "valued customer";
  const project = projectName ? ` on your ${projectName}` : "";
  const keywordPhrase =
    keywords.length > 0 ? ` Our team takes pride in delivering top-quality ${keywords[0]}.` : "";

  if (rating >= 4) {
    return `Thank you so much, ${name}, for your wonderful review! We truly enjoyed working with you${project} and are thrilled to hear you had such a positive experience with ${businessName}.${keywordPhrase} We look forward to serving you again in the future!`;
  } else if (rating === 3) {
    return `Thank you for taking the time to share your feedback, ${name}. We're glad parts of your experience with ${businessName}${project} met your expectations, and we genuinely appreciate knowing where we can improve.${keywordPhrase} Please reach out to us directly so we can make things right.`;
  } else {
    return `Thank you for your feedback, ${name}. We're sorry to hear that your experience with ${businessName}${project} did not meet your expectations. This is not the standard we hold ourselves to, and we'd very much like the opportunity to address your concerns — please contact us directly so we can make it right.`;
  }
}

function buildSeoTips(keywords: string[]): string[] {
  const tips: string[] = [
    "Responding to reviews within 24 hours signals active engagement to Google.",
    "Mentioning your business name and service type in responses helps local SEO.",
  ];
  if (keywords.length > 0) {
    tips.push(`Including keywords like "${keywords[0]}" in your response can boost relevance for local searches.`);
  }
  return tips;
}
