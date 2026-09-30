import type { AssetRef } from "@/lib/ai/capabilities";
import type { AssetIndexEntry } from "@/lib/library/retrieval";
import type { RetrievedRecipe } from "@/lib/library/spaceRecipes";
import type { OutdoorSpace } from "@/lib/outdoor/spaces";
import type { DesignRecipe } from "@/types/library";
import type { StageDiagnostics } from "./diagnostics";
import type { PipelineInput, PipelineResult } from "./pipeline";
import type { SitePlan } from "../sitePlanContract";

/**
 * Dev-only, in-memory cache of the last staged-pipeline run per project, so a Replay can rerun one failed
 * stage against the same request's still-valid upstream output instead of paying for the whole pipeline
 * again. Never active in production: `set`/`get` are no-ops there, so this adds no memory footprint or
 * behavior change outside local/dev debugging. Cleared on server restart — same-session only, as intended.
 *
 * `result` is only present once the full pipeline (stages 1-5) completed — required for a "final-assembly"
 * replay, which needs the assembled `document`/`design`. `upstream`/`diagnostics` are written incrementally,
 * after every stage (see `onUpstreamProgress` in pipeline.ts), so they're already populated even if a later,
 * purely deterministic stage then crashes before `result` is ever set — an architecture-stage replay only
 * ever needs `input` + `upstream`, so it can still resume from the latest valid cached state without paying
 * for the AI stages that already succeeded.
 */
export interface DevSession {
  input: PipelineInput;
  result?: PipelineResult;
  upstream?: PipelineResult["upstream"];
  diagnostics?: readonly StageDiagnostics[];
  /** So a "final-assembly" replay can rerun just the mandatory tail call without recomputing stages 1-5. */
  finalAssembly?: { assets: AssetRef[]; recipes: DesignRecipe[]; retrieved: readonly RetrievedRecipe[]; spaces: OutdoorSpace[]; library: AssetIndexEntry[]; baseRevision: string; sitePlan: SitePlan; sitePlanHash: string; /** The architecture the Site Plan was authored against. */ architectureHash: string };
}

const ENABLED = process.env.NODE_ENV !== "production";
const sessions = new Map<string, DevSession>();

const keyOf = (projectId: string | null | undefined) => projectId ?? "__no_project__";

export function setDevSession(projectId: string | null | undefined, session: DevSession): void {
  if (!ENABLED) return;
  sessions.set(keyOf(projectId), session);
}

export function getDevSession(projectId: string | null | undefined): DevSession | undefined {
  if (!ENABLED) return undefined;
  return sessions.get(keyOf(projectId));
}
