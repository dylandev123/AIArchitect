import { describe, expect, it } from "vitest";
import { applyPatch } from "../applyPatch";
import { generateHouseFromJson } from "../generateHouse";
import type { HousePrimitive } from "../types";
import { FEATURE_JSON_KEY, FEATURE_TYPES } from "../features/featureTypes";
import { FEATURE_MODULES } from "../features/registry";
import { getDefaultFeatureConfig } from "../features/defaults";
import { parseFeatureMeshId } from "../features/parseFeatureId";
import { inferSiteHints } from "../siteSettings";
import { DEFAULT_DESIGN_TIER, DESIGN_TIERS, resolveTier } from "../tiers";
import { assembleGeneratedProject, buildGenerationSystemPrompt } from "@/lib/ai/generation";
import { classifyPromptTarget, partitionOpsForScope, scopeFromHint } from "@/lib/ai/targeting";
import { validateOperations, describeOperationPayloads } from "@/lib/ai/siteSchema";
import { WORLD_SCOPE } from "@/lib/ai/targeting";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";
import { planTerrain, terrainHeightAt, buildRollingMesh } from "@/lib/landscaping/terrain";
import { collectOccupiedFootprints, isInsideAnyFootprint } from "@/lib/landscaping/footprints";
import { waterwayCurve } from "../features/waterways";
import { generateTrees } from "@/lib/landscaping/trees";
import type { RoofType, SiteConfig } from "@/types/house";

/** The same raw model output for every brief, so any difference in the result is down to tier and brief rules alone. */
function modelOutput(overrides: Partial<AiGenerationResponse> = {}, roof = "gable"): AiGenerationResponse {
  const house = overrides.house ?? { width: 14, depth: 9, floors: 2, roof };
  return {
    summary: "A house.",
    house,
    site: { environment: "countryside", viewDirection: "south", terrainSlope: "flat", approachSide: "north" },
    operations: [
      { op: "setExteriorOptions", fields: { style: "colonial" } },
      { op: "setMaterials", fields: { exterior: { material: "stucco", color: "#f5f2ec" }, roof: { material: "tile", color: "#5a7a9c" } } },
      { op: "addDoor", value: { wall: "north", level: 0, offset: Math.round((house.width / 2 - 0.55) * 10) / 10, width: 1.1, height: 2.1 } },
      { op: "addWindow", value: { wall: "north", level: 0, offset: 1.5, width: 1.4, height: 1.3, sill: 0.9 } },
      { op: "addWindow", value: { wall: "south", level: 0, offset: 2, width: 2, height: 1.6, sill: 0.6 } },
      { op: "addWindow", value: { wall: "east", level: 0, offset: 3, width: 1.2, height: 1.2, sill: 0.9 } },
    ],
    ...overrides,
  };
}

function design(brief: string, output: AiGenerationResponse = modelOutput()) {
  const result = assembleGeneratedProject(structuredClone(output), [], brief);
  if (!result.ok) throw new Error(`generation failed: ${result.errors.join("; ")}`);
  const generated = generateHouseFromJson(result.json);
  expect(generated.errors).toEqual([]);
  expect(generated.warnings.filter((w) => !/will render fine/.test(w))).toEqual([]);
  return { json: result.json, root: JSON.parse(result.json) as Record<string, unknown>, primitives: generated.model!.primitives, site: generated.site! };
}

const count = (root: Record<string, unknown>, key: string) => (Array.isArray(root[key]) ? (root[key] as unknown[]).length : 0);

// ── Silhouette ────────────────────────────────────────────────────────────────────────────────────────────────

// Wide enough to hold a planned mansion's whole site (the curved terrace wall stands past the pool garden), at the same ~0.94 m a bin.
const BINS = 102;
const RANGE = 48;

/** Highest point of the *building* (not the site) in each horizontal slice seen from the front (x) or side (z). */
function skyline(primitives: readonly HousePrimitive[], axis: "x" | "z"): number[] {
  const top = new Array<number>(BINS).fill(0);
  const bin = (v: number) => Math.min(BINS - 1, Math.max(0, Math.floor(((v + RANGE) / (RANGE * 2)) * BINS)));
  const i = axis === "x" ? 0 : 2;
  const buildingCategories = new Set(["wall", "roof", "bay", "arch", "floor", "porch", "chimney", "balcony"]);
  for (const p of primitives) {
    if (!buildingCategories.has(p.category)) continue;
    if (p.kind === "box") {
      const half = Math.max(Math.abs(p.size[i]), 0.01) / 2;
      const y = p.position[1] + p.size[1] / 2;
      for (let b = bin(p.position[i] - half); b <= bin(p.position[i] + half); b++) top[b] = Math.max(top[b], y);
    } else {
      for (let v = 0; v < p.vertices.length; v += 3) {
        const b = bin(p.vertices[v + i]);
        top[b] = Math.max(top[b], p.vertices[v + 1]);
      }
    }
  }
  return top;
}

/** Sum of height changes along the skyline: a plain box is 2×height, a broken roofline is much more. */
const totalVariation = (line: readonly number[]) => line.slice(1).reduce((s, h, i) => s + Math.abs(h - line[i]), 0);
/** Distinct roof-line levels (rounded to 0.5 m) — how many different heights the silhouette steps between. */
const levels = (line: readonly number[]) => new Set(line.filter((h) => h > 0.5).map((h) => Math.round(h * 2))).size;

