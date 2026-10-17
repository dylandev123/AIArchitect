import { describe, expect, it } from "vitest";
import { recoverV3FailedPreview } from "../failedPreview";
import { ingestV3GenerationOutput } from "../ingestion";
import { resolveV3Renderable } from "../renderability";
import { compileV3Scene } from "../scene";

const stone = { id: "cottage-stone", color: "#a89d8d", surface: "stone" };
const paving = { id: "cottage-paving", color: "#c5b8a5", surface: "paving" };
const planting = { id: "planting", color: "#477044", surface: "grass" };
const transform = (position: Array<number | string>) => ({ position, rotation: [0, "0", 0], scale: [1, 1, 1] });
const rawObject = (id: string, type: string, semanticRole: string, dimensions: Array<number | string>, position: Array<number | string>, extra: Record<string, unknown> = {}) => ({
  id, type, semanticRole, label: semanticRole, transform: transform(position), dimensions, material: stone, ...extra,
});

/**
 * Offline cottage-shaped raw Terra fixture. It deliberately reproduces the
 * captured failure classes rather than satisfying the provider Zod schema.
 */
function cottageRawFixture() {
  const objects: Record<string, unknown>[] = [
    rawObject("main-terrace-slab", "terrace-slab", "main cottage terrace slab", ["32", ".3", "12"], [0, ".15", 14], { material: paving, collision: "walkable", support: { kind: "object", levelId: "main-level", relationship: "rests-on", grounding: "grounded" } }),
    rawObject("pool-garden-terrace", "garden-terrace", "pool garden terrace", [26, .35, 11], [-24, .175, 25], { material: paving, collision: "walkable", support: { kind: "object", levelId: "main-level", relationship: "rests-on", grounding: "grounded" } }),
    rawObject("arrival-pad", "arrival-platform", "arrival pad", [18, .4, 14], [0, .2, -34], { material: paving, collision: "walkable", support: { kind: "object", levelId: "arrival-level", relationship: "rests-on", grounding: "grounded" } }),
    rawObject("pool-retaining-wall", "site-retaining-edge", "pool retaining wall", [28, 2.6, .45], [-24, 1.3, 31], { support: { kind: "object", levelId: "main-level", relationship: "attached-to", grounding: "grounded" } }),
    rawObject("arrival-retaining-wall", "site-retaining-edge", "arrival retaining wall", [20, 2.2, .4], [0, 1.1, -41]),
    rawObject("side-retaining-wall", "site-retaining-edge", "side retaining wall", [.45, 3, 34], [43, 1.5, 3]),
    rawObject("palm-cluster-west", "botanical-cluster", "west palm cluster", [8, 9, 8], [-42, 4.5, 8], { material: planting }),
    rawObject("palm-cluster-pool", "botanical-cluster", "pool palm cluster", [7, 8, 7], [-35, 4, 25], { material: planting }),
  ];
  for (let index = 0; index < 18; index++) objects.push(rawObject(`cottage-part-${index}`, index === 0 ? "roof-form" : "volume", index === 0 ? "flat cottage roof" : `cottage architectural part ${index}`, index === 0 ? [22, .4, 14] : [4, 3, 4], [index * 3 - 24, index === 0 ? 6.2 : 1.5, index % 5 - 2], index === 0 ? { roofForm: "flat" } : { support: { kind: "pad", levelId: "main-level", relationship: "none", grounding: "grounded" } }));
  return {
    version: "3",
    site: { width: "110", depth: "95", baseElevation: "0", groundColor: "#496c43" },
    siteHierarchy: {
      levels: [
        { id: "main-level", elevation: "0", region: { x: "0", z: "0", width: "100", depth: "80" }, supportType: "pad" },
        { id: "arrival-level", elevation: "0", region: { x: 0, z: -34, width: 24, depth: 18 }, supportType: "pad", access: "arrival" },
      ],
      connections: [],
    },
    objects,
  };
}

