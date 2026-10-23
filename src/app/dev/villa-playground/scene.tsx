"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { SunLight } from "@/components/workspace/viewport/SunLight";
import { SceneEnvironment } from "@/components/workspace/viewport/scenery/SceneEnvironment";
import { PostFx } from "@/components/workspace/viewport/PostFx";
import { TropicalVilla } from "./architecture";
import { TropicalGrounds } from "./grounds";
import type { VillaConfig } from "@/lib/villa/design";
import { ConfiguredVilla } from "./villa-kit";
import { DesignGrounds } from "./design-grounds";

import { ComposedVilla, CompositionGrounds } from "./composed-villa";
import type { WingComposition } from "./wing-composition";

type Vector = [number, number, number];
export const VIEWS = {
  "Poolside": { position: [33, 15.5, 43], target: [0, 3.3, 2.4] },
  "Arrival": { position: [-38, 14, 36], target: [0, 3.2, 3] },
  "Garden": { position: [30, 17, -31], target: [0, 3, 0] },
  "Above": { position: [29, 39, 33], target: [0, 1, 3] },
} satisfies Record<string, { position: Vector; target: Vector }>;
export type View = keyof typeof VIEWS;
export type Mood = "Daylight" | "Golden hour";

function CameraControls({ view, reset, tour, factor = 1, centerX = 0, centerZ = 0, composition }: { view: View; reset: number; tour: boolean; factor?: number; centerX?: number; centerZ?: number; composition?: WingComposition }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree(state => state.camera);
  const flight = useRef<{ start: THREE.Vector3; target: THREE.Vector3; elapsed: number } | null>(null);
  useEffect(() => {
    if (!controls.current) return;
    flight.current = { start: camera.position.clone(), target: controls.current.target.clone(), elapsed: 0 };
  }, [view, reset, camera, factor, centerX, centerZ]);
  useFrame((_, delta) => {
    const move = flight.current, orbit = controls.current;
    if (!move || !orbit) return;
    move.elapsed += delta;
    const t = Math.min(1, move.elapsed / 1.2), eased = t * t * (3 - 2 * t);
    const position=new THREE.Vector3(...VIEWS[view].position).multiplyScalar(factor).add(new THREE.Vector3(centerX,0,centerZ));
    const target=new THREE.Vector3(...VIEWS[view].target).add(new THREE.Vector3(centerX,0,centerZ));
    if(composition?.estateLandscape) {
      const g=composition.garden,span=Math.max(g.width,g.depth),p=composition.pool,main=composition.wings.find(w=>w.role==='main')!;
      if(view==='Above') {position.set(g.x+span*.67,span*1.35,g.z+span*.87);target.set(g.x,0,g.z);}
      if(view==='Arrival') {position.set(g.x-span*.65,span*.38,g.z-span*.65);target.set(main.x,2,g.z+3);}
      if(view==='Poolside') {position.set(p.x+span*.34,span*.22,p.z+span*.34);target.set(main.x,3,main.z+main.depth/2);}
      if(view==='Garden') {position.set(g.x+span*.64,span*.48,g.z-span*.55);target.set(g.x,1,g.z);}
    }
    camera.position.lerpVectors(move.start, position, eased);
    orbit.target.lerpVectors(move.target, target, eased);
    orbit.update();
    if (t === 1) flight.current = null;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.07}
    target={VIEWS.Poolside.target} minDistance={6} maxDistance={Math.max(100,100*factor)} minPolarAngle={.12}
    maxPolarAngle={Math.PI / 2 - .025} enablePan autoRotate={tour} autoRotateSpeed={.4}
    onStart={() => { flight.current = null; }} />;
}

export function VillaScene({ mood, view, reset, tour, config, composition }: {
  mood: Mood; view: View; reset: number; tour: boolean; config?: VillaConfig; composition?: WingComposition;
}) {
  const extent=composition ? Math.max(1,Math.max(composition.garden.width,composition.garden.depth)/40) : 1;
  const golden = mood === "Golden hour";
  const sky = { sunPosition: (golden ? [-32, 18, 30] : [-30, 42, 28]) as Vector, turbidity: golden ? 3.5 : 2, rayleigh: 1.4, mieCoefficient: .004 };
  return <>
    <color attach="background" args={[golden ? "#e9d7b8" : "#dce8e5"]} />
    <fog attach="fog" args={[golden ? "#e9dfc9" : "#dce8e5", 60*extent, 170*extent]} />
    <Sky {...sky} />
    <SceneEnvironment key={mood} {...sky} intensity={.85} />
    <ambientLight intensity={.3} color="#fff4e5" />
    <hemisphereLight args={["#dceaff", "#7d8269", .6]} />
    <SunLight position={sky.sunPosition} intensity={golden ? 2.5 : 3} color={golden ? "#ffe0ad" : "#fff8e8"} />
    <directionalLight position={[18, 15, -15]} intensity={.35} color="#dbe8ff" />
    {composition ? <ComposedVilla composition={composition} /> : config ? <ConfiguredVilla config={config} /> : <TropicalVilla />}
    {composition ? <CompositionGrounds composition={composition} /> : config ? <DesignGrounds config={config} /> : <TropicalGrounds />}
    <CameraControls view={view} reset={reset} tour={tour} composition={composition} factor={composition ? composition.authored ? Math.max(.92, Math.max(composition.garden.width,composition.garden.depth)/40) : composition.id === "compact-l" ? .92 : 1.18 : 1} centerX={composition?.authored ? composition.garden.x : 0} centerZ={composition?.authored ? composition.garden.z : 0} />
    <PostFx exposure={.9} />
  </>;
}
