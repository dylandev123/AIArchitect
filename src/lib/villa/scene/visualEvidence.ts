import { validateScene, type ArchitecturalScene } from './model';
import { reviewSceneArchitecture } from './planning';
import { sceneRelationshipIssues } from './relationships';

/** Measurements describe constructed geometry, never subjective architectural success. */
export function sceneVisualEvidence(raw: ArchitecturalScene) {
  const scene = validateScene(raw);
  return {
    intended: scene.architecturalPlan ?? null,
    selectedKnowledge: scene.knowledgeEvidence ?? [],
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
