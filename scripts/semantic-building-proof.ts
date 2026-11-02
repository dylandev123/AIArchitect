/** Offline executable evidence. No credential, provider, retrieval or DB imports. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileBuilding,reviseBuilding,DesignConflict} from '../src/lib/villa/experimental/semantic-building/compiler';
import {estateIntent,compactIntent} from '../src/lib/villa/experimental/semantic-building/fixtures';
import {physicalEvidence} from '../src/lib/villa/experimental/semantic-building/physical';
const dir='docs/architecture/semantic-building-proof';mkdirSync(dir,{recursive:true});
globalThis.fetch=async()=>{throw Error('Network forbidden in offline proof');};
const save=(name:string,data:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(data,null,2));
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const results=[];
for(const intent of [estateIntent(),compactIntent()]){
 const result=compileBuilding(intent);save(`${intent.id}.physical.json`,physicalEvidence(result));save(`${intent.id}.json`,result);save(`${intent.id}.scene.json`,result.scene);
 const revised=structuredClone(intent);
 revised.portals[0].offset+=.2;
 if(intent.id==='compact'){revised.levels[1].top+=.16;revised.spaces.filter(s=>s.level==='street'&&!s.outdoor).forEach(s=>s.height+=.16);}
 const transaction=reviseBuilding(result,revised,result.scene);save(`${intent.id}.revision-transaction.json`,{operations:transaction.operations,sceneHash:hash(transaction.scene)});
 const changed=transaction.next;save(`${intent.id}.revised.json`,changed);
 const changedIds=result.scene.elements.filter(e=>JSON.stringify(e)!==JSON.stringify(changed.scene.elements.find(n=>n.id===e.id))).map(e=>e.id);
 results.push({id:intent.id,developerAuthored:true,sceneHash:hash(result.scene),replayIdentical:hash(result)===hash(compileBuilding(JSON.parse(JSON.stringify(intent)))),elements:result.scene.elements.length,spaces:intent.spaces.length,boundaries:result.boundaries.length,portals:result.portalEvidence.length,changedIds,stableIds:result.scene.elements.every(e=>changed.scene.elements.some(n=>n.id===e.id)),derivedPlacementScalars:result.scene.elements.length*7,independentSemanticNumbers:countNumbers(intent),note:'7 = position xyz + dimensions xyz + yaw; semantic number count includes all polygon coordinates, levels, portal/stair sizes and frame values. This is a burden proxy, not measured model performance.'});
}
function countNumbers(v:unknown):number {if(typeof v==='number')return 1;if(Array.isArray(v))return v.reduce((sum,x)=>sum+countNumbers(x),0);if(v&&typeof v==='object')return Object.values(v).reduce<number>((sum,x)=>sum+countNumbers(x),0);return 0;}
// Recalculate retained failures without repairing or constructing the proposals.
const retained=[];
for(const model of ['terra','sol']){
 const path=`docs/architecture/design-first/sol-planning-comparison-2026-10-30/${model}.proposal.exact.txt`;
 const p=JSON.parse(readFileSync(path,'utf8'));const anchors=new Map<string,{centre:number[];size:number[]}>(p.anchors.map((a:{id:string})=>[a.id,a]));
 const datums=p.spaces.map((s:{id:string;floorId:string;centre:number[];size:number[]})=>{const f=anchors.get(s.floorId)!;return {id:s.id,authored:s.centre[1],derived:f.centre[1]+f.size[1]/2+s.size[1]/2};});
 retained.push({model,path,sourceHash:hash(p),anchors:p.anchors.length,independentPlacementScalars:p.anchors.length*7,datumMismatches:datums.filter((d:{authored:number;derived:number})=>Math.abs(d.authored-d.derived)>.02).length,datums});
}
const conflicts=[];
for(const kind of ['terrace-gap','missing-host','stair-too-long']){
 const intent=compactIntent();
 if(kind==='terrace-gap')intent.spaces.find(s=>s.id==='rear-deck')!.polygon.forEach(p=>p[1]+=2);
 if(kind==='missing-host')intent.portals[0].host.space='unknown-boundary';
 if(kind==='stair-too-long')intent.stairs[0].run=10;
 try{compileBuilding(intent);throw Error('Negative fixture unexpectedly compiled');}catch(error){if(!(error instanceof DesignConflict))throw error;conflicts.push({kind,decision:String(error)});}
}
save('conflicts.json',conflicts);
save('verification.json',{providerCalls:0,databaseCalls:0,results,retained,limits:'Developer fixtures demonstrate derivation, not a controlled AI comparison or complete estates.'});
console.log(JSON.stringify(results,null,2));
