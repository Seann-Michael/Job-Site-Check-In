import { logger } from "./logger";

export class AIError extends Error {
  constructor(message: string, public readonly status: 502 | 503) {
    super(message);
    this.name = "AIError";
  }
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object response. */
  json?: boolean;
  timeoutMs?: number;
}

/**
 * Minimal OpenAI chat-completions wrapper over fetch. Throws AIError(503) when
 * no key is configured and AIError(502) on any upstream failure. Upstream
 * error bodies are logged, never returned to clients.
 */
export async function chatCompletion(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AIError("AI not configured", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model || getOpenAIModel(),
        messages,
        max_tokens: opts.maxTokens ?? 500,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error({ status: res.status, body: text.slice(0, 500) }, "OpenAI request failed");
      throw new AIError("AI provider error", 502);
    }

    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      logger.error({ data }, "OpenAI returned empty content");
      throw new AIError("AI provider returned no content", 502);
    }
    return content;
  } catch (err) {
    if (err instanceof AIError) throw err;
    logger.error({ err }, "OpenAI request errored");
    throw new AIError("AI provider unavailable", 502);
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a JSON object out of a model response, tolerating code fences. */
export function parseJsonResponse<T = any>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    logger.error({ text: cleaned.slice(0, 300) }, "AI response was not valid JSON");
    throw new AIError("AI provider returned malformed output", 502);
  }
}
