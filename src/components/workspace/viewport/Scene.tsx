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
import { useSceneStore } from "@/store/useSceneStore";
import type { V3SceneSite } from "@/lib/v3/scene";

interface SceneProps {
  timeOfDay: TimeOfDay;
  v3Presentation?: boolean;
  /** Active V3 site: its terrain is the ground authority inside the site rectangle. */
  v3Site?: V3SceneSite;
}

export function Scene({ timeOfDay, v3Presentation = false, v3Site }: SceneProps) {
  const cfg = TIME_OF_DAY[timeOfDay];
  const { sky, sun } = cfg;
  // V3's terrain has local relief and needs a little more distance contrast.
  // Keep the established V2 palette and lighting completely untouched.
  const ambient = v3Presentation ? { ...cfg.ambient, intensity: cfg.ambient.intensity * .82 } : cfg.ambient;
  const hemi = v3Presentation ? { ...cfg.hemi, intensity: cfg.hemi.intensity * .82 } : cfg.hemi;
  const fills = v3Presentation ? cfg.fills.map((fill) => ({ ...fill, intensity: fill.intensity * .85 })) : cfg.fills;
  const fog = v3Presentation ? { ...cfg.fog, near: cfg.fog.near * 1.5, far: cfg.fog.far * 1.5 } : cfg.fog;
  const exposure = v3Presentation ? cfg.exposure * .92 : cfg.exposure;
  const envIntensity = v3Presentation ? cfg.envIntensity * .82 : cfg.envIntensity;
  // A never-designed project shows only the site, terrain and horizon — no placeholder house.
  const blank = useNeedsGeneration();
  const geometryXRay = useSceneStore((s) => s.geometryXRay);

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

      {!geometryXRay && <GroundPlane v3Site={v3Presentation ? v3Site : undefined} />}
      <SceneGrid />
      {!geometryXRay && <Terrain />}
      {!blank && <HouseRenderer />}
      {!blank && !geometryXRay && <Scenery />}
      <PostFx exposure={exposure} />
    </>
  );
}
