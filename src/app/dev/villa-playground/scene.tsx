"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import {presentationDistance} from '@/lib/villa/scene/presentation';
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

export type Vector = [number, number, number];
export type CameraPose = { position: Vector; target: Vector };
export const VIEWS = {
  "Fit Property": { position: [33, 28, 43], target: [0, 3, 0] },
  "Focus House": { position: [33, 15.5, 43], target: [0, 3, 0] },
  "Aerial": { position: [29, 60, 33], target: [0, 1, 3] },
  "Poolside": { position: [33, 15.5, 43], target: [0, 3.3, 2.4] },
  "Arrival": { position: [-38, 14, 36], target: [0, 3.2, 3] },
  "Facade": { position: [0, 8, 43], target: [0, 3, 0] },
  "Garden": { position: [30, 17, -31], target: [0, 3, 0] },
  "Above": { position: [29, 39, 33], target: [0, 1, 3] },
} satisfies Record<string, { position: Vector; target: Vector }>;
export type View = keyof typeof VIEWS;
export type Mood = "Daylight" | "Golden hour";

function CameraControls({ entranceElementId, poolElementId, cameraPose, frameArchitectureOnly = false, interactive = true, view, reset, tour, factor = 1, centerX = 0, centerZ = 0, composition, architecture }: { entranceElementId?: string; poolElementId?: string; cameraPose?: CameraPose; frameArchitectureOnly?: boolean; interactive?: boolean; architecture: React.RefObject<THREE.Group | null>; view: View; reset: number; tour: boolean; factor?: number; centerX?: number; centerZ?: number; composition?: WingComposition }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree(state => state.camera);
  const size = useThree(state => state.size);
  useEffect(() => {
    if(camera instanceof THREE.PerspectiveCamera) {
      // R3F exposes Three.js objects for imperative projection updates.
      // eslint-disable-next-line react-hooks/immutability
      camera.far=Math.max(800,composition ? Math.max(composition.garden.width,composition.garden.depth)*10 : 800);
      camera.updateProjectionMatrix();
    }
  }, [camera,composition]);
  const initialized = useRef(false);
  const flight = useRef<{ start: THREE.Vector3; target: THREE.Vector3; elapsed: number; position: THREE.Vector3; destination: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!controls.current) return;
    const position=new THREE.Vector3(...VIEWS[view].position).multiplyScalar(factor).add(new THREE.Vector3(centerX,0,centerZ));
    const target=new THREE.Vector3(...VIEWS[view].target).add(new THREE.Vector3(centerX,0,centerZ));
    if (architecture.current && camera instanceof THREE.PerspectiveCamera) {
      architecture.current.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(architecture.current);
      if (!bounds.isEmpty()) {
        if (!frameArchitectureOnly && (view === 'Fit Property' || view === 'Aerial' || view === 'Above' || view === 'Garden')) {
          if (composition) {
            const g = composition.garden;
            bounds.expandByPoint(new THREE.Vector3(g.x-g.width/2, 0, g.z-g.depth/2));
            bounds.expandByPoint(new THREE.Vector3(g.x+g.width/2, 0, g.z+g.depth/2));
          } else {
            bounds.expandByPoint(new THREE.Vector3(-20, 0, -20));
            bounds.expandByPoint(new THREE.Vector3(20, 0, 24));
          }
        }
        bounds.getCenter(target);
        const direction = new THREE.Vector3(1, .6, 1);
        if (view === 'Arrival') {
          const court = composition?.estateLandscape?.court;
          if (court) {
            direction.set(court.x-target.x, 0, court.z-target.z);
            if (direction.lengthSq() < 1) direction.set(-1, 0, -1);
            direction.y = direction.length()*.4;
          }
          else direction.set(-1, .25, -1);
        }
        if (view === 'Facade') direction.set(0, .18, 1);
        if (view === 'Garden') direction.set(1, .3, 1);
        if(entranceElementId&&(view==='Arrival'||(view==='Garden'&&!poolElementId))){
          const entrance=architecture.current.getObjectByName(`operation:${entranceElementId}`);
          if(entrance){const p=entrance.getWorldPosition(new THREE.Vector3());direction.set(p.x-target.x,0,p.z-target.z);if(direction.lengthSq()<1)direction.set(0,0,1);if(view==='Garden')direction.negate();direction.y=direction.length()*(view==='Arrival'?.25:.3);}
        }
        if (view === 'Aerial' || view === 'Above') direction.set(.35, 1.4, .45);
        if((view==='Poolside'||view==='Garden') && poolElementId){
          const water=architecture.current.getObjectByName(`operation:${poolElementId}`);
          if(water){const p=water.getWorldPosition(new THREE.Vector3());direction.set(p.x-target.x,0,p.z-target.z);if(direction.lengthSq()<1)direction.set(1,0,-1);direction.y=direction.length()*(view==='Garden'?.3:.2);}
        }
        if (view === 'Poolside' && composition?.pool.enabled !== false && composition) {
          direction.set(composition.pool.x-target.x, 0, composition.pool.z-target.z);
          if (direction.lengthSq() < 1) direction.set(1, 0, 1);
          direction.y = direction.length()*.3;
        }
        position.copy(target).addScaledVector(direction.normalize(), presentationDistance(bounds,direction,camera.fov,camera.aspect));
      }
    }
    if (cameraPose) { position.set(...cameraPose.position); target.set(...cameraPose.target); }
    if (!initialized.current || cameraPose) {
      camera.position.copy(position);
      controls.current.target.copy(target);
      controls.current.update();
      initialized.current = true;
    } else {
      flight.current = { start: camera.position.clone(), target: controls.current.target.clone(), elapsed: 0, position, destination: target };
    }
  }, [entranceElementId, poolElementId, view, reset, camera, factor, centerX, centerZ, composition, size.width, size.height, architecture, cameraPose, frameArchitectureOnly]);
  useFrame((state, delta) => {
    const orbitTarget = controls.current?.target;
    if (orbitTarget && state.scene.fog instanceof THREE.Fog) {
      const distance = camera.position.distanceTo(orbitTarget);
      state.scene.fog.near = Math.max(60*factor, distance);
      state.scene.fog.far = Math.max(170*factor, distance+170*factor);
    }
    const move = flight.current, orbit = controls.current;
    if (!move || !orbit) return;
    move.elapsed += delta;
    const t = Math.min(1, move.elapsed / 1.2), eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(move.start, move.position, eased);
    orbit.target.lerpVectors(move.target, move.destination, eased);
    orbit.update();
    if (t === 1) flight.current = null;
  });
  return <OrbitControls enabled={interactive} ref={controls} makeDefault enableDamping dampingFactor={.07}
    target={VIEWS.Poolside.target} minDistance={6} maxDistance={Math.max(1000,500*factor)} minPolarAngle={.12}
    maxPolarAngle={Math.PI / 2 - .025} enablePan autoRotate={tour} autoRotateSpeed={.4}
    onStart={() => { flight.current = null; }} />;
}

