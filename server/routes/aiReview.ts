import { Request, Response } from "express";
import { AIError, chatCompletion } from "../lib/openai";
import { logger } from "../lib/logger";

interface AIReviewRequest {
  reviewText?: string;
  rating?: number;
  customerName?: string;
  projectName?: string;
  businessName?: string;
  existingResponse?: string;
  keywords?: string[];
}

const str = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;

/**
 * POST /api/ai-review-response  (auth)
 * Generates an SEO-optimised owner response to a customer review.
 * 503 when OPENAI_API_KEY is missing, 502 when the provider fails.
 */
export async function handleAIReviewResponse(req: Request, res: Response) {
  const body = (req.body ?? {}) as AIReviewRequest;
  const reviewText = str(body.reviewText, 4000);
  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
  const customerName = str(body.customerName, 120, "valued customer");
  const projectName = str(body.projectName, 200);
  const businessName = str(body.businessName, 200, "our business");
  const existingResponse = str(body.existingResponse, 2000);
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.filter((k): k is string => typeof k === "string").map((k) => k.slice(0, 60)).slice(0, 10)
    : [];

  try {
    const prompt = buildPrompt({ reviewText, rating, customerName, projectName, businessName, existingResponse, keywords });
    const response = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are an expert at writing professional, SEO-optimized responses to customer reviews for local service businesses. Keep responses genuine, grateful, and concise (2-4 sentences). Include relevant keywords naturally. Return only the response text.",
        },
        { role: "user", content: prompt },
      ],
      { maxTokens: 300, temperature: 0.7 },
    );
    return res.json({ response, seoTips: buildSeoTips(keywords) });
  } catch (err) {
    if (err instanceof AIError) return res.status(err.status).json({ error: err.message });
    logger.error({ err }, "aiReview failed");
    return res.status(502).json({ error: "AI provider error" });
  }
}

function buildPrompt(opts: {
  reviewText: string;
  rating: number;
  customerName: string;
  projectName: string;
  businessName: string;
  existingResponse: string;
  keywords: string[];
}): string {
  const keywordStr = opts.keywords.length > 0 ? `Naturally include some of these keywords: ${opts.keywords.join(", ")}.` : "";
  const projectStr = opts.projectName ? ` for their ${opts.projectName}` : "";
  const existingStr = opts.existingResponse ? `\n\nExisting draft response to improve: "${opts.existingResponse}"` : "";

  return `Write a professional owner response to this ${opts.rating}-star customer review${projectStr} for ${opts.businessName}.

Customer name: ${opts.customerName}
Customer review: "${opts.reviewText || "(no text provided)"}"
${existingStr}

${keywordStr}
Keep the response warm, professional, and 2-4 sentences long.`;
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
