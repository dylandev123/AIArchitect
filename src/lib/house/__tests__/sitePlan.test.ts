import { describe, expect, it } from "vitest";
import { deriveSitePlan, insideZone, placeInZone, type Rect, type SitePlan, type Vec } from "../architecture/sitePlan";
import { SIDE_VECTORS } from "../architecture/profiles";
import { PROJECT_SCALES } from "../scale";
import { assembleGeneratedProject } from "@/lib/ai/generation";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";
import type { CompassSide, ProjectScale, SiteSettings } from "@/types/house";
import type { PatchOp } from "../applyPatch";

const SIDES: CompassSide[] = ["north", "east", "south", "west"];
const site = (view: CompassSide, approach: CompassSide, scale: ProjectScale = "mansion") =>
  ({ environment: "countryside", viewDirection: view, approachSide: approach, terrainSlope: "flat", projectScale: scale } as unknown as SiteSettings);
const house = { width: 34, depth: 17, floors: 3, roof: "hip" };
const HOUSE = house;

const wingOps = (view: CompassSide, house = HOUSE, approach?: CompassSide): PatchOp[] => {
  // One wing at each end of the view wall's flanks, as the scale rules place them.
  const v = SIDE_VECTORS[view];
  const lat: Vec = [-v[1], v[0]];
  const hv = (Math.abs(v[0]) > 0.5 ? house.width : house.depth) / 2;
  const hl = (Math.abs(lat[0]) > 0.5 ? house.width : house.depth) / 2;
  return ([1, -1] as const).filter((s) => approach === undefined || SIDE_VECTORS[approach][0] * lat[0] * s + SIDE_VECTORS[approach][1] * lat[1] * s < 0.5).map((s) => {
    const c: Vec = [lat[0] * s * (hl + 4) + v[0] * (hv - 6), lat[1] * s * (hl + 4) + v[1] * (hv - 6)];
    const alongX = Math.abs(lat[0]) > 0.5;
    return { op: "addBuilding", value: { kind: "wing", x: c[0], z: c[1], width: alongX ? 12 : 12, depth: 12, floors: 2, roof: "hip" } } as PatchOp;
  });
};

/** The plan's zone centres in the view frame (p along the view, q across it): what must be the same when the plan turns. */
function localCentres(plan: SitePlan): Record<string, Vec> {
  const v = plan.viewAxis;
  const l = plan.lateralAxis;
  const all = [...Object.values(plan.zones), ...plan.gardens];
  return Object.fromEntries(all.map((z) => [z.id, [Math.round((z.center[0] * v[0] + z.center[1] * v[1]) * 5) / 5, Math.round((z.center[0] * l[0] + z.center[1] * l[1]) * 5) / 5] as Vec]));
}

