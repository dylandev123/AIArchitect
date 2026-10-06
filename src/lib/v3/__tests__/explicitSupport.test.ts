import { describe, expect, it } from "vitest";
import { executeV3SceneOperations } from "../operations";
import { compileV3Scene, type V3Scene, type V3SceneObject } from "../scene";
import { V3_SCENE_ARCHITECT_PROMPT, v3SceneOutputSchema } from "../schema";
import { validateV3Scene } from "../validation";
import { normalizeV3GenerationOutput } from "../generation";
import { toGenerationOutput } from "./generationFixture";

const object = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<V3SceneObject> = {}): V3SceneObject => ({
  id, type, semanticRole: id, label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions,
  material: { id: "stone", color: "#817a70", surface: "stone" }, collision: type === "slab" || type === "stair" ? "walkable" : "solid", ...extra,
});

const scene = (): V3Scene => ({ version: 3, site: { width: 80, depth: 80 }, metadata: {}, relationships: [], siteHierarchy: {
  levels: [
    { id: "ground", elevation: 0, region: { x: 0, z: 0, width: 80, depth: 80 }, supportType: "pad" },
    { id: "lower", elevation: 0, region: { x: 0, z: -7, width: 12, depth: 4 }, supportType: "terrace" },
    { id: "upper", elevation: 4, region: { x: 0, z: 7, width: 12, depth: 4 }, supportType: "terrace" },
  ], connections: [],
}, objects: [
  object("deck", "slab", [0, .25, 0], [10, .5, 10], { support: { kind: "pad", levelId: "ground" } }),
  // The scene-level pad would infer elevation 0; this authored host is authoritative at .5.
  object("spa", "proxy-asset", [0, 1, 0], [3, 1, 3], { support: { kind: "object", hostId: "deck", relationship: "rests-on" } }),
  object("rail", "railing", [4.9, 1, 0], [.2, 1, 8], { support: { kind: "object", hostId: "deck", relationship: "edge-hosted" } }),
  object("wing", "volume", [14, 2, 0], [8, 4, 8], { support: { kind: "pad", levelId: "ground" } }),
  object("balcony", "slab", [20, 4.25, 0], [4, .5, 4], { support: { kind: "object", hostId: "wing", relationship: "cantilevered-from" } }),
  object("basement", "volume", [14, 2, 0], [3, 3, 3], { support: { kind: "object", hostId: "wing", relationship: "embedded-in", grounding: "embedded" } }),
  object("stair", "stair", [0, 2, 0], [2, 4, 10], { fromSupportId: "lower", toSupportId: "upper" }),
] });

