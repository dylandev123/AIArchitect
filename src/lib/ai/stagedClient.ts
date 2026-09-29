import { useAssetStore } from "@/store/useAssetStore";
import { useGenerationStore } from "@/store/useGenerationStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useAdminStore } from "@/store/useAdminStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useGenerationProgressStore } from "@/store/useGenerationProgressStore";
import { useArchitectureDebugStore } from "@/store/useArchitectureDebugStore";
import { toAssetIndex } from "@/lib/library/retrieval";
import { revisionOf } from "@/lib/house/revision";
import type { TimeOfDay } from "@/types/project";
import type { CapabilityRequest, GenerationReport } from "@/types/library";
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import type { HouseEditResult } from "./client";

/** Mirrors `PipelineStageEvent` in `@/lib/architecture/stages/pipeline` on the wire; kept structurally loose here since this is untrusted network data. */
interface StageEventPayload {
  type: "stage" | "mass-added" | "roof-added";
  stage: string;
  index?: number;
  of?: number;
  massesSoFar?: number;
  roofsSoFar?: number;
  totalMasses?: number;
  document: unknown;
}

const STAGE_LABEL: Record<string, string> = {
  intent: "Reading the architectural intent",
  "site-strategy": "Deciding the site strategy",
  "primary-mass": "Shaping the primary mass",
  "mass-expansion": "Composing the massing",
  "roof-composition": "Composing the roofs",
};

function progressLabel(event: StageEventPayload): string {
  if (event.type === "mass-added") return `Adding mass ${event.massesSoFar ?? "?"} to the composition`;
  if (event.type === "roof-added") return `Choosing a roof for mass ${event.roofsSoFar ?? "?"} of ${event.totalMasses ?? "?"}`;
  return STAGE_LABEL[event.stage] ?? "Designing the architecture";
}

/** Splits a growing SSE byte stream into complete `event:`/`data:` frames, buffering any partial trailing frame. */
async function* readSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const eventLine = block.split("\n").find((l) => l.startsWith("event: "));
      const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
      if (eventLine && dataLine) {
        try {
          yield { event: eventLine.slice("event: ".length), data: JSON.parse(dataLine.slice("data: ".length)) };
        } catch {
          // A malformed frame is skipped rather than aborting an otherwise-working stream.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export interface StagedGenerationRequest {
  projectId: string;
  prompt: string;
  /** Called once, only with the final result — the same contract `requestHouseEdit` uses. */
  apply: (summary: string, json: string) => void;
}

/**
 * The streaming counterpart to `requestHouseEdit`'s "generate" path: same request body and same final
 * response shape, but delivered as Server-Sent Events so the viewport can render each mass and roof as
 * the server decides it, via `useGenerationProgressStore` and incremental `updateHouseConfig` calls.
 */
export async function requestStagedGeneration(req: StagedGenerationRequest): Promise<HouseEditResult> {
  const setProgress = useGenerationProgressStore.getState().setProgress;
  const project = useProjectStore.getState().getProject(req.projectId);
  if (!project) return { ok: false, error: "Project not found.", status: 404 };

  const baseJson = project.houseConfigJson;
  const baseRevision = revisionOf(baseJson);
  // Every "stage" frame below writes its own growing preview into the project via updateHouseConfig, which
  // moves the project's revision away from baseRevision on purpose. The final staleness check must compare
  // against the revision *this stream itself* last wrote, not the pre-generation baseline — otherwise a
  // generation that streamed even one mass would always look "changed" and be reported as failed, despite
  // completing successfully server-side.
  let lastWrittenRevision = baseRevision;
  let baseParsed: Record<string, unknown> = {};
  try {
    baseParsed = JSON.parse(baseJson) as Record<string, unknown>;
  } catch {
    // A blank project's JSON is always valid; this only guards a hand-edited or corrupt project file.
  }

  let res: Response;
  try {
    res = await fetch("/api/ai/house", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        mode: "generate",
        projectId: req.projectId,
        prompt: req.prompt,
        currentHouseJson: baseJson,
        baseRevision,
        assets: useAssetStore.getState().getPBRMaterials().map((a) => ({ id: a.id, name: a.name })),
        libraryAssets: toAssetIndex(useAssetStore.getState().catalog),
      }),
    });
  } catch {
    setProgress(null);
    return { ok: false, error: "network error", status: 0 };
  }

  if (!res.body || !(res.headers.get("Content-Type") ?? "").includes("text/event-stream")) {
    // The pre-stream checks (blank-site guard, revision conflict, AI not configured) answer with plain JSON.
    setProgress(null);
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "AI request failed. Please try again.", status: res.status };
  }

  try {
    for await (const frame of readSseFrames(res.body)) {
      if (frame.event === "stage") {
        const event = frame.data as StageEventPayload;
        setProgress({ label: progressLabel(event), massesSoFar: event.massesSoFar ?? event.totalMasses, totalMasses: event.totalMasses });
        const merged = { ...baseParsed, architecturalDesignDocument: event.document };
        const mergedJson = JSON.stringify(merged);
        useProjectStore.getState().updateHouseConfig(req.projectId, mergedJson, `staged-generation:${event.stage}`);
        lastWrittenRevision = revisionOf(mergedJson);
        continue;
      }
      if (frame.event === "error") {
        // Dev-only: which stage actually failed and how the whole staged run traced, for the Architecture debug panel.
        // The live preview above is untouched — the last successfully streamed "stage" document stays on screen.
        const data = frame.data as { error?: string; status?: number; stage?: string; architectureDiagnostics?: StageDiagnostics[]; capabilityRequests?: CapabilityRequest[] };
        if (data.architectureDiagnostics) useArchitectureDebugStore.getState().setDiagnostics(data.architectureDiagnostics, data.stage, data.capabilityRequests);
        return { ok: false, error: data.error ?? "AI request failed. Please try again.", status: data.status ?? 502 };
      }
      if (frame.event === "done") {
        const data = frame.data as { summary?: string; json?: string; timeOfDay?: TimeOfDay; intelligence?: GenerationReport; architectureDiagnostics?: StageDiagnostics[]; capabilityRequests?: CapabilityRequest[] };
        if (data.architectureDiagnostics) useArchitectureDebugStore.getState().setDiagnostics(data.architectureDiagnostics, undefined, data.capabilityRequests);
        if (typeof data.json !== "string") return { ok: false, error: "AI request failed. Please try again.", status: 502 };

        const live = useProjectStore.getState().getProject(req.projectId);
        if (!live || revisionOf(live.houseConfigJson) !== lastWrittenRevision) {
          return { ok: false, error: "The project changed while the AI was working, so its result wasn't applied. Please ask again.", status: 409, stale: true };
        }
        const summary = data.summary ?? "AI design";
        if (data.intelligence) {
          useGenerationStore.getState().record(data.intelligence);
          const adminEmail = useAdminStore.getState().adminEmail;
          if (data.intelligence.persistence.ok && adminEmail) void useLibraryStore.getState().refresh(adminEmail);
        }
        req.apply(summary, data.json);
        if (data.timeOfDay) useProjectStore.getState().setTimeOfDay(req.projectId, data.timeOfDay);
        return { ok: true, summary, generated: true };
      }
    }
    return { ok: false, error: "The connection ended before the design finished. Please try again.", status: 502 };
  } finally {
    setProgress(null);
  }
}

