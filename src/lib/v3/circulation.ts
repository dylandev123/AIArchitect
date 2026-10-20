import { footprintContains } from './footprint';
import type { HousePrimitive } from "@/lib/house/types";
import type { V3Scene, V3SceneObject, Vec3 } from "./scene";
import type { V3Circulation, V3PlanDirection, V3StairType } from "./interior";
import { materializeV3ArchitecturalScene } from "./architecture";
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from "./elevation";
import { v3MassLevelCount } from "./stacking";
import { roofHostId } from "./compositionPolicies";
import { rooftopTerraces } from "./rooftopFeatures";
import { localPlane } from "./junctions";
import { subtractJunctionVolume, type JunctionPlane } from "./junctionGeometry";

/**
 * Derived vertical circulation. Authored `V3Circulation` intent (host, storeys, plan footprint, stair type) is the
 * only authority; this module resolves it against the host's compiled floor datums and builds treads, landings,
 * the floor opening, guards and lift shafts. Nothing here is persisted, and nothing is placed where it was not
 * authored: a stair without usable location intent is diagnosed, never moved.
 *
 *   authored circulation → `resolveV3Circulation` (datums, exit, usability) → `applyV3Circulation` (render)
 *                                                                          → `auditV3Completeness` (access graph)
 */

/** Compiled floor slab thickness in `compileBuildingMass`: finished floor = level datum + this. */
export const V3_FLOOR_SLAB = .26;
const IMPLICIT_ROOF_SURFACE = .25;
const MAX_RISER = .2, MIN_GOING = .22, MIN_STAIR_WIDTH = .8, MIN_LIFT = 1.3, EPS = .05;
const TARGET_RISER = .18, SPIRAL_STEP = 2 * Math.PI / 14, HEADROOM = 2.4;

export type V3CirculationExit = "storey" | "stacked" | "roof";
export interface V3CirculationIssue { code: string; targetId: string; message: string; }
export interface V3ResolvedCirculation {
  entry: V3Circulation;
  host: V3SceneObject;
  stairType?: V3StairType;
  direction: V3PlanDirection;
  turn: "left" | "right";
  levelHeight: number;
  /** World Y of each host level datum (index 0..levelCount); the top entry is the host's roof datum. */
  datums: number[];
  fromY: number;
  toY: number;
  exit: V3CirculationExit;
  /** Mass reached at the top when the exit lands inside a mass stacked on the host. */
  stackedMassId?: string;
  /** Horizontal parts at or below this world Y are kept when the floor opening is cut. */
  cutTop: number;
  /** Treads, rise and dimensions meet the minimum usable thresholds; unusable circulation provides no access. */
  usable: boolean;
  issues: V3CirculationIssue[];
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const hostIdOf = (o: V3SceneObject) => o.support?.hostId ?? o.support?.objectId ?? o.hostId;
const DIRECTIONS: Record<V3PlanDirection, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

/** Corners of a host-local footprint expressed in another mass's local plan frame. */
function footprintInside(host: V3SceneObject, entry: V3Circulation, other: V3SceneObject, margin = EPS): "inside" | "partial" | "outside" {
  const { x, z, width, depth } = entry.footprint, [ow, , od] = scaledDimensionsOf(other);
  const hy = host.transform.rotation[1], oy = other.transform.rotation[1];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
    const lx = x + sx * width / 2, lz = z + sz * depth / 2;
    const wx = host.transform.position[0] + lx * Math.cos(hy) + lz * Math.sin(hy), wz = host.transform.position[2] - lx * Math.sin(hy) + lz * Math.cos(hy);
    const dx = wx - other.transform.position[0], dz = wz - other.transform.position[2];
    return [dx * Math.cos(oy) - dz * Math.sin(oy), dx * Math.sin(oy) + dz * Math.cos(oy)];
  });
  const inside = corners.filter(([cx, cz]) => Math.abs(cx) <= ow / 2 + margin && Math.abs(cz) <= od / 2 + margin).length;
  if (inside === 4 && (!other.composition?.footprint || footprintContains(other,corners.map(p=>[p[0],p[1]])))) return "inside";
  const overlapX = Math.min(...corners.map(c => c[0])) < ow / 2 && Math.max(...corners.map(c => c[0])) > -ow / 2;
  const overlapZ = Math.min(...corners.map(c => c[1])) < od / 2 && Math.max(...corners.map(c => c[1])) > -od / 2;
  return overlapX && overlapZ ? "partial" : "outside";
}

/** Plan run along the climb direction and width across it. */
function planSpan(entry: V3Circulation, direction: V3PlanDirection): { run: number; across: number } {
  const alongZ = direction === "north" || direction === "south";
  return { run: alongZ ? entry.footprint.depth : entry.footprint.width, across: alongZ ? entry.footprint.width : entry.footprint.depth };
}

