import { describe, expect, it } from "vitest";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { collectOccupiedFootprints, isInsideAnyFootprint } from "../footprints";
import { generateGrassTufts } from "../grass";
import { generateTrees } from "../trees";

function siteOf(extra: Record<string, unknown>) {
  const json = JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "gable" }, ...extra });
  const { site } = generateHouseFromJson(json);
  if (!site) throw new Error("no site");
  return site;
}

describe("occupied footprints", () => {
  it("covers a deck, a porch and stairs, so nothing is planted on them", () => {
    const site = siteOf({
      decks: [{ x: 14, z: 0, level: 0, width: 6, depth: 6 }],
      porches: [{ wall: "south", offset: 4, width: 4, depth: 2.5 }],
      stairs: [{ wall: "north", offset: 4, width: 2, rise: 0.6, form: "straight", turn: "left" }],
    });
    const fps = collectOccupiedFootprints(site);
    expect(isInsideAnyFootprint(14, 0, fps)).toBe(true);
    expect(isInsideAnyFootprint(0, 5 + 2, fps)).toBe(true); // porch, south of the house
    expect(isInsideAnyFootprint(0, -(5 + 1.5), fps)).toBe(true); // stair run, north of the house
  });

  it("turns a building's footprint with its rotation", () => {
    // 12 wide × 4 deep, turned a quarter: it now runs north-south.
    const site = siteOf({ buildings: [{ kind: "shed", x: 30, z: 0, width: 12, depth: 4, floors: 1, roof: "gable", rotation: 90 }] });
    const fps = collectOccupiedFootprints(site);
    expect(isInsideAnyFootprint(30, 5.5, fps)).toBe(true);
    expect(isInsideAnyFootprint(30, -5.5, fps)).toBe(true);
    expect(isInsideAnyFootprint(35.5, 0, fps)).toBe(false);
  });

  it("keeps grass and trees off every structure", () => {
    const site = siteOf({
      decks: [{ x: 12, z: 2, level: 0, width: 7, depth: 5 }],
      buildings: [{ kind: "shed", x: -14, z: 4, width: 9, depth: 3, floors: 1, roof: "gable", rotation: 90 }],
    });
    const fps = collectOccupiedFootprints(site);
    for (const t of generateGrassTufts(site)) expect(isInsideAnyFootprint(t.position[0], t.position[1], fps)).toBe(false);
    for (const t of generateTrees(site)) expect(isInsideAnyFootprint(t.position[0], t.position[1], fps)).toBe(false);
  });
});
