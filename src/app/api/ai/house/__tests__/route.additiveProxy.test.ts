import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import type { CuratedAsset } from "@/types/assets";

/** The real edit route with no live model, network or asset generation: every one of those is a regression here. */
const generateText = vi.fn(() => { throw new Error("unexpected AI call"); });
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: () => generateText() }));
const catalog: { assets: CuratedAsset[]; glbIds: string[] } = { assets: [], glbIds: [] };
vi.mock("@/lib/assets/serverStore", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/assets/serverStore")>()), assetBackend: () => ({ list: async () => catalog }) }));

const sitePlan = { poolDeck: { x: 0, z: 16, width: 12, depth: 8 }, landscape: [{ purpose: "pool-planting", kind: "garden", x: 16, z: 16, width: 6, depth: 6 }] };
const projectJson = () => JSON.stringify({ architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, sitePlan });
const GAZEBO_PROMPT = "Add a modern rooftop gazebo toward the rear side of the main roof.";
const chairGlb = { id: "chair-glb", name: "Pool lounge chair", type: "glb-model", status: "approved", validation: { passed: true }, categories: ["furniture"], tags: ["chair"], family: "furniture" } as CuratedAsset;
const network = vi.fn(() => { throw new Error("unexpected network call"); });

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "route-additive-proxy-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubGlobal("fetch", network);
  catalog.assets = []; catalog.glbIds = [];
  generateText.mockClear(); network.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function edit(prompt: string, projectId = "proj-a", currentHouseJson = projectJson()) {
  const { POST } = await import("../route");
  const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "edit", projectId, prompt, currentHouseJson }) }));
  return { res, body: (await res.json()) as { json?: string; code?: string; assetId?: string; assetNeedId?: string; proceduralFallback?: boolean; placementIds?: string[]; operation?: string } };
}
const needs = async () => (await (await import("@/lib/library/store")).readLibrary()).needs;

// The first case cold-imports the full route graph.
describe("V2 additive edit route: procedural proxy fallback", { timeout: 30_000 }, () => {
  it("answers a rooftop gazebo with a proxy placement instead of 422, and files one Need linked to it", async () => {
    const { res, body } = await edit(GAZEBO_PROMPT);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ operation: "addV2Placement", assetId: "procedural-v2-gazebo", proceduralFallback: true });
    const gazebo = (JSON.parse(body.json!).outdoorAssetPlacements as OutdoorAssetPlacement[]).find((p) => p.id === body.placementIds![0])!;
    expect(gazebo.proxy?.needId).toBe(body.assetNeedId);
    const [need] = await needs();
    expect(await needs()).toHaveLength(1);
    expect(need).toMatchObject({
      id: body.assetNeedId, title: "Modern Gazebo", category: "gazebo", status: "needed", requestedCount: 1,
      phrasings: [GAZEBO_PROMPT], contextTags: expect.arrayContaining(["rooftop"]), dimensions: { width: 3.6, depth: 3.6, height: 2.9 },
      components: ["gazebo"], sources: ["follow-up-edit"], proxyInUse: true, aliases: expect.arrayContaining(["gazebo"]),
      projectRefs: [expect.objectContaining({ projectId: "proj-a" })],
    });
  });

  it("reuses the same Need when another project asks for the same basic asset", async () => {
    const first = await edit(GAZEBO_PROMPT, "proj-a");
    const second = await edit("add a modern gazebo on the main roof", "proj-b");
    expect(second.body.assetNeedId).toBe(first.body.assetNeedId);
    const all = await needs();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ requestedCount: 2, projectRefs: [expect.objectContaining({ projectId: "proj-a" }), expect.objectContaining({ projectId: "proj-b" })] });
  });

  it("keeps the existing approved-GLB chair path: native asset placed, no Need recorded", async () => {
    catalog.assets = [chairGlb]; catalog.glbIds = [chairGlb.id];
    const { res, body } = await edit("add a lounge chair by the pool");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ operation: "addV2Placement", assetId: "chair-glb" });
    expect(body.proceduralFallback).toBeUndefined();
    expect(body.placementIds).toBeUndefined();
    expect(await needs()).toHaveLength(0);
  });

  it("refuses an architectural request without touching the project or the Needs", async () => {
    const { res, body } = await edit("add another bedroom");
    expect(res.status).toBe(422);
    expect(body).toMatchObject({ code: "ARCHITECTURAL_EDIT" });
    expect(body.json).toBeUndefined();
    expect(await needs()).toHaveLength(0);
  });

  it("never calls a live model, the network, or asset generation", async () => {
    await edit(GAZEBO_PROMPT);
    await edit("add a bench in the garden");
    await edit("add another bedroom");
    expect(generateText).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
});
