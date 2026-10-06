import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { capabilityRegistry } from "@/lib/capabilities/registry";
import { compileArchitecture, projectArchitectureToLegacy } from "./compiler";
import { hostedSlabRect } from "./geometry/assemblies";
import { ARCHITECTURE_FIXTURES } from "./fixtures";
import type { ArchitecturalDesignDocument } from "./document";

const pending = { status: "pending" as const };
const baseDoc = (overrides: Partial<ArchitecturalDesignDocument> = {}): ArchitecturalDesignDocument => ({
  version: 1, brief: "test", siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
  massing: { composition: "rectangular-pavilion", masses: [] }, roofs: { recipes: [] },
  facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  ...overrides,
});

describe("procedural architecture compiler", () => {
  it("compiles each deterministic fixture into multiple intentional masses and roofs", () => {
    for (const doc of Object.values(ARCHITECTURE_FIXTURES)) {
      const result = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
      expect(result.errors).toEqual([]);
      expect(new Set(result.model.primitives.map((p) => p.id.split("-").slice(0, 3).join("-"))).size).toBeGreaterThan(1);
      expect(result.model.primitives.filter((p) => p.category === "roof").length).toBeGreaterThan(0);
    }
  });

  it("keeps mass-only and roofs-only diagnostics isolated", () => {
    const doc = ARCHITECTURE_FIXTURES.modernTropicalCourtyardVilla;
    expect(compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" }).model.primitives.some((p) => p.category === "roof")).toBe(false);
    expect(compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "roofs-only" }).model.primitives.every((p) => p.category === "roof")).toBe(true);
  });

  it("projects a safe primary-mass legacy shell without flattening the document", () => {
    const legacy = projectArchitectureToLegacy(ARCHITECTURE_FIXTURES.contemporaryHillsideHouse);
    expect((legacy.house as { roof: string }).roof).toBe("flat");
    expect(legacy.architectureDocument).toBe(ARCHITECTURE_FIXTURES.contemporaryHillsideHouse);
  });

  it("offsets upper-floor primitives of a cantilevered mass, leaving the ground floor in place", () => {
    const doc = baseDoc({ massing: { composition: "rectangular-pavilion", masses: [
      { id: "tower", name: "Tower", role: "main-living", position: { x: 0, z: 0 }, width: 8, depth: 8, floors: 2, elevation: 0, rotation: 0, cantilever: { direction: "east", distance: 2 } },
    ] } });
    const { model } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    const boxes = model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box" && !p.id.endsWith("-debug-footprint"));
    const groundX = boxes.filter((p) => p.position[1] < 3).map((p) => p.position[0]);
    const upperX = boxes.filter((p) => p.position[1] >= 3).map((p) => p.position[0]);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(upperX.length).toBeGreaterThan(0);
    expect(groundX.length).toBeGreaterThan(0);
    expect(mean(upperX) - mean(groundX)).toBeCloseTo(2, 5);
  });

  it("compiles a balcony as an exterior upper-floor slab without changing its wall, window, footprint, or roof", () => {
    const mass = { id: "living", name: "Living", role: "main-living" as const, position: { x: 0, z: 0 }, width: 10, depth: 8, height: 6.8, floors: 2, elevation: 0, rotation: 0,
      openings: [{ id: "upper-window", type: "glazing-zone" as const, facade: "north" as const, start: .6, end: .86, heightRatio: .68, floors: "upper" as const, frame: true }],
    };
    const before = baseDoc({ massing: { composition: "rectangular-pavilion", masses: [mass] }, roofs: { recipes: [{ id: "living-roof", massId: "living", kind: "flat", overhang: .4 }] } });
    const balcony = { id: "living:upper-front-balcony", type: "balcony" as const, facade: "north" as const, start: .6, end: .86, depth: 1.65, floors: "upper" as const };
    const after = { ...before, massing: { ...before.massing, masses: [{ ...mass, operations: [balcony] }] } };
    const baseline = compileArchitecture(before, { materials: DEFAULT_MATERIALS_CONFIG });
    const compiled = compileArchitecture(after, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);

    const platform = compiled.model.primitives.find((p) => p.id === "architecture-living-balcony-living:upper-front-balcony");
    expect(platform).toMatchObject({ kind: "box", category: "floor" });
    if (!platform || platform.kind !== "box") throw new Error("balcony must compile to a slab box");
    expect(platform.position).toEqual([2.3, 3.5, -4.825]);
    expect(platform.size[0]).toBeCloseTo(2.6);
    expect(platform.size[1]).toBeCloseTo(.2);
    expect(platform.size[2]).toBeCloseTo(1.65);
    // Every original primitive is byte-for-byte identical: specifically the original north wall and its window.
    const beforeWithoutPlatform = baseline.model.primitives;
    const afterWithoutPlatform = compiled.model.primitives.filter((p) => p !== platform);
    expect(afterWithoutPlatform).toEqual(beforeWithoutPlatform);
    expect(compiled.model.primitives.find((p) => p.id === "architecture-living-wall-1-north-window-0-glass"))
      .toEqual(baseline.model.primitives.find((p) => p.id === "architecture-living-wall-1-north-window-0-glass"));
    expect(compiled.model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box").filter((p) => p.category === "wall" && p.position[2] < -4)).toEqual([]);
    expect(compiled.diagnostics?.geometry.find((g) => g.massId === "living")?.topFloorRectCount).toBe(1);
  });

  it("composes a balcony and portico from the shared assembly parts, preserving the shell and rotating with its mass", () => {
    const mass = { id: "living", name: "Living", role: "main-living" as const, position: { x: 12, z: -4 }, width: 10, depth: 8, height: 6.8, floors: 2, elevation: 0, rotation: Math.PI / 2,
      openings: [{ id: "upper-window", type: "glazing-zone" as const, facade: "north" as const, start: .58, end: .86, heightRatio: .68, floors: "upper" as const, frame: true }],
      assemblies: [{ id: "front-balcony", intent: "modern balcony", parts: [
        { id: "platform", type: "slab" as const, facade: "north" as const, start: .58, end: .86, depth: 1.65, level: 1 },
        { id: "guard", type: "railing" as const, slabId: "platform", edges: ["outer", "start", "end"] as const, height: 1.1 },
      ] }, { id: "entry-portico", intent: "portico", parts: [
        { id: "canopy", type: "slab" as const, facade: "south" as const, start: .3, end: .7, depth: 1.4, level: 0, elevation: 2.7, thickness: .16 },
        { id: "left-column", type: "post" as const, facade: "south" as const, at: .3, depth: 1.3, level: 0, height: 2.7 },
        { id: "right-column", type: "post" as const, facade: "south" as const, at: .7, depth: 1.3, level: 0, height: 2.7 },
        { id: "lintel", type: "beam" as const, facade: "south" as const, start: .3, end: .7, depth: 1.3, level: 0, elevation: 2.5, height: .2 },
      ] }],
    };
    const before = baseDoc({ massing: { composition: "rectangular-pavilion", masses: [{ ...mass, assemblies: [] }] }, roofs: { recipes: [{ id: "living-roof", massId: "living", kind: "flat", overhang: .4 }] } });
    const after = baseDoc({ massing: { composition: "rectangular-pavilion", masses: [mass] }, roofs: before.roofs });
    const baseline = compileArchitecture(before, { materials: DEFAULT_MATERIALS_CONFIG });
    const compiled = compileArchitecture(after, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);
    const added = compiled.model.primitives.filter((p) => p.id.includes("-assembly-"));
    expect(added.map((p) => p.id)).toEqual(expect.arrayContaining([
      "architecture-living-assembly-front-balcony-platform",
      "architecture-living-assembly-front-balcony-guard-outer",
      "architecture-living-assembly-entry-portico-left-column",
      "architecture-living-assembly-entry-portico-lintel",
    ]));
    // At +90° a local north-facing platform projects to world west; the existing wall/window/roof remain byte-stable.
    const platform = added.find((p) => p.id.endsWith("front-balcony-platform"));
    expect(platform).toMatchObject({ kind: "box" });
    if (!platform || platform.kind !== "box") throw new Error("assembly slab must be a box");
    expect(platform.position[0]).toBeCloseTo(7.175);
    expect(platform.position[1]).toBeCloseTo(3.5);
    expect(platform.position[2]).toBeCloseTo(-6.2);
    const withoutAssemblies = compiled.model.primitives.filter((p) => !p.id.includes("-assembly-"));
    expect(withoutAssemblies).toEqual(baseline.model.primitives);
    // The document is plain data: save/reload makes no hidden geometry decisions.
    expect(compileArchitecture(JSON.parse(JSON.stringify(after)), { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives).toEqual(compiled.model.primitives);
  });

  it("maps additive slabs onto every local facade before the shared mass rotation transform", () => {
    const mass = { width: 10, depth: 8 };
    const slab = (facade: "north" | "south" | "east" | "west") => hostedSlabRect(mass, { id: "slab", type: "slab", facade, start: .2, end: .6, depth: 1, level: 0 });
    expect(slab("north")).toEqual({ x0: -3, x1: 1, z0: -5, z1: -4 });
    expect(slab("south")).toEqual({ x0: -3, x1: 1, z0: 4, z1: 5 });
    expect(slab("east")).toMatchObject({ x0: 5, x1: 6, z0: -2.4 });
    expect(slab("east").z1).toBeCloseTo(.8);
    expect(slab("west")).toMatchObject({ x0: -6, x1: -5, z0: -2.4 });
    expect(slab("west").z1).toBeCloseTo(.8);
  });

  it("resolves floor, facade, terrace, roof, and slab hosts deterministically on a rotated mass", () => {
    const mass = {
      id: "rotated", name: "Rotated", role: "main-living" as const, position: { x: 10, z: -6 }, width: 10, depth: 8, height: 6.8, floors: 2, elevation: 1.2, rotation: Math.PI / 2,
      assemblies: [{
        id: "shaded-edge", intent: "A deliberately long descriptive note about a layered tropical shaded edge, privacy rhythm, arrival sequence, and view-oriented outdoor room that is metadata rather than a renderer command.", parts: [
          { id: "upper-platform", type: "slab" as const, facade: "north" as const, start: .25, end: .75, depth: 1.2, host: { kind: "facade" as const, facade: "north" as const, level: 1 } },
          { id: "screen-post", type: "post" as const, facade: "north" as const, at: .25, depth: 1.1, host: { kind: "slab" as const, slabId: "upper-platform" }, height: 1.4 },
          { id: "roof-canopy", type: "slab" as const, facade: "east" as const, start: .2, end: .8, depth: .9, host: { kind: "roof" as const, offset: .15 } },
          { id: "terrace-shade", type: "beam" as const, facade: "south" as const, start: .3, end: .7, depth: 1, host: { kind: "terrace" as const, offset: 2.5 }, height: .2 },
        ],
      }],
    };
    const doc = baseDoc({ massing: { composition: "rotated-wings", masses: [mass] }, roofs: { recipes: [{ id: "rotated-roof", massId: mass.id, kind: "flat", overhang: .4 }] } });
    const compiled = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);
    const primitive = (id: string) => {
      const found = compiled.model.primitives.find((p) => p.id === `architecture-rotated-assembly-shaded-edge-${id}`);
      if (!found || found.kind !== "box") throw new Error(`missing ${id}`);
      return found;
    };
    // Hosts resolve in local mass space, then the ordinary mass elevation/rotation transform is applied once.
    expect(primitive("upper-platform").position[1]).toBeCloseTo(4.7); // level 1 (3.4) + elevation 1.2 + half slab
    expect(primitive("screen-post").position[1]).toBeCloseTo(5.5); // platform top + half post
    expect(primitive("roof-canopy").position[1]).toBeCloseTo(8.25); // mass roofline + host offset + mass elevation + half slab
    expect(primitive("terrace-shade").position[1]).toBeCloseTo(3.8); // terrace support + offset + mass elevation + half beam
    expect(compileArchitecture(JSON.parse(JSON.stringify(doc)), { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives).toEqual(compiled.model.primitives);
  });

  it("strips primitive ids a capability requests removed before adding its own geometry", () => {
    capabilityRegistry.register({
      metadata: { id: "test-compiler-remove-stub", name: "Test Remove Stub", category: "massing", version: 1, status: "supported", description: "test", parameters: [{ key: "massId", required: true }], constraints: [], visualImpact: 1, implementationDifficulty: 1, performanceCost: 1, architecturalImportance: 1, fallback: "none", implementationNotes: "test" },
      implementation: { apply: ({ primitives }) => ({ primitives: [], remove: [primitives[0]?.id].filter((id): id is string => Boolean(id)) }) },
    });
    const doc = baseDoc({
      massing: { composition: "rectangular-pavilion", masses: [{ id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 10, depth: 8, floors: 1, elevation: 0, rotation: 0 }] },
      capabilities: [{ id: "test-compiler-remove-stub", stage: "test", parameters: { massId: "living" } }],
    });
    const before = compileArchitecture({ ...doc, capabilities: [] }, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    const after = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    expect(after.model.primitives.length).toBe(before.model.primitives.length - 1);
    expect(after.model.primitives.some((p) => p.id === before.model.primitives[0].id)).toBe(false);
  });

  it("builds non-overlapping flat-roof plates over an articulated footprint instead of re-merging them into one slab", () => {
    // Regression for the roof-hides-articulation bug: independently expanding each rectangle of an articulated
    // footprint by the full overhang caused every plate to overlap its neighbors and visually recombine into
    // one giant rectangle, erasing the recess/notch/projection the walls actually built.
    const doc = ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2;
    const { model } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    const boxes = model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box" && p.id.startsWith("architecture-living-roof") && p.id.endsWith("-plane"));
    expect(boxes.length).toBeGreaterThan(1);
    const spans = boxes.map((b) => ({ x0: b.position[0] - b.size[0] / 2, x1: b.position[0] + b.size[0] / 2, z0: b.position[2] - b.size[2] / 2, z1: b.position[2] + b.size[2] / 2 }));
    for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i], b = spans[j];
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      expect(overlapX > 1e-6 && overlapZ > 1e-6).toBe(false);
    }
  });

  it("compiles the geometry stress fixture into a visibly non-rectangular silhouette: multiple floor rects, a smaller upper floor, and non-overlapping roof plates", () => {
    const doc = ARCHITECTURE_FIXTURES.architectureCompilerStressFixture;
    const { model, diagnostics } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(diagnostics?.geometry.find((g) => g.massId === "main")?.topFloorRectCount).toBeGreaterThan(1);
    // Detached pavilion has no relationship to anything and must resolve at its own declared position.
    const pavilion = diagnostics?.masses.find((m) => m.id === "pavilion");
    expect(pavilion?.position).toEqual({ x: -30, z: 18 });
    const roofBoxes = model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box" && p.id.startsWith("architecture-main-roof") && p.id.endsWith("-plane"));
    expect(roofBoxes.length).toBeGreaterThan(1);
    const spans = roofBoxes.map((b) => ({ x0: b.position[0] - b.size[0] / 2, x1: b.position[0] + b.size[0] / 2, z0: b.position[2] - b.size[2] / 2, z1: b.position[2] + b.size[2] / 2 }));
    for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i], b = spans[j];
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      expect(overlapX > 1e-6 && overlapZ > 1e-6).toBe(false);
    }
  });

  it("resolves a second mass through allMasses so bridge-masses can span two masses", () => {
    const doc = baseDoc({
      massing: { composition: "rectangular-pavilion", masses: [
        { id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 10, depth: 8, floors: 1, elevation: 0, rotation: 0 },
        { id: "guest", name: "Guest", role: "guest-pavilion", position: { x: 20, z: 0 }, width: 6, depth: 6, floors: 1, elevation: 0, rotation: 0 },
      ] },
      capabilities: [{ id: "bridge-masses", stage: "mass-expansion", parameters: { massId: "living", secondaryMassId: "guest" } }],
    });
    const { model, diagnostics } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(diagnostics?.capabilities.find((c) => c.id === "bridge-masses")?.status).toBe("applied");
    expect(model.primitives.some((p) => p.id.includes("bridge-masses-living-guest"))).toBe(true);
  });
});

