import type { CarPlacement } from "@/lib/landscaping/cars";

const BODY_LENGTH = 4.2;
const BODY_WIDTH = 1.8;
const BODY_HEIGHT = 0.55;
const CABIN_LENGTH = 2.1;
const CABIN_HEIGHT = 0.5;
const WHEEL_RADIUS = 0.32;

const WHEEL_OFFSETS: [number, number][] = [
  [BODY_WIDTH / 2 - 0.1, BODY_LENGTH / 2 - 0.6],
  [-(BODY_WIDTH / 2 - 0.1), BODY_LENGTH / 2 - 0.6],
  [BODY_WIDTH / 2 - 0.1, -(BODY_LENGTH / 2 - 0.6)],
  [-(BODY_WIDTH / 2 - 0.1), -(BODY_LENGTH / 2 - 0.6)],
];

export function Car({ car }: { car: CarPlacement }) {
  const [x, z] = car.position;
  const wheelY = WHEEL_RADIUS;
  const bodyY = wheelY + BODY_HEIGHT / 2;
  const cabinY = wheelY + BODY_HEIGHT + CABIN_HEIGHT / 2;

  return (
    <group position={[x, 0, z]} rotation={[0, car.rotationY, 0]}>
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_LENGTH]} />
        <meshStandardMaterial color={car.color} roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, cabinY, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[BODY_WIDTH * 0.82, CABIN_HEIGHT, CABIN_LENGTH]} />
        <meshStandardMaterial color="#1c2530" roughness={0.2} metalness={0.3} />
      </mesh>
      {WHEEL_OFFSETS.map(([wx, wz], i) => (
        <mesh key={i} position={[wx, wheelY, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 14]} />
          <meshStandardMaterial color="#111114" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
