import { auditHash, primitiveSignature } from "@/lib/architecture/renderAudit";
import { compileV3Scene, isV3ProjectRoot, type V3Scene, type V3SceneObject } from "./scene";
import { resolveActiveV3RenderSource, type V3RendererSource as V3ActiveRendererSource } from "./activeRenderSource";

export type V3RendererSource = V3ActiveRendererSource | "fixture";

export interface V3CameraSourceEvidence {
  projectId: string;
  sceneHash: string;
  source: V3ActiveRendererSource;
}

export interface V3RenderIdentity {
  projectId: string;
  persistedSceneHash: string | null;
  persistedObjectCount: number | null;
  persistedObjects: Array<Pick<V3SceneObject, "id" | "type" | "label">>;
  compiledInputSceneHash: string | null;
  compiledPrimitiveHash: string | null;
  compiledPrimitiveCount: number | null;
  rendererSceneHash: string | null;
  rendererSource: V3RendererSource;
  v2DocumentOrConfigActive: boolean;
  failedPreviewActive: boolean;
  renderHistoryOverrideActive: boolean;
  fixtureDebugOverrideActive: boolean;
  invariantWarnings: string[];
  cameraSceneHash: string | null;
}

export interface V3RenderIdentityInput {
  /** Observed at the actual compiler call, rather than reconstructed from selection. */
  observedCompilerInputHash?: string | null;
  cameraSource?: V3CameraSourceEvidence | null;
  projectId: string;
  persistedJson: string | undefined;
  rendererJson: string | undefined;
  failedPreviewScene?: V3Scene;
  failedPreviewActive: boolean;
  renderHistoryOverrideActive: boolean;
  renderHistorySource?: string;
  historyProjectId?: string;
  fixtureDebugOverrideActive: boolean;
}

const parseRoot = (json: string | undefined) => {
  try { return JSON.parse(json ?? "{}"); } catch { return undefined; }
};

const isV2DocumentOrConfig = (root: unknown) => {
  if (!root || typeof root !== "object") return false;
  if (!isV3ProjectRoot(root)) return true;
  const record = root as unknown as Record<string, unknown>;
  return !!(record.architecturalDesignDocument ?? record.architectureDocument);
};

const isFixtureSource = (source: string | undefined) =>
  !!source && (source.startsWith("fixture:") || source.startsWith("historical-fixture:") || source.includes("fixture"));

/**
 * Read-only identity evidence for the scene that HouseRenderer is compiling.
 * Scene hashes intentionally hash the authored V3 scene, not JSON whitespace or
 * renderer-only presentation flags, so authorities can be compared directly.
 */
