import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { HousePrimitive } from "@/lib/house/types";
import { WALL_THICKNESS } from "@/lib/house/constants";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { glassLook } from "@/components/workspace/viewport/house/glassLook";
import { compileArchitecture } from "../../compiler";
import type { ArchitecturalDesignDocument, MassFacade, MassOpening, MassVolume } from "../../document";
import { buildFloorFootprint } from "../footprint";
import { buildEntryRecessDoor, buildGlazedWallEdge, buildMassOpenings, OPENING_FRAME, OPENING_GLASS, openingBands } from "../openings";

const materials = {
  exterior: { color: "#ffffff", roughness: 0.7, metalness: 0 },
  trim: { color: "#333333", roughness: 0.4, metalness: 0.1 },
  glass: { color: "#9dd9e8", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4 },
};

describe("buildMassOpenings", () => {
  it("builds one plain solid wall box per facade when there are no openings", () => {
    const { edges } = buildFloorFootprint(10, 8, [], 0);
    const tagged = edges.filter((e) => e.facade);
    expect(tagged.length).toBe(4);
    const { primitives, warnings } = buildMassOpenings(tagged, 10, 8, [], 0, 0, 3, "wall-0", materials);
    expect(warnings).toEqual([]);
    expect(primitives.length).toBe(4);
    expect(primitives.every((p) => p.category === "wall")).toBe(true);
    // Backward compatibility with the legacy 4-wall ring: unmodified facades keep exactly these ids.
    expect(primitives.map((p) => p.id).sort()).toEqual(["wall-0-east", "wall-0-north", "wall-0-south", "wall-0-west"]);
  });

  it("carves a glazing zone into a hollow frame + glass with solid wall above/below", () => {
    const { edges } = buildFloorFootprint(10, 8, [], 0);
    const tagged = edges.filter((e) => e.facade === "south");
    const { primitives, warnings } = buildMassOpenings(tagged, 10, 8, [
      { type: "glazing-zone", facade: "south", start: 0.2, end: 0.8, heightRatio: 0.8 },
    ], 0, 0, 3, "wall-0", materials);
    expect(warnings).toEqual([]);
    expect(primitives.some((p) => p.category === "window" && p.id.endsWith("-glass"))).toBe(true);
    expect(primitives.filter((p) => p.category === "window" && p.id.includes("-frame-")).length).toBe(4);
    // Side solid spans (outside 0.2..0.8) plus a below-sill and above-head solid strip.
    expect(primitives.filter((p) => p.category === "wall").length).toBeGreaterThan(2);
  });

  it("places an evenly-spaced window rhythm without overlapping", () => {
    const { edges } = buildFloorFootprint(12, 8, [], 0);
    const tagged = edges.filter((e) => e.facade === "north");
    const { primitives, warnings } = buildMassOpenings(tagged, 12, 8, [
      { type: "opening-rhythm", facade: "north", count: 3, width: 1.2, height: 1.5, sill: 0.9 },
    ], 0, 0, 3, "wall-0", materials);
    expect(warnings).toEqual([]);
    const glassPanes = primitives.filter((p) => p.category === "window" && p.id.endsWith("-glass"));
    expect(glassPanes.length).toBe(3);
  });

  it("degrades gracefully (skips + warns) when a zone falls in a recessed, untagged run", () => {
    const { edges } = buildFloorFootprint(10, 8, [{ type: "recess", facade: "south", start: 0.2, end: 0.8, depth: 1.5 }], 0);
    const tagged = edges.filter((e) => e.facade === "south");
    // Only the un-recessed side slivers (u < 0.2 and u > 0.8) remain tagged "south" — a zone requested deep
    // inside the recessed span (0.4..0.6) doesn't overlap either sliver and should be dropped, not crash.
    const { primitives } = buildMassOpenings(tagged, 10, 8, [
      { type: "glazing-zone", facade: "south", start: 0.4, end: 0.6, heightRatio: 0.8 },
    ], 0, 0, 3, "wall-0", materials);
    expect(primitives.every((p) => p.category === "wall")).toBe(true);
  });
});

