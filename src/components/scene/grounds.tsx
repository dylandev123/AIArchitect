"use client";

import { memo } from "react";
import * as THREE from "three";
import { Vegetation } from "@/components/workspace/viewport/scenery/vegetation";
import { WaterSurface } from "@/components/workspace/viewport/house/WaterSurface";
import { TropicalPalm } from "./tropical-palm";
import { Box, FinishBox, Slats, type Vector } from "./architecture";

const foliage = new THREE.Color("#7e8977");
const palms: [number, number, number][] = [[-22, -6, 11], [-23, 3, 10], [-25, 18, 9], [19, -7, 12], [24, 1, 10], [25, 20, 10], [-10, -12, 11], [7, -13, 12]];

export function Planter({ at, width = 3, depth = 1.3 }: { at: Vector; width?: number; depth?: number }) {
  return <group position={at} name="Raised tropical planting bed">
    <FinishBox name={`planter-${at.join()}`} at={[0, .28, 0]} size={[width, .55, depth]} surface="concrete" color="#b3ae94" />
    <Box at={[0, .56, 0]} size={[width - .14, .03, depth - .14]} color="#514b37" />
    {Array.from({ length: Math.ceil(width / .65) }, (_, i) => <group key={i} position={[-width / 2 + .4 + i * .65, .55, 0]}>
      <Vegetation kind="shrub" variant={i % 2} height={.7 + i % 3 * .13} tint={foliage} />
    </group>)}
  </group>;
}

export function SunLounger({ at, rotation = 0 }: { at: Vector; rotation?: number }) {
  return <group position={at} rotation={[0, rotation, 0]} name="Teak and linen chaise longue">
    <Box at={[0, .22, 0]} size={[.88, .15, 2.25]} color="#795c40" />
    <Slats at={[-.4, .32, .2]} count={9} spacing={.1} size={[.065, .06, 1.7]} color="#9b7e5a" />
    <Box at={[0, .42, .32]} size={[.77, .14, 1.45]} color="#e4dbc4" />
    <Box at={[0, .7, -.7]} size={[.78, .15, .85]} color="#e4dbc4" rotation={[-.58, 0, 0]} />
    <Box at={[0, .5, .77]} size={[.79, .045, .42]} color="#a6ad9a" />
    {[-1, 1].map(s => <Box key={s} at={[s * .32, .11, 0]} size={[.07, .22, 1.7]} color="#5a4b37" />)}
  </group>;
}

export function Parasol({ at }: { at: Vector }) {
  return <group position={at} name="Linen pool parasol">
    <Box at={[0, .1, 0]} size={[.7, .15, .7]} color="#b3afa0" />
    <Box at={[0, 1.55, 0]} size={[.045, 3, .045]} color="#716149" />
    <mesh position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[2.15, .46, 4, 1, true]} /><meshStandardMaterial color="#e9e0c7" roughness={.9} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 2.77, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <circleGeometry args={[2.15, 4]} /><meshStandardMaterial color="#c7bda4" side={THREE.DoubleSide} />
    </mesh>
  </group>;
}

export function Pool({ width = 17, depth = 6.2 }: { width?: number; depth?: number }) {
  const west = -2 - width / 2, east = -2 + width / 2, north = 12.4 - depth / 2, south = 12.4 + depth / 2;
  return <group name="Seventeen metre swimming pool with sun shelf">
    <FinishBox name="pool-basin" at={[-2, -.2, 12.4]} size={[width, .3, depth]} color="#429e9b" />
    <WaterSurface position={[-2, .17, 12.4]} width={width} depth={depth} color="#238e94" rippleSize={3.8} rippleStrength={.35} />
    <FinishBox name="pool-north-coping" at={[-2, .24, north - .16]} size={[width + 1, .18, .34]} color="#e6deca" />
    <FinishBox name="pool-south-infinity-edge" at={[-2, .21, south + .08]} size={[width + 1, .12, .17]} color="#b0c7b6" />
    <FinishBox name="pool-west-coping" at={[west - .18, .24, 12.4]} size={[.36, .18, depth]} color="#e6deca" />
    <FinishBox name="pool-east-coping" at={[east + .18, .24, 12.4]} size={[.36, .18, depth]} color="#e6deca" />
    <FinishBox name="pool-sun-shelf" at={[west + 1.6, .09, 12.4]} size={[2.6, .12, depth - .2]} color="#b8d6bb" />
    {[0, 1, 2].map(i => <FinishBox key={i} name={`pool-underwater-step-${i}`} at={[west + 3.6 + i * .42, -.02 - i * .07, north + .9]} size={[.42, .1, 1.75]} color="#a6cdbc" />)}
    <FinishBox name="infinity-spill-wall" at={[-2, -.16, south + .23]} size={[width + 1, .65, .14]} color="#486b64" surface="stone" />
    <WaterSurface position={[-2, -.41, south + .58]} width={width + 1.1} depth={.55} color="#238e94" rippleStrength={.3} />
    <Box at={[-2, -.3, south + .32]} size={[width + .8, .25, .025]} color="#67a8a0" />
  </group>;
}

