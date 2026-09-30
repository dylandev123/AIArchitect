import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { usageDatabaseUrl } from "@/lib/ai/usage/db";
import { databaseHost, isMissingFile, noteStorageError, requiresSharedPersistence, SharedPersistenceUnavailableError, type StorageInfo } from "@/lib/storage/diagnostics";
import type { CuratedAsset } from "@/types/assets";

/**
 * Server-only persistence for curated assets: the source of truth for the library catalog, the review queue and the GLB files.
 * Same deployment story as the reusable library (`lib/library/store`): Postgres when DATABASE_URL / POSTGRES_URL is set (the
 * full CuratedAsset as jsonb in `curated_assets`, the GLB bytes as bytea in `curated_asset_glbs`), otherwise JSON + .glb files
 * under `.data/assets` for local dev. The browser keeps localStorage / IndexedDB copies only as a cache.
 *
 * Usage counters (usage/success/failure) are owned here: a metadata write never overwrites them, only `recordOutcome` moves
 * them, so a stale browser cache cannot roll them back and an admin's write cannot double-count one.
 */

export const COUNTER_FIELDS = ["usageCount", "successCount", "failureCount"] as const;

/** Stays under the 4.5 MB request-body limit of a serverless function. */
export const MAX_GLB_BYTES = 4 * 1024 * 1024;

export interface StoredAssets {
  assets: CuratedAsset[];
  /** Ids with a GLB file stored on the server. */
  glbIds: string[];
}

