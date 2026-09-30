import { z } from "zod";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { compileArchitecture } from "../compiler";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument } from "../document";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { runDesignQualityGate } from "./qualityGate";
import { runStage } from "./runStage";

const outputSchema = z.object({ document: z.unknown() });

const SYSTEM = `You are the sole AI Architect for a residential property. Author ONE complete, persistent, executable ArchitecturalDesignDocument. You have sole architectural authority: decide the coherent massing, exact world positions, dimensions, rotations, elevations, floors, footprint operations, openings, entry, terraces/screens, and a roof recipe for every mass.

Return only { document }. document must have version=1, brief, siteStrategy, massing, roofs, facade, architecturalStyle, outdoorPlan, materialStrategy, components, furnishings, and metadata. Each mass must use a stable id, explicit position {x,z}, width, depth, floors, elevation, rotation, placementLocked:true, and its real operations/openings. Every roof must reference a real mass. Use meters and radians. Include actual glazing-zone/door/opening-rhythm operations rather than prose. Do not hand off decisions to another AI, emit a semantic plan for later translation, or use a generic 12m x 9m gable house.

The deterministic compiler may validate, ground, snap, and reject objective errors, but it will not add architecture for you. On a repair request, preserve unaffected ids, positions, geometry, openings, and roofs; change only the specified objective failures.`;

export interface ArchitectStageResult {
  ok: boolean;
  document?: ArchitecturalDesignDocument;
  attempts: number;
  durationMs: number;
  errors?: string[];
  repairRequests?: string[];
}

export async function runArchitectStage(brief: string, timings: Timings, budgetMs: number, usageMeta: UsageMeta): Promise<ArchitectStageResult> {
  const result = await runStage({
    stageName: "architect",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${brief}`,
      "Author the executable architecture now. Do not omit geometry, openings, or roofs.",
      previousErrors.length ? `Objective compiler/quality failures to repair without redesigning unaffected architecture:\n${previousErrors.map((error) => `- ${error}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: outputSchema,
    timings,
    remainingBudgetMs: budgetMs,
    usageMeta,
    maxOutputTokens: 5000,
    validate: ({ document }) => {
      if (!isArchitecturalDesignDocument(document)) return ["document must be an ArchitecturalDesignDocument with version, massing, and roofs."];
      const errors = validateArchitecturalDesignDocument(document);
      if (errors.length) return errors;
      const compiled = compileArchitecture(document, { materials: DEFAULT_MATERIALS_CONFIG });
      if (compiled.errors.length || !compiled.diagnostics) return compiled.errors.length ? compiled.errors : ["The document produced no compiler diagnostics."];
      const gate = runDesignQualityGate(document, compiled.diagnostics);
      return gate.blocking.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`);
    },
  });
  if (!result.ok) return { ok: false, attempts: result.attempts, durationMs: result.durationMs, errors: result.errors, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
  return { ok: true, document: result.value.document as ArchitecturalDesignDocument, attempts: result.attempts, durationMs: result.durationMs, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
}
