import { constructionPolicyConflicts } from './architecturalBlueprint';
import type { V3BlueprintFinding } from './blueprint';
import { auditV3Blueprint } from './blueprint';
import { resolveV3Circulation } from './circulation';
import { auditV3StairUsability } from './stairUsability';
import { validateV3Scene } from './validation';
import { auditV3DesignConsistency } from './designConsistency';
import { architecturalDoorPreflight, architecturalInteriorPreflight, architecturalOpeningPreflight } from './architecturalBlueprintPreflight';
import { auditArchitecturalConstructionFidelity } from './architecturalConstructionFidelity';
import { compileV3Scene, type V3Scene } from './scene';
import { v3FlatSiteErrors } from './terrainMode';
import { estateRouteBounds, estateRouteVertices, estateRouteClipsEntrance } from './routeGeometry';
import { getObjectBaseY, scaledDimensionsOf } from './elevation';
import type { V3ArchitecturalBlueprint } from './architecturalBlueprint';
import { v3MassLevelCount, v3MassStoreys } from './stacking';
import { LOCAL_FACADE_CODES } from './facadeOpeningRecovery';

export type ArchitecturalOutcome = 'complete' | 'draft' | 'cannot-construct';
export type ArchitecturalClassification = 'core-blocking' | 'locally-recoverable' | 'draft-tolerable' | 'advisory';
export interface ArchitecturalDiagnostic extends V3BlueprintFinding { classification: ArchitecturalClassification }
export interface ArchitecturalValidationState {
  version: 1;
  status: 'complete' | 'draft';
  diagnostics: ArchitecturalDiagnostic[];
}
const stairCodes = new Set(['CIRCULATION_NOT_USABLE', 'STAIR_APPROACH_UNSUPPORTED', 'STAIR_ACCESS_BLOCKED', 'STAIR_OPENING_BLOCKED', 'STAIR_LANDING_UNSUPPORTED']);
const doorCodes = new Set(['ARCHITECTURAL_DOOR_CLIPPED', 'ARCHITECTURAL_DOOR_OVERLAP', 'DOOR_OUTSIDE_BOUNDARY']);

