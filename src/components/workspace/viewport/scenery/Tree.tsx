import type { TreePlacement } from "@/lib/landscaping/trees";

export function Tree({ tree }: { tree: TreePlacement }) {
  const [x, z] = tree.position;
  const trunkTop = tree.trunkHeight;

  return (
    <group position={[x, 0, z]} rotation={[0, tree.rotationY, 0]}>
      <mesh position={[0, trunkTop / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tree.trunkRadius * 0.7, tree.trunkRadius, trunkTop, 7]} />
        <meshStandardMaterial color="#6b4a35" roughness={0.95} />
      </mesh>
      <mesh position={[0, trunkTop + tree.foliageRadius * 0.6, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[tree.foliageRadius, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.9} flatShading />
      </mesh>
      <mesh
        position={[tree.foliageRadius * 0.3, trunkTop + tree.foliageRadius * 1.1, tree.foliageRadius * 0.2]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[tree.foliageRadius * 0.65, 0]} />
        <meshStandardMaterial color={tree.foliageColor} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}
