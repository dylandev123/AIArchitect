import { NextResponse } from "next/server";
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import type { OwningStage } from "@/lib/architecture/stages/recovery";

const STAGE_LABEL: Record<OwningStage, string> = {
  foundation: "the foundational design decisions",
  "mass-expansion": "the massing composition",
  "architectural-geometry": "the building geometry",
  "roof-composition": "the roof composition",
  "site-plan": "the site plan",
  "final-assembly": "the final assembly",
  "integrity-gate": "the final integrity check",
};

/**
 * The one response for a V2 generation that did not finalize: an authoritative stage exhausted its retry budget
 * (`v2-generation-failed`), or the final integrity gate blocked the artifact (`v2-integrity-blocked`). It never
 * carries a project `json` — there is no design to render or save — and its `code` tells the client to discard
 * any live preview it streamed. Conflict detail is dev-only, like every other stage trace.
 */
export function v2FailureResponse(code: "v2-generation-failed" | "v2-integrity-blocked", stage: OwningStage, conflicts: readonly string[], diagnostics: readonly StageDiagnostics[]): NextResponse {
  const isDev = process.env.NODE_ENV !== "production";
  console.warn(`[v2-authority] generation did not finalize (${code}, ${stage}):`, conflicts);
  const error = code === "v2-integrity-blocked"
    ? "The design failed its final integrity check, so it was not saved. Please try again."
    : `The AI could not complete ${STAGE_LABEL[stage]} for that brief, so no design was produced. Please try again.`;
  return NextResponse.json(
    { error, code, outcome: "failed", stage, ...(isDev ? { conflicts: [...conflicts], architectureDiagnostics: [...diagnostics] } : {}) },
    { status: code === "v2-integrity-blocked" ? 422 : 502 },
  );
}
