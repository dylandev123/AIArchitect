import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CuratedAsset } from "@/types/assets";
import { createPostgresAssetBackend, sha256 } from "../serverStore";

/**
 * The Postgres asset store against a real database. Opt-in: set ASSET_PG_TEST_URL. Everything runs on temporary tables
 * (pg_temp first on the search path) inside one transaction that is always rolled back, so it leaves nothing behind.
 */
const url = process.env.ASSET_PG_TEST_URL;

describe.skipIf(!url)("postgres asset store", () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 1 });
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path TO pg_temp");
    // The backend's pool, pinned to this transaction's connection.
    (globalThis as { __assetPool?: unknown }).__assetPool = { url, pool: { query: client.query.bind(client), end: async () => {}, on: () => {} } };
  });

  afterAll(async () => {
    await client?.query("ROLLBACK").catch(() => {});
    client?.release();
    await pool?.end();
    delete (globalThis as { __assetPool?: unknown }).__assetPool;
  });

  const asset = (over: Partial<CuratedAsset> = {}): CuratedAsset => ({
    id: "pg-light", sourceSlug: "native:pa:1", source: "generated", type: "glb-model", name: "Lantern", categories: ["light"], tags: [], thumbnailUrl: "",
    pbr: { baseColor: "#222", roughness: 0.5, metalness: 0 }, compatibleStyles: [], status: "approved", importedAt: "2026-09-01T00:00:00.000Z",
    family: "light", planId: "plan-1", plannedAssetId: "pa", needId: "need-1", version: 1, validation: { checkedAt: "", passed: true, errors: [], warnings: [] }, ...over,
  });

  it("round-trips metadata and GLB bytes, keeps its own counters, and cascades deletes", async () => {
    const store = createPostgresAssetBackend(url!);
    const tables = await client.query<{ n: string }>("SELECT to_regclass('curated_assets')::text AS n");
    expect(tables.rows[0].n).toBe(null);

    await store.put(asset({ usageCount: 9 }));
    expect(await store.get("pg-light")).toEqual(asset({ usageCount: 9 }));
    const temp = await client.query<{ temp: boolean }>("SELECT relpersistence = 't' AS temp FROM pg_class WHERE oid = 'curated_assets'::regclass");
    expect(temp.rows[0].temp).toBe(true);

    await store.recordOutcome("pg-light", "success");
    await store.recordOutcome("pg-light", "failure");
    // A save carrying stale counters leaves the server's alone (and one without any keeps them too).
    await store.put(asset({ name: "Lantern v1", usageCount: 0, successCount: 0 }));
    expect(await store.get("pg-light")).toMatchObject({ name: "Lantern v1", usageCount: 11, successCount: 1, failureCount: 1 });

    expect(await store.insertIfAbsent(asset({ name: "stale" }))).toBe(false);
    expect(await store.insertIfAbsent(asset({ id: "pg-light-2", status: "pending" }))).toBe(true);

    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 1, 2, 3, 255]);
    await store.putGlb("pg-light", bytes);
    expect(await store.getGlb("pg-light")).toEqual(bytes);
    const row = await client.query<{ sha256: string; size_bytes: number }>("SELECT sha256, size_bytes FROM curated_asset_glbs WHERE id = 'pg-light'");
    expect(row.rows[0]).toEqual({ sha256: sha256(bytes), size_bytes: bytes.byteLength });

    const listed = await store.list();
    expect(listed.assets.map((a) => a.id).sort()).toEqual(["pg-light", "pg-light-2"]);
    expect(listed.glbIds).toEqual(["pg-light"]);

    await store.remove("pg-light");
    expect(await store.get("pg-light")).toBeNull();
    expect(await store.getGlb("pg-light")).toBeNull();
  });
});
