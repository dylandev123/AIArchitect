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
      // 12×9, 2 floors → usableW=11.6, usableD=8.6
      house: { width: 12, depth: 9, floors: 2, roof: "gable" },
      materials: { ...BASE_MATERIALS, exterior: { material: "stucco", color: "#f0ece4" }, roof: { material: "metal", color: "#454b54" } },
      windows: [
        // Ground floor — north (bedrooms) + south (living/kitchen)
        { wall: "north", level: 0, offset: 1.8, width: 1.2, height: 1.4, sill: 0.9 },
        { wall: "north", level: 0, offset: 5.7, width: 1.2, height: 1.4, sill: 0.9 },
        { wall: "south", level: 0, offset: 2.4, width: 1.4, height: 1.4, sill: 0.9 },
        { wall: "south", level: 0, offset: 9.0, width: 1.2, height: 1.4, sill: 0.9 },
        { wall: "east",  level: 0, offset: 1.5, width: 0.7, height: 1.0, sill: 1.1 },
        // Upper floor — master suite + office
        { wall: "south", level: 1, offset: 2.0, width: 1.8, height: 1.4, sill: 0.9 },
        { wall: "south", level: 1, offset: 7.8, width: 1.8, height: 1.4, sill: 0.9 },
        { wall: "north", level: 1, offset: 2.0, width: 1.4, height: 1.4, sill: 0.9 },
      ],
      doors: [{ wall: "south", level: 0, offset: 5.3, width: 1.0, height: 2.1 }],
      garages: [{ wall: "east", offset: 0, width: 6, depth: 6, height: 2.6 }],
      balconies: [{ wall: "south", level: 1, offset: 3.8, width: 4.0, depth: 1.5, railingHeight: 1.0 }],
      patios: [{ wall: "south", offset: 0, width: 12, depth: 3.5 }],
      pools: [], driveways: [{ wall: "east", offset: 0, width: 3, length: 8 }],
      rooms: [
        // Ground floor: bedrooms N, hallway, living+kitchen S
        { type: "bedroom",  level: 0, x: 0,    z: 0,   width: 4.4,  depth: 3.8 },
        { type: "bedroom",  level: 0, x: 4.4,  z: 0,   width: 3.8,  depth: 3.8 },
        { type: "bathroom", level: 0, x: 8.2,  z: 0,   width: 3.4,  depth: 3.8 },
        { type: "hallway",  level: 0, x: 0,    z: 3.8, width: 11.6, depth: 1.0 },
        { type: "living",   level: 0, x: 0,    z: 4.8, width: 6.6,  depth: 3.8 },
        { type: "kitchen",  level: 0, x: 6.6,  z: 4.8, width: 5.0,  depth: 3.8 },
        // Upper floor: master + office N, hallway, master bath + laundry S
        { type: "bedroom",  level: 1, x: 0,    z: 0,   width: 5.8,  depth: 5.0 },
        { type: "office",   level: 1, x: 5.8,  z: 0,   width: 5.8,  depth: 5.0 },
        { type: "hallway",  level: 1, x: 0,    z: 5.0, width: 11.6, depth: 0.8 },
        { type: "bathroom", level: 1, x: 0,    z: 5.8, width: 5.8,  depth: 2.8 },
        { type: "laundry",  level: 1, x: 5.8,  z: 5.8, width: 5.8,  depth: 2.8 },
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
      // 22×14, 4 floors → usableW=21.6, usableD=13.6
      house: { width: 22, depth: 14, floors: 4, roof: "flat" },
      materials: { ...BASE_MATERIALS, exterior: { material: "concrete", color: "#d8d4cc" }, roof: { material: "metal", color: "#3a3f47" } },
      windows: Array.from({ length: 8 }, (_, i) => ({
        wall: "south" as const, level: i % 4,
        offset: 2.5 + Math.floor(i / 4) * 9,
        width: 1.4, height: 1.5, sill: 0.8,
      })),
      doors: [{ wall: "south", level: 0, offset: 10.3, width: 2.4, height: 2.4 }],
      garages: [], balconies: [], patios: [{ wall: "south", offset: 0, width: 22, depth: 5 }],
      pools: [{ wall: "south", offset: 5, distance: 7, width: 10, depth: 5, waterDepth: 1.6 }],
      driveways: [{ wall: "north", offset: 8, width: 6, length: 10 }],
      rooms: [
        // Ground floor — lobby + dining + kitchen
        { type: "living",   level: 0, x: 0,     z: 0,   width: 13.4, depth: 8.0 },
        { type: "dining",   level: 0, x: 13.4,  z: 0,   width: 8.2,  depth: 8.0 },
        { type: "hallway",  level: 0, x: 0,     z: 8.0, width: 21.6, depth: 1.6 },
        { type: "kitchen",  level: 0, x: 0,     z: 9.6, width: 10.8, depth: 4.0 },
        { type: "bathroom", level: 0, x: 10.8,  z: 9.6, width: 10.8, depth: 4.0 },
        // Floor 1 — hotel bedroom suites
        { type: "bedroom",  level: 1, x: 0,    z: 0,   width: 5.4,  depth: 8.4 },
        { type: "bedroom",  level: 1, x: 5.4,  z: 0,   width: 5.4,  depth: 8.4 },
        { type: "bedroom",  level: 1, x: 10.8, z: 0,   width: 5.4,  depth: 8.4 },
        { type: "bedroom",  level: 1, x: 16.2, z: 0,   width: 5.4,  depth: 8.4 },
        { type: "hallway",  level: 1, x: 0,    z: 8.4, width: 21.6, depth: 1.2 },
        { type: "bathroom", level: 1, x: 0,    z: 9.6, width: 5.4,  depth: 4.0 },
        { type: "bathroom", level: 1, x: 5.4,  z: 9.6, width: 5.4,  depth: 4.0 },
        { type: "bathroom", level: 1, x: 10.8, z: 9.6, width: 5.4,  depth: 4.0 },
        { type: "bathroom", level: 1, x: 16.2, z: 9.6, width: 5.4,  depth: 4.0 },
      ],
      buildings: [], roads: [],
      parking: [{ x: 0, z: -20, width: 22, depth: 8 }],
      landscaping: [{ kind: "garden", x: -14, z: 0, width: 6, depth: 10 }], decks: [],
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
      // 16×12, 1 floor → usableW=15.6, usableD=11.6
      house: { width: 16, depth: 12, floors: 1, roof: "flat" },
      materials: { ...BASE_MATERIALS, exterior: { material: "stone", color: "#c4b9aa" }, trim: { material: "metal", color: "#2c2c30" }, decking: { material: "wood", color: "#7a5c3a" } },
      windows: [
        { wall: "south", level: 0, offset: 1.0,  width: 3.5, height: 2.2, sill: 0.7 },
        { wall: "south", level: 0, offset: 6.0,  width: 3.5, height: 2.2, sill: 0.7 },
        { wall: "south", level: 0, offset: 11.5, width: 2.5, height: 2.2, sill: 0.7 },
        { wall: "east",  level: 0, offset: 2.0,  width: 3.0, height: 2.0, sill: 0.7 },
        { wall: "west",  level: 0, offset: 2.0,  width: 3.0, height: 2.0, sill: 0.7 },
      ],
      doors: [{ wall: "south", level: 0, offset: 7.3, width: 1.6, height: 2.4 }],
      garages: [], balconies: [], patios: [{ wall: "south", offset: 0, width: 16, depth: 4 }],
      pools: [], driveways: [{ wall: "east", offset: 1, width: 4, length: 6 }],
      rooms: [
        // Dining hall takes most of the floor, kitchen along the east wall
        { type: "dining",  level: 0, x: 0,    z: 0, width: 10.0, depth: 11.6 },
        { type: "kitchen", level: 0, x: 10.0, z: 0, width: 5.6,  depth: 11.6 },
      ],
      buildings: [], roads: [],
      parking: [{ x: -14, z: 0, width: 10, depth: 12 }],
      landscaping: [{ kind: "garden", x: 13, z: 0, width: 4, depth: 5 }], decks: [],
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
      // 9×8, 1 floor → usableW=8.6, usableD=7.6
      house: { width: 9, depth: 8, floors: 1, roof: "gable" },
      materials: { ...BASE_MATERIALS, exterior: { material: "wood", color: "#8a6545" }, roof: { material: "metal", color: "#3d3028" }, trim: { material: "wood", color: "#4a3020" } },
      windows: [
        { wall: "south", level: 0, offset: 0.8, width: 2.5, height: 2.0, sill: 0.7 },
        { wall: "south", level: 0, offset: 5.5, width: 1.5, height: 2.0, sill: 0.7 },
        { wall: "east",  level: 0, offset: 2.0, width: 1.8, height: 1.4, sill: 0.9 },
      ],
      doors: [{ wall: "south", level: 0, offset: 3.9, width: 0.9, height: 2.1 }],
      garages: [], balconies: [],
      patios: [{ wall: "south", offset: 0, width: 9, depth: 2.5 }],
      pools: [], driveways: [],
      rooms: [
        { type: "living",  level: 0, x: 0,   z: 0, width: 6.0, depth: 7.6 },
        { type: "kitchen", level: 0, x: 6.0, z: 0, width: 2.6, depth: 7.6 },
      ],
      buildings: [], roads: [], parking: [],
      landscaping: [{ kind: "garden", x: -7, z: 0, width: 4, depth: 5 }], decks: [],
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
      // 14×10, 1 floor → usableW=13.6, usableD=9.6
      house: { width: 14, depth: 10, floors: 1, roof: "flat" },
      materials: { ...BASE_MATERIALS, exterior: { material: "stucco", color: "#f5f0e8" }, roof: { material: "concrete", color: "#a0a0a0" }, decking: { material: "wood", color: "#8a6a3c" } },
      windows: [
        { wall: "south", level: 0, offset: 1.0, width: 4.0, height: 2.4, sill: 0.5 },
        { wall: "south", level: 0, offset: 9.2, width: 3.5, height: 2.4, sill: 0.5 },
        { wall: "east",  level: 0, offset: 2.0, width: 2.0, height: 2.0, sill: 0.7 },
        { wall: "west",  level: 0, offset: 2.0, width: 2.0, height: 2.0, sill: 0.7 },
        { wall: "north", level: 0, offset: 1.8, width: 2.0, height: 1.4, sill: 0.9 },
      ],
      doors: [{ wall: "south", level: 0, offset: 6.3, width: 1.8, height: 2.4 }],
      garages: [],
      balconies: [{ wall: "south", level: 0, offset: 1, width: 12, depth: 2.5, railingHeight: 0.9 }],
      patios: [],
      pools: [{ wall: "south", offset: 2, distance: 5, width: 8, depth: 4, waterDepth: 1.4 }],
      driveways: [],
      rooms: [
        // Open-plan living on the west, master suite + bath on the east
        { type: "living",   level: 0, x: 0,   z: 0,   width: 8.0, depth: 9.6 },
        { type: "bedroom",  level: 0, x: 8.0, z: 0,   width: 5.6, depth: 4.8 },
        { type: "bathroom", level: 0, x: 8.0, z: 4.8, width: 5.6, depth: 4.8 },
      ],
      buildings: [], roads: [], parking: [],
      landscaping: [{ kind: "garden", x: -10, z: 2, width: 4, depth: 6 }], decks: [],
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
      // 20×12, 2 floors → usableW=19.6, usableD=11.6
      house: { width: 20, depth: 12, floors: 2, roof: "hip" },
      materials: { ...BASE_MATERIALS, exterior: { material: "concrete", color: "#e8e4de" }, roof: { material: "metal", color: "#5a7a8a" }, trim: { material: "metal", color: "#3a5a6a" } },
      windows: [
        { wall: "south", level: 0, offset: 1.0,  width: 3.0, height: 2.2, sill: 0.6 },
        { wall: "south", level: 0, offset: 7.0,  width: 5.0, height: 2.2, sill: 0.6 },
        { wall: "south", level: 0, offset: 15.0, width: 3.5, height: 2.2, sill: 0.6 },
        { wall: "south", level: 1, offset: 2.0,  width: 4.0, height: 1.6, sill: 0.8 },
        { wall: "south", level: 1, offset: 13.0, width: 4.0, height: 1.6, sill: 0.8 },
        { wall: "east",  level: 0, offset: 2.0,  width: 3.0, height: 2.0, sill: 0.6 },
        { wall: "west",  level: 0, offset: 2.0,  width: 3.0, height: 2.0, sill: 0.6 },
        { wall: "north", level: 1, offset: 2.0,  width: 2.5, height: 1.4, sill: 0.9 },
        { wall: "north", level: 1, offset: 11.8, width: 2.5, height: 1.4, sill: 0.9 },
      ],
      doors: [{ wall: "south", level: 0, offset: 9.3, width: 1.4, height: 2.4 }],
      garages: [],
      balconies: [{ wall: "south", level: 1, offset: 3, width: 14, depth: 2, railingHeight: 1.0 }],
      patios: [{ wall: "south", offset: 0, width: 20, depth: 4 }],
      pools: [{ wall: "south", offset: 4, distance: 6, width: 10, depth: 4, waterDepth: 1.2 }],
      driveways: [{ wall: "north", offset: 7, width: 6, length: 8 }],
      rooms: [
        // Ground floor: lounge + bar + kitchen
        { type: "living",   level: 0, x: 0,    z: 0,   width: 11.8, depth: 7.6 },
        { type: "dining",   level: 0, x: 11.8, z: 0,   width: 7.8,  depth: 7.6 },
        { type: "hallway",  level: 0, x: 0,    z: 7.6, width: 19.6, depth: 1.2 },
        { type: "kitchen",  level: 0, x: 0,    z: 8.8, width: 9.8,  depth: 2.8 },
        { type: "bathroom", level: 0, x: 9.8,  z: 8.8, width: 9.8,  depth: 2.8 },
        // Upper floor: two master suites + hallway + office + gym
        { type: "bedroom",  level: 1, x: 0,    z: 0,   width: 9.8,  depth: 5.8 },
        { type: "bedroom",  level: 1, x: 9.8,  z: 0,   width: 9.8,  depth: 5.8 },
        { type: "hallway",  level: 1, x: 0,    z: 5.8, width: 19.6, depth: 1.2 },
        { type: "office",   level: 1, x: 0,    z: 7.0, width: 9.8,  depth: 4.6 },
        { type: "gym",      level: 1, x: 9.8,  z: 7.0, width: 9.8,  depth: 4.6 },
      ],
      buildings: [], roads: [],
      parking: [{ x: 0, z: -18, width: 20, depth: 8 }],
      landscaping: [], decks: [],
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
