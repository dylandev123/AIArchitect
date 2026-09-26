import { describe, expect, it } from "vitest";
import { applyPatch } from "../applyPatch";
import { generateHouseFromJson } from "../generateHouse";
import { computeSiteBounds } from "../siteBounds";
import { inferSiteHints, parseSiteSettings, resolveSiteSettings } from "../siteSettings";
import { inferScaleFromBrief, PROJECT_SCALES, SCALE_PROFILES, scaleRank } from "../scale";
import { applyScaleRules, finalizeScale, fitShellToScale } from "../architecture/scaleRules";
import { wallPoint } from "../architecture/siteRules";
import { rotatePrimitiveY } from "../primitiveBuilders";
import { assembleGeneratedProject, buildGenerationSystemPrompt } from "@/lib/ai/generation";
import { buildScopedSystemPrompt } from "@/lib/ai/systemPrompt";
import { WORLD_SCOPE } from "@/lib/ai/targeting";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";
import type { ProjectScale, RoofType } from "@/types/house";

type Rec = Record<string, unknown>;

/** The same raw model output every time — a small suburban box — so any difference is down to scale alone. */
function modelOutput(o: { scale?: ProjectScale; style?: string; roof?: string; view?: string; approach?: string; house?: Rec; rooms?: number } = {}): AiGenerationResponse {
  const house = (o.house ?? { width: 12, depth: 9, floors: 2, roof: o.roof ?? "gable" }) as AiGenerationResponse["house"];
  const rooms = Array.from({ length: o.rooms ?? 0 }, (_, i) => ({ op: "addRoom", value: { type: "bedroom", level: 0, x: 0.3 + (i % 2) * 5.6, z: 0.3 + Math.floor(i / 2) * 2.7, width: 4.5, depth: 2.6 } }));
  return {
    summary: "A house.",
    house,
    site: {
      environment: "countryside",
      viewDirection: o.view ?? "south",
      terrainSlope: "flat",
      approachSide: o.approach ?? "north",
      ...(o.scale ? { projectScale: o.scale } : {}),
    },
    operations: [
      { op: "setExteriorOptions", fields: { style: o.style ?? "colonial" } },
      { op: "setMaterials", fields: { exterior: { material: "stucco", color: "#f5f2ec" }, roof: { material: "tile", color: "#5a7a9c" } } },
      { op: "addDoor", value: { wall: "north", level: 0, offset: Math.round(((house.width as number) / 2 - 0.55) * 10) / 10, width: 1.1, height: 2.1 } },
      { op: "addWindow", value: { wall: "north", level: 0, offset: 1.5, width: 1.4, height: 1.3, sill: 0.9 } },
      { op: "addWindow", value: { wall: "south", level: 0, offset: 2, width: 2, height: 1.6, sill: 0.6 } },
      { op: "addWindow", value: { wall: "east", level: 0, offset: 3, width: 1.2, height: 1.2, sill: 0.9 } },
      { op: "addGarage", value: { wall: "north", offset: 0.5, width: 6, depth: 6, height: 2.6 } },
      ...rooms,
    ] as AiGenerationResponse["operations"],
  };
}

function design(brief: string, output: AiGenerationResponse) {
  const result = assembleGeneratedProject(structuredClone(output), [], brief);
  if (!result.ok) throw new Error(`generation failed: ${result.errors.join("; ")}`);
  const generated = generateHouseFromJson(result.json);
  expect(generated.errors).toEqual([]);
  expect(generated.warnings.filter((w) => !/will render fine/.test(w))).toEqual([]);
  const root = JSON.parse(result.json) as Rec;
  const list = (key: string) => (Array.isArray(root[key]) ? (root[key] as Rec[]) : []);
  const house = root.house as { width: number; depth: number; floors: number };
  const buildings = list("buildings") as { kind: string; x: number; z: number; width: number; depth: number; floors: number; rotation?: number; matchHouse?: boolean }[];
  const wings = buildings.filter((b) => b.kind === "wing");
  const grossArea = house.width * house.depth * house.floors + wings.reduce((n, w) => n + w.width * w.depth * w.floors, 0);
  const bounds = computeSiteBounds(generated.site!);
  return { json: result.json, root, list, house, buildings, wings, grossArea, bounds, span: bounds.halfWidth * bounds.halfDepth * 4, site: generated.site!, primitives: generated.model!.primitives };
}

