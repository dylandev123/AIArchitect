"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { TreePlacement } from "@/lib/landscaping/trees";

/** Low-poly game-style tree — smoothed foliage clumps, sun-lit crown and a soft grounding shadow. */
export function Tree({ tree }: { tree: TreePlacement }) {
  const [x, z] = tree.position;
  const trunkTop = tree.trunkHeight;
  const r = tree.foliageRadius;

  const { crown, shade } = useMemo(() => {
    const base = new THREE.Color(tree.foliageColor);
    return { crown: base.clone().offsetHSL(0, 0, 0.06), shade: base.clone().offsetHSL(0, 0.02, -0.06) };
  }, [tree.foliageColor]);

  return (
    <group position={[x, tree.y ?? 0, z]} rotation={[0, tree.rotationY, 0]}>
      {/* Soft contact shadow so the trunk sits in the lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[r * 0.95, 20]} />
        <meshBasicMaterial color="#0a1408" transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* Trunk with a slight root flare */}
      <mesh position={[0, trunkTop / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tree.trunkRadius * 0.55, tree.trunkRadius * 1.15, trunkTop, 8]} />
        <meshStandardMaterial color="#5a3a1c" roughness={0.95} />
      </mesh>

      {/* Main crown, with a darker lower clump and a brighter top for volume */}
      <mesh position={[0, trunkTop + r * 0.6, 0]} scale={[1, 0.9, 1]} castShadow receiveShadow>
        <icosahedronGeometry args={[r, 1]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[-r * 0.35, trunkTop + r * 0.35, r * 0.2]} castShadow receiveShadow>
        <icosahedronGeometry args={[r * 0.62, 1]} />
        <meshStandardMaterial color={shade} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[r * 0.18, trunkTop + r * 1.15, -r * 0.1]} castShadow receiveShadow>
        <icosahedronGeometry args={[r * 0.62, 1]} />
        <meshStandardMaterial color={crown} roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}
