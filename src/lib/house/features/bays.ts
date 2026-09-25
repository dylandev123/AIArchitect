import type { BayConfig, BayForm, HouseConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { BAY_LIMITS, FLOOR_THICKNESS, GLASS_THICKNESS, LEVEL_HEIGHT, MATERIAL_COLORS } from "../constants";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade, wallFrame, type WallFrame } from "../architecture/parts";
import { arcPoints, extrudeOutline, fanToApex, quadVerts, triMeshOf, type P2 } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readEnum, readNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

const BAY_FORMS: BayForm[] = ["angled", "round", "turret"];

export function validateBay(raw: unknown, house: HouseConfig): FeatureValidation<BayConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["offset", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);
  const form = readEnum(o, "form", BAY_FORMS, "angled", warnings);
  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;

  const level = clampNumber(Math.round(readNumber(o, "level", 0, 0, 99, warnings)), 0, Math.max(0, house.floors - 1), "level", warnings);
  const width = clampNumber(values.width, BAY_LIMITS.width.min, Math.min(BAY_LIMITS.width.max, wallLength), "width", warnings);
  // A turret is a round tower whose centre sits `depth − radius` out from the wall, so its projection cannot exceed its diameter.
  const maxDepth = form === "turret" ? Math.min(BAY_LIMITS.depth.max, width) : BAY_LIMITS.depth.max;
  const depth = clampNumber(values.depth, BAY_LIMITS.depth.min, maxDepth, "depth", warnings);
  // A turret may stand one storey taller than the house; a bay may not outgrow it.
  const room = house.floors - level + (form === "turret" ? 1 : 0);
  const levels = clampNumber(Math.round(readNumber(o, "levels", 1, BAY_LIMITS.levels.min, BAY_LIMITS.levels.max, warnings)), 1, Math.max(1, room), "levels", warnings);
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);
  return { value: { wall: wall.value, level, offset, width, depth, levels, form }, errors: [], warnings };
}

/** The bay's plan outline in the wall's (u along, v outward) frame; the first and last points sit on the wall. */
function planOutline(config: BayConfig): P2[] {
  const { offset, width, depth, form } = config;
  const uMid = offset + width / 2;
  if (form === "angled") {
    const cut = Math.min(depth, width * 0.28);
    return [[offset, 0], [offset + cut, depth], [offset + width - cut, depth], [offset + width, 0]];
  }
  if (form === "round") {
    return arcPoints(uMid, 0, 1, 0, 180, 14).map(([c, s]) => [uMid + (c - uMid) * (width / 2), s * depth] as P2);
  }
  const radius = width / 2;
  return arcPoints(uMid, depth - radius, radius, 0, 360, 12).slice(0, 12);
}

/** A framed glass panel standing off a facet of the bay, given the facet's end points in world XZ. */
function facetWindow(id: string, label: string, a: P2, b: P2, y0: number, height: number, ctx: BuildContext): HousePrimitive[] {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.5) return [];
  const tx = dx / len;
  const tz = dz / len;
  const trim = resolveMaterial(ctx.materials.trim);
  const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const panel = (half: number, lift: number, y: number, h: number): number[] => {
    const out: number[] = [];
    // Both facing directions are drawn by the renderer, so the panel simply stands 'lift' metres off the facet along either normal.
    const nx = -tz;
    const nz = tx;
    const p = (s: number, yy: number, sign: number): [number, number, number] => [mid[0] + tx * s + nx * lift * sign, yy, mid[1] + tz * s + nz * lift * sign];
    for (const sign of [1, -1]) quadVerts(out, p(-half, y, sign), p(half, y, sign), p(half, y + h, sign), p(-half, y + h, sign));
    return out;
  };
  const w = len * 0.62;
  return [
    triMeshOf(`${id}-frame`, "bay", `${label} Window Frame`, panel(w / 2 + 0.07, 0.02, y0 - 0.07, height + 0.14), paintOf(trim)),
    triMeshOf(`${id}-glass`, "bay", `${label} Window`, panel(w / 2, 0.02 + GLASS_THICKNESS, y0, height), {
      color: MATERIAL_COLORS.glass,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.4,
    }),
  ];
}

/**
 * A bay or turret volume: a prism on the wall, glazed on its faces, capped with a hip or conical roof. Angled and
 * round bays project from the wall; a turret is a full round tower with a steep cone that can rise above the eaves.
 */
export function buildBay(config: BayConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const f: WallFrame = wallFrame(ctx.house, config.wall);
  const exterior = resolveMaterial(ctx.materials.exterior);
  const roof = resolveMaterial(ctx.materials.roof);
  const trim = resolveMaterial(ctx.materials.trim);
  const id = `bay-${index}`;
  const label = config.form === "turret" ? `Turret ${index + 1}` : `Bay ${index + 1}`;

  const outline = planOutline(config).map(([u, v]) => {
    const p = f.at(u, 0, v);
    return [p[0], p[2]] as P2;
  });
  const y0 = config.level === 0 ? 0 : config.level * LEVEL_HEIGHT + FLOOR_THICKNESS - 0.3;
  const y1 = (config.level + config.levels) * LEVEL_HEIGHT;

  const out: HousePrimitive[] = [];
  out.push(triMeshOf(`${id}-body`, "bay", `${label} Walls`, extrudeOutline(outline, y0, y1), paintOf(exterior)));

  // A band of trim at the base and just under the roof, so the volume reads as a built element, not an extrusion.
  const [cx, cz] = [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length];
  const grow = (pts: P2[], by: number): P2[] => pts.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const len = Math.hypot(dx, dz) || 1;
    return [x + (dx / len) * by, z + (dz / len) * by];
  });
  // Facets are the open edges away from the wall; a turret's ring is closed, so all its edges count.
  const closed = config.form === "turret";
  out.push(triMeshOf(`${id}-plinth`, "bay", `${label} Base`, extrudeOutline(grow(outline, 0.08), y0, y0 + 0.5), paintOf(trim, shade(exterior.color, 0.82))));
  out.push(triMeshOf(`${id}-cornice`, "bay", `${label} Cornice`, extrudeOutline(grow(outline, 0.14), y1 - 0.2, y1), paintOf(trim)));

  const facetCount = closed ? outline.length : outline.length - 1;
  // Turret facets are narrow, so glaze every third; bays glaze every facet that is not the wall.
  const glazed = (i: number) => (closed ? i % 3 === 1 : true);
  for (let level = config.level; level < config.level + config.levels; level++) {
    const floorY = level * LEVEL_HEIGHT + FLOOR_THICKNESS;
    for (let i = 0; i < facetCount; i++) {
      if (!glazed(i)) continue;
      out.push(...facetWindow(`${id}-l${level}-f${i}`, label, outline[i], outline[(i + 1) % outline.length], floorY + 0.75, 1.35, ctx));
    }
  }

  // Roof: a low hip over an angled or round bay, a steep cone over a turret.
  const overhang = closed ? 0.35 : 0.25;
  const capOutline = grow(outline, overhang);
  const apexHeight = closed ? Math.max(2.2, config.width * 1.3) : Math.max(0.8, config.width * 0.3);
  out.push(triMeshOf(`${id}-roof`, "roof", `${label} Roof`, fanToApex(capOutline, y1, [cx, y1 + apexHeight, cz]), paintOf(roof)));
  if (closed) out.push(box(`${id}-finial`, "roof", `${label} Finial`, [cx, y1 + apexHeight + 0.22, cz], [0.1, 0.5, 0.1], paintOf(trim)));
  return out;
}
