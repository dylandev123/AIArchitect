import { describe, expect, it } from "vitest";
import { recoverV3FailedPreview } from "../failedPreview";
import { normalizeV3GenerationOutput, repairV3GeneratedScene, summarizeV3Generation } from "../generation";
import { getV3PresentationBounds } from "../presentation";
import { resolveV3Renderable } from "../renderability";
import { compileV3Scene, isV3ProjectRoot, type V3Scene } from "../scene";
import { v3SceneOutputSchema } from "../schema";
import { validateV3Scene } from "../validation";

const material = { id: "limestone", color: "#a99f90", surface: "stone" as const };
const water = { id: "water", color: "#237fa4", surface: "water" as const };
const grass = { id: "grass", color: "#4b7142", surface: "grass" as const };
const ground = { kind: "pad", levelId: "estate-level", hostId: "", relationship: "none", grounding: "grounded" };
const object = (id: string, semanticRole: string, geometryKind: string, position: number[], dimensions: number[], type?: string, extra: Record<string, unknown> = {}) => ({
  id,
  ...(type ? { type } : {}),
  semanticRole,
  label: semanticRole,
  geometryKind,
  transform: { position, rotation: [0, 0.22, 0], scale: [1, 1, 1] },
  dimensions,
  material,
  collision: "solid",
  support: ground,
  ...extra,
});

/** Offline Terra-shaped fixture: nouns remain authored data, never a compiler enum. */
function aiInventsThingsFixture() {
  return {
    version: 3,
    site: { width: 220, depth: 180, baseElevation: 0, groundColor: "#4b7142" },
    siteHierarchy: {
      levels: [{ id: "estate-level", elevation: 0, region: { x: 0, z: 0, width: 220, depth: 180 }, supportType: "pad", access: "arrival" }],
      connections: [],
      transitions: [],
    },
    relationships: [],
    objects: [
      object("site-grade", "rolling tropical site", "box", [0, 0, 0], [220, 1, 180], "terrain-region", { terrainOperation: "slopeRegion", terrainRise: 4, terrainDirection: "z", material: grass, collision: "walkable" }),
      object("living-pavilion", "double-height living pavilion", "box", [0, 8, 0], [32, 16, 22], "building-mass", { levels: 2, facadePreset: "glass-heavy", roofForm: "floating-flat" }),
      object("entrance-volume", "curved angled entrance volume", "cylinder", [0, 4, -20], [12, 8, 10], "curved-entrance-volume"),
      object("bedroom-wing", "cantilevered bedroom wing", "box", [18, 9, 0], [18, 6, 12], "building-mass", { support: { kind: "object", levelId: "estate-level", hostId: "living-pavilion", relationship: "cantilevered-from", grounding: "cantilevered" } }),
      object("glass-gallery", "glass gallery", "box", [-23, 3, 0], [14, 6, 5], "glass-wall", { material: { id: "glass", color: "#8fbdc9", surface: "glass", opacity: .42 } }),
      object("rooftop-lounge", "rooftop lounge", "slab", [0, 12.2, 0], [16, .4, 10], "terrace", { collision: "walkable", support: { kind: "roof", levelId: "estate-level", hostId: "living-pavilion", relationship: "rests-on", grounding: "grounded" } }),
      object("dining-room", "covered outdoor dining room", "slab", [25, .3, -15], [14, .3, 10], "canopy", { collision: "walkable" }),
      object("infinity-pool", "infinity pool", "water", [-30, .8, 20], [22, 1.6, 9], "pool", { material: water, collision: "water" }),
      object("spa", "hillside spa", "box", [-42, .6, 20], [6, 1.2, 6], "spa", { material: water, collision: "water" }),
      object("fire-lounge", "sunken fire lounge", "slab", [26, .18, 18], [12, .36, 10], "sunken-fire-lounge", { collision: "walkable" }),
      object("outdoor-kitchen", "outdoor kitchen", "box", [28, 1.2, -2], [8, 2.4, 3], "outdoor-kitchen"),
      object("gazebo", "gazebo cabana", "slab", [42, .3, -18], [10, .3, 8], "canopy", { collision: "walkable" }),
      object("fountain", "arrival fountain", "cylinder", [0, 1.5, -42], [6, 3, 6], "fountain", { material: water, collision: "water" }),
      object("tennis-court", "tennis court", "plane", [48, .05, 28], [24, .1, 12], "tennis-court", { collision: "walkable" }),
      object("helipad", "helipad", "plane", [54, .05, -38], [18, .1, 18], "helipad", { collision: "walkable" }),
      object("driveway-gate", "driveway gate", "box", [0, 2, -68], [12, 4, .4], "gate"),
      object("arrival-court", "arrival court", "slab", [0, .2, -52], [24, .4, 16], "courtyard", { collision: "walkable" }),
      object("retaining-wall", "retaining wall", "box", [-52, 1.5, 4], [30, 3, .5], "retaining-wall"),
      object("garden-stairs", "garden stairs", "slab", [-22, 1.5, 38], [5, 3, 14], "stair", { collision: "walkable" }),
      object("lawn", "formal lawn", "plane", [-2, .05, 46], [28, .1, 20], "landscape-zone", { material: grass, collision: "walkable" }),
      object("tree-grove", "tree grove", "box", [-62, .2, 34], [24, .4, 18], "landscape-zone", { material: grass }),
      object("privacy-hedge", "hedge privacy planting", "box", [68, 1.5, 10], [1, 3, 44], "hedge-privacy-planting", { material: grass }),
      object("planters", "entry planters", "box", [12, .5, -38], [8, 1, 2], "planter", { material: grass }),
      object("rock-garden", "rock garden", "box", [-42, .25, -30], [18, .5, 12], "landscape-zone", { material: grass }),
      object("tropical-zone", "tropical planting zone", "box", [38, .2, 42], [18, .4, 16], "landscape-zone", { material: grass }),
      object("meditation-pavilion", "floating meditation pavilion", "box", [-22, 5, -24], [10, 2, 10], "floating-meditation-pavilion", { support: { kind: "object", levelId: "estate-level", hostId: "living-pavilion", relationship: "suspended-from", grounding: "floating" } }),
      // Missing support metadata is intentional: repair may infer it, but rendering must not depend on it.
      object("kinetic-shade", "kinetic shade sculpture", "cylinder", [12, 11, 34], [.18, 22, .18], undefined, { transform: { position: [12, 11, 34], rotation: [0, .6, 0], scale: [.35, 1.2, .35] } }),
      object("conversation-garden", "sunken conversation garden", "slab", [-4, .2, 30], [14, .4, 12], "sunken-conversation-garden", { collision: "walkable" }),
      object("bridge-lookout", "glass bridge lookout", "slab", [-14, 7, 5], [16, .4, 3], "glass-bridge-lookout", { material: { id: "glass", color: "#8fbdc9", surface: "glass", opacity: .42 } }),
      // Deliberately unresolved asset: authored source survives while visible proxy geometry renders.
      object("water-wall", "water wall entrance feature", "box", [0, 2, -30], [10, 4, 1], "water-wall-entrance-feature", { sourceKind: "glb", sourceAssetId: "missing-water-wall-asset", sourceReplaceable: true, material: water }),
    ],
  };
}

