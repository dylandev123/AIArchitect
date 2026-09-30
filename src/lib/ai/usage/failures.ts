import { boundedDiagnostic } from "./diagnostics";
import { appendUsageRecord } from "./store";
import type { UsageMeta } from "./track";

/**
 * Persists why a V2 generation did not finalize, as one zero-token `generation_failure` row next to the
 * per-call rows of the stages that led to it (summaries exclude it). Never throws.
 */
export async function recordGenerationFailure(meta: UsageMeta, failure: { code: string; stage: string; reasons: readonly string[] }): Promise<void> {
  try {
    await appendUsageRecord({
      id: crypto.randomUUID(), timestamp: new Date().toISOString(),
      projectId: meta.projectId, requestType: "generation_failure", scope: meta.scope, model: meta.model, stage: failure.stage,
      inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, latencyMs: 0, costUsd: 0,
      success: false, errorKind: failure.code, diagnostic: boundedDiagnostic(failure.reasons.join("; ") || "no usable response"),
    });
  } catch (err) {
    console.error("[AI usage] failed to record generation failure:", err instanceof Error ? err.name : "unknown error");
  }
}
