"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getWaterNormalMap } from "@/lib/proceduralTextures";

interface WaterSurfaceProps {
  position: [number, number, number];
  width: number;
  depth: number;
}

/** Wave metres covered by one normal-map repeat. */
const RIPPLE_METERS = 1.4;

/**
 * Sims-style pool water: clear turquoise with sky reflections and two counter-scrolling ripple normal maps.
 * Ripples move in the texture (no per-frame geometry work), so many pools stay cheap.
 */
export function WaterSurface({ position, width, depth }: WaterSurfaceProps) {
  const [ripplesA, ripplesB] = useMemo(() => {
    const base = getWaterNormalMap();
    const a = base.clone();
    const b = base.clone();
    for (const [tex, scale] of [[a, 1], [b, 1.7]] as const) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(width / RIPPLE_METERS / scale, depth / RIPPLE_METERS / scale);
      tex.needsUpdate = true;
    }
    return [a, b];
  }, [width, depth]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ripplesA.offset.set(t * 0.012, t * 0.007);
    ripplesB.offset.set(-t * 0.009, t * 0.011);
  });

  return (
    <group position={position}>
      {/* Bright, slightly opaque body that reads as tiled pool floor showing through */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshPhysicalMaterial
          color="#0a9fd0"
          roughness={0.08}
          metalness={0}
          transparent
          opacity={0.9}
          envMapIntensity={0.45}
          clearcoat={0.6}
          clearcoatRoughness={0.1}
          normalMap={ripplesA}
          normalScale={new THREE.Vector2(0.12, 0.12)}
          specularIntensity={1}
        />
      </mesh>
      {/* Second ripple layer, offset just above to break up the repeat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.1}
          transparent
          opacity={0.05}
          normalMap={ripplesB}
          normalScale={new THREE.Vector2(0.2, 0.2)}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
