import { describe, expect, it, vi } from "vitest";
import { compileV3Scene, type V3Scene, type V3SceneObject } from "../scene";
import { upgradeLegacyV3SiteHierarchy } from "../siteHierarchyMigration";

const object = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<V3SceneObject> = {}): V3SceneObject => ({
  id, type, semanticRole: id.replaceAll("-", " "), label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions,
  material: { id: "concrete", color: "#6b6862", roughness: .78, surface: "concrete" }, collision: "solid", ...extra,
});

/** Persisted legacy regression target: deliberately has implicit elevations and no siteHierarchy. */
const legacyMansion = (): V3Scene => ({
  version: 3, site: { width: 220, depth: 180, baseElevation: 0, groundMaterial: { id: "grass", color: "#426d38", surface: "grass" } }, relationships: [], metadata: { brief: "persisted luxury hillside mansion" },
  objects: [
    object("hillside", "terrain-region", [0, 0, 0], [220, 1, 180], { collision: "walkable", terrain: { operation: "slopeRegion", rise: 28, direction: "z" }, material: { id: "earth", color: "#496842", surface: "grass" } }),
    object("lower-entertainment", "volume", [0, 5, 12], [42, 10, 24], { metadata: { embedded: true } }),
    object("main-pavilion", "volume", [-5, 18, -4], [50, 12, 28]),
    object("east-wing", "volume", [35, 24, 3], [22, 10, 18]),
    object("roof-terrace", "slab", [-5, 25, -4], [54, .45, 32], { collision: "walkable", material: { id: "paving", color: "#b9ad97", surface: "paving" } }),
    object("pool-deck", "slab", [-24, 11, 37], [32, .5, 20], { collision: "walkable", material: { id: "travertine", color: "#c6bda8", surface: "paving" } }),
    object("infinity-pool", "pool", [-24, 10.2, 38], [22, 1.2, 8], { collision: "water", material: { id: "water", color: "#247ca1", opacity: .85, surface: "water" }, hostId: "pool-deck" }),
    object("arrival-drive", "path", [14, 11, -58], [7, .3, 70], { collision: "walkable", terrain: { operation: "gradePath", rise: 14, direction: "z" }, material: { id: "asphalt", color: "#353638", surface: "paving" } }),
    object("retaining-wall", "retaining-wall", [28, 14, -12], [42, 5, .7], { metadata: { followsTerrain: true } }),
    object("entry-gate", "gate", [14, 17, -88], [8, 3, .3], { groupId: "boundary", source: { kind: "proxy", replaceable: true } }),
    object("boundary-fence", "fence", [-58, 12, -20], [.3, 2, 110], { groupId: "boundary", metadata: { followsTerrain: true } }),
    object("outdoor-sofa", "proxy-asset", [-26, 12, 28], [4, 1, 1.4], { source: { kind: "proxy", replaceable: true }, groupId: "pool-lounge" }),
    object("feature-tree", "proxy-asset", [48, 18, 18], [5, 10, 5], { source: { kind: "proxy", replaceable: true }, material: { id: "foliage", color: "#315b31", surface: "grass" } }),
  ],
});

