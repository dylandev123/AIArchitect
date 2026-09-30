/**
 * Shared helpers for the server-side persistence layers (AI usage, library). They exist so a storage problem is never mistaken for
 * "no data": a missing file is the only thing that reads as empty, and every other failure is recorded here (and logged) for the
 * admin diagnostics to show.
 */

export type StorageKind = "postgres" | "local-json" | "unavailable";

export interface StorageInfo {
  kind: StorageKind;
  /** The database host (never the credentials) or the file path. */
  location: string;
  /** Local files on a serverless host live in a temp dir that does not survive the instance. */
  ephemeral: boolean;
}

/** Serverless/production filesystems are not a shared durable persistence layer. */
export function requiresSharedPersistence(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export const SHARED_PERSISTENCE_MESSAGE = "Production shared persistence is not configured.";

/** Deliberately distinct so routes can give an actionable diagnostic instead of implying a save succeeded. */
export class SharedPersistenceUnavailableError extends Error {
  constructor() {
    super(SHARED_PERSISTENCE_MESSAGE);
    this.name = "SharedPersistenceUnavailableError";
  }
}

export interface StorageErrorEntry {
  domain: "usage" | "library" | "assets";
  op: "read" | "write";
  at: string;
  message: string;
}

const MAX_ERRORS = 20;

const globalForErrors = globalThis as unknown as { __storageErrors?: StorageErrorEntry[] };
const errors = () => (globalForErrors.__storageErrors ??= []);

/** True only for "the file does not exist yet", the one read failure that legitimately means an empty store. */
export function isMissingFile(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/** Host of a connection string, without credentials, for display. */
export function databaseHost(url: string): string {
  try {
    return new URL(url).host || "database";
  } catch {
    return "database";
  }
}

/** Logs a storage failure and keeps the latest few for the admin diagnostics. Never throws. */
export function noteStorageError(domain: StorageErrorEntry["domain"], op: StorageErrorEntry["op"], err: unknown): void {
  const e = err as { name?: string; code?: string; message?: string } | undefined;
  const message = `${e?.name ?? "Error"}${e?.code ? ` ${e.code}` : ""}: ${e?.message ?? "unknown error"}`.slice(0, 300);
  console.error(`[storage] ${domain} ${op} failed:`, message);
  const list = errors();
  list.push({ domain, op, at: new Date().toISOString(), message });
  if (list.length > MAX_ERRORS) list.splice(0, list.length - MAX_ERRORS);
}

export const recentStorageErrors = (): StorageErrorEntry[] => [...errors()].reverse();
