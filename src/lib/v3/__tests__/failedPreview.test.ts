import { describe, expect, it } from "vitest";
import { compileV3Scene } from "../scene";
import { v3SceneOutputSchema } from "../schema";
import { recoverV3FailedPreview } from "../failedPreview";

const material = { id: "stone", color: "#817a70", surface: "stone" as const };
const object = (index: number) => ({
  id: `mansion-part-${index}`,
  type: index % 4 === 0 ? "slab" : index % 4 === 1 ? "wall" : index % 4 === 2 ? "roof" : "proxy-asset",
  semanticRole: "mansion detail",
  label: `Mansion detail ${index}`,
  transform: { position: [index * 2 - 30, 2 + (index % 3), index % 6], rotation: [0, 0, 0], scale: [1, 1, 1] },
  dimensions: [3, 1, 3],
  material,
  collision: "solid",
  support: { kind: "terrain", levelId: "main-level" },
});

function failedMansion() {
  const objects: Record<string, unknown>[] = Array.from({ length: 32 }, (_, index) => object(index));
  objects[9] = { ...objects[9], id: "unsupported-pool-house", support: { kind: "slab", relationship: "rests-on" } };
  return {
    version: 3,
    site: { width: 160, depth: 140, baseElevation: 0, groundMaterial: { id: "grass", color: "#4a6b42", surface: "grass" } },
    objects,
    siteHierarchy: {
      levels: [
        { id: "arrival-level", elevation: 0, region: { x: 0, z: 30, width: 80, depth: 60 }, supportType: "terrain", access: "entry" },
        { id: "main-level", elevation: 4, region: { x: 0, z: -10, width: 110, depth: 100 }, supportType: "terrace", access: "arrival" },
      ],
      connections: [
        // The preview must keep authored Y values rather than flattening this route.
        { id: "three-d-drive", fromLevelId: "arrival-level", toLevelId: "main-level", type: "driveway", width: 5, route: [[0, 0, 50], [0, 2, 15], [0, 4, 0]] },
        // Old [x,z] data is safe to normalize because both endpoint levels exist.
        { id: "legacy-path", fromLevelId: "arrival-level", toLevelId: "main-level", type: "path", width: 2, route: [[8, 40], [8, 0]] },
      ],
    },
    relationships: [
      { from: "mansion-part-0", to: "mansion-part-1", kind: "aligns" },
      { id: "broken-relationship", from: "mansion-part-2", to: "missing-object", kind: "hosts" },
    ],
  };
}

describe("failed V3 Terra preview recovery", () => {
  it("accepts a five-storey mansion mass and keeps its authored level count through recovery and compilation", () => {
    const mansion = {
      version: 3 as const,
      site: { width: 160, depth: 140 },
      siteHierarchy: { levels: [{ id: "main-level", elevation: 0, region: { x: 0, z: 0, width: 160, depth: 140 }, supportType: "terrain" as const }], connections: [], transitions: [] },
      objects: [{ ...object(26), id: "north-tower", type: "building-mass", semanticRole: "mansion tower", label: "North tower", dimensions: [14, 20, 12], levels: 5, support: { kind: "terrain", levelId: "", hostId: "", relationship: "none", grounding: "grounded" } }],
      relationships: [],
    };

    // Five storeys are structurally safe and must not cause a provider-output rejection.
    expect(v3SceneOutputSchema.safeParse(mansion).success).toBe(true);

    const preview = recoverV3FailedPreview(JSON.stringify(mansion));
    expect(preview?.scene.objects.find((candidate) => candidate.id === "north-tower")?.levels).toBe(5);
    const towerParts = compileV3Scene(preview!.scene).primitives.filter((primitive) => primitive.sourceObjectId === "north-tower");
    expect(towerParts.filter((primitive) => primitive.componentRole === "floor slab")).toHaveLength(6);

    const overLimit = structuredClone(mansion);
    overLimit.objects[0].levels = 23;
    const approximated = recoverV3FailedPreview(JSON.stringify(overLimit));
    expect(approximated?.scene.objects[0]).toMatchObject({ levels: 20, metadata: { requestedLevels: 23 } });
    expect(approximated?.diagnostics.renderWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LEVEL_COUNT_APPROXIMATED", targetId: "north-tower" })]));
  });

  it("keeps strict V3 output strict while rendering the safe parts of a failed mansion", () => {
    const mansion = failedMansion();
    const raw = JSON.stringify(mansion);

    // The persistent Terra contract still rejects it: no hostId on the support relation.
    expect(v3SceneOutputSchema.safeParse(mansion).success).toBe(false);

    const preview = recoverV3FailedPreview(raw, ["objects.9.support.hostId: A physical support relationship needs a hostId."]);
    expect(preview).toBeDefined();
    expect(preview!.scene.objects).toHaveLength(32);
    expect(preview!.scene.objects.some((candidate) => candidate.id === "unsupported-pool-house")).toBe(true);
    expect(preview!.diagnostics.unsupportedObjectIds).toEqual([]);
    expect(preview!.diagnostics.unresolvedSupportObjectIds).toContain("unsupported-pool-house");
    expect(preview!.diagnostics.renderWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNRESOLVED_SUPPORT", targetId: "unsupported-pool-house" })]));
    expect(preview!.diagnostics.skippedRelationshipIds).toContain("broken-relationship");
    expect(preview!.diagnostics.strictValidationErrors[0]).toContain("hostId");
    expect(preview!.diagnostics.normalizedFields).toContain("legacy-path: normalized legacy [x,z] route points to [x,y,z]");

    const connections = preview!.scene.siteHierarchy!.connections;
    expect(connections.find((connection) => connection.id === "three-d-drive")!.route).toEqual([[0, 0, 50], [0, 2, 15], [0, 4, 0]]);
    expect(connections.find((connection) => connection.id === "legacy-path")!.route).toEqual([[8, 0, 40], [8, 4, 0]]);

    // The existing V3 compiler consumes the recovered scene; no V2 fallback is involved.
    const compiled = compileV3Scene(preview!.scene);
    expect(compiled.primitives.some((primitive) => primitive.id === "unsupported-pool-house")).toBe(true);
    expect(compiled.primitives.some((primitive) => primitive.id === "v3-connection-three-d-drive")).toBe(true);
  });

  it("does not recover non-JSON or an unrecognizable top-level value", () => {
    expect(recoverV3FailedPreview("{not json")).toBeUndefined();
    expect(recoverV3FailedPreview(JSON.stringify({ version: 2, site: {}, objects: [] }))).toBeUndefined();
  });
});
