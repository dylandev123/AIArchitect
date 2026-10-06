import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { compileArchitecture } from "../compiler";
import { editableSceneTargets, executeSceneEditPlan, sceneEditPlanSchema, sceneOperationTargets, targetCatalog, type SceneEditState } from "../sceneOperations";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";

const sitePlan = {
  entrance: { wall: "north" as const, offset: 6 }, driveway: { wall: "north" as const, offset: 2, width: 4, length: 12 }, parking: [{ x: 0, z: -18, width: 6, depth: 6 }],
  pool: { wall: "south" as const, offset: 5, distance: 8, width: 8, depth: 4, waterDepth: 1.4 }, terrace: { wall: "south" as const, offset: 3, width: 10, depth: 5 }, poolDeck: { x: 0, z: 16, width: 12, depth: 8 },
  paths: [{ from: "arrival" as const, to: "parking" as const, x1: 0, z1: -30, x2: 0, z2: -18, width: 1, bend: 0, surface: "gravel" as const }],
  landscape: [{ purpose: "pool-planting" as const, kind: "garden" as const, x: 16, z: 16, width: 6, depth: 6 }, { purpose: "view-framing" as const, kind: "lawn" as const, x: -16, z: 16, width: 6, depth: 6 }],
};
const asset: OutdoorAssetPlacement = { id: "seat-1", assetId: "proxy-seat", parentSpaceId: "garden", category: "furniture", position: [2, 0, 12], rotation: [0, 0, 0], scale: 1, role: "seat", dimensions: { width: 1, depth: 1, height: 1 } };
const state = (): SceneEditState => ({ document: structuredClone(ARCHITECTURE_FIXTURES.cantileverHouse), sitePlan: structuredClone(sitePlan), outdoorAssetPlacements: [structuredClone(asset)] });

