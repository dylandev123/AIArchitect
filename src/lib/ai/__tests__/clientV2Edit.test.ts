import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import { compileArchitecture } from "@/lib/architecture/compiler";
import { documentAudit, primitiveBounds } from "@/lib/architecture/renderAudit";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";

// The real-handler cases below are deterministic; any model call is a regression.
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: () => { throw new Error("unexpected AI call"); } }));

function stubBrowser() {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}

function jsonFor(document = ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2) {
  // A non-empty legacy array makes this an existing project, as it is in the workspace after V2 generation.
  return JSON.stringify({ house: { width: 18, depth: 10, floors: 1, roof: "flat" }, decks: [{ id: "legacy-deck", x: 0, z: 16, width: 12, depth: 8 }], architecturalDesignDocument: document });
}

async function load() {
  vi.resetModules();
  const { useProjectStore } = await import("@/store/useProjectStore");
  const { requestHouseEdit, V2_EDIT_UNCHANGED_MESSAGE } = await import("../client");
  return { useProjectStore, requestHouseEdit, V2_EDIT_UNCHANGED_MESSAGE };
}

beforeEach(async () => {
  stubBrowser();
  // Keep the handler's local asset-need/library writes out of the workspace `.data` directory.
  const dir = await mkdtemp(path.join(tmpdir(), "client-v2-edit-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("AI_ASSET_STORE_PATH", path.join(dir, "assets"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function viaRealHandler() {
  const { POST } = await import("@/app/api/ai/house/route");
  const payloads: Array<{ operation?: string; code?: string }> = [];
  const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
    const response = await POST(new NextRequest("http://localhost/api/ai/house", {
      method: "POST", headers: init?.headers, body: init?.body,
    }));
    payloads.push(await response.clone().json());
    return response;
  });
  vi.stubGlobal("fetch", fetchSpy);
  return { fetchSpy, payloads };
}

describe("requestHouseEdit V2 commit boundary", () => {
  it("rejects a legacy-only rooftop-deck response rather than claiming the active V2 architecture changed", async () => {
    const { useProjectStore, requestHouseEdit, V2_EDIT_UNCHANGED_MESSAGE } = await load();
    const project = useProjectStore.getState().createProject("Luxury V2");
    const base = jsonFor();
    useProjectStore.getState().updateHouseConfig(project.id, base);
    const legacyOnly = JSON.stringify({ ...JSON.parse(base), decks: [{ id: "legacy-deck", x: 0, z: 8, width: 9, depth: 6, shape: "rounded" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ summary: "I made a rooftop terrace.", json: legacyOnly }) }));

    const apply = vi.fn();
    const result = await requestHouseEdit({ projectId: project.id, prompt: "Design a rooftop terrace", apply });

    expect(result).toEqual({ ok: false, error: V2_EDIT_UNCHANGED_MESSAGE, status: 422 });
    expect(apply).not.toHaveBeenCalled();
    expect(useProjectStore.getState().getProject(project.id)!.houseConfigJson).toBe(base);
  });

  it("commits a deterministic V2 mass move and resize through the same follow-up client path", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("Luxury V2");
    const base = jsonFor();
    useProjectStore.getState().updateHouseConfig(project.id, base);
    const original = ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2;
    const moved = {
      ...original,
      massing: { ...original.massing, masses: original.massing.masses.map((mass) => mass.id === "living" ? { ...mass, position: { ...mass.position, x: mass.position.x + 15 }, width: mass.width + 8, depth: mass.depth + 4 } : mass) },
    };
    const next = jsonFor(moved);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ summary: "Moved and enlarged the main living pavilion.", json: next }) }));

    const result = await requestHouseEdit({ projectId: project.id, prompt: "Move the main living pavilion 15m east and enlarge it", apply: (summary, json, writer) => useProjectStore.getState().appendVersion(project.id, summary, json, writer) });

    const persisted = useProjectStore.getState().getProject(project.id)!;
    const beforePrimitives = compileArchitecture(original, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives;
    const afterPrimitives = compileArchitecture(moved, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives;
    expect(result).toMatchObject({ ok: true, generated: false });
    expect(documentAudit(original).hash).not.toBe(documentAudit(moved).hash);
    expect(persisted.houseConfigJson).toBe(next);
    expect(primitiveBounds(beforePrimitives)).not.toEqual(primitiveBounds(afterPrimitives));
    expect(persisted.versions.at(-1)?.summary).toContain("Moved and enlarged");
  });

  it("commits a mocked V2 Site Plan-only outdoor-bar addition without changing the architectural document", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("Luxury V2");
    const base = jsonFor();
    const parsed = JSON.parse(base);
    // The client boundary only needs a valid V2 root; the route's deterministic placement is covered separately.
    const next = JSON.stringify({ ...parsed, sitePlan: { features: [{ id: "bar-1", kind: "outdoor_bar", x: 20, z: 14, width: 6, depth: 3, rotation: 0 }] } });
    useProjectStore.getState().updateHouseConfig(project.id, base);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ summary: "Added an outdoor bar.", json: next }) }));

    const result = await requestHouseEdit({ projectId: project.id, prompt: "add an outdoor bar", apply: (summary, json, writer) => useProjectStore.getState().appendVersion(project.id, summary, json, writer) });
    const persisted = JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson);
    expect(result).toMatchObject({ ok: true, generated: false });
    expect(persisted.architecturalDesignDocument).toEqual(parsed.architecturalDesignDocument);
    expect(persisted.sitePlan.features).toEqual([{ id: "bar-1", kind: "outdoor_bar", x: 20, z: 14, width: 6, depth: 3, rotation: 0 }]);
  });

  it("sends the workspace V2 request shape through the real handler and commits its addV2Placement response", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("V2 workspace project");
    // The persisted workspace shape after V2 generation: architecture, the rendered legacy deck and the canonical Site Plan.
    const base = JSON.stringify({ ...JSON.parse(jsonFor()), sitePlan: { poolDeck: { x: 0, z: 16, width: 12, depth: 8 } } });
    useProjectStore.getState().updateHouseConfig(project.id, base);
    const { fetchSpy, payloads } = await viaRealHandler();

    const result = await requestHouseEdit({
      projectId: project.id,
      prompt: "add an outdoor bar",
      apply: (summary, json, writer) => useProjectStore.getState().appendVersion(project.id, summary, json, writer),
    });

    const request = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const persisted = JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson);
    expect(request).toMatchObject({ mode: "edit", projectId: project.id, prompt: "add an outdoor bar", currentHouseJson: base });
    expect(payloads[0]?.operation).toBe("addV2Placement");
    expect(result).toMatchObject({ ok: true, generated: false });
    expect(persisted.architecturalDesignDocument).toEqual(JSON.parse(base).architecturalDesignDocument);
    expect(persisted.sitePlan).toMatchObject({ poolDeck: { x: 0, z: 16, width: 12, depth: 8 } });
    expect(persisted.sitePlan.features).toHaveLength(1);
  });

  it("refuses an additive edit on a legacy V2 project without a persisted Site Plan and commits nothing", async () => {
    const { useProjectStore, requestHouseEdit } = await load();
    const project = useProjectStore.getState().createProject("Legacy V2 workspace project");
    // Pre-Site Plan persistence shape: V2 architecture plus the rendered legacy deck, but no `sitePlan` key.
    // The deck is deliberately not reconstructed into an anchor (see v2SitePlanOf).
    const base = jsonFor();
    useProjectStore.getState().updateHouseConfig(project.id, base);
    const { payloads } = await viaRealHandler();

    const apply = vi.fn();
    const result = await requestHouseEdit({ projectId: project.id, prompt: "add an outdoor bar", apply });

    expect(payloads[0]).toMatchObject({ code: "NO_VALID_SITE_PLAN" });
    expect(payloads[0]?.operation).toBeUndefined();
    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(apply).not.toHaveBeenCalled();
    expect(useProjectStore.getState().getProject(project.id)!.houseConfigJson).toBe(base);
  });
});