type Box = Extract<HousePrimitive, { kind: "box" }>;
const boxes = (ps: readonly HousePrimitive[]) => ps.filter((p): p is Box => p.kind === "box");
const WALL_INSET = WALL_THICKNESS / 2;

/** A box's extent in a facade's own axes: u along the wall, y up, n along the outward normal (positive = outward). */
interface FacadeBounds { u: [number, number]; y: [number, number]; n: [number, number] }
function facadeBounds(p: Box, along: readonly [number, number], normal: readonly [number, number], origin: readonly [number, number] = [0, 0], yaw = 0): FacadeBounds {
  // Undo the box's own yaw (rotatePrimitiveY convention) so its size reads in the wall's axes.
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  const dx = p.position[0] - origin[0], dz = p.position[2] - origin[1];
  const lx = dx * c + dz * s, lz = -dx * s + dz * c;
  const u = lx * along[0] + lz * along[1], n = lx * normal[0] + lz * normal[1];
  // A box's local x/z map onto the wall's along/normal axes by whichever its size is laid out along.
  const su = Math.abs(along[0]) > 0.5 ? p.size[0] : p.size[2];
  const sn = Math.abs(normal[0]) > 0.5 ? p.size[0] : p.size[2];
  return { u: [u - su / 2, u + su / 2], y: [p.position[1] - p.size[1] / 2, p.position[1] + p.size[1] / 2], n: [n - sn / 2, n + sn / 2] };
}
const overlaps = (a: readonly [number, number], b: readonly [number, number]) => a[0] < b[1] - 1e-9 && b[0] < a[1] - 1e-9;

/** The frame members + pane of one glazed opening, and their bounds in the wall's axes. */
function glazedOpening(ps: readonly HousePrimitive[], id: string, along: readonly [number, number], normal: readonly [number, number], origin?: readonly [number, number], yaw?: number) {
  const parts = boxes(ps).filter((p) => p.id.startsWith(`${id}-`));
  const members = parts.filter((p) => p.id.startsWith(`${id}-frame-`));
  const panes = parts.filter((p) => p.id === `${id}-glass`);
  return { parts, members, panes, memberBounds: members.map((m) => facadeBounds(m, along, normal, origin, yaw)), glass: panes[0] && facadeBounds(panes[0], along, normal, origin, yaw) };
}

/**
 * The hollow-frame contract every glazed opening shares: four members whose union is exactly the authored
 * opening, a clear centre no member covers, one pane spanning that clear centre (edges captured in the members,
 * never past the opening), and the pane recessed inside the frame's depth with no face shared with a member.
 */