const STYLES = ["colonial", "modern-luxury", "cabin", "caribbean-villa", "mediterranean", "nordic"];

// ── Inference ───────────────────────────────────────────────────────────────────────────────────────────────────

describe("scale inference", () => {
  it("reads the scale a brief states", () => {
    const cases: [string, ProjectScale | undefined][] = [
      ["A small cottage by the sea", "cottage"],
      ["a tiny house in the woods", "cottage"],
      ["A compact modern house", "cottage"],
      ["A family home with a pool", "family"],
      ["A luxury home on a hill", "luxury"],
      ["A large villa overlooking the bay", "luxury"],
      ["A grand estate with formal gardens", "estate"],
      ["An old stately manor", "estate"],
      ["A hilltop mansion with a pool", "mansion"],
      ["A luxury mansion", "mansion"],
      ["A luxury cottage", "cottage"],
      ["A luxury family home", "family"],
      ["A modern house with a small garden", undefined],
      ["A house near a real estate office", undefined],
    ];
    for (const [brief, scale] of cases) expect(inferScaleFromBrief(brief), brief).toBe(scale);
  });

  it("puts the scale in the site hints and lets the brief override the model", () => {
    expect(inferSiteHints("a mansion").projectScale).toBe("mansion");
    const site = resolveSiteSettings({ projectScale: "cottage" }, inferSiteHints("a mansion"));
    expect(site.projectScale).toBe("mansion");
    expect(resolveSiteSettings({ projectScale: "estate" }, inferSiteHints("a house")).projectScale).toBe("estate");
    expect(resolveSiteSettings({}, inferSiteHints("a house")).projectScale).toBeUndefined();
  });

  it("lifts the tier for a mansion unless the brief states one", () => {
    expect(resolveSiteSettings({ designTier: "comfort", projectScale: "mansion" }, {}).designTier).toBe("estate");
    expect(resolveSiteSettings({ designTier: "comfort", projectScale: "mansion" }, { designTier: "starter" }).designTier).toBe("starter");
    expect(resolveSiteSettings({ designTier: "comfort", projectScale: "family" }, {}).designTier).toBe("comfort");
  });
});

// ── Same style, different scale ─────────────────────────────────────────────────────────────────────────────────