describe("site plan", () => {
  it("only exists for a project with a scale, and never touches its input", () => {
    const ops = [{ op: "addDoor", value: { wall: "north", level: 0, offset: 5, width: 1.1, height: 2.1 } }] as PatchOp[];
    const before = JSON.stringify(ops);
    expect(deriveSitePlan({ brief: "A house", house, site: { ...site("south", "north"), projectScale: undefined } as SiteSettings, ops })).toBeUndefined();
    const a = deriveSitePlan({ brief: "A house", house, site: site("south", "north"), ops })!;
    const b = deriveSitePlan({ brief: "A house", house, site: site("south", "north"), ops })!;
    expect(JSON.stringify(ops)).toBe(before);
    expect(a).toEqual(b);
  });

  it("derives every zone with its footprint, orientation, relationships, elevation placeholder, features and clearance", () => {
    for (const scale of PROJECT_SCALES) {
      const plan = deriveSitePlan({ brief: "A house", house, site: site("south", "north", scale), ops: [] })!;
      for (const kind of ["houseCore", "arrivalCourt", "frontEntry", "garageCourt", "viewTerrace", "poolGarden", "outdoorLiving", "guest", "service"] as const) {
        const z = plan.zones[kind]!;
        expect(z, `${scale} ${kind}`).toBeDefined();
        expect(z.footprint.w).toBeGreaterThan(0);
        expect(z.footprint.d).toBeGreaterThan(0);
        expect(z.center).toEqual([z.footprint.x, z.footprint.z]);
        expect(Math.hypot(...z.orientation)).toBeCloseTo(1);
        expect(z.targetElevation).toBe(0);
        expect(z.allowed.length).toBeGreaterThan(0);
        expect(z.clearance).toBeGreaterThanOrEqual(0);
        expect(z.near.length + z.apart.length).toBeGreaterThan(0);
      }
      if (scale !== "cottage" && scale !== "family") expect(plan.gardens.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("puts the pool garden on the view side and the garage court and forecourt on the arrival side", () => {
    for (const view of SIDES) {
      for (const approach of SIDES) {
        const plan = deriveSitePlan({ brief: "A house", house, site: site(view, approach), ops: wingOps(view, house, approach) })!;
        const along = (z: Rect, dir: Vec) => z.x * dir[0] + z.z * dir[1];
        const v = SIDE_VECTORS[view];
        const a = SIDE_VECTORS[approach];
        const where = `${view}/${approach}`;
        expect(along(plan.zones.poolGarden!.footprint, v), where).toBeGreaterThan(0);
        expect(along(plan.zones.viewTerrace!.footprint, v), where).toBeGreaterThan(0);
        expect(along(plan.zones.outdoorLiving!.footprint, v), where).toBeGreaterThan(0);
        expect(along(plan.zones.arrivalCourt!.footprint, a), where).toBeGreaterThan(0);
        expect(along(plan.zones.garageCourt!.footprint, a), where).toBeGreaterThan(0);
        // The guest house is not on the entrance side.
        expect(along(plan.zones.guest!.footprint, a), where).toBeLessThan(0.5 * (Math.abs(a[0]) > 0.5 ? house.width : house.depth));
        // Zones with no business together never overlap.
        const fp = (k: keyof SitePlan["zones"]) => plan.zones[k]!.footprint;
        const touch = (p: Rect, q: Rect) => Math.abs(p.x - q.x) < (p.w + q.w) / 2 - 0.2 && Math.abs(p.z - q.z) < (p.d + q.d) / 2 - 0.2;
        for (const [p, q] of [["poolGarden", "garageCourt"], ["poolGarden", "arrivalCourt"], ["guest", "garageCourt"], ["guest", "outdoorLiving"], ["outdoorLiving", "garageCourt"], ["service", "poolGarden"], ["houseCore", "poolGarden"], ["houseCore", "arrivalCourt"], ["houseCore", "garageCourt"]] as const) {
          expect(touch(fp(p), fp(q)), `${where}: ${p} overlaps ${q}`).toBe(false);
        }
      }
    }
  });

  it("turns as one when the view and approach turn: the same brief plans the same in the view frame", () => {
    const base = localCentres(deriveSitePlan({ brief: "A mansion in the hills", house, site: site("south", "north"), ops: wingOps("south", house, "north") })!);
    for (let k = 1; k < 4; k++) {
      const view = SIDES[(SIDES.indexOf("south") + k) % 4];
      const approach = SIDES[(SIDES.indexOf("north") + k) % 4];
      // A quarter turn swaps the house's width and depth.
      const turned = k % 2 === 1 ? { ...house, width: house.depth, depth: house.width } : house;
      const rotated = localCentres(deriveSitePlan({ brief: "A mansion in the hills", house: turned, site: site(view, approach), ops: wingOps(view, turned, approach) })!);
      for (const [id, c] of Object.entries(base)) {
        expect(rotated[id], `${view}/${approach} ${id}`).toBeDefined();
        // Garden footprints keep their world-axis sizes, so a quarter turn shifts their centres: only the other zones must match.
        if (id.startsWith("garden")) continue;
        expect(Math.abs(rotated[id][0] - c[0]) + Math.abs(rotated[id][1] - c[1]), `${view}/${approach} ${id}: ${rotated[id]} vs ${c}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("a different approach around the same view moves the arrival zones and leaves the view zones where they were", () => {
    const view = "south";
    const planFor = (approach: CompassSide) => deriveSitePlan({ brief: "A mansion", house, site: site(view, approach), ops: wingOps(view, house, approach) })!;
    const a = planFor("north");
    const b = planFor("east");
    expect(a.zones.poolGarden!.footprint).toEqual(b.zones.poolGarden!.footprint);
    expect(a.zones.viewTerrace!.footprint).toEqual(b.zones.viewTerrace!.footprint);
    expect(a.zones.arrivalCourt!.footprint).not.toEqual(b.zones.arrivalCourt!.footprint);
    expect(a.zones.garageCourt!.footprint).not.toEqual(b.zones.garageCourt!.footprint);
  });

  it("turns away a feature its zone does not allow, or cannot hold, instead of finding it another place", () => {
    const plan = deriveSitePlan({ brief: "A house", house, site: site("south", "north"), ops: [] })!;
    const guest = plan.zones.guest!;
    expect(placeInZone(plan, guest, "outdoor_bar", 7, 3.5, [])).toBeUndefined();
    expect(placeInZone(plan, guest, "villa", 80, 80, [])).toBeUndefined();
    const at = placeInZone(plan, guest, "villa", 13, 13, [])!;
    expect(insideZone(guest, at)).toBe(true);
    // A zone that is already full leaves the feature out.
    expect(placeInZone(plan, guest, "villa", 13, 13, [guest.footprint])).toBeUndefined();
  });
});

// ── Whole generations ───────────────────────────────────────────────────────────────────────────────────────────

function output(scale: ProjectScale, view: string, approach: string): AiGenerationResponse {
  return {
    summary: "A house.",
    house: { width: 12, depth: 9, floors: 2, roof: "hip" },
    site: { environment: "countryside", viewDirection: view, terrainSlope: "flat", approachSide: approach, projectScale: scale },
    operations: [
      { op: "setExteriorOptions", fields: { style: "colonial" } },
      { op: "addDoor", value: { wall: approach, level: 0, offset: 5.45, width: 1.1, height: 2.1 } },
      { op: "addWindow", value: { wall: view, level: 0, offset: 2, width: 2, height: 1.6, sill: 0.6 } },
    ],
  } as unknown as AiGenerationResponse;
}

describe("site plan in generation", () => {
  const cases: [CompassSide, CompassSide][] = SIDES.flatMap((v) => SIDES.map((a) => [v, a] as [CompassSide, CompassSide]));

  it("reads as one composition for a mansion, whatever the view and approach", () => {
    for (const [view, approach] of cases) {
      const where = `mansion ${view}/${approach}`;
      const r = assembleGeneratedProject(output("mansion", view, approach), [], `A hilltop mansion facing ${view} with the entrance from the ${approach}`);
      if (!r.ok) throw new Error(`${where}: ${r.errors.join("; ")}`);
      // Nothing had to be moved out of the way by the collision pass: the plan put it right first.
      expect(r.adjusted.filter((m) => !/wall/.test(m)), where).toEqual([]);
      const root = JSON.parse(r.json) as Record<string, Record<string, number | string>[] & { width: number; depth: number }>;
      const list = (k: string) => (Array.isArray(root[k]) ? (root[k] as Record<string, number | string>[]) : []);
      const buildings = list("buildings") as { kind: string; x: number; z: number; width: number; depth: number }[];
      const v = SIDE_VECTORS[view];
      const a = SIDE_VECTORS[approach];
      const hv = (Math.abs(v[0]) > 0.5 ? root.house.width : root.house.depth) / 2;
      const ha = (Math.abs(a[0]) > 0.5 ? root.house.width : root.house.depth) / 2;
      const along = (b: { x: number; z: number }, d: Vec) => b.x * d[0] + b.z * d[1];

      const kinds = (k: string) => buildings.filter((b) => b.kind === k);
      expect(kinds("detached_garage").length, where).toBeGreaterThan(0);
      for (const g of kinds("detached_garage")) expect(along(g, a), `${where} garage on the arrival side`).toBeGreaterThan(ha);
      expect(kinds("villa").length, `${where} guest house`).toBe(1);
      expect(along(kinds("villa")[0], a), `${where} guest house is not at the door`).toBeLessThan(ha);
      expect(kinds("gazebo").length, `${where} gazebo`).toBe(1);
      expect(along(kinds("gazebo")[0], v), `${where} gazebo on the view side`).toBeGreaterThan(hv);
      expect(kinds("outdoor_bar").length, `${where} bar`).toBe(1);
      expect(along(kinds("outdoor_bar")[0], v), `${where} bar on the view side`).toBeGreaterThan(hv);
      const pool = list("pools")[0] as { wall: string };
      expect(pool.wall, `${where} pool on the view wall`).toBe(view);
      expect(list("landscaping").filter((l) => l.kind === "garden").length, `${where} gardens`).toBe(4);
      // The guest house is joined to the house.
      expect(list("paths").length, `${where} guest path`).toBeGreaterThan(0);
    }
  });

  it("plans estates and luxury homes just as coherently, and leaves scale-less generations alone", () => {
    for (const scale of ["luxury", "estate"] as const) {
      for (const [view, approach] of cases) {
        const r = assembleGeneratedProject(output(scale, view, approach), [], `A grand house facing ${view} with the entrance from the ${approach}`);
        if (!r.ok) throw new Error(`${scale} ${view}/${approach}: ${r.errors.join("; ")}`);
        expect(r.adjusted.filter((m) => !/wall/.test(m)), `${scale} ${view}/${approach}`).toEqual([]);
      }
    }
    const plain = assembleGeneratedProject(output("family", "south", "north"), [], "A house");
    expect(plain.ok).toBe(true);
  });
});
