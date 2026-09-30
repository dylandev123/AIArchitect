import { NextRequest, NextResponse } from "next/server";
import { getAiModelId, isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai/model";
import { createTimings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { WORLD_SCOPE } from "@/lib/ai/targeting";
import { replayArchitectureStage, type ReplayableArchitectureStage } from "@/lib/architecture/stages/pipeline";
import { getDevSession, setDevSession } from "@/lib/architecture/stages/devSessionCache";
import { runFinalAssembly } from "@/lib/ai/finalAssembly";
import { providerErrorResponse } from "@/lib/ai/providerErrors";
import { isV2GenerationFailure } from "@/lib/architecture/stages/recovery";
import { v2FailureResponse } from "@/lib/ai/v2Failure";

export const maxDuration = 120;
/** A manual, one-stage debug rerun — generous but bounded, not the full multi-stage request budget. */
const REPLAY_BUDGET_MS = 100_000;

const REPLAYABLE_STAGES = ["foundation", "mass-expansion", "architectural-geometry", "roof-composition", "final-assembly"] as const;
type Stage = (typeof REPLAYABLE_STAGES)[number];

interface ReplayRequestBody {
  projectId?: string | null;
  stage?: string;
}

/**
 * Dev-only: reruns exactly one architecture-pipeline stage (or the mandatory final assembly call), reusing
 * this project's last cached run for every stage before it instead of paying for the whole pipeline again.
 * Disabled outside development/preview — see devSessionCache.ts. Never called by production code paths.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  let body: ReplayRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const stage = body.stage as Stage | undefined;
  if (!stage || !REPLAYABLE_STAGES.includes(stage)) {
    return NextResponse.json({ error: `"stage" must be one of: ${REPLAYABLE_STAGES.join(", ")}.` }, { status: 400 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const session = getDevSession(projectId);
  if (!session) {
    return NextResponse.json({ error: "No cached staged-pipeline run for this project. Generate a design first, then replay." }, { status: 404 });
  }

  const usageMeta: UsageMeta = { projectId, requestType: "generation", scope: WORLD_SCOPE.level, model: getAiModelId() };
  const timings = createTimings();

  try {
    if (stage === "final-assembly") {
      // Needs the fully-assembled `document`/`design` from a complete prior run — a session that only has
      // incremental `upstream` progress (the pipeline crashed before finishing stages 1-5) can't replay this.
      if (!session.finalAssembly || !session.result) {
        return NextResponse.json({ error: "This cached run has no final-assembly context to replay." }, { status: 404 });
      }
      const { assets, recipes, retrieved, spaces, library, baseRevision, sitePlan, sitePlanHash } = session.finalAssembly;
      // A replayed architecture stage produced a new document; the cached Site Plan was authored against the old
      // one, and Final Assembly never designs a site itself. Regenerate rather than assemble a mismatched pair.
      if (session.result.authority.architectureHash !== session.finalAssembly.architectureHash) {
        return NextResponse.json({ error: "The architecture changed since this run's Site Plan was authored. Generate again to author a Site Plan for it." }, { status: 409 });
      }
      const response = await runFinalAssembly({
        brief: session.input.brief, assets, baseRevision, library, usageMeta, timings,
        pipelineResult: session.result, recipes, recipeIds: recipes.map((r) => r.id), retrieved, spaces,
        budgetMs: REPLAY_BUDGET_MS, sitePlan, sitePlanHash,
      });
      return response;
    }

    // Falls back to `session.upstream` — written incrementally after every stage (see `onUpstreamProgress`
    // in pipeline.ts) — when the last run never reached a full `result` (a deterministic stage crashed after
    // one or more AI stages already succeeded). Either way, no AI stage this project already paid for reruns.
    const cachedUpstream = session.result?.upstream ?? session.upstream;
    if (!cachedUpstream) {
      return NextResponse.json({ error: "No cached stage output for this project yet. Generate a design first, then replay." }, { status: 404 });
    }
    const result = await replayArchitectureStage(stage as ReplayableArchitectureStage, session.input, cachedUpstream, timings, REPLAY_BUDGET_MS, usageMeta);
    setDevSession(projectId, { ...session, result });
    return NextResponse.json({
      document: result.document,
      diagnostics: result.diagnostics,
      truncated: result.truncated,
      capabilityRequests: result.capabilityRequests,
    });
  } catch (error) {
    // Same rule as a live generation: a stage that exhausts its retry budget yields no design, never a fallback one.
    if (isV2GenerationFailure(error)) return v2FailureResponse("v2-generation-failed", error.stage, error.conflicts, error.diagnostics, usageMeta);
    console.error(`[architecture-replay] ${stage} failed:`, error);
    return providerErrorResponse(error, stage);
  }
}
