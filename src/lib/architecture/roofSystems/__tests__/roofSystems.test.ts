import { describe, expect, it } from "vitest";
import { LEVEL_HEIGHT } from "@/lib/house/constants";
import type { HousePrimitive, TriMeshPrimitive } from "@/lib/house/types";
import { fittedTextureUvs } from "@/lib/roofSurfaceUv";
import { DEFAULT_MATERIALS_CONFIG, type MaterialAssignment, type MaterialsConfig } from "@/types/house";
import { compileArchitecture } from "../../compiler";
import type { RoofComposition, RoofRecipe } from "../../document";
import { butterflyRoofGeometry, gableRoofGeometry, hipRoofGeometry } from "../../geometry/pitchedRoof";
import { ROOF_SYSTEM_FIXTURES } from "../fixtures";
import { buildSeamRibs, courseLayout, getRoofSystem, listRoofSystems, planRoofSystems, registerRoofSystem, roofSystemForMaterial, seamLayout, STANDING_SEAM_PAN, tileModuleFor, type V3 } from "..";

const BASE = LEVEL_HEIGHT;
const tan = (deg: number) => Math.tan((deg * Math.PI) / 180);
const roofZone = (roof: MaterialAssignment): MaterialsConfig => ({ ...DEFAULT_MATERIALS_CONFIG, roof });
const SEAM = roofZone({ material: "standing-seam-metal", color: "#3f474d" });
const CLAY = roofZone({ material: "terracotta", color: "#b8623e" });

/** A 12 × 8 m single-storey house under one roof recipe. */
function compileRoof(recipe: Partial<RoofRecipe> & Pick<RoofRecipe, "kind">, materials: MaterialsConfig, size: [number, number] = [12, 8]) {
  const base = ROOF_SYSTEM_FIXTURES.standingSeamGable.doc;
  const doc = { ...base, massing: { ...base.massing, masses: [{ ...base.massing.masses[0], width: size[0], depth: size[1] }] }, roofs: { recipes: [{ id: "house-roof", massId: "house", ...recipe }] } };
  const result = compileArchitecture(doc, { materials });
  expect(result.errors).toEqual([]);
  const roof = result.model.primitives.filter((p) => p.category === "roof" || p.id.includes("-parapet-"));
  const mesh = (suffix: string) => roof.find((p): p is TriMeshPrimitive => p.kind === "triMesh" && p.id === `architecture-house-roof-${suffix}`);
  return { ...result, roof, mesh };
}
function bounds(vertices: readonly number[]) {
  const axis = (k: number) => vertices.filter((_, i) => i % 3 === k);
  const [xs, ys, zs] = [axis(0), axis(1), axis(2)];
  return { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)], z: [Math.min(...zs), Math.max(...zs)] };
}