function expectHollowFramedGlazing(o: ReturnType<typeof glazedOpening>, opening: { u: [number, number]; y: [number, number] }, frameCenterN: number) {
  const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);
  expect(o.members.map((m) => m.id.slice(m.id.indexOf("-frame-") + 1)).sort()).toEqual(["frame-head", "frame-jamb-0", "frame-jamb-1", "frame-sill"]);
  expect(o.panes).toHaveLength(1);
  expect(o.parts).toHaveLength(5);
  // Union of the members is exactly the authored opening; no member reaches outside it.
  close(Math.min(...o.memberBounds.map((b) => b.u[0])), opening.u[0]);
  close(Math.max(...o.memberBounds.map((b) => b.u[1])), opening.u[1]);
  close(Math.min(...o.memberBounds.map((b) => b.y[0])), opening.y[0]);
  close(Math.max(...o.memberBounds.map((b) => b.y[1])), opening.y[1]);
  for (const b of o.memberBounds) {
    expect(b.u[0]).toBeGreaterThanOrEqual(opening.u[0] - 1e-9);
    expect(b.u[1]).toBeLessThanOrEqual(opening.u[1] + 1e-9);
    expect(b.y[0]).toBeGreaterThanOrEqual(opening.y[0] - 1e-9);
    expect(b.y[1]).toBeLessThanOrEqual(opening.y[1] + 1e-9);
    // Every member is the shared frame section: depth through the wall, centred on the frame plane.
    close(b.n[1] - b.n[0], OPENING_FRAME.depth);
    close((b.n[0] + b.n[1]) / 2, frameCenterN);
  }
  // Hollow: the clear opening (inside one member width all round) is covered by no member.
  const m = OPENING_FRAME.member;
  const clear = { u: [opening.u[0] + m, opening.u[1] - m] as [number, number], y: [opening.y[0] + m, opening.y[1] - m] as [number, number] };
  for (const b of o.memberBounds) expect(overlaps(b.u, clear.u) && overlaps(b.y, clear.y)).toBe(false);
  // Members never overlap one another (no co-located trim faces fighting).
  for (let i = 0; i < o.memberBounds.length; i++) for (let j = i + 1; j < o.memberBounds.length; j++) {
    const [a, b] = [o.memberBounds[i], o.memberBounds[j]];
    expect(overlaps(a.u, b.u) && overlaps(a.y, b.y)).toBe(false);
  }
  // The pane fills the clear opening (visible through the hollow frame) but never reaches past the authored opening.
  const g = o.glass!;
  expect(g.u[0]).toBeLessThan(clear.u[0]);
  expect(g.u[1]).toBeGreaterThan(clear.u[1]);
  expect(g.y[0]).toBeLessThan(clear.y[0]);
  expect(g.y[1]).toBeGreaterThan(clear.y[1]);
  expect(g.u[0]).toBeGreaterThan(opening.u[0]);
  expect(g.u[1]).toBeLessThan(opening.u[1]);
  // Thin along the facade normal, recessed inward of the frame plane, wholly inside the frame's depth.
  close(g.n[1] - g.n[0], OPENING_GLASS.thickness);
  close((g.n[0] + g.n[1]) / 2, frameCenterN - OPENING_GLASS.recess);
  const frameN = [frameCenterN - OPENING_FRAME.depth / 2, frameCenterN + OPENING_FRAME.depth / 2];
  expect(g.n[0]).toBeGreaterThan(frameN[0] + 1e-3);
  expect(g.n[1]).toBeLessThan(frameN[1] - 1e-3);
  // No pane face is coplanar with a member face (no z-fighting): its edges sit inside the members, its faces inside their depth.
  for (const b of o.memberBounds) for (const gf of [...g.u, ...g.y]) for (const bf of [...b.u, ...b.y]) expect(Math.abs(gf - bf)).toBeGreaterThan(1e-4);
}

const FACADES: { facade: MassFacade; along: [number, number]; normal: [number, number]; half: (w: number, d: number) => number }[] = [
  { facade: "north", along: [1, 0], normal: [0, -1], half: (_w, d) => d / 2 },
  { facade: "south", along: [1, 0], normal: [0, 1], half: (_w, d) => d / 2 },
  { facade: "east", along: [0, 1], normal: [1, 0], half: (w) => w / 2 },
  { facade: "west", along: [0, 1], normal: [-1, 0], half: (w) => w / 2 },
];

