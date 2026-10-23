import { spatialPlanPoints } from './routeGeometry';
import { authoredPlan, authoredSeparation } from './authoredPlan';
import { auditV3Completeness } from './completeness';
import { auditV3EstatePlan } from './estatePlan';
import type { V3Scene } from './scene';
import type { V3Issue } from './validation';

export interface V3ConsistencyFinding {
  code: string;
  classification: 'structural' | 'repairable' | 'advisory';
  targetIds: string[];
  message: string;
  guidance: string;
}
export interface V3DesignConsistency { ok: boolean; findings: V3ConsistencyFinding[] }
const repairable = new Set(['ESTATE_ACCESS_DISCONNECTED', 'ESTATE_ALLOCATION_CONFLICT', 'ESTATE_OPEN_SPACE_BLOCKED', 'AUTHORED_ACCESS_DISCONNECTED']);
/** New-generation acceptance only. Never changes saved-scene validation or compilation. */
export function auditV3DesignConsistency(scene: V3Scene, issues: readonly V3Issue[]): V3DesignConsistency {
  const findings: V3ConsistencyFinding[] = issues.filter(i => i.severity === 'fatal').map(i => ({
    code: i.code, classification: repairable.has(i.code) || i.code === 'ESTATE_FORM_UNBUILT' && /connected composition/.test(i.message) ? 'repairable' : 'structural', targetIds: i.targetIds ?? [i.targetId], message: i.message,
    guidance: 'Resolve this construction contract without changing unrelated forms, identities or materials.',
  }));
  // Do not compile malformed prerequisites. Footprint construction failures are independently auditable.
  if (issues.some(i => i.severity === 'fatal' && (i.code.startsWith('INVALID_') || i.code.startsWith('DUPLICATE_')))) return { ok: false, findings };
  const completeness = auditV3Completeness(scene), stairFailures=completeness.circulationFailures;
  for(const failure of stairFailures) if(!findings.some(f=>f.code===failure.code&&f.targetIds.includes(failure.targetId))) findings.push({
    code:failure.code,classification:'repairable',targetIds:[failure.targetId,...('obstacleId' in failure&&typeof failure.obstacleId==='string'?[failure.obstacleId]:[])],message:failure.message,
    guidance:'Correct only this authored circulation entry location, footprint, stairType/direction/turn or diagnosed levels. Preserve its id, host, intended endpoints, requirements and every unrelated stair. Never delete access to silence a failure.',
  });
  const evidence = (ids: string[]) => ids.flatMap(id => {
    const o = scene.objects.find(o => o.id === id);
    if (!o) return [];
    const points=spatialPlanPoints(scene,o);
    const plan=points.length<=16 ? points : { min:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))], max:[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))] };
    return [`${id} world plan=${JSON.stringify(plan)}`];
  }).join('; ');
  for (const d of [...auditV3EstatePlan(scene), ...completeness.findings]) {
    const existing = findings.find(f => f.code === d.code && f.message === d.message);
    if (existing) { existing.targetIds = d.targetIds; existing.message += ` ${evidence(d.targetIds)}`;
      if(d.code==='ESTATE_FORM_UNBUILT'&&/connected composition/.test(d.message)) {
        const objects=d.targetIds.map(id=>scene.objects.find(o=>o.id===id)).filter(o=>!!o);
        existing.message += ` Pair gaps: ${objects.flatMap((a,i)=>objects.slice(i+1).map(b=>`${a.id}→${b.id}=${authoredSeparation(a,b).toFixed(2)}m`)).join('; ')}; joined tolerance=0.05m.`;
      } existing.guidance = d.guidance; continue; }
    const classification = repairable.has(d.code) ? 'repairable' : 'advisory';
    findings.push({ ...d, classification, message: `${d.message} ${evidence(d.targetIds)}` });
  }
  for (const o of scene.objects) {
    // Explicit routed surfaces are checked using their route corridors by the estate/site audits.
    if (scene.siteHierarchy?.connections.some(c => c.surfaceObjectId === o.id) || scene.estatePlan?.circulation.some(r => r.spatial && r.via.includes(o.id))) continue;
    const outside = authoredPlan(o).filter(([x,z]) => Math.abs(x) > scene.site.width / 2 + .05 || Math.abs(z) > scene.site.depth / 2 + .05);
    if (outside.length) findings.push({ code: 'AUTHORED_SITE_OVERRUN', classification: 'repairable', targetIds: [o.id],
      message: `${o.id}: outside site x=[${-scene.site.width/2},${scene.site.width/2}], z=[${-scene.site.depth/2},${scene.site.depth/2}]; offending world points=${JSON.stringify(outside)}.`,
      guidance: 'Author an in-site extent for this object. Preserve the site dimensions and unrelated architecture; do not silently clip it.',
    });
  }
  return { ok: !findings.some(f => f.classification !== 'advisory'), findings };
}
/** Structural and geometric contradictions first; metadata observations cannot crowd them out. */
export function v3ConsistencyRepairInstructions(audit: V3DesignConsistency): string[] {
  return [...audit.findings].sort((a,b) => ['structural','repairable','advisory'].indexOf(a.classification)-['structural','repairable','advisory'].indexOf(b.classification))
    .filter(f => f.classification !== 'advisory' || ['AUTHORED_ACCESS_THRESHOLD','NO_OUTDOOR_LIVING_ACCESS'].includes(f.code))
    .map(f => `${f.classification}: ${f.code} [${f.targetIds.join(', ')}]: ${f.message} Decision required: ${f.guidance}`);
}
