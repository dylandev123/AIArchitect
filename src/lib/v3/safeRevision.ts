import { authoredOverlap } from './authoredPlan';
import { getObjectBaseY, getObjectTopY } from './elevation';
import { materializeV3ArchitecturalScene } from './architecture';
import { estateRoutePoints, estateRouteBounds, siteAccessFits } from './routeGeometry';
import { auditEstateSpatial } from './estateSpatial';
import { v3CompositionSchema } from './composition';
import type { V3Scene, V3SceneObject } from './scene';
import type { V3DesignDiagnostic, V3DesignReview } from './designReview';
import { approveV3Blueprint, auditV3BlueprintElaboration } from './blueprintApproval';
import { v3BlueprintSchema } from './blueprintSchema';

function blueprintPreservationReasons(original: V3Scene, revised: V3Scene): string[] {
  if (!original.estatePlan?.blueprint) return [];
  const approval = approveV3Blueprint(original).approval;
  return approval ? auditV3BlueprintElaboration(approval, revised).findings.filter(f => f.severity === 'fatal')
    .map(f => `${f.code} [${f.targetIds.join(', ')}]: ${f.message}`) : [];
}

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
const key = (d: V3DesignDiagnostic) => `${d.code}:${[...d.targetIds].sort().join(',')}:${d.code === 'MISSING_REQUESTED_FEATURE' || d.code.startsWith('ESTATE_') ? d.message : ''}`;
const conflicts = (r: V3DesignReview) => r.diagnostics.filter(d=>d.severity==='significant');
const geometry = new Set(['architecture.x','architecture.z','architecture.baseElevation','architecture.width','architecture.depth','architecture.height','transform.position','dimensions']);
/** Completeness codes whose minimal fix is added access on a targeted object. */
const ACCESS_CODES = new Set(['UNREACHABLE_STOREY', 'UNREACHABLE_WING', 'INACCESSIBLE_BALCONY', 'INACCESSIBLE_ROOF_TERRACE', 'NO_OUTDOOR_LIVING_ACCESS', 'ESTATE_ACCESS_POINT_MISSING']);
const CIRCULATION_CODES = new Set(['UNREACHABLE_STOREY', 'INACCESSIBLE_ROOF_TERRACE', 'CIRCULATION_INTENT_INCOMPLETE']);
const accessTargets = (findings: V3DesignDiagnostic[], codes: Set<string>) => new Set(findings.filter(d => codes.has(d.code)).flatMap(d => d.targetIds));
function allowedPaths(o: V3SceneObject, findings: V3DesignDiagnostic[]): Set<string> {
  const allowed = new Set<string>();
  for (const d of findings) {
    if (d.code === 'INACCESSIBLE_ROOF_TERRACE' && d.targetIds[0] === o.id && o.type === 'terrace') allowed.add('terraceOpenEdges');
    // Collision counterpart is evidence, not permission to remodel it.
    if (d.code === 'ESTATE_ACCESS_DISCONNECTED' && d.targetIds.includes(o.id) && ['path','driveway'].includes(o.type)) geometry.forEach(p=>allowed.add(p));
    if (['ESTATE_ALLOCATION_CONFLICT', 'ESTATE_OPEN_SPACE_BLOCKED'].includes(d.code) && d.targetIds[0] === o.id && o.type !== 'building-mass') geometry.forEach(p=>allowed.add(p));
    if (d.code === 'OUTDOOR_PLACEMENT_CONFLICT' && d.targetIds[0] === o.id && o.type !== 'building-mass') geometry.forEach(p=>allowed.add(p));
    if (d.code === 'BALCONY_ON_SHARED_WALL' && d.targetIds[0] === o.id && o.type === 'balcony') geometry.forEach(p=>allowed.add(p));
    if (d.code === 'MISSING_REQUESTED_FEATURE' && /double-height/.test(d.message) && /double[- ]height/i.test(`${o.label} ${o.semanticRole}`)) allowed.add('composition.spaceHeight');
  }
  return allowed;
}
function localizedComposition(original: V3SceneObject, revised: V3SceneObject, findings: V3DesignDiagnostic[]): V3SceneObject {
  const copy=structuredClone(revised);
  // Access repair may only append walkable openings to a targeted mass; every authored opening stays as it was.
  if(accessTargets(findings, ACCESS_CODES).has(original.id) && original.composition?.openings && copy.composition?.openings) {
    const before=new Map(original.composition.openings.map(op=>[op.id,op]));
    copy.composition.openings=copy.composition.openings.filter(op=>before.has(op.id) || !['door','glazed-door'].includes(op.type)).map(op=>{
      // The one permitted edit of an existing opening: the same glazing span made walkable (glazing-zone → glazed-door).
      const prior=before.get(op.id);
      return prior?.type==='glazing-zone' && op.type==='glazed-door' && prior.facade===op.facade && prior.floors===op.floors && prior.start===op.start && prior.end===op.end ? prior : op;
    });
  }
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
  if (findings.some(d => d.code === 'ESTATE_MISSING_OBJECT' && d.targetIds[0] === o.id)) return true;
  // An exterior stair/ramp connector may be added to reach an inaccessible terrace or outdoor living area.
  const outdoor = accessTargets(findings, new Set(['INACCESSIBLE_ROOF_TERRACE', 'NO_OUTDOOR_LIVING_ACCESS']));
  if (['stair','ramp'].includes(o.type) && [o.fromSupportId, o.toSupportId].some(id => !!id && outdoor.has(id))) return true;
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
/**
 * Circulation may be added in hosts named by an unreachable-storey or roof-terrace finding, and an entry named by a
 * circulation finding may be corrected. Every other authored circulation entry and interior datum is protected.
 */
function circulationChangeAllowed(path: string, original: V3Scene, revised: V3Scene, findings: V3DesignDiagnostic[]): boolean {
  const hosts = accessTargets(findings, CIRCULATION_CODES), fixable = new Set(findings.filter(d => d.code === 'CIRCULATION_INTENT_INCOMPLETE' || d.code.startsWith('STAIR_') || d.code.startsWith('CIRCULATION_') || String(d.code)==='ROOF_EXIT_UNSUPPORTED').flatMap(d => d.targetIds));
  if (!hosts.size && !fixable.size) return false;
  // A circulation-only interior is created with empty storey/room lists.
  if ((path === 'interior.storeys' || path === 'interior.rooms') && !original.interior) return (revised.interior?.[path === 'interior.storeys' ? 'storeys' : 'rooms'] ?? []).length === 0;
  if (path !== 'interior.circulation') return false;
  const before = original.interior?.circulation ?? [], after = revised.interior?.circulation ?? [];
  if (!before.every(entry => after.some(next => next.id===entry.id && (stable(next)===stable(entry) || fixable.has(entry.id) && next.hostMassId===entry.hostMassId && next.type===entry.type && (next.fromLevel===entry.fromLevel && next.toLevel===entry.toLevel || findings.some(d=>String(d.code)==='CIRCULATION_LEVELS_INVALID'&&d.targetIds.includes(entry.id))) && next.label===entry.label && next.semanticRole===entry.semanticRole)))) return false;
  return after.filter(entry => !before.some(prev => stable(prev) === stable(entry))).every(entry => fixable.has(entry.id) || hosts.has(entry.hostMassId));
}
export interface V3RevisionDecision { accepted: boolean; reasons: string[]; changedPaths: string[] }
/** Conservative allowlist: declining a repair is safer than accepting an unrelated redesign. */
export function assessV3Revision(original: V3Scene, revised: V3Scene, initial: V3DesignReview, final: V3DesignReview): V3RevisionDecision {
  const reasons:string[]=[...blueprintPreservationReasons(original,revised),...routeRepairSafety(original,revised)], changedPaths:string[]=[], findings=conflicts(initial).slice(0,12), after=conflicts(final);
  const beforeKeys=new Set(conflicts(initial).map(key)), afterKeys=new Set(after.map(key));
  if(!findings.some(d=>!afterKeys.has(key(d)))) reasons.push('No targeted conflict was resolved.');
  if(after.some(d=>!beforeKeys.has(key(d)))) reasons.push('Revision introduced a new conflict or unmet requirement.');
  const {objects: oldObjects, ...oldScene}=original, {objects: newObjects, ...newScene}=revised;
  for(const path of changes(oldScene,newScene)) {
    changedPaths.push(`scene.${path}`);
    if(!estateRouteChangeAllowed(path, original, revised, findings) && !estateSiteAccessChangeAllowed(path,original,revised,findings) && !estateRelationshipChangeAllowed(path, original, revised, findings) && !circulationChangeAllowed(path, original, revised, findings)) reasons.push(`Protected scene field changed: ${path}.`);
  }
  const byId=new Map(newObjects.map(o=>[o.id,o]));
  if(byId.size!==newObjects.length) reasons.push('Duplicate object identities.');
  for(const before of oldObjects) {
    const afterObject=byId.get(before.id);
    if(!afterObject) { reasons.push(`Object removed or renamed: ${before.id}.`); continue; }
    changedPaths.push(...changes(before,afterObject).map(p=>`${before.id}.${p}`));
    const paths=changes(before,localizedComposition(before,afterObject,findings)), allowed=allowedPaths(before,findings);
    if(derivedRouteChangeAllowed(before,afterObject,original,revised,findings))['architecture','dimensions','transform.position','transform.rotation','transform.scale'].forEach(p=>allowed.add(p));
    for(const path of paths) if(![...allowed].some(p=>path===p||path.startsWith(p+'.'))) reasons.push(`Unrelated change: ${before.id}.${path}.`);
  }
  for(const added of newObjects.filter(o=>!oldObjects.some(b=>b.id===o.id))) {
    changedPaths.push(`${added.id} (added)`);
    if(!requestedAddition(added,findings)) reasons.push(`Unrequested addition: ${added.id}.`);
  }
  return { accepted: reasons.length===0, reasons: reasons.length ? reasons : ['Targeted conflicts resolved; unrelated scene, identities and architecture preserved.'], changedPaths };
}

/** Only append the exact planned edges named by a finding; existing graph and plan stay protected. */
function estateRelationshipChangeAllowed(path: string, original: V3Scene, revised: V3Scene, findings: V3DesignDiagnostic[]): boolean {
  if (path !== 'relationships' || !original.estatePlan) return false;
  const allowed = original.estatePlan.relationships.filter(r => findings.some(d => d.code==='ESTATE_RELATIONSHIP_MISSING' && d.targetIds[0]===r.from && d.targetIds[1]===r.to)).map(({from,to,kind})=>({from,to,kind}));
  for (const route of original.estatePlan.circulation) if (findings.some(d=>d.code==='ESTATE_ACCESS_MISSING' && d.message.startsWith(`${route.id}:`))) {
    const chain=[route.from,...route.via,route.to];
    chain.slice(1).forEach((to,i)=>allowed.push({from:chain[i],to,kind:'connects'}));
  }
  return original.relationships.every(r=>revised.relationships.some(n=>stable(n)===stable(r))) && revised.relationships.every(r=>original.relationships.some(n=>stable(n)===stable(r)) || allowed.some(n=>stable(n)===stable(r)));
}

/** Only a diagnosed route's coordinates may change; ids, use, width and architecture stay protected. */
function estateRouteChangeAllowed(path: string, original: V3Scene, revised: V3Scene, findings: V3DesignDiagnostic[]): boolean {
  if (path !== 'estatePlan.circulation') return false;
  const before = original.estatePlan?.circulation ?? [], after = revised.estatePlan?.circulation ?? [];
  if (before.length !== after.length) return false;
  return before.every((route,i) => {
    const next = after[i];
    if (stable(route) === stable(next)) return true;
    if (!route.spatial || !next?.spatial || !findings.some(d => ['ESTATE_ROUTE_BLOCKED','ESTATE_POOL_CROSSING','ESTATE_ACCESS_POINT_MISSING','ESTATE_ACCESS_DISCONNECTED'].includes(d.code) && d.message.startsWith(`${route.id}:`))) return false;
    const copy = structuredClone(next);
    copy.spatial = { ...copy.spatial!, from: route.spatial.from, to: route.spatial.to, waypoints: route.spatial.waypoints };
    return stable(copy) === stable(route);
  });
}

/** Objective repair has the same preservation obligation as design repair. Invalid roots have no
 * usable scene authority; once objects exist, every unrelated field remains protected. */
export function assessV3ObjectiveRevision(original:V3Scene,revised:V3Scene,issues:readonly {code:string;targetId:string;targetIds?:string[];message:string}[]):V3RevisionDecision{
 const reasons:string[]=[...blueprintPreservationReasons(original,revised),...routeRepairSafety(original,revised)],changedPaths:string[]=[];
 if(!Array.isArray(original?.objects)||!original.objects.length)return {accepted:true,reasons:['No initial object authority to compare; repaired scene must pass validation.'],changedPaths};
 const byId=new Map(revised.objects.map(o=>[o.id,o]));
 const {objects:_,...beforeRoot}=original,{objects:__,...afterRoot}=revised;
 void _;void __;
 const findings=issues.map(i=>({code:i.code as V3DesignDiagnostic['code'],targetIds:i.targetIds??[i.targetId],message:i.message,severity:'significant' as const,guidance:''}));
 for(const path of changes(beforeRoot,afterRoot)){
  changedPaths.push(`scene.${path}`);
  const missingIndexOnly = (path === 'estatePlan.blueprint' || path.startsWith('estatePlan.blueprint.')) && original.estatePlan?.blueprint === undefined
    && issues.some(i=>i.code==='BLUEPRINT_MISSING') && v3BlueprintSchema.safeParse(revised.estatePlan?.blueprint).success;
  if(!missingIndexOnly&&!(path.startsWith('site.')&&issues.some(i=>['INVALID_SITE','FLAT_SITE_CONTRACT'].includes(i.code)))&&!path.startsWith('metadata')&&!estateRouteChangeAllowed(path,original,revised,findings)&&!estateSiteAccessChangeAllowed(path,original,revised,findings)&&!allocationChangeAllowed(path,original,revised,findings)&&!circulationChangeAllowed(path,original,revised,findings))reasons.push(`Protected scene field changed: ${path}.`);
 }
 for(const before of original.objects){
  const after=byId.get(before.id);if(!after){reasons.push(`Object removed: ${before.id}`);continue;}
  const target=issues.filter(i=>i.targetId===before.id),codes=new Set(target.map(i=>i.code));
  const allowed=new Set<string>();
  if(derivedRouteChangeAllowed(before,after,original,revised,findings))['architecture','dimensions','transform.position','transform.rotation','transform.scale'].forEach(p=>allowed.add(p));
  const related=issues.filter(i=>(i.targetIds??[i.targetId]).includes(before.id));
  if (before.type!=='building-mass' && before.type!=='roof-form' && related.some(i=>['AUTHORED_SITE_OVERRUN','BLUEPRINT_SITE_BOUNDS'].includes(i.code) || i.code==='ESTATE_FORM_UNBUILT' && /connected composition/.test(i.message) || ['ESTATE_ACCESS_DISCONNECTED','AUTHORED_ACCESS_DISCONNECTED','BLUEPRINT_ROUTE_THRESHOLD'].includes(i.code) && ['path','driveway'].includes(before.type))) geometry.forEach(p=>allowed.add(p));
  if([...codes].some(c=>c.startsWith('ROOF_FOOTPRINT_')))['roofForm','pitch','pitchUnit','overhang'].forEach(p=>allowed.add(p));
  if(codes.has('ROOF_FOOTPRINT_ALIGNMENT_UNSUPPORTED')&&before.type==='roof-form')['architecture.x','architecture.z','architecture.width','architecture.depth','architecture.rotationY','dimensions','transform.position','transform.rotation'].forEach(p=>allowed.add(p));
  if(codes.has('LEVEL_COUNT_APPROXIMATED'))['architecture.height','dimensions','transform.position'].forEach(p=>allowed.add(p));
  if(codes.has('INVALID_MATERIAL'))allowed.add('material');
  if(['INVALID_TRANSFORM','INVALID_ARCHITECTURE','ARCHITECTURE_RUNTIME_DRIFT'].some(c=>codes.has(c)))['architecture','dimensions','transform'].forEach(p=>allowed.add(p));
  if(codes.has('INVALID_COMPOSITION')){
   const parsed=v3CompositionSchema.safeParse(before.composition);
   if(!parsed.success)for(const field of ['openings','assemblies'] as const){
    const bad=new Set(parsed.error.issues.filter(i=>i.path[0]===field&&typeof i.path[1]==='number').map(i=>i.path[1]));
    const a=before.composition?.[field]??[],b=after.composition?.[field]??[];
    if(a.length===b.length&&a.every((entry,i)=>entry.id===b[i].id&&(bad.has(i)||stable(entry)===stable(b[i]))))allowed.add(`composition.${field}`);
   }
  }
  if(codes.has('FOOTPRINT_INVALID')){
   const a=before.composition?.footprint,b=after.composition?.footprint;
   const identities=(f:typeof a)=>f?.kind==='outline'?f.segments?.map(s=>[s.id,s.type]):f?.operations?.map((o,i)=>[o.id??i,o.type]);
   if(a?.kind!==b?.kind||stable(identities(a))!==stable(identities(b)))reasons.push(`Footprint identity or family changed: ${before.id}`);
   else allowed.add('composition.footprint');
  }
  if([...codes].some(c=>c.startsWith('FOOTPRINT_')&&c!=='FOOTPRINT_INVALID')){
   const a=before.composition?.openings??[],b=after.composition?.openings??[];
   const fixedFields=(op:Record<string,unknown>)=>Object.fromEntries(Object.entries(op).filter(([k])=>!['start','end','facade','segmentId','floors'].includes(k)));
   if(a.length===b.length&&a.every((op,i)=>stable(op)===stable(b[i])||stable(fixedFields(op))===stable(fixedFields(b[i]))&&target.some(d=>['Opening','Glazing','Rhythm'].some(kind=>d.message.includes(`${kind} ${op.id} `)))))allowed.add('composition.openings');
  }
  if(codes.has('FOOTPRINT_ASSEMBLY_UNRESOLVED')){
   const a=before.composition?.assemblies??[],b=after.composition?.assemblies??[];
   const attachmentOnly=(part:Record<string,unknown>)=>Object.fromEntries(Object.entries(part).filter(([key])=>!['start','end','at','facade','segmentId','level'].includes(key)));
   const safe=a.length===b.length&&a.every((assembly,i)=>{
    const next=b[i];
    return assembly.id===next.id&&assembly.intent===next.intent&&assembly.parts.length===next.parts.length&&assembly.parts.every((part,j)=>{
     const afterPart=next.parts[j];
     return stable(part)===stable(afterPart)||part.id===afterPart.id&&target.some(d=>d.code==='FOOTPRINT_ASSEMBLY_UNRESOLVED'&&d.message.includes(`${assembly.id}/${part.id}`))&&stable(attachmentOnly(part))===stable(attachmentOnly(afterPart));
    });
   });
   if(safe)allowed.add('composition.assemblies');
  }
  if(codes.has('ESTATE_ACCESS_POINT_MISSING')){const a=before.composition?.openings??[],b=after.composition?.openings??[];if(a.every(op=>b.some(n=>stable(n)===stable(op)))&&b.filter(op=>!a.some(n=>n.id===op.id)).every(op=>['door','glazed-door'].includes(op.type)&&op.floors!=='upper'))allowed.add('composition.openings');}
  const paths=changes(before,after);changedPaths.push(...paths.map(p=>`${before.id}.${p}`));
  for(const path of paths)if(![...allowed].some(p=>path===p||path.startsWith(p+'.')))reasons.push(`Unrelated objective repair: ${before.id}.${path}`);
 }
 for(const after of revised.objects)if(!original.objects.some(o=>o.id===after.id))reasons.push(`Unrequested addition: ${after.id}`);
 return {accepted:!reasons.length,reasons:reasons.length?reasons:['Only diagnosed technical fields changed.'],changedPaths};
}

/** A diagnosed allocation may be redrawn; membership, intent, site and all other zones remain protected. */
function allocationChangeAllowed(path: string, original: V3Scene, revised: V3Scene, findings: V3DesignDiagnostic[]): boolean {
  if(path!=='estatePlan.zones') return false;
  const before=original.estatePlan?.zones??[],after=revised.estatePlan?.zones??[];
  return before.length===after.length && before.every((zone,i)=>{
    const next=after[i];
    if(stable(zone)===stable(next))return true;
    return zone.allocationMode!=='derived' && next?.allocation!==undefined && findings.some(d=>d.code==='ESTATE_ALLOCATION_CONFLICT'&&d.message.startsWith(`${zone.id}:`)) && stable({...next,allocation:zone.allocation})===stable(zone);
  });
}

/** Geometry repair is not permission to turn a path into a plaza, move architecture or cross an obstacle.
 * Routed owners have no independent footprint to repair. Local route edits retain width and endpoint identities. */
function routeRepairSafety(original:V3Scene,revised:V3Scene):string[]{
 const reasons:string[]=[], touched=new Set<string>();
 if(!Array.isArray(original?.objects)||!Array.isArray(revised?.objects))return reasons;
 const before=materializeV3ArchitecturalScene(original),after=materializeV3ArchitecturalScene(revised);
 const geometryOf=(o:V3SceneObject)=>({architecture:o.architecture,dimensions:o.dimensions,transform:o.transform});
 for(const o of before.objects.filter(o=>['path','driveway'].includes(o.type))){
  const next=after.objects.find(n=>n.id===o.id);if(!next)continue;
  const routes=before.estatePlan?.circulation.filter(r=>r.spatial&&r.via.includes(o.id))??[];
  if(stable(geometryOf(o))!==stable(geometryOf(next))){
   if(routes.length && !isDerivedRouteChange(o,next,before,after))reasons.push(`Canonical route owner geometry is derived; edit only its diagnosed route: ${o.id}.`);
   else if(!routes.length && !before.siteHierarchy) {
    const [w,,d]=o.dimensions,[nw,,nd]=next.dimensions;
    if(nw>w*1.5+.01 || nd>d*1.5+.01)reasons.push(`Unreasonable route enlargement: ${o.id}. A local approach must retain its architectural width.`);
   }
   touched.add(o.id);
  }
 }
 for(const route of before.estatePlan?.circulation??[]){
  const next=after.estatePlan?.circulation.find(r=>r.id===route.id);
  if(!route.spatial||!next?.spatial||stable(route)===stable(next))continue;
  route.via.forEach(id=>touched.add(id));
  if(route.spatial.width!==next.spatial.width)reasons.push(`Route repair changed protected width: ${route.id}.`);
  for(const side of ['from','to'] as const)if(route[side]!==next[side] || route.spatial[side].openingId!==next.spatial[side].openingId || route.spatial[side].entranceId!==next.spatial[side].entranceId)reasons.push(`Route repair changed destination identity: ${route.id}.`);
  const old=estateRoutePoints(route,before),points=estateRoutePoints(next,after),limit=Math.max(2,route.spatial.width*2);
  const distance=(p:number[],a:number[],b:number[])=>{const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);};
  const samples=(path:typeof points)=>path.slice(1).flatMap((b,i)=>{const a=path[i],steps=Math.max(1,Math.min(256,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2]))));return Array.from({length:steps+1},(_,j)=>[a[0]+(b[0]-a[0])*j/steps,0,a[2]+(b[2]-a[2])*j/steps]);});
  if(samples(points).some(p=>Math.min(...old.slice(1).map((b,i)=>distance(p,old[i],b)))>limit) || samples(old).some(p=>Math.min(...points.slice(1).map((b,i)=>distance(p,points[i],b)))>limit))reasons.push(`Route correction exceeds local repair scope: ${route.id}. Explicit replanning is required.`);
 }
 if(!before.siteHierarchy)for(const id of touched){
  const o=after.objects.find(o=>o.id===id);
  if(!o || after.estatePlan?.circulation.some(r=>r.spatial&&r.via.includes(id)))continue;
  for(const obstacle of after.objects)if(obstacle.id!==id && (obstacle.type==='building-mass'||obstacle.type==='pool'||['solid','water'].includes(obstacle.collision??'')) && getObjectTopY(obstacle)>getObjectBaseY(o) && getObjectBaseY(obstacle)<getObjectTopY(o)+2 && authoredOverlap(o,obstacle)>.02)reasons.push(`Unsafe route repair: ${id} intersects ${obstacle.id}.`);
 }
 if(touched.size)for(const finding of auditEstateSpatial(after))if(['ESTATE_ROUTE_BLOCKED','ESTATE_POOL_CROSSING','ESTATE_ROUTE_UNSUPPORTED','ESTATE_ACCESS_POINT_MISSING','ESTATE_ACCESS_DISCONNECTED'].includes(finding.code)&&finding.targetIds.some(id=>touched.has(id)))reasons.push(`Unsafe route repair: ${finding.code} ${finding.message}`);
 return reasons;
}

