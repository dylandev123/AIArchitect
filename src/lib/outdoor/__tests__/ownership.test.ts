import { describe, expect, it } from "vitest";
import { persistentFurniturePlacements } from "@/lib/landscaping/furniture";
import { appendTombstone, materializeGeneratedAssets, sourceIsSuppressed } from "../ownership";
import { auditAssetSupport } from "../support";
import { executeSceneEditPlan, targetCatalog } from "@/lib/architecture/sceneOperations";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import type { SiteConfig } from "@/types/house";

const site = {
  house: { width: 12, depth: 10, center: { x: 0, z: 0 } }, patios: [{ wall: "south" as const, offset: 0, width: 6, depth: 4 }], balconies: [], decks: [], pools: [],
} as unknown as SiteConfig;
const plan = {
  entrance: { wall: "north" as const, offset: 2 }, driveway: { wall: "north" as const, offset: 2, width: 3, length: 8 }, parking: [],
  pool: { wall: "south" as const, offset: 0, distance: 8, width: 4, depth: 2, waterDepth: 1 }, terrace: { wall: "south" as const, offset: 0, width: 12, depth: 5 }, poolDeck: { x: 0, z: 14, width: 8, depth: 4 }, paths: [], landscape: [],
};

describe("renderer-derived asset ownership", () => {
  it("uses semantic source ids rather than positions and never renders a materialized source twice", () => {
    const generated = persistentFurniturePlacements(site);
    const moved = { ...generated[0], position: [50, 0, 50] as [number, number, number] };
    const persisted = materializeGeneratedAssets([], [moved]);
    expect(sourceIsSuppressed(generated[0], persisted)).toBe(true);
    expect(sourceIsSuppressed(generated[1], persisted)).toBe(false);
    expect(materializeGeneratedAssets(persisted, generated).filter((asset) => asset.source?.semanticId === generated[0].source?.semanticId)).toHaveLength(1);
    const migrated = materializeGeneratedAssets([{ ...generated[0], source: undefined, position: [99, 0, 99] }], generated);
    expect(migrated[0].source?.semanticId).toBe(generated[0].id);
  });

  it("keeps a deleted generated source suppressed through a reload", () => {
    const generated = persistentFurniturePlacements(site);
    const tombstones = appendTombstone([], generated[0]);
    const reloaded = JSON.parse(JSON.stringify(tombstones));
    expect(sourceIsSuppressed(generated[0], [], reloaded)).toBe(true);
  });

  it("moves and rotates a persistent group around its anchor while retaining member-relative transforms", () => {
    const generated = persistentFurniturePlacements(site);
    const group = generated[0].group!;
    const state = { document: structuredClone(ARCHITECTURE_FIXTURES.cantileverHouse), sitePlan: structuredClone(plan), outdoorAssetPlacements: generated };
    expect(targetCatalog(state).map((target) => target.id)).toContain(`asset-group:${group.id}`);
    const moved = executeSceneEditPlan(state, { intent: "Move generated composition", operations: [{ op: "move", target: `asset-group:${group.id}`, position: [0, 0, 8] }] });
    expect(moved.ok).toBe(true);
    const rotated = executeSceneEditPlan(moved, { intent: "Rotate generated composition", operations: [{ op: "rotate", target: `asset-group:${group.id}`, rotation: [0, Math.PI / 2, 0] }] });
    expect(rotated.ok).toBe(true);
    const chair = rotated.outdoorAssetPlacements.find((asset) => asset.group?.id === group.id && asset.group.localPosition[0] !== 0)!;
    expect(chair.group?.anchor).toEqual([0, 0, 8]);
    expect(chair.rotation[1] - chair.group!.rotation[1]).toBeCloseTo(chair.group!.localRotation[1]);
    const individuallyEdited = executeSceneEditPlan(rotated, { intent: "Move one member", operations: [{ op: "move", target: `asset:${chair.id}`, position: [2, 0, 8] }] });
    expect(individuallyEdited.ok).toBe(true);
    expect(individuallyEdited.outdoorAssetPlacements.find((asset) => asset.id === chair.id)?.group?.localPosition).not.toEqual(chair.group?.localPosition);
  });

  it("reports nonexistent executable support instead of accepting its label", () => {
    const asset = persistentFurniturePlacements(site)[0];
    expect(auditAssetSupport([{ ...asset, support: { kind: "roof", elevation: 4 } }], [{ id: "patio", kind: "patio", elevation: 0, x0: -10, x1: 10, z0: -10, z1: 10 }])).toMatchObject([{ code: "support-missing" }]);
    expect(auditAssetSupport([asset], [{ id: "patio", kind: "patio", elevation: asset.position[1], x0: -10, x1: 10, z0: -10, z1: 10 }])).toEqual([]);
  });
});
