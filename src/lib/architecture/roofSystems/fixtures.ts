import { DEFAULT_MATERIALS_CONFIG, type MaterialAssignment, type MaterialsConfig } from "@/types/house";
import type { ArchitecturalDesignDocument, MassVolume, RoofComposition } from "../document";

/**
 * Deterministic, non-AI fixtures showing each Roof System on the roof forms it covers, compiled through the
 * same `compileArchitecture` as live generation. Each pairs a document with the materials it is compiled
 * under, since the roof zone's material is what selects the system.
 */
export interface RoofSystemFixture { title: string; doc: ArchitecturalDesignDocument; materials: MaterialsConfig }

const pending = { status: "pending" as const };
const doc = (brief: string, masses: MassVolume[], roofs: RoofComposition): ArchitecturalDesignDocument => ({
  version: 1, brief, siteStrategy: { environment: "countryside", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
  massing: { composition: masses.length > 1 ? "l-shaped" : "rectangular-pavilion", masses }, roofs,
  facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
});
const house = (width = 12, depth = 7.5): MassVolume => ({ id: "house", name: "House", role: "main-living", position: { x: 0, z: 0 }, width, depth, floors: 1, elevation: 0, rotation: 0 });
const roofed = (roof: MaterialAssignment, exterior: MaterialAssignment = { material: "stucco", color: "#efeae0" }): MaterialsConfig => ({ ...DEFAULT_MATERIALS_CONFIG, exterior, roof, trim: { material: "wood", color: "#4a3a2a" } });
const one = (kind: RoofComposition["recipes"][number]["kind"], rest: Partial<RoofComposition["recipes"][number]>): RoofComposition => ({ recipes: [{ id: "house-roof", massId: "house", kind, ...rest }] });

const SEAM: MaterialAssignment = { material: "standing-seam-metal", color: "#3f474d" };
const CLAY: MaterialAssignment = { material: "terracotta", color: "#b8623e" };
const SLATE: MaterialAssignment = { material: "slate", color: "#5a5c60" };
const MEMBRANE: MaterialAssignment = { material: "concrete", color: "#b9b5aa" };

export const ROOF_SYSTEM_FIXTURES: Record<string, RoofSystemFixture> = {
  standingSeamGable: { title: "Standing seam · gable 30°, 0.5 m overhang", doc: doc("Standing seam gable", [house()], one("gable", { pitch: 30, overhang: 0.5 })), materials: roofed(SEAM, { material: "timber", color: "#6b5138" }) },
  standingSeamHip: { title: "Standing seam · hip 24°, 0.7 m overhang", doc: doc("Standing seam hip", [house(13, 8)], one("hip", { pitch: 24, overhang: 0.7 })), materials: roofed({ material: "zinc", color: "#8a9298" }) },
  standingSeamButterfly: { title: "Standing seam · butterfly 10°, 0.9 m overhang", doc: doc("Standing seam butterfly", [house(12, 8)], one("butterfly", { pitch: 10, overhang: 0.9 })), materials: roofed(SEAM) },
  standingSeamShed: { title: "Standing seam · mono-pitch 12°, 0.6 m overhang", doc: doc("Standing seam shed", [house(11, 7)], one("mono-pitch", { pitch: 12, overhang: 0.6 })), materials: roofed(SEAM) },
  tileHip: { title: "Tile · hip 27°, 0.6 m overhang", doc: doc("Clay tile hip", [house(13, 8)], one("hip", { pitch: 27, overhang: 0.6 })), materials: roofed(CLAY) },
  slateGable: { title: "Slate shingle · gable 38°, 0.45 m overhang", doc: doc("Slate gable", [house(11, 7)], one("gable", { pitch: 38, overhang: 0.45 })), materials: roofed(SLATE, { material: "stone", color: "#cfc8ba" }) },
  flatParapet: { title: "Flat membrane · parapet + coping", doc: doc("Flat parapet", [house(12, 8)], one("flat", { overhang: 0, parapet: { height: 0.5, thickness: 0.2 } })), materials: roofed(MEMBRANE) },
  flatDripEdge: { title: "Flat membrane · floating plate + drip edge", doc: doc("Floating flat", [house(12, 8)], one("floating-flat", { overhang: 0.9, expression: { verticalGap: 0.3 } })), materials: roofed(MEMBRANE) },
  /** One primary system (tile, from the roof material) with a counterpoint the form requires: the flat link can't carry tile. */
  tileWithFlatLink: {
    title: "Primary tile + flat-membrane counterpoint on the link",
    doc: doc("Tile house with a flat link", [
      { ...house(12, 7), id: "main", name: "Main House" },
      { id: "link", name: "Glazed Link", role: "connector", position: { x: 8.5, z: 0 }, width: 5, depth: 3.5, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "connected-to", target: "main", side: "east" }] },
      { id: "wing", name: "Bedroom Wing", role: "bedroom-wing", position: { x: 14.5, z: 0 }, width: 7, depth: 9, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "connected-to", target: "link", side: "east" }] },
    ], { recipes: [
      { id: "main-roof", massId: "main", kind: "gable", pitch: 30, overhang: 0.5 },
      { id: "link-roof", massId: "link", kind: "flat", overhang: 0, parapet: { height: 0.4, thickness: 0.2 } },
      { id: "wing-roof", massId: "wing", kind: "gable", pitch: 30, overhang: 0.5 },
    ] }),
    materials: roofed(CLAY),
  },
};
