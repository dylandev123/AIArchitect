import type { TreePlacement } from "@/lib/landscaping/trees";

/** Low-poly game-style tree — Sims-inspired bright green foliage, rich dark trunk. */
export function Tree({ tree }: { tree: TreePlacement }) {
  const [x, z] = tree.position;
  const trunkTop = tree.trunkHeight;

  return (
    <group position={[x, 0, z]} rotation={[0, tree.rotationY, 0]}>
      {/* Trunk: rich dark brown */}
      <mesh position={[0, trunkTop / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tree.trunkRadius * 0.65, tree.trunkRadius, trunkTop, 7]} />
        <meshStandardMaterial color="#3d2208" roughness={0.9} />
      </mesh>

      {/* Main foliage sphere — flat-shaded icosahedron for Sims low-poly look */}
      <mesh position={[0, trunkTop + tree.foliageRadius * 0.65, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[tree.foliageRadius, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.8} flatShading />
      </mesh>

      {/* Offset secondary blob for organic silhouette */}
      <mesh
        position={[
          tree.foliageRadius * 0.32,
          trunkTop + tree.foliageRadius * 1.15,
          tree.foliageRadius * 0.2,
        ]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[tree.foliageRadius * 0.62, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}
