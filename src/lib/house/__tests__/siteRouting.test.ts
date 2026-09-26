import { describe, expect, it } from "vitest";
import { assembleGeneratedProject } from "@/lib/ai/generation";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";
import type { CompassSide, ProjectScale, SiteSettings } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { outbuildingFor } from "../architecture/generationRules";
import { SIDE_VECTORS } from "../architecture/profiles";
import { planScale } from "../architecture/scaleRules";
import { deriveSitePlan, insideZone, type SitePlan } from "../architecture/sitePlan";
import type { Rect, Vec } from "../architecture/siteGeometry";
import { retainingWallCurve } from "../features/retainingWalls";
import { PROJECT_SCALES, SCALE_PROFILES } from "../scale";

/**
 * Stage 1, routing: every exterior feature a generation places (style outbuildings, tier extras, terrain, and buildings
 * the model wrote itself) goes through the site plan when the project has a scale, and a project without one is left on
 * its legacy offsets.
 */

type Rec = Record<string, unknown>;
type Root = Record<string, Rec[]> & { house: { width: number; depth: number; floors: number; roof: string }; site: SiteSettings };

const SIDES: CompassSide[] = ["north", "east", "south", "west"];
const PAIRS: [CompassSide, CompassSide][] = SIDES.flatMap((v) => SIDES.filter((a) => a !== v).map((a) => [v, a] as [CompassSide, CompassSide]));

interface Options { scale?: ProjectScale; style?: string; tier?: string; view: CompassSide; approach: CompassSide; brief?: string; extra?: unknown[]; door?: boolean; environment?: string }

/** A house inside the scale's own envelope, so the shell is not refitted and the coordinates a test writes stay where they were put. */
function houseFor(scale?: ProjectScale) {
  if (!scale) return { width: 14, depth: 9, floors: 2, roof: "gable" };
  const { width, depth } = SCALE_PROFILES[scale].footprint;
  const mid = (r: readonly [number, number]) => Math.round(((r[0] + r[1]) / 2) * 2) / 2;
  return { width: mid(width), depth: mid(depth), floors: SCALE_PROFILES[scale].floors[0], roof: "gable" };
}

function generate(o: Options) {
  const out = {
    summary: "A house.",
    house: houseFor(o.scale),
    site: { environment: o.environment ?? "countryside", viewDirection: o.view, terrainSlope: "gentle", approachSide: o.approach, ...(o.scale ? { projectScale: o.scale } : {}), ...(o.tier ? { designTier: o.tier } : {}) },
    operations: [
      ...(o.style ? [{ op: "setExteriorOptions", fields: { style: o.style } }] : []),
      ...(o.door === false ? [] : [{ op: "addDoor", value: { wall: o.approach, level: 0, offset: 5, width: 1.1, height: 2.1 } }]),
      ...(o.extra ?? []),
    ],
  } as unknown as AiGenerationResponse;
  const result = assembleGeneratedProject(out, [], o.brief ?? "A house", true);
  if (!result.ok) throw new Error(`${o.scale}/${o.style}/${o.view}/${o.approach}: ${result.errors.join("; ")}`);
  return { result, root: JSON.parse(result.json) as Root };
}

/** The plan the design was made on, derived again from what came out (the house, its wings, the drive, the garage and the door). */
function planOf(root: Root, brief = "A house"): SitePlan {
  const keep: Record<string, string> = { doors: "addDoor", garages: "addGarage", driveways: "addDriveway" };
  const ops: PatchOp[] = [];
  for (const [key, op] of Object.entries(keep)) for (const v of root[key] ?? []) ops.push({ op, value: v } as PatchOp);
  for (const b of root.buildings ?? []) if (b.kind === "wing") ops.push({ op: "addBuilding", value: b } as PatchOp);
  return deriveSitePlan({ brief, house: root.house, site: root.site, ops })!;
}

const rectOf = (b: Rec): Rect => {
  const r = Number(b.rotation ?? 0);
  const quarter = Math.abs(Math.round(r / 90)) % 2 === 1;
  return { x: Number(b.x), z: Number(b.z), w: quarter ? Number(b.depth) : Number(b.width), d: quarter ? Number(b.width) : Number(b.depth) };
};
const of = (root: Root, kind: string) => (root.buildings ?? []).filter((b) => b.kind === kind);
const hit = (a: Rect, b: Rect, margin = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin;
const keepOut = (plan: SitePlan): Rect[] =>
  [plan.zones.arrivalCourt, plan.zones.frontEntry, plan.zones.garageCourt, plan.zones.viewTerrace, plan.zones.poolGarden, plan.zones.outdoorLiving, plan.zones.guest].map((z) => z!.footprint).concat(plan.arrival.corridor);
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];

