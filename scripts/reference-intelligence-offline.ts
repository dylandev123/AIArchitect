/** Replay exact model output; isolated persistence/edit probes never alter the candidate. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stageGenerationRefinement} from '../src/lib/villa/scene/generationReview';
import {stageSceneOperations,validateScene} from '../src/lib/villa/scene/model';
import {useProjectStore,PROJECT_STORAGE_KEY} from '../src/store/useProjectStore';
globalThis.fetch=async()=>{throw Error('Offline; all network prohibited');};
const dir='docs/architecture/full-house-investigation/network-verified-intelligence';
const read=(name:string)=>JSON.parse(readFileSync(`${dir}/${name}`,'utf8'));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const before=validateScene(read('review.input.json').current);
const review=read('review.result.json').output;
const raw=read('refine.provider-response.txt');
const text=raw.output.flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).filter((o:{type:string})=>o.type==='output_text').map((o:{text:string})=>o.text).join('');
const exactOutput=JSON.parse(text);
assert.deepEqual(exactOutput,read('refine.result.json').output);
const staged=stageGenerationRefinement(before,review,exactOutput);
assert.deepEqual(staged.scene,read('refined.scene.json'));
const candidate=staged.scene;
const unchanged=before.elements.filter(e=>!review.refinement.targetIds.includes(e.id));
for(const e of unchanged)assert.deepEqual(candidate.elements.find(n=>n.id===e.id),e);
assert.deepEqual(candidate.architecturalPlan,before.architecturalPlan);
assert.deepEqual(validateScene(JSON.parse(JSON.stringify(candidate))),candidate);
const saved=new Map<string,string>();
const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
const prior=useProjectStore.getState();
Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)}}});
try {
 useProjectStore.setState({projects:[]});
 const store=useProjectStore.getState(),p=store.createProject('OFFLINE Terra candidate persistence fixture','house','direct-scene');
 store.appendVersion(p.id,'Preserved original',JSON.stringify(before));
 store.appendVersion(p.id,'Exact Terra candidate',JSON.stringify(candidate));
 const reload=()=>validateScene(JSON.parse(useProjectStore.getState().getProject(p.id)!.houseConfigJson));
 assert.deepEqual(reload(),candidate);
 const serialized=saved.get(PROJECT_STORAGE_KEY)!;assert(serialized);
 // Destroy in-memory project state without updating storage, then hydrate the actual persisted bytes.
 useProjectStore.setState({projects:[]});saved.set(PROJECT_STORAGE_KEY,serialized);
 await useProjectStore.persist.rehydrate();assert.deepEqual(reload(),candidate);
 store.undo(p.id);assert.deepEqual(reload(),before);
 store.redo(p.id);assert.deepEqual(reload(),candidate);
 const editedIds:string[]=[];
 for(const e of candidate.elements) {
  const edited=stageSceneOperations(reload(),[{op:'finish',id:e.id,material:e.material==='timber'?'ivory':'timber'}]);
  assert.notEqual(edited.elements.find(n=>n.id===e.id)!.material,e.material);
  assert.deepEqual(edited.elements.filter(n=>n.id!==e.id),candidate.elements.filter(n=>n.id!==e.id));
  editedIds.push(e.id);
 }
 assert.deepEqual(reload(),candidate);
 const prepared=read('prepared-evidence.json');
 for(const [p,h] of Object.entries(prepared.historicalHashes))assert.equal(hash(p),h);
 assert.equal(hash('docs/architecture/retained-visual-review/original.scene.json'),'b76ed99bad6f6bda1c1e6f233ef9d65e9b01b0c1c0687f97e488dc44feadf983');
 const dif=staged.diff;
 writeFileSync(`${dir}/offline-verification.json`,JSON.stringify({providerCalls:0,exactRawReplay:true,operations:exactOutput.operations,originalElements:47,candidateElements:candidate.elements.length,unrelatedElementsUnchanged:unchanged.length,metadataPreserved:true,serializedReload:true,actualStoreRehydration:true,undoRedo:true,independentEditProbeIds:editedIds,editProbesPersisted:false,productionStorageAccess:false,originalHashesUnchanged:true,validation:{introduced:dif.introduced,introducedAuditWarnings:dif.introducedAuditWarnings,beforeArchitecturalFindings:dif.beforeAudit.issues.length,afterArchitecturalFindings:dif.afterAudit.issues.length},exceptions:[]},null,2),{flag:'wx'});
 console.log('Exact replay, isolated store hydration, Undo/Redo and all primitive edit probes pass.');
} finally {
 useProjectStore.setState(prior);
 if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
}
