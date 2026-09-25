import type { BuildingKind, CompassSide, HouseConfig, MaterialType, RoofType, SiteEnvironment, StyleKey } from "@/types/house";
import { LEVEL_HEIGHT } from "../constants";

/**
 * Architectural profiles: the parts of a style that change the *structure* rather than just the materials.
 *
 * A profile is data, not a hardcoded house. The shell generator, porch / chimney / outbuilding builders and the
 * AI generation rules all read the same profile, so "cabin" means the same thing everywhere: notched log walls, a
 * steep deep-eaved gable, a fieldstone base and a stone chimney — at whatever footprint the brief asks for.
 *
 * Styles without a profile (mediterranean, colonial, …) keep the original generic shell untouched.
 */

/** How the exterior walls are physically constructed. */
export type WallConstruction = "log" | "rendered-slab" | "raised-stucco";
export type FoundationKind = "fieldstone" | "podium" | "raised-plinth";
export type WindowDecor = "timber-surround" | "none" | "shutters";
export type PorchPosts = "log" | "square" | "steel" | "turned";
export type RoofCharacter = "cabin-gable" | "floating-plate" | "veranda-hip";

/** Roof proportions passed to the pitched-roof builders. `pitch` is rise ÷ full span. */
export interface RoofShape {
  pitch: number;
  /** Eave overhang beyond the wall (m). */
  overhang: number;
  /** Overhang at gable ends (m). */
  rakeOverhang: number;
}

export interface ArchitectureProfile {
  key: StyleKey;
  construction: WallConstruction;
  roof: RoofShape & { form: RoofType; allowed: RoofType[]; character: RoofCharacter };
  foundation: FoundationKind;
  windows: { decor: WindowDecor };
  porch: { posts: PorchPosts; depth: number; fullWidth: boolean };
  /** Present when the style expects a chimney; the material is fixed by the style. */
  chimney?: { material: MaterialType; color: string };
  /** Detached structure this style normally sits beside the house. */
  outbuilding?: BuildingKind;
  /** Settings the style belongs in; the first is the default when a design picked one that doesn't fit. */
  environments?: SiteEnvironment[];
  /** One-paragraph brief for the model: what the massing should look like. */
  guidance: string;
}

export const ARCHITECTURE_PROFILES: Partial<Record<StyleKey, ArchitectureProfile>> = {
  cabin: {
    key: "cabin",
    construction: "log",
    roof: { form: "gable", allowed: ["gable"], character: "cabin-gable", pitch: 0.62, overhang: 1.1, rakeOverhang: 0.9 },
    foundation: "fieldstone",
    windows: { decor: "timber-surround" },
    porch: { posts: "log", depth: 2.6, fullWidth: false },
    chimney: { material: "stone", color: "#8a8478" },
    outbuilding: "shed",
    environments: ["forest", "hillside", "countryside"],
    guidance:
      "Compact, tall-roofed and rustic: a footprint around 8–12 m × 6–9 m, one floor (two at most), roof \"gable\" only. Small square-ish windows in timber surrounds, a covered front porch, a stone chimney on a gable end, a detached shed set back among the trees. Site environment \"forest\".",
  },
  "modern-luxury": {
    key: "modern-luxury",
    construction: "rendered-slab",
    roof: { form: "flat", allowed: ["flat", "butterfly", "shed"], character: "floating-plate", pitch: 0.08, overhang: 1.5, rakeOverhang: 1.5 },
    foundation: "podium",
    windows: { decor: "none" },
    porch: { posts: "steel", depth: 2.4, fullWidth: false },
    outbuilding: "detached_garage",
    guidance:
      "Long, low and horizontal: a wide footprint around 16–26 m × 9–14 m, one or two floors, flat roof. Stacked cantilevered slabs, a floating roof plate on slim steel columns, a stone blade wall, a rooftop pavilion, a floating entry canopy and a detached garage. Large floor-to-ceiling glazing (wide, tall windows) facing the view; almost no wall openings on the entrance side beyond the door.",
  },
  "caribbean-villa": {
    key: "caribbean-villa",
    construction: "raised-stucco",
    roof: { form: "hip", allowed: ["hip"], character: "veranda-hip", pitch: 0.48, overhang: 1.5, rakeOverhang: 1.5 },
    foundation: "raised-plinth",
    windows: { decor: "shutters" },
    porch: { posts: "turned", depth: 2.6, fullWidth: true },
    outbuilding: "gazebo",
    environments: ["beach", "cliff", "hillside", "countryside"],
    guidance:
      "Airy and shaded: a footprint around 12–18 m × 9–12 m, one floor (two at most), roof \"hip\" only with very deep eaves. Wraparound columned verandas front and back, a raised stucco plinth, tall louvered windows with shutters, a cupola on the ridge and a gazebo in the garden. Bright stucco walls, a pool and lush landscaping on the view side.",
  },
};

export function getArchitectureProfile(style: StyleKey | undefined): ArchitectureProfile | undefined {
  return style ? ARCHITECTURE_PROFILES[style] : undefined;
}

export const ARCHITECTURE_STYLE_KEYS = Object.keys(ARCHITECTURE_PROFILES) as StyleKey[];

/** Height of the roof's highest point above ground for the given house — what a chimney must clear. */
export function estimateRoofTop(house: HouseConfig, profile: ArchitectureProfile | undefined): number {
  const base = house.floors * LEVEL_HEIGHT;
  const span = Math.min(house.width, house.depth);
  if (profile) {
    if (profile.roof.character === "floating-plate") return base + 0.3;
    return base + Math.max(0.6, span * profile.roof.pitch);
  }
  return base + (house.roof === "flat" ? 0.6 : Math.max(0.6, span * 0.35));
}

// ── Brief inference ─────────────────────────────────────────────────────────────────────────────

const STYLE_HINTS: readonly [StyleKey, RegExp][] = [
  ["caribbean-villa", /\b(caribbean|west\s+indian|west\s+indies|bajan|jamaican|island\s+villa)\b/i],
  ["modern-luxury", /\b(modern\s+luxury|luxury\s+modern|ultra[-\s]?modern|contemporary\s+(luxury|mansion)|modern\s+(mansion|estate)|luxury\s+contemporary)\b/i],
  ["cabin", /\b(cabins?|log\s+(home|house|cabin)|woodland|chalet|(in|among|beside)\s+the\s+(woods|forest)|forest\s+(retreat|lodge|hideaway))\b/i],
];

/** A style the brief names outright ("cabin in the woods"); undefined when it doesn't say. */
export function inferStyleFromBrief(brief: string): StyleKey | undefined {
  return STYLE_HINTS.find(([, pattern]) => pattern.test(brief))?.[0];
}

/** Compass side → unit vector on the ground plane (x east, z south). */
export const SIDE_VECTORS: Record<CompassSide, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

export function describeArchitectureStyles(): string {
  return ARCHITECTURE_STYLE_KEYS.map((key) => `- style "${key}": ${ARCHITECTURE_PROFILES[key]!.guidance}`).join("\n");
}