/** L-shaped flight width and the two flight runs it leaves inside the footprint. */
function lShape(run: number, across: number) {
  const flight = Math.min(1.2, Math.max(MIN_STAIR_WIDTH, Math.min(run, across) / 2));
  return { flight, run1: run - flight, run2: across - flight };
}

/** Resolves every authored circulation entry; malformed or unusable intent is reported, never repositioned. */
export function resolveV3Circulation(input: V3Scene): V3ResolvedCirculation[] {
  return resolveAll(input).resolved;
}
/** Read-only findings, including entries too malformed to resolve. Saved-scene validation stays lenient; generation gates objective failures. */
export function auditV3CirculationIntent(input: V3Scene): V3CirculationIssue[] {
  return resolveAll(input).issues;
}
function resolveAll(input: V3Scene): { resolved: V3ResolvedCirculation[]; issues: V3CirculationIssue[] } {
  const entries = input.interior?.circulation, out: V3ResolvedCirculation[] = [], all: V3CirculationIssue[] = [];
  if (!Array.isArray(entries) || !entries.length) return { resolved: out, issues: all };
  const scene = materializeV3ArchitecturalScene(input), terraces = rooftopTerraces(scene);
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") continue;
    const issues: V3CirculationIssue[] = [], issue = (code: string, message: string) => { const item = { code, targetId: entry.id, message }; issues.push(item); all.push(item); };
    const host = scene.objects.find((o) => o.id === entry.hostMassId);
    if (!host || host.type !== "building-mass") { issue("CIRCULATION_HOST_INVALID", `${entry.type ?? "Circulation"} ${entry.id} needs an existing building-mass host (got ${String(entry.hostMassId)}).`); continue; }
    const f = entry.footprint;
    if (!f || ![f.x, f.z, f.width, f.depth].every(finite) || f.width <= 0 || f.depth <= 0) { issue("CIRCULATION_LOCATION_MISSING", `${entry.id} has no usable plan footprint in ${host.id}; a stair or lift is never placed automatically.`); continue; }
    const levels = v3MassLevelCount(host), [w, h, d] = scaledDimensionsOf(host), levelHeight = h / levels, base = getObjectBaseY(host);
    const datums = Array.from({ length: levels + 1 }, (_, k) => base + k * levelHeight);
    if (!Number.isInteger(entry.fromLevel) || !Number.isInteger(entry.toLevel) || entry.fromLevel < 0 || entry.toLevel <= entry.fromLevel || entry.toLevel > levels) {
      issue("CIRCULATION_LEVELS_INVALID", `${entry.id} must climb from a lower to a higher storey of ${host.id} (levels 0–${levels}, where ${levels} is its roof); got ${String(entry.fromLevel)}→${String(entry.toLevel)}.`);
      continue;
    }
    if (Math.abs(f.x) + f.width / 2 > w / 2 + EPS || Math.abs(f.z) + f.depth / 2 > d / 2 + EPS) issue("CIRCULATION_OUTSIDE_HOST", `${entry.id} footprint extends beyond ${host.id}; circulation must stay inside its host.`);
    if (host.composition?.footprint && Array.from({length:entry.toLevel-entry.fromLevel+1},(_,i)=>Math.min(levels-1,entry.fromLevel+i)).some(floor=>!footprintContains(host,[[f.x-f.width/2,f.z-f.depth/2],[f.x+f.width/2,f.z-f.depth/2],[f.x+f.width/2,f.z+f.depth/2],[f.x-f.width/2,f.z+f.depth/2]],floor))) issue("CIRCULATION_OUTSIDE_HOST", `${entry.id} crosses the authored footprint boundary; circulation must stay inside every traversed storey.`);
    const direction: V3PlanDirection = entry.direction && DIRECTIONS[entry.direction] ? entry.direction : f.depth >= f.width ? "north" : "east";
    const stairType = entry.type === "stair" ? entry.stairType ?? "straight" : undefined;
    const fromY = datums[entry.fromLevel] + V3_FLOOR_SLAB;
    let toY = datums[entry.toLevel] + V3_FLOOR_SLAB, exit: V3CirculationExit = "storey", stackedMassId: string | undefined, cutTop = toY + .01;
    if (entry.toLevel === levels) {
      const stacked = scene.objects.filter((o) => o.type === "building-mass" && hostIdOf(o) === host.id && Math.abs(getObjectBaseY(o) - getObjectTopY(host)) <= .35);
      const containing = stacked.find((o) => footprintInside(host, entry, o) === "inside");
      if (containing) {
        exit = "stacked"; stackedMassId = containing.id; toY = getObjectBaseY(containing) + V3_FLOOR_SLAB; cutTop = toY + .01;
      } else if (stacked.some((o) => footprintInside(host, entry, o, 0) === "partial")) {
        issue("CIRCULATION_EXIT_OBSTRUCTED", `${entry.id} reaches the roof of ${host.id} partly under stacked mass ${stacked.find((o) => footprintInside(host, entry, o, 0) === "partial")!.id}; place it fully inside that mass or fully on open roof.`);
        exit = "roof";
      } else exit = "roof";
      if (exit === "roof") {
        const roof = scene.objects.find((o) => o.type === "roof-form" && roofHostId(o) === host.id);
        const terrace = terraces.find((t) => hostIdOf(t) === host.id && footprintInside(host, entry, t, .3) === "inside");
        const form = roof?.roofForm ?? host.roofForm ?? "flat";
        if (terrace) toY = getObjectTopY(terrace);
        else if (form === "flat" || form === "terrace") toY = roof ? getObjectBaseY(roof) + Math.max(.18, Math.min(scaledDimensionsOf(roof)[1], .35)) : datums[levels] + IMPLICIT_ROOF_SURFACE;
        else issue("ROOF_EXIT_UNSUPPORTED", `${entry.id} exits onto the ${form} roof of ${host.id}; only flat roofs and rooftop terraces can be reached. Host a rooftop terrace over it or end at a lower storey.`);
        cutTop = toY + .01;
      }
    }
    const rise = toY - fromY, { run, across } = planSpan(entry, direction);
    const risers = Math.max(2, Math.ceil(rise / TARGET_RISER - 1e-6)), riser = rise / risers;
    const unusable = (message: string) => issue("CIRCULATION_NOT_USABLE", `${entry.id}: ${message}`);
    if (entry.type === "lift") {
      if (Math.min(f.width, f.depth) < MIN_LIFT) unusable(`lift shaft ${f.width.toFixed(2)}×${f.depth.toFixed(2)} m is below the ${MIN_LIFT} m minimum.`);
    } else if (stairType === "spiral") {
      const radius = Math.min(f.width, f.depth) / 2 - .05;
      if (radius * 2 / 3 * SPIRAL_STEP < MIN_GOING - 1e-6 || radius < .65) unusable(`spiral footprint ${Math.min(f.width, f.depth).toFixed(2)} m is too small for usable treads (minimum ~1.4 m).`);
    } else if (stairType === "u-shaped") {
      const flight = across / 2, flightRun = run - flight, n1 = Math.ceil(risers / 2), n2 = risers - n1;
      if (flight < MIN_STAIR_WIDTH) unusable(`each U-stair flight is ${flight.toFixed(2)} m wide (minimum ${MIN_STAIR_WIDTH} m).`);
      else if (flightRun / Math.max(1, Math.max(n1, n2) - 1) < MIN_GOING - 1e-6) unusable(`U-stair flights of ${flightRun.toFixed(2)} m cannot fit ${risers} risers of ${riser.toFixed(2)} m with ${MIN_GOING} m treads.`);
    } else if (stairType === "l-shaped") {
      const { flight, run1, run2 } = lShape(run, across);
      const n1 = Math.min(risers - 1, Math.max(1, Math.round(risers * run1 / Math.max(1e-6, run1 + run2)))), n2 = risers - n1;
      if (run1 <= 0 || run2 <= 0 || run1 / Math.max(1, n1 - 1) < MIN_GOING - 1e-6 || run2 / Math.max(1, n2 - 1) < MIN_GOING - 1e-6 || flight < MIN_STAIR_WIDTH) unusable(`L-stair footprint ${run.toFixed(2)}×${across.toFixed(2)} m cannot fit ${risers} risers with ${MIN_GOING} m treads and ${MIN_STAIR_WIDTH} m flights.`);
    } else {
      if (across < MIN_STAIR_WIDTH) unusable(`stair is ${across.toFixed(2)} m wide (minimum ${MIN_STAIR_WIDTH} m).`);
      else if (run / (risers - 1) < MIN_GOING - 1e-6) unusable(`a ${run.toFixed(2)} m straight run cannot fit ${risers} risers of ${riser.toFixed(2)} m with ${MIN_GOING} m treads; lengthen the footprint or use an L/U stair.`);
    }
    if (riser > MAX_RISER + 1e-6) unusable(`riser ${riser.toFixed(2)} m exceeds ${MAX_RISER} m.`);
    const blocking = new Set(["CIRCULATION_NOT_USABLE", "ROOF_EXIT_UNSUPPORTED", "CIRCULATION_OUTSIDE_HOST", "CIRCULATION_EXIT_OBSTRUCTED"]);
    out.push({ entry, host, stairType, direction, turn: entry.turn === "left" ? "left" : "right", levelHeight, datums, fromY, toY, exit, stackedMassId, cutTop, usable: !issues.some((i) => blocking.has(i.code)), issues });
  }
  // Overlapping circulation in one host is reported; both entries are still built where authored.
  const overlap = (r: V3ResolvedCirculation, other: V3ResolvedCirculation) => { const item = { code: "CIRCULATION_OVERLAP", targetId: r.entry.id, message: `${r.entry.id} overlaps ${other.entry.id} in ${other.host.id}.` }; r.issues.push(item); all.push(item); };
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    if (a.host.id !== b.host.id || Math.min(a.entry.toLevel, b.entry.toLevel) <= Math.max(a.entry.fromLevel, b.entry.fromLevel)) continue;
    const fa = a.entry.footprint, fb = b.entry.footprint;
    if (Math.min(fa.x + fa.width / 2, fb.x + fb.width / 2) - Math.max(fa.x - fa.width / 2, fb.x - fb.width / 2) > EPS && Math.min(fa.z + fa.depth / 2, fb.z + fb.depth / 2) - Math.max(fa.z - fa.depth / 2, fb.z - fb.depth / 2) > EPS)
      overlap(b, a);
  }
  return { resolved: out, issues: all };
}