describe("general V2 scene edit operations", () => {
  it("exposes persistent assets as semantic stable targets and preserves them through a JSON reload", () => {
    const before = state();
    before.outdoorAssetPlacements = [...before.outdoorAssetPlacements!, { ...asset, id: "glb-seat-1", assetId: "approved-chair-glb", role: "chair" }];
    const target = editableSceneTargets(before).find((entry) => entry.id === "asset:seat-1");
    expect(target).toMatchObject({ id: "asset:seat-1", semanticType: "asset", label: "seat", transform: { position: [2, 0, 12], rotation: [0, 0, 0], scale: 1, dimensions: [1, 1, 1] }, source: { assetId: "proxy-seat" } });
    expect(sceneOperationTargets(before)).toContain("asset:seat-1");
    expect(editableSceneTargets(before)).toContainEqual(expect.objectContaining({ id: "asset:glb-seat-1", source: { assetId: "approved-chair-glb", kind: "furniture" } }));
    expect(JSON.parse(JSON.stringify(before)).outdoorAssetPlacements.map((placement: OutdoorAssetPlacement) => placement.id)).toEqual(["seat-1", "glb-seat-1"]);
  });

  it("uses one canonical catalog for advertised and executable persistent target ids", () => {
    const before = state();
    const catalog = targetCatalog(before);
    expect(sceneOperationTargets(before)).toEqual(catalog.map((target) => target.id));
    const advertised = catalog.find((target) => target.id === "asset:seat-1");
    expect(advertised).toMatchObject({
      id: "asset:seat-1", kind: "asset", persistentReference: "seat-1",
      hostOrSupport: undefined, capabilities: expect.arrayContaining(["move", "rotate"]),
    });
    const executed = executeSceneEditPlan(before, { intent: "Move the exact advertised asset id.", operations: [
      { op: "move", target: advertised!.id, position: [0, 0, 8] },
    ] });
    expect(executed.ok).toBe(true);
    expect(executed.outdoorAssetPlacements[0].id).toBe("seat-1");
  });

  it("moves, rotates, resizes, recolors, and deletes persistent assets without changing unrelated assets", () => {
    const before = state();
    before.outdoorAssetPlacements = [...before.outdoorAssetPlacements!, { ...asset, id: "seat-2", position: [8, 0, 12] }];
    const changed = executeSceneEditPlan(before, { intent: "edit one persistent asset", operations: [
      { op: "move", target: "asset:seat-1", position: [0, 8, 16] },
      { op: "rotate", target: "asset:seat-1", rotation: [0, 1.2, 0] },
      { op: "resize", target: "asset:seat-1", size: [1.5, 1.2, .8] },
      { op: "changeMaterial", target: "asset:seat-1", material: { color: "#445566", roughness: .7 } },
    ] });
    expect(changed.ok).toBe(true);
    expect(changed.outdoorAssetPlacements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "seat-1", position: [0, 0, 16], rotation: [0, 1.2, 0], dimensions: { width: 1.5, height: 1.2, depth: .8 }, material: { color: "#445566", roughness: .7 }, support: { kind: "deck", elevation: 0 } }),
      expect.objectContaining({ id: "seat-2", position: [8, 0, 12] }),
    ]));
    const deleted = executeSceneEditPlan(changed, { intent: "remove persistent asset", operations: [{ op: "delete", target: "asset:seat-1" }] });
    expect(deleted.ok).toBe(true);
    expect(deleted.outdoorAssetPlacements.map((placement) => placement.id)).toEqual(["seat-2"]);
  });

  it("grounds a moved asset on the selected patio and rolls every asset mutation back when a target is invalid", () => {
    const before = state();
    const grounded = executeSceneEditPlan(before, { intent: "move to patio", operations: [{ op: "move", target: "asset:seat-1", position: [0, 99, 8] }] });
    expect(grounded.ok).toBe(true);
    expect(grounded.outdoorAssetPlacements[0]).toMatchObject({ position: [0, 0, 8], support: { kind: "patio", elevation: 0 } });
    const rejected = executeSceneEditPlan(before, { intent: "atomic asset move", operations: [
      { op: "move", target: "asset:seat-1", position: [0, 99, 8] },
      { op: "rotate", target: "asset:not-real", rotation: [0, 1, 0] },
    ] });
    expect(rejected.ok).toBe(false);
    expect(rejected.outdoorAssetPlacements).toEqual(before.outdoorAssetPlacements);
  });
  it("accepts an evidence-backed already-satisfied plan without changing the saved world", () => {
    const before = state();
    const plan = { intent: "Confirm the requested condition.", status: "already-satisfied" as const, rationale: "The requested semantic assembly already exists on the authoritative target.", operations: [] };
    expect(sceneEditPlanSchema.safeParse(plan).success).toBe(true);
    const result = executeSceneEditPlan(before, plan);
    expect(result.ok).toBe(true);
    expect(result.document).toEqual(before.document);
    expect(result.sitePlan).toEqual(before.sitePlan);
  });

  it("accepts a capability need without operations but rejects unsupported empty plans", () => {
    const capabilityPlan = { intent: "Create a form outside the available vocabulary.", status: "capability-needed" as const, operations: [], capabilityNeeds: [{ capability: "curved-shell", reason: "The available primitives cannot form a continuous curved shell." }] };
    expect(sceneEditPlanSchema.safeParse(capabilityPlan).success).toBe(true);
    const result = executeSceneEditPlan(state(), capabilityPlan);
    expect(result.ok).toBe(true);
    expect(result.capabilityNeeds).toEqual(capabilityPlan.capabilityNeeds);
    expect(sceneEditPlanSchema.safeParse({ intent: "Missing evidence.", operations: [] }).success).toBe(false);
    expect(executeSceneEditPlan(state(), { intent: "Missing evidence.", operations: [] }).ok).toBe(false);
  });

  it("accepts every operation variant through the structured-output wire schema", () => {
    const plan = {
      intent: "Exercise every generic operation.",
      operations: [
        { op: "create", object: { kind: "assembly", massId: "tower", assembly: { id: "portico", intent: "hosted construction", parts: [{ id: "slab", type: "slab", facade: "north", start: .3, end: .7, depth: 1, host: { kind: "entrance", facade: "north" } }] } } },
        { op: "create", object: { kind: "scene", scene: { id: "marker", kind: "post", label: "Marker", position: [1, 0, 2], rotation: [0, .2, 0], size: [.2, 2, .2] } } },
        { op: "delete", target: "scene:marker" },
        { op: "move", target: "site:poolDeck", position: [2, 0, 14] },
        { op: "rotate", target: "scene:marker", rotation: [0, .4, 0] },
        { op: "resize", target: "part:tower:portico:slab", size: [2, .2, 2] },
        { op: "changeMaterial", target: "mass:tower", material: { color: "#234567", roughness: .6 } },
        { op: "attach", target: "scene:marker", host: { kind: "mass", massId: "tower", anchor: "roof" } },
        { op: "detach", target: "scene:marker" },
        { op: "duplicate", target: "scene:marker", id: "marker-copy", position: [2, 0, 2] },
        { op: "extrude", target: "mass:tower", intent: "future curved extrusion" },
        { op: "cut", target: "mass:tower", intent: "future angled cut" },
      ],
      siteReflow: { elements: [{ id: "site:poolDeck", action: "move", dependsOn: "mass:tower", reason: "Maintain clearance." }] },
      capabilityNeeds: [{ capability: "extrude", reason: "Future geometry capability." }],
    };
    expect(sceneEditPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("composes hosted construction and freestanding boundaries without feature-specific branches", () => {
    const result = executeSceneEditPlan(state(), { intent: "add exterior construction", operations: [
      { op: "create", object: { kind: "assembly", massId: "tower", assembly: { id: "upper-edge", intent: "exterior platform", parts: [
        { id: "deck", type: "slab", facade: "north", start: .3, end: .7, depth: 1.4, host: { kind: "floor", level: 1 } },
        { id: "edge", type: "railing", slabId: "deck", edges: ["outer", "start", "end"], height: 1.05 },
      ] } } },
      { op: "create", object: { kind: "assembly", massId: "tower", assembly: { id: "entry-frame", intent: "entrance shade", parts: [
        { id: "left", type: "post", facade: "north", at: .35, depth: 1.6, host: { kind: "entrance", facade: "north" }, height: 2.7 },
        { id: "header", type: "beam", facade: "north", start: .35, end: .65, depth: 1.6, host: { kind: "entrance", facade: "north" }, height: .25 },
      ] } } },
      { op: "create", object: { kind: "scene", scene: { id: "boundary-post-a", kind: "post", label: "Boundary post", position: [12, 1, 10], size: [.2, 2, .2], material: { color: "#333333" } } } },
      { op: "create", object: { kind: "scene", scene: { id: "boundary-rail", kind: "beam", label: "Boundary rail", position: [14, 1.6, 10], size: [4, .15, .15] } } },
    ] });
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.document.massing.masses[0].assemblies).toHaveLength(2);
    expect(result.document.sceneObjects?.map((o) => o.kind)).toEqual(["post", "beam"]);
    expect(compileArchitecture(result.document, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives.some((p) => p.id === "scene-boundary-rail")).toBe(true);
  });

  it("targets only operated elements across resize, reflow, material, move, delete and persistence", () => {
    const initial = state();
    const withSlab = executeSceneEditPlan(initial, { intent: "prepare edit targets", operations: [
      { op: "create", object: { kind: "assembly", massId: "tower", assembly: { id: "entry", intent: "entry element", parts: [{ id: "cover", type: "slab", facade: "north", start: .4, end: .6, depth: 1, host: { kind: "entrance", facade: "north" } }] } } },
      { op: "create", object: { kind: "scene", scene: { id: "marker", kind: "surface", label: "Marker", position: [1, .1, 1], size: [1, .1, 1] } } },
    ] });
    if (!withSlab.ok) throw new Error(withSlab.errors.join("; "));
    const beforeUnrelatedMass = JSON.stringify(withSlab.document.massing.masses[0].openings);
    const result = executeSceneEditPlan({ ...withSlab, outdoorAssetPlacements: withSlab.outdoorAssetPlacements }, { intent: "targeted edit", operations: [
      { op: "resize", target: "part:tower:entry:cover", size: [2, .25, 2] },
      { op: "move", target: "site:landscape:pool-planting:0", position: [18, 0, 17] },
      { op: "changeMaterial", target: "mass:tower", material: { color: "#174f3d", roughness: .7 } },
      { op: "move", target: "asset:seat-1", position: [3, 0, 14] },
      { op: "move", target: "scene:marker", position: [2, .1, 2] },
      { op: "delete", target: "scene:marker" },
    ] });
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.document.massing.masses[0].assemblies?.[0].parts[0]).toMatchObject({ depth: 2, thickness: .25 });
    expect(result.sitePlan.landscape[0]).toMatchObject({ x: 18, z: 17 });
    expect(result.outdoorAssetPlacements[0].position).toEqual([3, 0, 14]);
    expect(result.document.sceneObjects).toEqual([]);
    expect(result.document.materialOverrides).toContainEqual({ target: "mass:tower", material: { color: "#174f3d", roughness: .7 } });
    expect(compileArchitecture(result.document, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives.some((p) => p.id.startsWith("architecture-tower-") && p.color === "#174f3d")).toBe(true);
    expect(JSON.stringify(result.document.massing.masses[0].openings)).toBe(beforeUnrelatedMass);
    expect(JSON.parse(JSON.stringify(result.document))).toEqual(result.document);
  });

  it("rejects nonexistent targets and never applies a partial edit", () => {
    const before = state();
    const result = executeSceneEditPlan(before, { intent: "invalid edit", operations: [
      { op: "create", object: { kind: "scene", scene: { id: "would-exist", kind: "post", label: "Post", position: [0, 1, 0], size: [.2, 2, .2] } } },
      { op: "delete", target: "scene:not-here" },
    ] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/nonexistent/);
    expect(result.document).toEqual(before.document);
  });

  it("records an unmet capability without inventing unrelated geometry", () => {
    const result = executeSceneEditPlan(state(), { intent: "complex hollow form", operations: [{ op: "extrude", target: "mass:tower", intent: "curved hollow extrusion" }] });
    expect(result.ok).toBe(true);
    expect(result.capabilityNeeds).toEqual([{ capability: "extrude", reason: "curved hollow extrusion" }]);
    expect(result.document).toEqual(state().document);
  });
});
