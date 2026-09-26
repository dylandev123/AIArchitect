import { describe, expect, it } from "vitest";
import { applyPatch, type PatchOp } from "../applyPatch";
import { findSiteCollisions, resolveSiteCollisions } from "../architecture/siteCollisions";
import { assembleGeneratedProject } from "@/lib/ai/generation";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";

type Rec = Record<string, unknown>;

const HOUSE = { width: 12, depth: 9 };
const building = (kind: string, x: number, z: number, width: number, depth: number, extra: Rec = {}): PatchOp => ({
  op: "addBuilding",
  value: { kind, x, z, width, depth, floors: 1, roof: "gable", ...extra },
});
const sitePool = (x: number, z: number, width = 8, depth = 4): PatchOp => ({ op: "addPool", value: { wall: "south", offset: 0, distance: 0, width, depth, waterDepth: 1.5, siteX: x, siteZ: z } });
const drive = (wall: string, offset: number, length: number, width = 3.5): PatchOp => ({ op: "addDriveway", value: { wall, offset, width, length } });

/** Applies ops to a project and returns the JSON, so the committed result can be checked the way the last gate does. */
const commit = (ops: PatchOp[], base: Rec = { house: { ...HOUSE, floors: 2, roof: "gable" } }) => JSON.parse(applyPatch(JSON.stringify(base), ops).json) as Rec;
const at = (ops: readonly PatchOp[], i: number) => ops[i].value as Rec;

