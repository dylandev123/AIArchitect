"use client";

import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import type { BoxPrimitive, TriMeshPrimitive } from '@/lib/house/types';
import { composeVilla, FINISHES, type VillaBay, type VillaConfig } from '@/lib/villa/design';
import { Box, FinishBox, Glazing, Roof, Slats, Sofa, type Vector } from './architecture';

/** Retain Solana's finishes; add the existing real stone PBR set for masonry styles. */
export function Wall({ name, at, size, config }: { name: string; at: Vector; size: Vector; config: VillaConfig }) {
  const finish = FINISHES[config.exterior];
  const primitive = useMemo<BoxPrimitive>(() => ({ kind: 'box', id: `kit-${name}`, label: name, category: 'landscape',
    position: at, size, rotation: [0, 0, 0], color: finish.color, surface: finish.surface, bevel: .018, roughness: .85 }), [name, at, size, finish]);
  return <PrimitiveMesh primitive={primitive} surface={finish.surface} readOnly />;
}

function Surface({ id, vertices, color, surface }: { id: string; vertices: number[]; color: string; surface: BoxPrimitive['surface'] }) {
  const primitive = useMemo<TriMeshPrimitive>(() => ({ kind: 'triMesh', id, label: id, category: 'landscape', vertices, color, surface, roughness: .82 }), [id, vertices, color, surface]);
  return <PrimitiveMesh primitive={primitive} surface={surface} readOnly />;
}

/** Extruded concave spandrel: the arch is empty space all the way through the masonry. */
export function Arch({ width, height, config }: { width: number; height: number; config: VillaConfig }) {
  const vertices = useMemo(() => {
    const r = (width - .48) / 2, spring = height - r - .34;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(-width / 2, height); shape.lineTo(width / 2, height);
    shape.lineTo(width / 2, 0); shape.lineTo(r, 0); shape.lineTo(r, spring);
    shape.absarc(0, spring, r, 0, Math.PI, false); shape.lineTo(-r, 0); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: .34, bevelEnabled: false, curveSegments: 28 });
    g.translate(0, 0, -.17);
    const v = Array.from(g.attributes.position.array); g.dispose(); return v;
  }, [width, height]);
  const f = FINISHES[config.exterior];
  return <group name="Open semicircular masonry arch">
    <Surface id="arcade-spandrel" vertices={vertices} color={f.color} surface={f.surface} />
    {[-1, 1].map(s => <FinishBox key={s} name="arch-plinth" at={[s * (width / 2 - .12), .12, 0]} size={[.36, .24, .5]} color="#d5c7ab" />)}
  </group>;
}

/** Closed hip or gable roof with coordinated eaves, soffit, fascia and textured slope planes. */
export function PitchedRoof({ width, depth, config, low = false, eave, roofRise }: { width: number; depth: number; config: VillaConfig; low?: boolean; eave?:number;roofRise?:number }) {
  const rotate = depth > width;
  const w = Math.max(width, depth), d = Math.min(width, depth);
  const overhang = eave ?? (config.style === 'caribbean' ? 1.05 : .55);
  const W = w + overhang * 2, D = d + overhang * 2;
  const rise = roofRise ?? D * (low ? .13 : config.style === 'caribbean' ? .26 : .22);
  const hip = config.roof === 'hip', ridge = hip ? (W - D) / 2 : W / 2;
  const geometry = useMemo(() => {
    const a = [-W / 2, 0, -D / 2], b = [W / 2, 0, -D / 2], c = [W / 2, 0, D / 2], d = [-W / 2, 0, D / 2];
    const l = [-ridge, rise, 0], r = [ridge, rise, 0];
    const slopes = [...a, ...l, ...r, ...a, ...r, ...b, ...d, ...c, ...r, ...d, ...r, ...l];
    const ends = [...a, ...d, ...l, ...b, ...r, ...c];
    return { slopes: hip ? [...slopes, ...ends] : slopes, ends };
  }, [W, D, ridge, rise, hip]);
  const tropical = config.style === 'caribbean';
  return <group rotation={[0, rotate ? Math.PI / 2 : 0, 0]} name={hip ? 'Hipped pavilion roof' : 'Gabled tiled roof'}>
    <Box at={[0, -.045, 0]} size={[W, .12, D]} color={tropical ? '#e3d6bb' : '#856d4b'} />
    <Surface id="pitched-roof-slopes" vertices={geometry.slopes} color={tropical ? '#657b72' : '#ae6343'} surface={tropical ? 'metal' : 'terracotta'} />
    {!hip && <Surface id="gable-end-infill" vertices={geometry.ends} color={FINISHES[config.exterior].color} surface={FINISHES[config.exterior].surface} />}
    <Box at={[0, rise + .04, 0]} size={[ridge * 2 + .16, .14, .22]} color={tropical ? '#71887c' : '#b27650'} />
    {[-1, 1].map(s => <Box key={s} at={[0, .01, s * D / 2]} size={[W + .1, .17, .15]} color={tropical ? '#e4ddc9' : '#b68c66'} />)}
  </group>;
}