describe("authored pitch and overhang reach the V2 ridge-family builders", () => {
  it.each([[20, 0.3], [40, 1.0]])("gable at %s° with a %sm overhang", (pitch, overhang) => {
    const b = bounds(compileRoof({ kind: "gable", pitch, overhang }, SEAM).mesh("surface")!.vertices);
    expect(b.y[1]).toBeCloseTo(BASE + tan(pitch) * 4);
    // The plane bears on the wall plate at the wall line, so the eave ends lower the further it reaches.
    expect(b.y[0]).toBeCloseTo(BASE - tan(pitch) * overhang);
    expect(b.x).toEqual([expect.closeTo(-6 - overhang), expect.closeTo(6 + overhang)]);
    expect(b.z).toEqual([expect.closeTo(-4 - overhang), expect.closeTo(4 + overhang)]);
  });

  it.each([[18, 0.4], [35, 0.9]])("hip at %s° with a %sm overhang", (pitch, overhang) => {
    const b = bounds(compileRoof({ kind: "hip", pitch, overhang }, SEAM).mesh("surface")!.vertices);
    expect(b.y).toEqual([expect.closeTo(BASE - tan(pitch) * overhang), expect.closeTo(BASE + tan(pitch) * 4)]);
    expect(b.x).toEqual([expect.closeTo(-6 - overhang), expect.closeTo(6 + overhang)]);
    expect(b.z).toEqual([expect.closeTo(-4 - overhang), expect.closeTo(4 + overhang)]);
  });

  it.each([[6, 0.5], [14, 1.2]])("butterfly at %s° with a %sm overhang, its valley on the wall plate and its walls closed up to the wings", (pitch, overhang) => {
    const { mesh } = compileRoof({ kind: "butterfly", pitch, overhang }, SEAM);
    const b = bounds(mesh("surface")!.vertices);
    expect(b.y).toEqual([expect.closeTo(BASE), expect.closeTo(BASE + tan(pitch) * (4 + overhang))]);
    expect(b.z).toEqual([expect.closeTo(-4 - overhang), expect.closeTo(4 + overhang)]);
    const infill = bounds(mesh("infill")!.vertices);
    expect(infill.y).toEqual([expect.closeTo(BASE), expect.closeTo(BASE + tan(pitch) * 4)]);
    expect([infill.x, infill.z]).toEqual([[-6, 6], [-4, 4]]);
  });

  it("keeps the gable-end wall on the wall line, not out at the rake overhang", () => {
    expect(bounds(compileRoof({ kind: "gable", pitch: 30, overhang: 0.8 }, SEAM).mesh("infill")!.vertices).x).toEqual([-6, 6]);
  });

  it("runs the ridge along the longer side whichever way the mass is proportioned", () => {
    const b = bounds(compileRoof({ kind: "gable", pitch: 30, overhang: 0 }, SEAM, [6, 10]).mesh("surface")!.vertices);
    expect(b.y[1]).toBeCloseTo(BASE + tan(30) * 3);
  });

  it("falls back to the family's default pitch and a 0.6m overhang only when the recipe names none", () => {
    const b = bounds(compileRoof({ kind: "gable" }, SEAM).mesh("surface")!.vertices);
    expect(b.y[1]).toBeCloseTo(BASE + tan(22) * 4);
    expect(b.z[1]).toBeCloseTo(4.6);
  });
});

