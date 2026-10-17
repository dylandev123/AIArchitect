import type { V3Material, V3Scene, V3SceneObject } from './scene';
import { scaledDimensionsOf } from './elevation';

/** V2's dominant-mass rule, expressed only in V3 semantics. Stable under object reordering. */
export function primaryCompositionMass(scene: V3Scene): V3SceneObject | undefined {
  return scene.objects.filter(o => o.type === 'building-mass').sort((a,b) => {
    const primary = (o: V3SceneObject) => o.composition?.massHierarchy ? ({primary: 3, secondary: 0, connector: -1}[o.composition.massHierarchy]) : /main[- ]living|primary|living pavilion/i.test(o.semanticRole) ? 1 : 0;
    const area = (o: V3SceneObject) => { const [w,,d] = scaledDimensionsOf(o); return w*d; };
    return primary(b)-primary(a) || area(b)-area(a) || a.id.localeCompare(b.id);
  })[0];
}

/** An implicit roof is a roof material zone, never an accidental extension of wall cladding.
 * Explicit roof objects retain their own finish, including intentional counterpoints.
 */
export function compositionRoofMaterial(scene: V3Scene): V3Material {
  const primary = primaryCompositionMass(scene);
  const roof = scene.objects.find(o => o.type === 'roof-form' && roofHostId(o) === primary?.id);
  return roof && !inheritsHostFinish(roof, primary) ? roof.material : DEFAULT_ROOF;
}
const DEFAULT_ROOF: V3Material = {id:'composition-roof',color:'#42494a',surface:'metal',roughness:.55,metalness:.65};
export const roofHostId = (o: V3SceneObject) => o.hostId ?? o.support?.hostId ?? o.support?.objectId;
/** A roof carrying its wall's cladding (same material id, or same colour and finish) is an accidental
 * inheritance, not an authored counterpoint; glass is never a roof finish. */
export function inheritsHostFinish(roof: V3SceneObject, host?: V3SceneObject): boolean {
  if (roof.material.surface === 'glass') return true;
  if (!host) return false;
  return roof.material.id === host.material.id || (roof.material.color.toLowerCase() === host.material.color.toLowerCase() && roof.material.surface === host.material.surface);
}
/** Render finish for an explicit roof: authored finish wins unless it merely repeats the host wall,
 * in which case it joins the scene's single roof family. Never mutates the authored object. */
export function roofFinish(scene: V3Scene, roof: V3SceneObject): V3Material {
  const host = scene.objects.find(o => o.id === roofHostId(roof));
  return inheritsHostFinish(roof, host) ? compositionRoofMaterial(scene) : roof.material;
}

/** Evenly spaced preset bays: one aperture centred per equal structural bay, ~50% glass per bay. */
export function facadeBays(span: number, nominal = 2.4, maxWidth = 1.2) {
  const count = Math.max(1, Math.floor(span / nominal)), pitch = span / count, width = Math.min(maxWidth, pitch * .5);
  return Array.from({length: count}, (_, i) => ({start: (i + .5) / count - width / span / 2, end: (i + .5) / count + width / span / 2}));
}

/** Equal structural modules with bounded spans; endpoints belong to the same facade grid. */
export function facadeBayGrid(span: number, nominal = 3): number[] {
  const bays = Math.max(1, Math.ceil(span / nominal));
  return Array.from({length:bays+1}, (_,i) => i/bays);
}

/** Shared preset datums in metres, rather than independent percentages of wing heights.
 * Explicit composition keeps its authored sill, height, reveal and corner spans.
 */
export function facadeDatums(levelHeight: number, privacy = false) {
  const sill = privacy ? levelHeight*.57 : Math.min(.8,levelHeight*.25);
  const height = Math.min(privacy ? levelHeight*.18 : 1.5,levelHeight*.5);
  return {sill, height, head:sill+height};
}

/** Keep repeated apertures within their structural bay, including after narrowing a wing. */
export function fittedRhythmWidth(span: number, count: number, requested: number): number {
  return Math.min(requested, span*.9/(count+(count-1)*.4));
}

/** Entry emphasis: the door leaf is the facade's one warm accent against dark window frames, so the entrance
 * reads as the focal point of the arrival facade without any extra authored geometry. */
export const ENTRY_DOOR_FINISH = { color: '#7a5a3c', roughness: .62, metalness: 0, surface: 'wood' as const };
