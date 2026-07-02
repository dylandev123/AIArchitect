import type { FurnitureCluster } from "@/lib/landscaping/furniture";

const TABLE_RADIUS = 0.55;
const TABLE_HEIGHT = 0.72;
const CHAIR_SIZE = 0.42;
const CHAIR_HEIGHT = 0.42;
const RING_RADIUS = 0.95;
const CHAIR_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function PatioFurnitureSet({ cluster }: { cluster: FurnitureCluster }) {
  const [cx, cy, cz] = cluster.center;

  return (
    <group position={[cx, cy, cz]} rotation={[0, cluster.rotationY, 0]}>
      <mesh position={[0, TABLE_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.04, 20]} />
        <meshStandardMaterial color="#caa472" roughness={0.7} />
      </mesh>
      <mesh position={[0, TABLE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, TABLE_HEIGHT, 10]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.6} metalness={0.3} />
      </mesh>

      {CHAIR_ANGLES.map((angle) => {
        const x = Math.sin(angle) * RING_RADIUS;
        const z = Math.cos(angle) * RING_RADIUS;
        return (
          <group key={angle} position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]}>
            <mesh position={[0, CHAIR_HEIGHT, 0]} castShadow receiveShadow>
              <boxGeometry args={[CHAIR_SIZE, 0.06, CHAIR_SIZE]} />
              <meshStandardMaterial color="#445566" roughness={0.6} />
            </mesh>
            <mesh position={[0, CHAIR_HEIGHT + CHAIR_SIZE / 2, -CHAIR_SIZE / 2 + 0.03]} castShadow>
              <boxGeometry args={[CHAIR_SIZE, CHAIR_SIZE, 0.06]} />
              <meshStandardMaterial color="#445566" roughness={0.6} />
            </mesh>
            <mesh position={[0, CHAIR_HEIGHT / 2, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, CHAIR_HEIGHT, 6]} />
              <meshStandardMaterial color="#2c2f33" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
