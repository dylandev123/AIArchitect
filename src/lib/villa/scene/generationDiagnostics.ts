import { reviewProgramme } from './programme';
import { stageSceneOperations, type ArchitecturalScene, type SceneElement } from './model';
import { resolveSceneResult, sceneRuntimeOutputSchema, type SceneRequest } from './terra';
import { sceneVisualEvidence } from './visualEvidence';
import { sceneSpatialGeometry } from './spatial';

/** Observable execution evidence only. Never infers hidden intent or repairs a response. */
export function generationDiagnostics(responseId: string, input: SceneRequest, raw: unknown, providerStatus?: string) {
    const parsed = sceneRuntimeOutputSchema(input).safeParse(raw);
    if (!parsed.success) return { responseId, outcome: 'contract-rejected', programme: reviewProgramme({version:'architectural-scene-1',name:'Unconstructed response',elements:[]}), error: parsed.error.message, explicitIntent: raw && typeof raw==='object' && 'architecturalPlan' in raw ? raw.architecturalPlan : null };
    const output = parsed.data;
    const base: ArchitecturalScene = input.current && input.mode === 'edit' ? input.current : {version:'architectural-scene-1',name:output.name,elements:[]};
    const operations = output.operations.map((operation,index)=>({index,operation, disposition: input.mode==='generate' && operation.op==='set-terrain' ? 'excluded-flat-staging' : 'pending-transaction', changes: [] as {id:string;before?:SceneElement;after?:SceneElement}[]}));
    const executable = operations.filter(o=>o.disposition!=='excluded-flat-staging');
    let executionError: string | undefined;
    try {
        stageSceneOperations(base, executable.map(o=>o.operation), (index,before,after)=>{
            const beforeMap=new Map(before.map(e=>[e.id,e])), afterMap=new Map(after.map(e=>[e.id,e]));
            const ids = new Set([...beforeMap.keys(),...afterMap.keys()]);
            for (const id of ids) {
                const a=beforeMap.get(id), b=afterMap.get(id);
                if(JSON.stringify(a)!==JSON.stringify(b)) executable[index].changes.push({id,before:a,after:b});
            }
        });
    } catch(error) { executionError=String(error); }
    let built: ReturnType<typeof resolveSceneResult> | undefined;
    try { built=resolveSceneResult(input,raw); } catch(error) { executionError=String(error); }
    if(providerStatus && !providerStatus.startsWith('accepted')){built=undefined;executionError ??= `Provider transaction ${providerStatus}; no construction applied.`;}
    operations.forEach(o=>{if(o.disposition==='pending-transaction')o.disposition=built?'accepted':'transaction-rolled-back';});
    const scene=built?.scene;
    const spatial=scene ? sceneSpatialGeometry(scene) : undefined;
    const programme = reviewProgramme(scene ?? {version:"architectural-scene-1",name:output.name,elements:[],architecturalPlan:output.architecturalPlan});
    return {
        responseId, parentResponseId:input.current?.generationResponseId??null, outcome: built ? 'accepted' : 'rejected', brief: input.prompt,
        explicitIntent: output.architecturalPlan ?? null, summary: output.summary, unsupported: output.unsupported,
        programme,
        operations, executionError, constructed: scene ? sceneVisualEvidence(scene) : null,
        components: scene?.elements.map(element=>({element,world:spatial!.world(element),
            operationIndexes:operations.filter(o=>o.changes.some(c=>c.id===element.id || ancestors(element,scene).includes(c.id))).map(o=>o.index),
            directOperationIndexes:operations.filter(o=>o.changes.some(c=>c.id===element.id)).map(o=>o.index),
            ancestorIds:ancestors(element,scene),
            relatedIds:scene.elements.filter(e=>e.parent===element.id || (element.parent && e.parent===element.parent)).map(e=>e.id),
            programmeSpaces: programme.spaces.filter(s=>[...s.floorIds,...s.enclosureIds,...s.roofIds,...s.accessIds].includes(element.id)).map(s=>s.name),
            explicitKnowledgeDecisions:decisionsFor(output.architecturalPlan,element.id),
        })),
        limitations:['Intent is only the recorded architecturalPlan and summary.','Knowledge citations show declared use, not causal influence.','Rendering and visual quality require correlated screenshots and human review.','Rejected transactions apply no elements; intermediate changes are diagnostic only.'],
    };
}
function ancestors(element: SceneElement, scene: ArchitecturalScene): string[] {
    const result:string[]=[]; let parent=element.parent;
    while(parent && !result.includes(parent)){result.push(parent);parent=scene.elements.find(e=>e.id===parent)?.parent;}
    return result;
}

function decisionsFor(plan: unknown, id: string): unknown[] {
    if(!plan || typeof plan!=='object' || !('designDecisions' in plan) || !Array.isArray(plan.designDecisions))return [];
    return plan.designDecisions.filter(d=>d && typeof d==='object' && Array.isArray(d.elementIds) && d.elementIds.includes(id));
}