describe("Roof System registry and deterministic defaults", () => {
  it("registers the three built-in systems, in a fixed order", () => {
    expect(listRoofSystems().map((s) => s.id)).toEqual(["standing-seam", "tile-shingle", "flat-parapet"]);
    expect(() => registerRoofSystem(getRoofSystem("tile-shingle")!)).toThrow(/already registered/);
  });

  it("derives the system from the existing roof material", () => {
    const system = (material: MaterialAssignment["material"]) => roofSystemForMaterial(material).id;
    for (const m of ["standing-seam-metal", "metal", "zinc", "copper", "corten", "black-aluminum"] as const) expect(system(m)).toBe("standing-seam");
    for (const m of ["tile", "terracotta", "slate", "cedar"] as const) expect(system(m)).toBe("tile-shingle");
    for (const m of ["concrete", "stucco", "render", "stone", "glass"] as const) expect(system(m)).toBe("flat-parapet");
  });

  const roofs = (...kinds: [string, RoofRecipe["kind"], number?][]): RoofComposition => ({ recipes: kinds.map(([massId, kind, pitch]) => ({ id: `${massId}-roof`, massId, kind, ...(pitch !== undefined ? { pitch } : {}) })) });

  it("makes the material's system primary when it can cover the dominant roof", () => {
    expect(planRoofSystems(roofs(["main", "gable", 30], ["wing", "hip", 30]), "main", "terracotta")).toEqual({
      primary: "tile-shingle", warnings: [],
      roofs: [{ recipeId: "main-roof", massId: "main", system: "tile-shingle", role: "primary" }, { recipeId: "wing-roof", massId: "wing", system: "tile-shingle", role: "primary" }],
    });
  });

  it("lets the dominant roof's form lead when the material's system can't cover it", () => {
    const plan = planRoofSystems(roofs(["main", "floating-flat"], ["wing", "flat"]), "main", "tile");
    expect(plan.primary).toBe("flat-parapet");
    expect(plan.counterpoint).toBeUndefined();
  });

  it("tiles the pitched wings of a flat-roofed house whose roof material is tile", () => {
    const plan = planRoofSystems(roofs(["main", "floating-flat"], ["wing", "hip", 24], ["guest", "mono-pitch", 12]), "main", "tile");
    expect(plan).toMatchObject({ primary: "flat-parapet", counterpoint: "tile-shingle" });
    // ...unless one of them is too shallow for tile: then the one system that covers them all takes both.
    expect(planRoofSystems(roofs(["main", "floating-flat"], ["wing", "hip", 24], ["guest", "butterfly", 8]), "main", "tile").counterpoint).toBe("standing-seam");
  });

  it("gives every roof the primary can't cover ONE shared counterpoint system", () => {
    const plan = planRoofSystems(roofs(["main", "gable", 30], ["link", "flat"], ["studio", "butterfly", 8]), "main", "slate");
    expect(plan.primary).toBe("tile-shingle");
    // A flat link alone would take the membrane system; with a low butterfly too, only standing seam covers both.
    expect(plan.counterpoint).toBe("standing-seam");
    expect(new Set(plan.roofs.map((r) => r.system)).size).toBe(2);
    expect(plan.roofs.filter((r) => r.role === "counterpoint").map((r) => r.reason)).toEqual(["Tile / shingle cannot cover a flat roof", "Tile / shingle cannot cover a butterfly roof at 8°"]);
    expect(planRoofSystems(roofs(["main", "gable", 30], ["link", "flat"]), "main", "slate").counterpoint).toBe("flat-parapet");
  });

  it("honors an authored primary and intentional counterpoint", () => {
    const composition = { ...roofs(["main", "gable", 30], ["studio", "gable", 30]), system: { primary: "tile-shingle", counterpoint: { system: "standing-seam", massIds: ["studio"], reason: "the studio is the modern addition" } } };
    const plan = planRoofSystems(composition, "main", "concrete");
    expect(plan).toMatchObject({ primary: "tile-shingle", counterpoint: "standing-seam", warnings: [] });
    expect(plan.roofs[1]).toEqual({ recipeId: "studio-roof", massId: "studio", system: "standing-seam", role: "counterpoint", reason: "the studio is the modern addition" });
  });

  it("warns about an unknown authored system and falls back to the material's", () => {
    const plan = planRoofSystems({ ...roofs(["main", "gable", 30]), system: { primary: "thatch" } }, "main", "zinc");
    expect(plan.primary).toBe("standing-seam");
    expect(plan.warnings).toEqual([`Unknown roof system "thatch" — using the roof material's own system.`]);
  });

  it("reports the plan in the compile diagnostics", () => {
    const { doc, materials } = ROOF_SYSTEM_FIXTURES.tileWithFlatLink;
    expect(compileArchitecture(doc, { materials }).diagnostics?.roofSystems).toMatchObject({ primary: "tile-shingle", counterpoint: "flat-parapet", warnings: [], roofs: [{ massId: "main", role: "primary" }, { massId: "link", role: "counterpoint", system: "flat-parapet" }, { massId: "wing", role: "primary" }] });
  });
});

describe("the Roof System owns the roof finish", () => {
  it("uses the roof zone's own assignment when the material belongs to the system", () => {
    const surface = compileRoof({ kind: "hip", pitch: 25 }, roofZone({ material: "zinc", color: "#778088" })).mesh("surface")!;
    expect(surface).toMatchObject({ color: "#778088", surface: "zinc", metalness: 0.55 });
  });

  it("finishes a flat deck on a tiled house as a membrane, not in tile", () => {
    const { roof, diagnostics } = compileRoof({ kind: "flat", overhang: 0.5 }, CLAY);
    expect(diagnostics?.roofSystems.primary).toBe("flat-parapet");
    expect(roof.find((p) => p.id.endsWith("-plane"))).toMatchObject({ color: "#b9b5aa", surface: "concrete" });
    expect(roof.some((p) => p.color === CLAY.roof.color)).toBe(false);
  });
});

