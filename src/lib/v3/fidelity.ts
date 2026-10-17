import { effectiveRoofForm } from './featureIntent';
import type { V3Scene, V3SceneObject } from './scene';
import { materializeV3ArchitecturalScene } from './architecture';
import { scaledDimensionsOf } from './elevation';
import { deriveV3MassJunctions, type JunctionFacade } from './junctions';

export interface FidelityDiagnostic { code: string; targetId: string; message: string; repaired: boolean }
const sides: JunctionFacade[] = ['north', 'east', 'south', 'west'];
const opposite: Record<JunctionFacade, JunctionFacade> = { north: 'south', south: 'north', east: 'west', west: 'east' };
/** World +X east, +Y up, +Z south. Facades are local to each object's yaw. */
function sideTo(host: V3SceneObject, target: V3SceneObject): JunctionFacade | undefined {
  const dx = target.transform.position[0] - host.transform.position[0], dz = target.transform.position[2] - host.transform.position[2], yaw = host.transform.rotation[1];
  const x = dx * Math.cos(yaw) - dz * Math.sin(yaw), z = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  if (Math.max(Math.abs(x), Math.abs(z)) < .1 || Math.abs(Math.abs(x) - Math.abs(z)) < .2 * Math.max(Math.abs(x), Math.abs(z))) return;
  return Math.abs(x) > Math.abs(z) ? x > 0 ? 'east' : 'west' : z > 0 ? 'south' : 'north';
}
/** Pure effective construction intent; never mutates the saved scene or site geometry. */
export function resolveV3Fidelity(input: V3Scene): { scene: V3Scene; diagnostics: FidelityDiagnostic[] } {
  const scene = structuredClone(materializeV3ArchitecturalScene(input)), diagnostics: FidelityDiagnostic[] = [];
  const note = (code: string, targetId: string, message: string, repaired = false) => diagnostics.push({ code, targetId, message, repaired });
  for (const o of scene.objects) {
    const form = effectiveRoofForm(o);
    if (form && form !== o.roofForm) { o.roofForm = form; note('LEGACY_ROOF_INTENT_RESOLVED',o.id,'Legacy named butterfly intent is supported in the effective scene.',true); }
    if (o.roofForm === 'butterfly' && o.unsupportedIntent?.roofForm === 'butterfly') delete o.unsupportedIntent;
  }
  for (const o of scene.objects) if (o.unsupportedIntent?.roofForm) note('UNSUPPORTED_ARCHITECTURAL_INTENT', o.id, `Unsupported roof intent "${o.unsupportedIntent.roofForm}" is retained; displayed geometry is a preview only.`);
  const masses = scene.objects.filter(o => o.type === 'building-mass');
  const arrival = scene.objects.filter(o => o.type === 'driveway' || /arrival-(court|stair)/.test(o.semanticRole));
  const garden = scene.objects.filter(o => o.type === 'pool' && !/reflect|rill|arrival/i.test(o.semanticRole + ' ' + o.label));
  const primary = masses.filter(m => m.composition?.massHierarchy === 'primary');
  const consensus = (host: V3SceneObject, targets: V3SceneObject[]) => {
    const votes = targets.map(t => sideTo(primary.length === 1 ? { ...host, transform: { ...host.transform, position: primary[0].transform.position } } : host, t));
    return votes.length && votes.every(v => v && v === votes[0]) ? votes[0] : undefined;
  };
  // A shared mapping requires every available arrival/view role and main entry to agree.
  const shared = deriveV3MassJunctions(scene).junctions.flatMap(j => j.sharedWalls);
  const evidence: Array<[JunctionFacade, JunctionFacade]> = [];
  let ambiguous = false;
  for (const m of masses) {
    const c = m.composition;
    for (const side of sides) {
      const role = c?.facadeRoles?.[side];
      if (role !== 'arrival' && role !== 'view') continue;
      // Internal access roles describe circulation, not a site-facing facade.
      if (shared.some(r => r.massId === m.id && r.facade === side)) continue;
      const targets = role === 'arrival' ? arrival : garden;
      if (!targets.length) continue;
      const actual = consensus(m, targets);
      if (actual) evidence.push([side, actual]); else ambiguous = true;
    }
    const door = c?.openings?.find(o => o.id === c.mainEntry?.openingId);
    if (door && arrival.length) { const actual = consensus(m, arrival); if (actual) evidence.push([door.facade, actual]); else ambiguous = true; }
  }
  const reversed = evidence.filter(([a,b]) => a !== b);
  if (reversed.length || ambiguous) {
    const axis = reversed[0]?.[0];
    const pair = axis ? [axis, opposite[axis]] : [];
    if (!ambiguous && reversed.length >= 2 && evidence.every(([a,b]) => pair.includes(a) ? b === opposite[a] : a === b)) {
      const map = (s: JunctionFacade) => pair.includes(s) ? opposite[s] : s;
      for (const m of masses) {
        const c = m.composition;
        if (c) {
          if (c.facadeRoles) c.facadeRoles = Object.fromEntries(Object.entries(c.facadeRoles).map(([s,r]) => [map(s as JunctionFacade),r]));
          c.openings?.forEach(o => { o.facade = map(o.facade); });
          c.assemblies?.forEach(a => a.parts.forEach(p => { if ('facade' in p) p.facade = map(p.facade); }));
        }
        if (pair.includes('north')) [m.facadeNorth,m.facadeSouth] = [m.facadeSouth,m.facadeNorth];
        else [m.facadeEast,m.facadeWest] = [m.facadeWest,m.facadeEast];
      }
      note('FACADE_MAPPING_REPAIRED', 'scene', `Swapped ${pair.join('/')} facade intent against unanimous site evidence; transforms preserved.`, true);
    } else note('ORIENTATION_CONFLICT', 'scene', 'Site evidence and facade roles do not establish one consistent reversal; geometry and facade intent retained.');
  }
  for (const roof of scene.objects.filter(o => o.type === 'roof-form' || o.type === 'building-mass')) {
    const [w,h,d] = scaledDimensionsOf(roof), e = roof.overhang ?? .75;
    const host = masses.find(m => m.id === (roof.hostId ?? roof.support?.hostId ?? roof.support?.objectId));
    if (roof.type === 'roof-form' && host) {
      const [hw,,hd] = scaledDimensionsOf(host);
      if (e > 0 && Math.abs(w-hw-2*e)<.02 && Math.abs(d-hd-2*e)<.02 && Math.abs(roof.transform.rotation[1]-host.transform.rotation[1])<1e-6 && Math.hypot(roof.transform.position[0]-host.transform.position[0],roof.transform.position[2]-host.transform.position[2])<.02) {
        roof.overhang = 0;
        note('ROOF_OVERHANG_INCLUDED', roof.id, 'Authored footprint already includes both eaves; no second overhang added.', true);
      }
    }
    if (!['hip','gable','mono-pitch','butterfly'].includes(roof.roofForm ?? '')) continue;
    const pitch = roof.pitch;
    if (roof.pitchUnit === 'ratio' && pitch !== undefined) {
      roof.pitch = Math.atan(pitch)*180/Math.PI; roof.pitchUnit = 'degrees';
      note('ROOF_RATIO_CONVERTED', roof.id, 'Explicit rise/run converted to degrees.', true);
    } else if (!roof.pitchUnit && pitch !== undefined && pitch > 0 && pitch <= 1 && roof.type === 'roof-form') {
      const run = roof.roofForm === 'mono-pitch' ? d : Math.min(w,d)/2;
      const ratioRise = pitch*run, degreeRise = Math.tan(pitch*Math.PI/180)*run;
      if (Math.abs(h-ratioRise) < h*.55 && Math.abs(h-degreeRise) > h*.8) {
        roof.pitch = Math.atan(h/run)*180/Math.PI; roof.pitchUnit = 'degrees';
        note('ROOF_PITCH_HEIGHT_RESOLVED', roof.id, 'Legacy fractional pitch is ratio-like; authored roof height determines the effective slope.', true);
      } else note('ROOF_PITCH_CONFLICT', roof.id, 'Neither pitch interpretation agrees sufficiently with roof height; retained for author resolution.');
    }
  }
  const regions = deriveV3MassJunctions(scene).junctions.flatMap(j => j.sharedWalls);
  for (const m of masses) {
    const blocked = (side: JunctionFacade) => regions.some(r => r.massId === m.id && r.facade === side);
    for (const assembly of m.composition?.assemblies ?? []) {
      const slabs = assembly.parts.filter(p => p.type === 'slab' && (p.level ?? 0) > 0);
      if (!slabs.some(p => 'facade' in p && blocked(p.facade))) continue;
      const role = /entry|arrival/i.test(assembly.intent) ? 'arrival' : /pool|view|garden/i.test(assembly.intent) ? 'view' : /private/i.test(assembly.intent) ? 'private' : undefined;
      const candidates = sides.filter(s => role && m.composition?.facadeRoles?.[s] === role && !blocked(s));
      if (candidates.length === 1) {
        assembly.parts.forEach(p => { if ('facade' in p) p.facade = candidates[0]; });
        note('BALCONY_FACADE_REPAIRED', assembly.id, `Moved facade-relative assembly to the unambiguous ${role} exterior ${candidates[0]} face.`, true);
      } else note('BALCONY_SHARED_WALL', assembly.id, 'Balcony occupies a shared facade; no unique unobstructed intended exterior face. Authored placement retained.');
    }
    if (m.composition?.spaceHeight === 'double-height') {
      if ((m.levels ?? 1) > 1) note('DOUBLE_HEIGHT_REPAIRED', m.id, 'Explicit whole-volume double height suppresses intermediate floors and uses continuous facades.', true);
      m.levels = 1;
    } else if (/double[ -]height/i.test(m.label + ' ' + m.semanticRole) && (m.levels ?? 1) > 1) note('DOUBLE_HEIGHT_CONFLICT', m.id, 'Descriptive double height conflicts with authored multiple storeys; floor geometry retained. Author levels:1 or explicit composition.spaceHeight.');
  }
  return { scene, diagnostics };
}
