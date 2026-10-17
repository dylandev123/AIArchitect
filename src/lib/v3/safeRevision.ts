import type { V3Scene, V3SceneObject } from './scene';
import type { V3DesignDiagnostic, V3DesignReview } from './designReview';

/** Canonical comparison ignores property order, never values or array order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
function changes(a: unknown, b: unknown, path = ''): string[] {
  if (stable(a) === stable(b)) return [];
  if ((a === undefined || a && typeof a === 'object' && !Array.isArray(a)) && (b === undefined || b && typeof b === 'object' && !Array.isArray(b))) {
    const x=(a ?? {}) as Record<string,unknown>, y=(b ?? {}) as Record<string,unknown>;
    return [...new Set([...Object.keys(x),...Object.keys(y)])].flatMap(k=>changes(x[k],y[k],path ? `${path}.${k}` : k));
  }
  return [path];
}
const key = (d: V3DesignDiagnostic) => `${d.code}:${[...d.targetIds].sort().join(',')}:${d.code === 'MISSING_REQUESTED_FEATURE' ? d.message : ''}`;
const conflicts = (r: V3DesignReview) => r.diagnostics.filter(d=>d.severity==='significant');
const geometry = new Set(['architecture.x','architecture.z','architecture.baseElevation','architecture.width','architecture.depth','architecture.height','transform.position','dimensions']);
function allowedPaths(o: V3SceneObject, findings: V3DesignDiagnostic[]): Set<string> {
  const allowed = new Set<string>();
  for (const d of findings) {
    // Collision counterpart is evidence, not permission to remodel it.
    if (d.code === 'OUTDOOR_PLACEMENT_CONFLICT' && d.targetIds[0] === o.id && o.type !== 'building-mass') geometry.forEach(p=>allowed.add(p));
    if (d.code === 'BALCONY_ON_SHARED_WALL' && d.targetIds[0] === o.id && o.type === 'balcony') geometry.forEach(p=>allowed.add(p));
    if (d.code === 'MISSING_REQUESTED_FEATURE' && /double-height/.test(d.message) && /double[- ]height/i.test(`${o.label} ${o.semanticRole}`)) allowed.add('composition.spaceHeight');
  }
  return allowed;
}
function localizedComposition(original: V3SceneObject, revised: V3SceneObject, findings: V3DesignDiagnostic[]): V3SceneObject {
  const copy=structuredClone(revised);
  for(const d of findings.filter(d=>d.targetIds[0]===original.id)) {
    if(d.code==='ENTRY_ARRIVAL_MISMATCH') {
      const id=original.composition?.mainEntry?.openingId;
      const before=original.composition?.openings?.find(op=>op.id===id), after=copy.composition?.openings?.find(op=>op.id===id);
      if(before && after) after.facade=before.facade;
      // Only arrival-role relocation is permitted; view/private/service remain protected.
      if(original.composition?.facadeRoles && copy.composition?.facadeRoles) {
        const beforeRoles=original.composition.facadeRoles, afterRoles=copy.composition.facadeRoles;
        for(const side of ['north','south','east','west'] as const) {
          if(afterRoles[side]==='arrival') delete afterRoles[side];
          if(beforeRoles[side]==='arrival') afterRoles[side]='arrival';
        }
      }
    }
    if(d.code==='BALCONY_ON_SHARED_WALL') {
      for(const before of original.composition?.assemblies ?? []) {
        if(!d.message.includes(`assembly ${before.id} `)) continue;
        const after=copy.composition?.assemblies?.find(a=>a.id===before.id);
        for(const p of before.parts) {
          const q=after?.parts.find(part=>part.id===p.id);
          if('facade' in p && q && 'facade' in q) q.facade=p.facade;
        }
      }
    }
  }
  return copy;
}
function requestedAddition(o: V3SceneObject, findings: V3DesignDiagnostic[]): boolean {
  return findings.some(d=>d.code==='MISSING_REQUESTED_FEATURE' && (
    /swimming pool/.test(d.message) && o.type==='pool' ||
    /courtyard/.test(d.message) && o.type==='courtyard' ||
    /balcony/.test(d.message) && o.type==='balcony' ||
    /driveway/.test(d.message) && o.type==='driveway' ||
    /garage/.test(d.message) && o.type==='building-mass' && /garage|carport/i.test(`${o.label} ${o.semanticRole}`) ||
    /multiple wings/.test(d.message) && o.type==='building-mass' ||
    /covered loggia/.test(d.message) && ['canopy','veranda'].includes(o.type) ||
    /roof terrace/.test(d.message) && o.type==='terrace'
  ));
}
export interface V3RevisionDecision { accepted: boolean; reasons: string[]; changedPaths: string[] }
/** Conservative allowlist: declining a repair is safer than accepting an unrelated redesign. */
export function assessV3Revision(original: V3Scene, revised: V3Scene, initial: V3DesignReview, final: V3DesignReview): V3RevisionDecision {
  const reasons:string[]=[], changedPaths:string[]=[], findings=conflicts(initial).slice(0,12), after=conflicts(final);
  const beforeKeys=new Set(conflicts(initial).map(key)), afterKeys=new Set(after.map(key));
  if(!findings.some(d=>!afterKeys.has(key(d)))) reasons.push('No targeted conflict was resolved.');
  if(after.some(d=>!beforeKeys.has(key(d)))) reasons.push('Revision introduced a new conflict or unmet requirement.');
  const {objects: oldObjects, ...oldScene}=original, {objects: newObjects, ...newScene}=revised;
  for(const path of changes(oldScene,newScene)) { changedPaths.push(`scene.${path}`); reasons.push(`Protected scene field changed: ${path}.`); }
  const byId=new Map(newObjects.map(o=>[o.id,o]));
  if(byId.size!==newObjects.length) reasons.push('Duplicate object identities.');
  for(const before of oldObjects) {
    const afterObject=byId.get(before.id);
    if(!afterObject) { reasons.push(`Object removed or renamed: ${before.id}.`); continue; }
    changedPaths.push(...changes(before,afterObject).map(p=>`${before.id}.${p}`));
    const paths=changes(before,localizedComposition(before,afterObject,findings)), allowed=allowedPaths(before,findings);
    for(const path of paths) if(!allowed.has(path)) reasons.push(`Unrelated change: ${before.id}.${path}.`);
  }
  for(const added of newObjects.filter(o=>!oldObjects.some(b=>b.id===o.id))) {
    changedPaths.push(`${added.id} (added)`);
    if(!requestedAddition(added,findings)) reasons.push(`Unrequested addition: ${added.id}.`);
  }
  return { accepted: reasons.length===0, reasons: reasons.length ? reasons : ['Targeted conflicts resolved; unrelated scene, identities and architecture preserved.'], changedPaths };
}
