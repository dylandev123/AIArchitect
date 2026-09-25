import type { ColumnStyleKey } from "@/types/house";
import type { ColumnStyleEntry } from "./types";

export const COLUMN_STYLES: Record<ColumnStyleKey, ColumnStyleEntry> = {
  "none": {
    key: "none", label: "None", description: "No corner detail — bare wall edge.",
    compatibleStyles: ["modern-minimalist", "industrial", "modern-luxury"],
    size: 0, projection: 0, capital: false,
  },
  "square-pilaster": {
    key: "square-pilaster", label: "Square Pilaster", description: "Shallow flat-faced pilaster at each corner.",
    compatibleStyles: ["colonial", "mediterranean", "modern-minimalist", "craftsman", "tropical", "modern-luxury", "caribbean-villa"],
    size: 0.34, projection: 0.07, capital: false,
  },
  "craftsman-post": {
    key: "craftsman-post", label: "Craftsman Post", description: "Wide square column with capital and stepped base — Arts & Crafts.",
    compatibleStyles: ["craftsman", "cabin"],
    size: 0.42, projection: 0.10, capital: true,
  },
  "steel-section": {
    key: "steel-section", label: "Steel Column", description: "Slim I-section column in dark painted steel.",
    compatibleStyles: ["industrial", "mid-century", "modern-luxury"],
    size: 0.18, projection: 0.04, capital: false, color: "#1a1e26", roughness: 0.30, metalness: 0.85,
  },
  "board-strip": {
    key: "board-strip", label: "Board Strip", description: "Wide shallow wood board framing the corner.",
    compatibleStyles: ["nordic", "craftsman", "mid-century", "cabin"],
    size: 0.38, projection: 0.03, capital: false,
  },
};
