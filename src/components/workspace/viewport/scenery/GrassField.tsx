"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Instance, Instances } from "@react-three/drei";
import type { GrassTuft } from "@/lib/landscaping/grass";
import { naturalGreen } from "./vegetation";

/** A clump of curved, tapering blades with base-to-tip shading (vertex colours multiply the per-tuft tint). */
function makeClump(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const blades = 7;
  const segs = 3;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + b * 0.7;
    const h = 0.26 + ((b * 37) % 11) / 11 * 0.2;
    const lean = 0.08 + ((b * 17) % 7) / 7 * 0.12;
    const ox = Math.cos(a) * 0.035, oz = Math.sin(a) * 0.035;
    const dx = Math.cos(a), dz = Math.sin(a);
    const base = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = 0.028 * (1 - t * 0.92);
      const cx = ox + dx * lean * t * t, cz = oz + dz * lean * t * t;
      const px = -dz * w, pz = dx * w;
      const shade = 0.42 + t * 0.7;
      positions.push(cx - px, h * t, cz - pz, cx + px, h * t, cz + pz);
      colors.push(shade, shade, shade, shade, shade, shade);
      if (s < segs) {
        const k = base + s * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function GrassField({ tufts }: { tufts: GrassTuft[] }) {
  const clump = useMemo(() => makeClump(), []);
  const colors = useMemo(() => tufts.map((t) => naturalGreen(t.color)), [tufts]);
  if (tufts.length === 0) return null;

  return (
    <Instances limit={tufts.length} receiveShadow geometry={clump}>
      <meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} />
      {tufts.map((tuft, i) => (
        <Instance
          key={i}
          position={[tuft.position[0], 0, tuft.position[1]]}
          rotation={[0, tuft.rotationY, 0]}
          scale={tuft.scale * 1.15}
          color={colors[i]}
        />
      ))}
    </Instances>
  );
}
