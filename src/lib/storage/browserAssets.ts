/**
 * The browser's cache of the curated-asset library (localStorage `ai-architect-assets`) and its GLB files (IndexedDB
 * `ai-architect-glb`). The server library is the source of truth (`lib/assets/assetSync`); these helpers only read and describe
 * the cache; they never write it.
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
export function originNotice(origin: string, localOnlyAssets: number): { text: string; severe: boolean } {
  const base = `Curated assets and GLB files are stored in the server library; this browser (${origin}) keeps only a cache.`;
  if (localOnlyAssets > 0) {
    return { severe: true, text: `${base} ${localOnlyAssets} asset(s) exist only in this browser. Import them to the server so other browsers and sessions can use them; other origins (another port, localhost vs 127.0.0.1) may hold more.` };
  }
  return { severe: false, text: base };
}
