import { isV3ProjectRoot, type V3Scene } from "./scene";

export type V3RendererSource = "persisted" | "failed-preview" | "render-history" | "other";

export interface V3FailedPreviewCandidate {
  projectId: string;
  scene: V3Scene;
}

export interface V3ActiveRenderSource {
  source: V3RendererSource;
  scene?: V3Scene;
}

export interface ResolveActiveV3RenderSourceInput {
  projectId: string;
  persistedJson: string | undefined;
  rendererJson: string | undefined;
  failedPreviewCandidate?: V3FailedPreviewCandidate | null;
  failedPreviewActive: boolean;
  /** History is opt-in and must belong to the current project. */
  historyProjectId?: string;
  historyActive?: boolean;
}

const parseRoot = (json: string | undefined) => {
  try { return JSON.parse(json ?? "{}"); } catch { return undefined; }
};

/**
 * The sole authority for choosing a V3 scene at render time. A failed Terra
 * preview is intentionally in-memory and therefore wins before any persisted
 * or render-history JSON is considered.
 */
export function resolveActiveV3RenderSource(input: ResolveActiveV3RenderSourceInput): V3ActiveRenderSource {
  const preview = input.failedPreviewActive && input.failedPreviewCandidate?.projectId === input.projectId
    ? input.failedPreviewCandidate.scene
    : undefined;
  if (preview) return { source: "failed-preview", scene: preview };

  const persistedRoot = parseRoot(input.persistedJson);
  const rendererRoot = parseRoot(input.rendererJson);
  if (input.historyActive && input.historyProjectId === input.projectId && isV3ProjectRoot(rendererRoot)) {
    return { source: input.rendererJson === input.persistedJson ? "persisted" : "render-history", scene: rendererRoot.v3Scene };
  }
  if (isV3ProjectRoot(persistedRoot)) return { source: "persisted", scene: persistedRoot.v3Scene };
  return { source: "other" };
}