describe("the same style at different scales", () => {
  for (const style of STYLES) {
    it(`${style}: massing, floors, wings and site grow with the scale`, () => {
      const d = Object.fromEntries(PROJECT_SCALES.map((s) => [s, design("A house", modelOutput({ scale: s, style }))])) as Record<ProjectScale, ReturnType<typeof design>>;
      const seq = PROJECT_SCALES.map((s) => d[s]);
      for (let i = 1; i < seq.length; i++) {
        const [a, b, name] = [seq[i - 1], seq[i], PROJECT_SCALES[i]];
        expect(b.grossArea, `${style} ${name} gross area`).toBeGreaterThan(a.grossArea * 1.15);
        expect(b.span, `${style} ${name} site spread`).toBeGreaterThan(a.span);
        expect(b.house.width * b.house.depth, `${style} ${name} main footprint`).toBeGreaterThan(a.house.width * a.house.depth);
        expect(b.house.floors).toBeGreaterThanOrEqual(a.house.floors);
        expect(b.primitives.length, `${style} ${name} geometry`).toBeGreaterThan(a.primitives.length);
      }
      expect(seq.map((x) => x.wings.length)).toEqual([0, 0, 1, 2, 3]);
      // A cottage is one mass: at most the style's own outbuilding (shed, garage or gazebo), never a wing or guest house.
      expect(d.cottage.buildings.filter((b) => !["shed", "detached_garage", "gazebo"].includes(b.kind))).toEqual([]);
      expect(d.cottage.buildings.length).toBeLessThanOrEqual(1);
      // Larger scales are compositions, not scaled boxes: the plan is not a rectangle and the roofline steps.
      for (const s of ["luxury", "estate", "mansion"] as const) expect(d[s].wings.every((w) => w.floors <= d[s].house.floors)).toBe(true);
      expect(d.mansion.grossArea).toBeGreaterThan(d.family.grossArea * 6);
    });
  }

  it("holds the same shape whatever the roof or the view, and stays a different house per scale", () => {
    const seen = new Set<string>();
    for (const s of PROJECT_SCALES) {
      const d = design("A house", modelOutput({ scale: s }));
      seen.add(JSON.stringify([d.house, d.buildings.map(({ kind, x, z, width, depth, floors }) => [kind, x, z, width, depth, floors])]));
    }
    expect(seen.size).toBe(PROJECT_SCALES.length);
  });

  it("gives every scale its own garage, outdoor living, driveway and grounds", () => {
    const d = Object.fromEntries(PROJECT_SCALES.map((s) => [s, design("A house", modelOutput({ scale: s }))])) as Record<ProjectScale, ReturnType<typeof design>>;
    const cars = (x: ReturnType<typeof design>) =>
      x.list("garages").reduce((n, g) => n + Math.max(1, Math.round((g.width as number) / 3.1)), 0) +
      x.buildings.filter((b) => b.kind === "detached_garage").reduce((n, b) => n + Math.max(1, Math.round(b.width / 3.1)), 0);
    expect(cars(d.cottage)).toBeLessThanOrEqual(1);
    expect(cars(d.luxury)).toBeGreaterThanOrEqual(3);
    expect(cars(d.estate)).toBeGreaterThanOrEqual(4);
    expect(cars(d.mansion)).toBeGreaterThanOrEqual(6);

    const poolArea = (x: ReturnType<typeof design>) => x.list("pools").reduce((n, p) => n + (p.width as number) * (p.depth as number), 0);
    expect(poolArea(d.family)).toBeLessThanOrEqual(9 * 4.5);
    expect(poolArea(d.luxury)).toBeGreaterThanOrEqual(9 * 4.5);
    expect(poolArea(d.mansion)).toBeGreaterThan(poolArea(d.estate));
    expect(poolArea(d.estate)).toBeGreaterThan(poolArea(d.luxury));

    const deckArea = (x: ReturnType<typeof design>) => x.list("decks").reduce((n, p) => n + (p.width as number) * (p.depth as number), 0);
    expect(deckArea(d.mansion)).toBeGreaterThan(deckArea(d.estate));
    expect(deckArea(d.estate)).toBeGreaterThan(deckArea(d.luxury));

    const driveway = (x: ReturnType<typeof design>) => Math.max(0, ...x.list("driveways").map((v) => v.length as number));
    expect(driveway(d.cottage)).toBeLessThanOrEqual(10);
    for (let i = 3; i < PROJECT_SCALES.length; i++) expect(driveway(d[PROJECT_SCALES[i]])).toBeGreaterThan(driveway(d[PROJECT_SCALES[i - 1]]));
    expect(driveway(d.mansion)).toBeGreaterThanOrEqual(36);

    const gardens = (x: ReturnType<typeof design>) => x.list("landscaping").filter((l) => l.kind === "garden").length;
    expect(gardens(d.cottage)).toBe(0);
    expect(gardens(d.mansion)).toBeGreaterThanOrEqual(4);
    expect(gardens(d.mansion)).toBeGreaterThan(gardens(d.luxury));

    const kinds = (x: ReturnType<typeof design>) => x.buildings.map((b) => b.kind);
    expect(kinds(d.mansion)).toEqual(expect.arrayContaining(["villa", "gazebo", "outdoor_bar", "wing", "detached_garage"]));
    expect(kinds(d.family)).not.toContain("wing");
  });

  it("keeps interiors basic: a handful of rooms per floor at any scale", () => {
    for (const s of PROJECT_SCALES) {
      const d = design("A house", modelOutput({ scale: s, rooms: 6, house: { width: 12, depth: 9, floors: 1, roof: "gable" } }));
      const perLevel = new Map<number, number>();
      for (const r of d.list("rooms")) perLevel.set(r.level as number, (perLevel.get(r.level as number) ?? 0) + 1);
      for (const n of perLevel.values()) expect(n).toBeLessThanOrEqual(SCALE_PROFILES[s].roomsPerFloor);
    }
  });
});

// ── A mansion is never a small house ────────────────────────────────────────────────────────────────────────────

