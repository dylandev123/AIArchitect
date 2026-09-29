import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG, type SiteConfig } from "@/types/house";
import { generateCars } from "../cars";
import { generateTrees } from "../trees";

const site = (parking: SiteConfig["parking"]): SiteConfig => ({
  house: { width: 14, depth: 10, floors: 1, roof: "flat" }, materials: DEFAULT_MATERIALS_CONFIG,
  windows: [], doors: [], garages: [], balconies: [], patios: [], pools: [],
  driveways: [{ wall: "north", offset: 5, width: 3.5, length: 18 }], rooms: [], buildings: [], roads: [], parking, landscaping: [], decks: [],
});

describe("generateCars", () => {
  it("keeps driveways clear when no explicit parking area exists", () => {
    expect(generateCars(site([]))).toEqual([]);
  });

  it("places every generated car within its parking bounds", () => {
    const lot = { x: 16, z: -12, width: 8, depth: 10 };
    for (const car of generateCars(site([lot]))) {
      expect(car.position[0]).toBeGreaterThanOrEqual(lot.x - lot.width / 2);
      expect(car.position[0]).toBeLessThanOrEqual(lot.x + lot.width / 2);
      expect(car.position[1]).toBeGreaterThanOrEqual(lot.z - lot.depth / 2);
      expect(car.position[1]).toBeLessThanOrEqual(lot.z + lot.depth / 2);
    }
  });

  it("uses Site Plan planting purposes before ambient tree scatter", () => {
    const planted = site([]);
    planted.landscaping = [{ kind: "garden", purpose: "privacy", x: 18, z: 18, width: 8, depth: 4 }];
    const trees = generateTrees(planted);
    expect(trees.slice(0, 3).map((tree) => tree.position[0])).toEqual([15, 18, 21]);
  });
});
