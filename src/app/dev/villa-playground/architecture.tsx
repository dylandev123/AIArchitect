"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PrimitiveMesh } from "@/components/workspace/viewport/house/PrimitiveMesh";
import type { BoxPrimitive } from "@/lib/house/types";

export type Vector = [number, number, number];
const ivory = "#e4dfd1", stone = "#d1c2a5", teak = "#795239", bronze = "#343932";

/** Small, directly authored building parts, using the workspace's metre-scaled PBR finishes. */
export function FinishBox({ name, at, size, color = ivory, surface = "concrete" }: {
  name: string; at: Vector; size: Vector; color?: string; surface?: BoxPrimitive["surface"];
}) {
  const finish = surface === "stone" || surface === "paving" ? "concrete" : surface;
  const primitive = useMemo<BoxPrimitive>(() => ({ kind: "box", id: `villa-${name}`, label: name,
    category: "landscape", position: at, size, rotation: [0, 0, 0], color, surface: finish,
    roughness: .82, bevel: .018 }), [name, at, size, color, finish]);
  return <PrimitiveMesh primitive={primitive} surface={finish} readOnly />;
}

export function Box({ at, size, color = bronze, rotation, glow = false }: {
  at: Vector; size: Vector; color?: string; rotation?: Vector; glow?: boolean;
}) {
  return <mesh position={at} rotation={rotation} castShadow={!glow} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={.52} metalness={color === bronze ? .55 : .05}
      emissive={glow ? color : "#000000"} emissiveIntensity={glow ? 2 : 0} />
  </mesh>;
}

/** Repeated screens are one draw call, rather than hundreds of individual meshes. */
export function Slats({ at, count, spacing, size, axis = "x", color = teak }: {
  at: Vector; count: number; spacing: number; size: Vector; axis?: "x" | "y" | "z"; color?: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      matrix.makeTranslation(at[0] + (axis === "x" ? i * spacing : 0), at[1] + (axis === "y" ? i * spacing : 0), at[2] + (axis === "z" ? i * spacing : 0));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [at, count, spacing, axis]);
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.7} />
  </instancedMesh>;
}

/** Glazing fills real openings. Thin reflective glass lets the furnished rooms read through it. */
export function Glazing({ at, width, height, side = false, panels = 4, railing = false }: {
  at: Vector; width: number; height: number; side?: boolean; panels?: number; railing?: boolean;
}) {
  return <group position={at} rotation={[0, side ? Math.PI / 2 : 0, 0]} name={railing ? "Frameless balcony glass" : "Floor-to-ceiling glazing"}>
    <mesh>
      <boxGeometry args={[width, height, .024]} />
      <meshPhysicalMaterial color="#8daf9d" transparent opacity={railing ? .13 : .21} roughness={.07}
        metalness={.2} envMapIntensity={1.8} clearcoat={1} clearcoatRoughness={.05} depthWrite={false} />
    </mesh>
    {[-1, 1].map(s => <Box key={s} at={[0, s * height / 2, 0]} size={[width + .06, railing ? .025 : .075, .075]} />)}
    {!railing && Array.from({ length: panels + 1 }, (_, i) => <Box key={i} at={[-width / 2 + i * width / panels, 0, 0]} size={[.055, height, .085]} />)}
    {railing && [-1, 1].map(s => <Box key={s} at={[s * (width / 2 - .12), -.44 * height, 0]} size={[.07, .13, .08]} />)}
  </group>;
}

export function Roof({ at, size }: { at: Vector; size: Vector }) {
  return <group name="Floating limestone roof with teak soffit">
    <FinishBox name={`roof-${at.join("-")}`} at={at} size={size} surface="render" />
    <Box at={[at[0], at[1] - size[1] / 2 - .045, at[2]]} size={[size[0] - .16, .07, size[2] - .16]} color={teak} />
    <Box at={[at[0], at[1] + size[1] / 2 + .025, at[2]]} size={[size[0] - .42, .05, size[2] - .42]} color="#b5b2a4" />
  </group>;
}

export function Sofa({ at, rotation = 0, width = 3.4 }: { at: Vector; rotation?: number; width?: number }) {
  return <group position={at} rotation={[0, rotation, 0]} name="Linen sofa">
    <Box at={[0, .19, 0]} size={[width, .18, 1.05]} color={teak} />
    <Box at={[0, .41, .04]} size={[width - .22, .27, .94]} color="#e7e0cf" />
    <Box at={[0, .76, -.43]} size={[width, .65, .21]} color="#d9d4c3" />
    {[-1, 1].map(s => <group key={s}>
      <Box at={[s * (width / 2 - .1), .58, 0]} size={[.2, .6, 1.08]} color="#d9d4c3" />
      <Box at={[s * (width / 2 - .5), .68, -.12]} size={[.48, .44, .18]} color={s === 1 ? "#8d9b84" : "#c7a980"} rotation={[-.15, 0, s * .15]} />
    </group>)}
  </group>;
}

