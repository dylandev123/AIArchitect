import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, type LanguageModelUsage } from "ai";
import { computeCostUsd } from "../pricing";
import { bounded, boundedDiagnostic, CANDIDATE_MAX_CHARS } from "./diagnostics";
import { appendUsageRecord } from "./store";
import type { AiRequestType, AiScope, AiUsageRecord } from "./types";

export interface UsageMeta {
  projectId: string | null;
  requestType: AiRequestType;
  scope: AiScope;
  model: string;
  stage?: string; assetId?: string | null; planId?: string | null; promptFingerprint?: string;
  retryNumber?: number; retryReason?: string | null; operationId?: string; parentUsageId?: string | null;
  maxOutputTokens?: number;
  stageCall?: string;
}

/** What a caller learned about one call after judging its response; merged into that call's usage record. */
export interface UsageAssessment {
  errorKind?: string | null;
  finishReason?: string;
  diagnostic?: string;
  outputFingerprint?: string;
  candidate?: string;
}

const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Builds a record from the provider-reported usage; nothing is estimated. Missing usage counts as 0. */
export function buildUsageRecord(
  meta: UsageMeta,
  usage: LanguageModelUsage | undefined,
  outcome: { startedAt: number; latencyMs: number; errorKind: string | null },
  assessment: Omit<UsageAssessment, "errorKind"> = {}
): AiUsageRecord {
  const inputTokens = n(usage?.inputTokens);
  const outputTokens = n(usage?.outputTokens);
  const cachedInputTokens = Math.min(n(usage?.inputTokenDetails?.cacheReadTokens), inputTokens);
  const counts = { inputTokens, cachedInputTokens, outputTokens };
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(outcome.startedAt).toISOString(),
    ...meta,
    ...counts,
    totalTokens: n(usage?.totalTokens) || inputTokens + outputTokens,
    latencyMs: Math.round(outcome.latencyMs),
    success: outcome.errorKind === null,
    errorKind: outcome.errorKind,
    costUsd: computeCostUsd(meta.model, counts),
    ...(assessment.finishReason ? { finishReason: assessment.finishReason } : {}),
    ...(assessment.diagnostic ? { diagnostic: boundedDiagnostic(assessment.diagnostic) } : {}),
    ...(assessment.outputFingerprint ? { outputFingerprint: assessment.outputFingerprint } : {}),
    ...(assessment.candidate ? { candidate: bounded(assessment.candidate, CANDIDATE_MAX_CHARS) } : {}),
  };
}

export function classifyError(error: unknown): string {
  // A response cut off at maxOutputTokens is token exhaustion, not a schema problem — the model never finished.
  if (NoObjectGeneratedError.isInstance(error)) return error.finishReason === "length" ? "output_truncated" : "schema_mismatch";
  if (NoOutputGeneratedError.isInstance(error)) return "no_output";
  if (APICallError.isInstance(error)) return `provider_${error.statusCode ?? "error"}`;
  return "error";
}

/**
 * `generateText` resolves even when the model produced no usable output — e.g. a reasoning model that spent
 * its whole `maxOutputTokens` allowance before emitting any text — and only throws `NoOutputGeneratedError`
 * later, lazily, when `result.output` is read. Detected here so such a call is never logged as a success.
 */
function missingOutputKind(result: unknown): string | null {
  const r = result as { finishReason?: unknown; output?: unknown };
  if (r.finishReason === undefined || r.finishReason === "stop" || r.finishReason === "tool-calls") return null;
  try {
    void r.output;
    return null;
  } catch (error) {
    if (!NoOutputGeneratedError.isInstance(error)) return null;
    return r.finishReason === "length" ? "output_truncated" : "no_output";
  }
}

/**
 * Runs one generateText-style call and logs it — success or failure — without touching its
 * inputs or result. A logging problem never affects the request itself. `assess` (optional) lets the caller
 * judge the response before it is logged — a validation rejection, the finish reason, fingerprints — so one
 * record describes the whole attempt; an assessment that throws is ignored.
 */
export async function withUsageLogging<T extends { totalUsage: LanguageModelUsage }>(
  meta: UsageMeta,
  run: () => Promise<T>,
  assess?: (outcome: { result: T } | { error: unknown }) => UsageAssessment | Promise<UsageAssessment>
): Promise<T> {
  const startedAt = Date.now();
  const t0 = performance.now();
  const judge = async (outcome: { result: T } | { error: unknown }): Promise<UsageAssessment> => {
    try { return (await assess?.(outcome)) ?? {}; } catch { return {}; }
  };
  try {
    const result = await run();
    const latencyMs = performance.now() - t0;
    const { errorKind, ...assessment } = await judge({ result });
    const finishReason = (result as { finishReason?: unknown }).finishReason;
    await log(buildUsageRecord(meta, result.totalUsage, { startedAt, latencyMs, errorKind: errorKind !== undefined ? errorKind : missingOutputKind(result) }, { ...(typeof finishReason === "string" ? { finishReason } : {}), ...assessment }));
    return result;
  } catch (error) {
    const latencyMs = performance.now() - t0;
    // NoObjectGeneratedError still carries the tokens the provider billed for the unusable response.
    const usage = NoObjectGeneratedError.isInstance(error) ? error.usage : undefined;
    const { errorKind, ...assessment } = await judge({ error });
    const finishReason = NoObjectGeneratedError.isInstance(error) ? error.finishReason : undefined;
    await log(
      buildUsageRecord(meta, usage, { startedAt, latencyMs, errorKind: errorKind ?? classifyError(error) }, { ...(finishReason ? { finishReason } : {}), ...assessment })
    );
    throw error;
  }
}

async function log(record: AiUsageRecord) {
  try {
    await appendUsageRecord(record);
  } catch (err) {
    console.error("[AI usage] failed to record usage:", err instanceof Error ? err.name : "unknown error");
  }
}
