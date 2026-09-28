/**
 * The curated-asset catalog (localStorage `ai-architect-assets`) and the GLB files (IndexedDB `ai-architect-glb`) live in the
 * browser, so they belong to one origin: http://localhost:3000 and http://localhost:3001 (or 127.0.0.1) are separate, empty-looking
 * worlds. These helpers only read and describe that state; they never write it.
 */

export const ASSET_STORAGE_KEY = "ai-architect-assets";

export interface PersistedAssetCounts {
  /** The key exists in this origin's localStorage. */
  present: boolean;
  /** The stored value could not be parsed (zustand then silently starts from an empty catalog). */
  corrupt: boolean;
  catalog: number;
  queue: number;
}

/** Counts what is stored under the persist key, from the raw localStorage string. */
export function readPersistedAssetCounts(raw: string | null): PersistedAssetCounts {
  if (raw === null) return { present: false, corrupt: false, catalog: 0, queue: 0 };
  try {
    const state = (JSON.parse(raw) as { state?: { catalog?: unknown[]; queue?: unknown[] } }).state;
    return { present: true, corrupt: false, catalog: state?.catalog?.length ?? 0, queue: state?.queue?.length ?? 0 };
  } catch {
    return { present: true, corrupt: true, catalog: 0, queue: 0 };
  }
}

/** Shown whenever the admin is open: where the browser-side data lives, and what to do if it looks missing. */
export function originNotice(origin: string, browserAssets: number, serverHasLibrary: boolean): { text: string; severe: boolean } {
  const base = `Curated assets and GLB files are saved in this browser under ${origin} only. Another port, host (localhost vs 127.0.0.1) or browser has its own separate copy.`;
  if (browserAssets === 0 && serverHasLibrary) {
    return { severe: true, text: `${base} This origin holds no assets while the server library has data — if you curated assets before, open the app on the origin you used then.` };
  }
  return { severe: false, text: base };
}