const STAIR_FINISH = { color: "#cfc6b6", roughness: .7, metalness: 0, surface: "concrete" as const };
const TIMBER_TREAD = { color: "#9b7554", roughness: .6, metalness: 0, surface: "wood" as const };
const GUARD_GLASS = { color: "#8fbdc9", roughness: .1, metalness: .08, transparent: true, opacity: .35, surface: "glass" as const };
const METAL = { color: "#30383b", roughness: .4, metalness: .7, surface: "metal" as const };

/** Host-local plan frame of one circulation footprint. */
function stairFrame(r: V3ResolvedCirculation) {
  const { x, z } = r.entry.footprint, [ax, az] = DIRECTIONS[r.direction], [rx, rz] = [-az, ax], { run, across } = planSpan(r.entry, r.direction);
  /** Host-local plan point from (along, side) measured from the footprint's start edge centre. */
  const point = (along: number, side: number): [number, number] => [x + ax * (along - run / 2) + rx * side, z + az * (along - run / 2) + rz * side];
  return { run, across, ax, az, rx, rz, point };
}

/** All construction parts of one circulation entry, in world space, owned by the host mass. */
function buildCirculation(r: V3ResolvedCirculation): HousePrimitive[] {
  const host = r.host, yaw = host.transform.rotation[1], c = Math.cos(yaw), s = Math.sin(yaw), id = r.entry.id, parts: HousePrimitive[] = [];
  const world = (lx: number, y: number, lz: number): Vec3 => [host.transform.position[0] + lx * c + lz * s, y, host.transform.position[2] - lx * s + lz * c];
  const label = r.entry.label ?? (r.entry.type === "lift" ? "Lift" : "Stair");
  /** Box in host-local plan coordinates; `alongX` sizes are given as (x extent, height, z extent) in host axes. */
  const add = (suffix: string, role: string, category: HousePrimitive["category"], lx: number, y: number, lz: number, size: Vec3, finish: object, rotationY = 0) => {
    if (!size.every((v) => Number.isFinite(v) && v > 1e-4)) return;
    parts.push({ kind: "box", id: `${id}:${suffix}`, category, label: `${label} · ${role}`, position: world(lx, y, lz), rotation: [0, yaw + rotationY, 0], size, ...finish, sourceObjectId: host.id, semanticRole: r.entry.semanticRole ?? "vertical circulation", componentRole: role } as HousePrimitive);
  };
  const frame = stairFrame(r), rise = r.toY - r.fromY, risers = Math.max(2, Math.ceil(rise / TARGET_RISER - 1e-6)), riser = rise / risers;
  /** A rectangle spanning along [a0,a1] and side [s0,s1] in the stair frame → host-local centre + axis-aligned size. */
  const rect = (a0: number, a1: number, s0: number, s1: number) => {
    const p0 = frame.point(a0, s0), p1 = frame.point(a1, s1);
    return { cx: (p0[0] + p1[0]) / 2, cz: (p0[1] + p1[1]) / 2, sx: Math.abs(p1[0] - p0[0]), sz: Math.abs(p1[1] - p0[1]) };
  };
  /** One monolithic step: tread top at `top`, a 0.2 m waist below it, never below the starting floor. */
  const step = (suffix: string, a0: number, a1: number, s0: number, s1: number, top: number, role = "stair tread") => {
    const q = rect(a0, a1, s0, s1), bottom = Math.max(r.fromY, top - riser - .2);
    add(suffix, role, "stairs", q.cx, (top + bottom) / 2, q.cz, [q.sx, top - bottom, q.sz], STAIR_FINISH);
  };
  const half = frame.across / 2;
  /** Exit edge segments (stair frame) where the top flight arrives; guards and bulkhead walls leave them open. */
  let exits: Array<[number, number, number, number]> = [];
  if (r.entry.type === "lift") { buildLift(r, add); return parts; }
  if (r.stairType === "spiral") {
    const radius = Math.min(r.entry.footprint.width, r.entry.footprint.depth) / 2 - .05, treads = risers - 1;
    const { x, z } = r.entry.footprint, start = Math.atan2(frame.az, frame.ax);
    add("column", "stair column", "stairs", x, (r.fromY + r.toY) / 2, z, [.16, rise, .16], METAL);
    let last = start;
    for (let i = 1; i <= treads; i++) {
      const angle = start + i * SPIRAL_STEP * (r.turn === "left" ? -1 : 1), mid = radius / 2 + .04;
      last = angle;
      // Plan direction (cos, sin) → box yaw: the tread's long local x axis points outward from the column.
      add(`tread-${i}`, "stair tread", "stairs", x + Math.cos(angle) * mid, r.fromY + i * riser - .03, z + Math.sin(angle) * mid, [radius - .04, .06, radius * SPIRAL_STEP * 1.05], TIMBER_TREAD, -angle);
    }
    // The final tread points at the exit side; the floor opening is open on that side only.
    const ex = Math.cos(last + SPIRAL_STEP * (r.turn === 'left' ? -1 : 1)), ez = Math.sin(last + SPIRAL_STEP * (r.turn === 'left' ? -1 : 1));
    const side: V3PlanDirection = Math.abs(ex) >= Math.abs(ez) ? (ex > 0 ? "east" : "west") : (ez > 0 ? "south" : "north");
    exits = [edgeSegment(r, side)];
  } else if (r.stairType === "u-shaped") {
    const flightRun = frame.run - half, n1 = Math.ceil(risers / 2), n2 = risers - n1, first = r.turn === "right" ? [-half, 0] : [0, half], second = r.turn === "right" ? [0, half] : [-half, 0];
    const g1 = flightRun / Math.max(1, n1 - 1), g2 = flightRun / Math.max(1, n2 - 1);
    for (let i = 1; i < n1; i++) step(`tread-${i}`, (i - 1) * g1, i * g1, first[0], first[1], r.fromY + i * riser);
    step("landing-1", flightRun, frame.run, -half, half, r.fromY + n1 * riser, "stair landing");
    for (let j = 1; j < n2; j++) step(`tread-${n1 + j}`, flightRun - j * g2, flightRun - (j - 1) * g2, second[0], second[1], r.fromY + (n1 + j) * riser);
    exits = [[0, 0, second[0], second[1]]];
  } else if (r.stairType === "l-shaped") {
    const { flight, run1, run2 } = lShape(frame.run, frame.across);
    const n1 = Math.min(risers - 1, Math.max(1, Math.round(risers * run1 / Math.max(1e-6, run1 + run2)))), n2 = risers - n1;
    // Turning right puts the first flight on the left strip; the second flight climbs across toward the right edge.
    const sign = r.turn === "right" ? 1 : -1, strip: [number, number] = sign > 0 ? [-half, -half + flight] : [half - flight, half];
    const g1 = run1 / Math.max(1, n1 - 1), g2 = run2 / Math.max(1, n2 - 1);
    for (let i = 1; i < n1; i++) step(`tread-${i}`, (i - 1) * g1, i * g1, strip[0], strip[1], r.fromY + i * riser);
    step("landing-1", run1, frame.run, strip[0], strip[1], r.fromY + n1 * riser, "stair landing");
    for (let j = 1; j < n2; j++) {
      const s0 = sign > 0 ? strip[1] + (j - 1) * g2 : strip[0] - j * g2, s1 = s0 + g2;
      step(`tread-${n1 + j}`, run1, frame.run, s0, s1, r.fromY + (n1 + j) * riser);
    }
    exits = [[run1, frame.run, sign * half, sign * half]];
  } else {
    const going = frame.run / (risers - 1);
    for (let i = 1; i < risers; i++) step(`tread-${i}`, (i - 1) * going, i * going, -half, half, r.fromY + i * riser);
    exits = [[frame.run, frame.run, -half, half]];
  }
  if (r.exit === "roof") bulkhead(r, frame, exits, add); else guards(r, frame, exits, add);
  return parts;
}

