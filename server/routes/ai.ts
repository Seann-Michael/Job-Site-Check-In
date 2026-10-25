import { Router, Request, Response } from "express";
import { AIError, chatCompletion, parseJsonResponse } from "../lib/openai";
import { assertSafeUrl, SafeFetchError } from "../lib/safeFetch";
import { logger } from "../lib/logger";

/**
 * AI helper endpoints. All require auth (mounted behind requireAuth in
 * index.ts), accept JSON bodies up to 8mb (route-scoped parser in index.ts;
 * the global limit stays 1mb) and all return:
 *   503 { error: "AI not configured" }   when OPENAI_API_KEY is missing
 *   502 { error }                        when OpenAI fails
 *   400 { error }                        on invalid input
 */
export const aiRouter = Router();

const log = logger.child({ module: "ai" });

const LIMITS = {
  text: 6000,
  short: 300,
  list: 20,
  imageBase64Bytes: 6 * 1024 * 1024,
};

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function strList(v: unknown, max = LIMITS.list, each = LIMITS.short): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, each)).slice(0, max);
}
function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function handleError(req: Request, res: Response, err: unknown, what: string) {
  if (err instanceof AIError) return res.status(err.status).json({ error: err.message });
  (req.log ?? log).child({ module: "ai" }).error({ err }, `${what} failed`);
  return res.status(502).json({ error: "AI provider error" });
}

function businessContext(b: { businessName?: string; city?: string; industry?: string; tone?: string }): string {
  const parts = [
    b.businessName && `Business: ${b.businessName}`,
    b.industry && `Industry: ${b.industry}`,
    b.city && `Service area: ${b.city}`,
    b.tone && `Tone: ${b.tone}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") + "\n" : "";
}

// POST /api/ai/enhance-description
// { description, businessName?, city?, industry?, keywords?, tone?, maxWords? }
// -> { description: string }
aiRouter.post("/enhance-description", async (req: Request, res: Response) => {
  const description = str(req.body?.description, LIMITS.text);
  if (!description) return res.status(400).json({ error: "description is required" });
  const ctx = {
    businessName: str(req.body?.businessName, LIMITS.short),
    city: str(req.body?.city, LIMITS.short),
    industry: str(req.body?.industry, LIMITS.short),
    tone: str(req.body?.tone, 60),
  };
  const keywords = strList(req.body?.keywords);
  const maxWords = clampInt(req.body?.maxWords, 30, 400, 150);

  try {
    const out = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a local SEO copywriter. Rewrite business/job descriptions so they are clear, specific, customer-focused and naturally include local keywords. Never invent facts, prices, certifications or guarantees. Return only the improved description text, no preamble.",
        },
        {
          role: "user",
          content: `${businessContext(ctx)}${keywords.length ? `Keywords to include naturally: ${keywords.join(", ")}\n` : ""}Target length: about ${maxWords} words.\n\nOriginal description:\n"""\n${description}\n"""`,
        },
      ],
      { maxTokens: Math.min(1200, maxWords * 3), temperature: 0.6 },
    );
    res.json({ description: out });
  } catch (err) {
    handleError(req, res, err, "enhance-description");
  }
});

// POST /api/ai/generate-keywords
// { businessName?, industry?, services?, city?, description?, count? }
// -> { keywords: string[] }
aiRouter.post("/generate-keywords", async (req: Request, res: Response) => {
  const ctx = {
    businessName: str(req.body?.businessName, LIMITS.short),
    industry: str(req.body?.industry, LIMITS.short),
    city: str(req.body?.city, LIMITS.short),
  };
  const services = strList(req.body?.services);
  const description = str(req.body?.description, LIMITS.text);
  const count = clampInt(req.body?.count, 3, 40, 15);
  if (!ctx.industry && !services.length && !description && !ctx.businessName) {
    return res.status(400).json({ error: "Provide at least one of industry, services, description or businessName" });
  }

  try {
    const out = await chatCompletion(
      [
        {
          role: "system",
          content:
            'You are a local SEO strategist. Produce realistic search keywords a customer would type into Google, mixing service + location ("roof repair in Austin"), near-me and long-tail variants. Respond with JSON: {"keywords": string[]} and nothing else.',
        },
        {
          role: "user",
          content: `${businessContext(ctx)}${services.length ? `Services: ${services.join(", ")}\n` : ""}${description ? `Description: ${description}\n` : ""}Return exactly ${count} unique keywords, lowercase, no numbering.`,
        },
      ],
      { maxTokens: 800, temperature: 0.5, json: true },
    );
    const parsed = parseJsonResponse<{ keywords?: unknown }>(out);
    const keywords = strList(parsed.keywords, count, 120);
    res.json({ keywords });
  } catch (err) {
    handleError(req, res, err, "generate-keywords");
  }
});

// POST /api/ai/alt-text
// { imageUrl? | imageBase64? (data URL or raw base64), mimeType?, context?, businessName?, city?, keywords? }
// -> { altText: string, caption: string }
aiRouter.post("/alt-text", async (req: Request, res: Response) => {
  const imageUrl = str(req.body?.imageUrl, 2048);
  let imageBase64 = str(req.body?.imageBase64, LIMITS.imageBase64Bytes * 2);
  const mimeType = str(req.body?.mimeType, 60) || "image/jpeg";
  const context = str(req.body?.context, 1000);
  const ctx = {
    businessName: str(req.body?.businessName, LIMITS.short),
    city: str(req.body?.city, LIMITS.short),
  };
  const keywords = strList(req.body?.keywords, 10);

  let imageRef: string;
  if (imageBase64) {
    if (!imageBase64.startsWith("data:")) {
      if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(mimeType)) {
        return res.status(400).json({ error: "Unsupported mimeType" });
      }
      imageBase64 = `data:${mimeType};base64,${imageBase64}`;
    } else if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(imageBase64)) {
      return res.status(400).json({ error: "imageBase64 must be a PNG, JPEG, WEBP or GIF data URL" });
    }
    if (imageBase64.length > LIMITS.imageBase64Bytes * 1.4) {
      return res.status(400).json({ error: "Image too large (max ~6MB)" });
    }
    imageRef = imageBase64;
  } else if (imageUrl) {
    try {
      imageRef = (await assertSafeUrl(imageUrl)).href;
    } catch (e) {
      return res.status(400).json({ error: e instanceof SafeFetchError ? e.message : "Invalid imageUrl" });
    }
  } else {
    return res.status(400).json({ error: "imageUrl or imageBase64 is required" });
  }

  try {
    const out = await chatCompletion(
      [
        {
          role: "system",
          content:
            'You write accessible, SEO-friendly image alt text for local service business websites and Google Business Profile photos. Describe only what is visible. Alt text: one sentence, under 125 characters, no "image of". Caption: one friendly sentence suitable for a photo caption. Respond with JSON {"altText": string, "caption": string} only.',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${businessContext(ctx)}${keywords.length ? `Keywords (use only if accurate to the image): ${keywords.join(", ")}\n` : ""}${context ? `Context: ${context}\n` : ""}Describe this image.`,
            },
            { type: "image_url", image_url: { url: imageRef, detail: "low" } },
          ],
        },
      ],
      { maxTokens: 300, temperature: 0.4, json: true, model: process.env.OPENAI_VISION_MODEL || undefined },
    );
    const parsed = parseJsonResponse<{ altText?: unknown; caption?: unknown }>(out);
    res.json({
      altText: str(parsed.altText, 250),
      caption: str(parsed.caption, 500),
    });
  } catch (err) {
    handleError(req, res, err, "alt-text");
  }
});

