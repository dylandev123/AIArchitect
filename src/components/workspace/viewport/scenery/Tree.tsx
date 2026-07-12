import type { TreePlacement } from "@/lib/landscaping/trees";

/** Low-poly game-style tree — Sims-inspired bright green foliage, rich dark trunk. */
export function Tree({ tree }: { tree: TreePlacement }) {
  const [x, z] = tree.position;
  const trunkTop = tree.trunkHeight;

  return (
    <group position={[x, 0, z]} rotation={[0, tree.rotationY, 0]}>
      {/* Trunk */}
      <mesh position={[0, trunkTop / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tree.trunkRadius * 0.6, tree.trunkRadius, trunkTop, 6]} />
        <meshStandardMaterial color="#2e1a06" roughness={0.92} />
      </mesh>

      {/* Main foliage mass */}
      <mesh position={[0, trunkTop + tree.foliageRadius * 0.65, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[tree.foliageRadius, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.82} flatShading />
      </mesh>

      {/* Upper secondary blob */}
      <mesh
        position={[tree.foliageRadius * 0.28, trunkTop + tree.foliageRadius * 1.18, tree.foliageRadius * 0.18]}
        castShadow receiveShadow
      >
        <icosahedronGeometry args={[tree.foliageRadius * 0.60, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.82} flatShading />
      </mesh>

      {/* Third accent blob — opposite side for fuller silhouette */}
      <mesh
        position={[-tree.foliageRadius * 0.22, trunkTop + tree.foliageRadius * 0.88, -tree.foliageRadius * 0.20]}
        castShadow receiveShadow
      >
        <icosahedronGeometry args={[tree.foliageRadius * 0.48, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.82} flatShading />
      </mesh>
    </group>
  );
}