/** Stair-frame segment for one host-local side of the footprint. */
function edgeSegment(r: V3ResolvedCirculation, side: V3PlanDirection): [number, number, number, number] {
  const frame = stairFrame(r), half = frame.across / 2, [sx, sz] = DIRECTIONS[side];
  const along = sx * frame.ax + sz * frame.az, across = sx * frame.rx + sz * frame.rz;
  if (along > .5) return [frame.run, frame.run, -half, half];
  if (along < -.5) return [0, 0, -half, half];
  return across > 0 ? [0, frame.run, half, half] : [0, frame.run, -half, -half];
}

type AddPart = (suffix: string, role: string, category: HousePrimitive["category"], lx: number, y: number, lz: number, size: Vec3, finish: object, rotationY?: number) => void;
type Frame = ReturnType<typeof stairFrame>;

/** The four footprint edges in stair-frame coordinates, each minus any exit segment lying on it. */
function openEdges(frame: Frame, exits: Array<[number, number, number, number]>): Array<{ key: string; a0: number; a1: number; s0: number; s1: number }> {
  const half = frame.across / 2, edges = [
    { key: "start", a0: 0, a1: 0, s0: -half, s1: half }, { key: "end", a0: frame.run, a1: frame.run, s0: -half, s1: half },
    { key: "left", a0: 0, a1: frame.run, s0: -half, s1: -half }, { key: "right", a0: 0, a1: frame.run, s0: half, s1: half },
  ];
  const out: Array<{ key: string; a0: number; a1: number; s0: number; s1: number }> = [];
  for (const edge of edges) {
    const alongEdge = edge.a0 === edge.a1, lo = alongEdge ? edge.s0 : edge.a0, hi = alongEdge ? edge.s1 : edge.a1;
    let pieces: Array<[number, number]> = [[lo, hi]];
    for (const [a0, a1, s0, s1] of exits) {
      const onEdge = alongEdge ? Math.abs(a0 - edge.a0) < 1e-6 && Math.abs(a1 - edge.a0) < 1e-6 : Math.abs(s0 - edge.s0) < 1e-6 && Math.abs(s1 - edge.s0) < 1e-6;
      if (!onEdge) continue;
      const [x0, x1] = alongEdge ? [Math.min(s0, s1), Math.max(s0, s1)] : [Math.min(a0, a1), Math.max(a0, a1)];
      pieces = pieces.flatMap(([p0, p1]) => [[p0, Math.min(p1, x0)], [Math.max(p0, x1), p1]] as Array<[number, number]>).filter(([p0, p1]) => p1 - p0 > .05);
    }
    pieces.forEach(([p0, p1], i) => out.push(alongEdge ? { key: `${edge.key}-${i}`, a0: edge.a0, a1: edge.a0, s0: p0, s1: p1 } : { key: `${edge.key}-${i}`, a0: p0, a1: p1, s0: edge.s0, s1: edge.s0 }));
  }
  return out;
}