export function VillaScene({ entranceElementId, poolElementId, residenceOnly=false, replaceArchitecture=false, grounds, children, cameraPose, frameArchitectureOnly, interactive, mood, view, reset, tour, config, composition }: {
  entranceElementId?: string; poolElementId?: string; residenceOnly?: boolean; replaceArchitecture?: boolean; grounds?: ReactNode; children?: ReactNode; cameraPose?: CameraPose; frameArchitectureOnly?: boolean; interactive?: boolean; mood: Mood; view: View; reset: number; tour: boolean; config?: VillaConfig; composition?: WingComposition;
}) {
  const architecture = useRef<THREE.Group>(null);
  const extent=composition ? Math.max(1,Math.max(composition.garden.width,composition.garden.depth)/40) : 1;
  const golden = mood === "Golden hour";
  const sky = { sunPosition: (golden ? [-32, 18, 30] : [-30, 42, 28]) as Vector, turbidity: golden ? 3.5 : 2, rayleigh: 1.4, mieCoefficient: .004 };
  return <>
    <color attach="background" args={[golden ? "#e9d7b8" : "#dce8e5"]} />
    <fog attach="fog" args={[golden ? "#e9dfc9" : "#dce8e5", 60*extent, 170*extent]} />
    <Sky {...sky} distance={1000*extent} />
    <SceneEnvironment key={mood} {...sky} intensity={.85} />
    <ambientLight intensity={.3} color="#fff4e5" />
    <hemisphereLight args={["#dceaff", "#7d8269", .6]} />
    <SunLight position={sky.sunPosition} intensity={golden ? 2.5 : 3} color={golden ? "#ffe0ad" : "#fff8e8"} />
    <directionalLight position={[18, 15, -15]} intensity={.35} color="#dbe8ff" />
    <group ref={architecture} name="Property architecture">{replaceArchitecture ? null : composition ? <ComposedVilla composition={composition} residenceOnly={residenceOnly} /> : config ? <ConfiguredVilla config={config} /> : <TropicalVilla />}{children}</group>
    {grounds ?? (residenceOnly ? <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.4,0]} receiveShadow><planeGeometry args={[2000,2000]}/><meshStandardMaterial color="#b5b1a5" roughness={1}/></mesh> : composition ? <CompositionGrounds composition={composition} /> : config ? <DesignGrounds config={config} /> : <TropicalGrounds />)}
    <CameraControls entranceElementId={entranceElementId} poolElementId={poolElementId} frameArchitectureOnly={frameArchitectureOnly || residenceOnly} cameraPose={cameraPose} interactive={interactive} architecture={architecture} view={view} reset={reset} tour={tour} composition={composition} factor={composition ? composition.authored ? Math.max(.92, Math.max(composition.garden.width,composition.garden.depth)/40) : composition.id === "compact-l" ? .92 : 1.18 : 1} centerX={composition?.authored ? composition.garden.x : 0} centerZ={composition?.authored ? composition.garden.z : 0} />
    <PostFx exposure={.9} />
  </>;
}