describe("design tiers", () => {
  it("luxury and estate silhouettes are visibly richer than starter", () => {
    const starter = design("A starter home");
    const comfort = design("A family home");
    const luxury = design("A luxury house");
    const estate = design("A grand estate mansion");

    expect(starter.site.settings?.designTier).toBe("starter");
    expect(comfort.site.settings?.designTier).toBe("comfort");
    expect(luxury.site.settings?.designTier).toBe("luxury");
    expect(estate.site.settings?.designTier).toBe("estate");

    const rich = (d: ReturnType<typeof design>) => totalVariation(skyline(d.primitives, "x")) + totalVariation(skyline(d.primitives, "z"));
    const steps = (d: ReturnType<typeof design>) => levels(skyline(d.primitives, "x")) + levels(skyline(d.primitives, "z"));
    expect(rich(luxury)).toBeGreaterThan(rich(starter) * 1.15);
    expect(rich(estate)).toBeGreaterThan(rich(luxury));
    expect(steps(luxury)).toBeGreaterThan(steps(starter));
    expect(steps(estate)).toBeGreaterThanOrEqual(steps(luxury));
    // More parts, too.
    expect(luxury.primitives.length).toBeGreaterThan(starter.primitives.length);
    expect(estate.primitives.length).toBeGreaterThan(luxury.primitives.length);
  });

  it("adds layered roof and curved parts as ordinary features only at the tiers that call for them", () => {
    const starter = design("A starter home");
    const luxury = design("A luxury house");
    const estate = design("A grand estate mansion");

    for (const key of ["arches", "curvedWalls", "crossGables"]) expect(count(starter.root, key)).toBe(0);
    expect(count(starter.root, "dormers")).toBe(0);
    expect(count(luxury.root, "dormers")).toBeGreaterThan(0);
    expect(count(luxury.root, "bays")).toBeGreaterThan(0);
    expect(count(luxury.root, "foundations")).toBe(1);
    expect(count(estate.root, "arches")).toBeGreaterThanOrEqual(2);
    expect(count(estate.root, "crossGables")).toBe(1);
    expect(count(estate.root, "curvedWalls")).toBe(1);
    expect((estate.root.bays as { form: string }[]).some((b) => b.form === "turret")).toBe(true);
    // Curved outlines on the outdoor features the model added.
    expect((estate.root.pools as { shape?: string }[]).every((p) => p.shape && p.shape !== "rectangle")).toBe(true);
  });

  it("never gives a starter the ornate parts, even when the model asks for them", () => {
    const greedy = modelOutput({
      operations: [
        ...modelOutput().operations,
        { op: "addArch", value: { wall: "south", level: 0, offset: 3, width: 3, height: 3, depth: 0.4 } },
        { op: "addCurvedWall", value: { x: 12, z: 0, radius: 6, startAngle: 0, sweep: 90, height: 2, thickness: 0.4 } },
        { op: "addBay", value: { wall: "south", level: 0, offset: 8, width: 3, depth: 2, levels: 1, form: "turret" } },
      ],
    });
    const starter = design("A starter home", greedy);
    expect(count(starter.root, "arches")).toBe(0);
    expect(count(starter.root, "curvedWalls")).toBe(0);
    expect(count(starter.root, "bays")).toBe(0);
  });

  it("reads the tier from the brief and defaults to comfort", () => {
    expect(inferSiteHints("a luxury villa").designTier).toBe("luxury");
    expect(inferSiteHints("an estate with grounds").designTier).toBe("estate");
    expect(inferSiteHints("an affordable starter home").designTier).toBe("starter");
    expect(inferSiteHints("a cabin by a lake").designTier).toBeUndefined();
    expect(resolveTier(undefined)).toBe(DEFAULT_DESIGN_TIER);
    expect(resolveTier("nonsense")).toBe("comfort");
    expect(DESIGN_TIERS).toEqual(["starter", "comfort", "luxury", "estate"]);
  });

  it("puts more into the surface detail at higher tiers", () => {
    const starter = design("A starter home");
    const luxury = design("A luxury house");
    const bevelled = (p: HousePrimitive[]) => p.filter((x) => x.kind === "box" && (x.bevel ?? 0) > 0).length;
    expect(bevelled(starter.primitives)).toBe(0);
    expect(bevelled(luxury.primitives)).toBeGreaterThan(20);
    const reveals = (p: HousePrimitive[]) => p.filter((x) => x.id.includes("-reveal-")).length;
    expect(reveals(starter.primitives)).toBe(0);
    expect(reveals(luxury.primitives)).toBeGreaterThan(0);
    const roofLayers = (p: HousePrimitive[]) => p.filter((x) => /^roof-(soffit|drip|crown|ridge-cap)/.test(x.id)).length;
    expect(roofLayers(starter.primitives)).toBe(0);
    expect(roofLayers(luxury.primitives)).toBeGreaterThan(0);
  });
});

// ── Independent editing ───────────────────────────────────────────────────────────────────────────────────────