describe("chamfered (prow) masses keep their true footprint through slabs and roofs", () => {
  // 10x8 box at the origin, SE corner cut from (5,2) to (3,4): the wall line is x + z = 7 there.
  const prowDoc = (kind: "flat" | "floating-flat" | "shed" | "gable", overhang: number) => baseDoc({
    massing: { composition: "rectangular-pavilion", masses: [
      { id: "prow", name: "Prow", role: "main-living", position: { x: 0, z: 0 }, width: 10, depth: 8, floors: 2, elevation: 0, rotation: 0, operations: [{ type: "chamfer", corner: "se", size: 2, glazed: true }] },
    ] },
    roofs: { recipes: [{ id: "prow-roof", massId: "prow", kind, overhang }] },
  });
  const compile = (kind: "flat" | "floating-flat" | "shed" | "gable", overhang = 0.5) => {
    const result = compileArchitecture(prowDoc(kind, overhang), { materials: DEFAULT_MATERIALS_CONFIG });
    expect(result.errors).toEqual([]);
    return result.model.primitives;
  };
  /** Every plan-view point a primitive occupies (box corners, or mesh vertices). */
  const planPoints = (p: ReturnType<typeof compile>[number]): [number, number][] => p.kind === "triMesh"
    ? Array.from({ length: p.vertices.length / 3 }, (_, i) => [p.vertices[i * 3], p.vertices[i * 3 + 2]] as [number, number])
    : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [p.position[0] + sx * p.size[0] / 2, p.position[2] + sz * p.size[2] / 2] as [number, number]);
  const EPS = 1e-6;

  it("builds every floor slab inside the angled wall, covering the whole cut floor plate", () => {
    const slabs = compile("flat").filter((p) => p.category === "floor");
    for (const level of [0, 1]) {
      const own = slabs.filter((p) => p.id.includes(`-floor-${level}`));
      for (const p of own) for (const [x, z] of planPoints(p)) expect(x + z).toBeLessThanOrEqual(7 + EPS);
      const boxArea = own.filter((p) => p.kind === "box").reduce((sum, p) => sum + (p.kind === "box" ? p.size[0] * p.size[2] : 0), 0);
      // One triangular wedge (½·2·2 = 2 m²) fills the rest: 80 − 2 = 78 m² of floor, not the squared 80.
      expect(own.filter((p) => p.kind === "triMesh")).toHaveLength(1);
      expect(boxArea + 2).toBeCloseTo(78);
    }
  });

  it.each(["flat", "floating-flat", "shed"] as const)("keeps the prow's angle in a %s roof, with an even overhang along it", (kind) => {
    const roof = compile(kind, 0.5).filter((p) => p.category === "roof");
    expect(roof.length).toBeGreaterThan(0);
    const points = roof.flatMap(planPoints);
    // Nothing past the prow's own line moved out by the overhang...
    for (const [x, z] of points) expect(x + z).toBeLessThanOrEqual(7 + 0.5 * Math.SQRT2 + EPS);
    // ...but the overhang is still there everywhere else, reaching exactly out to the prow line.
    expect(Math.max(...points.map(([x]) => x))).toBeCloseTo(5.5);
    expect(Math.max(...points.map(([x, z]) => x + z))).toBeCloseTo(7 + 0.5 * Math.SQRT2);
  });

  it("builds a pitched (gable) roof over the square hull rather than failing", () => {
    expect(compile("gable").filter((p) => p.category === "roof").length).toBeGreaterThan(0);
  });
});
