import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import { sitePlanSchema } from "@/lib/architecture/sitePlanContract";
import { placeV2AdditiveAsset } from "@/lib/architecture/v2AdditivePlacement";

const STORAGE_KEY = "ai-architect-projects";
const data = new Map<string, string>();

function stubBrowser() {
  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}

/** A fresh module graph is the browser-reload boundary for Zustand's persisted store. */
async function loadStore() {
  vi.resetModules();
  return (await import("../useProjectStore")).useProjectStore;
}

const acceptedSitePlan = sitePlanSchema.parse({
  entrance: { wall: "north", offset: 6 },
  driveway: { wall: "north", offset: 2, width: 4, length: 12 },
  parking: [{ x: 0, z: -18, width: 6, depth: 6 }],
  pool: { wall: "south", offset: 5, distance: 8, width: 8, depth: 4, waterDepth: 1.4 },
  terrace: { wall: "south", offset: 3, width: 10, depth: 5 },
  poolDeck: { x: 0, z: 16, width: 12, depth: 8 },
  paths: [
    { from: "arrival", to: "parking", x1: 0, z1: -30, x2: 0, z2: -18, width: 1, bend: 0, surface: "gravel" },
    { from: "parking", to: "entrance", x1: 0, z1: -18, x2: 0, z2: -8, width: 1, bend: 0, surface: "gravel" },
    { from: "entrance", to: "outdoor-living", x1: 0, z1: -8, x2: 0, z2: 8, width: 1, bend: 0, surface: "flagstone" },
    { from: "outdoor-living", to: "pool", x1: 0, z1: 8, x2: 0, z2: 16, width: 1, bend: 0, surface: "flagstone" },
  ],
  landscape: [
    { purpose: "pool-planting", kind: "garden", x: 16, z: 16, width: 6, depth: 6 },
    { purpose: "view-framing", kind: "lawn", x: -16, z: 16, width: 6, depth: 6 },
  ],
});

describe("new V2 Site Plan project persistence", () => {
  beforeEach(() => { data.clear(); stubBrowser(); });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips the accepted canonical Site Plan, including its authored pool deck, before a generic poolside chair placement", async () => {
    const store = await loadStore();
    const project = store.getState().createProject("New V2 pool house");
    // This is the completed new-V2-generation payload. There is deliberately no legacy `decks`
    // field: a reloaded follow-up must use the accepted, persisted Site Plan itself.
    const completedGeneration = JSON.stringify({
      architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse,
      sitePlan: acceptedSitePlan,
    });

    store.getState().appendVersion(project.id, "Generated V2 pool house", completedGeneration, "generation-complete");
    const saved = store.getState().getProject(project.id)!;
    expect(JSON.parse(saved.versions.at(-1)!.houseConfigJson).sitePlan).toEqual(acceptedSitePlan);
    expect(JSON.parse(data.get(STORAGE_KEY)!).state.projects[0].houseConfigJson).toBe(completedGeneration);

    const reloadedStore = await loadStore();
    const reloaded = reloadedStore.getState().getProject(project.id)!;
    const reloadedRoot = JSON.parse(reloaded.houseConfigJson) as Record<string, unknown>;
    expect(reloadedRoot.sitePlan).toEqual(acceptedSitePlan);
    expect((reloadedRoot.sitePlan as { poolDeck: unknown }).poolDeck).toEqual(acceptedSitePlan.poolDeck);

    const placed = placeV2AdditiveAsset(reloadedRoot, "add a lounge chair by the pool", [], []);
    expect(placed).toMatchObject({ ok: true, object: "chair", usedProceduralFallback: true });
    if (!placed.ok) throw new Error(placed.error);
    const afterPlacement = JSON.parse(placed.json);
    expect(afterPlacement.sitePlan).toEqual(acceptedSitePlan);
    expect(afterPlacement.outdoorAssetPlacements).toHaveLength(1);
    expect(afterPlacement.outdoorAssetPlacements[0]).toMatchObject({
      assetId: "procedural-v2-chair", parentSpaceId: "v2-poolside", position: expect.arrayContaining([expect.any(Number), 0]),
    });
  });
});