function LivingRoom() {
  return <group name="Furnished grand salon">
    <FinishBox name="salon-rug" at={[-7, .48, .1]} size={[7, .025, 4.7]} color="#c5bcaa" surface="render" />
    <Sofa at={[-7, .5, -1.9]} width={5} />
    <Sofa at={[-10, .5, .1]} rotation={Math.PI / 2} width={3} />
    <FinishBox name="salon-coffee-table" at={[-6.8, .84, .5]} size={[2.7, .24, 1.35]} color="#9f9479" surface="stone" />
    <Box at={[-6.8, .64, .5]} size={[2.1, .3, .8]} color={bronze} />
    <Box at={[-7.2, .99, .5]} size={[.6, .06, .4]} color="#555d47" />
    <FinishBox name="fireplace-wall" at={[-7, 2.3, -5.13]} size={[5, 3.7, .24]} color={stone} surface="stone" />
    <Box at={[-7, 1.4, -4.98]} size={[2.7, .6, .05]} color="#282922" />
    <Box at={[-7, 1.2, -4.94]} size={[2.3, .055, .025]} color="#d69244" glow />
    <Box at={[-7, 3.8, -4.98]} size={[4.5, .025, .04]} color="#ffe3b0" glow />
  </group>;
}

function DiningRoom() {
  return <group name="Dining pavilion interior">
    <FinishBox name="dining-table" at={[9.4, 1.22, .5]} size={[2.5, .16, 4.2]} color="#977251" surface="timber" />
    {[-1, 1].map(s => <Box key={s} at={[9.4, .8, .5 + s * 1.25]} size={[.7, .8, .3]} color={bronze} />)}
    {[-1, 1].flatMap(s => [-1, 0, 1].map(i => <group key={`${s}-${i}`} position={[9.4 + s * 1.8, .5, .5 + i * 1.25]}>
      <Box at={[0, .34, 0]} size={[.65, .15, .7]} color="#bcb9a1" />
      <Box at={[s * .27, .7, 0]} size={[.12, .7, .7]} color="#bab79f" />
      {[-1, 1].map(t => <Box key={t} at={[t * .23, .15, 0]} size={[.055, .3, .55]} color={teak} />)}
    </group>))}
    {[-1, 0, 1].map(i => <group key={i} position={[9.4, 3.2, .5 + i * 1.2]}>
      <Box at={[0, .5, 0]} size={[.018, 1, .018]} />
      <mesh><sphereGeometry args={[.26, 24, 16]} /><meshStandardMaterial color="#e7bd7a" emissive="#ffd08a" emissiveIntensity={.45} /></mesh>
    </group>)}
    <FinishBox name="dining-sideboard" at={[12.45, 1, -3.8]} size={[.65, 1.1, 4]} color={teak} surface="timber" />
  </group>;
}

function UpperSuite() {
  return <group name="Cantilevered master suite">
    <FinishBox name="upper-floor" at={[-7.6, 4.75, -1.1]} size={[13.5, .32, 9.9]} />
    <FinishBox name="suite-back-sill" at={[-7.6, 5.65, -5.85]} size={[12.7, 1.45, .22]} color={ivory} surface="render" />
    <FinishBox name="suite-back-header" at={[-7.6, 7.98, -5.85]} size={[12.7, .85, .22]} color={ivory} surface="render" />
    <Glazing at={[-7.6, 6.96, -5.85]} width={12.7} height={1.17} panels={6} />
    <FinishBox name="suite-left" at={[-13.85, 6.6, -1.7]} size={[.24, 3.6, 8.3]} color={ivory} surface="render" />
    <Glazing at={[-7.4, 6.62, 2.2]} width={12.5} height={3.34} panels={6} />
    <Glazing at={[-1.13, 6.62, -1.75]} width={7.9} height={3.34} side panels={4} />
    <Roof at={[-7.5, 8.53, -1.3]} size={[14.7, .3, 11.3]} />
    <Slats at={[-13.6, 6.6, 2.55]} count={12} spacing={.23} size={[.09, 3.6, .35]} />
    <FinishBox name="suite-headboard" at={[-7.9, 6.3, -4.9]} size={[4.7, 2.7, .15]} color={teak} surface="timber" />
    <Box at={[-7.9, 5.17, -2.9]} size={[3.6, .4, 3.5]} color={teak} />
    <Box at={[-7.9, 5.5, -2.9]} size={[3.5, .32, 3.4]} color="#f2eddf" />
    <Box at={[-7.9, 5.69, -2.15]} size={[3.52, .08, 1.7]} color="#9d9e83" />
    <Box at={[-7.9, 5.8, -4.15]} size={[3.1, .25, .7]} color="#e9e2d3" />
    <Sofa at={[-3.2, 4.94, -.2]} width={2.7} />
    {/* Continuous balcony wraps the suite with almost invisible glass. */}
    <Glazing at={[-7.1, 5.49, 3.72]} width={13.6} height={1.12} railing panels={1} />
    <Glazing at={[-.46, 5.49, 2.65]} width={2.1} height={1.12} railing side />
    <Box at={[-7, 4.57, 3.7]} size={[13.1, .025, .035]} color="#ffe0a1" glow />
  </group>;
}

