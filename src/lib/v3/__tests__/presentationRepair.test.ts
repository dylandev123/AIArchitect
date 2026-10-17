import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import * as THREE from "three";
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from "../scene";
import { inferV3MaterialSurface, withInferredV3Surfaces } from "../materialInference";
import { v3RooftopTerrace, v3StoreyBase, v3StoreyTargetingDiagnostics } from "../stacking";
import { v3VegetationPlacements } from "../vegetation";
import { v3GroundSurroundShape } from "../ground";
import { PARITY_FIXTURES } from "../parity/fixtures";

/** The three captured AI mansions, byte-for-byte as committed in the workspace (from the dev RENDER TRANSITION log). */
const MANSION_IDS = ["f2149916", "91d583fe", "9646933e"] as const;
const fixturePath = (id: string) => `src/lib/v3/__tests__/fixtures/mansions/mansion-${id}.json`;
const mansion = (id: (typeof MANSION_IDS)[number]): V3Scene => JSON.parse(readFileSync(fixturePath(id), "utf8")).v3Scene;
const latest = () => mansion("9646933e");
const object = (scene: V3Scene, id: string) => scene.objects.find((o) => o.id === id)!;

describe("V3 ground authority", () => {
  it("cuts the V3 site out of the surrounding V2 lawn so the two never overlap", () => {
    const site = latest().site, geometry = new THREE.ShapeGeometry(v3GroundSurroundShape(site, 200));
    const p = geometry.attributes.position, index = geometry.index!;
    let area = 0;
    for (let i = 0; i < index.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector2(p.getX(index.getX(i + k)), p.getY(index.getX(i + k))));
      area += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
      expect(Math.abs(cx) < site.width / 2 && Math.abs(cy) < site.depth / 2, "no lawn triangle inside the V3 site").toBe(false);
    }
    expect(area).toBeCloseTo(400 * 400 - site.width * site.depth, 3);
  });

  it("keeps the V3 terrain as the textured ground with the pool excavated into it", () => {
    const model = compileV3Scene(latest()), terrain = model.primitives.find((p) => p.id === "v3-terrain-surface")!;
    expect(terrain.surface).toBe("grass");
    expect(terrain.kind === "triMesh" && Math.min(...terrain.vertices.filter((_, i) => i % 3 === 1))).toBeLessThan(-1);
    const pool = model.primitives.filter((p) => p.sourceObjectId === "resort-pool").map((p) => p.componentRole);
    expect(pool).toEqual(expect.arrayContaining(["water surface", "pool coping", "pool basin"]));
  });
});

describe("V3 material surfaces", () => {
  it.each([
    ["travertine", "terrace", "stone"], ["warm-stone", "building-mass", "stone"], ["teak", "canopy", "wood"], ["ivory-render", "building-mass", "stucco"],
    ["coral-stucco", "building-mass", "stucco"], ["board-formed-concrete", "building-mass", "concrete"], ["arrival-paver", "terrace", "paving"],
    ["tropical-planting", "landscape-zone", "grass"], ["pool-water", "pool", "water"], ["bronze", "canopy", "metal"], ["charcoal-roof", "roof-form", undefined],
    ["low-iron-glass", "glass-wall", "glass"], ["dark-bronze-glass", "building-mass", "metal"], ["frosted-glass", "building-mass", undefined],
  ] as const)("%s on %s → %s", (id, type, surface) => {
    expect(inferV3MaterialSurface({ id, color: "#808080" }, type)).toBe(surface);
  });

  it("never overrides an explicit surface or colour, and never mutates the authored scene", () => {
    expect(inferV3MaterialSurface({ id: "teak", color: "#111111", surface: "metal" }, "terrace")).toBe("metal");
    const scene = latest(), before = JSON.stringify(scene), effective = withInferredV3Surfaces(scene);
    expect(JSON.stringify(scene)).toBe(before);
    effective.objects.forEach((o, i) => { expect(o.material.color).toBe(scene.objects[i].material.color); expect(o.material.id).toBe(scene.objects[i].material.id); });
  });

  it("renders the latest mansion's semantic materials as recognizable surfaces", () => {
    const model = compileV3Scene(latest()), finish = (id: string, role?: string) => model.primitives.find((p) => p.sourceObjectId === id && (!role || p.componentRole === role))!;
    expect(finish("south-lanai-terrace").surface).toBe("stone");
    expect(finish("south-lanai-terrace").color).toBe("#d6c7ae");
    expect(finish("pool-cabana", "canopy roof").surface).toBe("wood");
    expect(finish("arrival-drive").surface).toBe("paving");
    expect(finish("main-residence-ground", "facade wall").surface).toBe("stone");
    expect(finish("upper-bedroom-gallery", "facade wall").surface).toBe("stucco");
  });
});

