/** Accepted staged saves -> constrained semantic edit -> validated save and scene. No provider/DB. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {loadHouse,saveHouse} from './save';
import {runEdit} from './edits';
import {measure} from './pipeline';
import {allRooms,blockRect} from './layout';
import {poolWaterNorth,poolReservation,requirePool} from './poolGeometry';
export const poolEditPlanSchema=z.object({summary:z.string().min(1).max(300),ops:z.array(z.object({op:z.literal('move-pool-relative'),pool:z.literal('pool'),veranda:z.string().min(1).max(80),direction:z.enum(['towards','away']),distance:z.number().min(.01).max(10)}).strict()).length(1)}).strict();
export const stagedSaveHash=(save:string)=>{const h=loadHouse(save);return createHash('sha256').update(JSON.stringify({spec:h.spec,elements:h.scene.elements})).digest('hex');};
export async function editAcceptedStagedSave(input:{save:string;instruction:string;expectedHash:string;proposal:unknown}){
 const before=loadHouse(input.save);
 if(stagedSaveHash(input.save)!==input.expectedHash)throw Error('Stale saved-house baseline.');
 const rooms=allRooms(before.spec),bedrooms=rooms.filter(r=>r.type==='bedroom').length,baths=rooms.filter(r=>r.type==='bath').length;
 const check=measure(before.spec,5,bedrooms,baths);
 if(check.findings.length||!before.spec.sitePresentation)throw Error('Edit requires a valid accepted Stage 5 rich-site save, not a rejected or incomplete plan.');
 const proposal=poolEditPlanSchema.safeParse(input.proposal);
 if(!proposal.success)return {accepted:false,save:input.save,scene:before.scene,source:before.spec,findings:[{code:'proposal-schema',message:proposal.error.message}],providerCalls:0};
 const outcome=await runEdit({planner:{label:'Injected semantic plan; mocked offline or explicitly approved future live result',plan:async()=>({plan:proposal.data})},instruction:input.instruction,spec:before.spec,scene:before.scene,components:before.components,requiredBedrooms:bedrooms,preserve:[...new Set(Object.values(before.components))].filter(c=>c!=='pool'&&!before.spec.siteWork.paths.some(p=>c===`landscape:${p.id}`))});
 if(!outcome.accepted)return {accepted:false,save:input.save,scene:before.scene,source:before.spec,findings:outcome.findings,providerCalls:0};
 // Every pre-existing non-pool/path element and its ownership must remain exactly fixed.
 const paths=new Set(before.spec.siteWork.paths.map(p=>`landscape:${p.id}`));
 for(const e of before.scene.elements)if(before.components[e.id]!=='pool'&&!paths.has(before.components[e.id])){
  const now=outcome.scene.elements.find(n=>n.id===e.id);
  if(JSON.stringify(now)!==JSON.stringify(e)||outcome.components[e.id]!==before.components[e.id])throw Error('Unrelated scene geometry changed.');
 }
 const saved=saveHouse(outcome.spec,outcome.scene,[...before.history,{instruction:input.instruction,summary:outcome.summary}]);
 const reload=loadHouse(saved);if(JSON.stringify(reload.scene.elements)!==JSON.stringify(outcome.scene.elements))throw Error('Candidate reload mismatch.');
 return {accepted:true,save:saved,scene:outcome.scene,source:outcome.spec,diff:outcome.diff,findings:outcome.findings,providerCalls:0,baselineHash:input.expectedHash,candidateHash:stagedSaveHash(saved)};
}
export function poolEditContext(save:string){
 const h=loadHouse(save),p=requirePool(h.spec.siteWork.pool);
 return {format:'staged-house-save-1',baselineHash:stagedSaveHash(save),elements:h.scene.elements.length,cap:400,rooms:allRooms(h.spec).map(r=>({id:r.id,type:r.type})),pool:{component:'pool',waterElement:'pool-water',waterNorth:poolWaterNorth(p),reservation:poolReservation(p),dimensions:{width:p.w,depth:p.d,basinDepth:p.basinDepth}},verandas:h.spec.exterior.verandas.map(v=>{const b=h.spec.blocks.find(b=>b.id===v.block)!;return {component:`veranda:${v.id}`,side:v.side,edge:v.side==='s'?blockRect(b).z1+v.depth:null};}),preserve:'All building elements/materials, palms, beds, hedges, lawn masks, furniture, unrelated paths and IDs. Only pool/apron and directly affected terrace patches can change.',capabilities:'Relative pool movement for existing rich-site Stage 5 saves with a south-facing veranda. Software derives positions, clips affected paving and fills vacated pool reservation. It never relocates plants/furniture or changes architecture. Invalid moves reject atomically.'};
}
