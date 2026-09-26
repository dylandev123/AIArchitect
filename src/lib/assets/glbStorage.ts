/**
 * Where GLB bytes live. The asset catalog (metadata) is small enough for localStorage; the model files are not, and
 * a `blob:` URL dies on reload, so approved GLBs are kept in IndexedDB keyed by asset id. The interface is tiny so a
 * remote store (or `CuratedAsset.modelUrl`) can stand in later without touching the renderer.
 */

export interface GlbBlobStore {
  put(id: string, data: ArrayBuffer): Promise<void>;
  get(id: string): Promise<ArrayBuffer | null>;
  delete(id: string): Promise<void>;
}

export function createMemoryGlbStore(): GlbBlobStore {
  const files = new Map<string, ArrayBuffer>();
  return {
    put: async (id, data) => void files.set(id, data),
    get: async (id) => files.get(id) ?? null,
    delete: async (id) => void files.delete(id),
  };
}

const DB_NAME = "ai-architect-glb";
const STORE = "files";

const request = <T,>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });

export function createIndexedDbGlbStore(): GlbBlobStore {
  let opened: Promise<IDBDatabase> | null = null;
  const db = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => {
        opened = null;
        reject(open.error ?? new Error("Could not open the GLB store"));
      };
    }));
  const store = async (mode: IDBTransactionMode) => (await db()).transaction(STORE, mode).objectStore(STORE);
  return {
    put: async (id, data) => void (await request((await store("readwrite")).put(data, id))),
    get: async (id) => ((await request((await store("readonly")).get(id))) as ArrayBuffer | undefined) ?? null,
    delete: async (id) => void (await request((await store("readwrite")).delete(id))),
  };
}

let shared: GlbBlobStore | null = null;

/** The app-wide store: IndexedDB in a browser, in-memory anywhere it is unavailable (SSR, private modes, tests). */
export function getGlbStore(): GlbBlobStore {
  return (shared ??= typeof indexedDB !== "undefined" ? createIndexedDbGlbStore() : createMemoryGlbStore());
}

/** Test seam. */
export function setGlbStore(store: GlbBlobStore | null): void {
  shared = store;
}