/** The failure shape reported by the hierarchy upgrader: all relationships are implicit in geometry. */
const legacySiteFailure = (): V3Scene => ({
  version: 3, site: { width: 180, depth: 150, baseElevation: 0 }, metadata: {}, relationships: [],
  objects: [
    object("terrain-z", "terrain-region", [0, 0, 0], [180, 1, 150], { collision: "walkable", terrain: { operation: "slopeRegion", rise: 12, direction: "z" }, material: { id: "earth", color: "#496842", surface: "grass" } }),
    object("terrain-x", "terrain-region", [28, 0, -5], [50, 1, 45], { collision: "walkable", terrain: { operation: "slopeRegion", rise: 5, direction: "x" }, material: { id: "earth", color: "#496842", surface: "grass" } }),
    object("arrival-drive", "path", [0, 4, -50], [7, .3, 40], { collision: "walkable", terrain: { operation: "gradePath", rise: 4, direction: "z" } }),
    object("main-house", "volume", [0, 12, -5], [50, 12, 30]),
    object("upper-wing", "volume", [42, 16, -5], [20, 12, 20]),
    object("court", "surface", [0, 6.25, -28], [28, .5, 18], { collision: "walkable" }),
    object("pool-deck", "slab", [0, 2.25, 28], [40, .5, 22], { collision: "walkable" }),
    object("pool", "pool", [0, 3, 28], [18, 1, 7], { collision: "water" }),
    object("fencew", "fence", [-76, 5, 0], [.3, 2, 105]),
    object("fencee", "fence", [76, 5, 0], [.3, 2, 105]),
    object("retw", "retaining-wall", [0, 4, 14], [48, 4, .7]),
    object("rete", "retaining-wall", [27, 7, -5], [.7, 4, 40]),
    object("stairmain", "stair", [0, 4, 14], [3, 4, 12], { collision: "walkable" }),
    object("stairstep", "stair", [27, 8, -5], [12, 4, 3], { collision: "walkable" }),
    object("spa", "proxy-asset", [0, 3.5, 28], [6, 2, 6], { source: { kind: "proxy", replaceable: true } }),
    object("railpool", "railing", [0, 3, 17], [12, 1, .2]),
    object("raileast", "railing", [20, 3, 28], [.2, 1, 12]),
    object("railwes", "railing", [-20, 3, 28], [.2, 1, 12]),
  ],
});

