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

      {/* Warm ambient fill */}
      <ambientLight intensity={0.50} color="#f0f5ff" />

      {/* Sky bounce from above, warm grass bounce from below */}
      <hemisphereLight args={["#c0d4ff", "#6aaa48", 0.55]} />

      {/* Cool NW fill — lifts shadow darkness without killing contrast */}
      <directionalLight position={[-22, 18, -14]} intensity={0.26} color="#dde8ff" />

      {/* Warm SE rim — separates the back/right faces of the house from the sky */}
      <directionalLight position={[20, 10, 18]} intensity={0.18} color="#ffe8c0" />

      <SunLight />
      <GroundPlane />
      <SceneGrid />
      <HouseRenderer />
      <Scenery />
    </>
  );
}
