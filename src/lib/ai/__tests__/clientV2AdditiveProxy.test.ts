import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";

// The whole follow-up path is deterministic; any model call is a regression.
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: () => { throw new Error("unexpected AI call"); } }));

const storage = new Map<string, string>();
function stubBrowser() {
  const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value), removeItem: (key: string) => void storage.delete(key) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}

/** A fresh module graph is the browser-reload boundary for Zustand's persisted store. */
async function load() {
  vi.resetModules();
  const { useProjectStore } = await import("@/store/useProjectStore");
  const { requestHouseEdit } = await import("../client");
  const { POST } = await import("@/app/api/ai/house/route");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", headers: init?.headers, body: init?.body }))));
  return { useProjectStore, requestHouseEdit };
}

beforeEach(async () => {
  storage.clear();
  stubBrowser();
  const dir = await mkdtemp(path.join(tmpdir(), "client-v2-additive-proxy-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("AI_ASSET_STORE_PATH", path.join(dir, "assets"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

// Cold-imports the full route graph twice (initial load + reload); keep it out of the default 5 s budget.
describe("rooftop gazebo proxy through the real follow-up edit path", { timeout: 30_000 }, () => {
  it("commits as ai-followup-edit, leaves the architecture untouched, and reloads with the same proxy placement", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("V2 pavilion house");
    const base = JSON.stringify({ architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, sitePlan: { poolDeck: { x: 0, z: 16, width: 12, depth: 8 } } });
    useProjectStore.getState().appendVersion(project.id, "Generated V2 pavilion house", base, "generation-complete");

    const writers: (string | undefined)[] = [];
    const result = await requestHouseEdit({
      projectId: project.id, prompt: "Add a modern rooftop gazebo toward the rear side of the main roof.",
      apply: (summary, json, writer) => { writers.push(writer); useProjectStore.getState().appendVersion(project.id, summary, json, writer); },
    });
    expect(result).toMatchObject({ ok: true, generated: false });
    expect(writers).toEqual(["ai-followup-edit"]);
    const saved = JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson);
    expect(JSON.stringify(saved.architecturalDesignDocument)).toBe(JSON.stringify(JSON.parse(base).architecturalDesignDocument));
    expect(saved.sitePlan).toEqual(JSON.parse(base).sitePlan);
    const [gazebo] = saved.outdoorAssetPlacements as OutdoorAssetPlacement[];
    expect(gazebo).toMatchObject({ assetId: "procedural-v2-gazebo", support: { kind: "roof", massId: "living" }, proxy: { shape: "post-frame", objectType: "gazebo", needId: expect.any(String) } });

    const reloaded = await load();
    const after = JSON.parse(reloaded.useProjectStore.getState().getProject(project.id)!.houseConfigJson);
    expect(after.outdoorAssetPlacements).toEqual(saved.outdoorAssetPlacements);
    expect(JSON.stringify(after.architecturalDesignDocument)).toBe(JSON.stringify(saved.architecturalDesignDocument));
  });
});
