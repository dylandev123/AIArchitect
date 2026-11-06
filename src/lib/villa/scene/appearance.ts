import type {SceneElement} from './model';
import type {BoxPrimitive} from '@/lib/house/types';

/** Explicit local opt-ins; no appearance field means the legacy presentation. */
export interface ComponentFinish {surface: NonNullable<BoxPrimitive['surface']>; roughness: number; metalness: number; procedural?: {tileMeters: number; bumpScale: number;contrast?:number}}
export function componentFinish(appearance: SceneElement['appearance']): ComponentFinish | undefined {
  switch (appearance) {
    case 'cut-limestone': return {surface: 'stone', roughness: 0.9, metalness: 0};
    case 'painted-stucco': return {surface: 'stucco', roughness: 0.86, metalness: 0};
    case 'bronze-roof': return {surface: 'metal', roughness: 0.58, metalness: 0.38, procedural: {tileMeters: 3, bumpScale: 0.02}};
    case 'clay-roof': return {surface: 'terracotta', roughness: 0.88, metalness: 0};
    case 'timber-door': return {surface: 'timber', roughness: 0.68, metalness: 0};
    default: return undefined;
  }
}