export function Facade({ width, height, config, entrance = false, back = false }: { width: number; height: number; config: VillaConfig; entrance?: boolean; back?: boolean }) {
  const modern = config.style === 'modern', tropical = config.style === 'caribbean';
  const count = Math.max(1, Math.round(width / (modern ? 4.5 : 3.5))), bay = width / count;
  const sill = modern ? (back ? .95 : .06) : tropical ? .12 : .8;
  const head = modern ? (back ? .6 : .22) : .58, opening = height - sill - head;
  return <group name="Pierced facade with coordinated window bays">
    <Wall name="facade-header" at={[0, height - head / 2, 0]} size={[width, head, .28]} config={config} />
    {sill > .1 && !entrance && <Wall name="facade-sill" at={[0, sill / 2, 0]} size={[width, sill, .28]} config={config} />}
    {Array.from({ length: count + 1 }, (_, i) => <Wall key={i} name="facade-pier" at={[-width / 2 + i * bay, height / 2, 0]} size={[modern ? .24 : tropical ? .6 : 1.25, height, .3]} config={config} />)}
    {Array.from({ length: count }, (_, i) => {
      const x = -width / 2 + (i + .5) * bay, w = bay - (modern ? .3 : tropical ? .65 : 1.3), door = entrance && i === Math.floor(count / 2);
      return <group key={i}>
        {entrance && !door && sill > .1 && <Wall name="entry-side-window-sill" at={[x, sill / 2, 0]} size={[bay, sill, .28]} config={config} />}
        <Glazing at={[x, door ? (height - head) / 2 : sill + opening / 2, -.02]} width={w} height={door ? height - head : opening} panels={config.glazing === 'divided' ? 3 : 2} />
        {config.glazing === 'divided' && <Box at={[x, sill + opening * .67, .05]} size={[w, .04, .065]} />}
        {door && <group name="Timber entrance in real wall opening">
          <FinishBox name="entry-door" at={[x, (height - head) / 2, .07]} size={[w * .57, height - head, .13]} surface="timber" color={tropical ? '#63867c' : '#725337'} />
          <Box at={[x + w * .18, 1.3, .16]} size={[.045, .65, .06]} color="#c7ad72" />
        </group>}
        {!modern && !door && [-1, 1].map(s => <group key={s} position={[x + s * (w / 2 + .14), sill + opening / 2, .22]}>
          <Box at={[0, 0, 0]} size={[.24, opening, .1]} color={tropical ? '#668379' : '#655f44'} />
          <Slats at={[0, -opening / 2 + .1, .07]} count={Math.floor(opening / .14)} spacing={.14} axis="y" size={[.23, .045, .08]} color={tropical ? '#8b9e8b' : '#8a8667'} />
        </group>)}
        {!back && !modern && !door && <FinishBox name="window-sill-cap" at={[x, sill, .12]} size={[w + .14, .09, .48]} color="#d6c7ab" />}
      </group>;
    })}
  </group>;
}

