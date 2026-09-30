import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed, rngPick, rngRange } from "./rng";
import { parkingStalls } from "@/lib/house/features/parking";

export interface CarPlacement {
  id: string;
  position: [number, number];
  rotationY: number;
  color: string;
}

const CAR_COLORS = ["#b91c1c", "#1d4ed8", "#f8fafc", "#18181b", "#71717a"] as const;

const CARS_PER_PARKING_ROW = 3;
const PARKING_STALL_DEPTH = 4.5;
/** Matches the Car body (see Car.tsx). */
const CAR_WIDTH = 1.8;
const CAR_LENGTH = 4.2;
const MAX_YAW = 0.03;
/** Kept between a car and a stripe or the lot edge. */
const STALL_MARGIN = 0.1;

/**
 * Cars are only placed inside explicit parking lots, one per stall of the lot's own stall grid (the one its stripes
 * divide), in up to two rows centred in the lot's depth; a driveway remains a circulation route. Each car's small
 * random offset and yaw are bounded so its whole body stays inside its stall — never over a stripe or the lot edge.
 */
export function generateCars(site: SiteConfig): CarPlacement[] {
  const seed = hashSeed("cars", site.house.width, site.house.depth, site.driveways.length, site.parking.length);
  const rng = createRng(seed);
  const cars: CarPlacement[] = [];

  site.parking.forEach((lot, li) => {
    const stalls = parkingStalls(lot);
    const rows = Math.min(2, Math.floor(lot.depth / PARKING_STALL_DEPTH));
    // A lot too narrow or too shallow for a car's body holds none.
    if (rows < 1 || stalls.width < CAR_WIDTH + 2 * STALL_MARGIN) return;
    const cols = Math.min(CARS_PER_PARKING_ROW, stalls.count);
    // Spread the cars over the stalls rather than bunching them at one end.
    const used = Array.from({ length: cols }, (_, k) => Math.round(((k + 0.5) * stalls.count) / cols - 0.5));
    const rowStart = lot.z - (rows * PARKING_STALL_DEPTH) / 2 + PARKING_STALL_DEPTH / 2;
    const halfX = (CAR_WIDTH * Math.cos(MAX_YAW) + CAR_LENGTH * Math.sin(MAX_YAW)) / 2;
    const halfZ = (CAR_LENGTH * Math.cos(MAX_YAW) + CAR_WIDTH * Math.sin(MAX_YAW)) / 2;
    const slackX = Math.max(0, stalls.width / 2 - STALL_MARGIN - halfX);
    const slackZ = Math.max(0, PARKING_STALL_DEPTH / 2 - STALL_MARGIN / 2 - halfZ);
    for (let row = 0; row < rows; row++) {
      used.forEach((stall, col) => {
        cars.push({
          id: `car-parking-${li}-${row}-${col}`,
          position: [stalls.centers[stall] + rngRange(rng, -slackX, slackX), rowStart + row * PARKING_STALL_DEPTH + rngRange(rng, -slackZ, slackZ)],
          rotationY: rngRange(rng, -MAX_YAW, MAX_YAW),
          color: rngPick(rng, CAR_COLORS),
        });
      });
    }
  });

  return cars;
}