/** Plan-only exceptions; all other findings remain blocking, including unknown codes. */
export function architecturalDraftFinding(scene: V3Scene, f: V3BlueprintFinding, failures: V3BlueprintFinding[] = []): boolean {
  if (LOCAL_FACADE_CODES.has(f.code)) {
    const host=scene.objects.find(o=>o.type==='building-mass'&&o.id===f.targetIds[0]);
    return !!scene.estatePlan?.blueprint && !!host && f.targetIds.length>1
      && f.targetIds.slice(1).every(id=>host.composition?.openings?.some(op=>op.id===id));
  }
  if (f.code==='ARCHITECTURAL_ENTRANCE_UNBUILT') return failures.some(issue=>LOCAL_FACADE_CODES.has(issue.code)
    && issue.targetIds[0]===f.targetIds[1] && issue.targetIds.includes(f.targetIds[2]) && architecturalDraftFinding(scene,issue));
  // These are unresolved allocations within an otherwise retained design, not
  // permission to alter rooms, reservation boundaries or choose a missing wall.
  if (['BLUEPRINT_SPACE_OUTSIDE_HOST','BLUEPRINT_SPACE_OVERLAP'].includes(f.code))
    return f.targetIds.length>0&&f.targetIds.every(id=>scene.interior?.rooms.some(r=>r.id===id&&scene.interior!.storeys.some(s=>s.id===r.storeyId&&scene.objects.some(o=>o.id===s.hostMassId&&o.type==='building-mass'))));
  if (['PARTITION_BOUNDARY_UNRESOLVED','DOOR_BOUNDARY_UNRESOLVED'].includes(f.code)) {
    const partition=scene.interior?.partitions?.find(p=>f.targetIds.includes(p.id)||scene.interior?.doors?.some(d=>f.targetIds.includes(d.id)&&d.partitionId===p.id));
    return !!partition&&partition.roomBId!==null&&[partition.roomAId,partition.roomBId].every(id=>scene.interior?.rooms.some(r=>r.id===id&&r.storeyId===partition.storeyId));
  }
  if (f.code==='ESTATE_ALLOCATION_CONFLICT') return scene.estatePlan?.zones.some(z=>z.allocation&&(f.targetIds.includes(z.id)||z.objectIds.some(id=>f.targetIds.includes(id))))??false;
  if (f.code==='ESTATE_ACCESS_MISSING') return f.targetIds.length>0&&f.targetIds.every(id=>scene.objects.some(o=>o.id===id&&['terrace','pool','courtyard'].includes(o.type)));
  if (f.code==='ESTATE_ROUTE_BLOCKED') {
    if (estateRouteClipsEntrance(scene,f.targetIds)) return true;
    // A secondary pedestrian connection can remain an explicitly unresolved
    // guide when the principal arrival is independently supported. Never grant
    // this exception to a primary approach, water crossing or broken endpoint.
    const route=scene.estatePlan?.circulation.find(r=>r.spatial?.use==='pedestrian'&&r.via.some(id=>f.targetIds.includes(id)));
    const primary=scene.estatePlan?.program.filter(p=>p.kind==='residence').flatMap(p=>p.objectIds).filter(id=>scene.objects.some(o=>o.id===id&&o.type==='building-mass'))??[];
    const access=new Set(scene.estatePlan?.siteAccess?.map(a=>a.id));
    return !!scene.estatePlan?.blueprint && !!route && f.targetIds.length>route.via.length && !f.targetIds.slice(route.via.length).some(id=>id===route.from||id===route.to)
      && primary.length>0 && primary.every(id=>scene.estatePlan!.circulation.some(r=>r.spatial&&r.via.length===1
        && (r.to===id&&access.has(r.from)||r.from===id&&access.has(r.to))
        && !failures.some(issue=>['ESTATE_ROUTE_BLOCKED','ESTATE_POOL_CROSSING','ESTATE_ROUTE_UNSUPPORTED','ESTATE_ACCESS_POINT_MISSING','ESTATE_ACCESS_DISCONNECTED'].includes(issue.code)&&issue.targetIds.some(target=>r.via.includes(target)))));
  }
  if (doorCodes.has(f.code)) {
    const doors = scene.interior?.doors?.filter(d => f.targetIds.includes(d.id)) ?? [];
    return doors.length > 0 && doors.every(d => {
      const p = scene.interior?.partitions?.find(p => p.id === d.partitionId);
      return p?.roomBId != null && ['wall', 'glazed', 'screen'].includes(p.partitionType) && d.program !== 'archway';
    });
  }
  if(f.code==='STAIR_ACCESS_BLOCKED'&&scene.interior?.partitions?.some(p=>f.targetIds.includes(p.id)&&p.partitionType==='screen'&&p.roomBId!==null&&scene.interior?.doors?.some(d=>d.partitionId===p.id))) return true;
  if (stairCodes.has(f.code)) {
    const bad = new Set(failures.filter(x => stairCodes.has(x.code)).flatMap(x => x.targetIds));
    for (const id of f.targetIds) bad.add(id);
    const targets = scene.interior?.circulation?.filter(c => f.targetIds.includes(c.id)) ?? [];
    return targets.length > 0 && targets.every(target => {
      const host = scene.objects.find(o => o.id === target.hostMassId);
      if (!host) return false;
      const good = resolveV3Circulation(scene).filter(c => c.usable && c.entry.hostMassId === host.id && !bad.has(c.entry.id));
      const reached = new Set([0]);
      for (let i = 0; i < good.length; i++) for (const c of good) {
        if (!reached.has(c.entry.fromLevel)) continue;
        if (c.entry.type === 'lift') for (let l = c.entry.fromLevel; l <= c.entry.toLevel; l++) reached.add(l);
        else reached.add(c.entry.toLevel);
      }
      return Array.from({length: v3MassLevelCount(host)}, (_, l) => l).every(l => reached.has(l)) && reached.has(target.toLevel);
    });
  }
  // A small ribbon overrun is visible and editable. Broken endpoints, pool
  // crossings and obstacle collisions never receive this exception.
  if (f.code === 'ESTATE_ACCESS_DISCONNECTED') {
    const routes = scene.estatePlan?.circulation.filter(r => r.spatial && r.via.some(id => f.targetIds.includes(id))) ?? [];
    return routes.length > 0 && routes.every(r => {
      const vertices = estateRouteVertices(scene,r);
      const excess = Math.max(...vertices.map((v,i)=>i%3===0?Math.abs(v)-scene.site.width/2:i%3===2?Math.abs(v)-scene.site.depth/2:-Infinity));
      return vertices.length >= 18 && excess > 0 && excess <= .15;
    });
  }
  // Finish drift on a facade trim beam is local; its geometry and ownership
  // must already have passed the independent receipt comparison.
  if (f.code === 'ARCHITECTURAL_PART_FINISH') return f.targetIds.some(id => scene.objects.some(o =>
    o.composition?.assemblies?.some(a => a.parts.some(p => p.type === 'beam' && id === `${o.id}${o.composition?.footprint?'-':'-composition-'}assembly-${a.id}-${p.id}`))));
  return false;
}

