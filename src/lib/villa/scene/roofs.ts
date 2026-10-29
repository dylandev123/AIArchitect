import { buildGableRoof } from '@/lib/house/roof/gableRoof';
import { buildHipRoof } from '@/lib/house/roof/hipRoof';
import type { ResolvedMaterial } from '@/lib/house/materials';
import type { SceneElement } from './model';
/** Reuse established roof construction, with local coordinates under the stable scene element. */
export function buildSceneRoof(element: SceneElement, material: ResolvedMaterial) {
    if (element.kind !== 'roof' || !element.roofForm || element.roofForm === 'flat')
        return [];
    const [width, rise, depth] = element.size;
    const builder = element.roofForm === 'gable' ? buildGableRoof : buildHipRoof;
    return builder(width, depth, -rise / 2, element.id, material, material, {
        pitch: rise / Math.min(width, depth), overhang: element.overhang ?? 0, rakeOverhang: element.overhang ?? 0,
    });
}
