import type { HousePrimitive } from "@/lib/house/types";
import { shade, type Paint } from "@/lib/house/architecture/parts";
import { buildSeamRibs, buildSurfaceMesh, type PatternModule } from "./planes";
import { registerRoofSystem } from "./registry";
import { flatEdgeTrim, pitchedTrim, trimMesh, type PitchedTrimSpec } from "./trim";
import type { RoofAssembly, RoofFinishContext, RoofSystem } from "./types";
import type { MaterialType } from "@/types/house";

/** Plates, soffits and fascias built in the roof finish take its surface explicitly rather than by colour match. */
function finishedStructure(assembly: RoofAssembly, ctx: RoofFinishContext): HousePrimitive[] {
  return assembly.structure.map((p) => (p.category === "roof" && p.color === ctx.finish.paint.color ? { ...p, surface: ctx.finish.material } : p));
}

function flatTrim(assembly: RoofAssembly, flashing: Paint): HousePrimitive[] {
  const { vertices, label } = flatEdgeTrim(assembly);
  return trimMesh(`${assembly.id}-${assembly.parapet ? "coping" : "drip-edge"}`, label, vertices, flashing);
}

// ── Standing seam ──────────────────────────────────────────────────────────────────────────────────────────────

/** Nominal pan width (m); each face gets the whole number of equal pans nearest it. */
export const STANDING_SEAM_PAN = 0.42;
const SEAM_RIB = { width: 0.025, height: 0.035 };
const SEAM_TRIM: PitchedTrimSpec = { board: { height: 0.2, thickness: 0.035 }, rim: { width: 0.07, height: 0.04 }, cap: { leaf: 0.13, thickness: 0.05 }, valley: { leaf: 0.22, thickness: 0.04 } };

/**
 * Sheet-metal pans with raised seams running from the low edge straight up every face. The one system that
 * can cover any form (a low-slope deck included), which makes it the stand-in for every pitched roof another
 * primary system can't cover.
 */
const standingSeam: RoofSystem = {
  id: "standing-seam",
  label: "Standing seam metal",
  materials: ["standing-seam-metal", "metal", "zinc", "copper", "corten", "black-aluminum"],
  defaultFinish: { material: "standing-seam-metal", color: "#3f474d" },
  fallbackFor: "pitched",
  supports: () => true,
  finish(assembly, ctx) {
    const { paint, flashing, material } = ctx.finish;
    const out = finishedStructure(assembly, ctx);
    const surface = buildSurfaceMesh(`${assembly.id}-surface`, "Standing Seam Roof", assembly.planes, paint, material);
    if (surface) out.push(surface);
    out.push(...trimMesh(`${assembly.id}-seams`, "Standing Seams", buildSeamRibs(assembly.planes, STANDING_SEAM_PAN, SEAM_RIB), paint));
    if (assembly.shape.form === "flat") return [...out, ...flatTrim(assembly, flashing)];
    const { boards, caps } = pitchedTrim(assembly, SEAM_TRIM);
    // Fascia, rake and ridge flashings are all the same folded sheet metal: one mesh.
    return [...out, ...trimMesh(`${assembly.id}-trim`, "Roof Flashing", [...boards, ...caps], flashing)];
  },
};

// ── Tile / shingle ─────────────────────────────────────────────────────────────────────────────────────────────

/** Lowest pitch (degrees) a lapped covering sheds water at. */
export const TILE_MIN_PITCH = 10;
/** Nominal unit width and course exposure (m) per covering; the rest lay like clay tile. */
const SHINGLE_MODULE: PatternModule = [0.16, 0.19];
const TILE_MODULE: Partial<Record<MaterialType, PatternModule>> = { slate: [0.3, 0.2], cedar: SHINGLE_MODULE, wood: SHINGLE_MODULE, timber: SHINGLE_MODULE, teak: SHINGLE_MODULE };
const CLAY_MODULE: PatternModule = [0.17, 0.3];
export const tileModuleFor = (material: MaterialType): PatternModule => TILE_MODULE[material] ?? CLAY_MODULE;
const TILE_TRIM: PitchedTrimSpec = { board: { height: 0.2, thickness: 0.04 }, rim: { width: 0.07, height: 0.03 }, cap: { leaf: 0.14, thickness: 0.05 }, valley: { leaf: 0.2, thickness: 0.04 } };

/**
 * Lapped units in courses parallel to the eave — clay tile, slate, timber shingles. Every face carries a whole
 * number of courses, so they start at the eave, finish at the ridge and line up across a hip.
 */
const tileShingle: RoofSystem = {
  id: "tile-shingle",
  label: "Tile / shingle",
  materials: ["tile", "terracotta", "slate", "cedar", "wood", "timber", "teak"],
  defaultFinish: { material: "slate", color: "#5a5c60" },
  supports: (shape) => shape.form === "pitched" && shape.pitchDeg >= TILE_MIN_PITCH,
  finish(assembly, ctx) {
    const { paint, material } = ctx.finish;
    const out = finishedStructure(assembly, ctx);
    const surface = buildSurfaceMesh(`${assembly.id}-surface`, "Roof Courses", assembly.planes, paint, material, tileModuleFor(material));
    if (surface) out.push(surface);
    const { boards, caps } = pitchedTrim(assembly, TILE_TRIM);
    return [
      ...out,
      ...trimMesh(`${assembly.id}-trim`, "Roof Fascia", boards, ctx.trim),
      ...trimMesh(`${assembly.id}-caps`, "Ridge & Hip Caps", caps, { ...paint, color: shade(paint.color, 0.82) }),
    ];
  },
};

// ── Flat / parapet ─────────────────────────────────────────────────────────────────────────────────────────────

/** A membrane deck: no surface pattern, all of its character in the edge — a coping on a parapet, a drip edge on an eave. */
const flatParapet: RoofSystem = {
  id: "flat-parapet",
  label: "Flat membrane / parapet",
  materials: ["concrete", "board-formed-concrete", "stucco", "charcoal-stucco", "render", "coral-render", "stone", "limestone", "travertine", "basalt", "marble"],
  defaultFinish: { material: "concrete", color: "#b9b5aa" },
  fallbackFor: "flat",
  supports: (shape) => shape.form === "flat",
  finish(assembly, ctx) {
    const out = finishedStructure(assembly, ctx);
    const surface = buildSurfaceMesh(`${assembly.id}-surface`, "Roof Membrane", assembly.planes, ctx.finish.paint, ctx.finish.material);
    if (surface) out.push(surface);
    return [...out, ...flatTrim(assembly, ctx.finish.flashing)];
  },
};

registerRoofSystem(standingSeam);
registerRoofSystem(tileShingle);
registerRoofSystem(flatParapet);
