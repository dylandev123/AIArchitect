import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { capabilityRegistry } from "@/lib/capabilities/registry";
import { compileArchitecture, projectArchitectureToLegacy } from "./compiler";
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