describe("resolveSiteCollisions", () => {
  it("leaves a design with no overlaps exactly as it is", () => {
    const ops = [building("gazebo", 0, 20, 5, 5), sitePool(0, 30), building("villa", 30, 0, 8, 7)];
    const result = resolveSiteCollisions({ house: HOUSE, ops });
    expect(result.errors).toEqual([]);
    expect(result.relocated).toEqual([]);
    expect(result.ops).toEqual(ops);
  });

  it("rejects building-on-building overlap by moving the lower-priority building, never the house's guest house", () => {
    const guest = building("villa", 20, 0, 9, 8);
    const gazebo = building("gazebo", 21, 1, 5, 5);
    const result = resolveSiteCollisions({ house: HOUSE, ops: [guest, gazebo] });
    expect(result.errors).toEqual([]);
    expect(result.ops[0]).toEqual(guest); // the higher-priority building stays put
    expect(result.ops[1]).not.toEqual(gazebo);
    expect(findSiteCollisions(commit(result.ops))).toEqual([]);
  });

  it("keeps a building out of the house and out of the pool", () => {
    const result = resolveSiteCollisions({ house: HOUSE, ops: [sitePool(0, 14), building("villa", 0, 0, 8, 7), building("shed", 0, 14, 4, 3.5)] });
    expect(result.errors).toEqual([]);
    const root = commit(result.ops);
    expect(findSiteCollisions(root)).toEqual([]);
    // The pool did not move for them.
    expect((root.pools as Rec[])[0]).toMatchObject({ siteX: 0, siteZ: 14 });
  });

  it("keeps the bar by the pool when it has to move", () => {
    const pool = sitePool(0, 14);
    const bar = building("outdoor_bar", 1, 14, 7, 3.5, { roof: "flat" });
    const result = resolveSiteCollisions({ house: HOUSE, ops: [pool, bar] });
    expect(result.errors).toEqual([]);
    expect(result.relocated).toHaveLength(1);
    const moved = at(result.ops, 1);
    // Clear of the pool, and still within a few metres of its edge (not banished to the far side of the site).
    expect(findSiteCollisions(commit(result.ops))).toEqual([]);
    const edgeGap = Math.hypot(Math.max(0, Math.abs((moved.x as number) - 0) - (7 + 8.8) / 2), Math.max(0, Math.abs((moved.z as number) - 14) - (3.5 + 4.8) / 2));
    expect(edgeGap).toBeLessThanOrEqual(10);
  });

  it("keeps a garage row on its drive, sliding it along the drive rather than off it", () => {
    // A drive north from the house, a two-bay garage beside it with its apron, and a pool dropped onto the row.
    const ops: PatchOp[] = [
      drive("north", 4, 30),
      building("detached_garage", 6.9, -13, 6.8, 6.4, { rotation: 90 }),
      building("detached_garage", 6.9, -19.8, 6.8, 6.4, { rotation: 90 }),
      { op: "addParking", value: { x: 3.45, z: -16, width: 4.6, depth: 13.6, stripes: false } },
      sitePool(8, -16, 5, 10),
    ];
    const result = resolveSiteCollisions({ house: HOUSE, ops });
    expect(result.errors).toEqual([]);
    const root = commit(result.ops);
    expect(findSiteCollisions(root)).toEqual([]);
    // Both bays and the apron moved by the same amount along the drive (z), and none across it.
    const dz = (i: number) => (at(result.ops, i).z as number) - (at(ops, i).z as number);
    const dx = (i: number) => (at(result.ops, i).x as number) - (at(ops, i).x as number);
    expect(Math.abs(dz(1))).toBeGreaterThan(0);
    expect(dz(1)).toBeCloseTo(dz(2), 5);
    expect(dz(1)).toBeCloseTo(dz(3), 5);
    expect(dx(1)).toBe(0);
    // The drive itself and the pool did not move.
    expect(result.ops[0]).toEqual(ops[0]);
  });

  it("makes a retaining wall stop short of the drive instead of dragging it off the site", () => {
    const wall: PatchOp = { op: "addRetainingWall", value: { x1: -12, z1: -14, x2: 12, z2: -14, height: 1.5, thickness: 0.45, bend: 0 } };
    const ops = [drive("north", 4, 30), wall];
    const result = resolveSiteCollisions({ house: HOUSE, ops });
    expect(result.errors).toEqual([]);
    const walls = result.ops.filter((op) => op.op === "addRetainingWall").map((op) => op.value as Rec);
    expect(walls).toHaveLength(2);
    expect(Math.min(...walls.flatMap((w) => [w.x1, w.x2] as number[]))).toBe(-12); // outer ends stay where they were
    expect(Math.max(...walls.flatMap((w) => [w.x1, w.x2] as number[]))).toBe(12);
    expect(walls.every((w) => w.z1 === -14 && w.z2 === -14)).toBe(true);
    // The extra section is a new feature: it carries no id, so applyPatch gives it its own.
    expect("id" in walls[1]).toBe(false);
    expect(findSiteCollisions(commit(result.ops))).toEqual([]);
    expect(result.ops[0]).toEqual(ops[0]);
  });

  it("moves a river clear of a guest house rather than moving the guest house", () => {
    const villa = building("villa", 0, 20, 9, 8);
    const river: PatchOp = { op: "addWaterway", value: { kind: "river", x1: -60, z1: 20, x2: 60, z2: 20, width: 7, bend: 0, meander: 0.3 } };
    const result = resolveSiteCollisions({ house: HOUSE, ops: [villa, river] });
    expect(result.errors).toEqual([]);
    expect(result.ops[0]).toEqual(villa);
    expect(result.ops[1]).not.toEqual(river);
    expect(findSiteCollisions(commit(result.ops))).toEqual([]);
  });

  it("slides a wall-anchored pool along its wall to keep its place in front of the house", () => {
    const patio: PatchOp = { op: "addPatio", value: { wall: "south", offset: 0, width: 4, depth: 3 } };
    const pool: PatchOp = { op: "addPool", value: { wall: "south", offset: 1, distance: 3.5, width: 6, depth: 4, waterDepth: 1.5 } };
    const gar: PatchOp = { op: "addGarage", value: { wall: "south", offset: 0, width: 5, depth: 6, height: 2.6 } };
    const wide = { width: 24, depth: 9 };
    const result = resolveSiteCollisions({ house: wide, ops: [gar, patio, pool] });
    expect(result.errors).toEqual([]);
    expect(findSiteCollisions(commit(result.ops, { house: { ...wide, floors: 2, roof: "gable" } }))).toEqual([]);
    // Still measured from the house wall, not re-anchored to site coordinates.
    expect(at(result.ops, 2).siteX).toBeUndefined();
    expect(at(result.ops, 2).distance).toBe(3.5);
  });

  it("reports a validation error when a feature has nowhere to go", () => {
    const result = resolveSiteCollisions({ house: HOUSE, ops: [building("villa", 0, 0, 110, 110)] });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/villa 1 overlaps house/);
    expect(result.errors[0]).toMatch(/no clear position/);
  });

  it("never touches ops that are not ground features", () => {
    const ops: PatchOp[] = [{ op: "addWindow", value: { wall: "north", level: 0, offset: 1, width: 1, height: 1, sill: 1 } }, { op: "setMaterials", fields: {} }];
    const result = resolveSiteCollisions({ house: HOUSE, ops });
    expect(result.ops).toEqual(ops);
  });
});