describe("independently editable parts", () => {
  const estate = design("A grand estate mansion");
  const withIds = (root: Record<string, unknown>, key: string) => (root[key] as { id: string }[]).map((i) => i.id);

  it("gives every curved and arched part a stable id and its own primitives", () => {
    for (const key of ["bays", "arches", "curvedWalls", "crossGables", "dormers", "foundations"]) {
      const ids = (estate.root[key] as { id?: string }[]).map((i) => i.id);
      expect(ids.every((id) => typeof id === "string" && id.length > 0), key).toBe(true);
    }
    const turret = estate.primitives.filter((p) => parseFeatureMeshId(p.id)?.type === "bay");
    expect(turret.length).toBeGreaterThan(3);
    const arch = estate.primitives.filter((p) => parseFeatureMeshId(p.id)?.type === "arch");
    expect(arch.length).toBeGreaterThan(3);
    // No two primitives share an id.
    expect(new Set(estate.primitives.map((p) => p.id)).size).toBe(estate.primitives.length);
  });

  it("editing one arch changes only that arch", () => {
    const [first] = withIds(estate.root, "arches");
    const patched = applyPatch(estate.json, [{ op: "updateArch", id: first, fields: { height: 4.2, width: 3.6 } }]);
    expect(patched.errors).toEqual([]);
    const before = estate.root;
    const after = JSON.parse(patched.json) as Record<string, unknown>;

    // Every other array and the house itself are untouched, byte for byte.
    for (const key of Object.keys(before).filter((k) => k !== "arches")) expect(JSON.stringify(after[key]), key).toBe(JSON.stringify(before[key]));
    const [a0, ...rest] = after.arches as Record<string, unknown>[];
    const [b0, ...restBefore] = before.arches as Record<string, unknown>[];
    expect(a0.id).toBe(b0.id);
    expect(a0.height).toBe(4.2);
    expect(rest).toEqual(restBefore);

    const regenerated = generateHouseFromJson(patched.json);
    expect(regenerated.errors).toEqual([]);
    const primsOf = (prims: HousePrimitive[], prefix: string) => JSON.stringify(prims.filter((p) => p.id.startsWith(prefix)));
    expect(primsOf(regenerated.model!.primitives, "arch-0-")).not.toBe(primsOf(estate.primitives, "arch-0-"));
    expect(primsOf(regenerated.model!.primitives, "arch-1-")).toBe(primsOf(estate.primitives, "arch-1-"));
    expect(primsOf(regenerated.model!.primitives, "bay-")).toBe(primsOf(estate.primitives, "bay-"));
    expect(primsOf(regenerated.model!.primitives, "curvedWall-")).toBe(primsOf(estate.primitives, "curvedWall-"));
  });

  it("editing the turret changes its height and nothing else", () => {
    const bays = estate.root.bays as { id: string; form: string; levels: number }[];
    const turret = bays.find((b) => b.form === "turret")!;
    const patched = applyPatch(estate.json, [{ op: "updateBay", id: turret.id, fields: { levels: 2 } }]);
    const after = JSON.parse(patched.json) as { bays: { id: string; levels: number }[] };
    expect(after.bays.find((b) => b.id === turret.id)!.levels).toBe(2);
    expect(after.bays.filter((b) => b.id !== turret.id)).toEqual(bays.filter((b) => b.id !== turret.id));
    expect(generateHouseFromJson(patched.json).errors).toEqual([]);
  });

  it("keeps the AI's scope narrow: a curved-part edit can only touch that part", () => {
    const scope = classifyPromptTarget("make the turret taller");
    expect(scope.featureTypes).toEqual(["bay"]);
    const { allowed, rejected } = partitionOpsForScope(
      [
        { op: "updateBay", id: "x", fields: { levels: 3 } },
        { op: "updateArch", id: "y", fields: { width: 4 } },
        { op: "setMaterials", fields: { exterior: { color: "#ffffff" } } },
      ],
      scope,
      { bay: new Set(["x"]) }
    );
    expect(allowed.map((o) => o.op)).toEqual(["updateBay"]);
    expect(rejected.length).toBe(2);

    expect(classifyPromptTarget("add three arches along the south wall").featureTypes).toEqual(["arch"]);
    expect(classifyPromptTarget("add dormers to the roof").featureTypes).toContain("dormer");
    expect(classifyPromptTarget("widen the river").featureTypes).toEqual(["waterway"]);
    expect(classifyPromptTarget("make the path curve more").featureTypes).toEqual(["path"]);
    expect(classifyPromptTarget("add a cross gable on the front roof").featureTypes).toEqual(["crossGable"]);
    expect(classifyPromptTarget("add a retaining wall behind the house").featureTypes).toEqual(["retainingWall"]);
    expect(scopeFromHint({ kind: "feature", featureType: "bay", filter: { indices: [0] } }, "taller").featureTypes).toEqual(["bay"]);
  });

  it("validates the new operations' payloads with the same schemas the model sees", () => {
    const good = validateOperations(
      [
        { op: "addBay", value: { wall: "south", level: 0, offset: 2, width: 3, depth: 1, levels: 1, form: "angled" } },
        { op: "addWaterway", value: { kind: "river", x1: -40, z1: 20, x2: 40, z2: 20, width: 7, bend: 3, meander: 0.5 } },
        { op: "addPath", value: { x1: 0, z1: 8, x2: 3, z2: 22, width: 1.4, bend: 3, surface: "gravel" } },
      ],
      WORLD_SCOPE
    );
    expect(good.invalid).toEqual([]);
    const bad = validateOperations([{ op: "addBay", value: { wall: "south", level: 0, offset: 2, width: 3, depth: 1, levels: 1, form: "pagoda" } }], WORLD_SCOPE);
    expect(bad.invalid.length).toBe(1);
    const prompt = describeOperationPayloads(WORLD_SCOPE);
    for (const op of ["addBay", "addArch", "addFoundation", "addStairs", "addDormer", "addCrossGable", "addCurvedWall", "addRetainingWall", "addPath", "addWaterway", "addRockCluster", "addSlope"]) {
      expect(prompt, op).toContain(`- ${op}`);
    }
    expect(buildGenerationSystemPrompt([])).toContain("DESIGN TIER");
    expect(buildGenerationSystemPrompt([])).toContain("CONTEXTUAL TERRAIN");
  });
});