describe("mansion", () => {
  const small = modelOutput({ house: { width: 8, depth: 6, floors: 1, roof: "gable" } });

  it("cannot come out small, whatever the model proposed", () => {
    for (const style of STYLES) {
      const d = design("A hilltop mansion", { ...structuredClone(small), operations: modelOutput({ style, house: small.house }).operations });
      expect(d.house.width, style).toBeGreaterThanOrEqual(30);
      expect(d.house.depth, style).toBeGreaterThanOrEqual(15);
      expect(d.house.floors, style).toBeGreaterThanOrEqual(3);
      expect(d.wings.length, style).toBeGreaterThanOrEqual(3);
      expect(d.grossArea, style).toBeGreaterThan(1800);
      expect(d.span, style).toBeGreaterThan(5000);
      expect(d.site.settings?.projectScale, style).toBe("mansion");
      expect(d.site.settings?.designTier, style).toBe("estate");
    }
  });

  it("is far larger than the family home built from the same model output", () => {
    const family = design("A family home", small);
    const mansion = design("A mansion", small);
    expect(mansion.grossArea).toBeGreaterThan(family.grossArea * 8);
    expect(mansion.bounds.halfWidth).toBeGreaterThan(family.bounds.halfWidth * 2);
  });

  it("the brief's scale wins over the model's", () => {
    expect(design("A mansion", modelOutput({ scale: "cottage" })).house.floors).toBeGreaterThanOrEqual(3);
    expect(design("A small cottage", modelOutput({ scale: "mansion", house: { width: 30, depth: 16, floors: 3, roof: "gable" } })).house.width).toBeLessThanOrEqual(11);
  });

  it("a small cottage is one compact mass", () => {
    const d = design("A small cottage", modelOutput({ house: { width: 20, depth: 12, floors: 2, roof: "gable" } }));
    expect(d.house.width).toBeLessThanOrEqual(11);
    expect(d.house.depth).toBeLessThanOrEqual(8.5);
    expect(d.house.floors).toBe(1);
    expect(d.wings).toEqual([]);
    expect(d.buildings.filter((b) => b.kind !== "shed")).toEqual([]);
    expect(design("A small two-storey cottage", modelOutput({ house: { width: 10, depth: 7, floors: 2, roof: "gable" } })).house.floors).toBe(2);
  });

  it("is deterministic for a given brief and different for a different one", () => {
    const strip = (json: string) => json.replace(/"id":\s*"[^"]*",?/g, "");
    const a = strip(design("A mansion by the sea", small).json);
    expect(strip(design("A mansion by the sea", small).json)).toBe(a);
    expect(strip(design("A mansion in the hills", small).json)).not.toBe(a);
  });
});

// ── Geometry: wings are connected, and the rest works around them ───────────────────────────────────────────────

