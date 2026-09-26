import type { BuildingConfig, DesignTier, MaterialsConfig, RoofType } from "@/types/house";
import type { HousePrimitive } from "../types";
import { FLOOR_THICKNESS, LEVEL_HEIGHT, MATERIAL_COLORS, WALL_HEIGHT } from "../constants";
import { buildFloorSlabPrimitive, buildWallRingPrimitives, translatePrimitive } from "../primitiveBuilders";
import { getWallAnchorForFootprint } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { buildFlatRoof } from "../roof/flatRoof";
import { buildGableRoof } from "../roof/gableRoof";
import { buildHipRoof } from "../roof/hipRoof";
import { buildMansardRoof } from "../roof/mansardRoof";
import { buildShedRoof } from "../roof/shedRoof";
import { buildButterflyRoof } from "../roof/butterflyRoof";
import { buildSawtoothRoof } from "../roof/sawtoothRoof";
import { buildRoofDetail } from "../architecture/roofDetail";
import { box, paintOf } from "../architecture/parts";
import { getArchitectureProfile } from "../architecture/profiles";
import { buildCabinRoof, buildFloatingRoof, buildVerandaHipRoof, type StyledRoofInput } from "../architecture/roofs";
import { buildFoundation, buildWalls } from "../architecture/walls";
import { TIER_PROFILES, resolveTier } from "../tiers";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { addWindow } from "./buildingParts";

const ROOF_BUILDERS: Record<RoofType, typeof buildFlatRoof> = {
  flat: buildFlatRoof,
  gable: buildGableRoof,
  hip: buildHipRoof,
  mansard: buildMansardRoof,
  shed: buildShedRoof,
  butterfly: buildButterflyRoof,
  sawtooth: buildSawtoothRoof,
};

/**
 * The shell of a building in the main house's own architectural language: the same wall construction, foundation and
 * roof for a profiled style (log, slab, raised stucco), or the same trim, cornice and roof layers for the generic
 * shell. Used by wings, and by any building flagged `matchHouse`, so they never read as a differently-styled box
 * beside the house. Doors and windows are added by the caller.
 */
export function buildStyledMass(
  config: BuildingConfig,
  materials: MaterialsConfig,
  idPrefix: string,
  label: string,
  opts?: ResolvedExteriorOptions,
  tier?: DesignTier
): HousePrimitive[] {
  const { x, z, width, depth, floors } = config;
  const profile = getArchitectureProfile(opts?.style);
  const exterior = resolveMaterial(materials.exterior);
  const roofMat = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });
  const footprint = { center: [x, z] as [number, number], width, depth };
  const out: HousePrimitive[] = [];

  for (let level = 0; level < floors; level++) {
    const floorY = level * LEVEL_HEIGHT;
    out.push(buildFloorSlabPrimitive(footprint, floorY, FLOOR_THICKNESS, `${idPrefix}-floor-${level}`, `${label} Floor ${level + 1}`, MATERIAL_COLORS.floor));
    if (profile) {
      out.push(...buildWalls(profile.construction, { footprint, baseY: floorY + FLOOR_THICKNESS, height: WALL_HEIGHT, idPrefix: `${idPrefix}-wall-${level}`, labelPrefix: `${label} Wall ${level + 1}`, material: exterior }));
    } else {
      out.push(...buildWallRingPrimitives(footprint, floorY + FLOOR_THICKNESS, WALL_HEIGHT, `${idPrefix}-wall-${level}`, `${label} Wall ${level + 1}`, exterior.color, [], exterior));
      out.push(...genericLevelTrim(config, trim, idPrefix, label, level));
    }
  }
  if (profile) out.push(...buildFoundation(profile.foundation, { footprint, material: exterior, doors: [], idPrefix: `${idPrefix}-foundation` }));

  // Roof, built at the origin and moved into place.
  const baseY = floors * LEVEL_HEIGHT;
  let roof: HousePrimitive[];
  if (profile) {
    // Overhangs stay short so the wing's eaves don't run into the house it is joined to.
    const shape = { ...profile.roof, overhang: Math.min(profile.roof.overhang, 0.7), rakeOverhang: Math.min(profile.roof.rakeOverhang, 0.7) };
    const input: StyledRoofInput = { width, depth, baseY, idPrefix, roof: roofMat, exterior, trim, glass, shape, approach: [0, 1] };
    if (profile.roof.character === "cabin-gable") roof = buildCabinRoof(input);
    else if (profile.roof.character === "floating-plate") roof = buildFloatingRoof({ ...input, pavilion: false });
    else roof = buildVerandaHipRoof(input);
  } else {
    roof = ROOF_BUILDERS[config.roof](width, depth, baseY, idPrefix, roofMat, exterior);
    const layers = TIER_PROFILES[resolveTier(tier)].detail.roofLayers;
    if (layers !== 0 && (config.roof === "gable" || config.roof === "hip")) roof.push(...buildRoofDetail(config.roof, width, depth, baseY, layers, trim, roofMat).map((p) => ({ ...p, id: `${idPrefix}-${p.id}` })));
  }
  out.push(...roof.map((p) => translatePrimitive(p, x, z)));
  return out;
}