describe("V3 explicit authored support graph", () => {
  it("requires a flat support object on every generated object and keeps connector endpoints in the prompt", () => {
    const output = toGenerationOutput(scene());
    expect(v3SceneOutputSchema.safeParse(output).success).toBe(true);
    const missingSupport = structuredClone(output) as unknown as { objects: Array<Record<string, unknown> & { id: string }> };
    delete missingSupport.objects.find((item) => item.id === "spa")!.support;
    expect(v3SceneOutputSchema.safeParse(missingSupport).success).toBe(false);
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("fromSupportId");
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("flat support object");
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("never set a relationship without a hostId");
  });

  it("accepts neutral flat support values and folds them away when normalizing", () => {
    const output = toGenerationOutput(scene()) as unknown as { objects: Array<{ id: string; support: Record<string, unknown> }> };
    output.objects.find((item) => item.id === "wing")!.support = { kind: "pad", levelId: "ground", hostId: "", relationship: "none", grounding: "grounded" };
    expect(v3SceneOutputSchema.safeParse(output).success).toBe(true);
    const { scene: runtime } = normalizeV3GenerationOutput(output);
    expect(runtime.objects.find((item) => item.id === "wing")?.support).toEqual({ kind: "pad", levelId: "ground", grounding: "grounded" });
    expect(runtime.objects.find((item) => item.id === "spa")?.support).toMatchObject({ kind: "object", hostId: "deck", relationship: "rests-on" });
    expect(runtime.objects.find((item) => item.id === "stair")?.support).toBeUndefined();
  });

  it("does not hard-fail a relationship without a host: it is dropped, reported, and the scene stays valid", () => {
    const output = toGenerationOutput(scene()) as unknown as { objects: Array<{ id: string; support: Record<string, unknown> }> };
    output.objects.find((item) => item.id === "spa")!.support = { kind: "object", levelId: "", hostId: "", relationship: "rests-on", grounding: "grounded" };
    expect(v3SceneOutputSchema.safeParse(output).success).toBe(true);
    const normalized = normalizeV3GenerationOutput(output);
    expect(normalized.notes).toEqual([expect.objectContaining({ code: "UNRESOLVED_SUPPORT", targetId: "spa" })]);
    expect(validateV3Scene(normalized.scene, { lenient: true }).ok).toBe(true);
  });

  it("allows direct terrain or level support without a relationship", () => {
    const output = toGenerationOutput(scene()) as unknown as { objects: unknown[] };
    output.objects.push(toGenerationOutput({ ...scene(), objects: [object("hillside", "terrain-region", [0, 0, 20], [20, 1, 20], { terrain: { operation: "slopeRegion", rise: 0, direction: "z" } })] }).objects);
    output.objects = output.objects.flat();
    expect(v3SceneOutputSchema.safeParse(output).success).toBe(true);
  });

  it("represents terrain-following, embedded, and cantilevered relationships with real hosts", () => {
    const runtime = scene();
    runtime.objects.push(object("hillside", "terrain-region", [30, 0, 0], [20, 1, 20], { terrain: { operation: "slopeRegion", rise: 0, direction: "z" }, support: { kind: "pad", levelId: "ground" } }));
    runtime.objects.push(object("site-path", "path", [30, .6, 0], [3, .2, 12], { support: { kind: "terrain", hostId: "hillside", relationship: "terrain-following" } }));
    expect(v3SceneOutputSchema.safeParse(toGenerationOutput(runtime)).success).toBe(true);
    expect(validateV3Scene(runtime)).toMatchObject({ ok: true, errors: [] });
    expect(runtime.objects.find((item) => item.id === "basement")?.support).toMatchObject({ hostId: "wing", relationship: "embedded-in" });
    expect(runtime.objects.find((item) => item.id === "balcony")?.support).toMatchObject({ hostId: "wing", relationship: "cantilevered-from" });
  });

  it("keeps persisted legacy objectId support loadable outside the new-generation contract", () => {
    const legacy = scene();
    legacy.objects.find((item) => item.id === "spa")!.support = { kind: "object", objectId: "deck", relationship: "rests-on" };
    expect(validateV3Scene(legacy)).toMatchObject({ ok: true, errors: [] });
    expect(compileV3Scene(legacy).primitives.some((primitive) => primitive.id === "spa")).toBe(true);

    const modelFacing = toGenerationOutput(legacy) as unknown as { objects: Array<{ id: string; support: Record<string, unknown> }> };
    modelFacing.objects.find((item) => item.id === "spa")!.support.objectId = "deck";
    expect(v3SceneOutputSchema.safeParse(modelFacing).success).toBe(false);
  });

  it("takes authored support over inference and survives save/reload and rendering", () => {
    const reloaded = JSON.parse(JSON.stringify(scene())) as V3Scene;
    expect(validateV3Scene(reloaded)).toMatchObject({ ok: true, errors: [] });
    expect(compileV3Scene(reloaded).primitives.some((primitive) => primitive.id === "spa")).toBe(true);
    expect(reloaded.objects.find((item) => item.id === "spa")?.support).toMatchObject({ hostId: "deck", relationship: "rests-on" });
  });

  it("rejects invalid rests-on and edge-hosted geometry with bounded repair feedback", () => {
    const invalid = scene();
    invalid.objects.find((item) => item.id === "spa")!.transform.position = [20, 1, 0];
    invalid.objects.find((item) => item.id === "rail")!.transform.position = [20, 1, 0];
    const errors = validateV3Scene(invalid).errors.join("\n");
    expect(errors).toMatch(/INVALID_SUPPORT_RELATIONSHIP \[spa\].*support gap/);
    expect(errors).toMatch(/INVALID_SUPPORT_RELATIONSHIP \[rail\].*edge-hosted/);
  });

  it("validates cantilever, embedded host, and explicit connector endpoints", () => {
    expect(validateV3Scene(scene())).toMatchObject({ ok: true });
    const invalid = scene();
    invalid.objects.find((item) => item.id === "stair")!.toSupportId = "lower";
    expect(validateV3Scene(invalid).errors.join(" ")).toMatch(/INVALID_CONNECTOR_ENDPOINT/);
  });

  it("rejects a stale local support atomically and accepts an explicit support repair", () => {
    const moved = executeV3SceneOperations(scene(), { intent: "Move spa away", operations: [{ op: "move", target: "spa", position: [20, 1, 0] }] });
    expect(moved.ok).toBe(false);
    const repaired = executeV3SceneOperations(scene(), { intent: "Move spa to the wing", operations: [
      { op: "move", target: "spa", position: [14, 4.5, 0] },
      { op: "setSupport", target: "spa", support: { kind: "object", hostId: "wing", relationship: "rests-on" } },
    ] });
    expect(repaired.ok, repaired.errors.join("\n")).toBe(true);
    expect(repaired.scene.objects.find((item) => item.id === "spa")?.support?.hostId).toBe("wing");
  });
});