/** Shared covered outdoor room. Mediterranean versions use actual masonry arches, tropical versions slender timber posts. */
export function Veranda({ width, depth, height, config }: { width: number; depth: number; height: number; config: VillaConfig }) {
  const arches = config.style === 'spanish' || config.style === 'tuscan';
  const count = Math.max(2, Math.round(width / 3.3)), bay = width / count;
  return <group name={arches ? 'Open arcaded loggia' : 'Shaded timber veranda'}>
    <FinishBox name="veranda-floor" at={[0, -.06, depth / 2]} size={[width + .4, .18, depth + .4]} color="#cbbd9f" surface="paving" />
    <group position={[0, 0, depth]}>
      {arches ? Array.from({ length: count }, (_, i) => <group key={i} position={[-width / 2 + (i + .5) * bay, 0, 0]}><Arch width={bay} height={height} config={config} /></group>) :
        Array.from({ length: count + 1 }, (_, i) => <group key={i} position={[-width / 2 + i * bay, 0, 0]}>
          <Box at={[0, height / 2, 0]} size={[.16, height, .16]} color={config.style === 'caribbean' ? '#dcd5bc' : '#424a3c'} />
          <Box at={[0, height - .32, -.3]} size={[.12, .12, .95]} rotation={[-.6, 0, 0]} color="#8e7454" />
        </group>)}
    </group>
    <Box at={[0, height, depth]} size={[width + .35, .19, .22]} color={arches ? '#b7a285' : '#896c49'} />
    {/* A shallow, continuous lean-to roof meets the facade below its upper-floor sill. */}
    <group position={[0, height + .16, depth / 2]} rotation={[-.09, 0, 0]}>
      <FinishBox name="veranda-soffit" at={[0, -.04, 0]} size={[width + .65, .12, depth + .65]} color="#92704c" surface="timber" />
      <FinishBox name="veranda-cover" at={[0, .06, 0]} size={[width + .75, .1, depth + .75]} color={config.style === 'caribbean' ? '#6a8075' : config.style === 'modern' ? '#d9d4c7' : '#b77551'} surface={arches ? 'terracotta' : config.style === 'caribbean' ? 'metal' : 'render'} />
    </group>
    <Sofa at={[-width * .25, .05, depth * .43]} width={Math.min(2.7, width * .35)} />
    <FinishBox name="veranda-table" at={[-width * .24, .45, depth * .8]} size={[1.35, .17, .65]} color="#b8ab8e" />
  </group>;
}

