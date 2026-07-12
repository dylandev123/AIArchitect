"use client";

import { Environment, Sky } from "@react-three/drei";

interface SceneEnvironmentProps {
  sunPosition: [number, number, number];
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
}

export function SceneEnvironment({ sunPosition, turbidity, rayleigh, mieCoefficient }: SceneEnvironmentProps) {
  return (
    <Environment resolution={256} frames={1}>
      <Sky
        sunPosition={sunPosition}
        turbidity={turbidity}
        rayleigh={rayleigh}
        mieCoefficient={mieCoefficient}
      />
    </Environment>
  );
}
