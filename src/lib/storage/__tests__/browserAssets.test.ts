import { describe, expect, it } from "vitest";
import { createMemoryGlbStore } from "@/lib/assets/glbStorage";
import { originNotice, readPersistedAssetCounts } from "@/lib/storage/browserAssets";

describe("readPersistedAssetCounts", () => {
  it("reads counts from the zustand persist envelope", () => {
    expect(readPersistedAssetCounts(JSON.stringify({ state: { catalog: [{}, {}], queue: [{}] }, version: 0 }))).toEqual({ present: true, corrupt: false, catalog: 2, queue: 1 });
  });

  it("distinguishes a missing key from a corrupt one", () => {
    expect(readPersistedAssetCounts(null)).toMatchObject({ present: false, corrupt: false });
    expect(readPersistedAssetCounts("{not json")).toMatchObject({ present: true, corrupt: true });
  });
});

describe("originNotice", () => {
  it("always names the origin and says the data is origin-specific", () => {
    const n = originNotice("http://localhost:3001", 4, true);
    expect(n.text).toContain("http://localhost:3001");
    expect(n.text).toMatch(/separate copy/);
    expect(n.severe).toBe(false);
  });

  it("escalates when this origin is empty but the server library has data", () => {
    expect(originNotice("http://localhost:3001", 0, true).severe).toBe(true);
    expect(originNotice("http://localhost:3001", 0, false).severe).toBe(false);
  });
});

describe("GLB store keys()", () => {
  it("lists stored ids without changing them", async () => {
    const store = createMemoryGlbStore();
    await store.put("a", new ArrayBuffer(1));
    await store.put("b", new ArrayBuffer(1));
    expect((await store.keys()).sort()).toEqual(["a", "b"]);
    expect((await store.keys()).length).toBe(2);
  });
});