describe("glazed openings: hollow perimeter frame + visible recessed pane", () => {
  const W = 12, D = 8, WALL_H = 3;
  const tagged = buildFloorFootprint(W, D, [], 0).edges.filter((e) => e.facade);
  const rhythm = (facade: MassFacade): MassOpening => ({ type: "opening-rhythm", facade, count: 1, width: 1.2, height: 1.5, sill: 0.9 });

  for (const { facade, along, normal, half } of FACADES) {
    it(`builds a hollow framed window on the ${facade} facade, exactly inside the authored opening, glass recessed inward`, () => {
      const { primitives, warnings } = buildMassOpenings(tagged, W, D, [rhythm(facade)], 0, 0, WALL_H, "wall-0", materials);
      expect(warnings).toEqual([]);
      const o = glazedOpening(primitives, `wall-0-${facade}-window-0`, along, normal);
      // Authored: one 1.2m window centred on the facade, sill 0.9, 1.5 tall — on the wall's centre plane.
      expectHollowFramedGlazing(o, { u: [-0.6, 0.6], y: [0.9, 2.4] }, half(W, D) - WALL_INSET);
      // The pane is thin along this facade's own normal axis.
      const pane = o.panes[0];
      expect(Math.abs(normal[0]) > 0.5 ? pane.size[0] : pane.size[2]).toBeCloseTo(OPENING_GLASS.thickness, 9);
      // The opening is a real hole: no wall box spans it.
      for (const wall of boxes(primitives).filter((p) => p.category === "wall" && p.id.startsWith(`wall-0-${facade}`))) {
        const b = facadeBounds(wall, along, normal);
        expect(overlaps(b.u, [-0.6, 0.6]) && overlaps(b.y, [0.9, 2.4])).toBe(false);
      }
    });
  }

  it("a glazing zone uses the same hollow frame, honouring its reveal setback", () => {
    const reveal = 0.05;
    const { primitives } = buildMassOpenings(tagged.filter((e) => e.facade === "south"), W, D, [{ type: "glazing-zone", facade: "south", start: 0.25, end: 0.75, heightRatio: 0.8, reveal }], 0, 0, WALL_H, "wall-0", materials);
    const [band] = openingBands("south", W, D, [{ type: "glazing-zone", facade: "south", start: 0.25, end: 0.75, heightRatio: 0.8 }], 0, WALL_H);
    const o = glazedOpening(primitives, "wall-0-south-window-0", [1, 0], [0, 1]);
    expectHollowFramedGlazing(o, { u: [band.start * W - W / 2, band.end * W - W / 2], y: [band.sill!, band.sill! + band.height!] }, D / 2 - WALL_INSET - reveal);
  });

  it("an opening rhythm builds every window with the corrected geometry", () => {
    const { primitives } = buildMassOpenings(tagged.filter((e) => e.facade === "north"), W, D, [{ type: "opening-rhythm", facade: "north", count: 3, width: 1.2, height: 1.5, sill: 0.9 }], 0, 0, WALL_H, "wall-0", materials);
    const bands = openingBands("north", W, D, [{ type: "opening-rhythm", facade: "north", count: 3, width: 1.2, height: 1.5, sill: 0.9 }], 0, WALL_H);
    expect(bands).toHaveLength(3);
    bands.forEach((band, i) => expectHollowFramedGlazing(glazedOpening(primitives, `wall-0-north-window-${i}`, [1, 0], [0, -1]), { u: [band.start * W - W / 2, band.end * W - W / 2], y: [0.9, 2.4] }, D / 2 - WALL_INSET));
    // No solid frame plate survives anywhere.
    expect(primitives.some((p) => p.id.endsWith("-frame"))).toBe(false);
  });

  it("keeps authored opening coordinates: the bands and the solid wall around them are unchanged", () => {
    const op: MassOpening = { type: "opening-rhythm", facade: "south", count: 1, width: 1.2, height: 1.5, sill: 0.9 };
    expect(openingBands("south", W, D, [op], 0, WALL_H)).toEqual([{ start: 0.45, end: expect.closeTo(0.55, 12), sill: 0.9, height: 1.5 }]);
    const { primitives } = buildMassOpenings(tagged.filter((e) => e.facade === "south"), W, D, [op], 0, 0, WALL_H, "wall-0", materials);
    const walls = boxes(primitives).filter((p) => p.category === "wall").map((p) => ({ id: p.id, position: p.position.map((v) => +v.toFixed(9)), size: p.size.map((v) => +v.toFixed(9)) }));
    expect(walls).toEqual([
      { id: "wall-0-south-0", position: [-3.3, 1.5, 3.9], size: [5.4, 3, 0.2] },
      { id: "wall-0-south-1-sill-wall", position: [0, 0.45, 3.9], size: [1.2, 0.9, 0.2] },
      { id: "wall-0-south-1-head-wall", position: [0, 2.7, 3.9], size: [1.2, 0.6, 0.2] },
      { id: "wall-0-south-2", position: [3.3, 1.5, 3.9], size: [5.4, 3, 0.2] },
    ]);
  });

  it("a glazed chamfer builds the same hollow frame along the angled cut, glass recessed toward the interior", () => {
    const footprint = buildFloorFootprint(W, D, [{ type: "chamfer", corner: "se", size: 3, glazed: true }], 0);
    const edge = footprint.edges.find((e) => e.chamfer?.glazed)!;
    expect(edge).toBeDefined();
    const ps = buildGlazedWallEdge(edge, 0, WALL_H, "wall-0-cut-0", materials);
    const dx = edge.b[0] - edge.a[0], dz = edge.b[1] - edge.a[1], len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    // In the box's own (unrotated) frame: along = local z, outward normal = local x.
    const mid: [number, number] = [(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2];
    const o = glazedOpening(ps, "wall-0-cut-0-window", [0, 1], [1, 0], mid, yaw);
    for (const p of o.parts) expect(p.rotation).toEqual([0, yaw, 0]);
    const head = Math.min(0.3, WALL_H * 0.1);
    expectHollowFramedGlazing(o, { u: [-len / 2, len / 2], y: [0, WALL_H - head] }, -WALL_INSET);
    // Inward really is toward the mass: the pane sits closer to the footprint centre than the frame plane.
    const frameCenter = [mid[0] - (dz / len) * WALL_INSET, mid[1] + (dx / len) * WALL_INSET];
    const pane = o.panes[0];
    expect(Math.hypot(pane.position[0], pane.position[2])).toBeLessThan(Math.hypot(frameCenter[0], frameCenter[1]));
  });
});

describe("doors stay opaque", () => {
  const tagged = buildFloorFootprint(12, 8, [], 0).edges.filter((e) => e.facade === "south");

  it("a facade door keeps its solid leaf: no hollow frame, the panel fully hidden inside it", () => {
    const { primitives } = buildMassOpenings(tagged, 12, 8, [{ type: "door", facade: "south", start: 0.45, end: 0.55 }], 0, 0, 3, "wall-0", materials);
    const parts = boxes(primitives).filter((p) => p.category === "window" && p.id.startsWith("wall-0-south-door-0-"));
    expect(parts.map((p) => p.id).sort()).toEqual(["wall-0-south-door-0-frame", "wall-0-south-door-0-panel"]);
    const [leaf, panel] = [parts.find((p) => p.id.endsWith("-frame"))!, parts.find((p) => p.id.endsWith("-panel"))!];
    expect(leaf.transparent).toBeFalsy();
    expect(leaf.size).toEqual([expect.closeTo(1.2, 9), 2.4, OPENING_FRAME.depth]);
    for (const axis of [0, 1, 2]) expect(panel.size[axis]).toBeLessThan(leaf.size[axis]);
    expect(panel.position).toEqual(leaf.position);
    expect(panel.surface).toBeUndefined();
  });

  it("an entry-recess door is unchanged: one solid door frame enclosing its panel", () => {
    const edge = { a: [-1.5, 2] as [number, number], b: [1.5, 2] as [number, number] };
    const ps = boxes(buildEntryRecessDoor(edge, { width: 1.2, height: 2.4, frame: false }, 0, 3, "wall-0-entry-0", materials));
    expect(ps.filter((p) => p.category === "window").map((p) => p.id)).toEqual(["wall-0-entry-0-door-frame", "wall-0-entry-0-door-panel"]);
    expect(ps.some((p) => p.id.includes("-jamb-") && p.category === "window")).toBe(false);
    expect(ps.find((p) => p.id.endsWith("-door-panel"))!.surface).toBeUndefined();
  });
});

describe("rotated masses", () => {
  const compileWith = (rotation: number) => {
    const openings: MassOpening[] = FACADES.map(({ facade }) => ({ type: "opening-rhythm", facade, count: 2, width: 1.1, height: 1.4, sill: 0.9 }));
    const mass: MassVolume = { id: "m", name: "m", role: "main-living", position: { x: 4, z: -3 }, width: 12, depth: 8, floors: 1, elevation: 0, rotation, openings };
    const doc: ArchitecturalDesignDocument = {
      version: 1, brief: "test", siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
      massing: { composition: "rectangular-pavilion", masses: [mass] }, roofs: { recipes: [{ id: "r", massId: "m", kind: "flat" }] },
      facade: { status: "pending" }, architecturalStyle: { status: "pending" }, outdoorPlan: { status: "pending" }, materialStrategy: { status: "pending" }, components: { status: "pending" }, furnishings: { status: "pending" },
      metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
    };
    const { model, errors } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(errors).toEqual([]);
    return boxes(model.primitives).filter((p) => p.category === "window");
  };

  it("turns every frame member and pane with the mass, keeping each facade's hollow-frame geometry in the mass frame", () => {
    const yaw = 0.7;
    const flat = compileWith(0), turned = compileWith(yaw);
    expect(turned.map((p) => p.id)).toEqual(flat.map((p) => p.id));
    expect(flat.length).toBe(4 * 2 * 5);
    for (const { facade, along, normal, half } of FACADES) {
      for (const i of [0, 1]) {
        const id = `architecture-m-wall-0-${facade}-window-${i}`;
        const a = glazedOpening(flat, id, along, normal, [4, -3]);
        const b = glazedOpening(turned, id, along, normal, [4, -3], yaw);
        for (const p of b.parts) expect(p.rotation).toEqual([0, yaw, 0]);
        // Seen from the mass's own frame, the rotated build is the unrotated one, member for member.
        a.memberBounds.forEach((m, k) => (["u", "y", "n"] as const).forEach((axis) => [0, 1].forEach((e) => expect(b.memberBounds[k][axis][e]).toBeCloseTo(m[axis][e], 9))));
        (["u", "y", "n"] as const).forEach((axis) => [0, 1].forEach((e) => expect(b.glass![axis][e]).toBeCloseTo(a.glass![axis][e], 9)));
        const levelBase = b.memberBounds.reduce((lo, m) => Math.min(lo, m.y[0]), Infinity) - 0.9;
        const [band] = openingBands(facade, 12, 8, [{ type: "opening-rhythm", facade, count: 2, width: 1.1, height: 1.4, sill: 0.9 }], 0, 3).slice(i, i + 1);
        const len = facade === "north" || facade === "south" ? 12 : 8;
        expectHollowFramedGlazing(b, { u: [band.start * len - len / 2, band.end * len - len / 2], y: [levelBase + 0.9, levelBase + 2.3] }, half(12, 8) - WALL_INSET);
      }
    }
  });
});

describe("glass material", () => {
  const pane = (over: Partial<Box> = {}): Box => ({ kind: "box", id: "x", category: "window", label: "Window Glass", position: [0, 0, 0], rotation: [0, 0, 0], size: [1, 1, 0.03], color: "#88d4f0", roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.5, ...over });

  it("exposed V2 glazing reads as tinted, reflective, translucent glass — not the dark wall-backed slab", () => {
    const exposed = glassLook(pane({ surface: "glass" }))!, backed = glassLook(pane())!;
    expect(exposed.opacity).toBeLessThan(backed.opacity);
    expect(exposed.metalness).toBeLessThan(backed.metalness);
    expect(new THREE.Color(exposed.color).getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(new THREE.Color(backed.color).getHSL({ h: 0, s: 0, l: 0 }).l);
    expect(exposed.opacity).toBeGreaterThan(0.4);
  });

  it("leaves wall-backed glazing, door panels and clear glass exactly as before", () => {
    expect(glassLook(pane())).toEqual({ color: `#${new THREE.Color("#88d4f0").multiplyScalar(0.42).getHexString()}`, opacity: 0.86, roughness: 0.02, metalness: 0.62, envMapIntensity: 2.2 });
    expect(glassLook(pane({ label: "Glazed Door Panel" }))).toEqual(glassLook(pane()));
    expect(glassLook(pane({ category: "balcony", opacity: 0.4 }))).toEqual({ color: "#88d4f0", opacity: 0.4, roughness: 0.03, metalness: 0.1, envMapIntensity: 2.4 });
    expect(glassLook(pane({ transparent: false }))).toBeNull();
  });

  it("every compiled V2 window pane is marked as exposed glazing; frames and doors are not", () => {
    const tagged = buildFloorFootprint(12, 8, [], 0).edges.filter((e) => e.facade === "south");
    const { primitives } = buildMassOpenings(tagged, 12, 8, [{ type: "glazing-zone", facade: "south", start: 0.1, end: 0.4, heightRatio: 0.8 }, { type: "door", facade: "south", start: 0.6, end: 0.7 }], 0, 0, 3, "wall-0", materials);
    const glazed = primitives.filter((p) => p.surface === "glass").map((p) => p.id);
    expect(glazed).toEqual(["wall-0-south-window-0-glass"]);
  });
});
