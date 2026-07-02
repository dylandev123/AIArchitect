"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface WaterSurfaceProps {
  position: [number, number, number];
  width: number;
  depth: number;
}

/** Animated, reflective pool water — a rippling procedural plane, no textures. */
export function WaterSurface({ position, width, depth }: WaterSurfaceProps) {
  const geometryRef = useRef<THREE.PlaneGeometry>(null);
  const baseRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    baseRef.current = null;
  }, [width, depth]);

  useFrame(({ clock }) => {
    const geometry = geometryRef.current;
    if (!geometry) return;
    if (!baseRef.current) {
      baseRef.current = Float32Array.from(geometry.attributes.position.array);
    }
    const base = baseRef.current;
    const t = clock.getElapsedTime();
    const posAttr = geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      arr[i + 2] = Math.sin(x * 1.6 + t * 1.3) * 0.02 + Math.cos(y * 1.2 + t * 1.0) * 0.02;
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry ref={geometryRef} args={[width, depth, 18, 12]} />
      <meshPhysicalMaterial
        color="#2f8fb8"
        roughness={0.08}
        metalness={0}
        transparent
        opacity={0.85}
        envMapIntensity={1.4}
        clearcoat={0.6}
        clearcoatRoughness={0.2}
      />
    </mesh>
  );
}
