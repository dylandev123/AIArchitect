import { describe, expect, it } from "vitest";
import { applyV3RenderDiagnostics, computeV3CameraFit, diagnoseV3Scene, getV3PresentationBounds } from "../presentation";
import { compileV3Scene, type V3Scene, type V3SceneObject } from "../scene";
import { validateV3Scene } from "../validation";
import { validateProjectJson } from "@/lib/house/validateProjectJson";
import { generateHouseFromJson } from "@/lib/house/generateHouse";

const material = { id: "m", color: "#888888" };
const obj = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<V3SceneObject> = {}): V3SceneObject =>
  ({ id, type, semanticRole: id, label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions, material, collision: "solid", ...extra });

/** 180x180 site; an ~80x60 mansion offset from the origin, with a pool, a driveway slab, and 14 unresolvable supports. */
function mansionScene(): V3Scene {
  const objects: V3SceneObject[] = [
    obj("hill", "terrain-region", [0, 0, 0], [180, 1, 180], { terrain: { operation: "slopeRegion", rise: 0, direction: "z" } }),
    obj("main", "volume", [30, 4, -20], [80, 8, 60]),
    obj("wing", "volume", [30, 3, 20], [30, 6, 20]),
    obj("pool", "pool", [60, 0, 40], [12, 1.5, 6]),
    obj("drive", "slab", [30, .05, 60], [6, .1, 30]),
  ];
  for (let i = 0; i < 36; i++) objects.push(obj(`detail-${i}`, "column", [10 + i, 4, -20], [.4, 8, .4], i < 14 ? { support: { kind: "object", hostId: `ghost-${i}`, relationship: "rests-on", grounding: "grounded" } } : {}));
  return { version: 3, site: { width: 180, depth: 180, baseElevation: 0 }, objects, relationships: [], metadata: {} };
}

describe("V3 presentation bounds and visibility", () => {
  const scene = mansionScene();

  it("frames the architecture, not the 180x180 terrain", () => {
    const bounds = getV3PresentationBounds(scene);
    expect(bounds.size[0]).toBeLessThan(120);
    expect(bounds.size[2]).toBeLessThan(130);
    expect(bounds.size[0]).toBeGreaterThan(70);
    expect(bounds.center[0]).toBeGreaterThan(20);
    const fit = computeV3CameraFit(bounds);
    expect(fit.target.x).toBeCloseTo(bounds.center[0]);
    expect(fit.target.z).toBeCloseTo(bounds.center[2]);
    const wholeSiteFit = computeV3CameraFit(getV3PresentationBounds({ ...scene, objects: [...scene.objects, obj("far", "volume", [-85, 1, -85], [4, 2, 4])] }));
    expect(wholeSiteFit.position.length()).toBeGreaterThan(fit.position.length());
  });

  it("ignores a site-sized ground slab when framing", () => {
    const withGround = { ...scene, objects: [obj("ground-slab", "slab", [0, 0, 0], [180, .1, 180]), ...scene.objects] };
    expect(getV3PresentationBounds(withGround).size[0]).toBeCloseTo(getV3PresentationBounds(scene).size[0]);
  });

  it("compiles 40+ objects into visible meshes, keeping the building above terrain", () => {
    const model = compileV3Scene(scene);
    const d = diagnoseV3Scene(scene, model);
    expect(scene.objects.length).toBeGreaterThanOrEqual(40);
    expect(d.compiledPrimitiveCount).toBeGreaterThan(40);
    expect(d.notCompiled).toEqual([]);
    expect(d.buriedVolumes).toBe(0);
    for (const v of d.volumes) expect(v.visibleHeight).toBeGreaterThan(0);
    expect(d.terrainBounds!.max[0] - d.terrainBounds!.min[0]).toBeGreaterThan(150);
    expect(d.architectureBounds.size[0]).toBeLessThan(d.terrainBounds!.max[0] - d.terrainBounds!.min[0]);
  });

  it("detects a building buried by terrain", () => {
    // Explicit embedding retains surrounding terrain; ordinary bearing
    // volumes receive a terrain pad in both render and visibility analysis.
    const buried: V3Scene = { ...scene, objects: [obj("raise", "terrain-region", [0, 0, 0], [180, 1, 180], { terrain: { operation: "raiseRegion", rise: 20 } }), obj("hut", "volume", [0, 2, 0], [10, 4, 10], { metadata: { embedded: true } })] };
    expect(diagnoseV3Scene(buried).buriedVolumes).toBe(1);
  });

  it("hides terrain independently of the architecture", () => {
    const model = compileV3Scene(scene);
    expect(model.primitives.some((p) => p.id === "v3-terrain-surface")).toBe(true);
    const hidden = applyV3RenderDiagnostics(model, scene, { hideTerrain: true, debugMaterial: false, architectureBounds: false });
    expect(hidden.primitives.some((p) => p.id === "v3-terrain-surface")).toBe(false);
    expect(hidden.primitives.length).toBe(model.primitives.length - 1);
    expect(hidden.primitives.some((p) => p.id === "main")).toBe(true);
  });

  it("renders a scene whose supports are physically unresolved (lenient), though strict validation rejects it", () => {
    expect(validateV3Scene(scene).ok).toBe(false);
    const lenient = validateV3Scene(scene, { lenient: true });
    expect(lenient.ok).toBe(true);
    expect(lenient.warnings.filter((w) => w.startsWith("UNRESOLVED_SUPPORT")).length).toBe(14);
  });
});

describe("project JSON validator selection", () => {
  const v3Json = JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: mansionScene() });
  it("does not require `house` for a V3 root", () => {
    const result = validateProjectJson(v3Json);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.errors.join()).not.toContain("house");
  });
  it("still reports structural V3 defects", () => {
    const broken = JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: { version: 3, site: { width: 0, depth: 10 }, objects: [], relationships: [], metadata: {} } });
    expect(validateProjectJson(broken).errors.length).toBeGreaterThan(0);
  });
  it("leaves V2/legacy validation unchanged", () => {
    for (const text of ["{}", '{"house":{"width":10,"depth":8,"floors":2,"roof":"gable"}}', "not json"]) {
      const a = validateProjectJson(text), b = generateHouseFromJson(text);
      expect(a.errors).toEqual(b.errors);
      expect(a.warnings).toEqual(b.warnings);
    }
    expect(validateProjectJson("{}").errors).toEqual(['Missing required "house" object.']);
  });
});
