/**
 * Quick action definitions for the floating selection panel.
 * Each action is either a direct JSON mutation or an AI-powered prompt.
 * NO changes to generation logic — this is presentation only.
 */
import type { ComponentType } from "react";
import type { FeatureType } from "./house/features/featureTypes";
import type { MaterialsConfig } from "@/types/house";
import { setFeatureAt } from "./house/jsonEdit";
import {
  ArrowUp, Armchair, Crown, Droplets, Expand, Flame,
  FlipHorizontal2, Layers, Lightbulb, Maximize2, Move,
  Music, Palette, Settings2, Star, Sun, TreePine, Waves,
  Wine, ZoomIn,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export type ActionKind =
  | { type: "direct"; fn: (json: string, index: number, rawFeature: Record<string, unknown>) => string }
  | { type: "ai"; prompt: (index: number, rawFeature: Record<string, unknown>) => string }
  | { type: "material"; preset: Partial<MaterialsConfig> };

export interface QuickAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  action: ActionKind;
}

export interface QuickActionGroup {
  /** Label and emoji shown in the panel header */
  label: string;
  emoji: string;
  /** Tailwind accent colour class used for the button ring and text */
  accent: string;
  actions: QuickAction[];
}

// ── Material presets ─────────────────────────────────────────────────────────

const MODERN: Partial<MaterialsConfig> = {
  exterior: { material: "concrete", color: "#d4d0c8" },
  roof: { material: "metal", color: "#2a2f38" },
  trim: { material: "metal", color: "#3a4047" },
  decking: { material: "concrete", color: "#b8b4a8" },
};

const MEDITERRANEAN: Partial<MaterialsConfig> = {
  exterior: { material: "stucco", color: "#f0e8d4" },
  roof: { material: "tile", color: "#c06c34" },
  trim: { material: "wood", color: "#7a4c2a" },
  decking: { material: "tile", color: "#d4c4a8" },
};

const CARIBBEAN: Partial<MaterialsConfig> = {
  exterior: { material: "stucco", color: "#f5f0e0" },
  roof: { material: "metal", color: "#3a8a7a" },
  trim: { material: "wood", color: "#5a3a2a" },
  decking: { material: "wood", color: "#9a7a5a" },
};

const LUXURY: Partial<MaterialsConfig> = {
  exterior: { material: "stone", color: "#c8c4bc" },
  roof: { material: "metal", color: "#454b54" },
  trim: { material: "metal", color: "#3a3f47" },
  decking: { material: "stone", color: "#d8d4cc" },
};

// ── Direct mutation helpers ──────────────────────────────────────────────────

function growBy(
  json: string,
  index: number,
  raw: Record<string, unknown>,
  featureType: FeatureType,
  dw = 2,
  dd = 2
): string {
  return setFeatureAt(json, featureType, index, {
    ...raw,
    width: Math.min(40, ((raw.width as number) || 8) + dw),
    depth: Math.min(40, ((raw.depth as number) || 6) + dd),
  });
}

function setField(
  json: string,
  index: number,
  raw: Record<string, unknown>,
  featureType: FeatureType,
  patch: Record<string, unknown>
): string {
  return setFeatureAt(json, featureType, index, { ...raw, ...patch });
}

// ── Action groups per feature type ───────────────────────────────────────────

/** House exterior / roof / floor quick actions (shown for core part selections). */
export const HOUSE_ACTIONS: QuickActionGroup = {
  label: "House",
  emoji: "🏠",
  accent: "amber",
  actions: [
    {
      id: "modern",
      label: "Modern",
      icon: Settings2,
      action: { type: "material", preset: MODERN },
    },
    {
      id: "mediterranean",
      label: "Mediterranean",
      icon: Sun,
      action: { type: "material", preset: MEDITERRANEAN },
    },
    {
      id: "caribbean",
      label: "Caribbean",
      icon: Waves,
      action: { type: "material", preset: CARIBBEAN },
    },
    {
      id: "luxury",
      label: "Luxury",
      icon: Crown,
      action: { type: "material", preset: LUXURY },
    },
    {
      id: "add-floor",
      label: "Add Floor",
      icon: ArrowUp,
      action: {
        type: "ai",
        prompt: () => "Add one more floor to the main house, keeping the same footprint",
      },
    },
  ],
};