export function buildV3RenderIdentity(input: V3RenderIdentityInput): V3RenderIdentity {
  const persistedRoot = parseRoot(input.persistedJson);
  const rendererRoot = parseRoot(input.rendererJson);
  const persistedScene = isV3ProjectRoot(persistedRoot) ? persistedRoot.v3Scene : undefined;
  const active = resolveActiveV3RenderSource({
    projectId: input.projectId,
    persistedJson: input.persistedJson,
    rendererJson: input.rendererJson,
    historyActive: input.renderHistoryOverrideActive,
    historyProjectId: input.historyProjectId,
    failedPreviewCandidate: input.failedPreviewScene ? { projectId: input.projectId, scene: input.failedPreviewScene } : undefined,
    failedPreviewActive: input.failedPreviewActive,
  });
  const rendererScene = active.scene;
  const rendererSource: V3RendererSource = input.renderHistoryOverrideActive && active.source === "render-history" && isFixtureSource(input.renderHistorySource)
    ? "fixture"
    : active.source;
  const compiled = rendererScene ? compileV3Scene(rendererScene) : undefined;

  const rendererHash = rendererScene ? auditHash(rendererScene) : null;
  const compilerHash = input.observedCompilerInputHash !== undefined ? input.observedCompilerInputHash : rendererHash;
  const invariantWarnings: string[] = [];
  if (persistedScene || rendererScene) {
    if (compilerHash !== rendererHash) invariantWarnings.push("RENDER_COMPILER_SOURCE_MISMATCH");
    if (input.cameraSource && (input.cameraSource.projectId !== input.projectId || input.cameraSource.sceneHash !== rendererHash || input.cameraSource.source !== active.source)) invariantWarnings.push("CAMERA_RENDER_SOURCE_MISMATCH");
    if (input.renderHistoryOverrideActive && input.historyProjectId !== input.projectId) invariantWarnings.push("HISTORY_PROJECT_MISMATCH");
    if (input.failedPreviewActive && active.source !== "failed-preview") invariantWarnings.push("FAILED_PREVIEW_SOURCE_MISMATCH");
    if (persistedScene && isV2DocumentOrConfig(rendererRoot)) invariantWarnings.push("V3_RENDERING_V2_ROOT");
  }
  return {
    invariantWarnings,
    cameraSceneHash: input.cameraSource?.sceneHash ?? null,
    projectId: input.projectId,
    persistedSceneHash: persistedScene ? auditHash(persistedScene) : null,
    persistedObjectCount: persistedScene ? persistedScene.objects.length : null,
    persistedObjects: persistedScene?.objects.slice(0, 15).map(({ id, type, label }) => ({ id, type, label })) ?? [],
    compiledInputSceneHash: compilerHash,
    compiledPrimitiveHash: compiled ? auditHash(compiled.primitives.map(primitiveSignature)) : null,
    compiledPrimitiveCount: compiled?.primitives.length ?? null,
    rendererSceneHash: rendererScene ? auditHash(rendererScene) : null,
    rendererSource,
    v2DocumentOrConfigActive: isV2DocumentOrConfig(persistedRoot) || isV2DocumentOrConfig(rendererRoot),
    failedPreviewActive: input.failedPreviewActive,
    renderHistoryOverrideActive: input.renderHistoryOverrideActive,
    fixtureDebugOverrideActive: input.fixtureDebugOverrideActive || rendererSource === "fixture",
  };
}

export function hasV3RenderIdentityMismatch(identity: V3RenderIdentity): boolean {
  return identity.invariantWarnings.length > 0
    || identity.compiledInputSceneHash !== identity.rendererSceneHash
    || (identity.rendererSource === "persisted" && identity.persistedSceneHash !== identity.rendererSceneHash);
}

export function formatV3RenderIdentity(identity: V3RenderIdentity): string {
  const value = (item: string | number | null) => item ?? "unavailable";
  return [
    "V3 Render Identity",
    `projectId: ${identity.projectId}`,
    `persistedSceneHash: ${value(identity.persistedSceneHash)}`,
    `persistedObjectCount: ${value(identity.persistedObjectCount)}`,
    `persistedObjects: ${identity.persistedObjects.map((object) => `${object.id}/${object.type}/${object.label}`).join(" | ") || "none"}`,
    `compiledInputSceneHash: ${value(identity.compiledInputSceneHash)}`,
    `compiledPrimitiveHash: ${value(identity.compiledPrimitiveHash)}`,
    `compiledPrimitiveCount: ${value(identity.compiledPrimitiveCount)}`,
    `rendererSceneHash: ${value(identity.rendererSceneHash)}`,
    `rendererSource: ${identity.rendererSource}`,
    `cameraSceneHash: ${value(identity.cameraSceneHash)}`,
    `invariantWarnings: ${identity.invariantWarnings.join(", ") || "none"}`,
    `v2DocumentOrConfigActive: ${identity.v2DocumentOrConfigActive}`,
    `failedPreviewActive: ${identity.failedPreviewActive}`,
    `renderHistoryOverrideActive: ${identity.renderHistoryOverrideActive}`,
    `fixtureDebugOverrideActive: ${identity.fixtureDebugOverrideActive}`,
    hasV3RenderIdentityMismatch(identity) ? "MISMATCH: active render-source invariant failed" : "MISMATCH: none",
    identity.rendererSource !== "persisted" ? "explicit render override" : "render authority: persisted V3 scene",
  ].join("\n");
}