function isDerivedRouteChange(before:V3SceneObject,after:V3SceneObject,original:V3Scene,revised:V3Scene):boolean{
 const routes=original.estatePlan?.circulation.filter(r=>r.spatial&&r.via.includes(before.id))??[];
 // A diagnosed opening repair may move derived contact/approach geometry without editing the
 // route record. The opening itself is still checked by the independent preservation allowlist.
 if(!routes.length || !routes.some(r=>{
  const next=revised.estatePlan?.circulation.find(n=>n.id===r.id);
  return next && (stable(r)!==stable(next) || stable(estateRoutePoints(r,original))!==stable(estateRoutePoints(next,revised)));
 }))return false;
 const bounds=estateRouteBounds(revised,after);
 return !!bounds && !after.architecture && stable(bounds.transform)===stable(after.transform) && stable(bounds.dimensions)===stable(after.dimensions);
}
function derivedRouteChangeAllowed(before:V3SceneObject,after:V3SceneObject,original:V3Scene,revised:V3Scene,findings:V3DesignDiagnostic[]):boolean{
 return isDerivedRouteChange(before,after,original,revised) && estateRouteChangeAllowed('estatePlan.circulation',original,revised,findings);
}
/** Explicit repair may index an ALREADY AUTHORED boundary endpoint; it cannot choose a new gate or road. */
function estateSiteAccessChangeAllowed(path:string,original:V3Scene,revised:V3Scene,findings:V3DesignDiagnostic[]):boolean{
 if(path!=='estatePlan.siteAccess')return false;
 const before=original.estatePlan?.siteAccess??[],after=revised.estatePlan?.siteAccess??[];
 return before.every(a=>after.some(b=>stable(a)===stable(b))) && after.filter(a=>!before.some(b=>stable(a)===stable(b))).every(a=>
  findings.some(f=>f.code==='ESTATE_ACCESS_POINT_MISSING'&&f.targetIds.includes(a.id)) && siteAccessFits(revised,a.id,a.point) &&
  original.estatePlan?.circulation.some(r=>r.spatial&&(['from','to'] as const).some(side=>r[side]===a.id&&stable(r.spatial![side].point)===stable(a.point))));
}
