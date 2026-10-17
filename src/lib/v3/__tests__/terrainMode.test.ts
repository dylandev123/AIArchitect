import attempt0 from "./fixtures/cliffside-mansion-attempt-0.json";
import attempt1 from "./fixtures/cliffside-mansion-attempt-1.json";
import { describe, expect, it } from "vitest";
import { ingestV3GenerationOutput } from "../ingestion";
import { recoverV3FailedPreview } from "../failedPreview";
import { compileV3Scene } from "../scene";
import { resolveV3SiteGrading } from "../elevation";
import { v3SceneArchitectPrompt, V3_SCENE_ARCHITECT_PROMPT, v3SceneOutputSchema } from "../schema";

import { flatMansion, material, object } from "./flatMansionFixture";

describe("new-generation terrain policy", () => {
  it("keeps multi-storey architecture, pools, decks, gardens and driveways on a flat site", () => {
    const raw = flatMansion();
    const before = JSON.stringify(raw);
    const result = ingestV3GenerationOutput(raw, "flat");
    expect(result.validation.errors).toEqual([]);
    expect(result.geometryAudit?.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.scene.site).toMatchObject({ baseElevation: 0, naturalGround: { elevation: 0, grade: 0 } });
    expect(result.scene.siteHierarchy).toBeUndefined();
    expect(result.scene.objects.map(o => o.id)).toEqual(raw.objects.map(o => o.id));
    for (const authored of raw.objects) expect(result.scene.objects.find(o => o.id === authored.id)?.architecture).toEqual(authored.architecture);
    expect(result.scene.objects[0].levels).toBe(3);
    const grading = resolveV3SiteGrading(result.scene);
    expect(grading.walls).toHaveLength(0);
    for (const [x, z] of [[-60, -60], [0, 0], [60, 60]]) expect(grading.graded(x, z)).toBe(0);
    expect(compileV3Scene(result.scene).primitives.length).toBeGreaterThan(20);
    expect(JSON.stringify(raw)).toBe(before);
    const preview = recoverV3FailedPreview(raw, [], "flat")!;
    expect(preview.scene.site).toEqual(result.scene.site);
    expect(preview.scene.objects.map(o => o.architecture)).toEqual(result.scene.objects.map(o => o.architecture));
  });
  it("canonicalizes every natural-ground variant without moving authored architecture", () => {
    const raw = { ...flatMansion(), site: { width: 160, depth: 160, baseElevation: 25, naturalGrade: .8, naturalFall: "z", cliffAt: 30, cliffDrop: 20, seaLevel: -10, naturalGround: { elevation: 20, grade: .5, profile: [[0, 20], [40, 0]], ridge: 12 }, sea: { level: -5 } } };
    const result = ingestV3GenerationOutput(raw, "flat");
    expect(result.ok).toBe(true);
    expect(result.scene.site.sea).toBeUndefined();
    expect(result.scene.site.naturalGround).toEqual({ elevation: 0, grade: 0 });
    expect(result.scene.objects[1].architecture?.baseElevation).toBe(9);
  });
  it("rejects stepped terrain for repair without flattening or discarding elevated masses", () => {
    const raw = flatMansion();
    raw.objects[0].architecture.baseElevation = 12;
    const stepped = { ...raw, siteHierarchy: { levels: [{ id: "raised-pad", elevation: 12, region: { x: 0, z: 0, width: 30, depth: 30 }, supportType: "pad" }], connections: [], transitions: [] } };
    const before = JSON.stringify(stepped);
    const result = ingestV3GenerationOutput(stepped, "flat");
    expect(result.ok).toBe(false);
    expect(result.validation.errors.join(" ")).toContain("elevated site levels");
    expect(result.scene.objects[0].architecture?.baseElevation).toBe(12);
    expect(result.scene.objects).toHaveLength(8);
    expect(recoverV3FailedPreview(stepped, [], "flat")).toBeUndefined();
    expect(JSON.stringify(stepped)).toBe(before);
    expect(ingestV3GenerationOutput(stepped, "advanced")).toEqual(ingestV3GenerationOutput(stepped));
  });
  it("rejects terrain operations and retaining walls while preserving object identity", () => {
    const raw = flatMansion();
    raw.objects.push(object("retaining", "retaining-wall", 40, 30, 0, 15, 1, 8));
    raw.objects.push(object("slope", "terrain-region", 0, 0, 0, 100, 100, 1, { terrainOperation: "slopeRegion", terrainRise: 20 }));
    const result = ingestV3GenerationOutput(raw, "flat");
    expect(result.ok).toBe(false);
    expect(result.validation.errors.join(" ")).toContain("advanced terrain");
    expect(result.scene.objects).toHaveLength(10);
  });
  it("accepts a simple flat driveway connection with derived surface geometry", () => {
    const raw = flatMansion();
    const candidate = { ...raw, objects: [...raw.objects.filter(o => o.id !== "driveway"), { id: "driveway", type: "driveway", semanticRole: "arrival", label: "Driveway", material }], siteHierarchy: { levels: [
      { id: "entry", elevation: 0, region: { x: 0, z: 16, width: 8, depth: 8 }, supportType: "pad" },
      { id: "arrival", elevation: 0, region: { x: 0, z: 40, width: 8, depth: 8 }, supportType: "pad" },
    ], connections: [{ id: "drive-route", fromLevelId: "arrival", toLevelId: "entry", type: "driveway", width: 4, route: [[0, 0, 40], [0, 0, 16]], surfaceObjectId: "driveway" }] } };
    const result = ingestV3GenerationOutput(candidate, "flat");
    expect(result.validation.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.scene.objects.find(o => o.id === "driveway")?.dimensions).toBeDefined();
    expect(resolveV3SiteGrading(result.scene).walls).toHaveLength(0);
  });
  it.each([attempt0, attempt1])("retains captured cliffside functionality with explicit advanced mode", raw => {
    const advanced = ingestV3GenerationOutput(raw, "advanced");
    expect(advanced).toEqual(ingestV3GenerationOutput(raw));
    expect(advanced.ok).toBe(true);
    expect(advanced.scene.objects).toHaveLength(18);
    expect(advanced.scene.site.naturalGround?.cliff).toBeDefined();
    expect(advanced.scene.site.sea).toBeDefined();
    expect(resolveV3SiteGrading(advanced.scene).walls.length).toBeGreaterThan(0);
  });
  it("rejects unhosted elevated ordinary amenities without moving them", () => {
    const raw = flatMansion();
    raw.objects.find(o => o.id === "driveway")!.architecture.baseElevation = 20;
    raw.objects.find(o => o.id === "garden")!.architecture.baseElevation = 15;
    const result = ingestV3GenerationOutput(raw, "flat");
    expect(result.ok).toBe(false);
    expect(result.validation.errors.join(" ")).toContain("driveway");
    expect(result.validation.errors.join(" ")).toContain("garden");
    expect(result.scene.objects.find(o => o.id === "driveway")?.architecture?.baseElevation).toBe(20);
  });
  it("uses the same inferred flat datum for ingestion and preview when a base is omitted", () => {
    const raw = flatMansion();
    const candidate = { ...raw, objects: raw.objects.map(({ architecture, ...object }) => {
      if (object.id !== "garden") return { ...object, architecture };
      const { baseElevation: _base, ...geometry } = architecture;
      void _base;
      return { ...object, architecture: geometry };
    }) };
    const ingested = ingestV3GenerationOutput(candidate, "flat");
    const preview = recoverV3FailedPreview(candidate, [], "flat")!;
    expect(ingested.ok).toBe(true);
    expect(preview.scene.objects.map(o => o.architecture)).toEqual(ingested.scene.objects.map(o => o.architecture));
  });
  it("keeps the advanced prompt unchanged and makes site hierarchy optional in the contract", () => {
    expect(v3SceneArchitectPrompt("advanced")).toBe(V3_SCENE_ARCHITECT_PROMPT);
    expect(v3SceneArchitectPrompt("flat")).toContain("FLAT LAND CONTRACT");
    expect(v3SceneOutputSchema.safeParse(flatMansion()).success).toBe(true);
  });
});
