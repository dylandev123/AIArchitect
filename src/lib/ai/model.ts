import { openai } from "@ai-sdk/openai";

/** Server-only: imported by API routes exclusively. OPENAI_API_KEY is never sent to the client. */
const DEFAULT_MODEL = "gpt-6-astra";

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI isn't configured yet. Set OPENAI_API_KEY in your server environment to enable this.";

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getAiModel() {
  return openai(process.env.AI_HOUSE_MODEL || DEFAULT_MODEL);
}