describe("standing seam: fitted, correctly oriented seams", () => {
  const RIB = { width: 0.03, height: 0.035 };
  const RIB_FLOATS = 5 * 6 * 3;

  it("spaces seams in whole equal pans, symmetric across each face", () => {
    const { planes } = gableRoofGeometry({ rect: { x0: -6, x1: 6, z0: -4, z1: 4 }, wallPlateY: BASE, pitchDeg: 30, overhang: 0.5 });
    const layout = seamLayout(planes[0], STANDING_SEAM_PAN);
    expect(layout.pans).toBe(Math.round(13 / STANDING_SEAM_PAN));
    expect(layout.spacing * layout.pans).toBeCloseTo(13);
    expect(Math.abs(layout.spacing - STANDING_SEAM_PAN)).toBeLessThan(STANDING_SEAM_PAN / (2 * layout.pans) + 1e-9);
    expect(layout.positions[0] + layout.positions[layout.pans]).toBeCloseTo(13);
  });

  it.each([["gable", gableRoofGeometry], ["hip", hipRoofGeometry], ["butterfly", butterflyRoofGeometry]] as const)("runs every %s seam straight up its own face from the low edge", (_name, build) => {
    const { planes } = build({ rect: { x0: -6.5, x1: 6.5, z0: -4, z1: 4 }, wallPlateY: BASE, pitchDeg: 24, overhang: 0.7 });
    for (const plane of planes) {
      const ribs = buildSeamRibs([plane], STANDING_SEAM_PAN, RIB);
      expect(ribs.length / RIB_FLOATS).toBeGreaterThan(3);
      const d = (p: V3, axis: V3) => (p[0] - plane.origin[0]) * axis[0] + (p[1] - plane.origin[1]) * axis[1] + (p[2] - plane.origin[2]) * axis[2];
      for (let r = 0; r < ribs.length; r += RIB_FLOATS) {
        const points = Array.from({ length: RIB_FLOATS / 3 }, (_, i): V3 => [ribs[r + i * 3], ribs[r + i * 3 + 1], ribs[r + i * 3 + 2]]);
        const span = (axis: V3) => Math.max(...points.map((p) => d(p, axis))) - Math.min(...points.map((p) => d(p, axis)));
        // Long up the slope, one rib wide along the eave, one rib high off the face — and never below it.
        expect(span(plane.up)).toBeGreaterThan(0.15);
        expect(span(plane.along)).toBeCloseTo(RIB.width);
        expect(span(plane.normal)).toBeCloseTo(RIB.height);
        expect(Math.min(...points.map((p) => d(p, plane.normal)))).toBeGreaterThan(-1e-9);
      }
    }
  });

  it("stops a hip face's seams at the hip line, so they shorten toward the corners", () => {
    const { planes } = hipRoofGeometry({ rect: { x0: -6.5, x1: 6.5, z0: -4, z1: 4 }, wallPlateY: BASE, pitchDeg: 24, overhang: 0.7 });
    const ribs = buildSeamRibs([planes[0]], STANDING_SEAM_PAN, RIB);
    const tops = Array.from({ length: ribs.length / RIB_FLOATS }, (_, r) => Math.max(...ribs.slice(r * RIB_FLOATS, (r + 1) * RIB_FLOATS).filter((_, i) => i % 3 === 1)));
    expect(tops[0]).toBeLessThan(tops[Math.floor(tops.length / 2)] - 1);
    expect(tops[tops.length - 1]).toBeCloseTo(tops[0]);
  });

  it("emits the seams as one mesh in the roof's own finish", () => {
    const { mesh } = compileRoof({ kind: "gable", pitch: 30, overhang: 0.5 }, SEAM);
    const pans = Math.round(13 / STANDING_SEAM_PAN);
    expect(mesh("seams")!.vertices.length).toBe(2 * (pans + 1) * RIB_FLOATS);
    expect(mesh("seams")!.color).toBe(mesh("surface")!.color);
  });
});