/** Pool quick actions */
export const POOL_ACTIONS: QuickActionGroup = {
  label: "Pool",
  emoji: "🏊",
  accent: "sky",
  actions: [
    {
      id: "bigger",
      label: "Make Bigger",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) => growBy(json, idx, raw, "pool", 2, 1.5),
      },
    },
    {
      id: "infinity",
      label: "Infinity Edge",
      icon: Waves,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Make pool ${idx + 1} an infinity edge pool — increase its size (width to at least 8, depth to at least 5) and increase waterDepth to 2`,
      },
    },
    {
      id: "pool-bar",
      label: "Pool Bar",
      icon: Wine,
      action: {
        type: "ai",
        prompt: (idx, _raw) =>
          `Add a small bar pavilion building (kind: "restaurant", width: 6, depth: 5, floors: 1, roof: "flat") near pool ${idx + 1} and a wooden deck between them`,
      },
    },
    {
      id: "lighting",
      label: "Add Lighting",
      icon: Lightbulb,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add landscape garden zones around pool ${idx + 1} to suggest ambient poolside lighting and lush landscaping`,
      },
    },
    {
      id: "deck",
      label: "Add Deck",
      icon: Layers,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a wooden-decking patio adjacent to pool ${idx + 1} — use decking material with color #8a6a3c`,
      },
    },
  ],
};

/** Villa / generic building quick actions */
export const VILLA_ACTIONS: QuickActionGroup = {
  label: "Villa",
  emoji: "🏡",
  accent: "amber",
  actions: [
    {
      id: "modern",
      label: "Modern",
      icon: Settings2,
      action: { type: "material", preset: MODERN },
    },
    {
      id: "mediterranean",
      label: "Mediterranean",
      icon: Sun,
      action: { type: "material", preset: MEDITERRANEAN },
    },
    {
      id: "caribbean",
      label: "Caribbean",
      icon: Waves,
      action: { type: "material", preset: CARIBBEAN },
    },
    {
      id: "luxury",
      label: "Luxury",
      icon: Crown,
      action: { type: "material", preset: LUXURY },
    },
    {
      id: "add-floor",
      label: "Add Floor",
      icon: ArrowUp,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "building", {
            floors: Math.min(6, ((raw.floors as number) || 1) + 1),
          }),
      },
    },
  ],
};

/** Restaurant building quick actions */
export const RESTAURANT_ACTIONS: QuickActionGroup = {
  label: "Restaurant",
  emoji: "🍽",
  accent: "red",
  actions: [
    {
      id: "outdoor-seating",
      label: "Outdoor Seating",
      icon: Armchair,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a large wooden-deck patio with outdoor dining furniture near the restaurant building ${idx + 1}`,
      },
    },
    {
      id: "bar",
      label: "Bar",
      icon: Wine,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a bar building (kind: "reception", width: 8, depth: 6, floors: 1, roof: "flat") adjacent to restaurant ${idx + 1} with a small deck between them`,
      },
    },
    {
      id: "stage",
      label: "Stage",
      icon: Music,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a small paved stage area next to restaurant ${idx + 1} and a lawn zone around it`,
      },
    },
    {
      id: "patio",
      label: "Garden Patio",
      icon: Sun,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a landscaped garden zone and a stone-tile patio adjacent to restaurant ${idx + 1}`,
      },
    },
    {
      id: "bigger",
      label: "Expand",
      icon: Expand,
      action: {
        type: "direct",
        fn: (json, idx, raw) => growBy(json, idx, raw, "building", 4, 3),
      },
    },
  ],
};