// ── Terrain ───────────────────────────────────────────────────────────────────────────────────────────────────

describe("contextual terrain", () => {
  const cabinOutput = (extra: Partial<AiGenerationResponse> = {}): AiGenerationResponse =>
    modelOutput({ house: { width: 9, depth: 7, floors: 1, roof: "gable" }, site: { environment: "forest", viewDirection: "south", terrainSlope: "flat", approachSide: "north" }, ...extra });

  it("a cabin beside a river produces a procedural river and a site composition around it", () => {
    const cabin = design("A cozy cabin beside a river", cabinOutput());
    const waterways = cabin.root.waterways as { kind: string; id: string }[];
    expect(waterways).toHaveLength(1);
    expect(waterways[0].kind).toBe("river");
    expect(waterways[0].id).toBeTruthy();

    const water = cabin.primitives.find((p) => p.id === "waterway-0-water");
    expect(water?.kind).toBe("triMesh");
    expect(cabin.primitives.some((p) => p.id === "waterway-0-lips")).toBe(true);
    expect(cabin.primitives.some((p) => p.id === "waterway-0-stones")).toBe(true);
    // It ties into the site: a path down to the bank, a cabin style, a forest.
    expect(count(cabin.root, "paths")).toBe(1);
    expect(cabin.site.settings?.environment).toBe("forest");
    expect(cabin.site.exteriorOptions?.style).toBe("cabin");

    // The river runs clear of the cabin and everything built beside it.
    const river = cabin.site.waterways![0];
    const centre = waterwayCurve(river, 0);
    const minGap = (rect: { cx: number; cz: number; halfW: number; halfD: number }) =>
      Math.min(...centre.map(([x, z]) => Math.max(Math.abs(x - rect.cx) - rect.halfW, Math.abs(z - rect.cz) - rect.halfD)));
    const others = collectOccupiedFootprints({ ...cabin.site, waterways: [], paths: [] });
    for (const rect of others) expect(minGap(rect) - river.width / 2, JSON.stringify(rect)).toBeGreaterThan(1.5);
  });

  it("scenery keeps out of the river", () => {
    const cabin = design("A cozy cabin beside a river", cabinOutput());
    const footprints = collectOccupiedFootprints(cabin.site);
    const centre = waterwayCurve(cabin.site.waterways![0], 0);
    for (const t of generateTrees(cabin.site, planTerrain(cabin.site)?.yardTrees)) {
      const nearest = Math.min(...centre.map(([x, z]) => Math.hypot(x - t.position[0], z - t.position[1])));
      expect(nearest).toBeGreaterThan(cabin.site.waterways![0].width / 2);
      expect(isInsideAnyFootprint(t.position[0], t.position[1], footprints)).toBe(false);
    }
  });

  it("only adds terrain the brief calls for", () => {
    const plain = design("A suburban family home", modelOutput({ site: { environment: "suburban", viewDirection: "south", terrainSlope: "flat", approachSide: "north" } }));
    for (const key of ["waterways", "rocks", "slopes", "retainingWalls"]) expect(count(plain.root, key), key).toBe(0);
    expect((plain.root.landscaping as { kind: string }[] | undefined ?? []).some((l) => l.kind === "clearing")).toBe(false);

    const glade = design("A cabin in a forest clearing with rocky outcrops", cabinOutput());
    expect(count(glade.root, "rocks")).toBe(1);
    expect((glade.root.landscaping as { kind: string }[]).some((l) => l.kind === "clearing")).toBe(true);
    expect(count(glade.root, "waterways")).toBe(0);
  });

  it("does not add a second river when the model already drew one", () => {
    const own = cabinOutput({
      operations: [...cabinOutput().operations, { op: "addWaterway", value: { kind: "stream", x1: -50, z1: 20, x2: 50, z2: 22, width: 3, bend: 2, meander: 0.5 } }],
    });
    expect(count(design("A cabin by a stream", own).root, "waterways")).toBe(1);
  });

  it("ground is no longer dead flat on open land, but stays level under buildings and features", () => {
    const cabin = design("A cozy cabin beside a river", cabinOutput());
    const plan = planTerrain(cabin.site)!;
    expect(plan.relief).toBeGreaterThan(0);
    let raised = 0;
    let max = 0;
    for (let x = -120; x <= 120; x += 4) {
      for (let z = -120; z <= 120; z += 4) {
        const h = terrainHeightAt(plan, x, z);
        expect(h).toBeGreaterThanOrEqual(0);
        max = Math.max(max, h);
        if (h > 0.05) raised++;
      }
    }
    expect(raised).toBeGreaterThan(50);
    expect(max).toBeLessThan(plan.relief + 0.01);
    for (const f of plan.avoid) expect(terrainHeightAt(plan, f.cx, f.cz)).toBe(0);
    expect(terrainHeightAt(plan, 0, 0)).toBe(0);
    const mesh = buildRollingMesh(plan);
    expect(mesh && mesh.positions.length).toBeGreaterThan(0);
    expect(mesh!.positions.every(Number.isFinite)).toBe(true);
  });

  it("starter land rolls less than estate land", () => {
    const relief = (brief: string) => planTerrain(design(brief, cabinOutput()).site)!.relief;
    expect(relief("A starter cabin")).toBeLessThan(relief("An estate lodge"));
  });
});