describe("style outbuildings go through the site plan", () => {
  const styles: [string, string, (p: SitePlan) => Rect][] = [
    ["cabin", "shed", (p) => p.zones.service!.footprint],
    ["modern-luxury", "detached_garage", (p) => p.zones.garageCourt!.footprint],
    ["caribbean-villa", "gazebo", (p) => p.zones.outdoorLiving!.footprint],
  ];

  it("sets a style's shed, garage and gazebo in the zone that owns it, at every scale, view and approach, with nothing left for the collision pass", () => {
    for (const scale of PROJECT_SCALES) {
      for (const [style, kind, zone] of styles) {
        for (const [view, approach] of PAIRS) {
          const where = `${scale} ${style} ${view}/${approach}`;
          const { result, root } = generate({ scale, style, view, approach });
          expect(result.adjusted, where).toEqual([]);
          const found = of(root, kind);
          expect(found.length, where).toBeGreaterThan(0);
          const plan = planOf(root);
          const home = zone(plan);
          // The style's own building is the first of its kind; a scale may add more garages after it.
          const { x, z } = found[0] as { x: number; z: number };
          expect(Math.abs(x - home.x) <= home.w / 2 + 0.6 && Math.abs(z - home.z) <= home.d / 2 + 0.6, `${where}: ${kind} at ${x},${z} outside its zone ${JSON.stringify(home)}`).toBe(true);
        }
      }
    }
  });

  it("keeps a style's outbuilding out of the entrance, terrace, pool and living zones", () => {
    for (const scale of PROJECT_SCALES) {
      for (const [style, kind] of styles) {
        for (const [view, approach] of PAIRS) {
          const { root } = generate({ scale, style, view, approach });
          const plan = planOf(root);
          const reserved = [plan.zones.arrivalCourt, plan.zones.frontEntry, plan.zones.viewTerrace, plan.zones.poolGarden].map((z) => z!.footprint);
          if (kind !== "gazebo") reserved.push(plan.zones.outdoorLiving!.footprint);
          for (const b of of(root, kind)) for (const r of reserved) expect(hit(rectOf(b), r), `${scale} ${style} ${view}/${approach}`).toBe(false);
        }
      }
    }
  });

  it("rotates as one: the same brief facing the other way puts the outbuildings in mirrored places", () => {
    for (const scale of ["luxury", "estate", "mansion"] as const) {
      for (const style of ["cabin", "modern-luxury", "caribbean-villa"]) {
        const a = generate({ scale, style, view: "south", approach: "north", door: false }).root;
        const b = generate({ scale, style, view: "north", approach: "south", door: false }).root;
        const sort = (r: Root) => (r.buildings ?? []).filter((x) => x.kind !== "wing").map((x) => ({ kind: x.kind as string, x: Number(x.x), z: Number(x.z) })).sort((p, q) => (p.kind + p.x.toFixed(0)).localeCompare(q.kind + q.x.toFixed(0)));
        const [sa, sb] = [sort(a), sort(b)];
        expect(sb.map((x) => x.kind), `${scale} ${style}`).toEqual(sa.map((x) => x.kind));
        // Turning the whole site half a turn negates every position (the wings and house are symmetric about the origin).
        for (let i = 0; i < sa.length; i++) {
          const [p, q] = [sa[i], sb.find((x, j) => x.kind === sa[i].kind && Math.abs(x.x + sa[i].x) < 1.5 && Math.abs(x.z + sa[i].z) < 1.5 && j >= 0)];
          expect(q, `${scale} ${style} ${p.kind} at ${p.x},${p.z} has no mirror`).toBeDefined();
        }
      }
    }
  });

  it("rotates coherently a quarter turn at a time, in the view frame", () => {
    const house = { width: 24, depth: 14, floors: 2, roof: "gable" };
    const site = (view: CompassSide, approach: CompassSide) => ({ environment: "countryside", viewDirection: view, approachSide: approach, terrainSlope: "flat", projectScale: "estate", designTier: "comfort" }) as SiteSettings;
    const frame = (view: CompassSide, x: number, z: number): Vec => {
      const v = SIDE_VECTORS[view];
      return [Math.round((x * v[0] + z * v[1]) * 2) / 2, Math.round((x * -v[1] + z * v[0]) * 2) / 2];
    };
    const at = (k: number) => {
      const view = SIDES[(SIDES.indexOf("south") + k) % 4];
      const approach = SIDES[(SIDES.indexOf("north") + k) % 4];
      const h = k % 2 === 1 ? { ...house, width: house.depth, depth: house.width } : house;
      const stand = (kind: string) => ({ op: "addBuilding", value: { kind, x: 0, z: 0, width: kind === "shed" ? 4 : 5, depth: kind === "shed" ? 3.5 : 5, floors: 1, roof: "gable" } }) as PatchOp;
      const ops = [stand("shed"), stand("gazebo")];
      const { ops: out } = planScale({ brief: "An estate", house: h, site: site(view, approach), ops, placeholders: new Set(ops) });
      return Object.fromEntries(out.filter((op) => op.op === "addBuilding" && ["shed", "gazebo"].includes((op.value as Rec).kind as string)).map((op) => [(op.value as Rec).kind as string, frame(view, Number((op.value as Rec).x), Number((op.value as Rec).z))]));
    };
    const base = at(0);
    for (let k = 1; k < 4; k++) {
      const turned = at(k);
      for (const kind of ["shed", "gazebo"]) {
        expect(turned[kind], `${kind} turn ${k}`).toBeDefined();
        expect(Math.abs(turned[kind][0] - base[kind][0]) + Math.abs(turned[kind][1] - base[kind][1]), `${kind} turn ${k}: ${turned[kind]} vs ${base[kind]}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("leaves a project without a scale on the style's fixed offsets, exactly", () => {
    for (const [style, kind] of styles) {
      for (const [view, approach] of PAIRS) {
        const { root } = generate({ style, view, approach });
        const legacy = outbuildingFor(kind as "shed", root.house, root.site);
        const found = of(root, kind)[0];
        expect([found.x, found.z], `${style} ${view}/${approach}`).toEqual([legacy.x, legacy.z]);
      }
    }
  });
});

describe("tier extras and gardens go through the site plan", () => {
  it("sets an estate tier's gazebo and garage in their zones on a cottage or family plan, and keeps unscaled ones at the legacy offsets", () => {
    for (const scale of ["cottage", "family"] as const) {
      for (const [view, approach] of PAIRS) {
        const where = `${scale} ${view}/${approach}`;
        const { result, root } = generate({ scale, tier: "estate", view, approach });
        expect(result.adjusted, where).toEqual([]);
        const plan = planOf(root);
        const [gazebo, garage] = [of(root, "gazebo")[0], of(root, "detached_garage")[0]];
        expect(gazebo, `${where} gazebo`).toBeDefined();
        expect(garage, `${where} garage`).toBeDefined();
        expect(insideZone(plan.zones.outdoorLiving!, rectOf(gazebo), 0.6), `${where} gazebo in the living zone`).toBe(true);
        expect(hit(rectOf(garage), plan.zones.garageCourt!.footprint, -0.1), `${where} garage in the garage court`).toBe(true);
        for (const b of [gazebo, garage]) for (const r of [plan.zones.viewTerrace!.footprint, plan.zones.poolGarden!.footprint, plan.zones.arrivalCourt!.footprint]) expect(hit(rectOf(b), r), where).toBe(false);
      }
    }
    for (const [view, approach] of PAIRS) {
      const { result, root } = generate({ tier: "estate", view, approach });
      for (const kind of ["gazebo", "detached_garage"] as const) {
        const legacy = outbuildingFor(kind, root.house, root.site);
        // The collision pass still settles a legacy project, and may have moved this one.
        if (result.adjusted.length === 0) expect([of(root, kind)[0].x, of(root, kind)[0].z], `unscaled ${kind} ${view}/${approach}`).toEqual([legacy.x, legacy.z]);
      }
    }
  });

  it("puts cottage and family gardens in the plan's garden zones", () => {
    for (const scale of ["cottage", "family"] as const) {
      for (const [view, approach] of PAIRS) {
        const where = `${scale} ${view}/${approach}`;
        const { result, root } = generate({ scale, tier: "luxury", view, approach });
        expect(result.adjusted, where).toEqual([]);
        const plan = planOf(root);
        const gardens = (root.landscaping ?? []).filter((l) => l.kind === "garden");
        expect(gardens.length, where).toBe(2);
        for (const g of gardens) {
          const r: Rect = { x: Number(g.x), z: Number(g.z), w: Number(g.width), d: Number(g.depth) };
          expect(plan.gardens.some((z) => insideZone(z, r, 0.2)), `${where}: garden at ${r.x},${r.z} is in no garden zone`).toBe(true);
          // Lawns may sit in the guest zone or the garage court when nothing else claims it, but never on the way in or the pool.
          for (const k of [plan.zones.arrivalCourt, plan.zones.frontEntry, plan.zones.viewTerrace, plan.zones.poolGarden, plan.zones.outdoorLiving].map((z) => z!.footprint).concat(plan.arrival.corridor)) expect(hit(r, k), where).toBe(false);
        }
      }
    }
  });
});

describe("terrain respects the plan", () => {
  const BRIEF = "A house beside a river with rocky boulders, a clearing in the meadow and retaining walls";

  it("keeps the river, rocks, clearing and retaining walls out of the arrival, garage, pool, outdoor-living and guest zones", () => {
    for (const scale of PROJECT_SCALES) {
      for (const [view, approach] of PAIRS) {
        for (const environment of ["hillside", "beach"]) {
          const where = `${scale} ${view}/${approach} ${environment}`;
          const { result, root } = generate({ scale, view, approach, brief: BRIEF, environment, tier: "estate" });
          expect(result.adjusted, where).toEqual([]);
          const plan = planOf(root, BRIEF);
          const zones = keepOut(plan);

          const river = root.waterways[0];
          expect(river, `${where} river`).toBeDefined();
          const samples = Array.from({ length: 41 }, (_, k): Rect => ({ x: Number(river.x1) + ((Number(river.x2) - Number(river.x1)) * k) / 40, z: Number(river.z1) + ((Number(river.z2) - Number(river.z1)) * k) / 40, w: Number(river.width), d: Number(river.width) }));
          for (const s of samples) for (const z of zones) expect(hit(s, z), `${where}: river through a zone`).toBe(false);

          const rocks = root.rocks[0];
          expect(rocks, `${where} rocks`).toBeDefined();
          const rr: Rect = { x: Number(rocks.x), z: Number(rocks.z), w: 2 * Number(rocks.radius), d: 2 * Number(rocks.radius) };
          for (const z of zones) expect(hit(rr, z), `${where}: rocks in a zone`).toBe(false);

          const clearing = root.landscaping.find((l) => l.kind === "clearing");
          expect(clearing, `${where} clearing`).toBeDefined();
          const cr: Rect = { x: Number(clearing!.x), z: Number(clearing!.z), w: Number(clearing!.width), d: Number(clearing!.depth) };
          for (const z of zones) expect(hit(cr, z), `${where}: clearing in a zone`).toBe(false);
          for (const b of root.buildings) expect(hit(cr, rectOf(b)), `${where}: clearing on a ${b.kind}`).toBe(false);

          for (const wall of root.retainingWalls ?? []) {
            const curve = retainingWallCurve({ x1: Number(wall.x1), z1: Number(wall.z1), x2: Number(wall.x2), z2: Number(wall.z2), height: 1.5, thickness: 0.45, bend: Number(wall.bend) });
            for (const p of curve) for (const z of zones) expect(hit({ x: p[0], z: p[1], w: 0.5, d: 0.5 }, z), `${where}: retaining wall through a zone`).toBe(false);
          }
        }
      }
    }
  });

  it("keeps their relationship to the view: the river past the view-side zones, the clearing and rocks on the view side of the house's back", () => {
    for (const scale of ["family", "luxury", "estate", "mansion"] as const) {
      for (const [view, approach] of PAIRS) {
        const where = `${scale} ${view}/${approach}`;
        const { root } = generate({ scale, view, approach, brief: BRIEF, environment: "hillside" });
        const v = SIDE_VECTORS[view];
        const plan = planOf(root, BRIEF);
        const reach = Math.max(...[plan.zones.viewTerrace, plan.zones.poolGarden, plan.zones.outdoorLiving].map((z) => dot([z!.footprint.x, z!.footprint.z], v) + (Math.abs(v[0]) * z!.footprint.w + Math.abs(v[1]) * z!.footprint.d) / 2));
        const river = root.waterways[0];
        expect(dot([(Number(river.x1) + Number(river.x2)) / 2, (Number(river.z1) + Number(river.z2)) / 2], v), `${where} river`).toBeGreaterThan(reach);
        const clearing = root.landscaping.find((l) => l.kind === "clearing")!;
        expect(dot([Number(clearing.x), Number(clearing.z)], v), `${where} clearing`).toBeGreaterThan(0);
      }
    }
  });

  it("leaves a project without a scale where it always put terrain", () => {
    const { root } = generate({ view: "south", approach: "north", brief: BRIEF, environment: "hillside", tier: "estate" });
    // Legacy: the rocks beside the house at (across × (half + 12)) + view × 4, the clearing straight out at half + 12.
    const half = root.house.depth / 2;
    expect(root.landscaping.find((l) => l.kind === "clearing")).toMatchObject({ x: 0, z: Math.round((half + 12) * 10) / 10 });
    expect(root.rocks[0]).toMatchObject({ x: -Math.round((half + 12) * 10) / 10, z: 4 });
  });
});

describe("model-authored detached buildings are checked against the plan", () => {
  const stand = (kind: string, x: number, z: number, width = 5, depth = 5) => ({ op: "addBuilding", value: { kind, x, z, width, depth, floors: 1, roof: "gable" } });

  it("moves a building the model set on the house, or in the pool, into its zone, and never moves the house or its wings", () => {
    for (const scale of ["luxury", "estate", "mansion"] as const) {
      for (const [view, approach] of PAIRS) {
        const where = `${scale} ${view}/${approach}`;
        const bare = generate({ scale, view, approach }).root;
        const { result, root } = generate({ scale, view, approach, extra: [stand("gazebo", 3, 3), stand("villa", 0, 0, 8, 7), stand("shed", 1, 1, 4, 3.5), stand("detached_garage", -2, 2, 6.5, 6)] });
        expect(result.adjusted, where).toEqual([]);
        expect(root.house, where).toEqual(bare.house);
        expect(of(root, "wing"), where).toEqual(of(bare, "wing").map((w, i) => ({ ...w, id: of(root, "wing")[i].id })));
        const plan = planOf(root);
        expect(insideZone(plan.zones.outdoorLiving!, rectOf(of(root, "gazebo")[0]), 0.6), `${where} gazebo`).toBe(true);
        expect(insideZone(plan.zones.guest!, rectOf(of(root, "villa")[0]), 0.6), `${where} villa`).toBe(true);
        expect(insideZone(plan.zones.service!, rectOf(of(root, "shed")[0]), 0.6), `${where} shed`).toBe(true);
        expect(hit(rectOf(of(root, "detached_garage")[0]), plan.zones.garageCourt!.footprint, -0.1), `${where} garage`).toBe(true);
      }
    }
  });

  it("keeps a building exactly where the model set it when the plan accepts that", () => {
    for (const [view, approach] of [["south", "north"], ["east", "west"], ["north", "east"]] as [CompassSide, CompassSide][]) {
      const first = generate({ scale: "estate", view, approach });
      const plan = planOf(first.root);
      const spot = plan.zones.outdoorLiving!.center;
      const model = generate({ scale: "estate", view, approach, extra: [stand("gazebo", spot[0], spot[1])] }).root;
      expect([Number(of(model, "gazebo")[0].x), Number(of(model, "gazebo")[0].z)], `${view}/${approach}`).toEqual([spot[0], spot[1]]);
      // A building the model put far out on the grounds, clear of everything, is its own decision.
      const far = generate({ scale: "estate", view, approach, extra: [stand("shed", 70, 70, 4, 3.5)] }).root;
      expect([Number(of(far, "shed")[0].x), Number(of(far, "shed")[0].z)], `${view}/${approach} far shed`).toEqual([70, 70]);
    }
  });

  it("leaves a project without a scale exactly as the model wrote it", () => {
    const { root } = generate({ view: "south", approach: "north", extra: [stand("gazebo", 30, 30), stand("villa", 0, 40, 8, 7)] });
    expect([of(root, "gazebo")[0].x, of(root, "gazebo")[0].z]).toEqual([30, 30]);
    expect([of(root, "villa")[0].x, of(root, "villa")[0].z]).toEqual([0, 40]);
  });
});

describe("the collision pass is only a safety net", () => {
  it("makes no corrective move on representative cottage, family, luxury, estate and mansion generations", () => {
    let moves = 0;
    let count = 0;
    for (const scale of PROJECT_SCALES) {
      for (const style of [undefined, "cabin", "modern-luxury", "caribbean-villa"]) {
        for (const tier of ["comfort", "estate"]) {
          for (const [view, approach] of PAIRS) {
            for (const brief of ["A house", `A house with a river, boulders, a clearing and retaining walls`]) {
              const { result } = generate({ scale, style, tier, view, approach, brief, environment: "hillside" });
              moves += result.adjusted.length;
              expect(result.skipped.filter((m) => /left out/.test(m)), `${scale} ${style} ${tier} ${view}/${approach}`).toEqual([]);
              count++;
            }
          }
        }
      }
    }
    expect(count).toBe(960);
    expect(moves).toBe(0);
  });
});
