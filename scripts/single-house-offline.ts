/** Offline golden-case diagnostics. Original evidence is read only. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {stageGenerationRefinement} from '../src/lib/villa/scene/generationReview';
import {stageSceneOperations,validateScene} from '../src/lib/villa/scene/model';
import {sceneResultSchema} from '../src/lib/villa/scene/terra';
import {compareSceneEvidence,sceneVisualEvidence} from '../src/lib/villa/scene/visualEvidence';
const root='docs/architecture/retained-visual-review/',dir='docs/architecture/single-house';
const read=(n:string)=>JSON.parse(readFileSync(root+n,'utf8'));
const scene=validateScene(read('original.scene.json')),review=read('refine.input.json').review;
const raw: unknown=read('raw-candidate.operations.json');
const candidate=structuredClone(raw) as ReturnType<typeof sceneResultSchema.parse>;
function added(id:string){const op=candidate.operations.find(o=>o.op==='add'&&o.element.id===id);if(!op||op.op!=='add')throw Error(`Missing ${id}`);return op.element;}
mkdirSync(dir,{recursive:true});
const history:Array<{label:string;outcome:string;diff?:ReturnType<typeof compareSceneEvidence>}>=[];
function replay(label:string,output:unknown){try{const r=stageGenerationRefinement(scene,review,output);history.push({label,outcome:'passed',diff:r.diff});return r.scene;}catch(e){history.push({label,outcome:String(e)});return null;}}
replay('Immutable original',raw);
added('rear-loggia-canopy-edge').semanticType='mass';
replay('Diagnostic semantic label only (developer choice, not recovered intent)',candidate);
for(const id of ['dining-post-west-front','dining-post-east-front','dining-post-west-rear','dining-post-east-rear']){
 const move=candidate.operations.find(o=>o.op==='move'&&o.id===id);
 if(!move||move.op!=='move')throw Error(`Missing move ${id}`);
 // Slab walking top .15, rendered flat canopy underside 3.13.
 move.at[1]=1.64;
 candidate.operations.push({op:'resize',id,size:[.22,2.98,.22]});
 replay(`Seat ${id} between slab and canopy`,candidate);
}
candidate.operations=candidate.operations.filter(o=>o.op!=='add'||o.element.id!=='rear-loggia-sill');
replay('Omit redundant sill contained in unchanged main slab',candidate);
const edge=added('rear-loggia-canopy-edge');
edge.at[1]=3.18;edge.size[1]=.18;
replay('Trim fascia top to main roof underside 3.27',candidate);
replay('Final diagnostic replay',candidate);
const constructed=stageSceneOperations(scene,sceneResultSchema.parse(candidate).operations);
writeFileSync(`${dir}/diagnostic.operations.json`,JSON.stringify(candidate,null,2));
writeFileSync(`${dir}/construction.scene.json`,JSON.stringify(constructed,null,2));
writeFileSync(`${dir}/evidence.json`,JSON.stringify({providerCalls:0,history,diff:compareSceneEvidence(scene,constructed),evidence:sceneVisualEvidence(constructed)},null,2));
console.log(history.map(h=>({label:h.label,outcome:h.outcome==='passed'?'passed':h.outcome.slice(0,160)})));
