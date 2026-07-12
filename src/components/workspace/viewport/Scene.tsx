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

      {/* Warm ambient fill — reduced so shadows read clearly */}
      <ambientLight intensity={0.55} color="#f2f6ff" />

      {/* Sky bounce from above, grass bounce from below */}
      <hemisphereLight args={["#b8d0ff", "#68a04c", 0.65]} />

      {/* Soft blue-white fill from the NW to lift shadow darkness without flattening contrast */}
      <directionalLight position={[-22, 18, -14]} intensity={0.28} color="#dde8ff" />

      <SunLight />
      <GroundPlane />
      <SceneGrid />
      <HouseRenderer />
      <Scenery />
    </>
  );
}
