import type { DetailLevel } from "./styleProfile";

/** Families the native generator can build. Anything else should go to an external 3D provider. */
export const NATIVE_FAMILIES = [
  "deck-chair", "dining-chair", "armchair", "bar-stool", "stool", "bench", "lounger",
  "dining-table", "side-table", "counter-module", "cabinet", "shelf",
  "planter", "pot", "lamp", "pendant-light", "umbrella", "pergola", "appliance",
] as const;
export type NativeFamily = (typeof NATIVE_FAMILIES)[number];

/** Realistic overall size range per family, metres: the declared dimensions must sit inside it. */
export const FAMILY_LIMITS: Record<NativeFamily, { width: [number, number]; depth: [number, number]; height: [number, number] }> = {
  "deck-chair": { width: [0.5, 1.0], depth: [0.6, 1.9], height: [0.6, 1.3] },
  "dining-chair": { width: [0.4, 0.75], depth: [0.4, 0.8], height: [0.75, 1.2] },
  armchair: { width: [0.6, 1.2], depth: [0.6, 1.1], height: [0.6, 1.1] },
  "bar-stool": { width: [0.3, 0.6], depth: [0.3, 0.6], height: [0.6, 1.1] },
  stool: { width: [0.25, 0.6], depth: [0.25, 0.6], height: [0.3, 0.6] },
  bench: { width: [0.8, 2.6], depth: [0.3, 0.8], height: [0.35, 1.1] },
  lounger: { width: [0.55, 1.1], depth: [1.4, 2.3], height: [0.25, 1.1] },
  "dining-table": { width: [0.6, 3.2], depth: [0.6, 1.4], height: [0.68, 0.82] },
  "side-table": { width: [0.3, 0.9], depth: [0.3, 0.9], height: [0.3, 0.75] },
  "counter-module": { width: [0.4, 3.0], depth: [0.4, 1.0], height: [0.75, 1.3] },
  cabinet: { width: [0.4, 2.4], depth: [0.3, 0.9], height: [0.4, 2.2] },
  shelf: { width: [0.4, 2.4], depth: [0.2, 0.6], height: [0.5, 2.4] },
  planter: { width: [0.2, 2.5], depth: [0.2, 1.2], height: [0.15, 1.4] },
  pot: { width: [0.15, 1.0], depth: [0.15, 1.0], height: [0.15, 1.2] },
  lamp: { width: [0.1, 0.8], depth: [0.1, 0.8], height: [0.2, 2.0] },
  "pendant-light": { width: [0.15, 0.9], depth: [0.15, 0.9], height: [0.2, 1.5] },
  umbrella: { width: [1.2, 4.5], depth: [1.2, 4.5], height: [1.8, 3.2] },
  pergola: { width: [1.5, 6.0], depth: [1.5, 6.0], height: [2.0, 3.4] },
  appliance: { width: [0.3, 1.3], depth: [0.3, 0.9], height: [0.3, 1.3] },
};

/** Families a model plausibly confuses with one another: when the declared size fits a sibling but not the stated family, the sibling is used. */
export const FAMILY_SIBLINGS: Partial<Record<NativeFamily, readonly NativeFamily[]>> = {
  "deck-chair": ["lounger"],
  lounger: ["deck-chair"],
  lamp: ["pendant-light"],
  "pendant-light": ["lamp"],
  stool: ["bar-stool"],
  "bar-stool": ["stool"],
  planter: ["pot"],
  pot: ["planter"],
  armchair: ["dining-chair"],
  "dining-chair": ["armchair"],
};

/**
 * Per-family build defaults. Slat-heavy furniture and lights read perfectly well at medium detail with a modest slat count, and
 * dozens of them share a site, so they are capped there: silhouette and proportions stay, slat density and bevel polish do not multiply
 * the triangle count. `maxSlats` thins any slat array or fine repeated part above it (the span is preserved).
 */
export const FAMILY_DEFAULTS: Partial<Record<NativeFamily, { maxDetail: DetailLevel; maxSlats?: number }>> = {
  "deck-chair": { maxDetail: "medium", maxSlats: 8 },
  lounger: { maxDetail: "medium", maxSlats: 10 },
  bench: { maxDetail: "medium", maxSlats: 9 },
  "dining-chair": { maxDetail: "medium", maxSlats: 8 },
  armchair: { maxDetail: "medium", maxSlats: 8 },
  // Lights are placed in dozens; a woven shade or lantern reads perfectly at medium.
  lamp: { maxDetail: "medium" },
  "pendant-light": { maxDetail: "medium" },
};