describe("stacked upper-storey openings", () => {
  it("resolves a mass stacked on another mass as an upper storey", () => {
    const scene = latest();
    expect(v3StoreyBase(object(scene, "upper-bedroom-gallery"), scene)).toBe(1);
    expect(v3StoreyBase(object(scene, "main-residence-ground"), scene)).toBe(0);
    expect(v3StoreyBase(object(scene, "east-guest-wing"), scene)).toBe(0);
  });

  it("restores every authored upper opening of the upper bedroom gallery without changing its geometry", () => {
    const scene = latest(), gallery = object(scene, "upper-bedroom-gallery"), before = JSON.stringify(gallery);
    const glazing = compileV3Scene(scene).primitives.filter((p) => p.sourceObjectId === gallery.id && p.category === "window");
    // Rhythm windows carry an index (`<opening>-<n>:level-0`); zones and doors use the opening id directly.
    for (const opening of gallery.composition!.openings!) expect(glazing.some((p) => new RegExp(`^${gallery.id}:${opening.id}(-\\d+)?:level-0:`).test(p.id)), opening.id).toBe(true);
    expect(glazing.filter((p) => p.transparent).length).toBeGreaterThan(5);
    expect(JSON.stringify(gallery)).toBe(before);
  });

  it("keeps a true single-storey ground building unchanged and reports its unresolvable upper opening", () => {
    const scene = latest(), wing = object(scene, "east-guest-wing");
    wing.composition = { ...wing.composition, openings: [...wing.composition!.openings!, { id: "wing-upper", facade: "north", floors: "upper", type: "glazing-zone", start: .1, end: .3, heightRatio: .5 }] };
    expect(compileV3Scene(scene).primitives.some((p) => p.id.includes(":wing-upper:"))).toBe(false);
    expect(v3StoreyTargetingDiagnostics(scene)).toContainEqual(expect.objectContaining({ code: "OPENING_FLOOR_UNRESOLVED", targetId: "east-guest-wing", openingId: "wing-upper" }));
    expect(validateV3CompiledGeometry(scene, undefined, { lenient: true }).warnings.join("\n")).toContain("OPENING_FLOOR_UNRESOLVED [east-guest-wing]");
  });

  it("warns on ambiguous targets: ground openings on a stacked mass and upper openings on an unhosted elevated mass", () => {
    const scene = latest(), gallery = object(scene, "upper-bedroom-gallery");
    gallery.composition = { ...gallery.composition, openings: [...gallery.composition!.openings!, { id: "gallery-ground", facade: "west", floors: "ground", type: "door", start: .4, end: .5 }] };
    const westHasUpper = gallery.composition.openings!.some((op) => op.facade === "west" && op.floors !== "ground");
    expect(v3StoreyTargetingDiagnostics(scene)).toContainEqual(expect.objectContaining({ code: "OPENING_FLOOR_AMBIGUOUS", openingId: "gallery-ground" }));
    expect(compileV3Scene(scene).primitives.some((p) => p.id.includes(":gallery-ground:"))).toBe(!westHasUpper);
    const unhosted = latest(), floating = object(unhosted, "upper-bedroom-gallery");
    delete floating.hostId;
    expect(v3StoreyTargetingDiagnostics(unhosted)).toContainEqual(expect.objectContaining({ code: "OPENING_FLOOR_AMBIGUOUS", targetId: floating.id, openingId: "upper-south-bedroom-glazing" }));
  });
});

describe("rooftop terraces", () => {
  it("replaces the host's ordinary roof plate with the authored sky terrace", () => {
    const scene = latest(), model = compileV3Scene(scene);
    expect(v3RooftopTerrace(object(scene, "east-guest-wing"), scene)?.id).toBe("guest-sky-terrace");
    expect(model.primitives.some((p) => p.id.startsWith("east-guest-wing-roof-"))).toBe(false);
    expect(model.primitives.some((p) => p.id === "guest-sky-terrace-surface")).toBe(true);
    expect(model.primitives.some((p) => p.sourceObjectId === "sky-terrace-pergola")).toBe(true);
    // Unrelated roofs and the wing's own walls/top slab are untouched.
    expect(model.primitives.some((p) => p.sourceObjectId === "main-residence-ground" && p.category === "roof")).toBe(true);
    expect(model.primitives.some((p) => p.sourceObjectId === "main-floating-roof")).toBe(true);
    expect(model.primitives.some((p) => p.id === "east-guest-wing-slab-2")).toBe(true);
  });

  it("does not suppress a roof merely because a terrace overlaps it", () => {
    const unrelated = latest(), terrace = object(unrelated, "guest-sky-terrace");
    delete terrace.hostId; delete terrace.support;
    expect(v3RooftopTerrace(object(unrelated, "east-guest-wing"), unrelated)).toBeUndefined();
    expect(compileV3Scene(unrelated).primitives.some((p) => p.id === "east-guest-wing-roof-plate")).toBe(true);
    const small = latest(), tiny = object(small, "guest-sky-terrace");
    tiny.dimensions = [3, .2, 3]; tiny.architecture = { ...tiny.architecture!, width: 3, depth: 3 };
    expect(v3RooftopTerrace(object(small, "east-guest-wing"), small)).toBeUndefined();
    const ground = latest();
    expect(v3RooftopTerrace(object(ground, "main-residence-ground"), ground)).toBeUndefined();
  });
});

