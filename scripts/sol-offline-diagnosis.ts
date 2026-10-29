/** Retained-response audit only. No provider imports, network or production writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {assemblyOperations} from '../src/lib/villa/scene/assemblies';
import {stageSceneOperations,validateScene,type ArchitecturalScene} from '../src/lib/villa/scene/model';
import {sceneResponseFormatSchema,resolveSceneResult} from '../src/lib/villa/scene/terra';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const source='.data/sol-high-background/comparison-2',dest='docs/architecture/sol-offline-diagnosis';
globalThis.fetch=async()=>{throw Error('Network prohibited by offline audit');};
const bytes=readFileSync(`${source}/terminal.json`),terminal=JSON.parse(bytes.toString());
const text=terminal.output.flatMap((o:any)=>o.content??[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('');
const input=JSON.parse(readFileSync('docs/architecture/sol-high-once/attempt.json','utf8')).input;
const schema=await sceneResponseFormatSchema(input),parsed=await schema.validate!(JSON.parse(text));
if(!parsed.success)throw parsed.error;
const output=parsed.value as any,ops=output.operations;
assert.deepEqual(output,JSON.parse(readFileSync(`${source}/validated-output.json`,'utf8')));
const expanded=ops.flatMap((op:any,authoredIndex:number)=>(op.op==='assemble'?assemblyOperations(op.assembly):[op]).map((operation:any)=>({authoredIndex,operation}))).map((e:any,expandedIndex:number)=>({...e,expandedIndex}));
let scene:ArchitecturalScene={version:'architectural-scene-1',name:output.name,elements:[]};
const live=new Map<string,any>(),pairs:any[]=[],assemblies:any[]=[],errors:any[]=[];let peak=0,peakParentsMissing=0;
for(const e of expanded){const op=e.operation;
 if(op.op==='add'){assert(!live.has(op.element.id),`Live collision ${op.element.id}`);live.set(op.element.id,e);}
 if(op.op==='remove'){const add=live.get(op.id);assert(add,`Unknown removal ${op.id}`);pairs.push({id:op.id,addAuthoredIndex:add.authoredIndex,addExpandedIndex:add.expandedIndex,removeAuthoredIndex:e.authoredIndex,removeExpandedIndex:e.expandedIndex});live.delete(op.id);}
 peak=Math.max(peak,live.size);peakParentsMissing=Math.max(peakParentsMissing,[...live.values()].filter(a=>a.operation.element.parent&&!live.has(a.operation.element.parent)).length);
}
for(let i=0;i<ops.length;i++){
 const op=ops[i];
 if(op.op==='assemble'){
 const adds=assemblyOperations(op.assembly),before=scene.elements.length;
 scene=stageSceneOperations(scene,[op]);
 const record={authoredIndex:i,expandedStart:expanded.find((e:any)=>e.authoredIndex===i).expandedIndex,expandedCount:adds.length,parameters:op.assembly.parameters,kind:op.assembly.kind,elementsBefore:before,elementsAfter:scene.elements.length,relationships:sceneRelationshipIssues(scene)};
 assemblies.push(record);
 }else{try{scene=stageSceneOperations(scene,[op]);}catch(error){errors.push({authoredIndex:i,error:String(error)});throw error;}}
}
validateScene(scene);assert.equal(scene.elements.length,0);assert.equal(live.size,0);assert.equal(errors.length,0);
let rejection='';try{resolveSceneResult(input,output);}catch(error){rejection=String(error);}assert(rejection.includes('Expanded assembly operation budget exceeded'));
// A single intact assembly is evidence of the first transient shell only, never a recovered house.
const shell=stageSceneOperations({version:'architectural-scene-1',name:'DIAGNOSTIC ONLY · first transient Sol shell',elements:[]},[ops[0]]);
writeFileSync(`${dest}/first-transient-shell.DIAGNOSTIC.json`,JSON.stringify(shell,null,2));
const report={providerCalls:0,indexConvention:'zero-based; expanded indexes include the authored terrain operation',providerId:terminal.id,providerStatus:terminal.status,terminalSha256:createHash('sha256').update(bytes).digest('hex'),exactOutputSha256:createHash('sha256').update(text).digest('hex'),mode:input.mode,originalElements:input.current?.elements.length??0,requestedOperations:ops.length,expandedOperations:expanded.length,productionGenerateExpandedOperations:expanded.filter((e:any)=>e.operation.op!=='set-terrain').length,counts:ops.reduce((a:any,o:any)=>(a[o.op]=(a[o.op]??0)+1,a),{}),assemblies,pairs,peakLiveElements:peak,peakMissingParents:peakParentsMissing,liveCollisions:0,unknownRemovals:0,finalScene:scene,productionRejection:rejection,architecturalPlan:output.architecturalPlan,notes:['Per-operation replay and live identity audit are diagnostic instrumentation, not a production-budget bypass or project import.','All assembly snapshots pass attachment/schema validation; final scene is empty.','No removals were omitted or reordered.']};
writeFileSync(`${dest}/audit.json`,JSON.stringify(report,null,2));
writeFileSync(`${dest}/expanded-indexed.json`,JSON.stringify(expanded,null,2));
writeFileSync(`${dest}/assembly-table.md`,'| Authored index | Expanded start | Adds | ID | Position | Size W×D×H |\n|---:|---:|---:|---|---|---|\n'+assemblies.map(a=>`| ${a.authoredIndex} | ${a.expandedStart} | ${a.expandedCount} | ${a.parameters.id} | ${JSON.stringify(a.parameters.at)} | ${a.parameters.width}×${a.parameters.depth}×${a.parameters.height} |`).join('\n')+'\n');
console.log(JSON.stringify({...report,assemblies:assemblies.map(a=>({...a,relationships:a.relationships.length})),pairs:undefined,architecturalPlan:undefined,finalScene:undefined},null,2));
