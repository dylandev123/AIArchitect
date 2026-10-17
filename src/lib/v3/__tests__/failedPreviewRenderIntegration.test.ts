import { afterEach, describe, expect, it } from "vitest";
import { compileV3Scene, type V3Scene, type V3SceneObject } from "../scene";
import { computeV3CameraFit, getV3PresentationBounds } from "../presentation";
import { resolveActiveV3RenderSource } from "../activeRenderSource";
import { buildV3RenderIdentity } from "../renderIdentity";
import { useV3FailedPreviewStore } from "@/store/useV3FailedPreviewStore";

const object = (index: number): V3SceneObject => ({
  id: `mansion-part-${index}`,
  type: index < 3 ? "building-mass" : "volume",
  semanticRole: index < 3 ? "mansion wing" : "estate detail",
  label: `Mansion part ${index}`,
  transform: { position: [480 + index * 3, 8, -360 + (index % 4) * 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
  dimensions: index < 3 ? [18, 16, 14] : [2, 2, 2],
  material: { id: "stone", color: "#817a70", surface: "stone" },
  ...(index < 3 ? { levels: 5 } : {}),
});

const scene = (objects: V3SceneObject[]): V3Scene => ({
  // The mansion is deliberately far from origin while the terrain remains
  // compact, keeping this integration test focused on source selection.
  version: 3, site: { width: 180, depth: 180 }, objects, relationships: [], metadata: {},
});
const rootJson = (v3Scene: V3Scene) => JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene });

describe("failed preview active render integration", () => {
  afterEach(() => useV3FailedPreviewStore.getState().clear());

  it("uses the same active preview source for renderer input, identity, presentation bounds, camera target, and clear", () => {
    const projectId = "failed-preview-project";
    const persisted = scene([]);
    const preview = scene(Array.from({ length: 39 }, (_, index) => object(index)));
    const persistedJson = rootJson(persisted);
    const candidate = { scene: preview, diagnostics: { strictValidationErrors: [], skippedObjectIds: [], skippedRelationshipIds: [], unsupportedObjectIds: [], unresolvedSupportObjectIds: [], normalizedFields: [], renderWarnings: [] } };
    useV3FailedPreviewStore.getState().capture(projectId, candidate);

    const before = resolveActiveV3RenderSource({ projectId, persistedJson, rendererJson: persistedJson, failedPreviewCandidate: useV3FailedPreviewStore.getState().candidate, failedPreviewActive: useV3FailedPreviewStore.getState().active });
    expect(before.source).toBe("persisted");

    // This is the exact state transition the Render failed Terra preview button invokes.
    useV3FailedPreviewStore.getState().render(projectId);
    const active = resolveActiveV3RenderSource({ projectId, persistedJson, rendererJson: persistedJson, failedPreviewCandidate: useV3FailedPreviewStore.getState().candidate, failedPreviewActive: useV3FailedPreviewStore.getState().active });
    const compiled = compileV3Scene(active.scene!);
    const bounds = getV3PresentationBounds(active.scene!, compiled);
    const camera = computeV3CameraFit(bounds);
    const identity = buildV3RenderIdentity({ projectId, persistedJson, rendererJson: persistedJson, failedPreviewScene: active.scene, failedPreviewActive: active.source === "failed-preview", renderHistoryOverrideActive: false, fixtureDebugOverrideActive: false });

    expect(active.source).toBe("failed-preview");
    expect(active.scene?.objects).toHaveLength(39);
    expect(compiled.primitives.length).toBeGreaterThan(1);
    expect(bounds.center[0]).toBeGreaterThan(400);
    expect(bounds.center[2]).toBeLessThan(-300);
    expect(camera.target.x).toBeGreaterThan(400);
    expect(camera.target.z).toBeLessThan(-300);
    expect(identity).toMatchObject({ failedPreviewActive: true, rendererSource: "failed-preview", rendererSceneHash: identity.compiledInputSceneHash, compiledPrimitiveCount: expect.any(Number) });
    expect(identity.rendererSceneHash).not.toBe(identity.persistedSceneHash);
    expect(identity.compiledPrimitiveCount).toBeGreaterThan(1);

    useV3FailedPreviewStore.getState().clear();
    const after = resolveActiveV3RenderSource({ projectId, persistedJson, rendererJson: persistedJson, failedPreviewCandidate: useV3FailedPreviewStore.getState().candidate, failedPreviewActive: useV3FailedPreviewStore.getState().active });
    expect(after.source).toBe("persisted");
    expect(after.scene?.objects).toHaveLength(0);
  });
});