// POST /api/ai/service-description
// { serviceName, businessName?, city?, industry?, keywords?, tone?, maxWords? }
// -> { description: string }
aiRouter.post("/service-description", async (req: Request, res: Response) => {
  const serviceName = str(req.body?.serviceName, LIMITS.short);
  if (!serviceName) return res.status(400).json({ error: "serviceName is required" });
  const ctx = {
    businessName: str(req.body?.businessName, LIMITS.short),
    city: str(req.body?.city, LIMITS.short),
    industry: str(req.body?.industry, LIMITS.short),
    tone: str(req.body?.tone, 60),
  };
  const keywords = strList(req.body?.keywords);
  const details = str(req.body?.details, 2000);
  const maxWords = clampInt(req.body?.maxWords, 30, 300, 80);

  try {
    const out = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You write concise service descriptions for local business listings (Google Business Profile services, website service cards). Customer-focused, specific, naturally includes the service and location, no fluff, no invented claims. Return only the description text.",
        },
        {
          role: "user",
          content: `${businessContext(ctx)}Service: ${serviceName}\n${details ? `Details: ${details}\n` : ""}${keywords.length ? `Keywords: ${keywords.join(", ")}\n` : ""}Length: about ${maxWords} words.`,
        },
      ],
      { maxTokens: Math.min(900, maxWords * 3), temperature: 0.6 },
    );
    res.json({ description: out });
  } catch (err) {
    handleError(req, res, err, "service-description");
  }
});

// POST /api/ai/rewrite
// { text, instruction?, tone?, maxWords? }
// -> { text: string }
aiRouter.post("/rewrite", async (req: Request, res: Response) => {
  const text = str(req.body?.text, LIMITS.text);
  if (!text) return res.status(400).json({ error: "text is required" });
  const instruction = str(req.body?.instruction, 500);
  const tone = str(req.body?.tone, 60);
  const maxWords = clampInt(req.body?.maxWords, 10, 600, 0);

  try {
    const out = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are an editor for a local service business. Rewrite the user's text as instructed while preserving its meaning and facts. Do not add claims that are not in the original. Return only the rewritten text.",
        },
        {
          role: "user",
          content: `${instruction ? `Instruction: ${instruction}\n` : "Instruction: improve clarity and flow.\n"}${tone ? `Tone: ${tone}\n` : ""}${maxWords ? `Max length: ${maxWords} words\n` : ""}\nText:\n"""\n${text}\n"""`,
        },
      ],
      { maxTokens: 1500, temperature: 0.5 },
    );
    res.json({ text: out });
  } catch (err) {
    handleError(req, res, err, "rewrite");
  }
});