describe("tile / shingle: courses fitted to each face", () => {
  it("gives every face a whole number of courses at close to the covering's exposure, aligned around a hip", () => {
    const { planes } = hipRoofGeometry({ rect: { x0: -6.5, x1: 6.5, z0: -4, z1: 4 }, wallPlateY: BASE, pitchDeg: 27, overhang: 0.6 });
    const clay = tileModuleFor("terracotta");
    const layouts = planes.map((p) => courseLayout(p, clay));
    for (const l of layouts) {
      expect(Number.isInteger(l.courses) && Number.isInteger(l.units)).toBe(true);
      expect(Math.abs(l.exposure - clay[1])).toBeLessThan(clay[1] / (2 * l.courses) + 1e-9);
      expect(Math.abs(l.unit - clay[0])).toBeLessThan(clay[0] / (2 * l.units) + 1e-9);
    }
    expect(new Set(layouts.map((l) => l.courses)).size).toBe(1);
  });

  it("carries fitted pattern coordinates on the surface mesh: 0 at the eave, a whole course count at the ridge", () => {
    const surface = compileRoof({ kind: "gable", pitch: 35, overhang: 0.5 }, CLAY).mesh("surface")!;
    expect(surface).toMatchObject({ surface: "terracotta", uvModule: [0.17, 0.3] });
    expect(surface.uvs).toHaveLength((surface.vertices.length / 3) * 2);
    const slope = 4.5 / Math.cos((35 * Math.PI) / 180);
    const us = surface.uvs!.filter((_, i) => i % 2 === 0), vs = surface.uvs!.filter((_, i) => i % 2 === 1);
    expect([Math.min(...vs), Math.max(...vs)]).toEqual([expect.closeTo(0), expect.closeTo(Math.round(slope / 0.3))]);
    expect([Math.min(...us), Math.max(...us)]).toEqual([expect.closeTo(0), expect.closeTo(Math.round(13 / 0.17))]);
    // Courses run with the eave: every vertex at ridge height is on the last course line.
    surface.vertices.forEach((y, i) => { if (i % 3 === 1 && Math.abs(y - (BASE + tan(35) * 4)) < 1e-6) expect(vs[(i - 1) / 3]).toBeCloseTo(Math.round(slope / 0.3)); });
  });

  it("lays slate at its own smaller module", () => {
    expect(compileRoof({ kind: "gable", pitch: 38 }, roofZone({ material: "slate", color: "#5a5c60" })).mesh("surface")!.uvModule).toEqual([0.3, 0.2]);
  });

  it("maps a module onto one texture unit/course of a gridded texture, and in metres otherwise", () => {
    expect([...fittedTextureUvs([0, 0, 19, 11], [0.17, 0.3], 1.6, { cols: 19, rows: 11, phase: [0, 0.5] })]).toEqual([0, expect.closeTo(0.5 / 11), 1, expect.closeTo(11.5 / 11)]);
    expect([...fittedTextureUvs([10, 4], [0.16, 0.19], 1.3)]).toEqual([expect.closeTo(1.6 / 1.3), expect.closeTo(0.76 / 1.3)]);
  });
});

describe("flat roofs: parapet coping or drip edge", () => {
  it("caps a parapet with a coping that sits on its top and laps both faces", () => {
    const { mesh, roof } = compileRoof({ kind: "flat", overhang: 0, parapet: { height: 0.5, thickness: 0.2 } }, roofZone({ material: "concrete", color: "#b9b5aa" }));
    const parapetTop = BASE + 0.25 + 0.5;
    const coping = bounds(mesh("coping")!.vertices);
    expect(coping.y).toEqual([expect.closeTo(parapetTop), expect.closeTo(parapetTop + 0.05)]);
    expect(coping.x).toEqual([expect.closeTo(-6.03), expect.closeTo(6.03)]);
    expect(mesh("drip-edge")).toBeUndefined();
    expect(roof.filter((p) => p.id.includes("-parapet-"))).toHaveLength(4);
  });

  it("gives an eaved flat roof a drip edge along its rim, inside the authored overhang", () => {
    const { mesh } = compileRoof({ kind: "floating-flat", overhang: 0.9, expression: { verticalGap: 0.3 } }, roofZone({ material: "concrete", color: "#b9b5aa" }));
    const deckTop = BASE + 0.3 + 0.25;
    const drip = bounds(mesh("drip-edge")!.vertices);
    expect(drip.y).toEqual([expect.closeTo(deckTop), expect.closeTo(deckTop + 0.04)]);
    expect(drip.x).toEqual([expect.closeTo(-6.9), expect.closeTo(6.9)]);
    expect(mesh("coping")).toBeUndefined();
  });
});

