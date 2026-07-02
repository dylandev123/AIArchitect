"use client";

import { Environment, Sky } from "@react-three/drei";

/**
 * Bakes our own procedural Sky into a real-time environment map (PMREM) for
 * image-based lighting — materials get believable ambient color and soft
 * reflections that match the visible sky, without fetching any HDRI file.
 * Baked once (frames=1) since the sky is static.
 */
export function SceneEnvironment() {
  return (
    <Environment resolution={128} frames={1}>
      <Sky sunPosition={[40, 35, 20]} turbidity={6} rayleigh={1.5} mieCoefficient={0.005} />
    </Environment>
  );
}
