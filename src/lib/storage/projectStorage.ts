import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import type { StateStorage } from 'zustand/middleware';

const PREFIX = 'ai-architect:gzip:v1:';

export function isStorageQuotaError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

function encode(value: string): string {
  const bytes = gzipSync(strToU8(value));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return PREFIX + btoa(binary);
}

/** Legacy JSON and compressed projects have the same exact decoded content. */
export function readProjectStorage(name: string): string | null {
  const raw = window.localStorage.getItem(name);
  if (!raw?.startsWith(PREFIX)) return raw;
  const bytes = Uint8Array.from(atob(raw.slice(PREFIX.length)), c => c.charCodeAt(0));
  return strFromU8(gunzipSync(bytes));
}

/**
 * Keep synchronous Zustand saves and legacy JSON until the browser quota is hit.
 * A single atomic replacement then stores the full history losslessly compressed;
 * no projects, versions, or other browser data are evicted to make room.
 */
export const projectStorage: StateStorage = {
  getItem: readProjectStorage,
  setItem(name, value) {
    const storage = window.localStorage;
    if (!storage.getItem(name)?.startsWith(PREFIX)) {
      try { storage.setItem(name, value); return; }
      catch (error) { if (!isStorageQuotaError(error)) throw error; }
    }
    storage.setItem(name, encode(value));
  },
  removeItem: name => window.localStorage.removeItem(name),
};