const primitiveFor = (id: string, primitives: ReturnType<typeof compileV3Scene>["primitives"]) => primitives.some((primitive) => primitive.id === id || primitive.sourceObjectId === id || primitive.id.startsWith(`${id}-`));

describe("V3 raw generation ingestion", () => {
  it("takes the cottage missing-hostId response through normal production ingestion and renders all 26 objects", () => {
    const raw = cottageRawFixture() as ReturnType<typeof cottageRawFixture> & { providerOnlyDebug?: unknown };
    raw.providerOnlyDebug = { mustNotPersist: true };
    raw.objects[0].providerOnlyObjectField = "must-not-persist";
    const ingested = ingestV3GenerationOutput(raw);
    expect(ingested.ok, [...ingested.validation.errors, ...(ingested.geometryAudit?.errors ?? [])].join("\n")).toBe(true);
    expect(ingested.scene.objects).toHaveLength(26);
    expect(ingested.notes).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNRESOLVED_SUPPORT", targetId: "main-terrace-slab" }),
      expect.objectContaining({ code: "UNRESOLVED_SUPPORT", targetId: "pool-retaining-wall" }),
    ]));
    expect(ingested.scene.site).toMatchObject({ width: 110, depth: 95, baseElevation: 0 });
    expect(ingested.scene.objects.find((object) => object.id === "main-terrace-slab")?.dimensions).toEqual([32, .3, 12]);
    expect(JSON.stringify(ingested.scene)).not.toContain("providerOnly");

    const compiled = compileV3Scene(ingested.scene);
    for (const object of ingested.scene.objects) expect(primitiveFor(object.id, compiled.primitives), object.id).toBe(true);
    expect(ingested.scene.objects.map((object) => [object.id, resolveV3Renderable(object).strategy])).toEqual(expect.arrayContaining([
      ["main-terrace-slab", "generic"],
      ["pool-garden-terrace", "generic"],
      ["arrival-pad", "generic"],
      ["pool-retaining-wall", "generic"],
      ["arrival-retaining-wall", "generic"],
      ["side-retaining-wall", "generic"],
      ["palm-cluster-west", "proxy"],
      ["palm-cluster-pool", "proxy"],
    ]));
    expect(Object.fromEntries(ingested.scene.objects.slice(0, 8).map((object) => [object.id, resolveV3Renderable(object).geometryKind]))).toEqual({
      "main-terrace-slab": "slab",
      "pool-garden-terrace": "slab",
      "arrival-pad": "slab",
      "pool-retaining-wall": "box",
      "arrival-retaining-wall": "box",
      "side-retaining-wall": "box",
      "palm-cluster-west": "proxy",
      "palm-cluster-pool": "proxy",
    });
  });

  it("normalizes all four historic raw failure classes through the same production function", () => {
    const base = cottageRawFixture();
    const flatRoof = structuredClone(base);
    const highLevels = structuredClone(base);
    const missingHost = structuredClone(base);
    const missingGeometry = structuredClone(base);
    (highLevels.objects[8] as Record<string, unknown>).levels = "27";
    (missingHost.objects[0] as Record<string, unknown>).support = { kind: "object", relationship: "rests-on" };
    delete (missingGeometry.objects[2] as Record<string, unknown>).geometryKind;

    const cases = [flatRoof, highLevels, missingHost, missingGeometry].map(raw => ingestV3GenerationOutput(raw));
    expect(cases.every((result) => result.ok)).toBe(true);
    expect(cases[0].scene.objects[8]).toMatchObject({ roofForm: "flat", pitch: 0 });
    expect(cases[1].scene.objects[8].levels).toBe(27);
    expect(cases[1].validation.warnings.join("\n")).toContain("LEVEL_COUNT_APPROXIMATED [cottage-part-0]");
    expect(cases[2].notes).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNRESOLVED_SUPPORT", targetId: "main-terrace-slab" })]));
    expect(cases[3].scene.objects[2].geometryKind).toBe("slab");
  });

  it("keeps an unknown future noun, uses generic fallback, and emits FALLBACK_RENDER_USED", () => {
    const raw = cottageRawFixture();
    raw.objects = [rawObject("future-feature", "orbital-sunset-lounge", "floating sunset meditation feature", [8, 2, 6], [0, 1, 0], { material: { id: "future", color: "#8b6f91", surface: "metal" } })];
    const ingested = ingestV3GenerationOutput(raw);
    expect(ingested.ok).toBe(true);
    expect(ingested.scene.objects[0]).toMatchObject({ id: "future-feature", type: "orbital-sunset-lounge", semanticRole: "floating sunset meditation feature", geometryKind: "box" });
    expect(resolveV3Renderable(ingested.scene.objects[0])).toMatchObject({ strategy: "generic", geometryKind: "box", warning: "FALLBACK_RENDER_USED" });
    expect(ingested.validation.warnings.join("\n")).toContain("FALLBACK_RENDER_USED [future-feature]");
    expect(primitiveFor("future-feature", compileV3Scene(ingested.scene).primitives)).toBe(true);
  });

  it("keeps every structurally drawable cottage object in failed preview without calling support failure unsupported geometry", () => {
    const raw = cottageRawFixture();
    raw.version = 3 as never;
    raw.site = { ...raw.site, width: 110, depth: 95, baseElevation: 0 } as never;
    for (const level of raw.siteHierarchy.levels) {
      level.elevation = Number(level.elevation) as never;
      level.region = Object.fromEntries(Object.entries(level.region).map(([key, value]) => [key, Number(value)])) as never;
    }
    for (const object of raw.objects) {
      object.dimensions = (object.dimensions as unknown[]).map(Number);
      const objectTransform = object.transform as { position: unknown[]; rotation: unknown[]; scale: unknown[] };
      objectTransform.position = objectTransform.position.map(Number);
      objectTransform.rotation = objectTransform.rotation.map(Number);
      objectTransform.scale = objectTransform.scale.map(Number);
    }
    const preview = recoverV3FailedPreview(raw, ["genuinely malformed canonical field"]);
    expect(preview?.scene.objects).toHaveLength(26);
    expect(preview?.diagnostics.unsupportedObjectIds).toEqual([]);
    expect(preview?.diagnostics.unresolvedSupportObjectIds).toEqual(expect.arrayContaining(["main-terrace-slab", "pool-garden-terrace", "arrival-pad", "pool-retaining-wall", "arrival-retaining-wall", "side-retaining-wall", "palm-cluster-west", "palm-cluster-pool"]));
    const compiled = compileV3Scene(preview!.scene);
    for (const object of preview!.scene.objects) expect(primitiveFor(object.id, compiled.primitives), object.id).toBe(true);
  });

  it("keeps hard failures limited to unsafe structure", () => {
    const duplicate = cottageRawFixture();
    duplicate.objects[1].id = duplicate.objects[0].id;
    const nonFinite = cottageRawFixture();
    (nonFinite.objects[0].transform as { position: unknown[] }).position[0] = Infinity;
    const nonPositive = cottageRawFixture();
    (nonPositive.objects[0].dimensions as unknown[])[1] = 0;
    const badSite = cottageRawFixture();
    badSite.site.width = "not-a-number";
    const empty = cottageRawFixture();
    empty.objects = [];

    expect(ingestV3GenerationOutput({ nope: true }).ok).toBe(false);
    expect(ingestV3GenerationOutput(duplicate).validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "DUPLICATE_OBJECT_ID", severity: "fatal" })]));
    expect(ingestV3GenerationOutput(nonFinite).validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_TRANSFORM", severity: "fatal" })]));
    expect(ingestV3GenerationOutput(nonPositive).validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_TRANSFORM", severity: "fatal" })]));
    expect(ingestV3GenerationOutput(badSite).validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_SITE", severity: "fatal" })]));
    expect(ingestV3GenerationOutput(empty).validation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "EMPTY_SCENE", severity: "fatal" })]));
  });
});
