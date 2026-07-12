/**
 * Central registry of every addable element in the editor.
 * Each entry declares what it is, which project types allow it, and
 * what action to take when the user clicks it. The ElementsPanel
 * reads from this registry — no more hardcoded sidebar cards.
 */
import type { ComponentType } from "react";
import type { BuildingKind, LandscapeKind, RoomType } from "@/types/house";
import type { FeatureType } from "@/lib/house/features/featureTypes";
import type { ProjectType } from "@/types/project";

import {
  Bath,
  BedDouble,
  Building,
  Car,
  ChefHat,
  DoorOpen,
  Flower2,
  Footprints,
  Grid2x2,
  Laptop,
  Layers,
  ParkingSquare,
  RectangleHorizontal,
  Route,
  Shirt,
  Sofa,
  Square,
  Trees,
  UtensilsCrossed,
  Warehouse,
  Waves,
} from "lucide-react";

// ── Action types ──────────────────────────────────────────────────────────────

export type ElementAction =
  | { kind: "add-feature";   featureType: FeatureType }
  | { kind: "add-room";      roomType: RoomType }
  | { kind: "add-building";  buildingKind: BuildingKind }
  | { kind: "add-landscape"; landscapeKind: LandscapeKind }
  | { kind: "coming-soon" };

/** A single addable element shown in the sidebar. */
export interface ElementEntry {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Sidebar section this element belongs to (e.g. "build", "rooms", "outdoor"). */
  group: string;
  /** Project types in which this element is available. */
  allowedTypes: ProjectType[];
  action: ElementAction;
}

// ── Registry ─────────────────────────────────────────────────────────────────

const ALL: ElementEntry[] = [
  // ── BUILD ──────────────────────────────────────────────────────────────────
  {
    id: "window",
    label: "Window",
    icon: Square,
    group: "build",
    allowedTypes: ["house", "villa", "restaurant", "commercial"],
    action: { kind: "add-feature", featureType: "window" },
  },
  {
    id: "door",
    label: "Door",
    icon: DoorOpen,
    group: "build",
    allowedTypes: ["house", "villa", "restaurant", "commercial"],
    action: { kind: "add-feature", featureType: "door" },
  },
  {
    id: "balcony",
    label: "Balcony",
    icon: RectangleHorizontal,
    group: "build",
    allowedTypes: ["house", "villa", "commercial"],
    action: { kind: "add-feature", featureType: "balcony" },
  },
  {
    id: "garage",
    label: "Garage",
    icon: Warehouse,
    group: "build",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-feature", featureType: "garage" },
  },
  {
    id: "stairs",
    label: "Stairs",
    icon: Layers,
    group: "build",
    allowedTypes: ["house", "villa", "commercial"],
    action: { kind: "coming-soon" },
  },
  {
    id: "fence",
    label: "Fence",
    icon: Grid2x2,
    group: "build",
    allowedTypes: ["house", "villa"],
    action: { kind: "coming-soon" },
  },

  // ── ROOMS ──────────────────────────────────────────────────────────────────
  {
    id: "room-bedroom",
    label: "Bedroom",
    icon: BedDouble,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "bedroom" },
  },
  {
    id: "room-bathroom",
    label: "Bathroom",
    icon: Bath,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "bathroom" },
  },
  {
    id: "room-kitchen",
    label: "Kitchen",
    icon: ChefHat,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "kitchen" },
  },
  {
    id: "room-living",
    label: "Living Room",
    icon: Sofa,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "living" },
  },
  {
    id: "room-dining",
    label: "Dining Room",
    icon: UtensilsCrossed,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "dining" },
  },
  {
    id: "room-office",
    label: "Office",
    icon: Laptop,
    group: "rooms",
    allowedTypes: ["house", "villa", "commercial"],
    action: { kind: "add-room", roomType: "office" },
  },
  {
    id: "room-hallway",
    label: "Hallway",
    icon: Footprints,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "hallway" },
  },
  {
    id: "room-laundry",
    label: "Laundry",
    icon: Shirt,
    group: "rooms",
    allowedTypes: ["house", "villa"],
    action: { kind: "add-room", roomType: "laundry" },
  },

  // ── OUTDOOR ────────────────────────────────────────────────────────────────
  {
    id: "pool",
    label: "Pool",
    icon: Waves,
    group: "outdoor",
    allowedTypes: ["house", "villa", "resort", "commercial"],
    action: { kind: "add-feature", featureType: "pool" },
  },
  {
    id: "patio",
    label: "Patio",
    icon: Grid2x2,
    group: "outdoor",
    allowedTypes: ["house", "villa", "restaurant", "resort", "commercial"],
    action: { kind: "add-feature", featureType: "patio" },
  },
  {
    id: "driveway",
    label: "Driveway",
    icon: Car,
    group: "outdoor",
    allowedTypes: ["house", "villa", "commercial"],
    action: { kind: "add-feature", featureType: "driveway" },
  },
  {
    id: "garden",
    label: "Garden",
    icon: Flower2,
    group: "outdoor",
    allowedTypes: ["house", "villa", "restaurant", "resort", "commercial"],
    action: { kind: "add-landscape", landscapeKind: "garden" },
  },
  {
    id: "lawn",
    label: "Lawn",
    icon: Trees,
    group: "outdoor",
    allowedTypes: ["house", "villa", "resort", "commercial"],
    action: { kind: "add-landscape", landscapeKind: "lawn" },
  },

  // ── SITE ───────────────────────────────────────────────────────────────────
  {
    id: "building-villa",
    label: "Villa",
    icon: Building,
    group: "site",
    allowedTypes: ["villa", "resort"],
    action: { kind: "add-building", buildingKind: "villa" },
  },
  {
    id: "building-restaurant",
    label: "Restaurant",
    icon: UtensilsCrossed,
    group: "site",
    allowedTypes: ["resort", "commercial"],
    action: { kind: "add-building", buildingKind: "restaurant" },
  },
  {
    id: "building-reception",
    label: "Reception",
    icon: Layers,
    group: "site",
    allowedTypes: ["resort", "commercial"],
    action: { kind: "add-building", buildingKind: "reception" },
  },
  {
    id: "road",
    label: "Road",
    icon: Route,
    group: "site",
    allowedTypes: ["villa", "resort", "commercial"],
    action: { kind: "add-feature", featureType: "road" },
  },
  {
    id: "parking",
    label: "Parking",
    icon: ParkingSquare,
    group: "site",
    allowedTypes: ["resort", "commercial"],
    action: { kind: "add-feature", featureType: "parking" },
  },
];

