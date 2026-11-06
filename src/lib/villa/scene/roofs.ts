import { buildGableRoof } from '@/lib/house/roof/gableRoof';
import { buildHipRoof } from '@/lib/house/roof/hipRoof';
import type { ResolvedMaterial } from '@/lib/house/materials';
import type { SceneElement } from './model';
/** Reuse established roof construction, with local coordinates under the stable scene element. */
export function buildSceneRoof(element: SceneElement, material: ResolvedMaterial, exteriorMaterial: ResolvedMaterial = material) {
    if (element.kind !== 'roof' || !element.roofForm || element.roofForm === 'flat')
        return [];
    const [width, rise, depth] = element.size;
    const builder = element.roofForm === 'gable' ? buildGableRoof : buildHipRoof;
    return builder(width, depth, -rise / 2, element.id, material, exteriorMaterial, {
        pitch: rise / Math.min(width, depth), overhang: element.overhang ?? 0, rakeOverhang: element.overhang ?? 0,
        fascia: element.fascia, eaves: element.eaves,
    });
}

/** Eave projection of each edge of a gable/hip roof element (builder compass, north = -z): the per-edge value where one is stated, otherwise the uniform overhang. */
export function roofEaves(e: Pick<SceneElement, 'overhang' | 'eaves'>) {
    const o = e.overhang ?? 0;
    return { north: e.eaves?.north ?? o, east: e.eaves?.east ?? o, south: e.eaves?.south ?? o, west: e.eaves?.west ?? o };
}