/** Glass guards with a metal top rail around the upper floor opening, open where the top flight arrives. */
function guards(r: V3ResolvedCirculation, frame: Frame, exits: Array<[number, number, number, number]>, add: AddPart): void {
  for (const edge of openEdges(frame, exits)) {
    const p0 = frame.point(edge.a0, edge.s0), p1 = frame.point(edge.a1, edge.s1), cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
    const alongX = Math.abs(p1[0] - p0[0]) >= Math.abs(p1[1] - p0[1]), length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const inset = .03, nx = alongX ? 0 : Math.sign(cx - r.entry.footprint.x) * inset, nz = alongX ? Math.sign(cz - r.entry.footprint.z) * inset : 0;
    add(`guard-${edge.key}`, "stair guard", "balcony", cx - nx, r.toY + .5, cz - nz, alongX ? [length, 1, .02] : [.02, 1, length], GUARD_GLASS);
    add(`guard-rail-${edge.key}`, "stair guard rail", "balcony", cx - nx, r.toY + 1.02, cz - nz, alongX ? [length, .05, .05] : [.05, .05, length], METAL);
  }
}

/** Roof exit: a compact stair head enclosure, open on the side where the stair arrives. */
function bulkhead(r: V3ResolvedCirculation, frame: Frame, exits: Array<[number, number, number, number]>, add: AddPart): void {
  const wall = { color: r.host.material.color, roughness: r.host.material.roughness ?? .72, metalness: r.host.material.metalness ?? 0, ...(r.host.material.surface && !["glass", "water", "grass", "paving"].includes(r.host.material.surface) ? { surface: r.host.material.surface } : {}) };
  const t = .15;
  for (const edge of openEdges(frame, exits)) {
    const p0 = frame.point(edge.a0, edge.s0), p1 = frame.point(edge.a1, edge.s1), cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
    const alongX = Math.abs(p1[0] - p0[0]) >= Math.abs(p1[1] - p0[1]), length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const nx = alongX ? 0 : Math.sign(cx - r.entry.footprint.x) * t / 2, nz = alongX ? Math.sign(cz - r.entry.footprint.z) * t / 2 : 0;
    add(`bulkhead-wall-${edge.key}`, "stair bulkhead wall", "wall", cx - nx, r.toY + HEADROOM / 2, cz - nz, alongX ? [length, HEADROOM, t] : [t, HEADROOM, length], wall);
  }
  const f = r.entry.footprint;
  add("bulkhead-roof", "stair bulkhead roof", "roof", f.x, r.toY + HEADROOM + .1, f.z, [f.width + .2, .2, f.depth + .2], { color: "#42494a", roughness: .55, metalness: .5, surface: "metal" });
}