// ── Every new geometry type ────────────────────────────────────────────────────────────────────────────────────

describe("feature geometry", () => {
  const NEW_TYPES = FEATURE_TYPES.filter((t) =>
    ["curvedWall", "arch", "bay", "foundation", "stairs", "dormer", "crossGable", "retainingWall", "path", "waterway", "rockCluster", "slope"].includes(t)
  );

  function project(roof: RoofType, extra: Record<string, unknown[]> = {}) {
    return JSON.stringify({
      house: { width: 14, depth: 10, floors: 2, roof },
      site: { environment: "countryside", viewDirection: "south", terrainSlope: "flat", approachSide: "north", designTier: "estate" },
      materials: { exterior: { material: "stone", color: "#d6cfbf" }, roof: { material: "slate", color: "#454a50" }, trim: { material: "wood", color: "#6b4d2a" }, decking: { material: "wood", color: "#c8a070" } },
      doors: [{ wall: "north", level: 0, offset: 6, width: 1.1, height: 2.1 }],
      ...extra,
    });
  }

  for (const type of NEW_TYPES) {
    it(`${type}: default config validates cleanly and builds finite, uniquely-named geometry`, () => {
      const house = { width: 14, depth: 10, floors: 2, roof: "gable" as RoofType };
      const config = getDefaultFeatureConfig(type, house);
      const check = FEATURE_MODULES[type].validate(config, house);
      expect(check.errors).toEqual([]);
      expect(check.warnings).toEqual([]);

      const result = generateHouseFromJson(project("gable", { [FEATURE_JSON_KEY[type]]: [{ id: "f1", ...config }] }));
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      const own = result.model!.primitives.filter((p) => parseFeatureMeshId(p.id)?.type === type);
      expect(own.length, `${type} primitives`).toBeGreaterThan(0);
      expect(new Set(result.model!.primitives.map((p) => p.id)).size).toBe(result.model!.primitives.length);
      for (const p of own) {
        const numbers = p.kind === "box" ? [...p.position, ...p.size, ...p.rotation] : p.vertices;
        expect(numbers.every(Number.isFinite), p.id).toBe(true);
        if (p.kind === "triMesh") expect(p.vertices.length % 9, p.id).toBe(0);
      }
    });
  }

  it("dormers and cross gables need a pitched roof and draw nothing on a flat one", () => {
    const flat = generateHouseFromJson(project("flat", { dormers: [{ id: "d", wall: "south", offset: 4, width: 2 }], crossGables: [{ id: "c", wall: "south", offset: 4, width: 4 }] }));
    expect(flat.errors).toEqual([]);
    expect(flat.warnings.some((w) => /Needs a "gable" or "hip" roof/.test(w))).toBe(true);
    expect(flat.model!.primitives.some((p) => /^(dormer|crossGable)-/.test(p.id))).toBe(false);
    // On a gable roof the same items draw.
    const gable = generateHouseFromJson(project("gable", { dormers: [{ id: "d", wall: "south", offset: 4, width: 2 }] }));
    expect(gable.model!.primitives.some((p) => p.id.startsWith("dormer-0-"))).toBe(true);
  });

  it("a dormer stands on the roof, below the ridge", () => {
    const res = generateHouseFromJson(project("gable", { dormers: [{ id: "d", wall: "south", offset: 4, width: 2 }] }));
    const ridge = res.model!.primitives.find((p) => p.id === "roof-slope-south");
    const ridgeY = Math.max(...(ridge as { vertices: number[] }).vertices.filter((_, i) => i % 3 === 1));
    const dormer = res.model!.primitives.filter((p) => p.id.startsWith("dormer-0-") && p.kind === "triMesh") as { vertices: number[] }[];
    const top = Math.max(...dormer.flatMap((p) => p.vertices.filter((_, i) => i % 3 === 1)));
    expect(top).toBeLessThan(ridgeY);
    expect(top).toBeGreaterThan(ridgeY * 0.6);
  });

  /** Axis-aligned bounds of everything a feature drew (box extents ignore rotation, which is fine for these checks). */
  function bounds(prims: HousePrimitive[], prefix: string) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const add = (x: number, y: number, z: number) => [x, y, z].forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); });
    for (const p of prims.filter((q) => q.id.startsWith(prefix))) {
      if (p.kind === "box") {
        const [hx, hy, hz] = p.size.map((v) => v / 2);
        add(p.position[0] - hx, p.position[1] - hy, p.position[2] - hz);
        add(p.position[0] + hx, p.position[1] + hy, p.position[2] + hz);
      } else for (let i = 0; i < p.vertices.length; i += 3) add(p.vertices[i], p.vertices[i + 1], p.vertices[i + 2]);
    }
    return { min, max };
  }
  const built = (extra: Record<string, unknown[]>) => generateHouseFromJson(project("gable", extra)).model!.primitives;
  // The project() house is 14 × 10 × 2 floors, so its walls sit at x = ±7 and z = ±5.

  it.each([
    ["south", (b: ReturnType<typeof bounds>) => b.max[2] > 5.5 && b.min[2] > 4.9],
    ["north", (b: ReturnType<typeof bounds>) => b.min[2] < -5.5 && b.max[2] < -4.9],
    ["east", (b: ReturnType<typeof bounds>) => b.max[0] > 7.5 && b.min[0] > 6.9],
    ["west", (b: ReturnType<typeof bounds>) => b.min[0] < -7.5 && b.max[0] < -6.9],
  ])("a bay on the %s wall projects outward from that wall", (wall, ok) => {
    const b = bounds(built({ bays: [{ id: "b", wall, level: 0, offset: 2, width: 3, depth: 1.2, levels: 1, form: "angled" }] }), "bay-0-body");
    expect(ok(b), JSON.stringify(b)).toBe(true);
  });

  it("a turret reaches above the eaves and its roof is a cone above that", () => {
    const prims = built({ bays: [{ id: "b", wall: "north", level: 0, offset: 0, width: 3.4, depth: 2.8, levels: 3, form: "turret" }] });
    const body = bounds(prims, "bay-0-body");
    expect(body.max[1]).toBeCloseTo(3 * 3.2, 5); // three storeys, one above the two-storey house
    const roof = bounds(prims, "bay-0-roof");
    expect(roof.max[1]).toBeGreaterThan(body.max[1] + 2);
    expect(body.min[2]).toBeCloseTo(-5 - 2.8, 1);
  });

  it("an arch stands on its wall with a recess behind a surround that projects by its depth", () => {
    const prims = built({ arches: [{ id: "a", wall: "south", level: 0, offset: 4, width: 3.2, height: 3.1, depth: 0.4 }] });
    const all = bounds(prims, "arch-0-");
    expect(all.min[0]).toBeCloseTo(-7 + 4, 1);
    expect(all.max[0]).toBeCloseTo(-7 + 4 + 3.2, 1);
    expect(all.max[2]).toBeCloseTo(5 + 0.4 + 0.03, 1); // keystone stands proud of the surround
    expect(bounds(prims, "arch-0-void").max[2]).toBeCloseTo(5.02, 2);
    expect(all.max[1]).toBeGreaterThan(3.2);
  });

  it.each(["straight", "curved", "angled"] as const)("%s stairs climb to their rise, away from the wall", (form) => {
    const prims = built({ stairs: [{ id: "s", wall: "south", offset: 6, width: 2, rise: 0.9, form, turn: "right" }] });
    const b = bounds(prims, "stairs-0-");
    expect(b.max[1]).toBeCloseTo(0.9, 2);
    expect(b.min[2]).toBeGreaterThanOrEqual(4.99); // never inside the house
    expect(b.max[2]).toBeGreaterThan(5.8);
  });

  it("a stepped foundation rings the house and its tiers climb toward the wall", () => {
    const prims = built({ foundations: [{ id: "f", steps: 3, riser: 0.15, projection: 0.2 }] });
    const b = bounds(prims, "foundation-0-");
    expect(b.max[0]).toBeCloseTo(7 + 0.6, 2);
    expect(b.min[0]).toBeCloseTo(-7 - 0.6, 2);
    expect(b.max[1]).toBeCloseTo(0.45, 2);
    const tops = [0, 1, 2].map((t) => bounds(prims, `foundation-0-tier-${t}-`).max[1]);
    expect(tops[0]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[2]);
  });

  it("the foundation leaves the ground-floor door clear", () => {
    const prims = built({ foundations: [{ id: "f", steps: 2, riser: 0.15, projection: 0.2 }] });
    // The project's door is on the north wall at offset 6, 1.1 wide (x from -1 to 0.1).
    for (const p of prims.filter((q) => q.id.startsWith("foundation-0-") && q.id.includes("-north-") && q.kind === "box")) {
      const box = p as { position: number[]; size: number[] };
      const overlaps = box.position[0] - box.size[0] / 2 < 0.1 && box.position[0] + box.size[0] / 2 > -1;
      expect(overlaps, p.id).toBe(false);
    }
  });

  it("curved and retaining walls follow their arc and line", () => {
    const prims = built({
      curvedWalls: [{ id: "c", x: 0, z: 20, radius: 8, startAngle: 0, sweep: 180, height: 2.4, thickness: 0.4 }],
      retainingWalls: [{ id: "r", x1: -10, z1: -12, x2: 10, z2: -12, height: 1.5, thickness: 0.4, bend: 3 }],
    });
    const arc = prims.find((p) => p.id === "curvedWall-0-wall") as { vertices: number[] };
    for (let i = 0; i < arc.vertices.length; i += 3) {
      const r = Math.hypot(arc.vertices[i], arc.vertices[i + 2] - 20);
      expect(r).toBeGreaterThan(7.55);
      expect(r).toBeLessThan(8.01);
    }
    const rw = bounds(prims, "retainingWall-0-wall");
    expect(rw.max[1]).toBeCloseTo(1.5, 2);
    expect(rw.max[2] + 12).toBeGreaterThan(2.5); // a positive bend bows it toward +z, well off the straight line z = −12
  });

  it("a river runs beside the house at the ground, with the water below the bank lips", () => {
    const prims = built({ waterways: [{ id: "w", kind: "river", x1: -40, z1: 20, x2: 40, z2: 20, width: 6, bend: 3, meander: 0.4 }] });
    const water = bounds(prims, "waterway-0-water");
    const lips = bounds(prims, "waterway-0-lips");
    expect(water.max[1]).toBeLessThan(lips.max[1]);
    expect(water.max[1]).toBeGreaterThan(0);
    expect(water.min[0]).toBeCloseTo(-40, 0);
    expect(water.max[0]).toBeCloseTo(40, 0);
  });

  it("curved pools and decks keep their ids and cut a matching hole in the ground", () => {
    const res = generateHouseFromJson(
      project("gable", {
        pools: [{ id: "p", wall: "south", offset: 3, distance: 3, width: 8, depth: 4, waterDepth: 1.4, shape: "kidney" }],
        decks: [{ id: "d", x: -14, z: 0, level: 0, width: 6, depth: 4, shape: "arc" }],
      })
    );
    expect(res.errors).toEqual([]);
    const ids = res.model!.primitives.map((p) => p.id);
    for (const id of ["pool-0-floor", "pool-0-water", "pool-0-shell", "pool-0-deck", "deck-0-slab"]) expect(ids).toContain(id);
    const water = res.model!.primitives.find((p) => p.id === "pool-0-water");
    expect(water?.kind).toBe("triMesh");
  });

  it("curved driveways and roads keep their ids", () => {
    const res = generateHouseFromJson(
      project("gable", {
        driveways: [{ id: "d", wall: "north", offset: 2, width: 3, length: 14, bend: 3 }],
        roads: [{ id: "r", x1: 0, z1: 20, x2: 30, z2: 30, width: 5, bend: -4 }],
      })
    );
    expect(res.errors).toEqual([]);
    const ids = res.model!.primitives.map((p) => p.id);
    expect(ids).toContain("driveway-0-slab");
    expect(ids).toContain("road-0-segment");
    expect(res.model!.primitives.find((p) => p.id === "driveway-0-slab")?.kind).toBe("triMesh");
  });
});

