import type { StageDiagnostics } from "./diagnostics";

/**
 * The one recovery vocabulary every V2 stage and the final integrity gate report in:
 *  - "accepted"        the AI design is executable exactly as authored;
 *  - "normalized"      only intent-preserving deterministic corrections were applied (numeric clamps, periodic
 *                      angle wrapping, eave trims that keep the roof language, path snapping/routing);
 *  - "repair-required" a structured conflict was sent back to the owning AI stage, inside its existing retry budget;
 *  - "failed"          that budget is exhausted — the generation does not finalize.
 * A repair-required conflict is never resolved by deterministic redesign: it is repaired by its owner or it fails.
 */
export type RecoveryOutcome = "accepted" | "normalized" | "repair-required" | "failed";

export type OwningStage = "architect" | "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition" | "site-plan" | "final-assembly" | "integrity-gate";

/** One objective conflict between an authored artifact and what can be built, addressed to the stage that owns the fix. */
export interface StageConflict { stage: OwningStage; code: string; massId?: string; detail: string }

/** The text a conflict is sent back to its owning stage as (the stage's next attempt sees it verbatim). */
export const repairRequest = (conflict: StageConflict): string => `[repair-required:${conflict.code}${conflict.massId ? ` ${conflict.massId}` : ""}] ${conflict.detail}`;
export const repairRequests = (conflicts: readonly StageConflict[]): string[] => conflicts.map(repairRequest);

/** A stage's final outcome: a repair that succeeded inside the budget is "accepted"/"normalized", one that did not is "failed". */
export function finalOutcome(ok: boolean, normalizations: readonly string[] = []): Exclude<RecoveryOutcome, "repair-required"> {
  return !ok ? "failed" : normalizations.length ? "normalized" : "accepted";
}

/**
 * Thrown when an authoritative stage exhausts its retry budget (or the final integrity gate blocks): the generation
 * is incomplete and must not be returned, rendered or persisted as a successful design. Carries what the caller
 * needs to report it — never a substitute design.
 */
export class V2GenerationFailure extends Error {
  readonly outcome = "failed" as const;
  constructor(
    readonly stage: OwningStage,
    readonly conflicts: readonly string[],
    readonly diagnostics: readonly StageDiagnostics[] = [],
  ) {
    super(`[v2-authority] ${stage} failed: ${conflicts.join("; ") || "no usable response"}`);
    this.name = "V2GenerationFailure";
  }
}

export const isV2GenerationFailure = (error: unknown): error is V2GenerationFailure => error instanceof V2GenerationFailure;
