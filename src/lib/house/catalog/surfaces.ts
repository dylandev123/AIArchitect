import type { SurfaceKey } from "@/types/house";
import type { SurfaceEntry } from "./types";

export const SURFACES: Record<SurfaceKey, SurfaceEntry> = {
  "concrete": {
    key: "concrete", label: "Brushed Concrete", description: "Plain smooth concrete — clean and utilitarian.",
    materialType: "concrete", defaultColor: "#b8b4ac", roughness: 0.78, metalness: 0,
    compatibleStyles: ["industrial", "modern-minimalist", "mid-century"],
  },
  "travertine": {
    key: "travertine", label: "Travertine", description: "Warm cream limestone with subtle veining.",
    materialType: "stone", defaultColor: "#e0d8c8", roughness: 0.60, metalness: 0,
    compatibleStyles: ["mediterranean", "colonial"],
  },
  "slate-tile": {
    key: "slate-tile", label: "Slate Tile", description: "Dark grey natural slate in large format.",
    materialType: "slate", defaultColor: "#606468", roughness: 0.84, metalness: 0,
    compatibleStyles: ["industrial", "nordic", "modern-minimalist"],
  },
  "terracotta": {
    key: "terracotta", label: "Terracotta", description: "Warm clay tiles in traditional terracotta red.",
    materialType: "terracotta", defaultColor: "#c07050", roughness: 0.85, metalness: 0,
    compatibleStyles: ["mediterranean", "tropical", "colonial"],
  },
  "pebble": {
    key: "pebble", label: "Pebble Wash", description: "River pebbles set in mortar — tactile and natural.",
    materialType: "stone", defaultColor: "#989080", roughness: 0.94, metalness: 0,
    compatibleStyles: ["tropical", "mediterranean", "craftsman"],
  },
  "brick-paver": {
    key: "brick-paver", label: "Brick Paver", description: "Reclaimed brick pavers in herringbone pattern.",
    materialType: "brick", defaultColor: "#a86040", roughness: 0.88, metalness: 0,
    compatibleStyles: ["colonial", "craftsman", "mid-century"],
  },
  "teak-deck": {
    key: "teak-deck", label: "Teak Decking", description: "Oiled teak boards in yacht-deck style.",
    materialType: "timber", defaultColor: "#b88850", roughness: 0.60, metalness: 0,
    compatibleStyles: ["tropical", "mid-century", "nordic"],
  },
  "mosaic-tile": {
    key: "mosaic-tile", label: "Mosaic Tile", description: "Small glazed tiles — vivid pool surrounds.",
    materialType: "tile", defaultColor: "#5898c4", roughness: 0.30, metalness: 0.05,
    compatibleStyles: ["mediterranean", "tropical", "colonial"],
  },
};
