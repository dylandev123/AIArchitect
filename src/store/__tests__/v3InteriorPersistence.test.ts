import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_V3_SCENE } from "@/lib/v3/scene";
import { interiorScene } from "@/lib/v3/__tests__/interiorFixture";

const data = new Map<string, string>();
function browser() {
  const localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}
async function store() { vi.resetModules(); return (await import("../useProjectStore")).useProjectStore; }

describe("V3 semantic interior persistence", () => {
  beforeEach(() => { data.clear(); browser(); });
  afterEach(() => vi.unstubAllGlobals());

  it("saves and reloads storeys, rooms and room relationships identically", async () => {
    const projects = await store();
    const project = projects.getState().createProject("Three storey house", "house", "v3-scene");
    const root = { ...structuredClone(BLANK_V3_SCENE), v3Scene: interiorScene() };
    projects.getState().appendVersion(project.id, "interior", JSON.stringify(root));
    const reloaded = (await store()).getState().getProject(project.id)!;
    expect(JSON.parse(reloaded.houseConfigJson)).toEqual(root);
    expect(reloaded.houseConfigJson).toBe(JSON.stringify(root));
  });

  it("rejects a commit whose room has no valid storey, preserving history", async () => {
    const projects = await store();
    const project = projects.getState().createProject("Broken interior", "house", "v3-scene");
    const scene = interiorScene();
    scene.interior!.rooms[0] = { ...scene.interior!.rooms[0], storeyId: "nowhere" };
    expect(() => projects.getState().appendVersion(project.id, "bad", JSON.stringify({ ...BLANK_V3_SCENE, v3Scene: scene }))).toThrow(/ROOM_MISSING_STOREY|missing storey/);
    expect(projects.getState().getProject(project.id)).toEqual(project);
  });
});
