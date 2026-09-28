import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateGlb } from "@/lib/assets/glbValidator";
import { buildAsset, expandParts, type BuiltAsset } from "../build";
import { buildLadder, costGuidance, estimateTriangles, partTriangles, thinParts } from "../budget";
import { exportGlb } from "../glb";
import * as P from "../primitives";
import { repairSpec } from "../repair";
import { cleanLooseSpec, specOutputSchema, validateSpec, type AssetPart, type AssetSpec } from "../spec";
import { DETAIL_LEVELS, resolveSurface, STYLE_PROFILE } from "../styleProfile";
import { SAMPLES } from "./fixtures";
import { encodePng, renderAsset } from "./render";

const built = (spec: unknown): BuiltAsset => {
  const r = buildAsset(spec);
  if (!r.ok) throw new Error(r.error);
  return r.asset;
};
const tris = (g: { getAttribute: (n: string) => { count: number } }) => g.getAttribute("position").count / 3;

describe("triangle estimator matches the real builders", () => {
  const parts: Record<string, AssetPart> = {
    box: { primitive: "box", role: "b", material: "m", position: [0, 0, 0], size: [0.3, 0.2, 0.1] },
    thinBox: { primitive: "box", role: "b", material: "m", position: [0, 0, 0], size: [0.02, 0.06, 0.5] },
    panel: { primitive: "panel", role: "p", material: "m", position: [0, 0, 0], size: [0.5, 0.5, 0.03] },
    cushion: { primitive: "cushion", role: "c", material: "m", position: [0, 0, 0], size: [0.5, 0.1, 0.5], puff: 0.6 },
    cylinder: { primitive: "cylinder", role: "c", material: "m", position: [0, 0, 0], radius: 0.1, height: 0.2 },
    tapered: { primitive: "taperedCylinder", role: "c", material: "m", position: [0, 0, 0], radiusBottom: 0.1, radiusTop: 0.2, height: 0.3 },
    roundedRect: { primitive: "roundedRect", role: "r", material: "m", position: [0, 0, 0], width: 0.6, depth: 0.4, height: 0.05, cornerRadius: 0.06 },
    squareRect: { primitive: "roundedRect", role: "r", material: "m", position: [0, 0, 0], width: 0.6, depth: 0.4, height: 0.05, cornerRadius: 0 },
    tube: { primitive: "tube", role: "t", material: "m", position: [0, 0, 0], path: [[0, 0, 0], [0, 0.3, 0.1], [0.2, 0.5, 0.1]], radius: 0.015 },
    slats: { primitive: "slatArray", role: "s", material: "m", position: [0, 0, 0], count: 9, slatSize: [0.5, 0.02, 0.06], gap: 0.02, axis: "z" },
    curved: { primitive: "curvedSurface", role: "c", material: "m", position: [0, 0, 0], radius: 0.3, arcDegrees: 90, height: 0.4, thickness: 0.03 },
    dome: { primitive: "lattice", role: "l", material: "m", position: [0, 0, 0], form: "dome", radiusBottom: 0.25, height: 0.3, ribs: 16, bands: 5, strand: 0.02, weave: true },
    domeOpen: { primitive: "lattice", role: "l", material: "m", position: [0, 0, 0], form: "dome", radiusBottom: 0.25, radiusTop: 0.08, height: 0.3, ribs: 12, bands: 4, strand: 0.02, weave: true },
    basket: { primitive: "lattice", role: "l", material: "m", position: [0, 0, 0], form: "tapered", radiusBottom: 0.18, radiusTop: 0.24, height: 0.4, ribs: 14, bands: 6, strand: 0.025, weave: false },
    panelLattice: { primitive: "lattice", role: "l", material: "m", position: [0, 0, 0], form: "panel", width: 0.5, height: 0.6, ribs: 10, bands: 8, strand: 0.025, weave: true },
  };
  const cases = Object.entries(parts).flatMap(([name, part]) => DETAIL_LEVELS.map((detail) => [name, detail, part] as const));

  it.each(cases)("%s @ %s", (name, detail, part) => {
    const ctx = { detail, bevel: 1 };
    const partGeometry = (): ReturnType<typeof P.beveledBox> => {
      switch (part.primitive) {
        case "box": return P.beveledBox(part.size, ctx);
        case "panel": return P.panel(part.size, ctx);
        case "cushion": return P.cushion(part.size, part.puff, ctx);
        case "cylinder": return P.cylinder(part.radius, part.height, ctx);
        case "taperedCylinder": return P.taperedCylinder(part.radiusBottom, part.radiusTop, part.height, ctx);
        case "roundedRect": return P.roundedRect(part.width, part.depth, part.height, part.cornerRadius, ctx);
        case "tube": return P.tube(part.path, part.radius, ctx);
        case "slatArray": return P.slatArray(part.count, part.slatSize, part.gap, part.axis, ctx);
        case "curvedSurface": return P.curvedSurface(part.radius, part.arcDegrees, part.height, part.thickness, ctx);
        case "lattice": return P.lattice(part, ctx);
      }
    };
    const actual = tris(partGeometry());
    const estimated = partTriangles(part, { detail, leanCushion: false });
    expect(estimated, name).toBe(actual);
  });

  it("square-edges small boxes when asked, at 12 triangles", () => {
    expect(tris(P.beveledBox([0.02, 0.06, 0.5], { detail: "medium", bevel: 1, flatBelow: 0.045 }))).toBe(12);
    expect(tris(P.beveledBox([0.06, 0.06, 0.5], { detail: "medium", bevel: 1, flatBelow: 0.045 }))).toBe(92);
    expect(partTriangles(parts.thinBox, { detail: "medium", flatBelow: 0.045, leanCushion: false })).toBe(12);
  });

  it("sizes a whole spec exactly", () => {
    const s = validateSpec(SAMPLES.deckChair);
    if (!s.ok) throw new Error(s.error);
    const a = built(SAMPLES.deckChair);
    expect(estimateTriangles(expandParts(s.spec.parts), { detail: a.detail, leanCushion: false })).toBe(a.triangles);
  });

  it("publishes a compact cost table computed from the estimator", () => {
    const table = costGuidance();
    expect(table).toContain("TRIANGLE COSTS");
    expect(table).toContain(`${partTriangles(parts.box, { detail: "medium", leanCushion: false })} [`);
    expect(table.length).toBeLessThan(2200);
  });
});