function Entrance() {
  return <group name="Double-height stone arrival portal">
    <FinishBox name="entry-tower" at={[2.2, 4.85, -5.05]} size={[4.6, 8.8, .35]} color={stone} surface="stone" />
    <FinishBox name="entry-blade-left" at={[-.12, 4.87, 3.8]} size={[.45, 8.85, 1.5]} color={stone} surface="stone" />
    <FinishBox name="entry-blade-right" at={[4.53, 4.87, 3.8]} size={[.45, 8.85, 1.5]} color={stone} surface="stone" />
    <Slats at={[4.762, .85, 3.8]} count={14} spacing={.6} size={[.012, .012, 1.48]} axis="y" color="#aca18a" />
    <Slats at={[-.352, .85, 3.8]} count={14} spacing={.6} size={[.012, .012, 1.48]} axis="y" color="#aca18a" />
    <Slats at={[2.2, .85, -5.228]} count={14} spacing={.6} size={[4.59, .012, .012]} axis="y" color="#aca18a" />
    <FinishBox name="entry-lintel" at={[2.2, 9.13, -.3]} size={[5.1, .35, 9.8]} color={stone} surface="stone" />
    <FinishBox name="atrium-east-rear-pier" at={[4.53, 4.87, -4.72]} size={[.45, 8.85, 1]} color={stone} surface="stone" />
    <FinishBox name="atrium-west-rear-pier" at={[-.12, 4.87, -4.72]} size={[.45, 8.85, 1]} color={stone} surface="stone" />
    {Array.from({ length: 22 }, (_, i) => <Box key={i} at={[1.1, .65 + i * .194, 2.3 - i * .31]} size={[1.55, .1, .32]} color="#a18a67" />)}
    {[0, 1, 2, 3, 4].map(i => <group key={i} position={[2.9 + Math.sin(i * 2) * .55, 6.6 + Math.cos(i) * .7, -.4 + Math.cos(i * 2) * .6]}>
      <Box at={[0, 1.3, 0]} size={[.012, 2.6, .012]} />
      <mesh><sphereGeometry args={[.12 + i * .025, 20, 12]} /><meshStandardMaterial color="#d8bc85" emissive="#ffd694" emissiveIntensity={.7} roughness={.3} /></mesh>
    </group>)}
    <FinishBox name="atrium-floor" at={[2.2, .28, -.3]} size={[4.2, .35, 9.5]} />
    <Glazing at={[4.53, 4.8, -.9]} width={7.6} height={8.3} panels={4} side />
    <Glazing at={[-.12, 6.65, -.9]} width={7.6} height={3.5} panels={4} side />
    <Glazing at={[.47, 2.5, 4.1]} width={.65} height={4.1} panels={1} />
    <Glazing at={[3.94, 2.5, 4.1]} width={.65} height={4.1} panels={1} />
    <FinishBox name="pivot-door" at={[2.2, 2.5, 4.1]} size={[2.65, 4.1, .22]} color="#6c4b32" surface="timber" />
    <Slats at={[.93, 2.5, 4.23]} count={16} spacing={.17} size={[.035, 4, .045]} color="#987552" />
    <Box at={[3.12, 2.5, 4.3]} size={[.055, 1.5, .065]} color="#c5ac78" />
    <Glazing at={[2.2, 6.75, 4.12]} width={4.15} height={3.7} panels={2} />
    <Roof at={[2.2, 4.9, 3.6]} size={[6.7, .22, 4.8]} />
    {[-1, 1].map(s => <Box key={s} at={[2.2 + s * 2.05, 3.9, 4.53]} size={[.035, 6.8, .03]} color="#ffdb99" glow />)}
    {[0, 1, 2].map(i => <FinishBox key={i} name={`entry-step-${i}`} at={[2.2, .1 + i * .12, 6.1 - i * .62]} size={[5.2 - i * .3, .2, .7]} color={ivory} surface="paving" />)}
  </group>;
}

