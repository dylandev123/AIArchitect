import { Instance, Instances } from "@react-three/drei";
import type { GrassTuft } from "@/lib/landscaping/grass";

export function GrassField({ tufts }: { tufts: GrassTuft[] }) {
  if (tufts.length === 0) return null;

  return (
    <Instances limit={tufts.length} receiveShadow>
      <coneGeometry args={[0.05, 0.3, 4]} />
      <meshStandardMaterial roughness={1} />
      {tufts.map((tuft, i) => (
        <Instance
          key={i}
          position={[tuft.position[0], 0.15 * tuft.scale, tuft.position[1]]}
          rotation={[0, tuft.rotationY, Math.PI * 0.04]}
          scale={[tuft.scale, tuft.scale, tuft.scale]}
          color={tuft.color}
        />
      ))}
    </Instances>
  );
}