describe("thinning keeps the silhouette", () => {
  const slats = (count: number): AssetPart => ({ primitive: "slatArray", role: "s", material: "m", position: [0, 0, 0], count, slatSize: [0.5, 0.02, 0.06], gap: 0.02, axis: "z" });
  const extent = (p: AssetPart) => (p.primitive === "slatArray" ? p.count * p.slatSize[2] + (p.count - 1) * p.gap : 0);

  it("keeps a slat array's span and fill ratio while cutting the count", () => {
    const [thin] = thinParts([slats(20)], { density: 0.5 }) as Extract<AssetPart, { primitive: "slatArray" }>[];
    expect(thin.count).toBe(10);
    expect(extent(thin)).toBeCloseTo(extent(slats(20)), 6);
    expect(thin.slatSize[2] / (thin.slatSize[2] + thin.gap)).toBeCloseTo(0.06 / 0.08, 6);
  });

  it("never thins below 3, never touches short arrays or structural repeats", () => {
    expect((thinParts([slats(20)], { density: 0.05 })[0] as { count: number }).count).toBe(3);
    expect(thinParts([slats(3)], { density: 0.4 })[0]).toEqual(slats(3));
    const shelf: AssetPart = { primitive: "box", role: "shelf", material: "m", position: [0, 0, 0], size: [0.8, 0.3, 0.3], repeat: { count: 6, step: [0, 0.4, 0] } };
    expect(thinParts([shelf], { density: 0.3 })[0]).toBe(shelf);
  });

  it("thins fine repeated parts to the same overall run", () => {
    const rungs: AssetPart = { primitive: "box", role: "rung", material: "m", position: [0, 0, 0], size: [0.4, 0.02, 0.02], repeat: { count: 13, step: [0, 0.05, 0] } };
    const thin = thinParts([rungs], { density: 0.5 })[0];
    expect(thin.repeat!.count).toBe(7);
    expect(thin.repeat!.step[1] * (thin.repeat!.count - 1)).toBeCloseTo(0.05 * 12, 6);
  });

  it("caps at the family's slat limit", () => {
    expect((thinParts([slats(20)], { density: 1, maxSlats: 8 })[0] as { count: number }).count).toBe(8);
  });

  it("tries density before detail and ends at the lowest, cheapest rung", () => {
    const ladder = buildLadder("medium");
    expect(ladder[0]).toMatchObject({ detail: "medium", density: 1 });
    const firstDrop = ladder.findIndex((p) => p.detail === "low");
    expect(ladder.slice(0, firstDrop).every((p) => p.detail === "medium")).toBe(true);
    expect(ladder.slice(0, firstDrop).map((p) => p.density)).toEqual([...ladder.slice(0, firstDrop).map((p) => p.density)].sort((a, b) => b - a));
    expect(ladder.at(-1)).toMatchObject({ detail: "low", density: 0.35 });
    expect(new Set(ladder.map((p) => JSON.stringify(p))).size).toBe(ladder.length);
  });
});