/** A wing: an extension of the main house with a window rhythm on every side and floor and no door of its own (the
 *  windows on the side it shares with the house are simply hidden). */
export function buildWing(
  config: BuildingConfig,
  materials: MaterialsConfig,
  idPrefix: string,
  label: string,
  opts?: ResolvedExteriorOptions,
  tier?: DesignTier
): HousePrimitive[] {
  const { x, z, width, depth, floors } = config;
  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });
  const footprint = { center: [x, z] as [number, number], width, depth };
  const out = buildStyledMass(config, materials, idPrefix, label, opts, tier);

  const winW = 1.4;
  const winH = 1.5;
  for (let level = 0; level < floors; level++) {
    const winBaseY = level * LEVEL_HEIGHT + FLOOR_THICKNESS;
    for (const side of ["north", "south", "east", "west"] as const) {
      const anchor = getWallAnchorForFootprint(footprint.center, width, depth, winBaseY, side);
      const n = Math.max(1, Math.floor(anchor.length / 3.6));
      for (let i = 0; i < n; i++) {
        const centre = (anchor.length * (i + 0.5)) / n;
        addWindow(out, anchor, centre - winW / 2, winW, winH, 0.85, `${idPrefix}-l${level}-${side[0]}-${i}`, `${label} Window`, trim, glass, winBaseY);
      }
    }
  }
  return out.map((p) => ({ ...p, category: "building" as const }));
}

/** The generic shell's base trim, corner pillars and (on the top floor) cornice, sized to the wing. */
export function genericLevelTrim(config: BuildingConfig, trim: ReturnType<typeof resolveMaterial>, idPrefix: string, label: string, level: number): HousePrimitive[] {
  const { x, z, width, depth, floors } = config;
  const paint = paintOf(trim);
  const floorY = level * LEVEL_HEIGHT;
  const out: HousePrimitive[] = [];
  const hw = width / 2;
  const hd = depth / 2;

  const trimH = 0.22;
  const T = 0.08;
  const ty = floorY + FLOOR_THICKNESS + trimH / 2;
  out.push(
    box(`${idPrefix}-trim-${level}-n`, "wall", `${label} Wall Trim`, [x, ty, z - hd - T / 2], [width + T * 2, trimH, T], paint),
    box(`${idPrefix}-trim-${level}-s`, "wall", `${label} Wall Trim`, [x, ty, z + hd + T / 2], [width + T * 2, trimH, T], paint),
    box(`${idPrefix}-trim-${level}-e`, "wall", `${label} Wall Trim`, [x + hw + T / 2, ty, z], [T, trimH, depth], paint),
    box(`${idPrefix}-trim-${level}-w`, "wall", `${label} Wall Trim`, [x - hw - T / 2, ty, z], [T, trimH, depth], paint)
  );

  const pillar = 0.2 + 0.06;
  const py = floorY + FLOOR_THICKNESS + WALL_HEIGHT / 2;
  for (const [id, sx, sz] of [["nw", -1, -1], ["ne", 1, -1], ["se", 1, 1], ["sw", -1, 1]] as const) {
    out.push(box(`${idPrefix}-pillar-${level}-${id}`, "wall", `${label} Corner Pillar`, [x + sx * hw, py, z + sz * hd], [pillar, WALL_HEIGHT, pillar], paint));
  }

  if (level === floors - 1) {
    const H = 0.2;
    const C = 0.11;
    const cy = floorY + FLOOR_THICKNESS + WALL_HEIGHT - H / 2;
    out.push(
      box(`${idPrefix}-cornice-n`, "wall", `${label} Wall Cornice`, [x, cy, z - hd - C / 2], [width + C * 2, H, C], paint),
      box(`${idPrefix}-cornice-s`, "wall", `${label} Wall Cornice`, [x, cy, z + hd + C / 2], [width + C * 2, H, C], paint),
      box(`${idPrefix}-cornice-e`, "wall", `${label} Wall Cornice`, [x + hw + C / 2, cy, z], [C, H, depth], paint),
      box(`${idPrefix}-cornice-w`, "wall", `${label} Wall Cornice`, [x - hw - C / 2, cy, z], [C, H, depth], paint)
    );
  }
  return out;
}
