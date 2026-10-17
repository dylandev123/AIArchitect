import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_V3_SCENE } from "@/lib/v3/scene";
import { recoverV3FailedPreview } from "@/lib/v3/failedPreview";

const storage = new Map<string, string>();

function browser() {
  const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value), removeItem: (key: string) => void storage.delete(key) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}

async function load() {
  vi.resetModules();
  const { useProjectStore } = await import("@/store/useProjectStore");
  const { requestHouseEdit } = await import("../client");
  return { useProjectStore, requestHouseEdit };
}

beforeEach(browser);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("V3 initial client request", () => {
  it("sends the persisted V3 mode and V3 root, then preserves V3 on commit", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("V3 mansion", "house", "v3-scene");
    const currentHouseJson = project.houseConfigJson;
    const body = { summary: "V3 scene generated", json: JSON.stringify(BLANK_V3_SCENE) };
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "x-ai-architect-resolved-mode": "v3-scene" } }));
    vi.stubGlobal("fetch", fetch);

    const result = await requestHouseEdit({
      projectId: project.id,
      prompt: "Large hillside mansion",
      apply: (summary, json, writer) => useProjectStore.getState().appendVersion(project.id, summary, json, writer),
    });

    expect(result).toMatchObject({ ok: true, generated: true });
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(request).toMatchObject({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "flat", currentHouseJson });
    expect(JSON.parse(request.currentHouseJson)).toEqual(BLANK_V3_SCENE);
    expect(useProjectStore.getState().getProject(project.id)?.generationMode).toBe("v3-scene");
    expect(info).toHaveBeenCalledWith("[client-generation] resolvedMode: v3-scene");
    expect(info).toHaveBeenCalledWith("[client-generation]", {
      projectId: project.id,
      persistedMode: "v3-scene",
      clientResolvedMode: "v3-scene",
      requestMode: "v3-scene",
      serverResolvedMode: "v3-scene",
    });
  });

  it("sends advanced terrain only for a new generation, not subsequent edits", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("Advanced mansion", "house", "v3-scene", "advanced");
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: "offline mock" }), { status: 422 })));
    vi.stubGlobal("fetch", fetch);
    await requestHouseEdit({ projectId: project.id, prompt: "Cliffside", apply: vi.fn() });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ mode: "generate", v3TerrainMode: "advanced" });
    useProjectStore.getState().appendVersion(project.id, "Existing scene", project.houseConfigJson);
    await requestHouseEdit({ projectId: project.id, prompt: "Change finish", apply: vi.fn() });
    const edit = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(edit.mode).toBe("edit");
    expect(edit.v3TerrainMode).toBeUndefined();
  });

  it("blocks a project-record/root disagreement before any generation request", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("Conflicted project");
    useProjectStore.setState((state) => ({
      projects: state.projects.map((candidate) => candidate.id === project.id ? { ...candidate, generationMode: "v3-scene" } : candidate),
    }));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const result = await requestHouseEdit({ projectId: project.id, prompt: "A mansion", apply: () => { throw new Error("must not apply"); } });

    expect(result).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("Generation mode disagreement") });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("captures a failed V3 preview without persisting it, and clearing leaves the valid scene untouched", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const { useV3FailedPreviewStore } = await import("@/store/useV3FailedPreviewStore");
    const project = useProjectStore.getState().createProject("Preview safety", "house", "v3-scene");
    const before = useProjectStore.getState().getProject(project.id)!;
    const malformed = {
      version: 3, site: { width: 80, depth: 80 },
      objects: [{ id: "preview-volume", type: "volume", semanticRole: "house", label: "House", transform: { position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [20, 4, 16], material: { id: "stucco", color: "#eeeeee" }, support: { kind: "slab", relationship: "rests-on" } }],
      relationships: [],
    };
    const preview = recoverV3FailedPreview(JSON.stringify(malformed), ["objects.0.support.hostId: required"]);
    expect(preview).toBeDefined();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Terra output failed strict validation", v3FailedPreview: preview }), { status: 502, headers: { "Content-Type": "application/json", "x-ai-architect-resolved-mode": "v3-scene" } }));
    vi.stubGlobal("fetch", fetch);
    const apply = vi.fn();

    const result = await requestHouseEdit({ projectId: project.id, prompt: "Mansion", apply });

    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(apply).not.toHaveBeenCalled();
    expect(useProjectStore.getState().getProject(project.id)?.houseConfigJson).toBe(before.houseConfigJson);
    expect(useProjectStore.getState().getProject(project.id)?.versions).toHaveLength(before.versions.length);
    expect(useV3FailedPreviewStore.getState().candidate?.scene.objects[0].id).toBe("preview-volume");
    useV3FailedPreviewStore.getState().render(project.id);
    expect(useV3FailedPreviewStore.getState().active).toBe(true);
    useV3FailedPreviewStore.getState().clear();
    expect(useV3FailedPreviewStore.getState()).toMatchObject({ candidate: null, active: false });
    expect(useProjectStore.getState().getProject(project.id)?.houseConfigJson).toBe(before.houseConfigJson);
  });
});
