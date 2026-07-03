"use client";

import { Environment, Sky } from "@react-three/drei";

/**
 * Bakes the procedural sky into a PMREM environment map so all materials
 * (especially glass and metal) get accurate sky reflections. Parameters
 * match the visible Sky in Scene.tsx exactly.
 */
export function SceneEnvironment() {
  return (
    <Environment resolution={128} frames={1}>
      <Sky sunPosition={[40, 35, 20]} turbidity={1.5} rayleigh={3.0} mieCoefficient={0.002} />
    </Environment>
  );
}