export interface AssetBackend {
  list(): Promise<StoredAssets>;
  get(id: string): Promise<CuratedAsset | null>;
  /** Inserts or replaces the asset, keeping the stored counters when it already exists. */
  put(asset: CuratedAsset): Promise<void>;
  /** Inserts only when the id is new (import: the server copy always wins). Resolves to whether it was inserted. */
  insertIfAbsent(asset: CuratedAsset): Promise<boolean>;
  /** Removes the asset and its GLB. */
  remove(id: string): Promise<void>;
  putGlb(id: string, bytes: Uint8Array): Promise<void>;
  getGlb(id: string): Promise<Uint8Array | null>;
  recordOutcome(id: string, outcome: "success" | "failure"): Promise<void>;
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function withStoredCounters(asset: CuratedAsset, stored: CuratedAsset | null | undefined): CuratedAsset {
  const next = { ...asset };
  for (const f of COUNTER_FIELDS) {
    if (stored?.[f] !== undefined) next[f] = stored[f];
    else if (stored) delete next[f];
  }
  return next;
}

const bump = (a: CuratedAsset, outcome: "success" | "failure"): CuratedAsset => ({
  ...a,
  usageCount: (a.usageCount ?? 0) + 1,
  ...(outcome === "success" ? { successCount: (a.successCount ?? 0) + 1 } : { failureCount: (a.failureCount ?? 0) + 1 }),
});

// ── File backend (local dev, tests) ─────────────────────────────────────────

export function createFileAssetBackend(dir: string): AssetBackend {
  // Runtime data, not code: keep the bundler from tracing these paths into the function bundle.
  const root = path.resolve(/*turbopackIgnore: true*/ dir);
  const catalogFile = path.join(/*turbopackIgnore: true*/ root, "assets.json");
  const glbFile = (id: string) => path.join(/*turbopackIgnore: true*/ root, "glb", `${encodeURIComponent(id)}.glb`);
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<Record<string, CuratedAsset>> {
    try {
      return JSON.parse(await readFile(catalogFile, "utf8")) as Record<string, CuratedAsset>;
    } catch (err) {
      if (isMissingFile(err)) return {};
      throw err;
    }
  }
  async function save(assets: Record<string, CuratedAsset>) {
    await mkdir(root, { recursive: true });
    const tmp = `${catalogFile}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(assets), "utf8");
    await rename(tmp, catalogFile);
  }
  /** Serialises read-modify-write so concurrent requests cannot clobber each other. */
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  }
  const hasGlb = async (id: string) => (await readFile(glbFile(id)).then(() => true, () => false));

  return {
    list: () =>
      exclusive(async () => {
        const assets = Object.values(await load());
        const glbIds = (await Promise.all(assets.map(async (a) => ((await hasGlb(a.id)) ? a.id : null)))).filter((id): id is string => id !== null);
        return { assets, glbIds };
      }),
    get: (id) => exclusive(async () => (await load())[id] ?? null),
    put: (asset) =>
      exclusive(async () => {
        const all = await load();
        all[asset.id] = withStoredCounters(asset, all[asset.id]);
        await save(all);
      }),
    insertIfAbsent: (asset) =>
      exclusive(async () => {
        const all = await load();
        if (all[asset.id]) return false;
        all[asset.id] = asset;
        await save(all);
        return true;
      }),
    remove: (id) =>
      exclusive(async () => {
        const all = await load();
        delete all[id];
        await save(all);
        await rm(glbFile(id), { force: true });
      }),
    putGlb: async (id, bytes) => {
      await mkdir(path.dirname(glbFile(id)), { recursive: true });
      await writeFile(glbFile(id), bytes);
    },
    getGlb: async (id) => {
      try {
        return new Uint8Array(await readFile(glbFile(id)));
      } catch (err) {
        if (isMissingFile(err)) return null;
        throw err;
      }
    },
    recordOutcome: (id, outcome) =>
      exclusive(async () => {
        const all = await load();
        if (!all[id]) return;
        all[id] = bump(all[id], outcome);
        await save(all);
      }),
  };
}

// ── Postgres backend (Neon) ─────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS curated_assets (
  id         text PRIMARY KEY,
  status     text NOT NULL,
  data       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS curated_assets_status_idx ON curated_assets (status);
CREATE TABLE IF NOT EXISTS curated_asset_glbs (
  id         text PRIMARY KEY REFERENCES curated_assets (id) ON DELETE CASCADE,
  bytes      bytea NOT NULL,
  size_bytes integer NOT NULL,
  sha256     text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

const globalForPool = globalThis as unknown as { __assetPool?: { url: string; pool: Pool; ready?: Promise<void> } };

async function pgReady(url: string): Promise<Pool> {
  let entry = globalForPool.__assetPool;
  if (!entry || entry.url !== url) {
    void entry?.pool.end().catch(() => {});
    // GLB transfers are larger than the library's JSON reads, so the query timeout is longer.
    const pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, query_timeout: 20_000 });
    pool.on("error", () => {});
    entry = globalForPool.__assetPool = { url, pool };
  }
  const current = entry;
  current.ready ??= current.pool.query(SCHEMA).then(
    () => undefined,
    (err) => {
      current.ready = undefined;
      throw err;
    }
  );
  await current.ready;
  return current.pool;
}

export function createPostgresAssetBackend(url: string): AssetBackend {
  // The counters are merged in SQL so a concurrent `recordOutcome` between read and write is never lost.
  const preserveCounters = `(EXCLUDED.data - '{usageCount,successCount,failureCount}'::text[]) || jsonb_strip_nulls(jsonb_build_object(
      'usageCount', curated_assets.data->'usageCount', 'successCount', curated_assets.data->'successCount', 'failureCount', curated_assets.data->'failureCount'))`;
  return {
    async list() {
      const db = await pgReady(url);
      const [assets, glbs] = await Promise.all([
        db.query<{ data: CuratedAsset }>("SELECT data FROM curated_assets ORDER BY created_at ASC, id ASC"),
        db.query<{ id: string }>("SELECT id FROM curated_asset_glbs"),
      ]);
      return { assets: assets.rows.map((r) => r.data), glbIds: glbs.rows.map((r) => r.id) };
    },
    async get(id) {
      const db = await pgReady(url);
      const { rows } = await db.query<{ data: CuratedAsset }>("SELECT data FROM curated_assets WHERE id = $1", [id]);
      return rows[0]?.data ?? null;
    },
    async put(asset) {
      const db = await pgReady(url);
      await db.query(
        `INSERT INTO curated_assets (id, status, data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data = ${preserveCounters}, updated_at = now()`,
        [asset.id, asset.status, JSON.stringify(asset)]
      );
    },
    async insertIfAbsent(asset) {
      const db = await pgReady(url);
      const { rowCount } = await db.query("INSERT INTO curated_assets (id, status, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [asset.id, asset.status, JSON.stringify(asset)]);
      return (rowCount ?? 0) > 0;
    },
    async remove(id) {
      const db = await pgReady(url);
      await db.query("DELETE FROM curated_assets WHERE id = $1", [id]);
    },
    async putGlb(id, bytes) {
      const db = await pgReady(url);
      await db.query(
        `INSERT INTO curated_asset_glbs (id, bytes, size_bytes, sha256) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET bytes = EXCLUDED.bytes, size_bytes = EXCLUDED.size_bytes, sha256 = EXCLUDED.sha256, updated_at = now()`,
        [id, Buffer.from(bytes), bytes.byteLength, sha256(bytes)]
      );
    },
    async getGlb(id) {
      const db = await pgReady(url);
      const { rows } = await db.query<{ bytes: Buffer }>("SELECT bytes FROM curated_asset_glbs WHERE id = $1", [id]);
      return rows[0] ? new Uint8Array(rows[0].bytes) : null;
    },
    async recordOutcome(id, outcome) {
      const db = await pgReady(url);
      const field = outcome === "success" ? "successCount" : "failureCount";
      await db.query(
        `UPDATE curated_assets SET data = data
           || jsonb_build_object('usageCount', COALESCE((data->>'usageCount')::int, 0) + 1)
           || jsonb_build_object($2::text, COALESCE((data->>$2)::int, 0) + 1)
         WHERE id = $1`,
        [id, field]
      );
    },
  };
}

// ── Selection ───────────────────────────────────────────────────────────────

export function assetStoreDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.AI_ASSET_STORE_PATH ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "assets"));
}

export function assetStorageInfo(): StorageInfo {
  const url = usageDatabaseUrl();
  if (url) return { kind: "postgres", location: databaseHost(url), ephemeral: false };
  if (requiresSharedPersistence()) return { kind: "unavailable", location: "not configured", ephemeral: false };
  return { kind: "local-json", location: assetStoreDir(), ephemeral: false };
}

function tracked(backend: AssetBackend): AssetBackend {
  const wrap = <A extends unknown[], R>(op: "read" | "write", fn: (...args: A) => Promise<R>) => (...args: A) =>
    fn(...args).catch((err) => {
      noteStorageError("assets", op, err);
      throw err;
    });
  return {
    list: wrap("read", backend.list),
    get: wrap("read", backend.get),
    put: wrap("write", backend.put),
    insertIfAbsent: wrap("write", backend.insertIfAbsent),
    remove: wrap("write", backend.remove),
    putGlb: wrap("write", backend.putGlb),
    getGlb: wrap("read", backend.getGlb),
    recordOutcome: wrap("write", backend.recordOutcome),
  };
}

let fileBackend: { dir: string; backend: AssetBackend } | undefined;

export function assetBackend(): AssetBackend {
  const url = usageDatabaseUrl();
  if (url) return tracked(createPostgresAssetBackend(url));
  if (requiresSharedPersistence()) {
    const unavailable = () => Promise.reject(new SharedPersistenceUnavailableError());
    return { list: unavailable, get: unavailable, put: unavailable, insertIfAbsent: unavailable, remove: unavailable, putGlb: unavailable, getGlb: unavailable, recordOutcome: unavailable };
  }
  const dir = assetStoreDir();
  if (fileBackend?.dir !== dir) fileBackend = { dir, backend: tracked(createFileAssetBackend(dir)) };
  return fileBackend.backend;
}
