import { FEATURE_JSON_KEY, type FeatureType } from "./features/featureTypes";

function genId(): string {
  try { return globalThis.crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

/**
 * Returns a copy of `root` in which every item of the given feature arrays has a
 * stable `id` (legacy items predate ids). Existing ids are never changed, arrays
 * outside `types` are returned by reference untouched, and item key order is
 * preserved apart from `id` being placed first on backfilled items.
 */
export function ensureStableIds(
  root: Record<string, unknown>,
  types: readonly FeatureType[]
): Record<string, unknown> {
  const next = { ...root };
  for (const type of types) {
    const key = FEATURE_JSON_KEY[type];
    const arr = root[key];
    if (!Array.isArray(arr) || arr.every((item) => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string")) continue;
    next[key] = arr.map((item) =>
      typeof item === "object" && item !== null && !Array.isArray(item) && typeof (item as { id?: unknown }).id !== "string"
        ? { id: genId(), ...(item as Record<string, unknown>) }
        : item
    );
  }
  return next;
}