const renderedFor = (scene: V3Scene, objectId: string, primitives: ReturnType<typeof compileV3Scene>["primitives"]) =>
  objectId === "site-grade"
    ? primitives.some((primitive) => primitive.id === "v3-terrain-surface")
    : primitives.some((primitive) => primitive.sourceObjectId === objectId || primitive.id === objectId || primitive.id.startsWith(`${objectId}-`));

describe("V3 Terra freedom product audit", () => {
  it("keeps a mansion full of new nouns through the exact offline production path", () => {
    const provider = aiInventsThingsFixture();
    const parsed = v3SceneOutputSchema.safeParse(provider);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

    const normalized = normalizeV3GenerationOutput(parsed.data);
    const repaired = repairV3GeneratedScene(normalized.scene, normalized.notes);
    const validation = validateV3Scene(repaired.scene, { lenient: true });
    expect(validation.ok).toBe(true);

    const persisted = JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: repaired.scene });
    const reloaded = JSON.parse(persisted) as { v3Scene: V3Scene };
    expect(isV3ProjectRoot(JSON.parse(persisted))).toBe(true);
    expect(reloaded.v3Scene.objects.map((item) => [item.id, item.semanticRole])).toEqual(repaired.scene.objects.map((item) => [item.id, item.semanticRole]));

    const model = compileV3Scene(reloaded.v3Scene);
    const bounds = getV3PresentationBounds(reloaded.v3Scene, model);
    expect([...bounds.min, ...bounds.max, ...bounds.center, ...bounds.size].every(Number.isFinite)).toBe(true);
    for (const item of reloaded.v3Scene.objects) expect(renderedFor(reloaded.v3Scene, item.id, model.primitives)).toBe(true);

    const counts = reloaded.v3Scene.objects.reduce<Record<string, number>>((total, item) => {
      const strategy = resolveV3Renderable(item).strategy;
      total[strategy] = (total[strategy] ?? 0) + 1;
      return total;
    }, {});
    expect(counts).toEqual({ specialized: 16, generic: 14 });
    expect(resolveV3Renderable(reloaded.v3Scene.objects.find((item) => item.id === "water-wall")!)).toMatchObject({ strategy: "generic", geometryKind: "box", warning: "FALLBACK_RENDER_USED" });
    expect(reloaded.v3Scene.objects.find((item) => item.id === "water-wall")?.source).toMatchObject({ assetId: "missing-water-wall-asset", replaceable: true });
    expect(reloaded.v3Scene.objects.find((item) => item.id === "kinetic-shade")?.support).toBeDefined();
    expect(summarizeV3Generation(repaired.notes, validation.issues).status).toBe("rendered-with-warnings");
  });

  it("uses the same renderability authority for failed-preview recovery", () => {
    const failed = aiInventsThingsFixture();
    const invalid = failed.objects.find((item) => item.id === "bridge-lookout")!;
    (invalid as Record<string, unknown>).invalidStrictOnly = true;
    expect(v3SceneOutputSchema.safeParse(failed).success).toBe(false);

    const preview = recoverV3FailedPreview(JSON.stringify(failed), ["objects.bridge-lookout.support.hostId: required"]);
    expect(preview).toBeDefined();
    expect(preview!.scene.objects).toHaveLength(failed.objects.length);
    const model = compileV3Scene(preview!.scene);
    for (const item of preview!.scene.objects) expect(renderedFor(preview!.scene, item.id, model.primitives)).toBe(true);

    const normal = repairV3GeneratedScene(normalizeV3GenerationOutput(aiInventsThingsFixture()).scene).scene;
    for (const item of preview!.scene.objects) {
      const normalItem = normal.objects.find((candidate) => candidate.id === item.id)!;
      expect(resolveV3Renderable(item)).toEqual(resolveV3Renderable(normalItem));
    }
    expect(preview!.diagnostics.renderWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ targetId: "water-wall", code: "FALLBACK_RENDER_USED" })]));
    expect(preview!.scene.objects.find((item) => item.id === "water-wall")?.source).toMatchObject({ assetId: "missing-water-wall-asset", replaceable: true });
  });
});