describe("wings", () => {
  const SIDES: [string, string][] = [["south", "north"], ["north", "south"], ["east", "west"], ["west", "east"], ["south", "east"], ["east", "north"]];

  it("touch the house or another wing, never float or overlap anything else", () => {
    for (const scale of ["luxury", "estate", "mansion"] as const) {
      for (const [view, approach] of SIDES) {
        const d = design("A house", modelOutput({ scale, view, approach }));
        const rects = [{ x: 0, z: 0, w: d.house.width, d: d.house.depth }, ...d.wings.map((w) => ({ x: w.x, z: w.z, w: w.width, d: w.depth }))];
        const touches = (a: (typeof rects)[number], b: (typeof rects)[number]) =>
          Math.abs(a.x - b.x) <= (a.w + b.w) / 2 + 0.01 && Math.abs(a.z - b.z) <= (a.d + b.d) / 2 + 0.01;
        d.wings.forEach((w, i) => {
          const r = rects[i + 1];
          expect(rects.some((o, j) => j !== i + 1 && touches(r, o)), `${scale} ${view}/${approach} wing ${i}`).toBe(true);
          expect(w.floors).toBeLessThanOrEqual(d.house.floors);
        });
        // Nothing else stands inside a wing.
        for (const b of d.buildings.filter((b) => b.kind !== "wing")) {
          const turned = Math.abs(Math.sin(((b.rotation ?? 0) * Math.PI) / 180)) > 0.5;
          const r = { x: b.x, z: b.z, w: turned ? b.depth : b.width, d: turned ? b.width : b.depth };
          for (const w of rects.slice(1)) {
            const overlaps = Math.abs(r.x - w.x) < (r.w + w.w) / 2 - 0.05 && Math.abs(r.z - w.z) < (r.d + w.d) / 2 - 0.05;
            expect(overlaps, `${scale} ${view}/${approach}: ${b.kind} overlaps a wing`).toBe(false);
          }
        }
        // The main house is never buried: the entrance wall stays open.
        expect(d.wings.length).toBeGreaterThanOrEqual(scale === "luxury" ? 1 : 2);
      }
    }
  });

  it("clear the walls they cover: no window, bay or chimney left inside a wing", () => {
    for (const scale of ["luxury", "estate", "mansion"] as const) {
      const d = design("A house", modelOutput({ scale }));
      const walls = d.wings.filter((w) => Math.abs(Math.abs(w.x) - (d.house.width / 2 + w.width / 2)) < 1);
      expect(walls.length).toBeGreaterThan(0);
      for (const w of walls) {
        const wall = w.x > 0 ? "east" : "west";
        const from = w.z - w.depth / 2 + d.house.depth / 2;
        const to = w.z + w.depth / 2 + d.house.depth / 2;
        for (const key of ["windows", "bays", "chimneys", "arches", "balconies"]) {
          for (const f of d.list(key)) {
            if (f.wall !== wall || (f.level as number) >= w.floors) continue;
            const a = f.offset as number;
            const b = a + ((f.width as number) ?? 0);
            expect(a < to && b > from, `${scale} ${key} inside a wing`).toBe(false);
          }
        }
      }
    }
  });

  it("give the larger facades a window rhythm on every upper floor", () => {
    const d = design("A mansion", modelOutput({ scale: "mansion" }));
    for (let level = 1; level < d.house.floors; level++) {
      for (const wall of ["north", "south"]) {
        const n = d.list("windows").filter((w) => w.wall === wall && w.level === level).length;
        expect(n, `${wall} level ${level}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});

// ── Secondary buildings: style, orientation and the drive ───────────────────────────────────────────────────────

describe("secondary buildings", () => {
  const SIDE_FRAME: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  const isBuildingPart = (id: string, i: number) => id.startsWith(`building-${i}-`);

  /** Every part of the house's walls and roof carries the same construction language as the building's parts do. */
  it("wings, detached garages and guest houses match the main house in every style", () => {
    for (const style of STYLES) {
      for (const scale of ["cottage", "luxury", "mansion"] as const) {
        const d = design("A house", modelOutput({ scale, style, roof: "hip" }));
        const wall = (ps: typeof d.primitives) => ps.find((p) => /(^|-)wall-/.test(p.id) && "color" in p) as { color: string } | undefined;
        const mainParts = d.primitives.filter((p) => !p.id.startsWith("building-") && !p.id.startsWith("garage-"));
        const houseWall = wall(mainParts)!;
        const norm = (id: string) => id.replace(/^building-\d+-/, "").replace(/^roof-/, "").replace(/-\d+$/, "");
        const houseRoofIds = new Set(mainParts.filter((p) => p.category === "roof").map((p) => norm(p.id)));
        d.buildings.forEach((b, i) => {
          if (!["wing", "detached_garage", "villa"].includes(b.kind)) return;
          const parts = d.primitives.filter((p) => isBuildingPart(p.id, i));
          const where = `${style} ${scale} ${b.kind}`;
          // Log walls stay log; slab and stucco stay slab and stucco.
          const logs = (ps: { id: string }[]) => ps.some((p) => p.id.includes("-log-"));
          expect(logs(parts), where).toBe(logs(mainParts));
          // Same wall colour, same roof colour.
          expect(wall(parts)?.color, where).toBe(houseWall.color);
          const roofOf = (ps: typeof parts) => ps.find((p) => /^Roof (Hip|Gable|Slab|Plate|Panel|Surface)|^Roof$/.test(p.label ?? "") && "color" in p) as { color: string } | undefined;
          expect(roofOf(parts)?.color, where).toBe(roofOf(mainParts)?.color);
          // Styled roofs share the house's roof parts (cabin ridge beam and rafter tails, plate roof fascia…).
          const styled = ["cabin", "modern-luxury", "caribbean-villa"].includes(style);
          if (styled) {
            const shared = parts.some((p) => houseRoofIds.has(norm(p.id)));
            expect(shared, where).toBe(true);
          }
          // Secondary buildings that are flagged take the house's shell; wings always do.
          if (b.kind !== "wing") expect(b.matchHouse, where).toBe(true);
        });
      }
    }
  });

  it("detached garages carry the house's roof form and a rotation only when they need one", () => {
    for (const roof of ["gable", "hip", "flat"] as RoofType[]) {
      const d = design("A house", modelOutput({ scale: "mansion", style: "colonial", roof }));
      const garages = d.buildings.filter((b) => b.kind === "detached_garage");
      expect(garages.length).toBeGreaterThan(0);
      for (const g of garages) expect((g as unknown as { roof: string }).roof, roof).toBe(roof);
    }
  });

  it("garage doors face the drive, and the drive and apron reach them, for every approach and style", () => {
    for (const style of ["colonial", "modern-luxury", "cabin"]) {
      for (const scale of ["luxury", "estate", "mansion"] as const) {
        for (const approach of ["north", "south", "east", "west"]) {
          const d = design("A house", modelOutput({ scale, style, approach, view: approach === "south" ? "north" : "south" }));
          const garages = d.buildings.filter((b) => b.kind === "detached_garage");
          const where = `${style} ${scale} approach ${approach}`;
          expect(garages.length, where).toBeGreaterThan(0);

          const drive = d.list("driveways").find((v) => v.wall === approach)!;
          expect(drive, where).toBeDefined();
          const dir = SIDE_FRAME[approach];
          const across: [number, number] = [-dir[1], dir[0]];
          const driveW = drive.width as number;
          const start = wallPoint(d.house as never, approach as never, (drive.offset as number) + driveW / 2, 0);
          const along = (x: number, z: number) => (x - start[0]) * dir[0] + (z - start[1]) * dir[1];
          const lateral = (x: number, z: number) => (x - start[0]) * across[0] + (z - start[1]) * across[1];
          const aprons = d.list("parking").filter((a) => a.stripes === false) as { x: number; z: number; width: number; depth: number }[];
          const inApron = (x: number, z: number) => aprons.some((a) => Math.abs(x - a.x) <= a.width / 2 + 0.05 && Math.abs(z - a.z) <= a.depth / 2 + 0.05);

          for (const g of garages) {
            const yaw = ((g.rotation ?? 0) * Math.PI) / 180;
            const face: [number, number] = [Math.sin(yaw), Math.cos(yaw)];
            const side = Math.sign(lateral(g.x, g.z));
            // The doors look across the drive, at its centreline.
            expect(face[0] * across[0] + face[1] * across[1], `${where}: door direction`).toBeCloseTo(-side, 5);
            // A point just in front of the door is paved apron, and the drive's own edge borders that apron.
            const before: [number, number] = [g.x + face[0] * (g.depth / 2 + 0.1), g.z + face[1] * (g.depth / 2 + 0.1)];
            expect(inApron(before[0], before[1]), `${where}: apron in front of the door`).toBe(true);
            const edge: [number, number] = [start[0] + dir[0] * along(g.x, g.z) + across[0] * side * (driveW / 2 - 0.1), start[1] + dir[1] * along(g.x, g.z) + across[1] * side * (driveW / 2 - 0.1)];
            const beyond: [number, number] = [edge[0] + across[0] * side * 0.2, edge[1] + across[1] * side * 0.2];
            expect(inApron(beyond[0], beyond[1]), `${where}: apron borders the drive`).toBe(true);
            // …and the drive is long enough to run alongside the whole garage.
            const extent = Math.abs(dir[0]) > 0.5 ? Math.abs(Math.cos(yaw)) * g.width + Math.abs(Math.sin(yaw)) * g.depth : Math.abs(Math.sin(yaw)) * g.width + Math.abs(Math.cos(yaw)) * g.depth;
            expect(drive.length as number, `${where}: drive reaches the garage`).toBeGreaterThanOrEqual(along(g.x, g.z) + extent / 2 - 0.01);
          }
        }
      }
    }
  });

  it("an attached garage's own drive reaches its doors", () => {
    for (const scale of ["family", "luxury", "mansion"] as const) {
      const out = modelOutput({ scale });
      out.operations.push({ op: "addDriveway", value: { wall: "north", offset: 0.3, width: 3, length: 12 } } as never);
      const d = design("A house", out);
      const garage = d.list("garages")[0];
      const drive = d.list("driveways")[0];
      expect((drive.offset as number) < (garage.offset as number) + (garage.width as number)).toBe(true);
      expect((drive.offset as number) + (drive.width as number) > (garage.offset as number)).toBe(true);
    }
  });

  it("buildings accept a rotation: geometry turns about its centre, ids stay, and none is written by default", () => {
    const base = { kind: "detached_garage", x: 12, z: -6, width: 6.8, depth: 6.4, floors: 1, roof: "gable" };
    const json = (extra: Rec) => JSON.stringify({ house: { width: 10, depth: 8, floors: 1, roof: "gable" }, buildings: [{ ...base, ...extra }] });
    const plain = generateHouseFromJson(json({}));
    const turned = generateHouseFromJson(json({ rotation: 90 }));
    expect(turned.errors).toEqual([]);
    expect(plain.site!.buildings[0]).not.toHaveProperty("rotation");
    expect(turned.site!.buildings[0].rotation).toBe(90);
    const ids = (r: typeof plain) => r.model!.primitives.filter((p) => p.id.startsWith("building-0-")).map((p) => p.id);
    expect(ids(turned)).toEqual(ids(plain));
    // The garage door faced south (+z); turned 90° it faces east (+x).
    const door = (r: typeof plain) => r.model!.primitives.find((p) => p.id === "building-0-door")! as { position: [number, number, number] };
    expect(door(plain).position[2] - base.z).toBeGreaterThan(3);
    expect(door(turned).position[0] - base.x).toBeGreaterThan(3);
    expect(Math.abs(door(turned).position[2] - base.z)).toBeLessThan(0.5);
    // Tilted parts (roof planes) keep their pitch when the building turns.
    const tilted = { kind: "box", id: "t", category: "roof", label: "t", position: [13, 3, -6], rotation: [0.4, 0, 0], size: [1, 1, 1], color: "#fff" } as const;
    const r = rotatePrimitiveY(tilted as never, 12, -6, Math.PI / 2) as { position: number[]; rotation: number[] };
    expect(r.position[0]).toBeCloseTo(12, 5);
    expect(r.position[2]).toBeCloseTo(-7, 5);
    expect(Math.abs(r.rotation[0]) + Math.abs(r.rotation[1]) + Math.abs(r.rotation[2])).toBeGreaterThan(0.4);
  });

  it("existing buildings render exactly as before: no rotation, no matchHouse, same primitives", () => {
    const legacy = JSON.stringify({ house: { width: 10, depth: 8, floors: 1, roof: "gable" }, buildings: [{ kind: "detached_garage", x: 12, z: 0, width: 6, depth: 6, floors: 1, roof: "gable" }, { kind: "villa", x: -14, z: 0, width: 8, depth: 7, floors: 1, roof: "gable" }] });
    const a = generateHouseFromJson(legacy);
    expect(a.errors).toEqual([]);
    const withFlags = generateHouseFromJson(legacy.replace(/"roof":"gable"\}/g, '"roof":"gable","rotation":0}'));
    expect(withFlags.model!.primitives).toEqual(a.model!.primitives);
    expect(a.site!.buildings.every((b) => b.rotation === undefined && b.matchHouse === undefined)).toBe(true);
  });
});

// ── Robustness ──────────────────────────────────────────────────────────────────────────────────────────────────

describe("scale rules produce valid designs everywhere", () => {
  const ROOFS: RoofType[] = ["flat", "gable", "hip", "mansard", "shed", "butterfly", "sawtooth"];
  const SIZES: [number, number, number][] = [[6, 6, 1], [12, 9, 2], [9, 14, 2], [20, 12, 3], [40, 20, 4]];
  const SIDES = [["south", "north"], ["east", "west"], ["north", "south"], ["west", "east"], ["south", "east"], ["north", "west"]] as const;
  const BRIEFS = ["A house", "A hilltop mansion", "A grand estate beside a river", "A luxury home", "A small cottage", "A family home", "A mansion in a forest clearing with rocks"];

  it("assembles without validation errors", () => {
    let n = 0;
    for (const roof of ROOFS) {
      for (const [w, d, f] of SIZES) {
        for (const [view, approach] of SIDES) {
          for (const brief of BRIEFS) {
            for (const scale of [undefined, ...PROJECT_SCALES]) {
              const style = STYLES[n % STYLES.length];
              const out = modelOutput({ house: { width: w, depth: d, floors: f, roof }, view, approach, scale, style });
              const result = assembleGeneratedProject(structuredClone(out), [], brief);
              if (!result.ok) throw new Error(`${brief} | ${scale} | ${style} | ${w}x${d}x${f} ${roof} view=${view} approach=${approach}: ${result.errors.join("; ")}`);
              n++;
            }
          }
        }
      }
    }
    expect(n).toBeGreaterThan(5000);
  }, 120_000);
});

// ── Compatibility ───────────────────────────────────────────────────────────────────────────────────────────────

describe("existing projects", () => {
  it("a site without a scale parses as before and never warns about it", () => {
    const warnings: string[] = [];
    const site = parseSiteSettings({ environment: "beach", viewDirection: "east", terrainSlope: "flat", approachSide: "west", designTier: "luxury" }, warnings);
    expect(warnings).toEqual([]);
    expect(site?.projectScale).toBeUndefined();
    expect(parseSiteSettings({ environment: "beach", viewDirection: "east", terrainSlope: "flat", approachSide: "west", projectScale: "mansion" }, [])?.projectScale).toBe("mansion");
    const bad: string[] = [];
    expect(parseSiteSettings({ environment: "beach", viewDirection: "east", terrainSlope: "flat", approachSide: "west", projectScale: "castle" }, bad)?.projectScale).toBeUndefined();
    expect(bad.some((w) => w.includes("projectScale"))).toBe(true);
  });

  it("the rules do nothing at all without a scale", () => {
    const ops = modelOutput().operations as never[];
    const site = { environment: "countryside", viewDirection: "south", terrainSlope: "flat", approachSide: "north" } as const;
    const house = { width: 12, depth: 9, floors: 2, roof: "gable" };
    const input = { brief: "A mansion", house, site: { ...site }, ops };
    expect(fitShellToScale(input)).toEqual({ house, ops });
    expect(applyScaleRules(input)).toEqual(ops);
    expect(finalizeScale(input)).toEqual(ops);
  });

  it("a generation with no stated or chosen scale is unchanged and stores none", () => {
    const d = design("A modern house with a pool", modelOutput());
    expect(d.house).toMatchObject({ width: 12, depth: 9, floors: 2 });
    expect(d.wings).toEqual([]);
    expect((d.root.site as Rec).projectScale).toBeUndefined();
  });

  it("a saved project renders the same and a scoped scale edit changes nothing else", () => {
    const d = design("A luxury home", modelOutput());
    const before = generateHouseFromJson(d.json);
    const edited = applyPatch(d.json, [{ op: "setSite", fields: { projectScale: "cottage" } }]);
    expect(edited.errors).toEqual([]);
    const after = generateHouseFromJson(edited.json);
    expect(after.model!.primitives.length).toBe(before.model!.primitives.length);
    expect((JSON.parse(edited.json) as Rec).buildings).toEqual((JSON.parse(d.json) as Rec).buildings);
    // …and a legacy project with no site.projectScale at all still generates cleanly.
    const legacy = JSON.parse(d.json) as Rec;
    delete (legacy.site as Rec).projectScale;
    const r = generateHouseFromJson(JSON.stringify(legacy));
    expect(r.errors).toEqual([]);
  });

  it("wings are a real building kind: editable by id, valid to the renderer", () => {
    const d = design("A mansion", modelOutput());
    const wing = d.wings[0];
    const bumped = applyPatch(d.json, [{ op: "setHouse", fields: { floors: d.house.floors } }]);
    expect(bumped.errors).toEqual([]);
    expect(wing.floors).toBeGreaterThanOrEqual(1);
    const primitives = d.primitives.filter((p) => p.id.startsWith("building-"));
    expect(primitives.some((p) => /wing/i.test(p.label ?? ""))).toBe(true);
  });
});

// ── Prompts ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe("prompts", () => {
  it("initial generation explains every scale, and scoped edits are told not to act on it", () => {
    const prompt = buildGenerationSystemPrompt([]);
    expect(prompt).toContain("PROJECT SCALE");
    for (const s of PROJECT_SCALES) expect(prompt).toContain(`projectScale "${s}"`);
    expect(prompt).toContain("site.projectScale: cottage | family | luxury | estate | mansion");
    expect(buildScopedSystemPrompt(WORLD_SCOPE)).toContain("projectScale");
    expect(scaleRank("mansion")).toBeGreaterThan(scaleRank("estate"));
  });
});