// ── Compatibility ─────────────────────────────────────────────────────────────────────────────────────────────

describe("existing projects", () => {
  /** A project saved before tiers, curves and terrain features existed. */
  const LEGACY = JSON.stringify({
    house: { width: 12, depth: 9, floors: 2, roof: "hip" },
    site: { environment: "hillside", viewDirection: "east", terrainSlope: "gentle", approachSide: "west" },
    materials: { exterior: { material: "stucco", color: "#f5f2ec" }, roof: { material: "tile", color: "#5a7a9c" }, trim: { material: "wood", color: "#6b4d2a" }, decking: { material: "wood", color: "#c8a070" } },
    windows: [{ wall: "south", level: 0, offset: 2, width: 1.2, height: 1.4, sill: 0.9 }],
    doors: [{ wall: "west", level: 0, offset: 4, width: 1, height: 2.1 }],
    garages: [], balconies: [], patios: [{ wall: "east", offset: 1, width: 6, depth: 3 }],
    pools: [{ wall: "east", offset: 2, distance: 3, width: 6, depth: 3, waterDepth: 1.4 }],
    driveways: [{ wall: "west", offset: 1, width: 3, length: 10 }],
    rooms: [], buildings: [], roads: [{ x1: 0, z1: 20, x2: 0, z2: 40, width: 5 }], parking: [], landscaping: [{ kind: "lawn", x: 0, z: 14, width: 10, depth: 6 }],
    decks: [{ x: 0, z: -12, level: 0, width: 5, depth: 4 }],
  });

  it("still loads with no errors or warnings, and reads as the baseline tier", () => {
    const res = generateHouseFromJson(LEGACY);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.site!.settings?.designTier).toBeUndefined();
    expect(res.site!.waterways).toEqual([]);
    expect(res.model!.primitives.length).toBeGreaterThan(50);
  });

  it("keeps every pre-existing primitive id, and rectangular pools/decks/driveways/roads keep their box geometry", () => {
    const res = generateHouseFromJson(LEGACY);
    const byId = new Map(res.model!.primitives.map((p) => [p.id, p]));
    for (const id of ["window-0-frame", "window-0-glass", "door-0-panel", "pool-0-water", "pool-0-floor", "pool-0-deck-north", "driveway-0-slab", "road-0-segment", "deck-0-slab", "landscape-0-zone"]) {
      expect(byId.has(id), id).toBe(true);
    }
    expect([...byId.keys()].some((id) => id.startsWith("patio-0-")), "patio").toBe(true);
    expect([...byId.keys()].some((id) => id.startsWith("roof-")), "roof").toBe(true);
    for (const id of ["pool-0-water", "driveway-0-slab", "road-0-segment", "deck-0-slab"]) expect(byId.get(id)?.kind, id).toBe("box");
  });

  it("does not change a project's JSON just by opening it, and unknown tiers fall back safely", () => {
    const withBadTier = JSON.stringify({ ...JSON.parse(LEGACY), site: { environment: "forest", viewDirection: "south", terrainSlope: "flat", approachSide: "north", designTier: "platinum" } });
    const res = generateHouseFromJson(withBadTier);
    expect(res.errors).toEqual([]);
    expect(res.warnings.some((w) => /designTier/.test(w))).toBe(true);
    expect(res.site!.settings?.designTier).toBeUndefined();
  });

  it("an old project can be upgraded a tier with one setSite edit, changing detail but not features", () => {
    const before = generateHouseFromJson(LEGACY);
    const patched = applyPatch(LEGACY, [{ op: "setSite", fields: { designTier: "luxury" } }]);
    const after = generateHouseFromJson(patched.json);
    expect(after.errors).toEqual([]);
    expect(after.site!.settings?.designTier).toBe("luxury");
    // Same features (nothing added or removed), richer detail.
    expect(JSON.stringify({ ...JSON.parse(patched.json), site: null })).toBe(JSON.stringify({ ...JSON.parse(LEGACY), site: null }));
    expect(after.model!.primitives.length).toBeGreaterThan(before.model!.primitives.length);
  });
});

