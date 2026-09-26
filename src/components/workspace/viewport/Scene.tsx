"use client";

import { Sky } from "@react-three/drei";
import type { TimeOfDay } from "@/types/project";
import { TIME_OF_DAY } from "@/lib/timeOfDay";
import { SunLight } from "./SunLight";
import { PostFx } from "./PostFx";
import { GroundPlane } from "./GroundPlane";
import { SceneGrid } from "./SceneGrid";
import { HouseRenderer } from "./house/HouseRenderer";
import { SceneEnvironment } from "./scenery/SceneEnvironment";
import { Scenery } from "./scenery/Scenery";
import { Terrain } from "./scenery/Terrain";
import { useNeedsGeneration } from "./useNeedsGeneration";

interface SceneProps {
  timeOfDay: TimeOfDay;
}

export function Scene({ timeOfDay }: SceneProps) {
  const cfg = TIME_OF_DAY[timeOfDay];
  const { sky, sun, ambient, hemi, fills, fog, exposure, envIntensity } = cfg;
  // A never-designed project shows only the site, terrain and horizon — no placeholder house.
  const blank = useNeedsGeneration();

  return (
    <>
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />

      <Sky
        sunPosition={sky.sunPosition}
        turbidity={sky.turbidity}
        rayleigh={sky.rayleigh}
        mieCoefficient={sky.mieCoefficient}
      />

      {/* key forces a remount + rebake whenever timeOfDay changes */}
      <SceneEnvironment
        key={timeOfDay}
        sunPosition={sky.sunPosition}
        turbidity={sky.turbidity}
        rayleigh={sky.rayleigh}
        mieCoefficient={sky.mieCoefficient}
        intensity={envIntensity}
      />

      <ambientLight intensity={ambient.intensity} color={ambient.color} />
      <hemisphereLight args={[hemi.sky, hemi.ground, hemi.intensity]} />

      {fills.map((fill, i) => (
        <directionalLight
          key={i}
          position={fill.position}
          intensity={fill.intensity}
          color={fill.color}
        />
      ))}

      <SunLight position={sun.position} intensity={sun.intensity} color={sun.color} />

      <GroundPlane />
      <SceneGrid />
      <Terrain />
      {!blank && <HouseRenderer />}
      {!blank && <Scenery />}
      <PostFx exposure={exposure} />
    </>
  );
}