describe("resolveSiteCollisions on an existing project", () => {
  const existing = (): Rec => ({
    house: { ...HOUSE, floors: 2, roof: "gable" },
    buildings: [
      { id: "b-1", kind: "villa", x: 25, z: 0, width: 9, depth: 8, floors: 1, roof: "gable" },
      // Already overlapping the first: a project saved that way stays that way.
      { id: "b-2", kind: "shed", x: 27, z: 1, width: 4, depth: 3.5, floors: 1, roof: "gable" },
    ],
    pools: [{ id: "p-1", wall: "south", offset: 2, distance: 3, width: 8, depth: 4, waterDepth: 1.5 }],
  });

  it("moves only what the edit adds, and leaves the project's own features (and their ids) alone", () => {
    const root = existing();
    const result = resolveSiteCollisions({ existing: root, ops: [building("gazebo", 25, 1, 5, 5)] });
    expect(result.errors).toEqual([]);
    expect(result.relocated).toHaveLength(1);
    const { json, errors } = applyPatch(JSON.stringify(root), result.ops);
    expect(errors).toEqual([]);
    const next = JSON.parse(json) as Rec;
    expect((next.buildings as Rec[]).slice(0, 2)).toEqual(root.buildings);
    expect(next.pools).toEqual(root.pools);
    expect((next.buildings as Rec[])).toHaveLength(3);
    // The new gazebo is clear of everything, existing overlaps aside.
    const errs = findSiteCollisions(next).filter((e) => e.includes("gazebo"));
    expect(errs).toEqual([]);
  });

  it("reads the house from the project, with the edit's own setHouse applied", () => {
    const root = existing();
    // A wider house now reaches where the gazebo was going.
    const ops: PatchOp[] = [{ op: "setHouse", fields: { width: 40 } }, building("gazebo", 21, 0, 5, 5)];
    const result = resolveSiteCollisions({ existing: root, ops });
    expect(result.errors).toEqual([]);
    expect(at(result.ops, 1)).not.toEqual(at(ops, 1));
  });

  it("does not treat a feature the same edit removes as an obstacle", () => {
    const root = existing();
    const ops: PatchOp[] = [{ op: "removeBuilding", id: "b-1" }, { op: "removeBuilding", id: "b-2" }, building("villa", 25, 0, 9, 8)];
    const result = resolveSiteCollisions({ existing: root, ops });
    expect(result.relocated).toEqual([]);
    expect(result.ops).toEqual(ops);
  });

  it("leaves an edit that adds no ground feature completely alone, whatever the project looks like", () => {
    const ops: PatchOp[] = [{ op: "updateBuilding", id: "b-1", fields: { floors: 2 } }, { op: "addWindow", value: { wall: "north", level: 0, offset: 1, width: 1, height: 1, sill: 1 } }];
    const result = resolveSiteCollisions({ existing: existing(), ops });
    expect(result.ops).toEqual(ops);
    expect(result.errors).toEqual([]);
  });
});

// ── The whole pipeline ──────────────────────────────────────────────────────────────────────────────────────────