/** Lift: shaft walls through every served storey, a landing door on the authored side at each served level. */
function buildLift(r: V3ResolvedCirculation, add: AddPart): void {
  const f = r.entry.footprint, t = .15, side = r.direction, wall = { color: "#d7d0c4", roughness: .72, metalness: 0, surface: "stucco" as const };
  const bottom = r.datums[r.entry.fromLevel], top = r.exit === "roof" ? r.toY + HEADROOM + .3 : r.entry.toLevel < r.datums.length - 1 ? r.datums[r.entry.toLevel + 1] : r.toY + HEADROOM;
  const levels = Array.from({ length: r.entry.toLevel - r.entry.fromLevel + 1 }, (_, i) => i === r.entry.toLevel - r.entry.fromLevel ? r.toY : r.datums[r.entry.fromLevel + i] + V3_FLOOR_SLAB);
  for (const face of ["north", "south", "east", "west"] as const) {
    const alongX = face === "north" || face === "south", [dx, dz] = DIRECTIONS[face], length = alongX ? f.width : f.depth - 2 * t;
    const cx = f.x + dx * (f.width / 2 - t / 2), cz = f.z + dz * (f.depth / 2 - t / 2);
    const size = (l: number, h: number): Vec3 => alongX ? [l, h, t] : [t, h, l];
    const offset = (a: number): [number, number] => alongX ? [cx + a, cz] : [cx, cz + a];
    if (face !== side) { add(`shaft-${face}`, "lift shaft wall", "wall", cx, (bottom + top) / 2, cz, size(length, top - bottom), wall); continue; }
    // Door face: solid piers either side of the door column, a head above each landing door, closed metal leaves.
    const door = Math.min(1, length - .4), pier = (length - door) / 2;
    for (const sign of [-1, 1]) { const [px, pz] = offset(sign * (door / 2 + pier / 2)); add(`shaft-${face}-pier-${sign < 0 ? 0 : 1}`, "lift shaft wall", "wall", px, (bottom + top) / 2, pz, size(pier, top - bottom), wall); }
    let cursor = bottom;
    levels.forEach((floor, i) => {
      const head = floor + 2.1;
      if (floor - cursor > .02) add(`shaft-${face}-infill-${i}`, "lift shaft wall", "wall", cx, (cursor + floor) / 2, cz, size(door, floor - cursor), wall);
      add(`landing-door-${i}`, "lift landing door", "wall", cx - dx * .02, floor + 1.05, cz - dz * .02, size(door, 2.1), METAL);
      cursor = head;
    });
    if (top - cursor > .02) add(`shaft-${face}-head`, "lift shaft wall", "wall", cx, (cursor + top) / 2, cz, size(door, top - cursor), wall);
  }
  add("cab", "lift car", "wall", f.x, levels[0] + 1.2, f.z, [Math.max(.2, f.width - 2 * t - .1), 2.3, Math.max(.2, f.depth - 2 * t - .1)], { color: "#b9b4ac", roughness: .45, metalness: .5, surface: "metal" });
  if (r.exit === "roof") add("shaft-cap", "lift shaft roof", "roof", f.x, top + .1, f.z, [f.width + .2, .2, f.depth + .2], { color: "#42494a", roughness: .55, metalness: .5, surface: "metal" });
}