export function classifyArchitecturalFindings(scene: V3Scene, findings: V3BlueprintFinding[]): ArchitecturalDiagnostic[] {
  return findings.map(f => ({ ...f, classification: f.code==='ARCHITECTURAL_DERIVED_ENVELOPE_REBUILT'?'locally-recoverable':f.severity === 'advisory' ? 'advisory' : architecturalDraftFinding(scene, f, findings) ? 'draft-tolerable' : 'core-blocking' }));
}

/** Revalidate CURRENT editable semantics. Metadata never authorizes acceptance. */
export function revalidateArchitecturalScene(input: V3Scene, seed: V3BlueprintFinding[] = []) {
  const scene = structuredClone(input);
  let validation = validateV3Scene(scene, {lenient: true, requireObjects: true});
  const structural = validation.issues.filter(i=>i.severity==='fatal').map(i=>({code:i.code,targetIds:i.targetIds??[i.targetId],message:i.message,severity:'fatal' as const}));
  if (structural.some(f=>f.code!=='ESTATE_ROUTE_BLOCKED'||!architecturalDraftFinding(scene,f,[...seed,...structural]))) return {ok:false as const,outcome:'cannot-construct' as const,findings:structural,diagnostics:classifyArchitecturalFindings(scene,structural)};
  // Route owner boxes are compatibility projections, never authored path intent.
  const corrected: V3BlueprintFinding[]=[];
  for (const o of scene.objects??[]) {
    if (!o.transform || !o.dimensions) continue;
    const bounds=estateRouteBounds(scene,o);
    if (bounds && JSON.stringify([o.transform,o.dimensions])!==JSON.stringify([bounds.transform,bounds.dimensions])) {
      Object.assign(o,bounds); delete o.architecture;
      corrected.push({code:'ARCHITECTURAL_DERIVED_ENVELOPE_REBUILT',severity:'advisory',targetIds:[o.id],message:'Recomputed selectable route envelope from authoritative endpoints and waypoints.'});
    }
  }

  if(corrected.length)validation=validateV3Scene(scene,{lenient:true,requireObjects:true});
  const facades=scene.objects.filter(o=>o.type==='building-mass').map(o=>{
    const [width,,depth]=scaledDimensionsOf(o),fp=o.composition?.footprint;
    const plan:V3ArchitecturalBlueprint['buildings'][number]['plan']=fp?.kind==='outline'?{kind:'outline',segments:fp.segments??[]}:fp?.kind==='articulated'?{kind:'articulated',width,depth,operations:fp.operations}:{kind:'rectangle',width,depth};
    return {id:o.id,facade:o.composition??{},plan,storeys:v3MassStoreys(o,scene).map((s,l)=>({id:`level-${l}`,label:'Storey',role:'Storey',height:s.height,spaces:[]}))};
  });
  let findings: V3BlueprintFinding[] = [...seed, ...corrected, ...constructionPolicyConflicts(scene), ...validation.issues.map(i => ({code:i.code, targetIds:i.targetIds ?? [i.targetId], message:i.message, severity:i.severity === 'advisory' ? 'advisory' as const : 'fatal' as const})),
    ...auditV3Blueprint(scene).findings, ...architecturalOpeningPreflight(facades), ...architecturalDoorPreflight(scene.interior?.doors??[]), ...architecturalInteriorPreflight(scene),
    ...v3FlatSiteErrors(scene).map(message => {
      const pool=scene.objects.find(o=>o.type==='pool'&&message.startsWith(`Flat land: ${o.id} needs a ground-level site datum`)&&Math.abs(getObjectBaseY(o))<=.5);
      return pool?{code:'ARCHITECTURAL_RAISED_POOL',targetIds:[pool.id],message:'The authored pool basin rests on the flat ground datum. Its elevated water surface is retained; dry access is audited separately.',severity:'advisory' as const}:{code:'FLAT_SITE_CONTRACT',targetIds:['site'],message,severity:'fatal' as const};
    })];
  // Do not compile malformed or core-invalid semantics.
  const blocked = () => classifyArchitecturalFindings(scene, findings).some(f => f.classification === 'core-blocking');
  if (!blocked()) {
    const consistency = auditV3DesignConsistency(scene, validation.issues);
    findings.push(...consistency.findings.filter(f => f.classification !== 'advisory').map(f => ({code:f.code, targetIds:f.targetIds, message:f.message, severity:'fatal' as const})));
  }
  let model: ReturnType<typeof compileV3Scene> | undefined;
  if (!blocked()) {
    model = compileV3Scene(scene);
    let receipts = auditArchitecturalConstructionFidelity(scene, model);
    // Rebuild derived meshes once before accepting a detail defect or asking
    // Terra for a correction. No authored coordinate or component is changed.
    if (receipts.length) {
      model = compileV3Scene(scene);
      receipts = auditArchitecturalConstructionFidelity(scene, model);
    }
    findings.push(...receipts, ...auditV3StairUsability(scene, model.primitives).map(f => ({...f, targetIds:[f.targetId,...('obstacleId' in f&&typeof f.obstacleId==='string'?[f.obstacleId]:[])], severity:'fatal' as const})));
    for (const o of scene.objects) if (!model.primitives.some(p => p.sourceObjectId === o.id || p.sourceObjectIds?.includes(o.id)))
      findings.push({code:'ARCHITECTURAL_COMPONENT_UNBUILT', severity:'fatal', targetIds:[o.id], message:'An authored object emitted no construction.'});
    for (const e of scene.estatePlan?.blueprint?.entrances ?? []) if (!model.primitives.some(p => p.id.startsWith(`${e.objectId}:${e.openingId}:level-${e.level}:`)))
      findings.push({code:'ARCHITECTURAL_ENTRANCE_UNBUILT', severity:'fatal', targetIds:[e.id,e.objectId,e.openingId], message:'The designated entrance emitted no construction.'});
    for (const o of scene.objects) for (const a of o.composition?.assemblies??[]) for (const part of a.parts) {
      const prefix=`${o.id}${o.composition?.footprint?'-':'-composition-'}assembly-${a.id}-${part.id}`;
      const required=part.type==='railing'?[...new Set(part.edges)].map(edge=>`${prefix}-${edge}`):[prefix];
      if (required.some(id=>!model!.primitives.some(p=>p.id===id&&p.sourceObjectId===o.id)))
        findings.push({code:'ARCHITECTURAL_ASSEMBLY_UNBUILT',severity:'fatal',targetIds:[o.id,a.id,part.id],message:'An authored facade assembly part or guard was not constructed.'});
    }

  }
  findings = [...new Map(findings.map(f => [JSON.stringify([f.code,f.targetIds,f.message]), f])).values()];
  const diagnostics = classifyArchitecturalFindings(scene, findings);
  const outcome: ArchitecturalOutcome = diagnostics.some(f => f.classification === 'core-blocking') ? 'cannot-construct' : diagnostics.some(f => f.classification === 'draft-tolerable') ? 'draft' : 'complete';
  if (outcome === 'cannot-construct') return {ok:false as const, outcome, findings, diagnostics};
  scene.metadata = {...scene.metadata, architecturalValidation:{version:1, status:outcome, diagnostics} satisfies ArchitecturalValidationState};
  return {ok:true as const, outcome, findings, diagnostics, scene, model};
}
