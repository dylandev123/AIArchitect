/** Offline evidence analysis; no provider transport, no geometry repair. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assemblyOperations} from '../src/lib/villa/scene/assemblies';
import {stageSceneOperations} from '../src/lib/villa/scene/model';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
const dir='docs/architecture/terra-controlled-estate-2026-10-29';
globalThis.fetch=async()=>{throw Error('Offline audit: network forbidden');};
const read=(n:string)=>JSON.parse(readFileSync(`${dir}/${n}`,'utf8'));
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,JSON.stringify(v,null,2),{flag:'wx'});
const retained=read('retained.json'),provider=read('provider-response.exact.json'),route=read('route-response.json');
const text=provider.output.flatMap((o:any)=>o.content??[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('');
let output=retained.output;
if(!output&&text){const schema=await sceneResponseFormatSchema(read('request.json'));const checked:any=await schema.validate!(JSON.parse(text));if(checked.success)output=checked.value;else save('adapter-error.json',checked.error);}
if(output){
 save('normalized-output.json',output);save('authored-operations.json',output.operations);save('architectural-plan.json',output.architecturalPlan);
 const assemblies:any[]=[],expanded=output.operations.flatMap((op:any,index:number)=>{
 const primitives=op.op==='assemble'?assemblyOperations(op.assembly):[op];
 if(op.op==='assemble')assemblies.push({authoredIndex:index,assembly:op.assembly,expandedCount:primitives.length,elementIds:primitives.map((p:any)=>p.element?.id)});
 return primitives.map((operation:any)=>({authoredIndex:index,operation}));
 }).map((o:any,expandedIndex:number)=>({...o,expandedIndex}));
 save('expanded-indexed.json',expanded);save('assembly-provenance.json',assemblies);
 let staged:any,stagingError;try{staged=stageSceneOperations({version:'architectural-scene-1',name:output.name,elements:[]},output.operations.filter((o:any)=>o.op!=='set-terrain'));staged.architecturalPlan=output.architecturalPlan;save('staged.DIAGNOSTIC.json',staged);}catch(e){stagingError=String(e);}
 const scene=route.scene??route.recoverableDraft??staged;
 if(scene){save('architecture-audit.json',reviewSceneArchitecture(scene));save('relationship-findings.json',sceneRelationshipIssues(scene));}
 const adds=new Map<string,number>(),removals:any[]=[],collisions:any[]=[];let peak=0;
 for(const e of expanded){const op=e.operation;if(op.op==='add'){if(adds.has(op.element.id))collisions.push(e);adds.set(op.element.id,e.expandedIndex);}if(op.op==='remove'){removals.push({id:op.id,addIndex:adds.get(op.id),removeIndex:e.expandedIndex});adds.delete(op.id);}peak=Math.max(peak,adds.size);}
 save('construction-analysis.json',{authored:output.operations.length,expanded:expanded.length,productionExpanded:expanded.filter((e:any)=>e.operation.op!=='set-terrain').length,counts:output.operations.reduce((a:any,o:any)=>(a[o.op]=(a[o.op]??0)+1,a),{}),assemblies:assemblies.length,peakLiveByAddRemove:peak,removals,collisions,acceptedElements:route.scene?.elements.length??0,stagedElements:scene?.elements.length??0,stagingError,validation:route.experiment?.validation,error:route.error,summary:output.summary,unsupported:output.unsupported,providerStatus:provider.status,usage:provider.usage});
}
const hashes=Object.fromEntries(readdirSync(dir).filter(n=>n!=='sha256.json').map(n=>[n,createHash('sha256').update(readFileSync(`${dir}/${n}`)).digest('hex')]));save('sha256.json',hashes);
console.log(JSON.stringify({providerId:provider.id,providerStatus:provider.status,outputAvailable:!!output,accepted:!!route.scene,error:route.error,usage:provider.usage}));