export const ELEMENT_REGISTRY: readonly ElementEntry[] = ALL;

// ── Group metadata ─────────────────────────────────────────────────────────

export const GROUP_LABELS: Record<string, string> = {
  build:   "🔨 Build",
  rooms:   "🛏 Rooms",
  outdoor: "🌿 Outdoor",
  site:    "🏗 Site",
};

/** Ordered group list per project type — controls section rendering order. */
export const GROUP_ORDER: Record<ProjectType, string[]> = {
  house:      ["build", "rooms", "outdoor"],
  villa:      ["build", "rooms", "outdoor", "site"],
  resort:     ["site", "outdoor"],
  restaurant: ["build", "outdoor"],
  commercial: ["build", "rooms", "site", "outdoor"],
};

/** Returns entries allowed for the given project type, preserving registry order. */
export function getElementsForType(type: ProjectType): ElementEntry[] {
  return ELEMENT_REGISTRY.filter((e) => e.allowedTypes.includes(type));
}

// ── Compatibility check ────────────────────────────────────────────────────

/**
 * Returns a human-readable warning when switching to `targetType` would hide
 * elements that already exist in the project JSON, or null if safe.
 * The objects are NEVER deleted — the user is only informed.
 */
export function getProjectTypeSwitchWarning(
  houseConfigJson: string,
  targetType: ProjectType
): string | null {
  try {
    const cfg = JSON.parse(houseConfigJson) as Record<string, unknown>;
    const buildings = (cfg.buildings as unknown[]) ?? [];
    const roads     = (cfg.roads     as unknown[]) ?? [];
    const parking   = (cfg.parking   as unknown[]) ?? [];
    const rooms     = (cfg.rooms     as unknown[]) ?? [];

    const hiddenSiteItems =
      (targetType === "house" || targetType === "restaurant") &&
      (buildings.length + roads.length + parking.length > 0);
    const hiddenRooms =
      (targetType === "resort" || targetType === "restaurant") &&
      rooms.length > 0;

    if (hiddenSiteItems && hiddenRooms) {
      return "This project has site structures and rooms that won't appear in the new type's sidebar — they won't be deleted.";
    }
    if (hiddenSiteItems) {
      return `This project has ${buildings.length + roads.length + parking.length} site structure(s) that won't appear in the new type's sidebar — they won't be deleted.`;
    }
    if (hiddenRooms) {
      return `This project has ${rooms.length} room(s) that won't appear in the new type's sidebar — they won't be deleted.`;
    }
    return null;
  } catch {
    return null;
  }
}
