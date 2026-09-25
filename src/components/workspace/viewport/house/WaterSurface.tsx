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

/**
 * Water over an arbitrary outline (a kidney pool, a river): a triangle mesh in world space with planar UVs, so the
 * same scrolling ripple normal maps apply. Used for every "-water" triangle mesh; rectangular pools keep WaterSurface.
 */
export function ShapedWaterSurface({ vertices, color, opacity = 0.86 }: { vertices: number[]; color: string; opacity?: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const uv = new Float32Array((vertices.length / 3) * 2);
    for (let i = 0; i < vertices.length / 3; i++) {
      uv[i * 2] = vertices[i * 3] / RIPPLE_METERS;
      uv[i * 2 + 1] = vertices[i * 3 + 2] / RIPPLE_METERS;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }, [vertices]);

  const ripples = useMemo(() => {
    const tex = getWaterNormalMap().clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ripples.offset.set(t * 0.012, t * 0.007);
  });

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        color={color}
        roughness={0.08}
        metalness={0}
        transparent
        opacity={opacity}
        envMapIntensity={0.45}
        clearcoat={0.6}
        clearcoatRoughness={0.1}
        normalMap={ripples}
        normalScale={new THREE.Vector2(0.14, 0.14)}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