// POST /api/ai/caption
// One post written once, fitted to each destination. Facts only — nothing the
// job didn't record goes in. Settings come from businesses.share_settings.caption
// unless the caller overrides them.
// {
//   businessName, service, stage ("before"|"progress"|"after"|"final"), city, state,
//   keywords?: string[], onSiteMinutes?, checklistDone?, checklistTotal?,
//   photoCounts?: {before,progress,after,final}, materials?: string[], note?,
//   tone?: "plain"|"friendly"|"professional", alwaysMention?, neverSay?: string[], hashtags?: boolean
// }
// -> { title, gbp, facebook, instagram, website, hashtags: string[] }
aiRouter.post("/caption", async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const businessName = str(b.businessName, 120);
  const service = str(b.service, 120);
  const city = str(b.city, 80);
  const state = str(b.state, 40);
  if (!businessName || !service) return res.status(400).json({ error: "businessName and service are required" });
  const stage = ["before", "progress", "after", "final"].includes(b.stage) ? b.stage : "progress";
  const tone = ["plain", "friendly", "professional"].includes(b.tone) ? b.tone : "plain";
  const keywords = Array.isArray(b.keywords) ? b.keywords.filter((k: any) => typeof k === "string").slice(0, 8) : [];
  const materials = Array.isArray(b.materials) ? b.materials.filter((k: any) => typeof k === "string").slice(0, 8) : [];
  const neverSay = Array.isArray(b.neverSay) ? b.neverSay.filter((k: any) => typeof k === "string").slice(0, 20) : [];
  const alwaysMention = str(b.alwaysMention, 200);
  const note = str(b.note, 600);
  const onSite = clampInt(b.onSiteMinutes, 0, 24 * 60, 0);
  const done = clampInt(b.checklistDone, 0, 500, 0);
  const total = clampInt(b.checklistTotal, 0, 500, 0);
  const pc = b.photoCounts && typeof b.photoCounts === "object" ? b.photoCounts : {};
  const wantTags = b.hashtags !== false;

  const facts: string[] = [
    `Business: ${businessName}`,
    `Service: ${service}`,
    `Stage of work: ${stage}`,
    city ? `Location (city only, never a street address): ${city}${state ? `, ${state}` : ""}` : "Location: not given",
  ];
  if (onSite > 0) facts.push(`Time on site so far: ${Math.floor(onSite / 60)}h ${onSite % 60}m`);
  if (total > 0) facts.push(`Checklist: ${done} of ${total} items done`);
  const counts = Object.entries(pc).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${v} ${k}`);
  if (counts.length) facts.push(`Photos: ${counts.join(", ")}`);
  if (materials.length) facts.push(`Materials: ${materials.join(", ")}`);
  if (keywords.length) facts.push(`Target phrases (use naturally, don't stuff): ${keywords.join("; ")}`);
  if (note) facts.push(`Crew note (internal; use only facts about the work, never names or addresses): ${note}`);
  if (alwaysMention) facts.push(`Always include this line somewhere: "${alwaysMention}"`);
  if (neverSay.length) facts.push(`Never use these words: ${neverSay.join(", ")}`);

  try {
    const out = await chatCompletion(
      [
        {
          role: "system",
          content:
            `You write social and Google Business Profile posts for a local home-service company. Tone: ${tone}. ` +
            "Use ONLY the facts provided — never invent results, prices, warranties, customer names, or street addresses. " +
            "Mention the city when given. Keep sentences short and concrete. " +
            "Return a JSON object with keys: title (max 60 chars), gbp (max 1400 chars, no hashtags, no emoji), " +
            "facebook (max 400 chars, may use 1-2 emoji), instagram (max 350 chars, line breaks ok), " +
            "website (2-4 sentences, third person, suitable for a project page), " +
            (wantTags ? "hashtags (array of 3-6 short tags without the # sign, including the city and service)." : "hashtags (empty array)."),
        },
        { role: "user", content: facts.join("\n") },
      ],
      { maxTokens: 900, temperature: 0.6, json: true },
    );
    const parsed = parseJsonResponse<any>(out);
    const pick = (k: string, max: number) => (typeof parsed?.[k] === "string" ? parsed[k].trim().slice(0, max) : "");
    const hashtags = Array.isArray(parsed?.hashtags) ? parsed.hashtags.map((t: any) => String(t).replace(/[^\w]/g, "")).filter(Boolean).slice(0, 6) : [];
    res.json({
      title: pick("title", 120),
      gbp: pick("gbp", 1500),
      facebook: pick("facebook", 5000),
      instagram: pick("instagram", 2200),
      website: pick("website", 5000),
      hashtags: wantTags ? hashtags : [],
    });
  } catch (err) {
    handleError(req, res, err, "caption");
  }
});
