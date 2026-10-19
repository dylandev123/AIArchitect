import type { V3SceneObject } from './scene';
import { resolveFootprint } from './footprint';
import { scaledDimensionsOf } from './elevation';
import { v3MassLevelCount } from './stacking';

/** Shared by preliminary planning and construction. Does not build roof geometry. */
export function resolveV3FootprintRoofPlan(host: V3SceneObject, roof: V3SceneObject) {
  const fp = resolveFootprint(host, v3MassLevelCount(host) - 1);
  const diagnostics: { code: string; targetId: string; message: string }[] = [];
  const fail = (code: string, message: string) => diagnostics.push({ code, targetId: roof.id, message });
  if (!fp) {
    fail('FOOTPRINT_INVALID', 'Invalid footprint; cannot construct its roof.');
    return { fp, rectangular: false, diagnostics };
  }
  const [hw,,hd] = scaledDimensionsOf(host), [rw,,rd] = scaledDimensionsOf(roof);
  const envelopeEaves = roof.overhang !== undefined && Math.abs(rw-hw-2*roof.overhang)<1e-5 && Math.abs(rd-hd-2*roof.overhang)<1e-5;
  const dimensionError = envelopeEaves ? 0 : Math.abs(hw-rw)+Math.abs(hd-rd);
  if (roof.id !== host.id && dimensionError + Math.abs(host.transform.position[0]-roof.transform.position[0]) + Math.abs(host.transform.position[2]-roof.transform.position[2]) + Math.abs(Math.sin(host.transform.rotation[1]-roof.transform.rotation[1])) > 1e-5) {
    fail('ROOF_FOOTPRINT_ALIGNMENT_UNSUPPORTED', 'A hosted articulated roof must share its host origin/yaw and either host dimensions or host dimensions plus twice its explicit overhang. Authored roof placement is retained; no roof is arbitrarily relocated.');
    return { fp, rectangular: false, diagnostics };
  }
  const rectangular = host.composition?.footprint?.kind !== 'outline' && fp.polygon.length === 4 && fp.edges.every(edge => !!edge.facade) && fp.frame.width === hw && fp.frame.depth === hd;
  const form = roof.roofForm ?? 'flat';
  if (!rectangular && !['flat','floating-flat','terrace','mono-pitch'].includes(form))
    fail('ROOF_FOOTPRINT_UNSUPPORTED', `${form} roof over this footprint is unsupported. Supported: flat, terrace, floating-flat, mono-pitch. Correct only this roof choice if the brief permits; preserve the footprint and all unrelated design. No substitute roof is built.`);
  return { fp, rectangular, diagnostics };
}