/** Reception building quick actions */
export const RECEPTION_ACTIONS: QuickActionGroup = {
  label: "Reception",
  emoji: "🏨",
  accent: "indigo",
  actions: [
    {
      id: "lobby",
      label: "Grand Lobby",
      icon: Star,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Expand reception building ${idx + 1} to a grand lobby (width: 20, depth: 14, floors: 2) with luxury stone exterior`,
      },
    },
    {
      id: "add-cafe",
      label: "Add Café",
      icon: Wine,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a small café building near reception ${idx + 1} with outdoor seating patio`,
      },
    },
    {
      id: "bigger",
      label: "Expand",
      icon: Expand,
      action: {
        type: "direct",
        fn: (json, idx, raw) => growBy(json, idx, raw, "building", 4, 3),
      },
    },
    {
      id: "add-floor",
      label: "Add Floor",
      icon: ArrowUp,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "building", {
            floors: Math.min(6, ((raw.floors as number) || 1) + 1),
          }),
      },
    },
  ],
};

/** Garden landscaping quick actions */
export const GARDEN_ACTIONS: QuickActionGroup = {
  label: "Garden",
  emoji: "🌺",
  accent: "emerald",
  actions: [
    {
      id: "trees",
      label: "Add Trees",
      icon: TreePine,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a row of tall trees (kind: "lawn") adjacent to garden zone ${idx + 1} to create a natural boundary`,
      },
    },
    {
      id: "flowers",
      label: "Add Flowers",
      icon: Palette,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "landscape", { kind: "garden" }),
      },
    },
    {
      id: "fire-pit",
      label: "Fire Pit",
      icon: Flame,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a fire pit seating area near garden zone ${idx + 1} — a small stone patio with ambient landscape zones around it`,
      },
    },
    {
      id: "outdoor-kitchen",
      label: "Outdoor Kitchen",
      icon: Flame,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add an outdoor kitchen and BBQ area next to garden zone ${idx + 1} with wooden deck and pergola vibe`,
      },
    },
    {
      id: "bigger",
      label: "Expand",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) => growBy(json, idx, raw, "landscape", 4, 4),
      },
    },
  ],
};

/** Lawn landscaping quick actions */
export const LAWN_ACTIONS: QuickActionGroup = {
  label: "Lawn",
  emoji: "🌿",
  accent: "green",
  actions: [
    {
      id: "treeline",
      label: "Add Trees",
      icon: TreePine,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add garden landscape zones with trees along the edges of lawn zone ${idx + 1}`,
      },
    },
    {
      id: "wildflowers",
      label: "Wildflowers",
      icon: Palette,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Convert lawn zone ${idx + 1} to a wildflower garden — change it to kind: "garden"`,
      },
    },
    {
      id: "water-feature",
      label: "Water Feature",
      icon: Droplets,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a small decorative pool next to lawn zone ${idx + 1}`,
      },
    },
    {
      id: "fire-pit",
      label: "Fire Pit",
      icon: Flame,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a fire pit gathering area with stone patio next to lawn zone ${idx + 1}`,
      },
    },
    {
      id: "bigger",
      label: "Expand",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) => growBy(json, idx, raw, "landscape", 5, 5),
      },
    },
  ],
};

/** Patio quick actions */
export const PATIO_ACTIONS: QuickActionGroup = {
  label: "Patio",
  emoji: "☀️",
  accent: "orange",
  actions: [
    {
      id: "furniture",
      label: "Furniture",
      icon: Armchair,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Make patio ${idx + 1} a stylish outdoor living space with dining furniture and lounge area`,
      },
    },
    {
      id: "fire-pit",
      label: "Fire Pit",
      icon: Flame,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a fire pit seating area to patio ${idx + 1}`,
      },
    },
    {
      id: "bbq",
      label: "BBQ Station",
      icon: Flame,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a BBQ and outdoor kitchen station to patio ${idx + 1}`,
      },
    },
    {
      id: "bigger",
      label: "Make Bigger",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) => growBy(json, idx, raw, "patio", 3, 2),
      },
    },
  ],
};

