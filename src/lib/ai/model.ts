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

/**
 * Operation payloads (`value`/`fields`) are free-form objects on the wire and validated locally
 * per operation, which OpenAI's strict mode cannot express; the flat JSON schema is still sent
 * as a json_schema response_format, just without strict additionalProperties enforcement.
 */
export const AI_PROVIDER_OPTIONS = { openai: { strictJsonSchema: false } } as const;