describe("a slat-heavy chaise that overshoots its budget still builds", () => {
  // 3 arrays × 24 slats plus frame and cushion: ~9,000 triangles at medium as written.
  const chaise = {
    family: "lounger", name: "Slatted Pool Chaise", style: "resort", bevel: 1, detailLevel: "medium",
    dimensions: { width: 0.75, depth: 2.0, height: 0.85 },
    materials: [{ key: "teak", material: "wood", color: "#8a5a2b" }, { key: "cushion", material: "stucco", color: "#f1ead8" }],
    parts: [
      { primitive: "box", role: "leg", material: "teak", size: [0.05, 0.3, 0.05], position: [0.3, 0.15, 0.8], mirror: "xz" },
      { primitive: "box", role: "rail", material: "teak", size: [0.05, 0.08, 1.9], position: [0.33, 0.32, 0], mirror: "x" },
      { primitive: "slatArray", role: "deck", material: "teak", count: 24, slatSize: [0.6, 0.02, 0.03], gap: 0.01, axis: "z", position: [0, 0.34, 0.2] },
      { primitive: "slatArray", role: "back", material: "teak", count: 24, slatSize: [0.6, 0.03, 0.02], gap: 0.01, axis: "y", position: [0, 0.6, -0.9], rotation: [-40, 0, 0] },
      { primitive: "slatArray", role: "under", material: "teak", count: 24, slatSize: [0.5, 0.02, 0.03], gap: 0.01, axis: "z", position: [0, 0.3, 0.2] },
      { primitive: "cushion", role: "pad", material: "cushion", size: [0.6, 0.08, 1.3], position: [0, 0.4, 0.2], puff: 0.6 },
    ],
  };

  it("caps slat arrays for the family and keeps the footprint", () => {
    const a = built(chaise);
    expect(a.triangles).toBeLessThanOrEqual(STYLE_PROFILE.triangleBudget[a.detail]);
    expect(a.detail).toBe("medium");
    expect(a.size).toEqual(chaise.dimensions);
    expect(a.notes.join(" ")).toMatch(/Slat arrays held to 10/);
  });

  it("thins by density (then square-edges small parts) when a family without a slat cap is over budget", () => {
    const pergola = {
      family: "pergola", name: "Slatted Pergola", style: "modern", bevel: 1, detailLevel: "medium",
      dimensions: { width: 3, depth: 3, height: 2.6 },
      materials: [{ key: "wood", material: "cedar", color: "#7a4d2a" }],
      parts: [
        { primitive: "box", role: "post", material: "wood", size: [0.15, 2.5, 0.15], position: [1.4, 1.25, 1.4], mirror: "xz" },
        { primitive: "slatArray", role: "rafter", material: "wood", count: 24, slatSize: [3, 0.06, 0.05], gap: 0.07, axis: "z", position: [0, 2.53, 0] },
        { primitive: "slatArray", role: "purlin", material: "wood", count: 24, slatSize: [0.05, 0.06, 3], gap: 0.07, axis: "x", position: [0, 2.59, 0] },
        { primitive: "slatArray", role: "shade-slat", material: "wood", count: 24, slatSize: [0.05, 0.03, 3], gap: 0.07, axis: "x", position: [0, 2.48, 0] },
      ],
    };
    const s = validateSpec(pergola);
    if (!s.ok) throw new Error(s.error);
    expect(estimateTriangles(expandParts(s.spec.parts), { detail: "medium", leanCushion: false })).toBeGreaterThan(STYLE_PROFILE.triangleBudget.medium);
    const a = built(pergola);
    expect(a.triangles).toBeLessThanOrEqual(STYLE_PROFILE.triangleBudget[a.detail]);
    expect(a.detail).toBe("medium");
    expect(a.notes.join(" ")).toMatch(/thinned repeated slats and ribs to \d+%/);
    expect(a.size).toEqual(pergola.dimensions);
  });

  it("holds deck chairs and loungers at medium detail even when the model asks for high", () => {
    const a = built({ ...chaise, detailLevel: "high" });
    expect(a.detail).not.toBe("high");
    expect(a.triangles).toBeLessThanOrEqual(STYLE_PROFILE.triangleBudget.medium);
    expect(a.notes.join(" ")).toMatch(/held at medium/i);
  });
});