function modelOutput(o: { scale: string; view: string; approach: string; env?: string; tier?: string; extra?: unknown[] }): AiGenerationResponse {
  const house = { width: 12, depth: 9, floors: 2, roof: "gable" };
  return {
    summary: "A house.",
    house,
    site: { environment: o.env ?? "countryside", viewDirection: o.view, terrainSlope: o.env === "hillside" ? "steep" : "flat", approachSide: o.approach, projectScale: o.scale, designTier: o.tier ?? "estate" },
    operations: [
      { op: "setExteriorOptions", fields: { style: "colonial" } },
      { op: "addDoor", value: { wall: o.approach, level: 0, offset: 5.45, width: 1.1, height: 2.1 } },
      ...(o.extra ?? []),
    ],
  } as AiGenerationResponse;
}

/** Ground rectangles read straight from the committed JSON, independent of the code under test (right angles only). */
interface Box { name: string; x: number; z: number; w: number; d: number }
function boxes(root: Rec): Box[] {
  const house = root.house as { width: number; depth: number };
  const list = (key: string) => (Array.isArray(root[key]) ? (root[key] as Rec[]) : []);
  const out: Box[] = [{ name: "house", x: 0, z: 0, w: house.width, d: house.depth }];
  for (const b of list("buildings")) {
    const turned = Math.abs(Math.sin((((b.rotation as number) ?? 0) * Math.PI) / 180)) > 0.5;
    out.push({ name: b.kind as string, x: b.x as number, z: b.z as number, w: (turned ? b.depth : b.width) as number, d: (turned ? b.width : b.depth) as number });
  }
  for (const p of list("pools")) {
    if (typeof p.siteX === "number") out.push({ name: "pool", x: p.siteX, z: p.siteZ as number, w: p.width as number, d: p.depth as number });
    else {
      const sign: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
      const [sx, sz] = sign[p.wall as string];
      const along = (p.offset as number) + (p.width as number) / 2;
      const out1 = (p.distance as number) + (p.depth as number) / 2;
      const ns = sx === 0;
      const cx = ns ? -house.width / 2 + along : sx * (house.width / 2 + out1);
      const cz = ns ? sz * (house.depth / 2 + out1) : -house.depth / 2 + along;
      out.push({ name: "pool", x: cx, z: cz, w: (ns ? p.width : p.depth) as number, d: (ns ? p.depth : p.width) as number });
    }
  }
  return out;
}
const overlapDepth = (a: Box, b: Box) => Math.min((a.w + b.w) / 2 - Math.abs(a.x - b.x), (a.d + b.d) / 2 - Math.abs(a.z - b.z));

const SIDES: [string, string][] = [["south", "north"], ["north", "south"], ["east", "west"], ["west", "east"], ["south", "east"], ["east", "north"]];
const BRIEFS = [
  "A house",
  "A riverside estate beside a river with rocky outcrops and a clearing",
  "A hillside mansion with terraced retaining walls, a guest house, a gazebo and an outdoor bar by the pool",
];

