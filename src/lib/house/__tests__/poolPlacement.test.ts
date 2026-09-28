import { describe, expect, it } from "vitest";
import type { CompassSide } from "@/types/house";
import { assembleVilla, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { briefAllowsFrontPool, describePlacement, poolCentre, reseatPools, sideOfPoint } from "../architecture/poolPlacement";
import type { PatchOp } from "../applyPatch";

const SIDES: CompassSide[] = ["north", "east", "south", "west"];
const OPPOSITE: Record<CompassSide, CompassSide> = { north: "south", south: "north", east: "west", west: "east" };

/** A pool the model hung on `wall`, or set free at a site point. */
const wallPool = (wall: CompassSide) => ({ op: "addPool", value: { wall, offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } });
const freePool = (x: number, z: number) => ({ op: "addPool", value: { wall: "north", offset: 0, distance: 3, width: 10, depth: 5, waterDepth: 1.5, siteX: x, siteZ: z } });
const frontPoint = (approach: CompassSide): [number, number] => ({ north: [4, -14], south: [4, 14], east: [16, 2], west: [-16, 2] }[approach] as [number, number]);

const placement = (json: string, brief = VILLA_BRIEF) => describePlacement(json, brief)!;

describe("the pool belongs on the private side", () => {
  // Every arrival/view pairing the site settings can produce (the entrance never faces the view).
  const combos = SIDES.flatMap((view) => SIDES.filter((approach) => approach !== view).map((approach) => ({ view, approach })));

  it.each(combos)("view $view / arrival $approach: a pool hung on the entrance wall is set on the view side", ({ view, approach }) => {
    const { json } = assembleVilla({ view, approach, ops: [wallPool(approach)] });
    const p = placement(json);
    expect(p.pools).toHaveLength(1);
    expect(p.pools[0].side).not.toBe("arrival");
    expect(p.issues).toEqual([]);
  });

  it.each(combos)("view $view / arrival $approach: a pool set free in the front court is set on the view side", ({ view, approach }) => {
    const { json } = assembleVilla({ view, approach, ops: [freePool(...frontPoint(approach))] });
    const p = placement(json);
    expect(p.pools[0].side).not.toBe("arrival");
    expect(p.issues).toEqual([]);
  });

  it.each(combos)("view $view / arrival $approach: with no pool authored, the one added is private and the garage is on the arrival side", ({ view, approach }) => {
    const villa = assembleVilla({ view, approach });
    const { json } = villa;
    // The rules place the pool on the private side themselves: nothing had to be corrected.
    expect(villa.notes).toEqual([]);
    const p = placement(json);
    expect(p.pools.length).toBeGreaterThan(0);
    expect(p.pools.every((x) => x.side !== "arrival")).toBe(true);
    expect(p.garages.length).toBeGreaterThan(0);
    expect(p.garages.every((g) => g.side === "arrival")).toBe(true);
    expect(p.issues).toEqual([]);
  });

  it("keeps a pool that is already on the view side exactly where the model put it", () => {
    const { json } = assembleVilla({ ops: [wallPool("south")] });
    const pools = (JSON.parse(json) as { pools: { wall: string; offset: number }[] }).pools;
    expect(pools).toHaveLength(1);
    expect(pools[0].wall).toBe("south");
  });

  it("puts the villa's pool, dining and garages where the brief implies on the validation site", () => {
    const { json } = assembleVilla({ view: "south", approach: "north", ops: [wallPool("north")] });
    const root = JSON.parse(json) as { pools: { wall: string; siteZ?: number }[]; driveways: { wall: string }[]; buildings: { kind: string; z: number }[] };
    expect(root.driveways[0].wall).toBe("north");
    const pool = root.pools[0];
    // South is the view: the pool's wall, or its site position, is on the south side of the house (positive z).
    expect(pool.wall === "south" || (pool.siteZ ?? 0) > 0).toBe(true);
    for (const garage of root.buildings.filter((b) => b.kind === "detached_garage")) expect(garage.z).toBeLessThan(0);
  });

  it("does not reseat a pool the brief puts at the entrance on purpose", () => {
    const brief = `${VILLA_BRIEF} A reflecting pool in the forecourt.`;
    expect(briefAllowsFrontPool(brief)).toBe(true);
    const { json } = assembleVilla({ ops: [freePool(...frontPoint("north"))] }, brief);
    expect(placement(json, brief).pools[0].side).toBe("arrival");
    expect(placement(json, brief).issues).toEqual([]);
  });
});

describe("pool placement across scales", () => {
  it.each([["estate"], ["mansion"]])("a %s keeps its pool private however the model set it", (scale) => {
    const brief = `A ${scale} villa. ${VILLA_BRIEF}`;
    for (const ops of [[wallPool("north")], [freePool(...frontPoint("north"))], []]) {
      const { json } = assembleVilla({ ops }, brief);
      expect(placement(json, brief).issues).toEqual([]);
    }
  });

  it("puts the pool toward the view on a hillside/ocean site facing another way", () => {
    for (const view of ["east", "west"] as const) {
      const { json } = assembleVilla({ view, approach: OPPOSITE[view], environment: "hillside", ops: [wallPool(OPPOSITE[view])] }, `${VILLA_BRIEF} On a steep hillside overlooking the ocean.`);
      const p = placement(json, VILLA_BRIEF);
      expect(p.viewSide).toBe(view);
      expect(p.pools[0].side).not.toBe("arrival");
    }
  });
});

describe("reseatPools", () => {
  const house = { width: 20, depth: 12, floors: 2, roof: "flat" };
  const site = { viewDirection: "south", approachSide: "north" } as const;
  const op = (value: Record<string, unknown>): PatchOp => ({ op: "addPool", value });

  it("re-seats a misplaced pool and reports it", () => {
    const { ops, notes } = reseatPools({ house, site, brief: "", ops: [op({ wall: "north", offset: 3, distance: 4, width: 8, depth: 4 })] });
    expect(ops).toHaveLength(1);
    expect((ops[0].value as { wall: string }).wall).toBe("south");
    expect(notes[0]).toMatch(/arrival side/);
  });

  it("drops an extra pool on the arrival side when a good one exists", () => {
    const { ops, notes } = reseatPools({ house, site, brief: "", ops: [op({ wall: "south", offset: 4, distance: 3, width: 8, depth: 4 }), op({ wall: "north", offset: 3, distance: 4, width: 4, depth: 3 })] });
    expect(ops).toHaveLength(1);
    expect(notes.join(" ")).toMatch(/left out/);
  });

  it("leaves everything alone when there is nothing to fix", () => {
    const input = [op({ wall: "south", offset: 4, distance: 3, width: 8, depth: 4 })];
    expect(reseatPools({ house, site, brief: "", ops: input })).toEqual({ ops: input, notes: [] });
  });

  it("reads which side a point is on", () => {
    expect(sideOfPoint(house, site, [0, -15])).toBe("arrival");
    expect(sideOfPoint(house, site, [0, 12])).toBe("view");
    expect(sideOfPoint(house, site, [0, -2])).toBe("flank");
    // A pool at the corner of the private terrace is on the view side even when the entrance is on that flank.
    expect(sideOfPoint(house, { viewDirection: "south", approachSide: "east" }, [9, 12])).toBe("view");
    expect(sideOfPoint(house, { viewDirection: "south", approachSide: "east" }, [16, 0])).toBe("arrival");
    expect(poolCentre(house, { wall: "south", offset: 4, distance: 3, width: 8, depth: 4 })).toEqual([-2, 11]);
    // When the entrance and the view share a side there is no separate arrival side to keep the pool off.
    expect(sideOfPoint(house, { viewDirection: "south", approachSide: "south" }, [0, 12])).toBe("view");
  });
});
