import type { DesignTier, MaterialAssignment, MaterialType, MaterialZone } from "@/types/house";

/**
 * Design tiers: a single dial for how elaborate a project is — architectural complexity, materials, landscaping and
 * outdoor features. It is deliberately *not* a cost estimate; it only steers how much the design and the renderer
 * invest in massing, detail and setting.
 *
 * "comfort" is the baseline and what an absent tier means, so projects that predate tiers look and behave as before.
 */

export const DESIGN_TIERS: [DesignTier, ...DesignTier[]] = ["starter", "comfort", "luxury", "estate"];
export const DEFAULT_DESIGN_TIER: DesignTier = "comfort";

export const isDesignTier = (v: unknown): v is DesignTier => typeof v === "string" && (DESIGN_TIERS as readonly string[]).includes(v);

/** The tier a project is in; anything missing or unknown is the baseline. */
export function resolveTier(tier: unknown): DesignTier {
  return isDesignTier(tier) ? tier : DEFAULT_DESIGN_TIER;
}

/** 0 (starter) … 3 (estate). */
export const tierRank = (tier: DesignTier): number => DESIGN_TIERS.indexOf(tier);

/** How much fine detail the renderer's builders invest in at a tier. */
export interface TierDetail {
  /** Radius (m) of the rounded edge on trim and structural edges; 0 = crisp boxes. */
  bevel: number;
  /** How far window and door surrounds project past the glass, so the opening reads as recessed (m). */
  recess: number;
  /** Roof-edge layering: 0 = single fascia, 1 = + drip board and soffit, 2 = + crown moulding and ridge cap. */
  roofLayers: 0 | 1 | 2;
  /** Multiplier on the ambient tree count around the house. */
  planting: number;
  /** Ground relief outside the yard: rolling amplitude in metres. */
  relief: number;
}

export interface TierProfile {
  key: DesignTier;
  label: string;
  detail: TierDetail;
  /** Materials the tier reaches for, per zone, most typical first. */
  materials: Record<MaterialZone, MaterialType[]>;
  /** Used only when a generated design set no materials at all. */
  defaultMaterials: Record<MaterialZone, MaterialAssignment>;
  /** What the model is told the tier means. */
  guidance: string;
}

export const TIER_PROFILES: Record<DesignTier, TierProfile> = {
  starter: {
    key: "starter",
    label: "Starter",
    detail: { bevel: 0, recess: 0, roofLayers: 0, planting: 0.7, relief: 0.35 },
    materials: {
      exterior: ["render", "stucco", "cedar", "timber"],
      roof: ["tile", "zinc", "metal"],
      trim: ["wood", "metal"],
      decking: ["wood", "concrete"],
    },
    defaultMaterials: {
      exterior: { material: "render", color: "#e2dfd6" },
      roof: { material: "zinc", color: "#6c7378" },
      trim: { material: "wood", color: "#7a5a38" },
      decking: { material: "wood", color: "#b89468" },
    },
    guidance:
      "Simple, compact and easy to build: one clear volume under a plain gable, shed or flat roof, one or two floors, few generously spaced openings, plain honest materials and a modest lawn or garden. No turrets, arches, curved walls, cross gables or stepped foundations. Add a pool, deck or extra buildings only if the brief asks.",
  },
  comfort: {
    key: "comfort",
    label: "Comfort",
    detail: { bevel: 0.025, recess: 0.06, roofLayers: 0, planting: 1, relief: 0.6 },
    materials: {
      exterior: ["stucco", "brick", "cedar", "render", "stone"],
      roof: ["tile", "slate", "metal", "zinc"],
      trim: ["wood", "metal", "timber"],
      decking: ["wood", "concrete"],
    },
    defaultMaterials: {
      exterior: { material: "stucco", color: "#f0ece4" },
      roof: { material: "tile", color: "#5a7a9c" },
      trim: { material: "wood", color: "#6b4d2a" },
      decking: { material: "wood", color: "#c8a070" },
    },
    guidance:
      "A well-proportioned family home: a clear main volume with one or two secondary elements (porch, garage, patio or balcony), good glazing, a chimney or dormer where the style calls for it and sensible landscaping. This is the default when the brief says nothing about budget or grandeur.",
  },
  luxury: {
    key: "luxury",
    label: "Luxury",
    detail: { bevel: 0.035, recess: 0.1, roofLayers: 1, planting: 1.3, relief: 0.9 },
    materials: {
      exterior: ["stone", "brick", "render", "cedar", "marble"],
      roof: ["slate", "copper", "zinc", "tile"],
      trim: ["metal", "timber", "wood"],
      decking: ["stone", "wood", "marble"],
    },
    defaultMaterials: {
      exterior: { material: "stone", color: "#cfc8b8" },
      roof: { material: "slate", color: "#4d5258" },
      trim: { material: "metal", color: "#2f3236" },
      decking: { material: "stone", color: "#cbc3b2" },
    },
    guidance:
      "An articulated, layered silhouette: a bay window or projecting volume, dormers or a cross gable on pitched roofs, a stepped foundation, premium materials (stone, slate, copper), a curved path or driveway, a shaped pool and terrace, planted gardens and retaining walls on sloping land.",
  },
  estate: {
    key: "estate",
    label: "Estate",
    detail: { bevel: 0.045, recess: 0.13, roofLayers: 2, planting: 1.6, relief: 1.2 },
    materials: {
      exterior: ["stone", "brick", "marble"],
      roof: ["slate", "copper"],
      trim: ["copper", "metal", "timber"],
      decking: ["stone", "marble"],
    },
    defaultMaterials: {
      exterior: { material: "stone", color: "#d6cfbf" },
      roof: { material: "slate", color: "#454a50" },
      trim: { material: "copper", color: "#6f8f6b" },
      decking: { material: "marble", color: "#e0dbd0" },
    },
    guidance:
      "A grand, richly layered composition: several roof planes (cross gables, dormers), a turret or round bay, an arched arcade or entry arch, a stepped foundation and sweeping stairs, a curved driveway and paths, curved garden and retaining walls, formal gardens, a shaped pool with terraces and outbuildings (gazebo, garage, guest house). Stone, slate and copper throughout.",
  },
};

export function describeTiers(): string {
  return DESIGN_TIERS.map((t) => `- designTier "${t}": ${TIER_PROFILES[t].guidance}`).join("\n");
}