/** Balcony quick actions */
export const BALCONY_ACTIONS: QuickActionGroup = {
  label: "Balcony",
  emoji: "🌅",
  accent: "sky",
  actions: [
    {
      id: "extend",
      label: "Extend",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "balcony", {
            depth: Math.min(6, ((raw.depth as number) || 1.5) + 0.8),
          }),
      },
    },
    {
      id: "hot-tub",
      label: "Hot Tub",
      icon: Droplets,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Extend balcony ${idx + 1} to make room for a hot tub — increase depth to at least 3m`,
      },
    },
    {
      id: "glass-railing",
      label: "Glass Railing",
      icon: Waves,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Make the railing on balcony ${idx + 1} a sleek glass railing — lower the railingHeight to 0.9 and set trim material to glass`,
      },
    },
    {
      id: "pergola",
      label: "Add Pergola",
      icon: Layers,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Add a pergola or covered shade structure above balcony ${idx + 1}`,
      },
    },
  ],
};

/** Room quick actions */
export const ROOM_ACTIONS: QuickActionGroup = {
  label: "Room",
  emoji: "🛋️",
  accent: "violet",
  actions: [
    {
      id: "bigger",
      label: "Make Bigger",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "room", {
            width: Math.min(12, ((raw.width as number) || 3) + 1.5),
            depth: Math.min(12, ((raw.depth as number) || 3) + 1.5),
          }),
      },
    },
    {
      id: "open-plan",
      label: "Open Plan",
      icon: FlipHorizontal2,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Make room ${idx + 1} into an open-plan space — make it much larger and set it to type "living"`,
      },
    },
    {
      id: "move",
      label: "Reposition",
      icon: Move,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Reposition room ${idx + 1} to better fit with the neighbouring rooms — find a less-crowded spot in the floor plan`,
      },
    },
  ],
};

/** Window quick actions */
export const WINDOW_ACTIONS: QuickActionGroup = {
  label: "Window",
  emoji: "🪟",
  accent: "blue",
  actions: [
    {
      id: "larger",
      label: "Larger",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "window", {
            width: Math.min(4, ((raw.width as number) || 1.2) + 0.4),
            height: Math.min(3, ((raw.height as number) || 1.4) + 0.3),
          }),
      },
    },
    {
      id: "floor-to-ceiling",
      label: "Full Height",
      icon: ArrowUp,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "window", {
            height: 2.6,
            sill: 0,
            width: Math.max(1.6, (raw.width as number) || 1.2),
          }),
      },
    },
    {
      id: "bay-window",
      label: "Bay Window",
      icon: ZoomIn,
      action: {
        type: "ai",
        prompt: (idx) =>
          `Replace window ${idx + 1} with a wide bay window — increase width to 2.4 and add a second matching window next to it on the same wall`,
      },
    },
  ],
};

/** Garage quick actions */
export const GARAGE_ACTIONS: QuickActionGroup = {
  label: "Garage",
  emoji: "🚗",
  accent: "neutral",
  actions: [
    {
      id: "bigger",
      label: "2-Car Garage",
      icon: Maximize2,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "garage", {
            width: Math.max(6, (raw.width as number) || 6),
          }),
      },
    },
    {
      id: "add-floor",
      label: "Add Loft",
      icon: ArrowUp,
      action: {
        type: "direct",
        fn: (json, idx, raw) =>
          setField(json, idx, raw, "garage", {
            height: Math.min(6, ((raw.height as number) || 2.6) + 1),
          }),
      },
    },
    {
      id: "modern",
      label: "Modern",
      icon: Settings2,
      action: { type: "material", preset: MODERN },
    },
  ],
};

// ── Lookup table ─────────────────────────────────────────────────────────────

export function getActionsForFeature(
  type: FeatureType,
  rawFeature: Record<string, unknown>
): QuickActionGroup {
  switch (type) {
    case "pool": return POOL_ACTIONS;
    case "building": {
      const kind = rawFeature.kind as string;
      if (kind === "restaurant") return RESTAURANT_ACTIONS;
      if (kind === "reception") return RECEPTION_ACTIONS;
      return VILLA_ACTIONS;
    }
    case "landscape": {
      const kind = rawFeature.kind as string;
      if (kind === "garden") return GARDEN_ACTIONS;
      return LAWN_ACTIONS;
    }
    case "patio":    return PATIO_ACTIONS;
    case "balcony":  return BALCONY_ACTIONS;
    case "room":     return ROOM_ACTIONS;
    case "window":   return WINDOW_ACTIONS;
    case "garage":   return GARAGE_ACTIONS;
    default:         return HOUSE_ACTIONS;
  }
}