// ── Robustness: rules never produce a design the renderer would reject ───────────────────────────────────────────

describe("generation rules are valid across footprints, roofs and tiers", () => {
  const ROOFS: RoofType[] = ["flat", "gable", "hip", "mansard", "shed", "butterfly", "sawtooth"];
  const SIZES: [number, number, number][] = [[6, 6, 1], [8, 6, 1], [10, 8, 1], [14, 9, 2], [9, 14, 2], [20, 12, 2], [12, 12, 3], [30, 18, 2], [7, 20, 1]];
  const SIDES = [["south", "north"], ["east", "west"], ["north", "south"], ["west", "east"]] as const;
  const BRIEFS = ["A starter home", "A family home", "A luxury house", "A grand estate", "A luxury cabin beside a river", "An estate in a forest clearing with rocks"];

  it("assembles without validation errors", () => {
    let n = 0;
    for (const roof of ROOFS) {
      for (const [w, d, f] of SIZES) {
        for (const [view, approach] of SIDES) {
          for (const brief of BRIEFS) {
            const out = modelOutput({ house: { width: w, depth: d, floors: f, roof }, site: { environment: "countryside", viewDirection: view, terrainSlope: "flat", approachSide: approach } }, roof);
            const result = assembleGeneratedProject(structuredClone(out), [], brief);
            if (!result.ok) throw new Error(`${brief} | ${w}x${d}x${f} ${roof} view=${view}: ${result.errors.join("; ")}`);
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });
});

it("scoped edit prompts describe the new parts only where they apply", async () => {
  const { buildScopedSystemPrompt } = await import("@/lib/ai/systemPrompt");
  const { makeScopeForFeature } = await import("@/lib/ai/targeting");
  const world = buildScopedSystemPrompt(WORLD_SCOPE);
  expect(world).toContain("DESIGN TIER");
  expect(world).toContain("CONTEXTUAL TERRAIN");
  expect(world).toContain("CURVED, ARCHED AND LAYERED PARTS");
  const bay = buildScopedSystemPrompt(makeScopeForFeature("bay"));
  expect(bay).toContain("CURVED, ARCHED AND LAYERED PARTS");
  expect(bay).toContain("- updateBay");
  expect(bay).not.toContain("CONTEXTUAL TERRAIN");
  const river = buildScopedSystemPrompt(makeScopeForFeature("waterway"));
  expect(river).toContain("CONTEXTUAL TERRAIN");
  expect(river).toContain("- addWaterway");
  // A one-window edit pays for none of it.
  expect(buildScopedSystemPrompt(makeScopeForFeature("window"))).not.toContain("CONTEXTUAL TERRAIN");
});

it("SiteConfig arrays for the new features are always present after generation", () => {
  const site: SiteConfig = design("A luxury house").site;
  for (const key of ["curvedWalls", "arches", "bays", "foundations", "stairs", "dormers", "crossGables", "retainingWalls", "paths", "waterways", "rocks", "slopes"] as const) {
    expect(Array.isArray(site[key]), key).toBe(true);
  }
});
