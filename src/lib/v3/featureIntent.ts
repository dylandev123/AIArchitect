import type { V3SceneObject } from './scene';

/** Compatibility for pre-feature scenes only. Explicit semantics always win; no scene is rewritten. */
export function effectiveRoofForm(o: V3SceneObject): V3SceneObject['roofForm'] {
  if (o.roofForm) return o.roofForm;
  if (!["roof-form", "building-mass"].includes(o.type)) return undefined;
  if (o.unsupportedIntent?.roofForm === 'butterfly' || /\bbutterfly\b/i.test(o.label)) return 'butterfly';
  return undefined;
}
export function isSlattedCanopy(o: V3SceneObject): boolean {
  return o.canopyStyle ? o.canopyStyle === 'slatted' : /\b(pergola|slatted)\b/i.test(`${o.label} ${o.semanticRole}`);
}
