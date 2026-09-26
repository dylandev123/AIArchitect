import { useAssetStore } from "@/store/useAssetStore";
import { useProjectStore } from "@/store/useProjectStore";
import { revisionOf } from "@/lib/house/revision";
import { needsInitialGeneration } from "@/lib/house/blank";
import type { TimeOfDay } from "@/types/project";

export const STALE_PROJECT_MESSAGE =
  "The project changed while the AI was working, so its edit wasn't applied. Please ask again.";

export interface HouseEditRequest {
  projectId: string;
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** Untrusted target hint (e.g. from a quick action); the server rebuilds the allowed ops itself. */
  scope?: unknown;
  /** Called synchronously, only if the project is still at the revision the request was based on. */
  apply: (summary: string, json: string) => void;
}

export type HouseEditResult =
  | { ok: true; summary: string; generated: boolean }
  | { ok: false; error: string; status: number; stale?: boolean };

function fallbackError(status: number): string {
  if (status === 504 || status === 408) return "The AI took too long to respond. Try again, or start with a shorter brief and add detail afterwards.";
  if (status >= 500) return `The server had a problem handling that request (HTTP ${status}). Please try again.`;
  return "AI edit failed.";
}

/**
 * POSTs one request to /api/ai/house against the project's current JSON and applies the result
 * only if nothing else changed the project in the meantime (optimistic revision check).
 */
export async function requestHouseEdit(req: HouseEditRequest): Promise<HouseEditResult> {
  const project = useProjectStore.getState().getProject(req.projectId);
  if (!project) return { ok: false, error: "Project not found.", status: 404 };

  const baseJson = project.houseConfigJson;
  const baseRevision = revisionOf(baseJson);
  // A never-designed project's first prompt is a brief for the initial design; every later one is a scoped
  // edit — even if the user has since emptied the design, which must not trigger a regeneration.
  const generate = needsInitialGeneration(project);

  const res = await fetch("/api/ai/house", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: generate ? "generate" : "edit",
      projectId: req.projectId,
      prompt: req.prompt,
      currentHouseJson: baseJson,
      baseRevision,
      history: generate ? [] : (req.history ?? []),
      scope: req.scope,
      assets: useAssetStore.getState().getPBRMaterials().map((a) => ({ id: a.id, name: a.name })),
    }),
  });
  // A gateway timeout or crash answers with a non-JSON page: report what happened instead of a parse error.
  const data = (await res.json().catch(() => ({}))) as { summary?: string; json?: string; timeOfDay?: TimeOfDay; error?: string };

  if (!res.ok || typeof data.json !== "string") {
    return { ok: false, error: data.error ?? fallbackError(res.status), status: res.status };
  }

  const live = useProjectStore.getState().getProject(req.projectId);
  if (!live || revisionOf(live.houseConfigJson) !== baseRevision) {
    return { ok: false, error: STALE_PROJECT_MESSAGE, status: 409, stale: true };
  }

  const summary = data.summary ?? "AI edit";
  req.apply(summary, data.json);
  if (generate && data.timeOfDay) useProjectStore.getState().setTimeOfDay(req.projectId, data.timeOfDay);
  return { ok: true, summary, generated: generate };
}
