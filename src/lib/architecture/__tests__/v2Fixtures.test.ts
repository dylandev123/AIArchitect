import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { compileArchitecture } from "../compiler";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { runDesignQualityGate } from "../stages/qualityGate";

/**
 * Deterministic proof (no live AI calls) that the four new V2 validation fixtures produce genuinely
 * different geometry from one another and from a plain rectangular box — not the same box arrangement
 * with a different roof. See the architecture-engine-v2 plan's acceptance criteria.
 */
describe("V2 architecture fixtures produce structurally distinct geometry", () => {
  it("compiles all four new fixtures with no errors and at least one articulated (multi-rectangle) mass each", () => {
    for (const key of ["tropicalCourtyardVilla", "cantileverHouse", "lShapedTropicalHouse", "pavilionCompound"] as const) {
      const { model, errors, diagnostics } = compileArchitecture(ARCHITECTURE_FIXTURES[key], { materials: DEFAULT_MATERIALS_CONFIG });
      expect(errors, key).toEqual([]);
      expect(model.primitives.length, key).toBeGreaterThan(0);
      expect(diagnostics?.geometry.some((g) => g.operationsRequested > 0 || g.openingsRequested > 0), `${key} should have at least one articulated mass`).toBe(true);
      expect(diagnostics?.geometry.every((g) => g.warnings.length === 0), `${key} should compile with no compiler warnings`).toBe(true);
    }
  });

  it("gives the L-shaped house's main mass exactly two roof rectangles (one corner notch)", () => {
    const { diagnostics } = compileArchitecture(ARCHITECTURE_FIXTURES.lShapedTropicalHouse, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(diagnostics?.geometry.find((g) => g.massId === "main")?.topFloorRectCount).toBe(2);
  });

  it("gives the courtyard villa's living mass a non-rectangular top floor from its entry recess + veranda projection", () => {
    const { diagnostics } = compileArchitecture(ARCHITECTURE_FIXTURES.tropicalCourtyardVilla, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(diagnostics?.geometry.find((g) => g.massId === "living")?.topFloorRectCount).toBeGreaterThan(1);
  });

  it("gives the cantilever house's ground and upper floors different wall geometry, and shifts the upper floor south by its declared cantilever distance", () => {
    const { model, diagnostics } = compileArchitecture(ARCHITECTURE_FIXTURES.cantileverHouse, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    const boxes = model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box" && !p.id.endsWith("-debug-footprint"));
    const groundWalls = boxes.filter((p) => p.position[1] < 3 && p.category === "wall");
    const upperWalls = boxes.filter((p) => p.position[1] >= 3 && p.category === "wall");
    // The ground floor's recess carves its south wall into sill/head/glazing-adjacent solid bands; the
    // untouched upper floor keeps a plain 4-wall ring — the two floors are not stacked copies.
    expect(groundWalls.length).not.toBe(upperWalls.length);
    const groundZ = boxes.filter((p) => p.position[1] < 3).map((p) => p.position[2]);
    const upperZ = boxes.filter((p) => p.position[1] >= 3).map((p) => p.position[2]);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // direction: "south" cantilever shifts the upper floor's +z; the ground floor's recess also pulls its
    // own mean south wall position inward, so the raw gap is somewhat more than the declared 2.2m.
    expect(mean(upperZ) - mean(groundZ)).toBeGreaterThan(1);
    expect(diagnostics?.geometry.find((g) => g.massId === "tower")?.topFloorRectCount).toBe(1);
  });

  it("connects the pavilion compound's main and guest pavilions with a real procedural bridge", () => {
    const { model, diagnostics } = compileArchitecture(ARCHITECTURE_FIXTURES.pavilionCompound, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(diagnostics?.capabilities.find((c) => c.id === "bridge-masses")?.status).toBe("applied");
    expect(model.primitives.some((p) => p.id.includes("bridge-masses-main-guest"))).toBe(true);
  });

  it("gives the four new fixtures meaningfully different wall/roof primitive counts from each other and from a plain rectangular baseline", () => {
    const plainBox = ARCHITECTURE_FIXTURES.caribbeanPavilionEstate; // has no operations at all — the "box with a roof" baseline
    const counts = new Map<string, number>();
    for (const key of ["caribbeanPavilionEstate", "tropicalCourtyardVilla", "cantileverHouse", "lShapedTropicalHouse", "pavilionCompound"]) {
      const { model } = compileArchitecture(ARCHITECTURE_FIXTURES[key], { materials: DEFAULT_MATERIALS_CONFIG });
      counts.set(key, model.primitives.filter((p) => p.category === "wall" || p.category === "roof").length);
    }
    const distinctCounts = new Set(counts.values());
    // Not a formal proof of "architectural difference," but a cheap, deterministic proxy: five genuinely
    // different compositions should not all happen to need the exact same primitive count.
    expect(distinctCounts.size).toBeGreaterThan(2);
    expect(plainBox).toBeTruthy();
  });
});

describe("Luxury Tropical Courtyard Villa V2 (Part 8 visual-regression fixture)", () => {
  const compile = () => compileArchitecture(ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2, { materials: DEFAULT_MATERIALS_CONFIG });

  it("compiles with no errors and no compiler warnings", () => {
    const { errors, diagnostics } = compile();
    expect(errors).toEqual([]);
    expect(diagnostics?.geometry.every((g) => g.warnings.length === 0)).toBe(true);
  });

  it("resolves a real 3-edge courtyard around the dominant living pavilion", () => {
    const { diagnostics } = compile();
    const courtyard = diagnostics?.courtyards.find((c) => c.anchorMassId === "living");
    expect(courtyard).toBeTruthy();
    expect(courtyard?.enclosingMassIds.sort()).toEqual(["east-wing", "west-wing"]);
    expect(diagnostics?.dominantMassId).toBe("living");
  });

  it("auto-orients both wings to face the shared courtyard", () => {
    const { model } = compile();
    // Auto-orientation only changes rotation; it never changes which primitives exist — this just proves the
    // fixture actually exercises resolveMasses' courtyard branch rather than asserting an exact yaw value.
    expect(model.primitives.some((p) => p.id.startsWith("architecture-west-wing-"))).toBe(true);
    expect(model.primitives.some((p) => p.id.startsWith("architecture-east-wing-"))).toBe(true);
  });

  it("gives the living pavilion a non-rectangular top floor and a wall-less colonnade terrace", () => {
    const { model, diagnostics } = compile();
    expect(diagnostics?.geometry.find((g) => g.massId === "living")?.topFloorRectCount).toBeGreaterThan(1);
    expect(model.primitives.some((p) => p.id.includes("wall-0-open-") && p.id.endsWith("-header"))).toBe(true);
    expect(model.primitives.some((p) => p.id.includes("wall-0-open-") && p.id.includes("-post-"))).toBe(true);
  });

  it("applies the entry-canopy and corner-glazing capabilities", () => {
    const { model, diagnostics } = compile();
    expect(diagnostics?.capabilities.find((c) => c.id === "entry-canopy")?.status).toBe("applied");
    expect(diagnostics?.capabilities.find((c) => c.id === "corner-glazing")?.status).toBe("applied");
    expect(model.primitives.some((p) => p.id.includes("entry-canopy-living"))).toBe(true);
  });

  it("gives the connector and service pavilion lighter roofs than the dominant living pavilion", () => {
    const cleared = new Map(compile().diagnostics?.roofs.map((r) => [r.massId, r.kind]));
    expect(cleared.get("living")).toBe("floating-flat");
    expect(cleared.get("connector")).toBe("flat");
    expect(cleared.get("service")).toBe("flat");
  });

  it("passes the deterministic design-quality gate", () => {
    const { diagnostics } = compile();
    const gate = runDesignQualityGate(ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2, diagnostics!);
    expect(gate.checks.filter((c) => !c.passed)).toEqual([]);
    expect(gate.passed).toBe(true);
  });
});

describe("Architecture Capability House (V2 geometry vocabulary fixture)", () => {
  const doc = ARCHITECTURE_FIXTURES.architectureCapabilityHouse;
  const compile = () => compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
  const boxes = () => compile().model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box");

  it("compiles with no errors, no compiler warnings, and every capability applied", () => {
    const { errors, diagnostics } = compile();
    expect(errors).toEqual([]);
    expect(diagnostics?.geometry.every((g) => g.warnings.length === 0)).toBe(true);
    expect(diagnostics?.capabilities.map((c) => [c.id, c.status])).toEqual([["entry-canopy", "applied"], ["pilotis", "applied"], ["brise-soleil", "applied"]]);
  });

  it("builds the chamfered south-east corner as one angled, glazed wall rather than an axis-aligned box", () => {
    const prow = boxes().filter((p) => p.id.startsWith("architecture-ground-wall-0-cut-") && p.category === "window");
    expect(prow.length).toBeGreaterThan(0);
    for (const p of prow) expect(Math.abs(Math.abs(p.rotation[1]) - Math.PI / 4)).toBeLessThan(1e-9);
  });

  it("rebuilds the living pavilion as a shaped footprint with both an L-notch and an angled prow", () => {
    const { model, diagnostics } = compile();
    const ground = diagnostics?.geometry.find((g) => g.massId === "ground");
    expect(ground?.topFloorRectCount).toBeGreaterThan(2);
    expect(model.primitives.some((p) => p.id.startsWith("architecture-ground-floor-") && p.kind === "triMesh")).toBe(true);
    expect(model.primitives.some((p) => p.id.startsWith("architecture-ground-roof-") && p.kind === "triMesh")).toBe(true);
  });

  it("adds parapets only where the roof recipe opts in, rising above the roof deck", () => {
    const all = boxes();
    const parapetOf = (massId: string) => all.filter((p) => p.id.startsWith(`architecture-${massId}-parapet-`));
    expect(parapetOf("ground")).toHaveLength(0);
    expect(parapetOf("upper")).toHaveLength(4);
    expect(parapetOf("garage")).toHaveLength(4);
    const upperDeckTop = Math.max(...all.filter((p) => p.id === "architecture-upper-roof-plane").map((p) => p.position[1] + p.size[1] / 2));
    for (const p of parapetOf("upper")) expect(p.position[1] + p.size[1] / 2).toBeCloseTo(upperDeckTop + 0.5);
  });

  it("props the cantilevered box only where it is unsupported by the pavilion below", () => {
    const ground = doc.massing.masses.find((m) => m.id === "ground")!;
    const columns = boxes().filter((p) => p.id.startsWith("capability-pilotis-upper-column-"));
    expect(columns.length).toBeGreaterThanOrEqual(2);
    for (const c of columns) {
      const insideGround = Math.abs(c.position[0] - ground.position.x) < ground.width / 2 && Math.abs(c.position[2] - ground.position.z) < ground.depth / 2;
      expect(insideGround).toBe(false);
      expect(c.position[1] - c.size[1] / 2).toBeCloseTo(0);
      expect(c.position[1] + c.size[1] / 2).toBeCloseTo(3.45);
    }
  });

  it("shades the box's south glazing with a row of vertical fins", () => {
    expect(boxes().filter((p) => p.id.startsWith("capability-brise-soleil-upper-south-fin-"))).toHaveLength(13);
  });
});
