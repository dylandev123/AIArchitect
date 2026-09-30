"use client";

import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";

/**
 * Tiny built-in stand-ins for additive objects while a curated GLB is unavailable. They deliberately use only a
 * handful of primitives: enough silhouette to recognize the object, no textures, asset fetches, or generation.
 */
export function ProceduralOutdoorPlaceholder({ placement }: { placement: OutdoorAssetPlacement }) {
  const { width: w, depth: d, height: h } = placement.dimensions;
  const [x, y, z] = placement.position;
  const color = placement.role === "planter" ? "#9a7654" : placement.role === "parasol" ? "#d8d0bd" : "#6a5545";
  const leg = (lx: number, lz: number, key: string, height = h * 0.48) => (
    <mesh key={key} position={[lx, height / 2, lz]}><boxGeometry args={[Math.min(.09, w * .12), height, Math.min(.09, d * .12)]} /><meshStandardMaterial color="#3c3028" roughness={.85} /></mesh>
  );
  const chair = (
    <>
      <mesh position={[0, h * .48, 0]}><boxGeometry args={[w, h * .12, d * .58]} /><meshStandardMaterial color={color} roughness={.82} /></mesh>
      <mesh position={[0, h * .73, d * .25]}><boxGeometry args={[w, h * .45, h * .1]} /><meshStandardMaterial color={color} roughness={.82} /></mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => leg(sx * w * .39, sz * d * .22, `${sx}-${sz}`)))}
    </>
  );
  const lounger = (
    <>
      <mesh position={[0, h * .38, -d * .08]} rotation={[-.18, 0, 0]}><boxGeometry args={[w, h * .13, d * .78]} /><meshStandardMaterial color="#b9b3a5" roughness={.9} /></mesh>
      <mesh position={[0, h * .62, d * .29]} rotation={[-.55, 0, 0]}><boxGeometry args={[w, h * .12, d * .35]} /><meshStandardMaterial color="#b9b3a5" roughness={.9} /></mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => leg(sx * w * .39, sz * d * .35, `${sx}-${sz}`, h * .36)))}
    </>
  );
  const table = <><mesh position={[0, h * .88, 0]}><boxGeometry args={[w, h * .12, d]} /><meshStandardMaterial color={color} roughness={.75} /></mesh>{leg(0, 0, "stem", h * .85)}</>;
  const umbrella = <><mesh position={[0, h / 2, 0]}><cylinderGeometry args={[.035, .05, h, 8]} /><meshStandardMaterial color="#514238" /></mesh><mesh position={[0, h * .88, 0]}><coneGeometry args={[Math.max(w, d) / 2, h * .25, 12]} /><meshStandardMaterial color={color} roughness={.9} /></mesh></>;
  const planter = <><mesh position={[0, h * .24, 0]}><cylinderGeometry args={[w * .42, w * .34, h * .48, 10]} /><meshStandardMaterial color={color} roughness={.95} /></mesh><mesh position={[0, h * .72, 0]}><sphereGeometry args={[Math.min(w, d) * .38, 8, 6]} /><meshStandardMaterial color="#496b3d" roughness={1} /></mesh></>;
  const shape = placement.role === "sun-lounger" ? lounger : placement.role === "side-table" ? table : placement.role === "parasol" ? umbrella : placement.role === "planter" ? planter : chair;
  return <group position={[x, y, z]} rotation={placement.rotation}>{shape}</group>;
}
