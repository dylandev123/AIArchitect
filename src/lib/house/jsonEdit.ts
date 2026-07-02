import type { MaterialZone } from "@/types/house";
import { FEATURE_JSON_KEY, type FeatureType } from "./features/featureTypes";

function tryParseRoot(jsonText: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Replaces one entry of a feature array with a fully new value. No-ops on unparseable JSON. */
export function setFeatureAt(jsonText: string, type: FeatureType, index: number, value: unknown): string {
  const root = tryParseRoot(jsonText);
  if (!root) return jsonText;
  const key = FEATURE_JSON_KEY[type];
  const arr = Array.isArray(root[key]) ? [...(root[key] as unknown[])] : [];
  if (index < 0 || index >= arr.length) return jsonText;
  arr[index] = value;
  root[key] = arr;
  return JSON.stringify(root, null, 2);
}

/** Removes one entry from a feature array. No-ops on unparseable JSON. */
export function removeFeatureAt(jsonText: string, type: FeatureType, index: number): string {
  const root = tryParseRoot(jsonText);
  if (!root) return jsonText;
  const key = FEATURE_JSON_KEY[type];
  const arr = Array.isArray(root[key]) ? [...(root[key] as unknown[])] : [];
  if (index < 0 || index >= arr.length) return jsonText;
  arr.splice(index, 1);
  root[key] = arr;
  return JSON.stringify(root, null, 2);
}

/** Reads one feature array entry as-is (unvalidated). Returns undefined if out of range or unparseable. */
export function getFeatureRawAt(jsonText: string, type: FeatureType, index: number): unknown {
  const root = tryParseRoot(jsonText);
  if (!root) return undefined;
  const arr = root[FEATURE_JSON_KEY[type]];
  if (!Array.isArray(arr)) return undefined;
  return arr[index];
}

/** Appends a new entry to a feature array. No-ops on unparseable JSON. */
export function addFeature(jsonText: string, type: FeatureType, value: unknown): string {
  const root = tryParseRoot(jsonText);
  if (!root) return jsonText;
  const key = FEATURE_JSON_KEY[type];
  const arr = Array.isArray(root[key]) ? [...(root[key] as unknown[])] : [];
  arr.push(value);
  root[key] = arr;
  return JSON.stringify(root, null, 2);
}

/** Merges fields into one material zone (e.g. {color: "#ffffff"}), leaving other zones untouched. No-ops on unparseable JSON. */
export function setMaterialZone(jsonText: string, zone: MaterialZone, fields: Record<string, unknown>): string {
  const root = tryParseRoot(jsonText);
  if (!root) return jsonText;
  const materials = typeof root.materials === "object" && root.materials !== null ? (root.materials as Record<string, unknown>) : {};
  const existingZone = typeof materials[zone] === "object" && materials[zone] !== null ? (materials[zone] as Record<string, unknown>) : {};
  root.materials = { ...materials, [zone]: { ...existingZone, ...fields } };
  return JSON.stringify(root, null, 2);
}

/** Current length of a feature array (0 if missing or JSON unparseable). */
export function getFeatureCount(jsonText: string, type: FeatureType): number {
  const root = tryParseRoot(jsonText);
  if (!root) return 0;
  const arr = root[FEATURE_JSON_KEY[type]];
  return Array.isArray(arr) ? arr.length : 0;
}
