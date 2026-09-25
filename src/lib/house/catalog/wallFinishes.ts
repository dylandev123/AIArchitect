import type { WallFinishKey } from "@/types/house";
import type { WallFinishEntry } from "./types";

export const WALL_FINISHES: Record<WallFinishKey, WallFinishEntry> = {
  "smooth-stucco": {
    key: "smooth-stucco", label: "Smooth Stucco", description: "Fine-ground plaster, flat surface.",
    materialType: "stucco", defaultColor: "#f0ece4", roughness: 0.72, metalness: 0,
    compatibleStyles: ["mediterranean", "modern-minimalist", "colonial", "tropical", "modern-luxury", "caribbean-villa"],
  },
  "rough-stucco": {
    key: "rough-stucco", label: "Rough Stucco", description: "Textured lime render, handmade look.",
    materialType: "stucco", defaultColor: "#e0d8cc", roughness: 0.90, metalness: 0,
    compatibleStyles: ["mediterranean", "craftsman", "colonial"],
    cladding: { kind: "horizontal-bands", spacing: 0.55, projection: 0.014, elementSize: 0.03 },
  },
  "board-batten": {
    key: "board-batten", label: "Board & Batten", description: "Vertical wood boards with narrow cover strips.",
    materialType: "timber", defaultColor: "#7a5032", roughness: 0.82, metalness: 0,
    compatibleStyles: ["craftsman", "nordic", "mid-century", "cabin"],
    cladding: { kind: "vertical-strips", spacing: 0.52, projection: 0.022, elementSize: 0.06 },
  },
  "horizontal-lap": {
    key: "horizontal-lap", label: "Horizontal Lap", description: "Overlapping horizontal planks, classic clapboard.",
    materialType: "cedar", defaultColor: "#8a6040", roughness: 0.80, metalness: 0,
    compatibleStyles: ["craftsman", "colonial", "mid-century", "cabin"],
    cladding: { kind: "horizontal-bands", spacing: 0.22, projection: 0.018, elementSize: 0.05 },
  },
  "brick": {
    key: "brick", label: "Brick", description: "Fired clay masonry in running bond.",
    materialType: "brick", defaultColor: "#b05838", roughness: 0.90, metalness: 0,
    compatibleStyles: ["colonial", "industrial", "craftsman"],
  },
  "stone-veneer": {
    key: "stone-veneer", label: "Stone Veneer", description: "Cut-stone cladding panels, natural texture.",
    materialType: "stone", defaultColor: "#8c8478", roughness: 0.86, metalness: 0,
    compatibleStyles: ["mediterranean", "colonial", "craftsman", "cabin", "modern-luxury"],
  },
  "cedar-shingle": {
    key: "cedar-shingle", label: "Cedar Shingle", description: "Staggered wood shingles, coastal cottage look.",
    materialType: "cedar", defaultColor: "#9a6848", roughness: 0.84, metalness: 0,
    compatibleStyles: ["craftsman", "nordic", "tropical", "cabin"],
    cladding: { kind: "horizontal-bands", spacing: 0.18, projection: 0.016, elementSize: 0.04 },
  },
  "corrugated-metal": {
    key: "corrugated-metal", label: "Corrugated Metal", description: "Industrial steel sheeting with ribbed profile.",
    materialType: "zinc", defaultColor: "#7a8490", roughness: 0.55, metalness: 0.70,
    compatibleStyles: ["industrial", "mid-century", "nordic"],
    cladding: { kind: "vertical-strips", spacing: 0.18, projection: 0.012, elementSize: 0.10 },
  },
  "venetian-plaster": {
    key: "venetian-plaster", label: "Venetian Plaster", description: "Polished marble-dust plaster with subtle sheen.",
    materialType: "render", defaultColor: "#e4ddd0", roughness: 0.38, metalness: 0,
    compatibleStyles: ["mediterranean", "colonial", "mid-century"],
  },
  "split-face-block": {
    key: "split-face-block", label: "Split-Face Block", description: "Exposed concrete masonry with fractured face.",
    materialType: "concrete", defaultColor: "#9c9890", roughness: 0.88, metalness: 0,
    compatibleStyles: ["industrial", "modern-minimalist"],
  },
};
