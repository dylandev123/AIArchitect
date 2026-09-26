export type AiRequestType = "generation" | "scoped_edit" | "learn";
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
}
