import type { AssetType, PBRValues } from "@/types/assets";
import type { StyleKey } from "@/types/house";

interface CategoryPBR {
  baseColor: string;
  roughness: number;
  metalness: number;
}

const CATEGORY_PBR: Record<string, CategoryPBR> = {
  concrete:    { baseColor: "#b0aca2", roughness: 0.82, metalness: 0.03 },
  stone:       { baseColor: "#969088", roughness: 0.78, metalness: 0.02 },
  brick:       { baseColor: "#b05838", roughness: 0.90, metalness: 0.00 },
  wood:        { baseColor: "#8c5a2c", roughness: 0.72, metalness: 0.00 },
  metal:       { baseColor: "#b0b4ba", roughness: 0.25, metalness: 0.90 },
  steel:       { baseColor: "#b4b8be", roughness: 0.20, metalness: 0.92 },
  iron:        { baseColor: "#6a6e72", roughness: 0.40, metalness: 0.80 },
  copper:      { baseColor: "#5a8858", roughness: 0.62, metalness: 0.85 },
  rust:        { baseColor: "#7a4828", roughness: 0.85, metalness: 0.30 },
  tile:        { baseColor: "#486c88", roughness: 0.52, metalness: 0.05 },
  ceramic:     { baseColor: "#d0ccc6", roughness: 0.45, metalness: 0.02 },
  marble:      { baseColor: "#e8e4dc", roughness: 0.15, metalness: 0.00 },
  plaster:     { baseColor: "#e0dcd4", roughness: 0.65, metalness: 0.00 },
  stucco:      { baseColor: "#ece8e0", roughness: 0.82, metalness: 0.00 },
  fabric:      { baseColor: "#c0b8ac", roughness: 0.92, metalness: 0.00 },
  leather:     { baseColor: "#7a5038", roughness: 0.85, metalness: 0.00 },
  grass:       { baseColor: "#5a8040", roughness: 0.95, metalness: 0.00 },
  soil:        { baseColor: "#6a5040", roughness: 0.92, metalness: 0.00 },
  sand:        { baseColor: "#d0c090", roughness: 0.88, metalness: 0.00 },
  asphalt:     { baseColor: "#404040", roughness: 0.92, metalness: 0.00 },
  ground:      { baseColor: "#7a6858", roughness: 0.90, metalness: 0.00 },
  rock:        { baseColor: "#787068", roughness: 0.85, metalness: 0.02 },
  gravel:      { baseColor: "#888078", roughness: 0.88, metalness: 0.00 },
  slate:       { baseColor: "#5a5c60", roughness: 0.88, metalness: 0.02 },
  terracotta:  { baseColor: "#c06840", roughness: 0.82, metalness: 0.00 },
  timber:      { baseColor: "#6a4820", roughness: 0.85, metalness: 0.00 },
};

const DEFAULT_PBR: CategoryPBR = { baseColor: "#a0a0a0", roughness: 0.75, metalness: 0.00 };

const CATEGORY_STYLES: Record<string, StyleKey[]> = {
  concrete:   ["modern-minimalist", "industrial"],
  stone:      ["mediterranean", "colonial", "craftsman"],
  brick:      ["colonial", "craftsman"],
  wood:       ["craftsman", "mid-century", "nordic"],
  timber:     ["craftsman", "nordic"],
  metal:      ["industrial", "modern-minimalist"],
  steel:      ["industrial", "modern-minimalist"],
  rust:       ["industrial"],
  copper:     ["colonial", "mid-century"],
  tile:       ["mediterranean", "tropical"],
  marble:     ["mediterranean", "colonial"],
  terracotta: ["mediterranean", "tropical"],
  stucco:     ["mediterranean", "tropical", "colonial"],
  plaster:    ["mediterranean", "colonial"],
  sand:       ["tropical"],
  tropical:   ["tropical"],
  industrial: ["industrial"],
  nordic:     ["nordic"],
  cedar:      ["craftsman", "mid-century"],
};

/** Maps file extension / MIME type to AssetType. Falls back to "pbr-material". */
export function detectAssetType(filename: string, mimeType?: string): AssetType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "glb" || ext === "gltf") return "glb-model";
  if (ext === "hdr" || ext === "exr") return "hdri";
  if (mimeType?.startsWith("model/")) return "glb-model";
  return "pbr-material";
}

/** Infers best-guess PBR values from an asset's categories and tags. */
export function inferPBR(categories: string[], tags: string[]): PBRValues {
  const all = [...categories, ...tags].map((s) => s.toLowerCase());
  for (const term of all) {
    const entry = CATEGORY_PBR[term];
    if (entry) return { ...entry };
  }
  // partial match
  for (const term of all) {
    for (const [key, entry] of Object.entries(CATEGORY_PBR)) {
      if (term.includes(key) || key.includes(term)) return { ...entry };
    }
  }
  return { ...DEFAULT_PBR };
}

/** Maps categories/tags to compatible architectural styles. */
export function inferCompatibleStyles(categories: string[], tags: string[]): StyleKey[] {
  const all = [...categories, ...tags].map((s) => s.toLowerCase());
  const styles = new Set<StyleKey>();
  for (const term of all) {
    const mapped = CATEGORY_STYLES[term];
    if (mapped) mapped.forEach((s) => styles.add(s));
    for (const [key, mapped2] of Object.entries(CATEGORY_STYLES)) {
      if (term.includes(key) || key.includes(term)) mapped2.forEach((s) => styles.add(s));
    }
  }
  if (styles.size === 0) {
    (["modern-minimalist", "craftsman"] as StyleKey[]).forEach((s) => styles.add(s));
  }
  return Array.from(styles);
}

/** Generates a stable unique ID for a new asset. */
export function makeAssetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** FNV-1a 32-bit hash for dedup detection of uploaded file content. */
export function hashContent(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h = 2166136261;
  for (const byte of bytes) {
    h ^= byte;
    h = (Math.imul(h, 16777619) >>> 0);
  }
  return h.toString(16).padStart(8, "0");
}
