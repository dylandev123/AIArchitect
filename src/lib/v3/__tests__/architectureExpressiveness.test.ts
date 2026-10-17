import { describe, expect, it } from "vitest";
import { compileV3Scene, v3ArchitecturalMetrics, type V3Scene, type V3SceneObject } from "../scene";
import { v3SceneOutputSchema } from "../schema";

const material = (id: string, color: string, surface: V3SceneObject["material"]["surface"] = "concrete") => ({ id, color, roughness: .68, surface });
const object = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<V3SceneObject> = {}): V3SceneObject => ({
  id, type, semanticRole: id.replaceAll("-", " "), label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions, material: material("warm-stone", "#c4baaa"), collision: "solid", ...extra,
});

/** Offline visual regression fixture: 14 authored objects deterministically become a complete resort composition. */
const luxuryHouse = (): V3Scene => ({
  version: 3, site: { width: 160, depth: 130, groundMaterial: material("grass", "#4a6b42", "grass") }, relationships: [], metadata: { fixture: "v3-luxury-house" },
  objects: [
    object("living-pavilion", "building-mass", [0, 9, -2], [30, 9, 16], { levels: 2, facadePreset: "glass-heavy", facadeNorth: "solid", roofForm: "floating-flat", overhang: 1.7, material: material("limestone", "#d3c9b8", "stucco") }),
    object("west-wing", "building-mass", [-22, 5, 4], [16, 6, 13], { levels: 2, facadePreset: "punched", facadeSouth: "glass-heavy", roofForm: "mono-pitch", overhang: 1.15, pitch: 14 }),
    object("east-wing", "building-mass", [23, 5, 3], [15, 6, 12], { levels: 2, facadePreset: "privacy", facadeSouth: "glass-heavy", roofForm: "flat", overhang: .9 }),
    object("view-gallery", "building-mass", [0, 4, 15], [10, 4, 12], { levels: 1, facadePreset: "glass-heavy", roofForm: "mono-pitch", overhang: 1.1, pitch: 10 }),
    object("arrival-canopy", "canopy", [0, 5, -18], [12, .35, 6], { collision: "walkable", material: material("dark-roof", "#303538", "metal") }),
    object("view-terrace", "terrace", [0, 1.1, 28], [42, .35, 16], { collision: "walkable", material: material("travertine", "#cfbea3", "paving") }),
    object("upper-balcony", "balcony", [-8, 9.2, 8], [11, .35, 3.6], { collision: "walkable" }),
    object("arrival-court", "courtyard", [0, .3, -28], [20, .3, 13], { collision: "walkable" }),
    object("infinity-pool", "pool", [-4, .2, 35], [25, 1.4, 7.5], { collision: "water", material: material("water", "#2c88a8", "water") }),
    object("pool-pavilion", "building-mass", [25, 3.5, 31], [9, 4, 7], { levels: 1, facadePreset: "glass-heavy", roofForm: "flat", overhang: .9 }),
    object("entry-garden", "landscape-zone", [29, .08, -22], [18, .16, 15], { collision: "none", material: material("planting", "#416d3c", "grass") }),
    object("pool-garden", "landscape-zone", [-30, .08, 33], [13, .16, 19], { collision: "none", material: material("planting", "#3e663a", "grass") }),
    object("view-planters", "planter", [19, .35, 28], [10, .55, 3], { collision: "solid", material: material("planting", "#4c713e", "grass") }),
    object("arrival-drive", "path", [0, .1, -49], [6, .2, 28], { collision: "walkable", material: material("asphalt", "#3b3b3a", "paving") }),
  ],
});

describe("V3 expressive architecture compiler", () => {
  it("expands a compact luxury-house scene into walls, glazing, roofs, outdoor layers and identifiable children", () => {
    const scene = luxuryHouse(), model = compileV3Scene(scene), metrics = v3ArchitecturalMetrics(scene, model);
    expect(metrics.authoredObjectCount).toBe(14);
    expect(metrics.compiledPrimitiveCount).toBeGreaterThan(75);
    expect(metrics.architecturalMassCount).toBe(5);
    expect(metrics.facadeOpeningOrGlazingCount).toBeGreaterThan(18);
    expect(metrics.roofFormCount).toBe(5);
    expect(metrics.coveredOutdoorArea).toBeGreaterThan(80);
    expect(metrics.poolOrSiteAmenityCount).toBeGreaterThanOrEqual(4);
    expect(metrics.landscapeZoneCount).toBe(3);
    expect(model.primitives.some((p) => p.sourceObjectId === "living-pavilion" && p.componentRole === "facade glazing")).toBe(true);
    expect(model.primitives.some((p) => p.sourceObjectId === "infinity-pool" && p.componentRole === "pool coping")).toBe(true);
    expect(model.primitives.some((p) => p.sourceObjectId === "upper-balcony" && p.componentRole === "glass railing")).toBe(true);
    expect(model.primitives.some((p) => p.sourceObjectId === "arrival-court" && p.componentRole === "courtyard perimeter")).toBe(true);
  });

  it("keeps the provider contract flat while accepting high-level architectural vocabulary", () => {
    const scene = luxuryHouse(), { metadata, ...providerBase } = scene;
    void metadata;
    const providerScene = {
      ...providerBase,
      site: { width: scene.site.width, depth: scene.site.depth, groundColor: "#4a6b42" },
      siteHierarchy: { levels: [{ id: "main", elevation: 0, region: { x: 0, z: 0, width: 100, depth: 90 }, supportType: "terrain", access: "entry" }], connections: [], transitions: [] },
      objects: scene.objects.map(({ material: value, ...item }) => ({ ...item, material: value, support: { kind: "none", levelId: "", hostId: "", relationship: "none", grounding: "grounded" } })),
    };
    expect(v3SceneOutputSchema.safeParse(providerScene).success).toBe(true);
    expect(JSON.stringify(v3SceneOutputSchema._zod.def)).not.toContain("discriminatedUnion");
  });
});
