"use client";

import { Sky } from "@react-three/drei";
import { SunLight } from "./SunLight";
import { GroundPlane } from "./GroundPlane";
import { SceneGrid } from "./SceneGrid";
import { HouseRenderer } from "./house/HouseRenderer";
import { SceneEnvironment } from "./scenery/SceneEnvironment";
import { Scenery } from "./scenery/Scenery";

export function Scene() {
  return (
    <>
      {/* Atmospheric depth — light sky-blue fog fades the far horizon like GTA V outdoors */}
      <fog attach="fog" args={["#c4dff0", 160, 380]} />

      {/* Sims/GTA-style bright midday sky: low turbidity = clear blue, high rayleigh = rich colour */}
      <Sky sunPosition={[40, 35, 20]} turbidity={1.5} rayleigh={3.0} mieCoefficient={0.002} />
      <SceneEnvironment />

      {/* Warm, bright ambient fill */}
      <ambientLight intensity={0.7} color="#f2f6ff" />

      {/* Sky bounce from above, grass bounce from below */}
      <hemisphereLight args={["#c8ddff", "#72a858", 0.8]} />

      <SunLight />
      <GroundPlane />
      <SceneGrid />
      <HouseRenderer />
      <Scenery />
    </>
  );
}
