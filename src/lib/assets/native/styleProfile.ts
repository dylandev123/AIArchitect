import { Color } from "three";
import { MATERIAL_PROPERTIES } from "@/lib/house/materials";
import type { MaterialType } from "@/types/house";

/**
 * The one AI Architect prop style. Every native asset is built through this profile, so chairs, planters and counters
 * share bevels, edge softness, material response and weight with each other and with the house renderer (which bevels its
 * boxes with a rounded-box of 2 segments and shades with the same MATERIAL_PROPERTIES table).
 *
 * The target look is polished video-game: stylized / semi-realistic, readable silhouettes, moderate bevels, PBR surfaces.
 */

export const DETAIL_LEVELS = ["low", "medium", "high"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const STYLE_PROFILE = {
  version: 1,
  bevel: {
    /** Radius as a fraction of a part's smallest edge, before the spec's own `bevel` multiplier. */
    ratio: 0.14,
    /** Metres. A bevel never disappears (crisp CG edges) and never balloons into a blob. */
    min: 0.004,
    max: 0.03,
    /** Spec `bevel` multiplier range. */
    multiplier: { min: 0.25, max: 2 },
  },
  /** Curve segments per rounded edge / corner (the house's rounded boxes use 2, which is `medium`). */
  edgeSegments: { low: 1, medium: 2, high: 3 } satisfies Record<DetailLevel, number>,
  radialSegments: { low: 10, medium: 16, high: 28 } satisfies Record<DetailLevel, number>,
  /** Roughness every surface is clamped into, so nothing is mirror-shiny or chalk-flat. Metals keep their own low end. */
  roughness: { min: 0.3, max: 0.92, metalMin: 0.2 },
  /** Colours are pulled back to this HSL saturation at most: rich, never neon. */
  saturationMax: 0.85,
  /** Metres of surface covered by one texture repeat (UVs are world-scale so patterns keep their size on any part). */
  textureScale: 1,
  /** Triangles a finished asset may use. Sized so dozens of instances share a site. */
  triangleBudget: { low: 1_800, medium: 5_000, high: 11_000 } satisfies Record<DetailLevel, number>,
  /** Nothing thinner than this (m): paper-thin parts shimmer and vanish at distance. */
  minPartThickness: 0.012,
  emissiveIntensity: { min: 0, max: 8 },
  /** A built asset may be rescaled to its declared size within these ratios; further off means the spec is wrong. */
  fitRatio: { min: 0.6, max: 1.6 },
  maxParts: 48,
  maxExpandedParts: 96,
} as const;

/**
 * `emissiveColor` / `emissiveIntensity` make a slot glow (bulbs, flames, lit glass). Both are optional: a slot with neither is
 * exactly what it always was. Intensity 1 is "just visible"; above 1 exports with KHR_materials_emissive_strength.
 */
export type MaterialSlot = { key: string; material: MaterialType; color: string; roughness?: number; metalness?: number; emissiveColor?: string; emissiveIntensity?: number };

export interface ResolvedSurface {
  key: string;
  material: MaterialType;
  color: string;
  roughness: number;
  metalness: number;
  transparent: boolean;
  opacity: number;
  /** Glow colour, or null when the surface does not emit (the default for every existing asset). */
  emissive: string | null;
  emissiveIntensity: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bevel radius (m) for a part whose smallest edge is `minEdge`. */
export function bevelRadius(minEdge: number, multiplier = 1): number {
  const b = STYLE_PROFILE.bevel;
  const raw = minEdge * b.ratio * clamp(multiplier, b.multiplier.min, b.multiplier.max);
  // Never more than 40% of the edge, or the box degenerates.
  return Math.min(clamp(raw, b.min, b.max), minEdge * 0.4);
}

/** Pulls a colour's saturation under the profile cap. Hue and lightness are untouched. */
export function limitSaturation(hex: string): string {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.s <= STYLE_PROFILE.saturationMax) return hex.toLowerCase();
  c.setHSL(hsl.h, STYLE_PROFILE.saturationMax, hsl.l);
  return `#${c.getHexString()}`;
}

/** A spec material slot as the house renderer would shade it, held inside the profile's roughness and saturation ranges. */
export function resolveSurface(slot: MaterialSlot): ResolvedSurface {
  const base = MATERIAL_PROPERTIES[slot.material];
  const metalness = clamp(slot.metalness ?? base.metalness, 0, 1);
  const lowest = metalness > 0.5 ? STYLE_PROFILE.roughness.metalMin : STYLE_PROFILE.roughness.min;
  const glass = slot.material === "glass";
  // A slot glows when it has an intensity above zero and a colour (its own base colour when only an intensity was given).
  const intensity = clamp(slot.emissiveIntensity ?? (slot.emissiveColor ? 1 : 0), STYLE_PROFILE.emissiveIntensity.min, STYLE_PROFILE.emissiveIntensity.max);
  const glows = intensity > 0 && (slot.emissiveColor !== undefined || slot.emissiveIntensity !== undefined);
  return {
    key: slot.key,
    material: slot.material,
    color: limitSaturation(slot.color),
    roughness: glass ? clamp(slot.roughness ?? base.roughness, 0.02, STYLE_PROFILE.roughness.max) : clamp(slot.roughness ?? base.roughness, lowest, STYLE_PROFILE.roughness.max),
    metalness,
    transparent: glass,
    opacity: glass ? 0.5 : 1,
    emissive: glows ? (slot.emissiveColor ?? slot.color).toLowerCase() : null,
    emissiveIntensity: glows ? intensity : 0,
  };
}