/** Convex vertical prism over the footprint between two world elevations. */
function openingVolume(r: V3ResolvedCirculation, bottom: number, top: number): JunctionPlane[] {
  const f = r.entry.footprint, h = r.host;
  return [localPlane(h, [1, 0, 0], f.x + f.width / 2), localPlane(h, [-1, 0, 0], -(f.x - f.width / 2)), localPlane(h, [0, 0, 1], f.z + f.depth / 2), localPlane(h, [0, 0, -1], -(f.z - f.depth / 2)), { normal: [0, 1, 0], constant: top }, { normal: [0, -1, 0], constant: -bottom }];
}

const verticalRange = (p: HousePrimitive): [number, number] => {
  if (p.kind === "box") { const half = Math.abs(p.size[1]) / 2 + Math.max(Math.abs(p.size[0]), Math.abs(p.size[2])) * (Math.abs(p.rotation[0]) + Math.abs(p.rotation[2]) > 1e-6 ? 1 : 0); return [p.position[1] - half, p.position[1] + half]; }
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < p.vertices.length; i += 3) { lo = Math.min(lo, p.vertices[i]); hi = Math.max(hi, p.vertices[i]); }
  return [lo, hi];
};
/** Floor/roof surfaces a stair or lift may pass through; walls, glazing and guards are never cut. */
const CUTTABLE = new Set<HousePrimitive["category"]>(["floor", "roof"]);

/**
 * Final construction pass: cuts each usable circulation's floor opening through the host's (and a stacked mass's)
 * slabs, roof plate or terrace deck, then adds the derived stair/lift parts. Scenes without circulation are returned
 * unchanged, so exterior output is identical with or without this pass.
 */
