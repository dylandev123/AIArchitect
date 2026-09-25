import type { DesignTier, HouseConfig, RoofType, SiteSettings, StyleKey, WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { SIDE_VECTORS, getArchitectureProfile } from "./profiles";
import { outbuildingFor } from "./generationRules";
import { pitchedRoof } from "./roofPlane";
import { TIER_PROFILES, resolveTier, tierRank } from "../tiers";

/**
 * Design rules for the parts of a design that follow from the *brief and the tier* rather than from a named style.
 *
 * The model is told what each tier means and what terrain the renderer can draw, but "a cabin beside a river" must
 * not depend on it remembering to ask for a river, and a luxury house must not depend on it remembering to give the
 * roof any variety. So after generation these rules add whatever the brief or tier calls for and the design lacks —
 * as ordinary `add*` ops, each with its own stable id, editable and removable like anything the model wrote. Nothing
 * here is a complete house: every part is a small, parametric feature sized from the footprint it attaches to.
 */

type Shell = { width: number; depth: number; floors: number; roof: string };
type Rec = Record<string, unknown>;

export interface SiteRulesInput {
  brief: string;
  house: Shell;
  site: SiteSettings;
  ops: readonly PatchOp[];
  style?: StyleKey;
}

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const valueOf = (op: PatchOp): Rec => (isRecord(op.value) ? op.value : {});
const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wallLen = (h: Shell, wall: WallSide) => (wall === "north" || wall === "south" ? h.width : h.depth);

/** World x/z of a point `u` along a wall (from its start corner) and `out` metres out from its face. */
function wallPoint(h: Shell, wall: WallSide, u: number, out: number): [number, number] {
  switch (wall) {
    case "north": return [-h.width / 2 + u, -h.depth / 2 - out];
    case "south": return [-h.width / 2 + u, h.depth / 2 + out];
    case "east": return [h.width / 2 + out, -h.depth / 2 + u];
    case "west": return [-h.width / 2 - out, -h.depth / 2 + u];
  }
}

// ── Brief → contextual terrain ──────────────────────────────────────────────────────────────────────────────────

const WATER_WORDS = /\b(rivers?|streams?|creeks?|brooks?|waterway|watercourse)\b/i;
const RIVER_WORD = /\b(rivers?)\b/i;
const ROCK_WORDS = /\b(rocky|boulders?|rock\s+garden|rock\s+outcrops?|outcrops?)\b/i;
const CLEARING_WORDS = /\b(clearing|glade|meadow)\b/i;
const RETAINING_WORDS = /\b(retaining\s+walls?|terraced\s+(?:garden|hillside|lot|site)|terracing)\b/i;

/** Far side (along the view axis) of everything already placed on the view side, so a river never runs through it. */
function viewExtent(house: Shell, site: SiteSettings, ops: readonly PatchOp[]): number {
  const [vx, vz] = SIDE_VECTORS[site.viewDirection];
  const viewWall = site.viewDirection as WallSide;
  const half = (Math.abs(vx) > 0.5 ? house.width : house.depth) / 2;
  let extent = half + 2;
  const consider = (v: number) => { if (Number.isFinite(v)) extent = Math.max(extent, v); };
  const absolute = (x: unknown, z: unknown, w: unknown, d: unknown, radius = 0) => {
    if (typeof x !== "number" || typeof z !== "number") return;
    const along = x * vx + z * vz;
    const reach = radius > 0 ? radius : (Math.abs(vx) * Number(w) + Math.abs(vz) * Number(d)) / 2;
    consider(along + reach);
  };
  for (const op of ops) {
    if (!op.op.startsWith("add")) continue;
    const v = valueOf(op);
    switch (op.op) {
      case "addPatio": if (v.wall === viewWall) consider(half + Number(v.depth)); break;
      case "addPool":
        if (typeof v.siteX === "number") absolute(v.siteX, v.siteZ, v.width, v.depth);
        else if (v.wall === viewWall) consider(half + Number(v.distance) + Number(v.depth) + 0.5);
        break;
      case "addPorch": case "addBalcony": case "addGarage": if (v.wall === viewWall) consider(half + Number(v.depth)); break;
      case "addDeck": case "addBuilding": case "addLandscape": case "addParking": absolute(v.x, v.z, v.width, v.depth); break;
      case "addCurvedWall": absolute(v.x, v.z, 0, 0, Number(v.radius)); break;
      case "addRockCluster": absolute(v.x, v.z, 0, 0, Number(v.radius)); break;
      case "addSlope": absolute(v.x, v.z, v.width, v.depth); break;
    }
  }
  return extent;
}

function terrainOps(input: SiteRulesInput, tier: DesignTier): PatchOp[] {
  const { brief, house, site, ops } = input;
  const out: PatchOp[] = [];
  const has = (name: string) => ops.some((op) => op.op === name);
  const [vx, vz] = SIDE_VECTORS[site.viewDirection];
  const [ax, az] = [-vz, vx]; // across the view
  const seaView = site.environment === "beach" || site.environment === "cliff";
  const viewHalf = (Math.abs(vx) > 0.5 ? house.width : house.depth) / 2;

  if (WATER_WORDS.test(brief) && !has("addWaterway")) {
    const kind = RIVER_WORD.test(brief) ? "river" : "stream";
    const width = kind === "river" ? 7 : 2.6;
    // On the view side, past everything already there; on the flank instead when the view is the sea.
    const dir: [number, number] = seaView ? [ax, az] : [vx, vz];
    const lat: [number, number] = seaView ? [vx, vz] : [ax, az];
    const extent = seaView ? (Math.abs(ax) > 0.5 ? house.width : house.depth) / 2 + 4 : viewExtent(house, site, [...ops, ...out]);
    const dist = extent + 5 + width / 2 + 2.5;
    const start: [number, number] = [dir[0] * dist - lat[0] * 70, dir[1] * dist - lat[1] * 70];
    const end: [number, number] = [dir[0] * dist + lat[0] * 70, dir[1] * dist + lat[1] * 70];
    // Bow the river away from the house so it never drifts closer than the distance chosen above.
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const len = Math.hypot(dx, dz);
    const leftAway = (-dz / len) * dir[0] + (dx / len) * dir[1] > 0;
    const bend = (leftAway ? 1 : -1) * (kind === "river" ? 5 : 3);
    out.push({ op: "addWaterway", value: { kind, x1: round(start[0]), z1: round(start[1]), x2: round(end[0]), z2: round(end[1]), width, bend, meander: kind === "river" ? 0.5 : 0.7 } });

    // A trodden way down to the bank, so the water is part of how the house is used.
    if (!has("addPath")) {
      const from: [number, number] = [dir[0] * (viewHalf + 0.6) + lat[0] * 2, dir[1] * (viewHalf + 0.6) + lat[1] * 2];
      const to: [number, number] = [dir[0] * (dist - width / 2 - 1.3) + lat[0] * 2, dir[1] * (dist - width / 2 - 1.3) + lat[1] * 2];
      if (Math.hypot(to[0] - from[0], to[1] - from[1]) > 3) {
        out.push({ op: "addPath", value: { x1: round(from[0]), z1: round(from[1]), x2: round(to[0]), z2: round(to[1]), width: 1.2, bend: 1.5, surface: site.environment === "forest" ? "dirt" : "gravel" } });
      }
    }
  }

  if (ROCK_WORDS.test(brief) && !has("addRockCluster")) {
    const [cx, cz] = [ax * (viewHalf + 12) + vx * 4, az * (viewHalf + 12) + vz * 4];
    out.push({ op: "addRockCluster", value: { x: round(cx), z: round(cz), radius: 4, count: 8, size: 1.8 } });
  }

  if (CLEARING_WORDS.test(brief) && !ops.some((op) => op.op === "addLandscape" && valueOf(op).kind === "clearing")) {
    const d = viewHalf + 12;
    out.push({ op: "addLandscape", value: { kind: "clearing", x: round(vx * d), z: round(vz * d), width: 18, depth: 14 } });
  }

  const sloping = site.terrainSlope !== "flat" && (site.environment === "hillside" || site.environment === "cliff");
  if (!has("addRetainingWall") && (RETAINING_WORDS.test(brief) || (sloping && tierRank(tier) >= 2))) {
    // Behind the house, where the land rises, bowed toward it like a cut into the hillside.
    const d = -(viewHalf + 6);
    const half = (Math.abs(vx) > 0.5 ? house.depth : house.width) / 2 + 6;
    out.push({ op: "addRetainingWall", value: { x1: round(vx * d - ax * half), z1: round(vz * d - az * half), x2: round(vx * d + ax * half), z2: round(vz * d + az * half), height: 1.5, thickness: 0.45, bend: 3 } });
  }
  return out;
}

// ── Tier → architectural richness ───────────────────────────────────────────────────────────────────────────────

/** Ornate parts a starter design leaves out, whatever the model proposed. */
const STARTER_EXCLUDED = new Set(["addArch", "addCurvedWall", "addCrossGable"]);

function tierOps(input: SiteRulesInput, tier: DesignTier, roof: RoofType): PatchOp[] {
  const { house, site, ops, style } = input;
  const rank = tierRank(tier);
  if (rank < 2) return [];
  const out: PatchOp[] = [];
  const has = (name: string) => ops.some((op) => op.op === name) || out.some((op) => op.op === name);
  const approach = site.approachSide as WallSide;
  const view = site.viewDirection as WallSide;
  const profile = getArchitectureProfile(style);
  const roofPlane = pitchedRoof({ ...house, roof } as HouseConfig, profile);
  const [ax, az] = SIDE_VECTORS[site.approachSide];
  const [vx, vz] = SIDE_VECTORS[site.viewDirection];
  const doorOn = (wall: WallSide) => ops.find((op) => op.op === "addDoor" && valueOf(op).wall === wall && (valueOf(op).level ?? 0) === 0);
  const doorSpan = (wall: WallSide): [number, number] | undefined => {
    const d = doorOn(wall);
    return d ? [Number(valueOf(d).offset), Number(valueOf(d).offset) + Number(valueOf(d).width)] : undefined;
  };
  /** Ground-floor windows and doors on a wall as [from, to] spans: an arch framed over one would hide it. */
  const openings = (wall: WallSide): [number, number][] =>
    [...ops, ...out]
      .filter((op) => (op.op === "addWindow" || op.op === "addDoor") && valueOf(op).wall === wall && (valueOf(op).level ?? 0) === 0)
      .map((op) => [Number(valueOf(op).offset), Number(valueOf(op).offset) + Number(valueOf(op).width)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
  /** The widest stretch of a wall with no ground-floor opening in it, as [from, to]. */
  const widestClearRun = (wall: WallSide): [number, number] => {
    const len = wallLen(house, wall);
    let best: [number, number] = [0, 0];
    let cursor = 0;
    for (const [from, to] of openings(wall)) {
      if (from - 0.4 - cursor > best[1] - best[0]) best = [cursor, from - 0.4];
      cursor = Math.max(cursor, to + 0.4);
    }
    if (len - cursor > best[1] - best[0]) best = [cursor, len];
    return best;
  };
  /** A free stretch of `width` on a wall, centred where possible and clear of the ground-floor door. */
  const freeSpan = (wall: WallSide, width: number, prefer = 0.5): number | undefined => {
    const len = wallLen(house, wall);
    if (len < width + 1) return undefined;
    const door = doorSpan(wall);
    const at = (centre: number) => clamp(centre - width / 2, 0, len - width);
    const clear = (o: number) => !door || o + width < door[0] - 0.4 || o > door[1] + 0.4;
    for (const f of [prefer, 0.3, 0.7, 0.2, 0.8]) if (clear(at(len * f))) return round(at(len * f));
    return undefined;
  };

  // Foundation: every luxury and estate house stands on a stepped base.
  if (!has("addFoundation")) out.push({ op: "addFoundation", value: rank >= 3 ? { steps: 3, riser: 0.16, projection: 0.2 } : { steps: 2, riser: 0.14, projection: 0.18 } });

  // A projecting volume that breaks the plain wall: a bay on the view side (luxury) or a round bay on a flank (estate,
  // where the view side is kept for the arcade).
  if (!has("addBay")) {
    const across = (["north", "east", "south", "west"] as const).find((w) => SIDE_VECTORS[w][0] === -vz && SIDE_VECTORS[w][1] === vx) ?? view;
    const wall = rank >= 3 ? across : view;
    const offset = freeSpan(wall, 3.4);
    if (offset !== undefined) out.push({ op: "addBay", value: { wall, level: 0, offset, width: 3.4, depth: 0.95, levels: 1, form: rank >= 3 ? "round" : "angled" } });
  }

  // Roof variety: dormers (and, for an estate, a cross gable at the entrance) — only on roofs that have slopes to put
  // them on. Dormers face the view when they can, so the entrance gable and the dormers never share a slope.
  if (roofPlane) {
    const [lo, hi] = roofPlane.usable;
    const room = hi - lo;
    const dormerWidth = 1.8;
    const dormerWall = rank >= 3 && roofPlane.slopeWalls.includes(view) ? view : roofPlane.slopeWalls.includes(approach) && rank < 3 ? approach : roofPlane.slopeWalls[0];
    if (!has("addDormer")) {
      for (let want = rank >= 3 ? 3 : 2; want >= 1; want--) {
        if (room < dormerWidth * want + 1.5 * (want + 1)) continue;
        const gap = (room - dormerWidth * want) / (want + 1);
        for (let i = 0; i < want; i++) out.push({ op: "addDormer", value: { wall: dormerWall, offset: round(lo + gap * (i + 1) + dormerWidth * i), width: dormerWidth } });
        break;
      }
    }
    if (rank >= 3 && !has("addCrossGable")) {
      const gableWall = roofPlane.slopeWalls.includes(approach) ? approach : roofPlane.slopeWalls.find((w) => w !== dormerWall) ?? dormerWall;
      const door = doorSpan(gableWall);
      const width = Math.min(5, room - 1);
      if (width >= 2.5) {
        const centre = door ? (door[0] + door[1]) / 2 : (lo + hi) / 2;
        out.push({ op: "addCrossGable", value: { wall: gableWall, offset: round(clamp(centre - width / 2, lo, hi - width)), width } });
      }
    }
    if (!has("addChimney") && !profile?.chimney) {
      const ends: WallSide[] = house.width >= house.depth ? ["east", "west"] : ["north", "south"];
      const wall = ends.find((w) => w !== approach) ?? ends[0];
      const len = wallLen(house, wall);
      const width = Math.min(1.2, len);
      out.push({ op: "addChimney", value: { wall, offset: round((len - width) / 2), width, depth: 0.9 } });
    }
  }

  // Estate: a turret on the entrance corner and an arched arcade along the view side.
  if (rank >= 3) {
    const hasTurret = [...ops, ...out].some((op) => op.op === "addBay" && valueOf(op).form === "turret");
    if (!hasTurret) {
      const len = wallLen(house, approach);
      const width = 3.4;
      if (len >= width + 3) {
        // Take the corner farther from the door — and never the one the chimney stack rises beside.
        const door = doorSpan(approach);
        const centre = door ? (door[0] + door[1]) / 2 : len / 2;
        let atStart = centre > len / 2;
        const chimney = [...ops, ...out].find((op) => op.op === "addChimney");
        const chimneyWall = chimney ? (valueOf(chimney).wall as WallSide) : undefined;
        if (chimneyWall && chimneyWall !== approach) {
          // u = 0 is the west end of a north/south wall and the north end of an east/west wall.
          const chimneyAtStart = approach === "north" || approach === "south" ? chimneyWall === "west" : chimneyWall === "north";
          const chimneyAtEnd = approach === "north" || approach === "south" ? chimneyWall === "east" : chimneyWall === "south";
          if (chimneyAtStart) atStart = false;
          else if (chimneyAtEnd) atStart = true;
        }
        out.push({ op: "addBay", value: { wall: approach, level: 0, offset: atStart ? 0 : round(len - width), width, depth: 2.8, levels: Math.min(house.floors + 1, 4), form: "turret" } });
      }
    }
    if (!has("addArch")) {
      // An arcade needs a stretch of wall with nothing in it: as many arches as fit in the widest clear run.
      const wall = view;
      const width = 3.2;
      const bayHere = [...ops, ...out].some((op) => op.op === "addBay" && valueOf(op).wall === wall);
      const [from, to] = widestClearRun(wall);
      const count = Math.min(3, Math.floor((to - from) / width));
      if (!bayHere && count >= 2) {
        const start = from + (to - from - count * width) / 2;
        for (let i = 0; i < count; i++) out.push({ op: "addArch", value: { wall, level: 0, offset: round(start + i * width), width, height: 3.1, depth: 0.4 } });
      }
    }
    // Curved garden wall enclosing the view terrace.
    if (!has("addCurvedWall")) {
      const viewHalf = (Math.abs(vx) > 0.5 ? house.width : house.depth) / 2;
      const centre = viewHalf + 3;
      const sweep = 150;
      const facing = (Math.atan2(vz, vx) * 180) / Math.PI;
      out.push({ op: "addCurvedWall", value: { x: round(vx * centre), z: round(vz * centre), radius: 11, startAngle: round(facing - sweep / 2), sweep, height: 2.2, thickness: 0.45 } });
    }
    // Curved entry stairs in front of the door once there is a stepped base to climb.
    if (!has("addStairs") && !has("addPorch") && doorSpan(approach)) {
      const door = doorSpan(approach)!;
      const width = clamp(door[1] - door[0] + 1.6, 2, wallLen(house, approach));
      out.push({ op: "addStairs", value: { wall: approach, offset: round(clamp(door[0] - 0.8, 0, wallLen(house, approach) - width)), width: round(width), rise: 0.48, form: "curved", turn: "right" } });
    }
  }

  // Outdoor living and grounds.
  if (!has("addPool") && site.environment !== "urban" && house.floors <= 3) {
    const len = wallLen(house, view);
    const width = Math.min(9, Math.max(5, len * 0.7));
    const patio = ops.find((op) => op.op === "addPatio" && valueOf(op).wall === view);
    const distance = patio ? Math.min(30, Number(valueOf(patio).depth) + 0.5) : 2.5;
    out.push({ op: "addPool", value: { wall: view, offset: round(Math.max(0, (len - width) / 2)), distance, width: round(width), depth: 3.6, waterDepth: 1.5, shape: rank >= 3 ? "kidney" : "rounded" } });
  }
  if (!has("addPath") && doorSpan(approach)) {
    const door = doorSpan(approach)!;
    const u = (door[0] + door[1]) / 2;
    const porch = ops.find((op) => op.op === "addPorch" && valueOf(op).wall === approach);
    const gap = (porch ? Number(valueOf(porch).depth) : 0) + 0.8;
    const from = wallPoint(house, approach, u, gap);
    const to = wallPoint(house, approach, u, gap + 20);
    out.push({ op: "addPath", value: { x1: round(from[0]), z1: round(from[1]), x2: round(to[0] + (az !== 0 ? 2.5 : 0)), z2: round(to[1] + (ax !== 0 ? 2.5 : 0)), width: 1.6, bend: 2.5, surface: rank >= 3 ? "flagstone" : "gravel" } });
  }
  const gardens = rank >= 3 ? 3 : 2;
  const gardenCount = ops.filter((op) => op.op === "addLandscape").length;
  if (gardenCount < gardens) {
    const halfLat = (Math.abs(ax) > 0.5 ? house.depth : house.width) / 2;
    const halfAlong = (Math.abs(ax) > 0.5 ? house.width : house.depth) / 2;
    for (let i = gardenCount; i < gardens; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const d = halfAlong + 4 + Math.floor(i / 2) * 6;
      const l = side * (halfLat + 3.5);
      out.push({ op: "addLandscape", value: { kind: "garden", x: round(ax * d + -az * l), z: round(az * d + ax * l), width: 6, depth: 5 } });
    }
  }

  // Estate outbuildings: a gazebo and a detached garage, unless the design already has them.
  if (rank >= 3) {
    for (const kind of ["gazebo", "detached_garage"] as const) {
      if (!ops.some((op) => op.op === "addBuilding" && valueOf(op).kind === kind) && !out.some((op) => op.op === "addBuilding" && valueOf(op).kind === kind)) {
        out.push({ op: "addBuilding", value: outbuildingFor(kind, house, site) });
      }
    }
  }
  return out;
}

// ── Shapes and curves on parts the model already added ──────────────────────────────────────────────────────────

/** Luxury and estate favour curved pool and deck outlines and curved driveways; the model's own choices are kept. */
function curveExisting(ops: PatchOp[], tier: DesignTier): PatchOp[] {
  const rank = tierRank(tier);
  if (rank < 2) return ops;
  return ops.map((op) => {
    const v = valueOf(op);
    if (op.op === "addPool" && v.shape === undefined) return { ...op, value: { ...v, shape: rank >= 3 ? "kidney" : "rounded" } };
    if (op.op === "addDeck" && v.shape === undefined) return { ...op, value: { ...v, shape: rank >= 3 ? "arc" : "rounded" } };
    if (op.op === "addDriveway" && v.bend === undefined && Number(v.length) >= 8) return { ...op, value: { ...v, bend: rank >= 3 ? 4 : 2.5 } };
    return op;
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface SiteRulesResult {
  ops: PatchOp[];
  tier: DesignTier;
}

/**
 * Applies the tier and terrain rules to a freshly generated design. Existing ops are kept (a starter design only
 * loses the ornate parts it should not have); anything missing is appended as a normal `add*` op.
 */
export function applySiteRules(input: SiteRulesInput): SiteRulesResult {
  const tier = resolveTier(input.site.designTier);
  let ops = [...input.ops];
  if (tier === "starter") {
    ops = ops.filter((op) => !STARTER_EXCLUDED.has(op.op) && !(op.op === "addBay" && valueOf(op).form !== "angled"));
    ops = ops.map((op) => (op.op === "addFoundation" ? { ...op, value: { ...valueOf(op), steps: 1 } } : op));
  }
  ops = curveExisting(ops, tier);

  // Materials: only fill them in when the design set none at all.
  if (!ops.some((op) => op.op === "setMaterials") && tier !== "comfort") {
    ops.push({ op: "setMaterials", fields: { ...TIER_PROFILES[tier].defaultMaterials } });
  }

  const roof = input.house.roof as RoofType;
  const withTier = [...ops, ...tierOps({ ...input, ops }, tier, roof)];
  const withTerrain = [...withTier, ...terrainOps({ ...input, ops: withTier }, tier)];
  return { ops: withTerrain, tier };
}