describe("draw calls and determinism", () => {
  const roofIds = (primitives: readonly HousePrimitive[]) => primitives.filter((p) => p.category === "roof").map((p) => p.id.replace("architecture-house-roof-", ""));

  it("finishes a pitched roof in a handful of merged meshes", () => {
    expect(roofIds(compileRoof({ kind: "gable", pitch: 30 }, SEAM).roof)).toEqual(["infill", "surface", "seams", "trim"]);
    expect(roofIds(compileRoof({ kind: "hip", pitch: 30 }, SEAM).roof)).toEqual(["surface", "seams", "trim"]);
    expect(roofIds(compileRoof({ kind: "hip", pitch: 30 }, CLAY).roof)).toEqual(["surface", "trim", "caps"]);
    expect(roofIds(compileRoof({ kind: "butterfly", pitch: 8 }, SEAM).roof)).toEqual(["infill", "surface", "seams", "trim"]);
    expect(roofIds(compileRoof({ kind: "mono-pitch", pitch: 12 }, SEAM).roof)).toEqual(["infill", "surface", "seams", "trim"]);
  });

  it("adds exactly one trim mesh to a flat roof", () => {
    const flat = roofIds(compileRoof({ kind: "flat", overhang: 0.5 }, SEAM).roof);
    expect(flat.filter((id) => id === "drip-edge" || id === "coping" || id === "seams")).toEqual(["seams", "drip-edge"]);
    expect(roofIds(compileRoof({ kind: "flat", overhang: 0.5 }, CLAY).roof).slice(-1)).toEqual(["drip-edge"]);
  });

  it("keeps a merged roof within one roof per mass on an articulated footprint", () => {
    const { doc } = { doc: { ...ROOF_SYSTEM_FIXTURES.tileHip.doc } };
    const lShaped = { ...doc, massing: { ...doc.massing, masses: [{ ...doc.massing.masses[0], operations: [{ type: "notch" as const, corner: "se" as const, width: 5, depth: 3 }] }] } };
    const { model, diagnostics } = compileArchitecture(lShaped, { materials: CLAY });
    expect(diagnostics?.geometry[0].topFloorRectCount).toBe(2);
    expect(roofIds(model.primitives)).toEqual(["surface", "trim", "caps"]);
  });

  it.each(Object.keys(ROOF_SYSTEM_FIXTURES))("compiles fixture %s identically every time, with only procedural primitives", (key) => {
    const { doc, materials } = ROOF_SYSTEM_FIXTURES[key];
    const first = compileArchitecture(doc, { materials }), second = compileArchitecture(doc, { materials });
    expect(first.errors).toEqual([]);
    expect(second.model).toEqual(first.model);
    expect(first.model.primitives.every((p) => p.kind === "box" || p.kind === "triMesh")).toBe(true);
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const summary = first.model.primitives.filter((p) => p.category === "roof").map((p) => {
      if (p.kind === "box") return `${p.id} box ${p.color}${p.surface ? ` ${p.surface}` : ""} @${p.position.map(round)} ${p.size.map(round)}`;
      const b = bounds(p.vertices);
      return `${p.id} mesh ${p.color}${p.surface ? ` ${p.surface}` : ""} tris=${p.vertices.length / 9}${p.uvModule ? ` module=${p.uvModule}` : ""} x=${b.x.map(round)} y=${b.y.map(round)} z=${b.z.map(round)}`;
    });
    expect({ systems: first.diagnostics?.roofSystems, roof: summary }).toMatchSnapshot();
  });
});
