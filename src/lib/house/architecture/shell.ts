import type { CompassSide, HouseConfig, MaterialsConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { FLOOR_THICKNESS, LEVEL_HEIGHT, MATERIAL_COLORS, WALL_HEIGHT } from "../constants";
import { buildFloorSlabPrimitive } from "../primitiveBuilders";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade, type DoorSpan } from "./parts";
import { SIDE_VECTORS, type ArchitectureProfile } from "./profiles";
import { buildCabinRoof, buildFloatingRoof, buildVerandaHipRoof, type StyledRoofInput } from "./roofs";
import { buildFoundation, buildWalls } from "./walls";

/** Everything the styled shell needs beyond the house dimensions. */
export interface StyledShellContext {
  profile: ArchitectureProfile;
  view: CompassSide;
  approach: CompassSide;
  /** Ground-floor door openings, kept clear of plinths and foundations. */
  doors: readonly DoorSpan[];
}

const GLASS = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });

/**
 * The structural envelope of a house in a profiled style: floor slabs, walls, foundation, style-specific massing
 * elements and the roof. Replaces the generic wall-ring / trim / cornice shell; windows, doors, porches and every
 * other feature are still generated separately and remain independently editable.
 */
export function buildStyledShell(config: HouseConfig, materials: MaterialsConfig, ctx: StyledShellContext): HousePrimitive[] {
  const { width, depth, floors } = config;
  const { profile } = ctx;
  const exterior = resolveMaterial(materials.exterior);
  const roof = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);
  const footprint = { center: [0, 0] as [number, number], width, depth };
  const out: HousePrimitive[] = [];

  for (let level = 0; level < floors; level++) {
    const floorY = level * LEVEL_HEIGHT;
    out.push(buildFloorSlabPrimitive(footprint, floorY, FLOOR_THICKNESS, `floor-${level}`, `Floor Slab ${level + 1}`, MATERIAL_COLORS.floor));
    out.push(
      ...buildWalls(profile.construction, {
        footprint,
        baseY: floorY + FLOOR_THICKNESS,
        height: WALL_HEIGHT,
        idPrefix: `wall-${level}`,
        labelPrefix: `Wall ${level + 1}`,
        material: exterior,
      })
    );
    out.push(...buildLevelDetail(profile, config, materials, level));
  }

  out.push(...buildFoundation(profile.foundation, { footprint, material: exterior, doors: ctx.doors }));
  out.push(...buildMassing(profile, config, materials, ctx));

  const roofInput: StyledRoofInput = {
    width,
    depth,
    baseY: floors * LEVEL_HEIGHT,
    idPrefix: "roof",
    roof,
    exterior,
    trim,
    glass: GLASS,
    shape: profile.roof,
    approach: SIDE_VECTORS[ctx.approach],
  };
  if (profile.roof.character === "cabin-gable") out.push(...buildCabinRoof(roofInput));
  else if (profile.roof.character === "floating-plate") out.push(...buildFloatingRoof(roofInput));
  else out.push(...buildVerandaHipRoof(roofInput));
  return out;
}

