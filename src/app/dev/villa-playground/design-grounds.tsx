"use client";
import { memo } from 'react';
import * as THREE from 'three';
import type { VillaConfig } from '@/lib/villa/design';
import { composeVilla } from '@/lib/villa/design';
import { Vegetation } from '@/components/workspace/viewport/scenery/vegetation';
import { Box, FinishBox, Slats } from './architecture';
import { Pool, Planter, Parasol, SunLounger } from './grounds';
import { TropicalPalm } from './tropical-palm';

export const DesignGrounds = memo(function DesignGrounds({ config: c }: { config: VillaConfig }) {
  const tropical = c.landscape === 'tropical', tint = new THREE.Color(tropical ? '#7e8977' : '#858965');
  const { width, depth, enabled } = c.pool, west = -2 - width / 2, east = -2 + width / 2;
  const front = Math.max(...composeVilla(c).map(b => b.z + b.depth / 2));
  return <group name="Coordinated garden and pool terraces">
    <FinishBox name="landscape" at={[0, -.61, 0]} size={[500, .2, 500]} color={tropical ? '#738163' : '#86836b'} surface="grass" />
    <FinishBox name="estate-base" at={[0, -.6, 2.8]} size={[35, .3, 32]} color="#ada38a" surface="stone" />
    <FinishBox name="house-terraces" at={[0, .15, front - 1 + c.terraceDepth / 2]} size={[32, .3, c.terraceDepth + 2]} color="#d3c9b2" surface="paving" />
    <FinishBox name="rear-path" at={[0, .06, -11.5]} size={[32, .18, 1.5]} color="#d3c9b2" surface="paving" />
    {[-1, 1].map(s => <FinishBox key={s} name="garden-side-path" at={[s * 15.6, .06, -.7]} size={[1.2, .18, 20]} color="#d3c9b2" surface="paving" />)}
    {enabled ? <>
      <Pool width={width} depth={depth} />
      <FinishBox name="pool-approach" at={[0, .12, (front + c.terraceDepth + 12.4 - depth / 2) / 2]} size={[32, .25, Math.max(.2, 12.4 - depth / 2 - front - c.terraceDepth)]} color="#d3c9b2" surface="paving" />
      <FinishBox name="west-deck" at={[(-16 + west - .4) / 2, .12, 12.4]} size={[west + 15.6, .25, depth + 1.2]} color="#b39b77" surface="timber" />
      <FinishBox name="east-deck" at={[(16 + east + .4) / 2, .12, 12.4]} size={[15.6 - east, .25, depth + 1.2]} color="#d3c9b2" surface="paving" />
      <FinishBox name="pool-end-deck" at={[0, .08, 12.4 + depth / 2 + 1.2]} size={[32, .18, 1.6]} color="#d3c9b2" surface="paving" />
    </> : <FinishBox name="garden-lounge-deck" at={[0, .1, 12.4]} size={[32, .22, 8]} color="#d3c9b2" surface="paving" />}
    {[8.8, 10.6, 12.8, 14.6].map(x => <SunLounger key={x} at={[x, .25, 12.3]} />)}
    <Parasol at={[9.7, .25, 11.4]} /><Parasol at={[13.7, .25, 11.4]} />
    <Planter at={[-15.2, .24, 7.1]} width={1.5} depth={1.3} />
    <Planter at={[-13, 0, 17.2]} width={5} depth={1.5} />
    <Planter at={[10.8, 0, 17.2]} width={9} depth={1.5} />
    <Slats at={[-15, .304, front + .9]} count={13} spacing={2.5} size={[.014, .008, 1.5]} color="#b4ae9d" />
    {Array.from({ length: 9 }, (_, i) => <FinishBox key={i} name="arrival-garden-path" at={[-18.2, -.35, 13 - i * 1.5]} size={[2.5, .14, 1.05]} color="#cfc7af" surface="paving" />)}
    {[-1, 1].flatMap(s => [0, 1, 2, 3, 4].map((i) => <group key={`${s}-${i}`} position={[s * (20 + i % 2 * 2), -.5, -8 + i * 6]}>
      {tropical ? <TropicalPalm variant={i % 2} height={8 + i % 3} /> : <Vegetation kind={i % 3 === 0 ? "oak" : "cypress"} variant={0} height={i % 3 === 0 ? 5.5 : 8} tint={tint} />}
    </group>))}
    {Array.from({ length: 28 }, (_, i) => <group key={i} position={[-23 + i * 1.7, -.5, -13 - Math.sin(i * 2) * 1.2]}>
      <Vegetation kind="shrub" variant={i % 2} height={1.2 + i % 4 * .25} tint={tint} />
    </group>)}
    {[-1, 1].flatMap(s => Array.from({ length: 11 }, (_, i) => <group key={`${s}-${i}`} position={[s * (17.3 + Math.sin(i) * .6), -.5, -6 + i * 2.1]}>
      <Vegetation kind={i % 3 === 0 ? 'shrub-flowering' : 'shrub'} variant={i % 2} height={.8 + i % 3 * .3} tint={tint} />
    </group>))}
    {tropical && Array.from({ length: 12 }, (_, i) => <group key={i} position={[-40 + i * 7, -.5, -26 - Math.sin(i * 2) * 6]}><TropicalPalm variant={i % 2} height={7 + i % 3} /></group>)}
    {[-14, -6, 3, 14].map(x => <group key={x}><Box at={[x, .06, 18.6]} size={[.13, 1.1, .13]} color="#454c3e" /><Box at={[x, .48, 18.6]} size={[.14, .08, .14]} color="#ffdf9c" glow /></group>)}
  </group>;
}, (a, b) => {
  const fields = ['composition', 'scale', 'wingRatio', 'terraceDepth', 'landscape'] as const;
  return fields.every(k => a.config[k] === b.config[k]) && JSON.stringify(a.config.pool) === JSON.stringify(b.config.pool);
});
