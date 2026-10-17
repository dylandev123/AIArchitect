import { describe, expect, it } from "vitest";
import { recoverV3FailedPreview } from "../failedPreview";
import { normalizeV3GenerationOutput } from "../generation";
import { executeV3SceneOperations } from "../operations";
import { compileV3Scene, type V3Scene } from "../scene";
import { v3SceneOutputSchema } from "../schema";
import { validateV3Scene } from "../validation";

const material = { id: "neutral", color: "#778899", surface: "stone" as const };
const authored = (id: string, semanticRole: string, geometryKind: "box" | "plane" | "water" | "cylinder" | "proxy", type = "unfamiliar-amenity") => ({
  id, type, semanticRole, label: semanticRole, geometryKind,
  transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [8, 2, 6], material,
});
const output = (objects: unknown[]) => ({ version: 3, site: { width: 80, depth: 80 }, siteHierarchy: { levels: [{ id: "site", elevation: 0, region: { x: 0, z: 0, width: 80, depth: 80 }, supportType: "terrain" }], connections: [], transitions: [] }, relationships: [], objects });

describe("V3 universal authored objects", () => {
  it("accepts unfamiliar semantics without adding a noun enum and renders every fallback tier", () => {
    const provider = output([
      authored("infinity-pool", "resort infinity pool", "water", "pool"),
      authored("gazebo", "garden gazebo", "box", "canopy"),
      authored("kitchen", "outdoor kitchen", "box"),
      authored("lounge", "sunken fire lounge", "box"),
      authored("fountain", "sculptural fountain", "cylinder"),
      authored("court", "tennis court", "plane"),
      authored("future", "unknown futuristic amenity", "proxy"),
    ]);
    expect(v3SceneOutputSchema.safeParse(provider).success).toBe(true);
    const scene = normalizeV3GenerationOutput(provider).scene;
    const compiled = compileV3Scene(scene);
    for (const object of scene.objects) expect(compiled.primitives.some((primitive) => primitive.sourceObjectId === object.id || primitive.id === object.id)).toBe(true);
    expect(compiled.primitives.filter((primitive) => primitive.sourceObjectId === "infinity-pool").length).toBeGreaterThan(1);
    const validation = validateV3Scene(scene, { lenient: true });
    expect(validation.warnings.join("\n")).toContain("FALLBACK_RENDER_USED [future]");
    expect(scene.objects.find((item) => item.id === "future")?.semanticRole).toBe("unknown futuristic amenity");
    expect(normalizeV3GenerationOutput(output([authored("legacy", "legacy object", "box")])).scene.objects[0].geometryKind).toBe("box");
  });

  it("uses the same resolver for failed previews and keeps authored identity through edit and reload", () => {
    const raw = output([{ ...authored("future", "unknown futuristic amenity", "proxy"), support: { kind: "terrain", levelId: "site", hostId: "", relationship: "none", grounding: "grounded" } }]);
    const preview = recoverV3FailedPreview(JSON.stringify(raw));
    expect(preview?.diagnostics.renderWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FALLBACK_RENDER_USED", targetId: "future" })]));
    expect(compileV3Scene(preview!.scene).primitives.some((primitive) => primitive.id === "future")).toBe(true);
    const scene: V3Scene = normalizeV3GenerationOutput(raw).scene;
    const edited = executeV3SceneOperations(scene, { intent: "make it longer", operations: [{ op: "resize", target: "future", dimensions: [14, 2, 6] }] });
    expect(edited.ok).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(edited.scene)) as V3Scene;
    expect(reloaded.objects).toEqual(expect.arrayContaining([expect.objectContaining({ id: "future", semanticRole: "unknown futuristic amenity", dimensions: [14, 2, 6] })]));
  });
});
