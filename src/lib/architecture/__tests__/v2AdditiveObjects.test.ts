import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { compileArchitecture } from "../compiler";
import { placeV2AdditiveAsset } from "../v2AdditivePlacement";
import { classifyAdditiveRequest, replaceProxyPlacement, substituteApprovedProxies } from "../v2AdditiveObjects";
import { placementBounds, type OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { proxyParts } from "@/lib/outdoor/proxyShapes";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { CuratedAsset } from "@/types/assets";

const plan = {
  entrance: { wall: "north" as const, offset: 6 }, driveway: { wall: "north" as const, offset: 2, width: 4, length: 12 }, parking: [{ x: 0, z: -18, width: 6, depth: 6 }],
  pool: { wall: "south" as const, offset: 5, distance: 8, width: 8, depth: 4, waterDepth: 1.4 }, terrace: { wall: "south" as const, offset: 3, width: 10, depth: 5 }, poolDeck: { x: 0, z: 16, width: 12, depth: 8 },
  paths: [{ from: "arrival" as const, to: "parking" as const, x1: 0, z1: -30, x2: 0, z2: -18, width: 1, bend: 0, surface: "gravel" as const }],
  landscape: [{ purpose: "pool-planting" as const, kind: "garden" as const, x: 16, z: 16, width: 6, depth: 6 }, { purpose: "view-framing" as const, kind: "lawn" as const, x: -16, z: 16, width: 6, depth: 6 }],
};
const document = ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse;
const existingChair: OutdoorAssetPlacement = { id: "outdoor-v2-existing", assetId: "procedural-v2-chair", parentSpaceId: "v2-poolside", category: "furniture", position: [7.95, 0, 16], rotation: [0, -Math.PI / 2, 0], scale: 1, role: "lounge-armchair", relationship: { type: "around", targetId: "pool" }, dimensions: { width: .9, depth: .9, height: .8 }, localBounds: { min: [-.45, 0, -.45], max: [.45, .8, .45] }, support: { kind: "terrain", elevation: 0 } };
/** A legacy single-house shell that disagrees with the V2 masses: a rooftop object must never use it. */
const projectRoot = () => ({ house: { width: 30, depth: 20, floors: 2, roof: "flat" }, architecturalDesignDocument: structuredClone(document), sitePlan: structuredClone(plan), outdoorAssetPlacements: [structuredClone(existingChair)] });
const GAZEBO_PROMPT = "Add a modern rooftop gazebo toward the rear side of the main roof.";
const chairGlb = { id: "chair-glb", name: "Pool lounge chair", type: "glb-model", status: "approved", validation: { passed: true }, categories: ["furniture"], tags: ["chair", "poolside"], family: "furniture" } as CuratedAsset;
const gazeboGlb = { id: "gazebo-glb", name: "Modern teak gazebo", type: "glb-model", status: "approved", family: "gazebo", tags: ["gazebo"], validation: { passed: true, bounds: { min: [-1, -.2, -1.5], max: [2, 2.8, 1.5] } } } as unknown as CuratedAsset;

function placeGazebo(root = projectRoot()) {
  const result = placeV2AdditiveAsset(root, GAZEBO_PROMPT, [], []);
  if (!result.ok) throw new Error(result.error);
  const next = JSON.parse(result.json);
  return { result, next, gazebo: next.outdoorAssetPlacements.at(-1) as OutdoorAssetPlacement };
}

describe("standalone additive objects: approved GLB, else procedural proxy", () => {
  it("leaves the existing approved-chair path exactly as it was (no proxy, no intent, same anchor/role)", () => {
    const root = { architecturalDesignDocument: document, sitePlan: plan };
    const result = placeV2AdditiveAsset(root, "add a lounge chair by the pool", [chairGlb], [chairGlb.id]);
    expect(result).toMatchObject({ ok: true, object: "chair", assetId: "chair-glb", usedProceduralFallback: false });
    if (!result.ok) throw new Error(result.error);
    expect("placementIds" in result).toBe(false);
    const [chair] = JSON.parse(result.json).outdoorAssetPlacements;
    expect(Object.keys(chair).sort()).toEqual(["assetId", "category", "dimensions", "id", "localBounds", "parentSpaceId", "position", "relationship", "role", "rotation", "scale", "support"]);
    expect(chair).toMatchObject({ assetId: "chair-glb", parentSpaceId: "v2-poolside", role: "lounge-armchair", relationship: { type: "around", targetId: "pool" }, support: { kind: "terrain", elevation: 0 } });
  });

  it("no longer refuses a rooftop gazebo just because no gazebo GLB exists", () => {
    const { result } = placeGazebo();
    expect(result).toMatchObject({ ok: true, object: "gazebo", assetId: "procedural-v2-gazebo", usedProceduralFallback: true });
  });

  it("draws a missing gazebo as a recognizable four-post proxy with beams and a roof", () => {
    const { gazebo } = placeGazebo();
    expect(gazebo.proxy).toMatchObject({ shape: "post-frame", canopy: "solid", objectType: "gazebo", label: "gazebo", requestText: GAZEBO_PROMPT });
    const parts = proxyParts(gazebo.proxy!.shape, gazebo.dimensions, gazebo.proxy!.canopy);
    const posts = parts.filter((p) => p.name.startsWith("post-"));
    expect(posts).toHaveLength(4);
    // One post per corner, all standing on the proxy's local floor and reaching the eave.
    expect(new Set(posts.map((p) => `${Math.sign(p.position[0])},${Math.sign(p.position[2])}`)).size).toBe(4);
    expect(posts.every((p) => Math.abs(p.position[1] - p.size[1] / 2) < 1e-9)).toBe(true);
    expect(parts.filter((p) => p.name.startsWith("beam-"))).toHaveLength(4);
    const roof = parts.find((p) => p.name === "roof")!;
    expect(roof.position[1] + roof.size[1] / 2).toBeCloseTo(gazebo.dimensions.height);
  });

  it("stands on the compiled V2 main roof (not the legacy house shell), toward the rear, grounded on the roof plane", () => {
    const { gazebo } = placeGazebo();
    const living = document.massing.masses.find((m) => m.id === "living")!;
    const plane = compileArchitecture(document, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives.find((p) => p.id === "architecture-living-roof-plane")!;
    if (plane.kind !== "box") throw new Error("fixture's flat roof plane is a box");
    const roofTop = plane.position[1] + plane.size[1] / 2;
    const b = placementBounds(gazebo);
    expect(gazebo.support).toEqual({ kind: "roof", elevation: roofTop, massId: "living" });
    expect(gazebo.parentSpaceId).toBe("v2-roof-living");
    // Grounded: the proxy's local floor sits exactly on the roof plane — a 2-floor legacy shell would put it ~6 m up.
    expect(b.y).toBeCloseTo(roofTop);
    expect(roofTop).toBeLessThan(5);
    // Inside the main mass's own footprint with edge clearance, and on its rear (arrival is north, so rear is +z).
    expect(Math.abs(b.x - living.position.x) + b.w / 2).toBeLessThanOrEqual(living.width / 2);
    expect(Math.abs(b.z - living.position.z) + b.d / 2).toBeLessThanOrEqual(living.depth / 2);
    expect(b.z).toBeGreaterThan(living.position.z);
    expect(gazebo.rotation).toEqual([0, living.rotation, 0]);
  });

  it("gives the proxy a stable placement identity and intended bounds a replacement can reuse", () => {
    const { result, gazebo } = placeGazebo();
    if (!result.ok || !("placementIds" in result)) throw new Error("expected a standalone placement");
    expect(result.placementIds).toEqual([gazebo.id]);
    expect(gazebo.id).toMatch(/^outdoor-v2-/);
    expect(gazebo.dimensions).toEqual({ width: 3.6, depth: 3.6, height: 2.9 });
    expect(gazebo.localBounds).toEqual({ min: [-1.8, 0, -1.8], max: [1.8, 2.9, 1.8] });
    expect(gazebo.intent).toMatchObject({ surface: "roof", massId: "living", side: "rear", yaw: 0, dimensions: { width: 3.6, depth: 3.6, height: 2.9 } });
    const b = placementBounds(gazebo);
    expect(gazebo.intent!.centre.x).toBeCloseTo(b.x);
    expect(gazebo.intent!.centre.z).toBeCloseTo(b.z);
    expect(result.needRequest).toMatchObject({ category: "gazebo", styleTags: ["modern"], contextTags: expect.arrayContaining(["rooftop"]), dimensions: { width: 3.6, depth: 3.6, height: 2.9 }, components: ["gazebo"], source: "follow-up-edit", proxyInUse: true, aliases: expect.arrayContaining(["gazebo"]) });
  });

  it("survives a save/reload JSON round trip unchanged", () => {
    const { result, next } = placeGazebo();
    const reloaded = JSON.parse(JSON.stringify(JSON.parse(result.json)));
    expect(reloaded.outdoorAssetPlacements).toEqual(next.outdoorAssetPlacements);
    // A later additive edit on the reloaded project keeps the proxy byte-for-byte.
    const after = placeV2AdditiveAsset(reloaded, "add a fire pit in the garden", [], []);
    if (!after.ok) throw new Error(after.error);
    expect(JSON.stringify(JSON.parse(after.json).outdoorAssetPlacements.slice(0, 2))).toBe(JSON.stringify(next.outdoorAssetPlacements));
  });

  it("lets a later approved GLB take over the proxy's exact placement without another edit", () => {
    const { next, gazebo } = placeGazebo();
    const before = placementBounds(gazebo);
    const swapped = substituteApprovedProxies(next, [gazeboGlb], [gazeboGlb.id]);
    expect(swapped.replaced).toEqual([gazebo.id]);
    const after = JSON.parse(swapped.json);
    const replaced = after.outdoorAssetPlacements.find((p: OutdoorAssetPlacement) => p.id === gazebo.id) as OutdoorAssetPlacement;
    expect(replaced.assetId).toBe("gazebo-glb");
    expect(replaced.proxy).toBeUndefined();
    expect(replaced.intent).toEqual(gazebo.intent);
    expect(replaced.support).toEqual(gazebo.support);
    expect(replaced.rotation).toEqual(gazebo.rotation);
    expect(replaced.localBounds).toEqual(gazeboGlb.validation!.bounds);
    // Same logical placement: the off-centre, below-origin model is re-centred on the intent and grounded on the roof.
    const b = placementBounds(replaced);
    expect(b.x).toBeCloseTo(before.x);
    expect(b.z).toBeCloseTo(before.z);
    expect(b.y).toBeCloseTo(gazebo.support!.elevation);
    expect(replaced.dimensions.width).toBeCloseTo(3.6);
    // Nothing else was touched.
    expect(after.outdoorAssetPlacements[0]).toEqual(existingChair);
    expect(after.architecturalDesignDocument).toEqual(next.architecturalDesignDocument);
    expect(replaceProxyPlacement(existingChair, gazeboGlb)).toBe(existingChair);
  });

  it("leaves the architectural document, Site Plan, legacy fields and existing assets byte-for-byte unchanged", () => {
    const root = projectRoot();
    const before = JSON.stringify(root);
    const { next } = placeGazebo(root);
    expect(JSON.stringify(root)).toBe(before);
    expect(JSON.stringify(next.architecturalDesignDocument)).toBe(JSON.stringify(document));
    expect(JSON.stringify(next.sitePlan)).toBe(JSON.stringify(plan));
    expect(JSON.stringify(next.house)).toBe(JSON.stringify(root.house));
    expect(JSON.stringify(next.outdoorAssetPlacements[0])).toBe(JSON.stringify(existingChair));
    expect(Object.keys(next).sort()).toEqual(Object.keys(root).sort());
  });

  it("uses an approved gazebo GLB directly when one exists", () => {
    const result = placeV2AdditiveAsset(projectRoot(), GAZEBO_PROMPT, [gazeboGlb], [gazeboGlb.id]);
    expect(result).toMatchObject({ ok: true, assetId: "gazebo-glb", usedProceduralFallback: false, needRequest: undefined });
    if (!result.ok) throw new Error(result.error);
    const placed = JSON.parse(result.json).outdoorAssetPlacements.at(-1) as OutdoorAssetPlacement;
    expect(placed.proxy).toBeUndefined();
    expect(placementBounds(placed).y).toBeCloseTo(placed.support!.elevation);
  });

  it("refuses rather than relocating: a pitched roof, an unresolvable location, or an object too large for the roof", () => {
    const hipped = { architecturalDesignDocument: ARCHITECTURE_FIXTURES.lShapedTropicalHouse, sitePlan: plan };
    expect(placeV2AdditiveAsset(hipped, GAZEBO_PROMPT, [], [])).toMatchObject({ ok: false, code: "NO_FLAT_ROOF" });
    expect(placeV2AdditiveAsset(projectRoot(), "add a gazebo near the guest house gate", [], [])).toMatchObject({ ok: false, code: "UNSUPPORTED_LOCATION" });
    expect(placeV2AdditiveAsset(projectRoot(), "add a 12m x 12m gazebo on the main roof", [], [])).toMatchObject({ ok: false, code: "DOES_NOT_FIT" });
  });
});

describe("architectural-edit boundary", () => {
  it.each([
    "add another bedroom",
    "make the roof larger",
    "add a balcony",
    "add windows to the living pavilion",
    "add a second storey",
    "extend the terrace",
    "deepen the recess",
    "add a gazebo and another bedroom",
  ])("never enters the object/proxy path: %s", (prompt) => {
    const root = projectRoot();
    const before = JSON.stringify(root);
    const result = placeV2AdditiveAsset(root, prompt, [], []);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: expect.stringMatching(/^(ARCHITECTURAL_EDIT|NOT_ADDITIVE)$/) });
    expect("json" in result).toBe(false);
    expect(JSON.stringify(root)).toBe(before);
  });

  it("reads location phrases as locations, not as the thing being added", () => {
    expect(classifyAdditiveRequest(GAZEBO_PROMPT)).toEqual({ kind: "standalone", object: "gazebo" });
    expect(classifyAdditiveRequest("add a bench by the bedroom wing")).toEqual({ kind: "standalone", object: "bench" });
    expect(classifyAdditiveRequest("add an outdoor kitchen on the roof")).toEqual({ kind: "standalone", object: "outdoor-kitchen" });
    expect(classifyAdditiveRequest("add a pergola with a slatted roof")).toEqual({ kind: "standalone", object: "pergola" });
    expect(classifyAdditiveRequest("add a lounge chair by the pool")).toEqual({ kind: "existing" });
    expect(classifyAdditiveRequest("add 2 pool loungers")).toEqual({ kind: "existing" });
    expect(classifyAdditiveRequest("add a pool bar")).toEqual({ kind: "existing" });
    expect(classifyAdditiveRequest("add another bedroom")).toMatchObject({ kind: "architectural" });
    expect(classifyAdditiveRequest("add a kitchen")).toMatchObject({ kind: "architectural" });
  });
});