export function applyV3Circulation(scene: V3Scene, primitives: HousePrimitive[]): HousePrimitive[] {
  // Unusable intent (too steep, too narrow, outside its host, unsupported exit) is diagnosed, never built as a ladder.
  const resolved = resolveV3Circulation(scene).filter((r) => r.usable);
  if (!resolved.length) return primitives;
  let result = primitives;
  for (const r of resolved) {
    const owners = new Set([r.host.id, ...(r.stackedMassId ? [r.stackedMassId] : [])]);
    for (const o of scene.objects) if ((o.type === "roof-form" && owners.has(roofHostId(o) ?? "")) || (o.type === "terrace" && owners.has(hostIdOf(o) ?? ""))) owners.add(o.id);
    const bottom = r.fromY + .05, volume = openingVolume(r, bottom, r.cutTop);
    result = result.flatMap((p) => {
      const hostedTerraceSurface = p.category === 'patio' && scene.objects.some(o=>o.id===p.sourceObjectId && o.type==='terrace');
      if ((!CUTTABLE.has(p.category) && !hostedTerraceSurface) || !owners.has(p.sourceObjectId ?? "")) return [p];
      const [lo, hi] = verticalRange(p);
      if (hi <= bottom || lo >= r.cutTop) return [p];
      const cut = subtractJunctionVolume(p, volume);
      return cut ? [cut] : [];
    });
    result = [...result, ...buildCirculation(r)];
  }
  return result;
}

/** Actual constructed tread centres and arrival portals, shared with functional auditing. No authored geometry. */
export function v3StairAccessGeometry(r: V3ResolvedCirculation): { entry: Vec3; exit: Vec3; walk: Vec3[] } {
  const frame = stairFrame(r), half = frame.across / 2, sign = r.turn === 'right' ? 1 : -1;
  let entry: [number, number] = [0, 0], exit: [number, number] = [frame.run, 0];
  if (r.stairType === 'u-shaped') { entry = [0, -sign * half / 2]; exit = [0, sign * half / 2]; }
  if (r.stairType === 'l-shaped') {
    const { flight, run1 } = lShape(frame.run, frame.across);
    entry = [0, -sign * (half - flight / 2)]; exit = [(run1 + frame.run) / 2, sign * half];
  }
  const yaw = r.host.transform.rotation[1];
  const world = (p: [number, number], y: number): Vec3 => [r.host.transform.position[0] + p[0]*Math.cos(yaw)+p[1]*Math.sin(yaw), y, r.host.transform.position[2]-p[0]*Math.sin(yaw)+p[1]*Math.cos(yaw)];
  let start = frame.point(...entry), end = frame.point(...exit);
  if (r.stairType === 'spiral') {
    const radius = Math.min(r.entry.footprint.width,r.entry.footprint.depth)/2-.05;
    const risers = Math.max(2,Math.ceil((r.toY-r.fromY)/TARGET_RISER-1e-6));
    const angle = Math.atan2(frame.az,frame.ax), last = angle+(risers-1)*SPIRAL_STEP*(r.turn==='left'?-1:1);
    // Matches the constructed first and final radial tread; portal is on its tangent continuation.
    start = [r.entry.footprint.x+Math.cos(angle)*radius*.65,r.entry.footprint.z+Math.sin(angle)*radius*.65];
    end = [r.entry.footprint.x+Math.cos(last)*radius*.65,r.entry.footprint.z+Math.sin(last)*radius*.65];
  }
  const walk = buildCirculation(r).filter(p => p.componentRole==='stair tread'||p.componentRole==='stair landing').map(p => {
    const box = p as Extract<HousePrimitive,{kind:'box'}>;
    return [box.position[0],box.position[1]+box.size[1]/2,box.position[2]] as Vec3;
  });
  // Approaches extend beyond the reservation only along the actual arrival direction.
  const extend = (p:[number,number],a:[number,number],distance:number):[number,number] => [p[0]+a[0]*distance,p[1]+a[1]*distance];
  const entryDir:[number,number]=[-frame.ax,-frame.az];
  let exitDir:[number,number]=r.stairType==='u-shaped'?entryDir:r.stairType==='l-shaped'?[sign*frame.rx,sign*frame.rz]:[frame.ax,frame.az];
  if(r.stairType==='spiral') {
    const angle=Math.atan2(end[1]-r.entry.footprint.z,end[0]-r.entry.footprint.x),turn=r.turn==='left'?-1:1;
    // Use the same open edge selected by buildCirculation, then step onto the actual destination floor.
    const ex=Math.cos(angle+SPIRAL_STEP*turn),ez=Math.sin(angle+SPIRAL_STEP*turn);
    exitDir=Math.abs(ex)>=Math.abs(ez)?[Math.sign(ex),0]:[0,Math.sign(ez)];
    end=[r.entry.footprint.x+exitDir[0]*r.entry.footprint.width/2,r.entry.footprint.z+exitDir[1]*r.entry.footprint.depth/2];
    const first=Math.atan2(start[1]-r.entry.footprint.z,start[0]-r.entry.footprint.x);
    entryDir[0]=Math.sin(first)*turn;entryDir[1]=-Math.cos(first)*turn;
  }
  return {entry:world(extend(start,entryDir,.45),r.fromY),exit:world(extend(end,exitDir,.45),r.toY),walk};
}
