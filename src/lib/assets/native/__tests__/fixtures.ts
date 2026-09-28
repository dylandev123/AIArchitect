import type { AssetSpec } from "../spec";

/** Hand-written specs shaped like model output, for the five validation assets. They double as few-shot documentation of the vocabulary. */

const teak = { key: "teak", material: "wood", color: "#8a5a2b" } as const;
const steel = { key: "steel", material: "metal", color: "#3b3f44", roughness: 0.4 } as const;

export const deckChair: AssetSpec = {
  family: "deck-chair", name: "Tropical Teak Deck Chair", style: "tropical-modern", bevel: 1, detailLevel: "medium",
  dimensions: { width: 0.62, depth: 1.0, height: 0.95 },
  materials: [teak, { key: "canvas", material: "stucco", color: "#f1ead8" }],
  parts: [
    { primitive: "box", role: "front-leg", material: "teak", size: [0.05, 0.4, 0.05], position: [0.27, 0.2, 0.34], mirror: "x" },
    { primitive: "box", role: "rear-leg", material: "teak", size: [0.05, 0.42, 0.05], position: [0.27, 0.21, -0.3], mirror: "x" },
    { primitive: "box", role: "seat-rail", material: "teak", size: [0.045, 0.06, 0.86], position: [0.27, 0.4, 0.02], mirror: "x" },
    { primitive: "slatArray", role: "seat-slat", material: "teak", count: 7, slatSize: [0.5, 0.02, 0.06], gap: 0.02, axis: "z", position: [0, 0.395, 0.04] },
    { primitive: "box", role: "back-rail", material: "teak", size: [0.045, 0.7, 0.045], position: [0.27, 0.72, -0.42], rotation: [-20, 0, 0], mirror: "x" },
    { primitive: "slatArray", role: "back-slat", material: "teak", count: 8, slatSize: [0.5, 0.06, 0.02], gap: 0.02, axis: "y", position: [0, 0.72, -0.42], rotation: [-20, 0, 0] },
    { primitive: "cushion", role: "seat-cushion", material: "canvas", size: [0.5, 0.07, 0.56], position: [0, 0.465, 0.04], puff: 0.6 },
    { primitive: "cushion", role: "headrest", material: "canvas", size: [0.42, 0.09, 0.16], position: [0, 0.98, -0.5], rotation: [-20, 0, 0], puff: 0.8 },
  ],
};

export const diningTable: AssetSpec = {
  family: "dining-table", name: "Teak Outdoor Dining Table", style: "tropical-modern", bevel: 1, detailLevel: "medium",
  dimensions: { width: 1.8, depth: 0.9, height: 0.75 },
  materials: [teak, steel],
  parts: [
    { primitive: "roundedRect", role: "tabletop", material: "teak", width: 1.8, depth: 0.9, height: 0.05, cornerRadius: 0.08, position: [0, 0.725, 0] },
    { primitive: "box", role: "leg", material: "teak", size: [0.07, 0.68, 0.07], position: [0.78, 0.34, 0.35], mirror: "xz" },
    { primitive: "box", role: "long-apron", material: "teak", size: [1.5, 0.08, 0.04], position: [0, 0.64, 0.35], mirror: "z" },
    { primitive: "box", role: "end-apron", material: "teak", size: [0.04, 0.08, 0.63], position: [0.78, 0.64, 0], mirror: "x" },
    { primitive: "cylinder", role: "foot-cap", material: "steel", radius: 0.045, height: 0.02, position: [0.78, 0.01, 0.35], mirror: "xz" },
  ],
};

export const modernPlanter: AssetSpec = {
  family: "planter", name: "Modern Concrete Planter", style: "modern", bevel: 1, detailLevel: "medium",
  dimensions: { width: 0.8, depth: 0.4, height: 0.54 },
  materials: [{ key: "concrete", material: "concrete", color: "#a8a49a" }, { key: "soil", material: "timber", color: "#3d2b1a", roughness: 0.92 }, steel],
  parts: [
    { primitive: "box", role: "front-wall", material: "concrete", size: [0.8, 0.5, 0.05], position: [0, 0.29, 0.175], mirror: "z" },
    { primitive: "box", role: "end-wall", material: "concrete", size: [0.05, 0.5, 0.3], position: [0.375, 0.29, 0], mirror: "x" },
    { primitive: "box", role: "floor", material: "concrete", size: [0.7, 0.04, 0.3], position: [0, 0.06, 0] },
    { primitive: "box", role: "soil", material: "soil", size: [0.7, 0.02, 0.3], position: [0, 0.47, 0] },
    { primitive: "cylinder", role: "foot", material: "steel", radius: 0.03, height: 0.04, position: [0.32, 0.02, 0.12], mirror: "xz" },
  ],
};

export const barStool: AssetSpec = {
  family: "bar-stool", name: "Splayed Leg Bar Stool", style: "modern", bevel: 1, detailLevel: "medium",
  dimensions: { width: 0.44, depth: 0.44, height: 0.76 },
  materials: [{ key: "leather", material: "stucco", color: "#6b4a34", roughness: 0.7 }, steel],
  parts: [
    { primitive: "cushion", role: "seat", material: "leather", size: [0.38, 0.07, 0.38], position: [0, 0.725, 0], puff: 0.7 },
    { primitive: "cylinder", role: "seat-plate", material: "steel", radius: 0.16, height: 0.025, position: [0, 0.675, 0] },
    { primitive: "tube", role: "leg", material: "steel", radius: 0.016, position: [0, 0, 0], path: [[0.13, 0.67, 0.13], [0.17, 0.35, 0.17], [0.2, 0.01, 0.2]], mirror: "xz" },
    { primitive: "tube", role: "foot-ring", material: "steel", radius: 0.012, position: [0, 0, 0], path: [[0.18, 0.3, 0.18], [-0.18, 0.3, 0.18], [-0.18, 0.3, -0.18], [0.18, 0.3, -0.18], [0.18, 0.3, 0.18]] },
  ],
};

export const counterModule: AssetSpec = {
  family: "counter-module", name: "Outdoor Kitchen Counter Module", style: "modern", bevel: 1, detailLevel: "medium",
  dimensions: { width: 1.2, depth: 0.65, height: 0.94 },
  materials: [{ key: "body", material: "render", color: "#8b8f8c" }, { key: "stone", material: "slate", color: "#33363a" }, teak, steel],
  parts: [
    { primitive: "box", role: "carcass", material: "body", size: [1.2, 0.78, 0.6], position: [0, 0.45, 0] },
    { primitive: "box", role: "toe-kick", material: "steel", size: [1.12, 0.06, 0.5], position: [0, 0.03, 0] },
    { primitive: "roundedRect", role: "countertop", material: "stone", width: 1.24, depth: 0.65, height: 0.04, cornerRadius: 0.02, position: [0, 0.92, 0] },
    { primitive: "panel", role: "door", material: "teak", size: [0.57, 0.64, 0.025], position: [0.295, 0.5, 0.31], mirror: "x" },
    { primitive: "tube", role: "handle", material: "steel", radius: 0.009, position: [0.05, 0.62, 0.34], path: [[0, -0.1, 0], [0, 0.1, 0]], mirror: "x" },
    { primitive: "panel", role: "backsplash", material: "stone", size: [1.2, 0.12, 0.03], position: [0, 1.0, -0.3] },
  ],
};

export const SAMPLES = { deckChair, diningTable, modernPlanter, barStool, counterModule } as const;
