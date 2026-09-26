/**
 * A keyed, load-once cache with observable status. The renderer asks it for models; it makes sure each key is
 * fetched and parsed at most once no matter how many features (or re-renders) want it, remembers failures so a
 * broken asset is not retried every frame, and lets React subscribe to status changes.
 *
 * Generic on purpose: the three.js specifics live in `glbModels.ts`, so this can be unit-tested without WebGL.
 */

export type ModelStatus = "idle" | "loading" | "ready" | "failed";

interface Entry<T> {
  status: ModelStatus;
  promise?: Promise<T | null>;
  value?: T;
  error?: string;
}

export interface ModelCache<T> {
  status(key: string): ModelStatus;
  /** The loaded value, or undefined until it is ready. */
  peek(key: string): T | undefined;
  error(key: string): string | undefined;
  /** Starts (or joins) the load. Resolves to null on failure — it never rejects. */
  load(key: string): Promise<T | null>;
  /** Forgets a key (asset replaced, removed, or its file changed) so the next `load` fetches again. */
  invalidate(key: string): void;
  subscribe(listener: () => void): () => void;
  /** Bumps on every status change: a cheap snapshot for `useSyncExternalStore`. */
  version(): number;
  stats(): { loads: number; hits: number; failures: number };
}

export interface ModelCacheHooks<T> {
  onLoaded?: (key: string, value: T) => void;
  onFailed?: (key: string, error: string) => void;
}

export function createModelCache<T>(loader: (key: string) => Promise<T>, hooks: ModelCacheHooks<T> = {}): ModelCache<T> {
  const entries = new Map<string, Entry<T>>();
  const listeners = new Set<() => void>();
  let version = 0;
  const counters = { loads: 0, hits: 0, failures: 0 };
  const changed = () => {
    version++;
    listeners.forEach((l) => l());
  };

  return {
    status: (key) => entries.get(key)?.status ?? "idle",
    peek: (key) => entries.get(key)?.value,
    error: (key) => entries.get(key)?.error,
    load(key) {
      const existing = entries.get(key);
      if (existing?.promise) {
        counters.hits++;
        return existing.promise;
      }
      counters.loads++;
      const entry: Entry<T> = { status: "loading" };
      entries.set(key, entry);
      entry.promise = (async () => {
        try {
          const value = await loader(key);
          // Invalidated while loading: this result belongs to a stale entry.
          if (entries.get(key) !== entry) return value;
          entry.value = value;
          entry.status = "ready";
          changed();
          hooks.onLoaded?.(key, value);
          return value;
        } catch (err) {
          if (entries.get(key) !== entry) return null;
          entry.status = "failed";
          entry.error = err instanceof Error ? err.message : String(err);
          counters.failures++;
          changed();
          hooks.onFailed?.(key, entry.error);
          return null;
        }
      })();
      changed();
      return entry.promise;
    },
    invalidate(key) {
      if (entries.delete(key)) changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    version: () => version,
    stats: () => ({ ...counters }),
  };
}
