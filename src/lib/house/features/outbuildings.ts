import type { BuildingConfig, DesignTier, MaterialsConfig, RoofType } from "@/types/house";
import type { HousePrimitive } from "../types";
import { DOOR_PANEL_THICKNESS, FLOOR_THICKNESS, FRAME_BORDER, MATERIAL_COLORS, WALL_HEIGHT } from "../constants";
import { buildFloorSlabPrimitive, translatePrimitive } from "../primitiveBuilders";
import { resolveMaterial } from "../materials";
import { buildFlatRoof } from "../roof/flatRoof";
import { buildGableRoof } from "../roof/gableRoof";
import { buildHipRoof } from "../roof/hipRoof";
import { buildShedRoof } from "../roof/shedRoof";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { box, paintOf, shade, type Paint } from "../architecture/parts";
import { getArchitectureProfile, type RoofShape } from "../architecture/profiles";
import { buildCabinRoof, buildFloatingRoof } from "../architecture/roofs";
import { buildFieldstoneFoundation, buildWalls } from "../architecture/walls";
import { buildRoofDetail } from "../architecture/roofDetail";
import { TIER_PROFILES, resolveTier } from "../tiers";
import { genericLevelTrim } from "./wings";

/** Roofs a small detached structure can carry; anything else falls back to a gable (or flat in a modern style). */
const SIMPLE_ROOFS: RoofType[] = ["flat", "gable", "hip", "shed"];

/**
 * A shed or detached garage. It borrows the project's architectural style — log walls and a steep gable on a
 * cabin plot, a floating plate roof with rendered walls on a modern one — so outbuildings match the main house
 * without being copies of it. Positioned by x/z like every freestanding building.
 */
export function buildOutbuilding(
  config: BuildingConfig,
  materials: MaterialsConfig,
  idPrefix: string,
  label: string,
  opts?: ResolvedExteriorOptions,
  tier?: DesignTier
): HousePrimitive[] {
  const { x, z, width, depth } = config;
  const profile = getArchitectureProfile(opts?.style);
  const exterior = resolveMaterial(materials.exterior);
  const roofMat = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });
  const footprint = { center: [x, z] as [number, number], width, depth };
  const garage = config.kind === "detached_garage";
  const out: HousePrimitive[] = [];

  out.push(buildFloorSlabPrimitive(footprint, 0, FLOOR_THICKNESS, `${idPrefix}-floor`, `${label} Floor`, MATERIAL_COLORS.floor));
  out.push(
    ...buildWalls(profile?.construction ?? "rendered-slab", {
      footprint,
      baseY: FLOOR_THICKNESS,
      height: WALL_HEIGHT,
      idPrefix: `${idPrefix}-wall`,
      labelPrefix: `${label} Wall`,
      material: exterior,
    })
  );
  if (profile?.foundation === "fieldstone") out.push(...buildFieldstoneFoundation({ footprint, material: exterior, doors: [], idPrefix: `${idPrefix}-foundation` }));

  // Roof, built at the origin and moved into place — the same approach every freestanding building uses.
  const baseY = FLOOR_THICKNESS + WALL_HEIGHT;
  const shape: RoofShape | undefined = profile && { ...profile.roof, overhang: Math.min(profile.roof.overhang, 0.7), rakeOverhang: Math.min(profile.roof.rakeOverhang, 0.7) };
  const roofInput = { width, depth, baseY, idPrefix, roof: roofMat, exterior, trim, glass, shape: shape ?? { pitch: 0.35, overhang: 0.6, rakeOverhang: 0.6 }, approach: [0, 1] as [number, number] };
  let roof: HousePrimitive[];
  if (profile?.roof.character === "floating-plate") roof = buildFloatingRoof({ ...roofInput, pavilion: false });
  else if (profile?.roof.character === "cabin-gable") roof = buildCabinRoof(roofInput);
  else {
    const form = SIMPLE_ROOFS.includes(config.roof) ? config.roof : "gable";
    if (form === "flat") roof = buildFlatRoof(width, depth, baseY, idPrefix, roofMat, exterior);
    else if (form === "shed") roof = buildShedRoof(width, depth, baseY, idPrefix, roofMat, exterior);
    else if (form === "hip") roof = buildHipRoof(width, depth, baseY, idPrefix, roofMat, exterior, shape);
    else roof = buildGableRoof(width, depth, baseY, idPrefix, roofMat, exterior, shape);
  }
  out.push(...roof.map((p) => translatePrimitive(p, x, z)));

  // Flagged `matchHouse` in an unprofiled style: carry the generic shell's trim, cornice and roof layers too.
  if (config.matchHouse && !profile) {
    out.push(...genericLevelTrim(config, trim, idPrefix, label, 0));
    const layers = TIER_PROFILES[resolveTier(tier)].detail.roofLayers;
    const form = SIMPLE_ROOFS.includes(config.roof) ? config.roof : "gable";
    if (layers !== 0 && (form === "gable" || form === "hip")) out.push(...buildRoofDetail(form, width, depth, baseY, layers, trim, roofMat).map((p) => translatePrimitive({ ...p, id: `${idPrefix}-${p.id}` }, x, z)));
  }

  // South face: a door (shed) or a wide overhead door (garage), plus a small window on the shed.
  const faceZ = z + depth / 2;
  const door: Paint = garage ? { color: shade(MATERIAL_COLORS.garageDoor, 0.95), roughness: 0.5, metalness: 0.4 } : paintOf(trim, shade(trim.color, 0.85));
  const doorW = garage ? Math.min(width * 0.72, 4.8) : 0.95;
  const doorH = garage ? 2.4 : 2.0;
  out.push(box(`${idPrefix}-door`, "building", garage ? `${label} Garage Door` : `${label} Door`, [x + (garage ? 0 : -width * 0.2), FLOOR_THICKNESS + doorH / 2, faceZ + DOOR_PANEL_THICKNESS / 2 + 0.02], [doorW, doorH, DOOR_PANEL_THICKNESS], door));
  if (garage) {
    for (let k = 1; k <= 3; k++) {
      out.push(box(`${idPrefix}-door-rib-${k}`, "building", `${label} Garage Door Rib`, [x, FLOOR_THICKNESS + (doorH * k) / 4, faceZ + DOOR_PANEL_THICKNESS + 0.03], [doorW, 0.04, 0.02], paintOf(trim)));
    }
  } else {
    const winW = 0.8;
    const winH = 0.7;
    const wy = FLOOR_THICKNESS + 1.3;
    const wx = x + width * 0.22;
    out.push(
      box(`${idPrefix}-window-frame`, "building", `${label} Window Frame`, [wx, wy, faceZ + 0.06], [winW + FRAME_BORDER * 2, winH + FRAME_BORDER * 2, 0.12], paintOf(trim)),
      box(`${idPrefix}-window-glass`, "building", `${label} Window Glass`, [wx, wy, faceZ + 0.13], [winW, winH, 0.03], paintOf(glass))
    );
  }
  return out.map((p) => ({ ...p, category: "building" as const }));
}