/** Per-storey elements: cantilevered floor plates (modern) and belt courses + corner quoins (Caribbean). */
function buildLevelDetail(profile: ArchitectureProfile, config: HouseConfig, materials: MaterialsConfig, level: number): HousePrimitive[] {
  const { width, depth } = config;
  const exterior = resolveMaterial(materials.exterior);
  const trim = resolveMaterial(materials.trim);
  const floorY = level * LEVEL_HEIGHT;
  const wallTop = floorY + FLOOR_THICKNESS + WALL_HEIGHT;
  const out: HousePrimitive[] = [];

  if (profile.construction === "rendered-slab") {
    // Every storey sits on a slab that projects past the walls, so the building reads as stacked plates.
    const proud = level === 0 ? 0.55 : 0.7;
    out.push(
      box(`plate-${level}`, "floor", `Floor Plate ${level + 1}`, [0, floorY + FLOOR_THICKNESS / 2, 0], [width + proud * 2, FLOOR_THICKNESS, depth + proud * 2], paintOf(exterior, shade(exterior.color, 1.04))),
      box(`plate-${level}-edge`, "floor", `Floor Plate Edge ${level + 1}`, [0, floorY + FLOOR_THICKNESS + 0.03, 0], [width + proud * 2 - 0.1, 0.06, depth + proud * 2 - 0.1], paintOf(trim))
    );
  }

  if (profile.construction === "raised-stucco") {
    const belt = paintOf(trim);
    const T = 0.06;
    const H = 0.16;
    const y = wallTop - 0.3;
    out.push(
      box(`belt-${level}-n`, "wall", `Belt Course ${level + 1} (North)`, [0, y, -depth / 2 - T / 2], [width + T * 2, H, T], belt),
      box(`belt-${level}-s`, "wall", `Belt Course ${level + 1} (South)`, [0, y, depth / 2 + T / 2], [width + T * 2, H, T], belt),
      box(`belt-${level}-e`, "wall", `Belt Course ${level + 1} (East)`, [width / 2 + T / 2, y, 0], [T, H, depth], belt),
      box(`belt-${level}-w`, "wall", `Belt Course ${level + 1} (West)`, [-width / 2 - T / 2, y, 0], [T, H, depth], belt)
    );
    // Corner quoins: full-height pilasters in the trim colour.
    const q = 0.3;
    const cy = floorY + FLOOR_THICKNESS + WALL_HEIGHT / 2;
    for (const [id, sx, sz] of [["nw", -1, -1], ["ne", 1, -1], ["se", 1, 1], ["sw", -1, 1]] as const) {
      out.push(box(`quoin-${level}-${id}`, "wall", `Corner Quoin ${level + 1}`, [(sx * width) / 2, cy, (sz * depth) / 2], [q, WALL_HEIGHT, q], belt));
    }
  }
  return out;
}

/** Style massing that sits outside the wall/roof envelope: modern blade wall and roof columns. */
function buildMassing(profile: ArchitectureProfile, config: HouseConfig, materials: MaterialsConfig, ctx: StyledShellContext): HousePrimitive[] {
  if (profile.construction !== "rendered-slab") return [];
  const { width, depth, floors } = config;
  const trim = resolveMaterial(materials.trim);
  const out: HousePrimitive[] = [];
  const [ax, az] = SIDE_VECTORS[ctx.approach];
  const [vx, vz] = SIDE_VECTORS[ctx.view];
  const height = floors * LEVEL_HEIGHT - 0.02;

  // Blade wall: a freestanding stone-clad screen along one end of the house, tucked under the roof plate, that runs
  // out toward the entrance.
  const alongZ = Math.abs(az) > 0.5;
  const halfA = alongZ ? depth / 2 : width / 2;
  const halfL = alongZ ? width / 2 : depth / 2;
  const T = 0.5;
  const reach = 3.5;
  const length = halfA * 2 + reach;
  const alongCenter = (reach / 2) * (alongZ ? az : ax);
  const lateral = -(halfL + 0.9 + T / 2);
  const stone = { color: "#5f5a52", roughness: 0.9, metalness: 0.02 };
  out.push(
    alongZ
      ? box("blade-wall", "wall", "Blade Wall", [lateral, height / 2, alongCenter], [T, height, length], stone)
      : box("blade-wall", "wall", "Blade Wall", [alongCenter, height / 2, lateral], [length, height, T], stone)
  );

  // Slim steel columns holding the roof plate's cantilever on the view side.
  const roofOver = ctx.profile.roof.overhang - 0.3;
  const viewAlongZ = Math.abs(vz) > 0.5;
  const halfView = viewAlongZ ? depth / 2 : width / 2;
  const halfAcross = viewAlongZ ? width / 2 : depth / 2;
  const cols = Math.max(2, Math.ceil((halfAcross * 2 + roofOver * 2) / 5) + 1);
  const colH = floors * LEVEL_HEIGHT;
  for (let c = 0; c < cols; c++) {
    const across = -(halfAcross + roofOver) + ((halfAcross + roofOver) * 2 * c) / (cols - 1);
    const along = (halfView + roofOver) * (viewAlongZ ? vz : vx);
    const pos: [number, number, number] = viewAlongZ ? [across, colH / 2, along] : [along, colH / 2, across];
    out.push(box(`column-${c}`, "wall", "Steel Column", pos, [0.14, colH, 0.14], paintOf(trim)));
  }
  return out;
}