function GardenStair() {
  return <group name="Garden stair to the sky terrace">
    {Array.from({ length: 24 }, (_, i) => <FinishBox key={i} name={`sky-stair-${i}`} at={[5.65 + i * .36, .56 + i * .18, -8.5]} size={[.38, .18, 1.5]} color={ivory} />)}
    <FinishBox name="sky-stair-top-landing" at={[14.3, 4.7, -7.7]} size={[1.6, .22, 3.1]} />
    <Box at={[9.9, 2.93, -9.25]} size={[9.5, .055, .055]} rotation={[0, 0, .464]} />
    {[0, 5, 11, 17, 23].map(i => <Box key={i} at={[5.65 + i * .36, 1.06 + i * .18, -9.25]} size={[.045, 1, .045]} />)}
  </group>;
}

export const TropicalVilla = memo(function TropicalVilla() {
  return <group name="Villa Solana · fixed architectural composition">
    <FinishBox name="salon-plinth" at={[-7.4, .24, -.5]} size={[14.4, .46, 11.8]} />
    <Glazing at={[-7.3, 2.5, -5.5]} width={13.8} height={4} panels={6} />
    <FinishBox name="salon-back-pier" at={[-13.9, 2.5, -5.5]} size={[.6, 4.1, .3]} surface="render" />
    <FinishBox name="salon-west-blade" at={[-14.25, 2.55, -.6]} size={[.34, 4.2, 10.3]} color={stone} surface="stone" />
    <Glazing at={[-7.4, 2.5, 3.2]} width={13.4} height={4} panels={6} />
    <Glazing at={[-.68, 2.5, -.9]} width={8.2} height={4} side panels={4} />
    <LivingRoom />
    <UpperSuite />
    <Entrance />
    <FinishBox name="dining-plinth" at={[9.2, .24, -.1]} size={[9.4, .46, 13.5]} />
    <Glazing at={[9.2, 2.45, -6.55]} width={8.6} height={3.9} panels={4} />
    <FinishBox name="dining-rear-pier" at={[13.55, 2.45, -6.55]} size={[.4, 4, .3]} surface="render" />
    <FinishBox name="dining-east-blade" at={[13.65, 2.45, -4.7]} size={[.35, 4, 3.6]} color={stone} surface="stone" />
    <Glazing at={[9.2, 2.47, 4.55]} width={8.7} height={3.9} panels={4} />
    <Glazing at={[13.65, 2.47, .8]} width={7.4} height={3.9} side panels={4} />
    <Roof at={[9.5, 4.63, -.2]} size={[11, .27, 14.8]} />
    <DiningRoom />
    <GardenStair />
    {/* Offset rooftop belvedere, reached by an exterior stair on the garden side. */}
    <FinishBox name="belvedere-core" at={[7.6, 6.2, -4.5]} size={[4, 2.8, 3.7]} surface="render" />
    <Slats at={[9.72, 6.25, -5.7]} count={16} spacing={.23} size={[.14, 2.9, .07]} axis="z" />
    <Roof at={[9.3, 7.85, -3.7]} size={[8.1, .22, 6.5]} />
    <Glazing at={[10.4, 5.35, 5.65]} width={8.6} height={1.1} railing />
    <Glazing at={[14.35, 5.35, 1.65]} width={7.7} height={1.1} railing side />
    <Sofa at={[10.4, 4.81, 2.35]} width={3.6} />
    <FinishBox name="roof-table" at={[10.4, 5.18, 3.8]} size={[2, .18, .85]} color={stone} surface="stone" />
    {/* A fine, open timber pergola projects beyond the dining pavilion. */}
    <Box at={[9.5, 4.36, 8]} size={[10.9, .23, .22]} />
    {[4.2, 14.75].map(x => <Box key={x} at={[x, 2.35, 8]} size={[.13, 4.1, .13]} />)}
    <Slats at={[4.2, 4.4, 6.6]} count={39} spacing={.277} size={[.085, .19, 3.1]} />
    <Sofa at={[10.6, .48, 6.6]} width={3.5} />
    <Sofa at={[13.4, .48, 6.35]} rotation={-Math.PI / 2} width={2.5} />
    <FinishBox name="outdoor-table" at={[10.6, .85, 8]} size={[2, .18, 1]} color={stone} surface="stone" />
    <Box at={[-8, 4.5, 3.23]} size={[10.5, .025, .025]} color="#ffdfa3" glow />
    <Box at={[9.2, 4.42, 4.6]} size={[8, .025, .025]} color="#ffdfa3" glow />
  </group>;
});