/**
 * Dev-only: reruns exactly one architecture-pipeline stage (or the mandatory final assembly call) via
 * `/api/ai/house/replay`, reusing the server's cached upstream output for every stage before it instead of
 * paying for the whole pipeline again. The server 404s outside development. On success, an architecture
 * stage replay merges the new document into the live preview the same way a "stage" SSE frame does; a
 * final-assembly replay applies the whole regenerated project, same as a fresh generation would.
 */
export async function replayArchitectureStage(projectId: string, stage: "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition" | "final-assembly", apply: (summary: string, json: string) => void): Promise<{ ok: boolean; error?: string }> {
  const debugStore = useArchitectureDebugStore.getState();
  debugStore.setReplaying(stage);
  try {
    const res = await fetch("/api/ai/house/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, stage }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string; document?: unknown; diagnostics?: StageDiagnostics[];
      summary?: string; json?: string; architectureDiagnostics?: StageDiagnostics[]; capabilityRequests?: CapabilityRequest[];
    };
    if (!res.ok) return { ok: false, error: data.error ?? "Replay failed." };

    if (typeof data.json === "string") {
      // A final-assembly replay returns a whole regenerated project, same shape as a fresh generation.
      if (data.architectureDiagnostics) useArchitectureDebugStore.getState().setDiagnostics(data.architectureDiagnostics, undefined, data.capabilityRequests);
      apply(data.summary ?? "AI design", data.json);
      return { ok: true };
    }

    // An architecture-stage replay returns just the updated document; merge it into the live preview.
    const project = useProjectStore.getState().getProject(projectId);
    if (!project) return { ok: false, error: "Project not found." };
    let baseParsed: Record<string, unknown> = {};
    try {
      baseParsed = JSON.parse(project.houseConfigJson) as Record<string, unknown>;
    } catch {
      // A blank project's JSON is always valid; this only guards a hand-edited or corrupt project file.
    }
    useProjectStore.getState().updateHouseConfig(projectId, JSON.stringify({ ...baseParsed, architecturalDesignDocument: data.document }), `architecture-replay:${stage}`);
    if (data.diagnostics) useArchitectureDebugStore.getState().setDiagnostics(data.diagnostics, undefined, data.capabilityRequests);
    return { ok: true };
  } catch {
    return { ok: false, error: "network error" };
  } finally {
    debugStore.setReplaying(null);
  }
}