describe("generated estates and mansions", () => {
  it("contain no building-on-building or building-in-pool overlaps, and no collision the last gate can find", () => {
    for (const scale of ["luxury", "estate", "mansion"]) {
      for (const [view, approach] of SIDES) {
        for (const env of ["countryside", "hillside", "beach"]) {
          for (const brief of BRIEFS) {
            const result = assembleGeneratedProject(modelOutput({ scale, view, approach, env }), [], brief);
            const label = `${scale} ${view}/${approach} ${env} "${brief.slice(0, 24)}"`;
            if (!result.ok) throw new Error(`${label}: ${result.errors.join("; ")}`);
            const root = JSON.parse(result.json) as Rec;
            expect(findSiteCollisions(root), label).toEqual([]);
            const all = boxes(root);
            all.forEach((a, i) => all.slice(i + 1).forEach((b) => {
              // Wings are drawn a wall thickness into what they attach to; everything else must not overlap at all.
              const attached = (a.name === "house" || a.name === "wing") && (b.name === "house" || b.name === "wing");
              if (!attached) expect(overlapDepth(a, b), `${label}: ${a.name} and ${b.name} overlap`).toBeLessThanOrEqual(0.3);
            }));
          }
        }
      }
    }
  });

  it("repairs a model's overlapping placements without redesigning the rest", () => {
    const extra = [
      { op: "addBuilding", value: { kind: "villa", x: 0, z: 0, width: 8, depth: 7, floors: 1, roof: "gable" } },
      { op: "addBuilding", value: { kind: "gazebo", x: 0, z: 12, width: 5, depth: 5, floors: 1, roof: "hip" } },
      { op: "addBuilding", value: { kind: "outdoor_bar", x: 3, z: 14, width: 7, depth: 3.5, floors: 1, roof: "flat" } },
      { op: "addPool", value: { wall: "south", offset: 2, distance: 3, width: 8, depth: 4, waterDepth: 1.5 } },
    ];
    for (const scale of ["estate", "mansion"]) {
      const result = assembleGeneratedProject(modelOutput({ scale, view: "south", approach: "north", extra }), [], "A house with a guest house, gazebo and outdoor bar by the pool");
      if (!result.ok) throw new Error(result.errors.join("; "));
      expect(result.adjusted.length).toBeGreaterThan(0);
      const root = JSON.parse(result.json) as Rec;
      expect(findSiteCollisions(root)).toEqual([]);
      const all = boxes(root);
      const near = (a: Box, b: Box) => Math.hypot(a.x - b.x, a.z - b.z);
      const pool = all.find((b) => b.name === "pool")!;
      const bar = all.find((b) => b.name === "outdoor_bar")!;
      const gazebo = all.find((b) => b.name === "gazebo")!;
      // The bar and gazebo are still at the pool, not scattered across the site.
      expect(near(bar, pool), `${scale} bar`).toBeLessThan(25);
      expect(near(gazebo, pool), `${scale} gazebo`).toBeLessThan(30);
      // Every ground feature that came out is one the design asked for: ids were assigned once and are unique.
      const ids = ["buildings", "pools", "patios", "driveways", "parking", "retainingWalls", "waterways"].flatMap((k) => ((root[k] as Rec[]) ?? []).map((i) => i.id as string));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("puts each detached garage on the drive: its apron or its doors meet the driveway", () => {
    for (const [view, approach] of SIDES) {
      const result = assembleGeneratedProject(modelOutput({ scale: "mansion", view, approach }), [], "A hillside mansion with terraced retaining walls");
      if (!result.ok) throw new Error(result.errors.join("; "));
      const root = JSON.parse(result.json) as Rec;
      const drives = (root.driveways as Rec[]) ?? [];
      const garages = ((root.buildings as Rec[]) ?? []).filter((b) => b.kind === "detached_garage");
      expect(drives.length).toBeGreaterThan(0);
      expect(garages.length).toBeGreaterThan(0);
      const wallDir: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
      const house = root.house as { width: number; depth: number };
      const d = drives[0];
      const [dx, dz] = wallDir[d.wall as string];
      const half = dx === 0 ? house.depth / 2 : house.width / 2;
      const along = (p: Rec) => ((p.x as number) * dx + (p.z as number) * dz) - half;
      const lateral = (p: Rec) => Math.abs((dx === 0 ? (p.x as number) + house.width / 2 : (p.z as number) + house.depth / 2) - ((d.offset as number) + (d.width as number) / 2));
      for (const g of garages) {
        // Within the drive's run, and within a garage-apron of its edge.
        expect(along(g), `${view}/${approach} garage along drive`).toBeGreaterThan(0);
        expect(along(g), `${view}/${approach} garage along drive`).toBeLessThanOrEqual((d.length as number) + 1);
        expect(lateral(g) - (d.width as number) / 2, `${view}/${approach} garage beside drive`).toBeLessThan(14);
      }
    }
  });
});
