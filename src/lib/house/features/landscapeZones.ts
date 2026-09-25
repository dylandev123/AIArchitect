import type { LandscapeKind, LandscapeZoneConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { LANDSCAPE_COLORS, LANDSCAPE_LIMITS, SITE_POSITION_LIMIT } from "../constants";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";
import { ellipseOutline, flatPolygon, translateOutline, triMeshOf } from "../geometry/mesh";

const LANDSCAPE_KINDS: LandscapeKind[] = ["garden", "lawn", "clearing"];

export function validateLandscapeZone(raw: unknown): FeatureValidation<LandscapeZoneConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const kindRaw = typeof o.kind === "string" ? o.kind : "";
  const kind = LANDSCAPE_KINDS.includes(kindRaw as LandscapeKind) ? (kindRaw as LandscapeKind) : "lawn";
  if (kind !== kindRaw) warnings.push(`Unknown "kind" value ${JSON.stringify(kindRaw)} — defaulting to "lawn".`);

  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);
  const width = clampNumber(values.width, LANDSCAPE_LIMITS.width.min, LANDSCAPE_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, LANDSCAPE_LIMITS.depth.min, LANDSCAPE_LIMITS.depth.max, "depth", warnings);

  return { value: { kind, x, z, width, depth }, errors: [], warnings };
}

/** A deliberate, colored ground treatment — distinct from the site's ambient automatic trees/grass. */
export function buildLandscapeZone(config: LandscapeZoneConfig, index: number): HousePrimitive[] {
  const label = config.kind === "garden" ? "Garden" : config.kind === "clearing" ? "Clearing" : "Lawn";
  if (config.kind === "clearing") {
    // An open meadow: an irregular oval, so it reads as a gap in the trees rather than a marked rectangle.
    const outline = translateOutline(ellipseOutline(config.width, config.depth, 32), config.x, config.z);
    return [triMeshOf(`landscape-${index}-zone`, "landscape", `${label} ${index + 1}`, flatPolygon(outline, 0.035), { color: LANDSCAPE_COLORS.clearing, roughness: 0.95, metalness: 0 })];
  }
  return [
    {
      kind: "box",
      id: `landscape-${index}-zone`,
      category: "landscape",
      label: `${label} ${index + 1}`,
      position: [config.x, 0.03, config.z],
      rotation: [0, 0, 0],
      size: [config.width, 0.06, config.depth],
      color: LANDSCAPE_COLORS[config.kind],
    },
  ];
}
