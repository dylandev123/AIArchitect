import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { usageDatabaseUrl } from "@/lib/ai/usage/db";
import { databaseHost, isMissingFile, noteStorageError, type StorageInfo } from "@/lib/storage/diagnostics";
import type { AssetPlan, DesignRecipe, GenerationReport, KnowledgeNeed, Need } from "@/types/library";

/**
 * Server-only persistence for the reusable library (Needs, Knowledge Needs and Recipes). Same deployment story as AI usage:
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
  /** Knowledge Needs. Absent in files written before they existed, and read back as empty. */
  knowledge: KnowledgeNeed[];
  /** Asset Plans (AI-designed asset packs). Absent in files written before they existed, and read back as empty. */
  plans: AssetPlan[];
  /** One report per successful generation (newest kept, see `MAX_REPORTS`). Absent in files written before they existed. */
  generations: GenerationReport[];
}

export type LibraryDoc =
  | { kind: "need"; data: Need }
  | { kind: "recipe"; data: DesignRecipe }
  | { kind: "knowledge"; data: KnowledgeNeed }
  | { kind: "plan"; data: AssetPlan }
  | { kind: "generation"; data: GenerationReport };

/** Generation reports are evidence, not history: only this many of the newest are kept. */
export const MAX_REPORTS = 40;

export const emptySnapshot = (): LibrarySnapshot => ({ needs: [], recipes: [], knowledge: [], plans: [], generations: [] });

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
  const knowledge = new Map(snapshot.knowledge.map((k) => [k.id, k]));
  const plans = new Map(snapshot.plans.map((p) => [p.id, p]));
  const generations = new Map(snapshot.generations.map((g) => [g.id, g]));
  const tables = { need: needs, recipe: recipes, knowledge, plan: plans, generation: generations } as const;
  for (const doc of change.put ?? []) (tables[doc.kind] as Map<string, unknown>).set(doc.data.id, doc.data);
  for (const rm of change.remove ?? []) tables[rm.kind].delete(rm.id);
  return { needs: [...needs.values()], recipes: [...recipes.values()], knowledge: [...knowledge.values()], plans: [...plans.values()], generations: [...generations.values()] };
}

// ── File backend (local dev, tests) ─────────────────────────────────────────

export function createFileBackend(file: string): LibraryBackend {
  // This state deliberately lives on globalThis instead of this module. Next dev can
  // briefly retain more than one module graph during hot replacement; module-local
  // queues then permit two read-modify-write operations for the same JSON file to
  // race. All graphs in a Node process instead coordinate by canonical file path.
  const canonicalFile = path.resolve(file);
  const coordinator = fileCoordinator(canonicalFile);

  /**
   * A file that does not exist yet is an empty library. Anything else (unreadable, corrupt) throws: `mutate` writes back what it
   * loaded, so treating a failed read as empty would overwrite the real file with a fresh one.
   */
  async function load(): Promise<LibrarySnapshot> {
    let text: string;
    try {
      console.debug(`[library-store] read ${canonicalFile}`);
      text = await readFile(canonicalFile, "utf8");
    } catch (err) {
      if (isMissingFile(err)) return emptySnapshot();
      throw err;
    }
    const parsed = JSON.parse(text) as Partial<LibrarySnapshot>;
    return { needs: parsed.needs ?? [], recipes: parsed.recipes ?? [], knowledge: parsed.knowledge ?? [], plans: parsed.plans ?? [], generations: parsed.generations ?? [] };
  }

  return {
    read: () => coordinator.queue.then(load, load),
    mutate<T>(fn: (s: LibrarySnapshot) => LibraryChange<T>): Promise<T> {
      const run = async () => {
        const snapshot = await load();
        const change = fn(snapshot);
        await mkdir(path.dirname(canonicalFile), { recursive: true });
        // A unique sibling keeps the replace atomic even if a second Node process is
        // present. The shared coordinator serializes writers inside this process.
        const tmp = `${canonicalFile}.${process.pid}.${randomUUID()}.tmp`;
        await writeFile(tmp, JSON.stringify(applyChange(snapshot, change)), "utf8");
        await rename(tmp, canonicalFile);
        console.debug(`[library-store] write ${canonicalFile}`);
        return change.result;
      };
      const next = coordinator.queue.then(run, run);
      coordinator.queue = next.catch(() => undefined);
      return next;
    },
  };
}

interface FileCoordinator {
  queue: Promise<unknown>;
}

const globalForFileCoordinators = globalThis as unknown as { __libraryFileCoordinators?: Map<string, FileCoordinator> };

function fileCoordinator(file: string): FileCoordinator {
  const coordinators = (globalForFileCoordinators.__libraryFileCoordinators ??= new Map());
  let coordinator = coordinators.get(file);
  if (!coordinator) {
    coordinator = { queue: Promise.resolve() };
    coordinators.set(file, coordinator);
  }
  return coordinator;
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
  data: Need | DesignRecipe | KnowledgeNeed | AssetPlan | GenerationReport;
}

const toSnapshot = (rows: DocRow[]): LibrarySnapshot => ({
  needs: rows.filter((r) => r.kind === "need").map((r) => r.data as Need),
  recipes: rows.filter((r) => r.kind === "recipe").map((r) => r.data as DesignRecipe),
  knowledge: rows.filter((r) => r.kind === "knowledge").map((r) => r.data as KnowledgeNeed),
  plans: rows.filter((r) => r.kind === "plan").map((r) => r.data as AssetPlan),
  generations: rows.filter((r) => r.kind === "generation").map((r) => r.data as GenerationReport),
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
  if (process.env.AI_LIBRARY_PATH) return path.resolve(process.env.AI_LIBRARY_PATH);
  return path.resolve(process.env.VERCEL ? path.join(tmpdir(), "ai-library.json") : path.join(process.cwd(), ".data", "ai-library.json"));
}

let fileBackend: { file: string; backend: LibraryBackend } | undefined;

/** Which backend is live right now. Selection is deterministic: a database URL wins, otherwise the local file. */
export function libraryStorageInfo(): StorageInfo {
  const url = usageDatabaseUrl();
  if (url) return { kind: "postgres", location: databaseHost(url), ephemeral: false };
  return { kind: "local-json", location: libraryFilePath(), ephemeral: !!process.env.VERCEL && !process.env.AI_LIBRARY_PATH };
}

/** Records a failed read or write (log + admin diagnostics) and rethrows it: callers decide what to do, none get a silent empty store. */
function withErrorTracking(backend: LibraryBackend): LibraryBackend {
  return {
    read: () => backend.read().catch((err) => Promise.reject(noteAndReturn("read", err))),
    mutate: (fn) => backend.mutate(fn).catch((err) => Promise.reject(noteAndReturn("write", err))),
  };
}

function noteAndReturn(op: "read" | "write", err: unknown): unknown {
  noteStorageError("library", op, err);
  return err;
}

export function libraryBackend(): LibraryBackend {
  const url = usageDatabaseUrl();
  if (url) return withErrorTracking(createPostgresBackend(url));
  const file = libraryFilePath();
  if (fileBackend?.file !== file) fileBackend = { file, backend: withErrorTracking(createFileBackend(file)) };
  return fileBackend.backend;
}

export const readLibrary = (): Promise<LibrarySnapshot> => libraryBackend().read();
export const mutateLibrary = <T>(fn: (s: LibrarySnapshot) => LibraryChange<T>): Promise<T> => libraryBackend().mutate(fn);
