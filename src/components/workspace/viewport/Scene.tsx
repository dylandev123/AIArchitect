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
      <Sky sunPosition={[40, 35, 20]} turbidity={6} rayleigh={1.5} mieCoefficient={0.005} />
      <SceneEnvironment />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#bcd9ff", "#5b6b58", 0.6]} />
      <SunLight />
      <GroundPlane />
      <SceneGrid />
      <HouseRenderer />
      <Scenery />
    </>
  );
}
