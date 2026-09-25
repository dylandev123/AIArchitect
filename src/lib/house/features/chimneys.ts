import type { ChimneyConfig, HouseConfig, MaterialsConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { CHIMNEY_LIMITS, LEVEL_HEIGHT } from "../constants";
import { resolveMaterial } from "../materials";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { box, hash01, shade, wallFrame } from "../architecture/parts";
import { estimateRoofTop, getArchitectureProfile } from "../architecture/profiles";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

const COURSE = 0.42;
/** How far the stack's cap rises above the roof's highest point. */
const CLEARANCE_ABOVE_RIDGE = 0.9;

export function validateChimney(raw: unknown, house: HouseConfig): FeatureValidation<ChimneyConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["offset", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "east");
  if (wall.warning) warnings.push(wall.warning);

  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const width = clampNumber(values.width, CHIMNEY_LIMITS.width.min, Math.min(CHIMNEY_LIMITS.width.max, Math.max(CHIMNEY_LIMITS.width.min, wallLength)), "width", warnings);
  const depth = clampNumber(values.depth, CHIMNEY_LIMITS.depth.min, CHIMNEY_LIMITS.depth.max, "depth", warnings);
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);
  return { value: { wall: wall.value, offset, width, depth }, errors: [], warnings };
}

/**
 * An exterior chimney stack: a wide firebox base, a shoulder, then a slimmer shaft, built up in stone courses
 * that alternate slightly in width so the surface reads as masonry. It rises past the roof's high point, so it
 * clears the ridge whatever the style's roof pitch is.
 */
export function buildChimney(
  config: ChimneyConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number,
  opts?: ResolvedExteriorOptions
): HousePrimitive[] {
  const { offset, width, depth } = config;
  const f = wallFrame(house, config.wall);
  const profile = getArchitectureProfile(opts?.style);
  const exterior = resolveMaterial(materials.exterior);
  const stone = profile?.chimney ?? { material: "stone" as const, color: "#8a8478" };
  const roughness = profile?.chimney ? 0.92 : exterior.roughness;
  const id = `chimney-${index}`;
  const label = `Chimney ${index + 1}`;
  const uMid = offset + width / 2;
  const top = estimateRoofTop(house, profile) + CLEARANCE_ABOVE_RIDGE;
  const eave = house.floors * LEVEL_HEIGHT;
  const out: HousePrimitive[] = [];

  const courses = Math.ceil(top / COURSE);
  const courseH = top / courses;
  for (let c = 0; c < courses; c++) {
    const y0 = c * courseH;
    const yMid = y0 + courseH / 2;
    const wide = yMid < eave - 0.6;
    const shoulder = !wide && yMid < eave + 0.2;
    const grow = wide ? 0.4 : shoulder ? 0.2 : 0;
    const jitter = (hash01(c * 7.3 + index) - 0.5) * 0.06;
    const w = width + grow + jitter;
    const d = depth + (wide ? 0.2 : shoulder ? 0.1 : 0) + jitter;
    const tone = 0.86 + hash01(c * 3.1 + index * 5) * 0.28;
    out.push(
      box(`${id}-course-${c}`, "chimney", `${label} Stone`, f.at(uMid, yMid, d / 2 - 0.06), f.size(w, courseH - 0.015, d), { color: shade(stone.color, tone), roughness, metalness: 0.02 })
    );
  }

  out.push(
    box(`${id}-cap`, "chimney", `${label} Cap`, f.at(uMid, top + 0.06, depth / 2 - 0.06), f.size(width + 0.3, 0.12, depth + 0.3), { color: shade(stone.color, 0.7), roughness: 0.9, metalness: 0 }),
    box(`${id}-flue`, "chimney", `${label} Flue`, f.at(uMid, top + 0.32, depth / 2 - 0.06), f.size(width * 0.4, 0.4, depth * 0.4), { color: "#2a2826", roughness: 0.8, metalness: 0.1 })
  );
  return out;
}
