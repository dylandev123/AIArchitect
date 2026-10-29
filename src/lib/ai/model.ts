import { openai, createOpenAI } from "@ai-sdk/openai";

/** Server-only: imported by API routes exclusively. OPENAI_API_KEY is never sent to the client. */
/** House generation deliberately keeps its established Terra policy. */
const HOUSE_MODEL = "gpt-5.6-terra";
const NATIVE_ASSET_MODEL = "gpt-5.6-terra";
const ASSET_PLANNING_MODEL = "gpt-5.6-terra";

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI isn't configured yet. Set OPENAI_API_KEY in your server environment to enable this.";

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getAiModelId(): string {
  return process.env.AI_HOUSE_MODEL || HOUSE_MODEL;
}

/** Kept separate so Luna can be evaluated offline and enabled without touching house generation. */
export function getNativeAssetModelId(): string {
  return process.env.AI_NATIVE_ASSET_MODEL || NATIVE_ASSET_MODEL;
}

export function getAssetPlanningModelId(): string {
  return process.env.AI_ASSET_PLANNING_MODEL || ASSET_PLANNING_MODEL;
}

export function getAiModel(capture?: (record: {requestBody?: string; responseBody: string; status: number}) => void, modelId = getAiModelId()) {
  if (!capture) return openai(modelId);
  return createOpenAI({fetch: async (input, init) => {
    const response = await fetch(input, init);
    // Capture body bytes as UTF-8 text before SDK parsing; never retain auth headers.
    const responseBody = await response.clone().text();
    capture({requestBody: typeof init?.body === 'string' ? init.body : undefined, responseBody, status: response.status});
    return response;
  }})(modelId);
}
export function getNativeAssetModel() { return openai(getNativeAssetModelId()); }
export function getAssetPlanningModel() { return openai(getAssetPlanningModelId()); }

/**
 * Operation payloads (`value`/`fields`) are free-form objects on the wire and validated locally
 * per operation, which OpenAI's strict mode cannot express; the flat JSON schema is still sent
 * as a json_schema response_format, just without strict additionalProperties enforcement.
 */
export const AI_PROVIDER_OPTIONS = { openai: { strictJsonSchema: false } } as const;
