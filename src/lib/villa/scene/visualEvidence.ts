import { validateScene, type ArchitecturalScene } from './model';
import { reviewSceneArchitecture } from './planning';
import { sceneRelationshipIssues } from './relationships';
import { sceneSpatialGeometry } from './spatial';

/** Show the model exactly which preserved commitments depend on a scene ID.
 * Paths expose recorded references, never infer replacement intent from labels. */
export function architecturalReferenceDependencies(scene: ArchitecturalScene) {
  const references: {elementId:string; path:string}[]=[];
  const arrays=new Set(['floorIds','enclosureIds','roofIds','accessIds','partitionIds','fitOutIds','levelAccessIds','elementIds']);
  function visit(value:unknown,path:string) {
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach((v,i)=>visit(v,`${path}[${i}]`));return;}
    for(const [key,v] of Object.entries(value)) {
      const field=`${path}.${key}`;
      if(arrays.has(key)&&Array.isArray(v))v.forEach((id,i)=>{if(typeof id==='string')references.push({elementId:id,path:`${field}[${i}]`});});
      else if((key==='subject'||key==='target')&&typeof v==='string')references.push({elementId:v,path:field});
      else visit(v,field);
    }
  }
  visit(scene.architecturalPlan,'architecturalPlan');
  return references;
}

/** Numerical construction context for a coordinated edit, not authored geometry. */
export function refinementConstructionContext(scene: ArchitecturalScene, targetIds: string[]) {
  const g=sceneSpatialGeometry(scene),targets=new Set(targetIds);
  return {
    targets:scene.elements.filter(e=>targets.has(e.id)).map(e=>({id:e.id,world:g.world(e),renderedBottom:g.bottom(e),renderedTop:g.top(e),size:e.size,profiled:!!e.geometry})),
    preservedReferences:architecturalReferenceDependencies(scene).filter(r=>targets.has(r.elementId)),
    contract:'Retain referenced identities only when the same component survives (replace can retain its ID). Removing a referenced component leaves stale evidence: there is no authorized evidence-remapping operation. Do not invent replacements or preserve an ID for a different meaning. If coordination requires changing programme boundaries or splitting referenced identities, disclose the unsupported transaction rather than claiming completion. Bounds of profiles and pitched roofs do not certify solid contact.',
  };
}

/** Measurements describe constructed geometry, never subjective architectural success. */
export function sceneVisualEvidence(raw: ArchitecturalScene) {
  const scene = validateScene(raw);
  return {
    intended: scene.architecturalPlan ?? null,
    selectedKnowledge: scene.knowledgeEvidence ?? [],
    preservedReferenceDependencies: architecturalReferenceDependencies(scene),
    constructed: scene.elements.map(e => ({ id:e.id, kind:e.kind, parent:e.parent, at:e.at, size:e.size, rotation:e.rotation })),
    geometryWarnings: sceneRelationshipIssues(scene),
    architecturalAudit: reviewSceneArchitecture(scene),
  };
}
export function compareSceneEvidence(before: ArchitecturalScene, after: ArchitecturalScene) {
  const a=sceneVisualEvidence(before), b=sceneVisualEvidence(after);
  const key=(i:ReturnType<typeof sceneRelationshipIssues>[number])=>`${i.rule}:${i.id}:${[...(i.relatedIds ?? [])].sort().join(',')}`;
  const oldKeys=new Set(a.geometryWarnings.map(key)), newKeys=new Set(b.geometryWarnings.map(key));
  const ids=new Set([...before.elements,...after.elements].map(e=>e.id));
  return {
    changedElementIds:[...ids].filter(id=>JSON.stringify(before.elements.find(e=>e.id===id))!==JSON.stringify(after.elements.find(e=>e.id===id))),
    resolved:a.geometryWarnings.filter(i=>!newKeys.has(key(i))),
    introduced:b.geometryWarnings.filter(i=>!oldKeys.has(key(i))),
    beforeWarnings:a.geometryWarnings.length, afterWarnings:b.geometryWarnings.length,
    resolvedAuditWarnings:a.architecturalAudit.issues.filter(i=>!b.architecturalAudit.issues.includes(i)),
    introducedAuditWarnings:b.architecturalAudit.issues.filter(i=>!a.architecturalAudit.issues.includes(i)),
    beforeAudit:a.architecturalAudit, afterAudit:b.architecturalAudit,
    architecturalQuality:'Requires human comparison; warning reduction is not proof of better composition.',
  };
}
