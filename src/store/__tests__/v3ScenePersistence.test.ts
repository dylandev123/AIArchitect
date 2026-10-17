import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_V3_SCENE } from "@/lib/v3/scene";

const data = new Map<string, string>();
function browser() {
  const localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}
async function store() { vi.resetModules(); return (await import("../useProjectStore")).useProjectStore; }

describe("V3 scene project persistence", () => {
  it("persists terrain preferences separately from scenes and leaves V2 unset", async () => {
    const projects = await store();
    const flat = projects.getState().createProject("Flat", "house", "v3-scene");
    const advanced = projects.getState().createProject("Advanced", "house", "v3-scene", "advanced");
    const v2 = projects.getState().createProject("V2");
    const { flatMansion } = await import("@/lib/v3/__tests__/flatMansionFixture");
    const { ingestV3GenerationOutput } = await import("@/lib/v3/ingestion");
    const result = ingestV3GenerationOutput(flatMansion(), "flat");
    const json = JSON.stringify({ ...BLANK_V3_SCENE, v3Scene: result.scene });
    projects.getState().appendVersion(flat.id, "Flat mansion", json);
    const reloaded = (await store()).getState();
    expect(reloaded.getProject(flat.id)?.v3TerrainMode).toBe("flat");
    expect(reloaded.getProject(advanced.id)?.v3TerrainMode).toBe("advanced");
    expect(reloaded.getProject(v2.id)?.v3TerrainMode).toBeUndefined();
    expect(reloaded.getProject(flat.id)?.houseConfigJson).toBe(json);
    expect(reloaded.duplicateProject(advanced.id)?.v3TerrainMode).toBe("advanced");
  });

  beforeEach(() => { data.clear(); browser(); });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps V3 opt-in, stable objects, terrain elevations and no V2 document across reload", async () => {
    const projects = await store();
    const project = projects.getState().createProject("Experimental hillside", "house", "v3-scene");
    const root = structuredClone(BLANK_V3_SCENE);
    root.v3Scene.objects.push({ id: "terrace", type: "slab", semanticRole: "raised terrace", label: "Raised Terrace", transform: { position: [4, 22, -8], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [24, 0.5, 12], material: { id: "stone", color: "#817a70", surface: "stone" }, collision: "walkable", groupId: "upper-level" });
    projects.getState().appendVersion(project.id, "V3 hillside scene", JSON.stringify(root));
    const reloaded = await store();
    const restored = reloaded.getState().getProject(project.id)!;
    const persisted = JSON.parse(restored.houseConfigJson);
    expect(restored.generationMode).toBe("v3-scene");
    expect(persisted.architecturalDesignDocument).toBeUndefined();
    expect(persisted.v3Scene.objects[0]).toMatchObject({ id: "terrace", groupId: "upper-level", transform: { position: [4, 22, -8] } });
  });

  it("persists semantic partitions and doors by id, and rejects commits with broken interior references", async () => {
    const { partitionedScene } = await import("@/lib/v3/__tests__/interiorFixture");
    const projects = await store();
    const project = projects.getState().createProject("Partitioned house", "house", "v3-scene");
    const root = { ...structuredClone(BLANK_V3_SCENE), v3Scene: partitionedScene() };
    projects.getState().appendVersion(project.id, "Partitions", JSON.stringify(root));
    const restored = JSON.parse((await store()).getState().getProject(project.id)!.houseConfigJson);
    expect(restored.v3Scene.interior).toEqual(root.v3Scene.interior);
    const broken = structuredClone(root);
    broken.v3Scene.interior!.doors![0].partitionId = "missing-wall";
    const reloaded = await store(), before = reloaded.getState().getProject(project.id)!.houseConfigJson;
    expect(() => reloaded.getState().appendVersion(project.id, "Broken", JSON.stringify(broken))).toThrow(/DOOR_MISSING_PARTITION|missing partition/);
    expect(reloaded.getState().getProject(project.id)!.houseConfigJson).toBe(before);
  });

  it("atomically saves and reloads the repaired cliffside driveway", async () => {
    const { malformedCliffsideDrive } = await import("@/lib/v3/__tests__/cliffsideIngestionFixture");
    const { ingestV3GenerationOutput } = await import("@/lib/v3/ingestion");
    const prepared = ingestV3GenerationOutput(malformedCliffsideDrive({ dimensions: undefined, transform: undefined }));
    expect(prepared.ok).toBe(true);
    const projects = await store();
    const project = projects.getState().createProject("Cliffside regression", "house", "v3-scene");
    const root = { ...structuredClone(BLANK_V3_SCENE), v3Scene: prepared.scene };
    projects.getState().appendVersion(project.id, "Repaired driveway", JSON.stringify(root));
    const reloaded = await store();
    const saved = reloaded.getState().getProject(project.id)!.houseConfigJson;
    expect(JSON.parse(saved).v3Scene).toEqual(prepared.scene);
    const broken = structuredClone(root);
    broken.v3Scene.objects.find(o => o.type === "building-mass")!.dimensions = [0, 0, 0];
    expect(() => reloaded.getState().appendVersion(project.id, "Invalid mass", JSON.stringify(broken))).toThrow();
    expect(reloaded.getState().getProject(project.id)!.houseConfigJson).toBe(saved);
  });

  it("rejects V2 or malformed commits without changing current V3 history", async () => {
    const projects = await store();
    const project = projects.getState().createProject("Protected V3", "house", "v3-scene");
    expect(() => projects.getState().appendVersion(project.id, "bad", '{}')).toThrow(/V3/);
    expect(() => projects.getState().updateHouseConfig(project.id, 'not json')).toThrow(/V3/);
    expect(projects.getState().getProject(project.id)).toEqual(project);
  });

  it("persists and reads back a fresh V3 root before workspace entry", async () => {
    const projects = await store();
    const { verifyPersistedProjectMode } = await import("../useProjectStore");
    const project = projects.getState().createProject("Fresh V3", "house", "v3-scene");

    const persisted = verifyPersistedProjectMode(project.id, "v3-scene");
    expect(persisted).toMatchObject({ ok: true, persistedMode: "v3-scene" });
    if (persisted.ok) expect(JSON.parse(persisted.project.houseConfigJson)).toEqual(BLANK_V3_SCENE);
  });

  it("recovers the V3 project mode from its persisted scene root on a same-version reload", async () => {
    const projects = await store();
    const project = projects.getState().createProject("Legacy V3", "house", "v3-scene");
    const saved = JSON.parse(data.get("ai-architect-projects")!);
    delete saved.state.projects[0].generationMode;
    data.set("ai-architect-projects", JSON.stringify(saved));

    const reloaded = await store();
    expect(reloaded.getState().getProject(project.id)?.generationMode).toBe("v3-scene");
  });

  it("keeps an old V2 root as V2 rather than converting it to V3", async () => {
    const projects = await store();
    const project = projects.getState().createProject("Legacy V2", "house", "v2-architectural");
    const reloaded = await store();

    expect(reloaded.getState().getProject(project.id)?.generationMode).toBe("v2-architectural");
    expect(JSON.parse(reloaded.getState().getProject(project.id)!.houseConfigJson)).not.toMatchObject({ generationMode: "v3-scene" });
  });
});