describe("spec repair: cosmetic slips are fixed, unsafe specs still fail", () => {
  const base = SAMPLES.deckChair;
  const withPart = (patch: Record<string, unknown>) => ({ ...base, parts: [{ ...base.parts[0], ...patch }, ...base.parts.slice(1)] });
  const ok = (raw: unknown) => {
    const r = validateSpec(raw);
    if (!r.ok) throw new Error(r.error);
    return r;
  };

  it.each([
    ["a style sentence", { ...base, style: "A tropical rustic teak resort look with woven accents and a relaxed feel" }],
    ["an over-long name", { ...base, name: "N".repeat(200) }],
    ["a long part role", withPart({ role: "front leg of the chair that touches the ground at the front left corner" })],
    ["a rotation of 270 degrees", withPart({ rotation: [270, 0, 0] })],
    ["a two-number rotation", withPart({ rotation: [10, 20] })],
    ["a bevel of 5", withPart({ bevel: 5 })],
    ["an asset bevel of 9", { ...base, bevel: 9 }],
    ["an unknown detail level", { ...base, detailLevel: "Ultra" }],
    ["a shouted family", { ...base, family: "Deck Chair" }],
    ["an out-of-range targetTriangles", { ...base, targetTriangles: 12 }],
    ["mirror written as 'both'", withPart({ mirror: "both" })],
    ["a repeat of 40", withPart({ repeat: { count: 40, step: [0, 0.01, 0] } })],
    ["a repeat of 1", withPart({ repeat: { count: 1, step: [0, 0.01, 0] } })],
    ["a material key in the wrong case", withPart({ material: " TEAK " })],
    ["a #rgb colour", { ...base, materials: [{ ...base.materials[0], color: "#8a5" }, base.materials[1]] }],
    ["a css colour name", { ...base, materials: [{ ...base.materials[0], color: "SaddleBrown" }, base.materials[1]] }],
    ["a colour with alpha", { ...base, materials: [{ ...base.materials[0], color: "#8a5a2bff" }, base.materials[1]] }],
    ["a material synonym", { ...base, materials: [{ ...base.materials[0], material: "Teak" }, base.materials[1]] }],
    ["roughness above 1", { ...base, materials: [{ ...base.materials[0], roughness: 4 }, base.materials[1]] }],
    ["a box sized by width/height/depth", withPart({ size: undefined, width: 0.05, height: 0.4, depth: 0.05 })],
    ["a paper-thin film", { ...base, parts: [...base.parts, { primitive: "panel", role: "film", material: "teak", size: [0.3, 0.3, 0.001], position: [0, 0.3, 0] }] }],
  ])("repairs %s", (_l, raw) => {
    const r = ok(raw);
    expect(r.notes.length).toBeGreaterThan(0);
    // Idempotent: a repaired spec repairs to itself with nothing left to report.
    const again = ok(r.spec);
    expect(again.spec).toEqual(r.spec);
    expect(again.notes).toEqual([]);
    expect(buildAsset(raw).ok).toBe(true);
  });

  it("wraps rotations, keeps positions, and re-files a 2 m 'deck chair' as a lounger", () => {
    expect(ok(withPart({ rotation: [270, 0, 0] })).spec.parts[0].rotation).toEqual([-90, 0, 0]);
    expect(ok(withPart({ position: [0.27, 0.2, 0.34] })).spec.parts[0].position).toEqual([0.27, 0.2, 0.34]);
    expect(ok({ ...base, dimensions: { width: 0.62, depth: 2.0, height: 0.95 } }).spec.family).toBe("lounger");
  });

  it("brings a slightly-too-big size inside the family range", () => {
    const r = ok({ ...SAMPLES.barStool, dimensions: { width: 0.44, depth: 0.44, height: 1.2 } });
    expect(r.spec.dimensions.height).toBe(1.1);
  });

  it("thickens thin parts instead of rejecting them", () => {
    const r = ok({ ...base, parts: [...base.parts, { primitive: "panel", role: "film", material: "teak", size: [0.3, 0.3, 0.001], position: [0, 0.3, 0] }] });
    expect(r.spec.parts.at(-1)).toMatchObject({ size: [0.3, 0.3, STYLE_PROFILE.minPartThickness] });
  });

  it("keeps the strict geometry-safety failures", () => {
    const zero = withPart({ size: [0.05, 0, 0.05] });
    const cases: [string, unknown, RegExp][] = [
      ["a zero dimension", zero, /positive/],
      ["a negative radius", { ...SAMPLES.barStool, parts: [{ ...SAMPLES.barStool.parts[1], radius: -1 }, ...SAMPLES.barStool.parts] }, /positive/],
      ["a NaN position", withPart({ position: [NaN, 0, 0] }), /finite/],
      ["an infinite dimension", { ...base, dimensions: { ...base.dimensions, height: Infinity } }, /finite/],
      ["an unknown primitive", withPart({ primitive: "blob" }), /unknown primitive/],
      ["an unknown material reference", withPart({ material: "gold" }), /unknown material/],
      ["an unknown material type", { ...base, materials: [{ ...base.materials[0], material: "unobtainium" }, base.materials[1]] }, /unknown material/],
      ["an unreadable colour", { ...base, materials: [{ ...base.materials[0], color: "not a colour" }, base.materials[1]] }, /hex colour/],
      ["a wildly wrong size", { ...base, dimensions: { width: 0.62, depth: 1.0, height: 4 } }, /outside the realistic/],
      ["a missing position", withPart({ position: undefined }), /position/],
      ["a one-point tube", { ...SAMPLES.barStool, parts: [{ ...SAMPLES.barStool.parts[2], path: [[0, 0, 0]] }, ...SAMPLES.barStool.parts] }, /two/],
      ["a size that cannot be found", withPart({ size: undefined }), /size/],
    ];
    for (const [label, raw, re] of cases) {
      const r = validateSpec(raw);
      expect(r.ok, label).toBe(false);
      expect(!r.ok && r.error, label).toMatch(re);
    }
  });

  it("reads loose model output, nulls and all", () => {
    const loose = {
      family: "stool", name: null, dimensions: { width: 0.5, depth: 0.41, height: 0.46 }, style: "tropical", bevel: null, detailLevel: null, targetTriangles: null,
      materials: [{ key: "teak", material: "wood", color: "#8a5a2b", roughness: null, emissiveColor: null }],
      parts: [
        { primitive: "box", role: "leg", material: "teak", position: [0.2, 0.2, 0.2], size: [0.05, 0.4, 0.05], rotation: null, mirror: "xz", repeat: null, bevel: null, radius: null },
        { primitive: "slatArray", role: "seat", material: "teak", position: [0, 0.4, 0], count: 6, slatSize: [0.5, 0.02, 0.06], gap: 0.02, axis: "z", mirror: null },
      ],
    };
    const parsed = specOutputSchema.safeParse(loose);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(buildAsset(cleanLooseSpec(parsed.data)).ok).toBe(true);
  });

  it("resolves a material TYPE to its slot only when exactly one slot has that type", () => {
    const b = SAMPLES.barStool; // slots: leather (stucco), steel (metal)
    const byType = (material: string) => validateSpec({ ...b, parts: [...b.parts, { primitive: "cylinder", role: "axle", material, radius: 0.02, height: 0.1, position: [0, 0.1, 0] }] });
    const ok = byType("metal");
    expect(ok.ok && ok.spec.parts.at(-1)?.material).toBe("steel");
    expect(byType("wood").ok).toBe(false);
    const twoMetals = { ...b, materials: [...b.materials, { key: "brass", material: "metal", color: "#b08d57" }], parts: [...b.parts, { primitive: "cylinder", role: "axle", material: "metal", radius: 0.02, height: 0.1, position: [0, 0.1, 0] }] };
    expect(validateSpec(twoMetals).ok).toBe(false);
  });

  it("lights the obvious light source of a lamp that forgot to glow, and leaves other families alone", () => {
    const lamp = { family: "lamp", style: "modern", dimensions: { width: 0.25, depth: 0.25, height: 0.5 }, materials: [{ key: "frame", material: "metal", color: "#222" }, { key: "glass", material: "glass", color: "#cfe8f0" }, { key: "bulb", material: "glass", color: "#ffe6b0" }], parts: [{ primitive: "box", role: "base", material: "frame", size: [0.2, 0.03, 0.2], position: [0, 0.02, 0] }, { primitive: "panel", role: "pane", material: "glass", size: [0.2, 0.3, 0.014], position: [0, 0.2, 0.1] }, { primitive: "cylinder", role: "bulb", material: "bulb", radius: 0.03, height: 0.08, position: [0, 0.2, 0] }] };
    const r = validateSpec(lamp);
    expect(r.ok && r.spec.materials.filter((m) => m.emissiveColor)).toMatchObject([{ key: "bulb", emissiveColor: "#ffe6b0" }]);
    const again = validateSpec(r.ok ? r.spec : null);
    expect(again.ok && again.notes).toEqual([]);
    expect(validateSpec({ ...lamp, family: "planter", dimensions: { width: 0.25, depth: 0.25, height: 0.5 } }).ok && (validateSpec({ ...lamp, family: "planter", dimensions: { width: 0.25, depth: 0.25, height: 0.5 } }) as { spec: AssetSpec }).spec.materials.some((m) => m.emissiveColor)).toBe(false);
    const noBulb = validateSpec({ ...lamp, materials: [lamp.materials[0], lamp.materials[1]], parts: lamp.parts.slice(0, 2) });
    expect(noBulb.ok && noBulb.spec.materials.find((m) => m.key === "glass")?.emissiveColor).toBe("#ffd27a");
  });

  it("caps the repaired lattice grid instead of overlapping strands into a solid", () => {
    const r = repairSpec({ ...SAMPLES.deckChair, parts: [{ primitive: "lattice", role: "shade", material: "teak", position: [0, 0.5, 0], form: "dome", radiusBottom: 0.1, height: 0.2, ribs: 48, bands: 20, strand: 0.05 }, ...SAMPLES.deckChair.parts] });
    expect(r.ok && r.notes.join(" ")).toMatch(/thinned/);
  });
});