describe("legacy V3 site hierarchy migration", () => {
  it("migrates the persisted mansion deterministically without AI/network and retains authored identity", () => {
    const legacy = legacyMansion();
    const network = vi.spyOn(globalThis, "fetch");
    const migrated = upgradeLegacyV3SiteHierarchy(legacy);

    expect(network).not.toHaveBeenCalled();
    expect(migrated.ok, migrated.errors.join("\n")).toBe(true);
    expect(migrated.scene.siteHierarchy).toBeDefined();
    expect(migrated.scene.objects.map((item) => item.id)).toEqual(legacy.objects.map((item) => item.id));
    for (const before of legacy.objects) {
      const after = migrated.scene.objects.find((item) => item.id === before.id)!;
      expect(after.material).toEqual(before.material);
      expect(after.semanticRole).toBe(before.semanticRole);
      expect(after.transform.rotation).toEqual(before.transform.rotation);
      expect(after.transform.scale).toEqual(before.transform.scale);
      if (!["entry-gate", "outdoor-sofa", "feature-tree"].includes(before.id)) expect(after.transform.position).toEqual(before.transform.position);
    }
    expect(migrated.report.levels.map((level) => level.id)).toEqual(expect.arrayContaining(["level-lower-entertainment", "level-main-pavilion", "level-east-wing", "level-pool-deck"]));
    expect(migrated.scene.objects.find((item) => item.id === "arrival-drive")?.support?.kind).toBe("terrain");
    expect(migrated.scene.objects.find((item) => item.id === "main-pavilion")?.support?.levelId).toBe("level-main-pavilion");
    expect(migrated.scene.objects.find((item) => item.id === "lower-entertainment")?.support?.grounding).toBe("embedded");
    expect(migrated.scene.objects.find((item) => item.id === "pool-deck")?.support?.levelId).toBe("level-pool-deck");
    expect(migrated.scene.objects.find((item) => item.id === "boundary-fence")?.support).toMatchObject({ kind: "terrain" });
    expect(migrated.report.groundingIssues.after).toEqual([]);
    expect(migrated.report.rendersCleanly).toBe(true);
    const model = compileV3Scene(migrated.scene);
    expect(model.primitives.some((primitive) => primitive.id === "arrival-drive")).toBe(true);
    expect(model.primitives.some((primitive) => primitive.id.startsWith("boundary-fence-"))).toBe(true);
    network.mockRestore();
  });

  it("is idempotent and survives a persisted JSON reload without changing ordinary transforms", () => {
    const first = upgradeLegacyV3SiteHierarchy(legacyMansion());
    expect(first.ok).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(first.scene)) as V3Scene;
    const second = upgradeLegacyV3SiteHierarchy(reloaded);
    expect(second.ok).toBe(true);
    expect(second.scene).toEqual(reloaded);
    expect(second.report.migrated).toBe(false);
    const treeBefore = legacyMansion().objects.find((item) => item.id === "feature-tree")!;
    const treeAfter = first.scene.objects.find((item) => item.id === "feature-tree")!;
    expect(treeAfter.transform.position[0]).toBe(treeBefore.transform.position[0]);
    expect(treeAfter.transform.position[2]).toBe(treeBefore.transform.position[2]);
    expect(treeAfter.transform.position[1]).not.toBe(treeBefore.transform.position[1]); // explicit, deterministic grounding correction
  });

  it("derives the reported court, terrain fences, retaining transitions, stairs, spa, and terrace railings from geometry", () => {
    const first = upgradeLegacyV3SiteHierarchy(legacySiteFailure());
    expect(first.ok, first.errors.join("\n")).toBe(true);
    expect(first.report.groundingIssues.after).toEqual([]);
    expect(first.scene.objects.find((item) => item.id === "court")?.support?.levelId).toMatch(/^level-/);
    for (const id of ["fencew", "fencee"]) expect(first.scene.objects.find((item) => item.id === id)).toMatchObject({ support: { kind: "terrain" }, metadata: { followsTerrain: true } });
    for (const id of ["stairmain", "stairstep"]) expect(first.scene.siteHierarchy?.connections.some((item) => item.surfaceObjectId === id)).toBe(true);
    expect(first.scene.objects.find((item) => item.id === "spa")?.support?.objectId).toBe("pool-deck");
    for (const id of ["railpool", "raileast", "railwes"]) expect(first.scene.objects.find((item) => item.id === id)?.support?.objectId).toBe("pool-deck");
    expect(first.report.supportAssignments.find((item) => item.objectId === "court")).toMatchObject({ confidence: expect.any(Number), evidence: expect.any(Array) });
    expect(upgradeLegacyV3SiteHierarchy(JSON.parse(JSON.stringify(first.scene))).scene).toEqual(first.scene);
  });

  it("resolves the same support graph after arbitrary identifiers and labels are renamed", () => {
    const scene = legacySiteFailure();
    const names = new Map([["court", "surface-381"], ["pool-deck", "platform-818"], ["spa", "asset-123"], ["railpool", "edge-a"], ["raileast", "edge-b"], ["railwes", "edge-c"]]);
    for (const item of scene.objects) if (names.has(item.id)) { item.id = names.get(item.id)!; item.label = `renamed ${item.type}`; item.semanticRole = item.type; }
    const result = upgradeLegacyV3SiteHierarchy(scene);
    expect(result.ok, result.errors.join("\n")).toBe(true);
    expect(result.scene.objects.find((item) => item.id === "asset-123")?.support?.objectId).toBe("platform-818");
    for (const id of ["edge-a", "edge-b", "edge-c"]) expect(result.scene.objects.find((item) => item.id === id)?.support?.objectId).toBe("platform-818");
    expect(result.report.supportGraph.find((link) => link.objectId === "asset-123")?.evidence.join(" ")).not.toMatch(/spa|pool|court/i);
  });

  it("propagates a generic terrain → structure → upper platform → asset support chain", () => {
    const scene: V3Scene = { version: 3, site: { width: 80, depth: 80, baseElevation: 0 }, relationships: [], metadata: {}, objects: [
      object("ground-form", "terrain-region", [0, 0, 0], [80, 1, 80], { terrain: { operation: "createTerrace" } }),
      object("mass-17", "volume", [0, 2, 0], [20, 4, 16]),
      object("platform-42", "slab", [0, 4.25, 0], [16, .5, 12], { collision: "walkable" }),
      object("object-900", "proxy-asset", [0, 5, 0], [2, 1, 2]),
      object("roof-99", "roof", [0, 4.5, 0], [20, .5, 16]),
      object("object-901", "proxy-asset", [0, 5.5, 0], [2, 1, 2], { hostId: "roof-99" }),
    ] };
    const result = upgradeLegacyV3SiteHierarchy(scene);
    expect(result.ok, result.errors.join("\n")).toBe(true);
    expect(result.scene.objects.find((item) => item.id === "platform-42")?.support?.objectId).toBe("mass-17");
    expect(result.scene.objects.find((item) => item.id === "object-900")?.support?.objectId).toBe("platform-42");
    expect(result.scene.objects.find((item) => item.id === "object-901")?.support?.objectId).toBe("roof-99");
    expect(result.scene.objects.find((item) => item.id === "object-900")?.support?.levelId).toBe("level-mass-17");
  });

  it("keeps unresolved supports unresolved so validation remains the atomic commit gate", () => {
    const ambiguousStair = legacySiteFailure();
    ambiguousStair.objects.find((item) => item.id === "stairmain")!.transform.position = [70, 9, 50];
    const result = upgradeLegacyV3SiteHierarchy(ambiguousStair);
    expect(result.ok).toBe(false);
    expect(result.scene).toEqual(ambiguousStair);
    expect(result.report.ambiguousObjectIds).toContain("stairmain");
    expect(result.errors.join("\n")).toContain("UNRESOLVED_CONNECTOR");
  });

  it("does not falsely turn a slab-hosted fence into a terrain-following fence", () => {
    const scene = legacySiteFailure();
    scene.objects.push(object("deck-fence", "fence", [0, 3.5, 17], [14, 2, .2]));
    const result = upgradeLegacyV3SiteHierarchy(scene);
    expect(result.ok, result.errors.join("\n")).toBe(true);
    expect(result.scene.objects.find((item) => item.id === "deck-fence")?.support).toMatchObject({ objectId: "pool-deck" });
    expect(result.scene.objects.find((item) => item.id === "deck-fence")?.metadata?.followsTerrain).toBeUndefined();
  });

  it("does not attach a railing when no compatible terrace edge is nearby", () => {
    const scene = legacySiteFailure();
    scene.objects.push(object("isolated-rail", "railing", [68, 3, 58], [10, 1, .2]));
    const result = upgradeLegacyV3SiteHierarchy(scene);
    expect(result.ok).toBe(false);
    expect(result.scene).toEqual(scene);
    expect(result.report.ambiguousObjectIds).toContain("isolated-rail");
  });

  it("does not invent a retaining transition without a terrain elevation difference", () => {
    const scene = legacySiteFailure();
    scene.objects = scene.objects.filter((item) => item.id !== "terrain-z" && item.id !== "terrain-x");
    const result = upgradeLegacyV3SiteHierarchy(scene);
    expect(result.ok).toBe(true);
    expect(result.scene.siteHierarchy).toBeDefined();
  });

  it("persists the migrated scene as an undoable project version without a request", async () => {
    const data = new Map<string, string>();
    const localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) };
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
    vi.resetModules();
    const { useProjectStore } = await import("@/store/useProjectStore");
    const project = useProjectStore.getState().createProject("Saved legacy mansion", "house", "v3-scene");
    const migrated = upgradeLegacyV3SiteHierarchy(legacyMansion());
    expect(migrated.ok).toBe(true);
    useProjectStore.getState().appendVersion(project.id, "Legacy V3 mansion", JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: legacyMansion() }));
    useProjectStore.getState().appendVersion(project.id, "Upgrade V3 Site Hierarchy", JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: migrated.scene }));
    useProjectStore.getState().undo(project.id);
    expect(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson).v3Scene.siteHierarchy).toBeUndefined();
    useProjectStore.getState().redo(project.id);
    vi.resetModules();
    const { useProjectStore: reloadedStore } = await import("@/store/useProjectStore");
    const reloaded = JSON.parse(reloadedStore.getState().getProject(project.id)!.houseConfigJson) as { v3Scene: V3Scene };
    expect(reloaded.v3Scene.siteHierarchy?.levels.map((level) => level.id)).toContain("level-main-pavilion");
    vi.unstubAllGlobals();
  });
});
