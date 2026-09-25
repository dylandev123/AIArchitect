import type { RailingStyleKey } from "@/types/house";
import type { RailingStyleEntry } from "./types";

export const RAILING_STYLES: Record<RailingStyleKey, RailingStyleEntry> = {
  "iron": {
    key: "iron", label: "Wrought Iron", description: "Dark painted steel balusters — classic and decorative.",
    compatibleStyles: ["mediterranean", "colonial", "mid-century", "caribbean-villa"],
    kind: "posts", density: 5, elementSize: 0.04, horizontal: false,
    transparent: false, opacity: 1, color: "#1e2830", roughness: 0.55, metalness: 0.70,
  },
  "cable": {
    key: "cable", label: "Stainless Cable", description: "Horizontal tensioned cables between slim steel posts — contemporary.",
    compatibleStyles: ["modern-minimalist", "mid-century", "industrial", "nordic", "tropical", "modern-luxury", "caribbean-villa"],
    kind: "cables", density: 3, elementSize: 0.012, horizontal: true,
    transparent: false, opacity: 1, color: "#b8bcc2", roughness: 0.25, metalness: 0.90,
  },
  "glass-panel": {
    key: "glass-panel", label: "Glass Panel", description: "Frameless or thin-framed clear glass — unobstructed views.",
    compatibleStyles: ["modern-minimalist", "tropical", "nordic", "mid-century", "modern-luxury"],
    kind: "glass", density: 0, elementSize: 0.015, horizontal: false,
    transparent: true, opacity: 0.35, color: "#c0dce8", roughness: 0.06, metalness: 0,
  },
  "timber": {
    key: "timber", label: "Timber Frame", description: "Chunky posts with horizontal top and bottom rails only.",
    compatibleStyles: ["craftsman", "nordic", "tropical", "cabin", "caribbean-villa"],
    kind: "posts", density: 1.5, elementSize: 0.10, horizontal: false,
    transparent: false, opacity: 1, color: "#6a4820", roughness: 0.78, metalness: 0,
  },
  "concrete-wall": {
    key: "concrete-wall", label: "Concrete Wall", description: "Solid rendered parapet — bold and minimal.",
    compatibleStyles: ["modern-minimalist", "industrial"],
    kind: "solid", density: 0, elementSize: 0, horizontal: false,
    transparent: false, opacity: 1, color: "#c4c0b8", roughness: 0.82, metalness: 0,
  },
  "picket": {
    key: "picket", label: "Picket", description: "Closely spaced vertical square balusters — cottage charm.",
    compatibleStyles: ["colonial", "craftsman", "caribbean-villa"],
    kind: "posts", density: 8, elementSize: 0.04, horizontal: false,
    transparent: false, opacity: 1, color: "#f0ece4", roughness: 0.80, metalness: 0,
  },
};