describe("lattice primitive", () => {
  const lat = (over: Record<string, unknown>) => ({ primitive: "lattice", role: "weave", material: "rattan", position: [0, 0, 0], form: "dome", radiusBottom: 0.25, height: 0.3, ribs: 16, bands: 5, strand: 0.02, weave: true, ...over }) as AssetPart;
  const outward = (g: ReturnType<typeof P.lattice>) => {
    // Every strand face must wind away from the strand's own axis; a signed volume per closed ring would be negative if flipped.
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    let agree = 0;
    for (let i = 0; i < p.count; i += 3) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = [p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      const fx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), fy = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), fz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (fx * n.getX(i) + fy * n.getY(i) + fz * n.getZ(i) >= 0) agree++;
    }
    return agree / (p.count / 3);
  };

  it("is cheap: a whole woven shade or basket is well under 2,000 triangles at medium", () => {
    for (const part of [lat({}), lat({ form: "tapered", radiusBottom: 0.18, radiusTop: 0.24, height: 0.4, ribs: 18, bands: 8 }), lat({ form: "panel", width: 0.5, height: 0.6, ribs: 12, bands: 10 })]) {
      const t = partTriangles(part, { detail: "medium", leanCushion: false });
      expect(t).toBeGreaterThan(150);
      expect(t).toBeLessThan(2000);
    }
  });

  it("has consistent, outward-facing geometry", () => {
    for (const form of ["dome", "tapered", "panel"] as const) {
      const g = P.lattice(lat({ form, width: 0.5 }) as Extract<AssetPart, { primitive: "lattice" }>, { detail: "medium", bevel: 1 });
      expect(outward(g)).toBe(1);
    }
  });

  it("builds inside a pendant with a glowing bulb, and reports its size", () => {
    const pendant = {
      family: "pendant-light", name: "Rattan Pendant", style: "boho", bevel: 1, detailLevel: "medium",
      dimensions: { width: 0.5, depth: 0.5, height: 0.9 },
      materials: [{ key: "rattan", material: "timber", color: "#b58a4f" }, { key: "cord", material: "metal", color: "#222222" }, { key: "bulb", material: "glass", color: "#ffe2a8", emissiveColor: "#ffd27a", emissiveIntensity: 2.5 }],
      parts: [
        { primitive: "tube", role: "cord", material: "cord", radius: 0.006, position: [0, 0.75, 0], path: [[0, 0.15, 0], [0, -0.05, 0]] },
        { primitive: "cylinder", role: "canopy", material: "cord", radius: 0.06, height: 0.03, position: [0, 0.89, 0] },
        lat({ position: [0, 0.4, 0], radiusBottom: 0.25, height: 0.36 }),
        { primitive: "cushion", role: "bulb", material: "bulb", size: [0.1, 0.12, 0.1], puff: 1, position: [0, 0.32, 0] },
      ],
    };
    const a = built(pendant);
    expect(a.triangles).toBeLessThan(3000);
    const dir = process.env.RENDER_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "pendant-fixture.png"), encodePng(renderAsset(a), 360, 360));
    }
  });
});

