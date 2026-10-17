import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from "../generation";
import { getV3PresentationBounds } from "../presentation";
import { V3_SCENE_ARCHITECT_PROMPT, type V3GenerationOutput, v3SceneOutputSchema } from "../schema";
import { compileV3Scene, v3ArchitecturalMetrics, type V3Scene, type V3SceneObject } from "../scene";
import { validateV3Scene } from "../validation";

type GeneratedObject = V3GenerationOutput["objects"][number];
const material = (id: string, color: string, surface: V3SceneObject["material"]["surface"] = "concrete"): GeneratedObject["material"] => ({ id, color, roughness: .68, surface });
const levelSupport = (levelId = "main", kind: "terrain" | "pad" | "terrace" | "slab" | "deck" | "roof" | "object" = "pad"): GeneratedObject["support"] => ({ kind, levelId, hostId: "", relationship: "none", grounding: "grounded" });
const hostedSupport = (hostId: string): GeneratedObject["support"] => ({ kind: "object", levelId: "main", hostId, relationship: "attached-to", grounding: "grounded" });
const noSupport = (): GeneratedObject["support"] => ({ kind: "none", levelId: "", hostId: "", relationship: "none", grounding: "grounded" });
const object = (id: string, type: GeneratedObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<GeneratedObject> = {}): GeneratedObject => ({
  id, type, semanticRole: id.replaceAll("-", " "), label: id.replaceAll("-", " "),
  transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions,
  material: material("limestone", "#c9bcaa", "stucco"), collision: "solid", support: levelSupport(), ...extra,
});

/**
 * Production-shaped, model-facing V3 output. It intentionally is not a runtime
 * scene or a fixture adapter: this is the exact flat generation contract Terra sees.
 */
export const luxuryMansionGenerationFixture = (): V3GenerationOutput => ({
  version: 3,
  site: { width: 180, depth: 140, baseElevation: 0, groundColor: "#4a6b42" },
  siteHierarchy: {
    levels: [
      { id: "main", elevation: 0, region: { x: 0, z: 0, width: 120, depth: 90 }, supportType: "pad", access: "entry" },
      { id: "arrival", elevation: 0, region: { x: 0, z: -56, width: 28, depth: 18 }, supportType: "pad", access: "arrival" },
      { id: "upper-roof", elevation: 6, region: { x: -4, z: 10, width: 22, depth: 12 }, supportType: "roof" },
    ],
    connections: [{ id: "arrival-drive-connection", fromLevelId: "main", toLevelId: "arrival", type: "driveway", width: 5, maxGrade: .15, surfaceObjectId: "arrival-drive", route: [[0, 0, -25], [0, 0, -56]] }],
    transitions: [{ id: "arrival-grade", fromLevelId: "main", toLevelId: "arrival", type: "graded-slope" }],
  },
  relationships: [
    { from: "main-pavilion", to: "covered-terrace", kind: "hosts" },
    { from: "main-pavilion", to: "upper-balcony", kind: "hosts" },
  ],
  objects: [
    object("site-slope", "terrain-region", [0, 0, 0], [180, 1, 140], { collision: "walkable", material: material("grass", "#4a6b42", "grass"), terrainOperation: "slopeRegion", terrainRise: 10, terrainDirection: "z", support: noSupport() }),
    object("main-pavilion", "building-mass", [0, 5, -2], [34, 10, 18], { levels: 2, facadePreset: "glass-heavy", facadeNorth: "solid", facadeEast: "punched", facadeWest: "privacy", roofForm: "floating-flat", overhang: 1.6, material: material("main-stucco", "#d3c8b7", "stucco") }),
    object("private-wing", "building-mass", [-28, 4, 5], [18, 8, 13], { levels: 2, facadePreset: "privacy", facadeSouth: "glass-heavy", roofForm: "mono-pitch", overhang: 1.1, pitch: 14 }),
    object("guest-pavilion", "building-mass", [29, 3.5, 6], [15, 7, 12], { levels: 2, facadePreset: "punched", facadeSouth: "glass-heavy", roofForm: "hip", overhang: .9, pitch: 18 }),
    object("arrival-pavilion", "building-mass", [0, 3.5, -27], [14, 7, 10], { levels: 2, facadePreset: "solid", facadeSouth: "punched", roofForm: "gable", overhang: .8, pitch: 22 }),
    object("pool-pavilion", "building-mass", [30, 2.5, 30], [10, 5, 8], { levels: 1, facadePreset: "glass-heavy", facadeWest: "privacy", roofForm: "flat", overhang: .85 }),
    object("roof-terrace-form", "roof-form", [0, .24, 31], [18, .48, 8], { collision: "walkable", roofForm: "terrace", overhang: .5, material: material("roof-paving", "#b8ad98", "paving") }),
    object("gallery-glass", "glass-wall", [0, 3, 7.1], [17, 6, .16], { collision: "passable", material: material("clear-glass", "#8fbdc9", "glass"), support: hostedSupport("main-pavilion") }),
    object("arrival-window-band", "window-band", [0, 5.2, -32.1], [9, 1.4, .16], { collision: "passable", material: material("clear-glass", "#8fbdc9", "glass"), support: hostedSupport("arrival-pavilion") }),
    object("covered-terrace", "terrace", [0, .2, 21], [38, .4, 15], { collision: "walkable", material: material("travertine", "#cfbea3", "paving") }),
    object("terrace-canopy", "canopy", [0, 4.6, 17], [19, .35, 6], { collision: "walkable", material: material("canopy-metal", "#303538", "metal"), support: noSupport() }),
    object("terrace-columns", "column-line", [0, 2, 14.3], [18, 4, .35], { material: material("dark-metal", "#273033", "metal") }),
    object("upper-balcony", "balcony", [-4, 6.2, 9], [13, .4, 3.6], { collision: "walkable", support: levelSupport("upper-roof", "roof") }),
    object("balcony-guard", "railing-run", [-4, 6.7, 10.75], [13, 1, .1], { material: material("guard-glass", "#9cc8d2", "glass"), support: levelSupport("upper-roof", "roof") }),
    object("arrival-courtyard", "courtyard", [0, .18, -42], [22, .36, 14], { collision: "walkable", material: material("court-stone", "#b8ad98", "paving") }),
    object("infinity-pool", "pool", [-4, .75, 34], [27, 1.5, 8], { collision: "water", semanticRole: "infinity resort pool", material: material("pool-water", "#2c88a8", "water") }),
    object("arrival-drive", "path", [0, .1, -40], [5, .2, 32], { collision: "walkable", material: material("driveway", "#3b3b3a", "paving") }),
    object("pool-garden", "landscape-zone", [-31, .1, 34], [14, .2, 20], { collision: "none", material: material("planting", "#416d3c", "grass") }),
    object("arrival-garden", "landscape-zone", [29, .1, -35], [18, .2, 16], { collision: "none", material: material("planting", "#3e663a", "grass") }),
    object("terrace-planters", "planter", [20, .35, 21], [9, .7, 2.2], { material: material("planting", "#4c713e", "grass") }),
    object("site-retaining", "retaining-wall", [0, .5, 48], [34, 1, .45], { material: material("retaining-stone", "#817a70", "stone") }),
  ],
});

