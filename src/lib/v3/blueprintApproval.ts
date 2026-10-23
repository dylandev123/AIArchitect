import { compileV3Scene, type V3Scene } from './scene';
import { validateV3Scene } from './validation';
import { auditV3StairUsability } from './stairUsability';
import { materializeV3ArchitecturalScene } from './architecture';
import { auditV3Blueprint, type V3BlueprintAudit, type V3BlueprintFinding } from './blueprint';

/** Ephemeral comparison evidence, never a persisted scene or an authorization/security token. */
export interface V3BlueprintApproval { readonly version: 1; readonly decisions: Readonly<Record<string,string>>; }
const stable = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry==='object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))) : entry);
function decisions(input: V3Scene): Record<string,string> {
  const scene = materializeV3ArchitecturalScene(input), bp = scene.estatePlan!.blueprint!;
  const referenced = new Set([
    ...bp.buildings.map(b=>b.objectId), ...bp.outdoorObjectIds, ...bp.roofObjectIds,
    ...scene.estatePlan!.program.flatMap(p=>p.objectIds), ...scene.estatePlan!.zones.flatMap(z=>z.objectIds),
    ...scene.estatePlan!.requirements.flatMap(r=>r.objectIds), ...scene.estatePlan!.circulation.flatMap(r=>[r.from,...r.via,r.to]),
    ...bp.allocations.flatMap(a=>a.objectIds),
  ]);
  const out: Record<string,string> = { site: stable(scene.site), estatePlan: stable(scene.estatePlan), siteHierarchy: stable(scene.siteHierarchy ?? null),
    relationships: stable([...scene.relationships].sort((a,b)=>stable(a).localeCompare(stable(b)))),
    interior: stable({ storeys: scene.interior?.storeys ?? [], rooms: scene.interior?.rooms ?? [], circulation: scene.interior?.circulation ?? [] }),
  };
  for (const o of scene.objects) if (referenced.has(o.id) || ['building-mass','roof-form','pool','terrace','courtyard','path','driveway','landscape-zone'].includes(o.type)) {
    out[`object:${o.id}`] = stable({ id:o.id,type:o.type,geometryKind:o.geometryKind,transform:o.transform,dimensions:o.dimensions,
      hostId:o.hostId,support:o.support,levels:o.levels,roofForm:o.roofForm,pitch:o.pitch,pitchUnit:o.pitchUnit,overhang:o.overhang,
      footprint:o.composition?.footprint,spaceHeight:o.composition?.spaceHeight,
      massHierarchy:o.composition?.massHierarchy,facadeRoles:o.composition?.facadeRoles,
      mainEntryOpeningId:o.composition?.mainEntry?.openingId,roofDatumGroup:o.composition?.roofDatumGroup,
      terraceOpenEdges:o.terraceOpenEdges,fromSupportId:o.fromSupportId,toSupportId:o.toSupportId,
      entrances:(o.composition?.openings ?? []).filter(op=>bp.entrances.some(e=>e.objectId===o.id && e.openingId===op.id)).map(op=>{
        // Finishes, operation and leaf construction can be elaborated independently.
        const {id,type,facade,floors,segmentId} = op;
        return {id,type,facade,floors,segmentId,...('start' in op ? {start:op.start,end:op.end} : {})};
      }),
    });
  }
  return out;
}

/** Approve only an explicitly authored, spatially valid planning scene. Does not fill gaps. */
export function approveV3Blueprint(scene: V3Scene, options:{constructionEvidence?:boolean; allowFinding?:(finding:V3BlueprintFinding)=>boolean}={}): V3BlueprintAudit & { approval?: V3BlueprintApproval } {
  const audit = auditV3Blueprint(scene,options);
  if(options.allowFinding) audit.ok=!audit.findings.some(f=>f.severity==='fatal'&&!options.allowFinding!(f));
  // Preliminary index checks need no finished details. Before freezing a structurally
  // inspectable full scene, however, actual stair openings and approaches must work.
  if(options.constructionEvidence!==false && audit.ok && scene.interior?.circulation?.length && validateV3Scene(scene,{lenient:true}).ok){
    for(const failure of auditV3StairUsability(scene,compileV3Scene(scene).primitives))audit.findings.push({code:failure.code,severity:'fatal',targetIds:[failure.targetId],message:failure.message});
    audit.ok=!audit.findings.some(f=>f.severity==='fatal');
  }
  return { ...audit, ...(audit.ok ? { approval:Object.freeze({version:1 as const,decisions:Object.freeze(decisions(scene))}) } : {}) };
}

/** A later detailed scene elaborates the approved decisions or must be explicitly replanned. */
export function auditV3BlueprintElaboration(approval: V3BlueprintApproval, scene: V3Scene): V3BlueprintAudit {
  const audit = auditV3Blueprint(scene);
  if (!audit.ok) return audit;
  const after = decisions(scene);
  for (const key of new Set([...Object.keys(approval.decisions),...Object.keys(after)])) if (approval.decisions[key]!==after[key])
    audit.findings.push({code:'BLUEPRINT_DECISION_DRIFT',severity:'fatal',targetIds:[key],message:`Approved spatial decision changed: ${key}. Explicit replanning is required.`});
  return {ok:!audit.findings.some(f=>f.severity==='fatal'),findings:audit.findings};
}