describe("emissive materials", () => {
  const lantern = {
    family: "lamp", name: "Modern Lantern", style: "modern", bevel: 1, detailLevel: "medium",
    dimensions: { width: 0.25, depth: 0.25, height: 0.5 },
    materials: [
      { key: "frame", material: "metal", color: "#222426" },
      { key: "glass", material: "glass", color: "#ffe6b0", emissiveColor: "#ffcf7a", emissiveIntensity: 3 },
      { key: "flame", material: "glass", color: "#ffd9a0", emissiveColor: "#ffb347", emissiveIntensity: 0.6 },
    ],
    parts: [
      { primitive: "box", role: "post", material: "frame", size: [0.02, 0.4, 0.02], position: [0.1, 0.22, 0.1], mirror: "xz" },
      { primitive: "box", role: "base", material: "frame", size: [0.24, 0.03, 0.24], position: [0, 0.015, 0] },
      { primitive: "box", role: "top", material: "frame", size: [0.24, 0.03, 0.24], position: [0, 0.42, 0] },
      { primitive: "panel", role: "glass", material: "glass", size: [0.18, 0.36, 0.014], position: [0, 0.22, 0.1], mirror: "z" },
      { primitive: "cylinder", role: "flame", material: "flame", radius: 0.03, height: 0.07, position: [0, 0.2, 0] },
    ],
  } satisfies Record<string, unknown>;

  it("resolves glow only where a slot asks for it", () => {
    expect(resolveSurface({ key: "a", material: "wood", color: "#8a5a2b" })).toMatchObject({ emissive: null, emissiveIntensity: 0 });
    expect(resolveSurface({ key: "a", material: "glass", color: "#ffe6b0", emissiveColor: "#ffcf7a", emissiveIntensity: 3 })).toMatchObject({ emissive: "#ffcf7a", emissiveIntensity: 3 });
    expect(resolveSurface({ key: "a", material: "glass", color: "#ffe6b0", emissiveColor: "#ffcf7a" })).toMatchObject({ emissiveIntensity: 1 });
    expect(resolveSurface({ key: "a", material: "glass", color: "#ffe6b0", emissiveIntensity: 2 })).toMatchObject({ emissive: "#ffe6b0", emissiveIntensity: 2 });
    expect(resolveSurface({ key: "a", material: "glass", color: "#ffe6b0", emissiveColor: "#ffcf7a", emissiveIntensity: 0 }).emissive).toBeNull();
  });

  it("exports emissiveFactor, with KHR_materials_emissive_strength above 1, and the GLB still validates", () => {
    const a = built(lantern);
    const glb = exportGlb(a);
    const view = new DataView(glb);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, view.getUint32(12, true))).trim());
    const by = (name: string) => json.materials.find((m: { name: string }) => m.name === name);
    expect(by("frame").emissiveFactor).toBeUndefined();
    expect(by("glass").emissiveFactor.every((v: number) => v >= 0 && v <= 1)).toBe(true);
    expect(by("glass").extensions.KHR_materials_emissive_strength.emissiveStrength).toBe(3);
    expect(by("flame").extensions).toBeUndefined();
    expect(by("flame").emissiveFactor.every((v: number) => v <= 1)).toBe(true);
    expect(json.extensionsUsed).toEqual(["KHR_materials_emissive_strength"]);
    expect(json.extensionsRequired).toBeUndefined();
    const report = validateGlb(glb, { expectedDimensions: lantern.dimensions });
    expect(report.errors).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("leaves existing assets byte-for-byte free of emissive data", () => {
    const glb = exportGlb(built(SAMPLES.deckChair));
    const text = new TextDecoder().decode(new Uint8Array(glb, 20, new DataView(glb).getUint32(12, true)));
    expect(text).not.toMatch(/emissive|extensionsUsed/);
  });

  it("rejects an out-of-range or unreadable glow by repairing it, never by failing the asset", () => {
    const r = validateSpec({ ...lantern, materials: [lantern.materials[0], { ...lantern.materials[1], emissiveIntensity: 99, emissiveColor: "warm" }, lantern.materials[2]] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spec.materials[1].emissiveIntensity).toBe(STYLE_PROFILE.emissiveIntensity.max);
  });
});
