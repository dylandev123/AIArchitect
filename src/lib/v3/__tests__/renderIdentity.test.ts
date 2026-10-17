import { describe, expect, it } from "vitest";
import { compileV3Scene, type V3Scene } from "../scene";
import { buildV3RenderIdentity, hasV3RenderIdentityMismatch } from "../renderIdentity";
import { useV3RenderIdentityStore } from "@/store/useV3RenderIdentityStore";

const scene = (objects: V3Scene["objects"]): V3Scene => ({
  version: 3,
  site: { width: 120, depth: 100, baseElevation: 0 },
  objects,
  relationships: [],
  metadata: {},
});

const object = (id: string, label: string, dimensions: [number, number, number], position: [number, number, number]) => ({
  id,
  type: "volume" as const,
  semanticRole: label.toLowerCase(),
  label,
  transform: { position, rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
  dimensions,
  material: { id: "stucco", color: "#d7c6af", surface: "stucco" as const },
});

const mansion = scene([
  object("mansion-main", "Mansion Main Wing", [36, 10, 18], [0, 5, 0]),
  object("mansion-west-wing", "Mansion West Wing", [22, 8, 14], [-27, 4, 3]),
  object("mansion-east-wing", "Mansion East Wing", [24, 8, 15], [28, 4, -2]),
]);
const simpleHouse = scene([object("simple-house-main", "Simple Rectangular House", [18, 7, 12], [0, 3.5, 0])]);
const rootJson = (v3Scene: V3Scene) => JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene });

describe("V3 render identity", () => {
  it("distinguishes a multi-wing mansion from a simple rectangular house and replaces the active identity on project switch", () => {
    const mansionIdentity = buildV3RenderIdentity({
      projectId: "project-a-mansion",
      persistedJson: rootJson(mansion),
      rendererJson: rootJson(mansion),
      failedPreviewActive: false,
      renderHistoryOverrideActive: false,
      fixtureDebugOverrideActive: false,
    });
    const simpleHouseIdentity = buildV3RenderIdentity({
      projectId: "project-b-simple-house",
      persistedJson: rootJson(simpleHouse),
      rendererJson: rootJson(simpleHouse),
      failedPreviewActive: false,
      renderHistoryOverrideActive: false,
      fixtureDebugOverrideActive: false,
    });

    // Each normal V3 render has one authority, while A and B must be distinct.
    expect(hasV3RenderIdentityMismatch(mansionIdentity)).toBe(false);
    expect(hasV3RenderIdentityMismatch(simpleHouseIdentity)).toBe(false);
    expect(mansionIdentity.persistedSceneHash).not.toBe(simpleHouseIdentity.persistedSceneHash);
    expect(mansionIdentity.compiledInputSceneHash).not.toBe(simpleHouseIdentity.compiledInputSceneHash);
    expect(mansionIdentity.rendererSceneHash).not.toBe(simpleHouseIdentity.rendererSceneHash);
    expect(mansionIdentity.compiledPrimitiveHash).not.toBe(simpleHouseIdentity.compiledPrimitiveHash);

    useV3RenderIdentityStore.getState().setIdentity(mansionIdentity);
    expect(useV3RenderIdentityStore.getState().identity?.projectId).toBe("project-a-mansion");
    useV3RenderIdentityStore.getState().setIdentity(simpleHouseIdentity);
    expect(useV3RenderIdentityStore.getState().identity).toMatchObject({
      projectId: "project-b-simple-house",
      rendererSceneHash: simpleHouseIdentity.rendererSceneHash,
    });

    // The B renderer's complete primitive input contains B's house and none of
    // A's unique wings: switching cannot leave an A scene mounted in the B set.
    const activePrimitiveIds = compileV3Scene(simpleHouse).primitives.map((primitive) => primitive.id);
    expect(activePrimitiveIds).toContain("simple-house-main");
    expect(activePrimitiveIds).not.toContain("mansion-main");
    expect(activePrimitiveIds).not.toContain("mansion-west-wing");
    expect(activePrimitiveIds).not.toContain("mansion-east-wing");
  });
});
