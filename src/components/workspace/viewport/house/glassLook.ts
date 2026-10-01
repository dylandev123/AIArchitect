import * as THREE from "three";
import type { HousePrimitive } from "@/lib/house/types";

export interface GlassLook { color: string; opacity: number; roughness: number; metalness: number; envMapIntensity: number }

/**
 * How a see-through primitive is shaded, or null when it is opaque. Three cases:
 *
 * - Wall-backed glazing (legacy windows and doors laid over a solid wall box): plain low-opacity glass would just
 *   tint the wall pale blue, so it gets a deep-tinted, part-metallic pane that mirrors the sky and reads dark
 *   against the facade.
 * - Exposed glazing (a V2 opening, `surface: "glass"`: a hollow frame with only the room behind the pane): that
 *   wall-backed recipe has nothing light behind it and goes opaque black, so this pane stays a dielectric — tinted
 *   rather than darkened, reflection carried by the clearcoat and environment instead of metalness, and
 *   translucent enough that the interior reads faintly through it.
 * - Anything else (railings, glazed roofs — nothing solid behind) stays clear and tinted.
 */
export function glassLook(primitive: HousePrimitive): GlassLook | null {
  if (!primitive.transparent || (primitive.opacity ?? 1) >= 0.95) return null;
  const glazing = primitive.category === "window" || primitive.category === "door";
  const tint = (factor: number) => `#${new THREE.Color(primitive.color).multiplyScalar(factor).getHexString()}`;
  if (glazing && primitive.surface === "glass") return { color: tint(0.62), opacity: 0.62, roughness: 0.03, metalness: 0.18, envMapIntensity: 1.9 };
  if (glazing) return { color: tint(0.42), opacity: 0.86, roughness: 0.02, metalness: 0.62, envMapIntensity: 2.2 };
  return { color: primitive.color, opacity: Math.min(primitive.opacity ?? 0.4, 0.42), roughness: 0.03, metalness: 0.1, envMapIntensity: 2.4 };
}
