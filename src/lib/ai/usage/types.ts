/** `generation_failure` is not a model call: one zero-token row recording why a V2 generation did not finalize (excluded from usage summaries). */
export type AiRequestType = "generation" | "scoped_edit" | "learn" | "recipe_proposal" | "asset_plan" | "native_asset" | "native_asset_retry" | "generation_failure";
export type AiScope = "world" | "zone" | "component";

/** One provider call. Deliberately holds no prompt, response, or error text — only metadata and counts. */
export interface AiUsageRecord {
  id: string;
  /** ISO timestamp of when the call started. */
  timestamp: string;
  projectId: string | null;
  requestType: AiRequestType;
  scope: AiScope;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  /** Coarse failure category (never the raw error message, which can echo credentials). */
  errorKind: string | null;
  /** null when the model had no configured price at the time. */
  costUsd: number | null;
  stage?: string;
  assetId?: string | null;
  planId?: string | null;
  promptFingerprint?: string;
  retryNumber?: number;
  retryReason?: string | null;
  operationId?: string;
  parentUsageId?: string | null;
  providerRequestId?: string | null;
  maxOutputTokens?: number;
  resultingAssetHash?: string | null;
  /** The exact stage call that made this request when it differs from `stage` (e.g. "mass-expansion-3" for turn 3 of stage "mass-expansion"). */
  stageCall?: string;
  /** The provider's finish reason ("stop", "length", ...), when known. */
  finishReason?: string;
  /** Our own validation/repair reason for a rejected attempt, or the V2 failure reason (bounded; never a raw provider error or model reasoning). */
  diagnostic?: string;
  /** sha256 prefix of the raw response text/object — identifies identical outputs without storing them. */
  outputFingerprint?: string;
  /** The structured candidate a rejected stage attempt produced (bounded JSON), so a failed stage can be diagnosed. Never model reasoning. */
  candidate?: string;
}