const FLOOR = 4.05, BASE = .47, WALL = 3.7;
function Bay({ bay, config }: { bay: VillaBay; config: VillaConfig }) {
  const { width: w, depth: d, floors, upperSetback: setback } = bay;
  const modern = config.style === 'modern';
  const rearCount = Math.max(1, Math.round(w / (modern ? 4.5 : 3.5)));
  const rearDoorX = -(-w / 2 + (Math.floor(rearCount / 2) + .5) * w / rearCount);
  return <group position={[bay.x, 0, bay.z]} name={`Connected ${bay.id} bay`}>
    {Array.from({ length: floors }, (_, level) => {
      const upper = level > 0, front = d / 2 - (upper ? setback : 0), localDepth = d - (upper ? setback : 0);
      const y = BASE + level * FLOOR;
      return <group key={level}>
        <FinishBox name={`${bay.id}-floor-${level}`} at={[0, y - .18, 0]} size={[w, .36, d]} color="#d6ccb7" />
        <group position={[0, y, front]}><Facade width={w} height={WALL} config={config} entrance={!upper && bay.id === 'hall'} /></group>
        <group position={[0, y, -d / 2]} rotation={[0, Math.PI, 0]}><Facade width={w} height={WALL} config={config} back entrance={upper} /></group>
        {[-1, 1].map(s => <group key={s} position={[s * w / 2, y, -d / 2 + localDepth / 2]} rotation={[0, s * Math.PI / 2, 0]}>
          {modern && bay.id === 'west' && s === -1 ? <>
            <Wall name="outer-stone-blade" at={[0, WALL / 2, 0]} size={[localDepth, WALL, .3]} config={{ ...config, exterior: 'limestone' }} />
          </> : <Facade width={localDepth} height={WALL} config={config} back />}
        </group>)}
        {modern && <group position={[-w / 2 + .75, y + WALL / 2, front + .18]}>
          <Slats at={[-.6, 0, 0]} count={10} spacing={.14} size={[.065, WALL, .32]} color="#8a6749" />
        </group>}
        <Sofa at={[-w * .19, y + .02, front - 2]} width={Math.min(3.5, w * .55)} />
        <FinishBox name="interior-rug" at={[0, y + .03, 0]} size={[w * .7, .025, d * .55]} color="#bbb39a" surface="render" />
        <FinishBox name="interior-table" at={[0, y + .48, front - 1.3]} size={[1.6, .18, .85]} color="#b3a185" />
        <FinishBox name="interior-cabinet" at={[w * .2, y + .6, -d / 2 + .6]} size={[w * .38, 1.2, .6]} color="#8c6b48" surface="timber" />
        <Box at={[0, y + WALL - .14, front - .22]} size={[w * .8, .026, .03]} color="#ffe1a0" glow />
        {upper && modern && <>
          <Glazing at={[0, y + .55, d / 2 - .08]} width={w - .2} height={1.1} railing />
          {[-1, 1].map(s => <Glazing key={s} at={[s * (w / 2 - .08), y + .55, d / 2 - setback / 2]} width={setback} height={1.1} railing side />)}
        </>}
        {upper && !modern && <group position={[0, y, front]}><Veranda width={w} depth={setback + .4} height={WALL - .25} config={config} />
          <Box at={[0, 1.02, setback + .24]} size={[w - .2, .055, .055]} color="#5a5942" />
          <Slats at={[-w / 2 + .22, .53, setback + .24]} count={Math.floor((w - .4) / .18)} spacing={.18} size={[.025, .96, .025]} color="#5a5942" />
        </group>}
      </group>;
    })}
    <group position={[0, BASE + (floors - 1) * FLOOR + WALL + .14, 0]}>
      {config.roof === 'flat' ? <Roof at={[0, 0, 0]} size={[w + 1.2, .28, d + 1.3]} /> : <PitchedRoof width={w} depth={d} config={config} />}
    </group>
    <group position={[0, BASE, d / 2 + .02]}><Veranda width={w} depth={config.verandaDepth} height={3.35} config={config} /></group>
    {/* Exterior access has a real landing; tread count and pitch derive from the common floor height. */}
    {floors === 2 && <group position={[rearDoorX + 5.75, BASE, -d / 2 - .8]} rotation={[0, -Math.PI / 2, 0]} name="Garden stair to upper landing">
      {Array.from({ length: 23 }, (_, i) => <FinishBox key={i} name="upper-access-step" at={[0, (i + .5) * FLOOR / 23, i * .25]} size={[1.3, FLOOR / 23, .27]} />)}
      <FinishBox name="upper-access-landing" at={[0, FLOOR - .09, 5.75]} size={[1.65, .18, 1.3]} />
      <Box at={[-.65, FLOOR / 2 + .9, 2.85]} size={[.055, .055, 7.1]} rotation={[-Math.atan2(FLOOR, 5.75), 0, 0]} />
    </group>}
  </group>;
}

export const ConfiguredVilla = memo(function ConfiguredVilla({ config }: { config: VillaConfig }) {
  const bays = composeVilla(config);
  return <group name={`${config.style} / ${config.composition}`}>
    {bays.map(b => <Bay key={b.id} bay={b} config={config} />)}
    {config.composition === 'courtyard' && <group name="Open central courtyard">
      <FinishBox name="courtyard-paving" at={[0, .32, 1]} size={[10.9 * config.scale, .25, 7.5 * config.scale]} color="#d7c6a7" surface="paving" />
      <FinishBox name="courtyard-basin" at={[0, .6, .2]} size={[2.6, .5, 2.6]} color="#b7a382" />
      <Box at={[0, .87, .2]} size={[2.25, .04, 2.25]} color="#6a9b8d" />
      <mesh position={[0, 1, .2]}><sphereGeometry args={[.36, 24, 16]} /><meshStandardMaterial color="#c9b899" roughness={.8} /></mesh>
    </group>}
  </group>;
}, (a, b) => {
  const fields = ['style', 'composition', 'scale', 'wingRatio', 'levels', 'exterior', 'roof', 'glazing', 'verandaDepth'] as const;
  return fields.every(k => a.config[k] === b.config[k]);
});
