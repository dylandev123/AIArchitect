import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { usageDatabaseUrl } from "@/lib/ai/usage/db";
import type { DesignRecipe, Need } from "@/types/library";

/**
 * Server-only persistence for the reusable library (Needs and Recipes). Same deployment story as AI usage:
 * Postgres (`library_docs`) when DATABASE_URL / POSTGRES_URL is set, otherwise a JSON file for local dev — which
 * on serverless hosts is ephemeral, so production needs the database. Set AI_LIBRARY_PATH to relocate the file.
 *
 * Every write goes through `mutateLibrary`, which serialises read-modify-write so two generations recording the
 * same Need at once increment it twice instead of clobbering each other.
 *
 * Curated assets are not stored here yet: they still live in the admin's browser (`useAssetStore`). The document
 * shape is generic (`kind` + `data`) so assets can move into the same table without another registry.
 */

export interface LibrarySnapshot {
  needs: Need[];
  recipes: DesignRecipe[];
}

export type LibraryDoc = { kind: "need"; data: Need } | { kind: "recipe"; data: DesignRecipe };

export interface LibraryChange<T> {
  put?: LibraryDoc[];
  remove?: { kind: LibraryDoc["kind"]; id: string }[];
  result: T;
}

export interface LibraryBackend {
  /** Runs `fn` against the current snapshot exclusively, then persists what it returns. */
  mutate<T>(fn: (snapshot: LibrarySnapshot) => LibraryChange<T>): Promise<T>;
  read(): Promise<LibrarySnapshot>;
}

function applyChange(snapshot: LibrarySnapshot, change: LibraryChange<unknown>): LibrarySnapshot {
  const needs = new Map(snapshot.needs.map((n) => [n.id, n]));
  const recipes = new Map(snapshot.recipes.map((r) => [r.id, r]));
  for (const doc of change.put ?? []) {
    if (doc.kind === "need") needs.set(doc.data.id, doc.data);
    else recipes.set(doc.data.id, doc.data);
  }
  for (const rm of change.remove ?? []) (rm.kind === "need" ? needs : recipes).delete(rm.id);
  return { needs: [...needs.values()], recipes: [...recipes.values()] };
}

// ── File backend (local dev, tests) ─────────────────────────────────────────

export function createFileBackend(file: string): LibraryBackend {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<LibrarySnapshot> {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<LibrarySnapshot>;
      return { needs: parsed.needs ?? [], recipes: parsed.recipes ?? [] };
    } catch {
      return { needs: [], recipes: [] };
    }
  }

  return {
    read: () => queue.then(load, load),
    mutate<T>(fn: (s: LibrarySnapshot) => LibraryChange<T>): Promise<T> {
      const run = async () => {
        const snapshot = await load();
        const change = fn(snapshot);
        await mkdir(path.dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(applyChange(snapshot, change)), "utf8");
        await rename(tmp, file);
        return change.result;
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

// ── Postgres backend ────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS library_docs (
  kind       text NOT NULL,
  id         text NOT NULL,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
`;

const globalForPool = globalThis as unknown as { __libraryPool?: { url: string; pool: Pool; ready?: Promise<void> } };

function pgPool(url: string) {
  const cached = globalForPool.__libraryPool;
  if (cached && cached.url === url) return cached;
  void cached?.pool.end().catch(() => {});
  const pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, query_timeout: 5_000 });
  pool.on("error", () => {});
  return (globalForPool.__libraryPool = { url, pool });
}

async function pgReady(url: string): Promise<Pool> {
  const entry = pgPool(url);
  entry.ready ??= entry.pool.query(SCHEMA).then(
    () => undefined,
    (err) => {
      entry.ready = undefined;
      throw err;
    }
  );
  await entry.ready;
  return entry.pool;
}

interface DocRow {
  kind: string;
  data: Need | DesignRecipe;
}

const toSnapshot = (rows: DocRow[]): LibrarySnapshot => ({
  needs: rows.filter((r) => r.kind === "need").map((r) => r.data as Need),
  recipes: rows.filter((r) => r.kind === "recipe").map((r) => r.data as DesignRecipe),
});

export function createPostgresBackend(url: string): LibraryBackend {
  return {
    async read() {
      const db = await pgReady(url);
      const { rows } = await db.query<DocRow>("SELECT kind, data FROM library_docs");
      return toSnapshot(rows);
    },
    async mutate<T>(fn: (s: LibrarySnapshot) => LibraryChange<T>): Promise<T> {
      const db = await pgReady(url);
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        // One writer at a time across instances; released automatically at COMMIT/ROLLBACK.
        await client.query("SELECT pg_advisory_xact_lock(hashtext('library_docs'))");
        const { rows } = await client.query<DocRow>("SELECT kind, data FROM library_docs");
        const change = fn(toSnapshot(rows));
        for (const doc of change.put ?? []) {
          await client.query(
            `INSERT INTO library_docs (kind, id, data, updated_at) VALUES ($1, $2, $3, now())
             ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            [doc.kind, doc.data.id, JSON.stringify(doc.data)]
          );
        }
        for (const rm of change.remove ?? []) await client.query("DELETE FROM library_docs WHERE kind = $1 AND id = $2", [rm.kind, rm.id]);
        await client.query("COMMIT");
        return change.result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

// ── Selection ───────────────────────────────────────────────────────────────

export function libraryFilePath(): string {
  if (process.env.AI_LIBRARY_PATH) return process.env.AI_LIBRARY_PATH;
  return process.env.VERCEL ? path.join(tmpdir(), "ai-library.json") : path.join(process.cwd(), ".data", "ai-library.json");
}

let fileBackend: { file: string; backend: LibraryBackend } | undefined;

export function libraryBackend(): LibraryBackend {
  const url = usageDatabaseUrl();
  if (url) return createPostgresBackend(url);
  const file = libraryFilePath();
  if (fileBackend?.file !== file) fileBackend = { file, backend: createFileBackend(file) };
  return fileBackend.backend;
}

export const readLibrary = (): Promise<LibrarySnapshot> => libraryBackend().read();
export const mutateLibrary = <T>(fn: (s: LibrarySnapshot) => LibraryChange<T>): Promise<T> => libraryBackend().mutate(fn);