const expressiveTypes = ["building-mass", "roof-form", "glass-wall", "window-band", "balcony", "terrace", "courtyard", "column-line", "railing-run", "landscape-zone", "planter", "pool"] as const;

describe("V3 expressive generation contract end to end", () => {
  it("keeps a Terra-authorable mansion intact from flat output through persisted rendering", () => {
    const generated = luxuryMansionGenerationFixture();
    expect(v3SceneOutputSchema.safeParse(generated).success).toBe(true);

    const normalized = normalizeV3GenerationOutput(generated);
    const repaired = repairV3GeneratedScene(normalized.scene, normalized.notes);
    const validation = validateV3Scene(repaired.scene, { lenient: true });
    expect(validation.ok, validation.errors.join("\n")).toBe(true);
    expect(validation.warnings).toEqual([]);

    // This is the same persistent root serialized by the V3 route and stored by the project store.
    const persisted = JSON.parse(JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: repaired.scene })) as { v3Scene: V3Scene };
    expect(persisted.v3Scene.objects).toHaveLength(generated.objects.length);
    expect(persisted.v3Scene.objects.map((item) => item.type)).toEqual(repaired.scene.objects.map((item) => item.type));

    const model = compileV3Scene(persisted.v3Scene);
    const metrics = v3ArchitecturalMetrics(persisted.v3Scene, model);
    const bounds = getV3PresentationBounds(persisted.v3Scene, model);
    expect(model.primitives.length).toBeGreaterThan(0);
    expect(bounds.source).toBe("compiled");
    expect(bounds.size.every((value) => value > 0)).toBe(true);

    for (const type of expressiveTypes) {
      const authored = persisted.v3Scene.objects.filter((item) => item.type === type);
      expect(authored, `${type} must be authored by the provider fixture`).not.toHaveLength(0);
      for (const source of authored) {
        const children = model.primitives.filter((primitive) => primitive.sourceObjectId === source.id);
        expect(children, `${source.id} must compile to renderer primitives`).not.toHaveLength(0);
        expect(children.every((primitive) => primitive.semanticRole === source.semanticRole && !!primitive.componentRole)).toBe(true);
      }
    }

    expect(model.primitives.filter((item) => item.sourceObjectId === "infinity-pool" && ["pool basin", "water surface", "pool coping"].includes(item.componentRole ?? "")).length).toBeGreaterThanOrEqual(6);
    expect(model.primitives.some((item) => item.sourceObjectId === "arrival-courtyard" && item.componentRole === "courtyard perimeter")).toBe(true);
    expect(model.primitives.some((item) => item.sourceObjectId === "upper-balcony" && item.componentRole === "glass railing")).toBe(true);
    expect(model.primitives.some((item) => item.sourceObjectId === "terrace-canopy" && item.componentRole === "canopy roof")).toBe(true);
    expect(model.primitives.some((item) => item.sourceObjectId === "pool-garden" && item.componentRole === "landscape groundcover")).toBe(true);

    // 1134 = 1120 authored-derived primitives + 14 Graded Site v1 derived retaining walls (v3-retaining-*).
    // Landscape zones/planters compile groundcover only (3); their trees/shrubs are presentation-only planting.
    const massCount = persisted.v3Scene.objects.filter((item) => item.type === "building-mass").length;
    const roofCount = persisted.v3Scene.objects.filter((item) => item.type === "roof-form" || item.type === "building-mass" && item.roofForm).length;
    const outdoorCount = persisted.v3Scene.objects.filter((item) => ["balcony", "terrace", "courtyard", "canopy"].includes(item.type)).length;
    const poolPrimitiveCount = model.primitives.filter((item) => item.sourceObjectId === "infinity-pool").length;
    const landscapePrimitiveCount = model.primitives.filter((item) => ["pool-garden", "arrival-garden", "terrace-planters"].includes(item.sourceObjectId ?? "")).length;
    expect({ authored: generated.objects.length, persisted: persisted.v3Scene.objects.length, compiled: model.primitives.length, masses: massCount, glazing: metrics.facadeOpeningOrGlazingCount, roofs: roofCount, outdoor: outdoorCount, poolPrimitives: poolPrimitiveCount, landscapePrimitives: landscapePrimitiveCount }).toEqual({ authored: 21, persisted: 21, compiled: 1161, masses: 5, glazing: 122, roofs: 6, outdoor: 4, poolPrimitives: 10, landscapePrimitives: 3 });
  });

  it("keeps physical imperfections render-first as warnings, not generation blockers", () => {
    const normalized = normalizeV3GenerationOutput(luxuryMansionGenerationFixture());
    const imperfect = structuredClone(normalized.scene);
    imperfect.objects.find((item) => item.id === "upper-balcony")!.transform.position[1] += 2;
    const strict = validateV3Scene(imperfect);
    const lenient = validateV3Scene(imperfect, { lenient: true });
    expect(strict.ok).toBe(false);
    expect(lenient.ok).toBe(true);
    expect(lenient.warnings.join("\n")).toContain("UNRESOLVED_SUPPORT [upper-balcony]");
  });

  it("keeps the provider schema flat while leaving semantic vocabulary open", () => {
    const jsonSchema = z.toJSONSchema(v3SceneOutputSchema) as unknown as { properties: { objects: { items: { properties: Record<string, unknown> } } } };
    const encoded = JSON.stringify(jsonSchema);
    expect(encoded).not.toContain('"anyOf"');
    expect(encoded).not.toContain('"oneOf"');
    const properties = jsonSchema.properties.objects.items.properties;
    for (const field of ["type", "geometryKind", "levels", "facadePreset", "facadeNorth", "facadeEast", "facadeSouth", "facadeWest", "roofForm", "overhang", "pitch", "support"]) expect(properties).toHaveProperty(field);
    expect(encoded).not.toContain('"building-mass"');
    for (const kind of ["box", "slab", "plane", "cylinder", "path", "extrusion", "water", "proxy"]) expect(encoded).toContain(kind);
    for (const intent of ["glass-heavy", "punched", "solid", "privacy"]) expect(encoded).toContain(intent);
    for (const form of ["flat", "floating-flat", "mono-pitch", "hip", "gable", "terrace"]) expect(encoded).toContain(form);
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("semanticRole freely");
  });
});
