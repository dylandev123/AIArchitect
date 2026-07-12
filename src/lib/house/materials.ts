import type { MaterialAssignment, MaterialsConfig, MaterialType, MaterialZone } from "@/types/house";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";

export const MATERIAL_TYPES: MaterialType[] = ["concrete", "stone", "wood", "glass", "metal", "stucco", "tile"];
export const MATERIAL_ZONES: MaterialZone[] = ["exterior", "roof", "trim", "decking"];

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  concrete: "Concrete",
  stone: "Stone",
  wood: "Wood",
  glass: "Glass",
  metal: "Metal",
  stucco: "Stucco",
  tile: "Tile",
};

export const MATERIAL_ZONE_LABELS: Record<MaterialZone, string> = {
  exterior: "Exterior Walls",
  roof: "Roof",
  trim: "Trim (frames & railings)",
  decking: "Decking",
};

interface MaterialPhysicalProperties {
  roughness: number;
  metalness: number;
  defaultColor: string;
}

/**
 * PBR properties per material type — tuned for Sims-style bright, clean outdoor look.
 * Glass is near-mirror for vivid sky reflections. Tile has mild gloss for clean roofs.
 */
export const MATERIAL_PROPERTIES: Record<MaterialType, MaterialPhysicalProperties> = {
  concrete: { roughness: 0.80, metalness: 0.04, defaultColor: "#b0aca2" },
  stone:    { roughness: 0.74, metalness: 0.02, defaultColor: "#969088" },
  wood:     { roughness: 0.65, metalness: 0.0,  defaultColor: "#8c5a2c" },
  glass:    { roughness: 0.04, metalness: 0.20, defaultColor: "#88d4f0" },
  metal:    { roughness: 0.22, metalness: 0.94, defaultColor: "#b0b4ba" },
  stucco:   { roughness: 0.82, metalness: 0.0,  defaultColor: "#ece8e0" },
  tile:     { roughness: 0.52, metalness: 0.05, defaultColor: "#486c88" },
};

export interface ResolvedMaterial {
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
}

/** Turns a {material, color} assignment into the render-ready PBR-ish properties for a primitive. */
export function resolveMaterial(assignment: MaterialAssignment): ResolvedMaterial {
  const props = MATERIAL_PROPERTIES[assignment.material];
  const resolved: ResolvedMaterial = {
    color: assignment.color,
    roughness: props.roughness,
    metalness: props.metalness,
  };
  if (assignment.material === "glass") {
    resolved.transparent = true;
    resolved.opacity = 0.50; // vivid see-through with strong sky reflection
  }
  return resolved;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function validateAssignment(
  raw: unknown,
  fallback: MaterialAssignment,
  zoneLabel: string,
  warnings: string[]
): MaterialAssignment {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  let material = fallback.material;
  if (typeof o.material === "string") {
    if (MATERIAL_TYPES.includes(o.material as MaterialType)) {
      material = o.material as MaterialType;
    } else {
      warnings.push(`Unknown material ${JSON.stringify(o.material)} for "${zoneLabel}" — keeping "${fallback.material}".`);
    }
  }

  const materialChanged = material !== fallback.material;
  let color = materialChanged ? MATERIAL_PROPERTIES[material].defaultColor : fallback.color;
  if (typeof o.color === "string") {
    if (HEX_COLOR_RE.test(o.color)) {
      color = o.color;
    } else {
      warnings.push(`Invalid color ${JSON.stringify(o.color)} for "${zoneLabel}" — using a default.`);
    }
  }

  return { material, color };
}

/** Always succeeds — a missing or malformed "materials" block just falls back to sensible defaults. */
export function validateMaterials(raw: unknown, warnings: string[]): MaterialsConfig {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    exterior: validateAssignment(o.exterior, DEFAULT_MATERIALS_CONFIG.exterior, "exterior", warnings),
    roof: validateAssignment(o.roof, DEFAULT_MATERIALS_CONFIG.roof, "roof", warnings),
    trim: validateAssignment(o.trim, DEFAULT_MATERIALS_CONFIG.trim, "trim", warnings),
    decking: validateAssignment(o.decking, DEFAULT_MATERIALS_CONFIG.decking, "decking", warnings),
  };
}