export const TropicalGrounds = memo(function TropicalGrounds() {
  return <group name="Terraces, pool and tropical garden">
    <FinishBox name="landscape" at={[0, -.61, 0]} size={[500, .2, 500]} color="#738163" surface="grass" />
    <FinishBox name="estate-plinth" at={[0, -.6, 2.8]} size={[33, .3, 31]} color="#ada38a" surface="stone" />
    {/* Paving surrounds a true pool opening, leaving the water and basin visible. */}
    <FinishBox name="front-terrace" at={[0, .15, 6.6]} size={[31, .3, 4.8]} color="#d3c9b2" surface="paving" />
    <FinishBox name="west-sun-deck" at={[-13.1, .12, 12.5]} size={[4.5, .25, 7]} color="#b39b77" surface="timber" />
    <FinishBox name="east-sun-deck" at={[11.2, .12, 12.5]} size={[8.7, .25, 7]} color="#d3c9b2" surface="paving" />
    <FinishBox name="end-deck" at={[0, .08, 17.1]} size={[31, .18, 1.7]} color="#d3c9b2" surface="paving" />
    <FinishBox name="west-passage" at={[-15, .12, -1]} size={[1.4, .25, 12]} color="#d3c9b2" surface="paving" />
    <FinishBox name="east-passage" at={[15, .12, -1]} size={[1.4, .25, 12]} color="#d3c9b2" surface="paving" />
    <Slats at={[-15, .304, 6.65]} count={13} spacing={2.5} size={[.014, .008, 4.55]} color="#b4ae9d" />
    <Slats at={[0, .304, 5.4]} count={2} spacing={2.5} size={[30.5, .008, .014]} axis="z" color="#b4ae9d" />
    <Slats at={[8.8, .25, 12.5]} count={3} spacing={2.5} size={[.014, .008, 6.5]} color="#b4ae9d" />
    <Pool />
    {[8.2, 10, 12.4, 14.2].map(x => <SunLounger key={x} at={[x, .25, 12.3]} />)}
    <Parasol at={[9.1, .25, 11.4]} /><Parasol at={[13.3, .25, 11.4]} />
    <FinishBox name="lounger-table-one" at={[9.1, .65, 13.5]} size={[.55, .5, .55]} color="#a9a08a" surface="stone" />
    <FinishBox name="lounger-table-two" at={[13.3, .65, 13.5]} size={[.55, .5, .55]} color="#a9a08a" surface="stone" />
    <Planter at={[-12.4, .28, 5.9]} width={4.7} depth={1.5} />
    <Planter at={[15.5, 0, 2]} width={1.3} depth={7} />
    <Planter at={[-6.5, 4.92, 3.1]} width={6.2} depth={.65} />
    <Planter at={[6.2, 4.81, .1]} width={1} depth={5.1} />
    <Planter at={[-13, 0, 17.2]} width={5} depth={1.5} />
    <Planter at={[10.8, 0, 17.2]} width={9} depth={1.5} />
    {/* Arrival path runs along the west garden, separate from the pool deck. */}
    {Array.from({ length: 9 }, (_, i) => <FinishBox key={i} name={`garden-path-${i}`} at={[-18.2, -.35, 13 - i * 1.5]} size={[2.5, .14, 1.05]} color="#cfc7af" surface="paving" />)}
    {palms.map(([x, z, height], i) => <group key={i} position={[x, -.5, z]} rotation={[0, i * 1.8, 0]}>
      <TropicalPalm variant={i % 2} height={height} />
    </group>)}
    {Array.from({ length: 28 }, (_, i) => <group key={i} position={[-23 + i * 1.7, -.5, -10.8 - Math.sin(i * 2) * 1.2]}>
      <Vegetation kind="shrub" variant={i % 2} height={1.2 + (i % 4) * .25} tint={foliage} />
    </group>)}
    {[-1, 1].map(s => <group key={s}>
      {Array.from({ length: 12 }, (_, i) => <group key={i} position={[s * (17.2 + Math.sin(i) * .6), -.5, -6 + i * 2.1]}>
        <Vegetation kind={i % 3 === 0 ? "shrub-flowering" : "shrub"} variant={i % 2} height={.8 + (i % 3) * .3} tint={foliage} />
      </group>)}
    </group>)}
    {[-14, -6, 3, 14].map(x => <group key={x}>
      <Box at={[x, .06, 18.6]} size={[.13, 1.1, .13]} color="#454c3e" />
      <Box at={[x, .48, 18.6]} size={[.14, .08, .14]} color="#ffdf9c" glow />
    </group>)}
    {/* A loose distant palm grove stays below the villa roofline. */}
    {Array.from({ length: 15 }, (_, i) => <group key={i} position={[-45 + i * 6.5, -.5, -24 - Math.sin(i * 2) * 6]}>
      <TropicalPalm variant={i % 2} height={7 + i % 3 * 1.2} />
    </group>)}
  </group>;
});
