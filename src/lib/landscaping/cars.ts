import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed, rngPick, rngRange } from "./rng";

export interface CarPlacement {
  id: string;
  position: [number, number];
  rotationY: number;
  color: string;
}

const CAR_COLORS = ["#b91c1c", "#1d4ed8", "#f8fafc", "#18181b", "#71717a"] as const;

const CARS_PER_PARKING_ROW = 3;
const PARKING_STALL_WIDTH = 2.5;
const PARKING_STALL_DEPTH = 4.5;

/** Cars are only placed inside explicit parking lots; a driveway remains a circulation route. */
export function generateCars(site: SiteConfig): CarPlacement[] {
  const seed = hashSeed("cars", site.house.width, site.house.depth, site.driveways.length, site.parking.length);
  const rng = createRng(seed);
  const cars: CarPlacement[] = [];

  site.parking.forEach((lot, li) => {
    const cols = Math.min(CARS_PER_PARKING_ROW, Math.max(1, Math.floor(lot.width / PARKING_STALL_WIDTH)));
    const rows = Math.min(2, Math.max(1, Math.floor(lot.depth / PARKING_STALL_DEPTH)));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const carX = lot.x - (lot.width / 2) + (lot.width / (cols + 1)) * (col + 1);
        const carZ = lot.z - (lot.depth / 2) + (PARKING_STALL_DEPTH / 2) + row * PARKING_STALL_DEPTH;
        cars.push({
          id: `car-parking-${li}-${row}-${col}`,
          position: [carX + rngRange(rng, -0.3, 0.3), carZ + rngRange(rng, -0.3, 0.3)],
          rotationY: rngRange(rng, -0.1, 0.1),
          color: rngPick(rng, CAR_COLORS),
        });
      }
    }
  });

  return cars;
}