describe("V3 landscape planting", () => {
  const blocked = (scene: V3Scene) => scene.objects.filter((o) => !["landscape-zone", "planter", "terrain-region"].includes(o.type));
  const inside = (o: V3SceneObject, x: number, z: number) => {
    const [w, , d] = o.dimensions, [cx, , cz] = o.transform.position, a = o.transform.rotation[1], dx = x - cx, dz = z - cz;
    return Math.abs(dx * Math.cos(a) - dz * Math.sin(a)) <= w / 2 && Math.abs(dx * Math.sin(a) + dz * Math.cos(a)) <= d / 2;
  };

  it("places palms in tropical zones, deterministically, within footprints and clear of everything built", () => {
    for (const id of MANSION_IDS) {
      const scene = mansion(id), before = JSON.stringify(scene), plants = v3VegetationPlacements(scene);
      expect(plants.length, id).toBeGreaterThan(10);
      expect(v3VegetationPlacements(mansion(id))).toEqual(plants);
      expect(JSON.stringify(scene)).toBe(before);
      for (const plant of plants) {
        const [x, , z] = plant.position, zone = object(scene, plant.zoneId);
        expect(inside(zone, x, z), plant.id).toBe(true);
        for (const o of blocked(scene)) expect(inside(o, x, z), `${plant.id} inside ${o.id}`).toBe(false);
      }
    }
    const tropical = v3VegetationPlacements(latest()).filter((p) => p.zoneId === "tropical-garden-south");
    expect(tropical.some((p) => p.kind === "palm")).toBe(true);
    expect(tropical.every((p) => ["palm", "shrub", "shrub-flowering"].includes(p.kind))).toBe(true);
  });

  it("follows authored intent: palms where the brief says palms, nothing on an open lawn", () => {
    // 91d583fe's "lawn" is authored as "Open tropical lawn and palm garden", so it is planted.
    const scene = mansion("91d583fe");
    expect(v3VegetationPlacements(scene).filter((p) => p.zoneId === "south-lawn").some((p) => p.kind === "palm")).toBe(true);
    const lawn = object(scene, "south-lawn");
    Object.assign(lawn, { semanticRole: "open lawn", label: "Open play lawn" });
    expect(v3VegetationPlacements(scene).filter((p) => p.zoneId === "south-lawn")).toEqual([]);
  });

  it("keeps clear of graded driveway routes", () => {
    // None of the captured mansions author a site-hierarchy route, so one is laid straight through the east garden.
    const scene = latest();
    scene.siteHierarchy = { levels: [{ id: "ground", elevation: 0, region: { x: 0, z: 0, width: 80, depth: 70 }, supportType: "terrain" }], connections: [{ id: "service-drive", fromLevelId: "ground", toLevelId: "ground", type: "driveway", route: [[32, 0, -25], [32, 0, 30]], width: 4 }] };
    const routes = scene.siteHierarchy.connections;
    expect(v3VegetationPlacements(latest()).some((p) => Math.abs(p.position[0] - 32) < 2)).toBe(true);
    for (const plant of v3VegetationPlacements(scene)) for (const route of routes) {
      const pts = route.route as unknown as number[][];
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]], dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((plant.position[0] - a[0]) * dx + (plant.position[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
        expect(Math.hypot(plant.position[0] - a[0] - dx * t, plant.position[2] - a[2] - dz * t), `${plant.id} on ${route.id}`).toBeGreaterThan(route.width / 2);
      }
    }
  });

  it("no longer compiles cube trees into the persistent model", () => {
    const model = compileV3Scene(latest());
    expect(model.primitives.some((p) => /landscape (trunk|canopy)/.test(p.componentRole ?? ""))).toBe(false);
    expect(model.primitives.filter((p) => p.componentRole === "landscape groundcover")).toHaveLength(3);
  });
});

describe("captured mansion regression fixtures", () => {
  // Fixture files are read-only replays of the committed scenes; any edit to them must be deliberate.
  const pinned: Record<(typeof MANSION_IDS)[number], string> = {
    f2149916: "19ae782d5e77d9652a496257c72a6f0da92a28d8ba8b128a3b89675ce6e66da0",
    "91d583fe": "9de210de39d596ffb6d3052797f401b8ceb23669d0fc7da5f8ba3196a0e896ac",
    "9646933e": "2be2a0c3d4a0300999e92a099cab326b6ba783608143148d116a93ba4864489d",
  };
  it.each(MANSION_IDS)("%s compiles cleanly and is never mutated by rendering", (id) => {
    const raw = readFileSync(fixturePath(id), "utf8");
    expect(createHash("sha256").update(raw).digest("hex")).toBe(pinned[id]);
    const scene = mansion(id), before = JSON.stringify(scene), model = compileV3Scene(scene);
    expect(validateV3CompiledGeometry(scene, model, { lenient: true }).ok).toBe(true);
    v3VegetationPlacements(scene);
    expect(JSON.stringify(scene)).toBe(before);
  });

  it("keeps the parity cottage, villa and mansion fixtures valid", () => {
    for (const key of ["cottage", "villa", "large"] as const) expect(validateV3CompiledGeometry(PARITY_FIXTURES[key]()).ok, key).toBe(true);
  });
});
