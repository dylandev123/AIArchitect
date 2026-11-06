'use client';
import { CurvedPavilion } from './curved-pavilion';
import { scenePavilionPlacement } from '@/lib/villa/scene/model';
import { WaterSurface } from '@/components/workspace/viewport/house/WaterSurface';
import { buildSceneRoof } from '@/lib/villa/scene/roofs';
import {componentFinish} from '@/lib/villa/scene/appearance';
import {SiteAsset} from './SiteAsset';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { memo, useMemo, useEffect } from 'react';
import { buildProfileGeometry } from '@/lib/villa/scene/profileGeometry';
import type { ArchitecturalScene, SceneElement } from '@/lib/villa/scene/model';
import { Box, FinishBox, Glazing, Roof, Slats, Sofa } from './architecture';
const finishes = { ivory: { color: '#e4dfd1', surface: 'render' }, limestone: { color: '#ccbb9c', surface: 'stone' }, timber: { color: '#795239', surface: 'timber' }, bronze: { color: '#343932', surface: 'metal' }, sage: { color: '#719a89', surface: 'render' } } as const;
function ProfilePart({element:e,color}:{element:SceneElement;color:string}) {
    const geometry=useMemo(()=>buildProfileGeometry(e.geometry!,e.size),[e.geometry,e.size]);
    useEffect(()=>()=>geometry.dispose(),[geometry]);
    return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={e.kind==='glazing'?.12:.7} metalness={e.material==='bronze'?.6:0} transparent={e.kind==='glazing'} opacity={e.kind==='glazing'?.28:1} /></mesh>;
}
const Element = memo(function Element({ element: e, children, onSelect }: {
    element: SceneElement;
    children: React.ReactNode;
    onSelect: (id: string) => void;
}) {
    const [w, h, d] = e.size, f = finishes[e.material], physical = componentFinish(e.appearance);
    const solid = (name: string, at: [
        number,
        number,
        number
    ], size: [
        number,
        number,
        number
    ]) => <FinishBox key={name} name={`${e.id}-${name}`} at={at} size={size} {...f} color={e.color ?? f.color} physical={physical}/>;
    let content;
    if (e.siteAsset) content = <SiteAsset element={e}/>;
    else if (e.geometry) content = <ProfilePart element={e} color={e.color ?? f.color}/>;
    else if (e.kind === 'pavilion')
        content = <group position={[0, -.47, 0]}><CurvedPavilion placement={scenePavilionPlacement(e)} /></group>;
    else if (e.kind === 'water')
        content = <WaterSurface position={[0, 0, 0]} width={w} depth={d} color={e.color??'#238e94'} rippleSize={3.8} rippleStrength={.35}/>;
    else if (e.kind === 'entrance' && e.appearance === 'glazed-door')
        // Keep the door element, its selection/semantic identity and its unglazed wall passage.
        content = <Glazing at={[0, 0, 0]} width={w} height={h} panels={2} frameColor={e.color ?? f.color}/>;
    else if (e.kind === 'entrance' && e.appearance === 'timber-door')
        content = <>{solid('door', [0, 0, 0], e.size)}{[-1, 1].flatMap(face => [-1, 1].flatMap(x => [-1, 1].map(y => <FinishBox key={`${face}:${x}:${y}`} name={`${e.id}-panel-${face}-${x}-${y}`} at={[x * w * .23, y * h * .23, face * (d / 2 + .015)]} size={[w * .38, h * .38, .03]} color={e.color ?? f.color} physical={physical}/>)))}</>;
    else if (e.kind === 'glazing' || e.kind === 'balcony')
        content = <Glazing at={[0, 0, 0]} width={w} height={h} panels={e.panels} frameColor={e.color ?? (e.material === 'ivory' ? undefined : f.color)} railing={e.kind === 'balcony'}/>;
    else if (e.kind === 'roof' && e.roofForm && e.roofForm !== 'flat') {
        const roofFinish = {color: e.color ?? f.color, roughness: physical?.roughness ?? .7, metalness: physical?.metalness ?? (e.material === 'bronze' ? .6 : 0)};
        const wallPhysical = componentFinish(e.roofWallFinish?.appearance);
        const wallFinish = e.roofWallFinish && wallPhysical ? {color: e.roofWallFinish.color, roughness: wallPhysical.roughness, metalness: wallPhysical.metalness} : roofFinish;
        content = buildSceneRoof(e, roofFinish, wallFinish).map(p => {
            const finish = e.roofWallFinish && p.id.includes('-gable-') ? wallPhysical : physical;
            return <PrimitiveMesh key={p.id} primitive={p} surface={finish?.surface} proceduralDetail={finish?.procedural} readOnly/>;
        });
    }
    else if (e.kind === 'roof')
        content = e.material === 'ivory' ? <Roof at={[0, 0, 0]} size={e.size} color={e.color}/> : <>{solid('roof', [0, 0, 0], e.size)}<Box at={[0, -h / 2 - .045, 0]} size={[Math.max(.01, w - .16), .07, Math.max(.01, d - .16)]} color="#795239"/></>;
    else if (e.kind === 'sofa')
        content = <Sofa at={[0, 0, 0]} width={w}/>;
    else if (e.kind === 'screen')
        content = <Slats at={[-w / 2, 0, 0]} count={e.panels} spacing={w / (e.panels - 1 || 1)} size={[.07, h, d]} color={e.color ?? f.color}/>;
    else if (e.opening) {
        const o = e.opening, left = o.x - o.width / 2, right = o.x + o.width / 2, head = h - o.sill - o.height;
        content = <>{left > -w / 2 && solid('left', [(-w / 2 + left) / 2, 0, 0], [left + w / 2, h, d])}{right < w / 2 && solid('right', [(right + w / 2) / 2, 0, 0], [w / 2 - right, h, d])}{o.sill > 0 && solid('sill', [o.x, -h / 2 + o.sill / 2, 0], [o.width, o.sill, d])}{head > 0 && solid('head', [o.x, h / 2 - head / 2, 0], [o.width, head, d])}{o.glazed && <Glazing at={[o.x, -h / 2 + o.sill + o.height / 2, 0]} width={o.width} height={o.height} panels={e.panels}/>}</>;
    }
    else
        content = solid('body', [0, 0, 0], e.size);
    const handles = e.appearance === 'glazed-door' || e.appearance === 'timber-door' ? [-1, 1] : [1];
    return <group name={`operation:${e.id}`} position={e.at} rotation={[0, e.rotation, 0]} onClick={event => { event.stopPropagation(); onSelect(e.id); }}>{content}{e.kind === 'entrance' && handles.map(face => <Box key={face} at={[w * .3, 0, face * (d / 2 + .06)]} size={[.04, .8, .06]} color="#c5ac78"/>)}{children}</group>;
});
export function OperationScene({ scene, onSelect }: {
    scene: ArchitecturalScene;
    onSelect: (id: string) => void;
}) {
    const render = (parent?: string): React.ReactNode => scene.elements.filter(e => e.parent === parent).map(e => <Element key={e.id} element={e} onSelect={onSelect}>{render(e.id)}</Element>);
    return <group name="Declarative architectural scene">{render()}</group>;
}
