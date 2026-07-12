import type { SiteConfig } from "@/types/house";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";

export interface Template {
  id: string;
  emoji: string;
  name: string;
  description: string;
  gradient: string;
  accentColor: string;
  site: SiteConfig;
}

const BASE_MATERIALS = DEFAULT_MATERIALS_CONFIG;

export const TEMPLATES: Template[] = [
  {
    id: "dream-home",
    emoji: "🏠",
    name: "Dream Home",
    description: "Design your perfect residence",
    gradient: "from-amber-500/20 to-orange-600/20",
    accentColor: "#f59e0b",
    site: {
      house: { width: 12, depth: 9, floors: 2, roof: "gable" },
      materials: { ...BASE_MATERIALS, exterior: { material: "stucco", color: "#f0ece4" }, roof: { material: "metal", color: "#454b54" } },
      windows: [
        { wall: "south", level: 0, offset: 1.5, width: 1.4, height: 1.4, sill: 0.9 },
        { wall: "south", level: 0, offset: 9.0, width: 1.4, height: 1.4, sill: 0.9 },
        { wall: "south", level: 1, offset: 5.5, width: 1.8, height: 1.5, sill: 0.8 },
        { wall: "north", level: 0, offset: 5.4, width: 1.2, height: 1.4, sill: 0.9 },
        { wall: "east", level: 0, offset: 3, width: 1.2, height: 1.2, sill: 0.9 },
      ],
      doors: [{ wall: "south", level: 0, offset: 5.5, width: 1.0, height: 2.1 }],
      garages: [{ wall: "east", offset: 0, width: 6, depth: 6, height: 2.6 }],
      balconies: [{ wall: "south", level: 1, offset: 4, width: 4, depth: 1.5, railingHeight: 1.0 }],
      patios: [{ wall: "south", offset: 0, width: 12, depth: 3.5 }],
      pools: [], driveways: [{ wall: "east", offset: 0, width: 3, length: 8 }],
      rooms: [
        { type: "living", level: 0, x: 0.2, z: 4.4, width: 6.0, depth: 4.0 },
        { type: "kitchen", level: 0, x: 6.4, z: 4.4, width: 5.0, depth: 4.0 },
        { type: "hallway", level: 0, x: 0.2, z: 3.3, width: 11.2, depth: 1.0 },
        { type: "bedroom", level: 0, x: 0.2, z: 0.2, width: 4.5, depth: 3.0 },
        { type: "bedroom", level: 0, x: 5.0, z: 0.2, width: 4.0, depth: 3.0 },
        { type: "bathroom", level: 0, x: 9.2, z: 0.2, width: 2.2, depth: 3.0 },
      ],
      buildings: [], roads: [], parking: [], landscaping: [], decks: [],
    },
  },
  {
    id: "hotel",
    emoji: "🏨",
    name: "Hotel",
    description: "Build a hospitality destination",
    gradient: "from-blue-500/20 to-indigo-600/20",
    accentColor: "#3b82f6",
    site: {
      house: { width: 22, depth: 14, floors: 4, roof: "flat" },
      materials: { ...BASE_MATERIALS, exterior: { material: "concrete", color: "#d8d4cc" }, roof: { material: "metal", color: "#3a3f47" } },
      windows: Array.from({ length: 8 }, (_, i) => ({ wall: "south" as const, level: i % 4, offset: 2.5 + Math.floor(i / 4) * 8, width: 1.2, height: 1.4, sill: 0.8 })),
      doors: [{ wall: "south", level: 0, offset: 10.5, width: 2.4, height: 2.4 }],
      garages: [], balconies: [], patios: [{ wall: "south", offset: 0, width: 22, depth: 5 }],
      pools: [{ wall: "south", offset: 5, distance: 7, width: 10, depth: 5, waterDepth: 1.6 }],
      driveways: [{ wall: "north", offset: 8, width: 6, length: 10 }],
      rooms: [
        { type: "living", level: 0, x: 0.2, z: 7, width: 10, depth: 6.5 },
        { type: "kitchen", level: 0, x: 11, z: 7, width: 10.5, depth: 6.5 },
      ],
      buildings: [], roads: [], parking: [{ x: 0, z: -20, width: 22, depth: 8 }], landscaping: [{ kind: "garden", x: -14, z: 0, width: 6, depth: 10 }], decks: [],
    },
  },
  {
    id: "restaurant",
    emoji: "🍕",
    name: "Restaurant",
    description: "Create a dining experience",
    gradient: "from-red-500/20 to-rose-600/20",
    accentColor: "#ef4444",
    site: {
      house: { width: 16, depth: 12, floors: 1, roof: "flat" },
      materials: { ...BASE_MATERIALS, exterior: { material: "stone", color: "#c4b9aa" }, trim: { material: "metal", color: "#2c2c30" }, decking: { material: "wood", color: "#7a5c3a" } },
      windows: [
        { wall: "south", level: 0, offset: 1, width: 3.5, height: 2.2, sill: 0.7 },
        { wall: "south", level: 0, offset: 6, width: 3.5, height: 2.2, sill: 0.7 },
        { wall: "south", level: 0, offset: 11.5, width: 2.5, height: 2.2, sill: 0.7 },
        { wall: "east", level: 0, offset: 2, width: 3, height: 2, sill: 0.7 },
        { wall: "west", level: 0, offset: 2, width: 3, height: 2, sill: 0.7 },
      ],
      doors: [{ wall: "south", level: 0, offset: 7.5, width: 1.6, height: 2.4 }],
      garages: [], balconies: [], patios: [{ wall: "south", offset: 0, width: 16, depth: 4 }],
      pools: [], driveways: [{ wall: "east", offset: 1, width: 4, length: 6 }],
      rooms: [
        { type: "living", level: 0, x: 0.2, z: 0.2, width: 10, depth: 11.5 },
        { type: "kitchen", level: 0, x: 11, z: 0.2, width: 4.5, depth: 11.5 },
      ],
      buildings: [], roads: [], parking: [{ x: -14, z: 0, width: 10, depth: 12 }], landscaping: [{ kind: "garden", x: 13, z: 0, width: 4, depth: 5 }], decks: [],
    },
  },
  {
    id: "coffee-shop",
    emoji: "☕",
    name: "Coffee Shop",
    description: "A cozy corner café",
    gradient: "from-yellow-500/20 to-amber-600/20",
    accentColor: "#eab308",
    site: {
      house: { width: 9, depth: 8, floors: 1, roof: "gable" },
      materials: { ...BASE_MATERIALS, exterior: { material: "wood", color: "#8a6545" }, roof: { material: "metal", color: "#3d3028" }, trim: { material: "wood", color: "#4a3020" } },
      windows: [
        { wall: "south", level: 0, offset: 0.8, width: 2.5, height: 2.0, sill: 0.7 },
        { wall: "south", level: 0, offset: 5.5, width: 1.5, height: 2.0, sill: 0.7 },
        { wall: "east", level: 0, offset: 2, width: 1.8, height: 1.4, sill: 0.9 },
      ],
      doors: [{ wall: "south", level: 0, offset: 4.0, width: 0.9, height: 2.1 }],
      garages: [], balconies: [],
      patios: [{ wall: "south", offset: 0, width: 9, depth: 2.5 }],
      pools: [], driveways: [],
      rooms: [
        { type: "living", level: 0, x: 0.2, z: 0.2, width: 6, depth: 7.5 },
        { type: "kitchen", level: 0, x: 6.5, z: 0.2, width: 2, depth: 7.5 },
      ],
      buildings: [], roads: [], parking: [], landscaping: [{ kind: "garden", x: -7, z: 0, width: 4, depth: 5 }], decks: [],
    },
  },
  {
    id: "beach-villa",
    emoji: "🏖",
    name: "Beach Villa",
    description: "A tropical waterfront retreat",
    gradient: "from-teal-500/20 to-cyan-600/20",
    accentColor: "#14b8a6",
    site: {
      house: { width: 14, depth: 10, floors: 1, roof: "flat" },
      materials: { ...BASE_MATERIALS, exterior: { material: "stucco", color: "#f5f0e8" }, roof: { material: "concrete", color: "#a0a0a0" }, decking: { material: "wood", color: "#8a6a3c" } },
      windows: [
        { wall: "south", level: 0, offset: 1, width: 4, height: 2.4, sill: 0.5 },
        { wall: "south", level: 0, offset: 8.5, width: 4, height: 2.4, sill: 0.5 },
        { wall: "east", level: 0, offset: 2, width: 2, height: 2, sill: 0.7 },
        { wall: "west", level: 0, offset: 2, width: 2, height: 2, sill: 0.7 },
      ],
      doors: [{ wall: "south", level: 0, offset: 6.5, width: 1.8, height: 2.4 }],
      garages: [],
      balconies: [{ wall: "south", level: 0, offset: 1, width: 12, depth: 2.5, railingHeight: 0.9 }],
      patios: [],
      pools: [{ wall: "south", offset: 2, distance: 5, width: 8, depth: 4, waterDepth: 1.4 }],
      driveways: [],
      rooms: [
        { type: "living", level: 0, x: 0.2, z: 0.2, width: 8, depth: 9.0 },
        { type: "bedroom", level: 0, x: 8.5, z: 0.2, width: 5, depth: 4.4 },
        { type: "bathroom", level: 0, x: 8.5, z: 4.8, width: 5, depth: 4.4 },
      ],
      buildings: [], roads: [], parking: [], landscaping: [{ kind: "garden", x: -10, z: 2, width: 4, depth: 6 }], decks: [],
    },
  },
  {
    id: "marina",
    emoji: "🛥",
    name: "Marina",
    description: "A waterside entertainment hub",
    gradient: "from-sky-500/20 to-blue-700/20",
    accentColor: "#0ea5e9",
    site: {
      house: { width: 20, depth: 12, floors: 2, roof: "hip" },
      materials: { ...BASE_MATERIALS, exterior: { material: "concrete", color: "#e8e4de" }, roof: { material: "metal", color: "#5a7a8a" }, trim: { material: "metal", color: "#3a5a6a" } },
      windows: [
        { wall: "south", level: 0, offset: 1, width: 3, height: 2.2, sill: 0.6 },
        { wall: "south", level: 0, offset: 7, width: 5, height: 2.2, sill: 0.6 },
        { wall: "south", level: 0, offset: 15, width: 3.5, height: 2.2, sill: 0.6 },
        { wall: "south", level: 1, offset: 2, width: 4, height: 1.6, sill: 0.8 },
        { wall: "south", level: 1, offset: 13, width: 4, height: 1.6, sill: 0.8 },
        { wall: "east", level: 0, offset: 2, width: 3, height: 2, sill: 0.6 },
        { wall: "west", level: 0, offset: 2, width: 3, height: 2, sill: 0.6 },
      ],
      doors: [{ wall: "south", level: 0, offset: 9.5, width: 1.4, height: 2.4 }],
      garages: [], balconies: [{ wall: "south", level: 1, offset: 3, width: 14, depth: 2, railingHeight: 1.0 }],
      patios: [{ wall: "south", offset: 0, width: 20, depth: 4 }],
      pools: [{ wall: "south", offset: 4, distance: 6, width: 10, depth: 4, waterDepth: 1.2 }],
      driveways: [{ wall: "north", offset: 7, width: 6, length: 8 }],
      rooms: [
        { type: "living", level: 0, x: 0.2, z: 0.2, width: 12, depth: 11.5 },
        { type: "kitchen", level: 0, x: 13, z: 0.2, width: 6.5, depth: 6 },
        { type: "bathroom", level: 0, x: 13, z: 6.5, width: 6.5, depth: 5 },
      ],
      buildings: [], roads: [], parking: [{ x: 0, z: -18, width: 20, depth: 8 }], landscaping: [], decks: [],
    },
  },
  {
    id: "describe-anything",
    emoji: "✨",
    name: "Describe Anything",
    description: "Tell the AI what you envision",
    gradient: "from-violet-500/20 to-purple-700/20",
    accentColor: "#8b5cf6",
    site: {
      house: { width: 12, depth: 9, floors: 1, roof: "flat" },
      materials: DEFAULT_MATERIALS_CONFIG,
      windows: [], doors: [], garages: [], balconies: [], patios: [], pools: [], driveways: [],
      rooms: [], buildings: [], roads: [], parking: [], landscaping: [], decks: [],
    },
  },
];
