export const FEATURE_TYPES = [
  "window",
  "door",
  "garage",
  "balcony",
  "patio",
  "pool",
  "driveway",
  "room",
  "building",
  "road",
  "parking",
  "landscape",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];

/** Single source of truth mapping a feature type to its plural JSON array key. */
export const FEATURE_JSON_KEY: Record<FeatureType, string> = {
  window: "windows",
  door: "doors",
  garage: "garages",
  balcony: "balconies",
  patio: "patios",
  pool: "pools",
  driveway: "driveways",
  room: "rooms",
  building: "buildings",
  road: "roads",
  parking: "parking",
  landscape: "landscaping",
};

export const FEATURE_LABEL: Record<FeatureType, string> = {
  window: "Window",
  door: "Door",
  garage: "Garage",
  balcony: "Balcony",
  patio: "Patio",
  pool: "Pool",
  driveway: "Driveway",
  room: "Room",
  building: "Building",
  road: "Road",
  parking: "Parking Lot",
  landscape: "Landscaping",
};
