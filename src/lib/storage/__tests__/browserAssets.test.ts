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
  it("names the origin and says the server library is the source of truth", () => {
    const n = originNotice("http://localhost:3001", 0);
    expect(n.text).toContain("http://localhost:3001");
    expect(n.text).toMatch(/server library/);
    expect(n.severe).toBe(false);
  });

  it("escalates while this browser holds assets the server does not", () => {
    const n = originNotice("http://localhost:3001", 3);
    expect(n.severe).toBe(true);
    expect(n.text).toMatch(/3 asset\(s\) exist only in this browser/);
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
