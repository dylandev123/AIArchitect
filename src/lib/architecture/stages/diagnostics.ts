import type { RecoveryOutcome } from "./recovery";
import type { ArchitectureGenerationMode } from "./generationMode";

/**
 * One entry per conceptual stage in the live pipeline, for dev/debug tooling only — never required by
 * rendering or by the response the renderer consumes. Intent, Site Strategy and Primary Mass are one
 * model call (see foundationStage.ts), so they are traced together as "foundation".
 */
export interface StageDiagnostics {
  stage: "architect" | "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition" | "site-plan" | "compiler" | "quality-gate";
  /** "error" = the stage failed and the generation does not finalize. "fallback" is only ever a warning-level finding (e.g. the quality gate's subjective checks, an unplaced optional volume) — never a deterministic substitute design. */
  status: "ok" | "fallback" | "error";
  /** The stage's standardized recovery outcome (see recovery.ts). */
  outcome?: RecoveryOutcome;
  /** Conflicts sent back to this stage's AI as repair requests, in order — including ones a later attempt repaired. */
  repairRequests?: string[];
  durationMs: number;
  /** Actual model calls made for this stage (0 for the deterministic compiler check and the quality gate — neither ever calls a model). */
  modelCalls: number;
  /** modelCalls beyond the one each logical decision needed. */
  retries: number;
  error?: string;
  /** Non-fatal findings on an "ok" stage — e.g. roof-language issues the model left unrepaired, whose authored roofs were still kept. */
  warnings?: string[];
  /** Generation routing decision, recorded on the first architecture-stage diagnostic. */
  generationMode?: ArchitectureGenerationMode;
}

export const STAGE_DIAGNOSTICS_LABEL: Record<StageDiagnostics["stage"], string> = {
  architect: "AI Architect",
  foundation: "Intent → Site Strategy → Primary Mass",
  "mass-expansion": "Mass Expansion",
  "architectural-geometry": "Architectural Geometry Pass",
  "roof-composition": "Roof Composition",
  "site-plan": "Site Plan",
  compiler: "Compiler",
  "quality-gate": "Design Quality Gate",
};
