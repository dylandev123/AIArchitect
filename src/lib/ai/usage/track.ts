import { APICallError, NoObjectGeneratedError, type LanguageModelUsage } from "ai";
import { computeCostUsd } from "../pricing";
import { appendUsageRecord } from "./store";
import type { AiRequestType, AiScope, AiUsageRecord } from "./types";

export interface UsageMeta {
  projectId: string | null;
  requestType: AiRequestType;
  scope: AiScope;
  model: string;
}

const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Builds a record from the provider-reported usage; nothing is estimated. Missing usage counts as 0. */
export function buildUsageRecord(
  meta: UsageMeta,
  usage: LanguageModelUsage | undefined,
  outcome: { startedAt: number; latencyMs: number; errorKind: string | null }
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
  };
}

export function classifyError(error: unknown): string {
  if (NoObjectGeneratedError.isInstance(error)) return "schema_mismatch";
  if (APICallError.isInstance(error)) return `provider_${error.statusCode ?? "error"}`;
  return "error";
}

/**
 * Runs one generateText-style call and logs it — success or failure — without touching its
 * inputs or result. A logging problem never affects the request itself.
 */
export async function withUsageLogging<T extends { totalUsage: LanguageModelUsage }>(
  meta: UsageMeta,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  const t0 = performance.now();
  try {
    const result = await run();
    await log(buildUsageRecord(meta, result.totalUsage, { startedAt, latencyMs: performance.now() - t0, errorKind: null }));
    return result;
  } catch (error) {
    // NoObjectGeneratedError still carries the tokens the provider billed for the unusable response.
    const usage = NoObjectGeneratedError.isInstance(error) ? error.usage : undefined;
    await log(
      buildUsageRecord(meta, usage, { startedAt, latencyMs: performance.now() - t0, errorKind: classifyError(error) })
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
