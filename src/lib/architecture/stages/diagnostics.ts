/**
 * One entry per conceptual stage in the live pipeline, for dev/debug tooling only — never required by
 * rendering or by the response the renderer consumes. Intent, Site Strategy and Primary Mass are one
 * model call (see foundationStage.ts), so they are traced together as "foundation".
 */
export interface StageDiagnostics {
  stage: "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition" | "site-plan" | "compiler" | "quality-gate";
  /** "fallback" = the stage produced a deterministic default instead of a model answer; the pipeline still completed. For "quality-gate", "fallback" means one or more checks failed — reporting only, never a hard failure. */
  status: "ok" | "fallback" | "error";
  durationMs: number;
  /** Actual model calls made for this stage (0 for the deterministic compiler check and the quality gate — neither ever calls a model). */
  modelCalls: number;
  /** modelCalls beyond the one each logical decision needed. */
  retries: number;
  error?: string;
  /** Non-fatal findings on an "ok" stage — e.g. roof-language issues the model left unrepaired, whose authored roofs were still kept. */
  warnings?: string[];
}

export const STAGE_DIAGNOSTICS_LABEL: Record<StageDiagnostics["stage"], string> = {
  foundation: "Intent → Site Strategy → Primary Mass",
  "mass-expansion": "Mass Expansion",
  "architectural-geometry": "Architectural Geometry Pass",
  "roof-composition": "Roof Composition",
  "site-plan": "Site Plan",
  compiler: "Compiler",
  "quality-gate": "Design Quality Gate",
};
