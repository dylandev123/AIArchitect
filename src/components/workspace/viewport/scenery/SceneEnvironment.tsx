"use client";

import { Environment, Sky } from "@react-three/drei";

interface SceneEnvironmentProps {
  sunPosition: [number, number, number];
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  intensity: number;
}

export function SceneEnvironment({ sunPosition, turbidity, rayleigh, mieCoefficient, intensity }: SceneEnvironmentProps) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <Sky
        sunPosition={sunPosition}
        turbidity={turbidity}
        rayleigh={rayleigh}
        mieCoefficient={mieCoefficient}
      />
    </Environment>
  );
}
