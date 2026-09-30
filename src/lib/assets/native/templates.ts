import { FAMILY_LIMITS, type NativeFamily } from "./families";
import type { AssetSpec } from "./spec";

/** Deterministic, reusable primitives for objects whose silhouette needs no semantic model judgement. */
const familyFor = (text: string): NativeFamily | undefined => {
  const s = text.toLowerCase();
  // Generic vegetation, intentionally not a named-species rule: recognisable trunk + radial fronds.
  if (/\b(tree|palm|plant|vegetation)\b/.test(s)) return "planter";
  if (/\b(planter|pot)\b/.test(s)) return "planter";
  if (/\b(umbrella|parasol)\b/.test(s)) return "umbrella";
  if (/\bbasic bench\b/.test(s)) return "bench";
  if (/\b(table|desk)\b/.test(s)) return s.includes("side") || s.includes("coffee") ? "side-table" : "dining-table";
  if (/\b(shelf|bookcase)\b/.test(s)) return "shelf";
  if (/\b(pergola)\b/.test(s)) return "pergola";
  return undefined;
};

const dimensions = (family: NativeFamily, requested?: { width?: number; depth?: number; height?: number }) => {
  const l = FAMILY_LIMITS[family];
  const fit = (v: number | undefined, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v ?? (lo + hi) / 2));
  return { width: fit(requested?.width, l.width), depth: fit(requested?.depth, l.depth), height: fit(requested?.height, l.height) };
};

export function deterministicTemplate(asset: { name: string; description: string; dimensions?: { width?: number; depth?: number; height?: number } }): AssetSpec | undefined {
  const family = familyFor(`${asset.name} ${asset.description}`);
  if (!family) return undefined;
  const d = dimensions(family, asset.dimensions);
  const wood = { key: "primary", material: "wood" as const, color: "#805331" };
  const dark = { key: "accent", material: "metal" as const, color: "#292a2d" };
  const base = { family, name: asset.name.slice(0, 80), dimensions: d, style: "clean outdoor", materials: [wood, dark], detailLevel: "low" as const, bevel: 1 };
  if (family === "planter") {
    const vegetation = /\b(tree|palm|plant|vegetation)\b/.test(`${asset.name} ${asset.description}`.toLowerCase());
    if (vegetation) return { ...base, parts: [
      { primitive: "taperedCylinder" as const, role: "tree trunk", material: "primary", radiusBottom: Math.max(.06, d.width * .07), radiusTop: Math.max(.03, d.width * .035), height: d.height, position: [0, d.height / 2, 0] },
      { primitive: "slatArray" as const, role: "radial fronds", material: "accent", count: 8, slatSize: [Math.max(.18, d.width * .42), .035, .09], gap: .01, axis: "z" as const, position: [0, d.height * .94, 0], rotation: [0, 0, 0] },
    ] };
    return { ...base, parts: [
    { primitive: "box", role: "planter body", material: "primary", size: [d.width, d.height, d.depth], position: [0, d.height / 2, 0] },
    { primitive: "box", role: "soil", material: "accent", size: [d.width * .86, Math.max(.02, d.height * .08), d.depth * .86], position: [0, d.height * .94, 0] },
    ] };
  }
  if (family === "umbrella") return { ...base, parts: [
    { primitive: "cylinder", role: "pole", material: "accent", radius: .03, height: d.height, position: [0, d.height / 2, 0] },
    { primitive: "cone", role: "canopy", material: "primary", radius: Math.min(d.width, d.depth) / 2, height: Math.max(.12, d.height * .18), position: [0, d.height - Math.max(.12, d.height * .18) / 2, 0] },
  ] };
  if (family === "shelf") return { ...base, parts: [
    { primitive: "box", role: "shelf frame", material: "primary", size: [d.width, d.height, Math.max(.03, d.depth)], position: [0, d.height / 2, 0] },
    { primitive: "slatArray", role: "shelves", material: "accent", count: 3, slatSize: [d.width, .03, d.depth], gap: Math.max(.03, d.height / 4), axis: "y", position: [0, .05, 0] },
  ] };
  const topH = Math.min(.08, d.height * .15);
  return { ...base, parts: [
    { primitive: "box", role: family === "bench" ? "seat" : "top", material: "primary", size: [d.width, topH, d.depth], position: [0, d.height - topH / 2, 0] },
    { primitive: "box", role: "leg", material: "accent", size: [Math.min(.08, d.width * .15), d.height - topH, Math.min(.08, d.depth * .15)], position: [d.width / 2 - .04, (d.height - topH) / 2, d.depth / 2 - .04], mirror: "xz" },
  ] };
}
