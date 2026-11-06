/** One exact OFFLINE Terra roof proposal, existing semantic operation; never calls AI/DB. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {runEdit} from '../src/lib/villa/staged/edits';
import {loadHouse,saveHouse} from '../src/lib/villa/staged/save';
import {measure} from '../src/lib/villa/staged/pipeline';
import {allRooms} from '../src/lib/villa/staged/layout';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {pitchedRoofParts,pitchedRoofPartsIntersect} from '../src/lib/villa/scene/roofIntersection';
import {buildSceneRoof} from '../src/lib/villa/scene/roofs';
import {sha256} from '../src/lib/villa/staged/visualReviewRequest';
import {Box3,Triangle,Vector3} from 'three';
import type {SceneElement} from '../src/lib/villa/scene/model';
const root='docs/architecture/staged-villa',tag=process.argv[2];assert(tag&&/^[a-z0-9-]+$/.test(tag),'Supply a new immutable experiment evidence tag.');const out=`${root}/stage6-refinement/${tag}`;
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
mkdirSync(out); // No overwrite: a rejected attempt is evidence too.
const write=(n:string,v:unknown)=>writeFileSync(`${out}/${n}.json`,JSON.stringify(v,null,2),{flag:'wx'});
const before=loadHouse(readFileSync(`${root}/stage5-site/terra-stage5.save.json`,'utf8'));
const cp=read(`${root}/stage5-site/terra-stage5.checkpoint.json`),review=read(`${root}/stage6-refinement/live-review-1/review.json`);
const operation=review.refinements[0].operation;
assert.deepEqual(operation,{op:'set-roof',blocks:['upper-bedroom-bar'],roof:{form:'hip',rise:2.0825,overhang:1.3,material:'bronze',color:'#7A5B3A'}});
assert.equal(before.spec.blocks.find(b=>b.id==='upper-bedroom-bar')!.roof.rise,2.45);
const sourceHash=sha256(JSON.stringify(before.spec)),sceneHash=sha256(JSON.stringify(before.scene));
write('proposal',{provenance:'Exact highest-ranked recommendation from the retained actual Terra Stage 6 review; offline replay, not a new model response',operation,sourceHash,sceneHash,reviewSHA256:sha256(readFileSync(`${root}/stage6-refinement/live-review-1/review.json`)),preservedPlanWarnings:cp.preservedPlanWarnings});
const outcome=await runEdit({planner:{label:'Offline replay of retained Terra proposal; no AI',plan:async()=>({plan:{summary:'Lower only the upper-bedroom-bar hip rise from 2.45 m to 2.0825 m.',ops:[operation]}})},instruction:'Apply only retained Terra roof recommendation 1',spec:before.spec,scene:before.scene,components:before.components,requiredBedrooms:4,preserve:[...new Set(Object.values(before.components))].filter(c=>c!=='roof:upper-bedroom-bar')});
write('edit-outcome',outcome);assert(outcome.accepted,'Existing semantic edit rejected; retain baseline and stop.');
assert.deepEqual(outcome.diff!.changed,['roof-upper-bedroom-bar']);assert.deepEqual(outcome.diff!.added,[]);assert.deepEqual(outcome.diff!.removed,[]);assert.equal(outcome.diff!.unchanged,376);
assert.deepEqual(outcome.components,before.components);
const expected=structuredClone(before.spec);expected.blocks.find(b=>b.id==='upper-bedroom-bar')!.roof.rise=2.0825;
assert.deepEqual(outcome.spec,expected,'Only one source leaf may change.');
const full=measure(outcome.spec,5,4,5);assert.deepEqual(full.findings,[]);assert.equal(outcome.scene.elements.length,377);assert.equal(outcome.scene.terrain,undefined);
const relationships=sceneRelationshipIssues(outcome.scene);assert.deepEqual(relationships,[]);
const target='roof-upper-bedroom-bar',old=before.scene.elements.find(e=>e.id===target)!,next=outcome.scene.elements.find(e=>e.id===target)!;
const targetExpected=structuredClone(old);targetExpected.at[1]=Math.round((old.at[1]-(2.45-2.0825)/2)*1000)/1000;targetExpected.size[1]=Math.round(2.0825*1000)/1000;
assert(Math.abs(targetExpected.at[1]-next.at[1])<1e-9);targetExpected.at[1]=next.at[1];assert.deepEqual(next,targetExpected);
// Renderer-built surfaces/fascia, not bounding-box overlap as a roof-collision surrogate.
function meshes(e:SceneElement){return buildSceneRoof(e,{color:'#fff',roughness:1,metalness:0}).flatMap(p=>{
 if(p.kind!=='triMesh')return [];
 const triangles:Triangle[]=[];for(let i=0;i<p.vertices.length;i+=9)triangles.push(new Triangle(...[0,3,6].map(j=>new Vector3(p.vertices[i+j],p.vertices[i+j+1],p.vertices[i+j+2]).add(new Vector3(...e.at))) as [Vector3,Vector3,Vector3]));return triangles;
});}
function strictPairs(a:ReturnType<typeof pitchedRoofParts>,b:ReturnType<typeof pitchedRoofParts>){
 const pairs:{a:number;b:number;minimumSeparatingAxisOverlap:number}[]=[];
 a.forEach((p,i)=>b.forEach((q,j)=>{
  const margins=[...p.normals,...q.normals,...p.edges.flatMap(x=>q.edges.map(y=>x.clone().cross(y)))].map(axis=>{
   if(axis.lengthSq()<1e-18)return Infinity;const n=axis.clone().normalize(),x=p.vertices.map(v=>v.dot(n)),y=q.vertices.map(v=>v.dot(n));
   return Math.min(Math.max(...x)-Math.min(...y),Math.max(...y)-Math.min(...x));
  });const depth=Math.min(...margins);if(depth>1e-6)pairs.push({a:i,b:j,minimumSeparatingAxisOverlap:depth});
 }));return pairs;
}
function geometry(e:SceneElement){
 const parts=pitchedRoofParts(e,[...e.at,e.rotation]);assert(parts.every(p=>p.vertices.every(v=>v.toArray().every(Number.isFinite))));
 const triangles=meshes(e),slopes=triangles.filter(t=>Math.abs(t.getNormal(new Vector3()).y)>.01);
 const pitches=[...new Set(slopes.map(t=>+((Math.acos(Math.abs(t.getNormal(new Vector3()).y))*180/Math.PI).toFixed(6))))];
 const bounds=new Box3().setFromPoints(parts.flatMap(p=>p.vertices));
 return {parts,pitches,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},ridgeY:Math.max(...triangles.flatMap(t=>[t.a.y,t.b.y,t.c.y])),eaveY:e.at[1]-e.size[1]/2,triangles:triangles.length};
}
const bg=geometry(old),ag=geometry(next);assert(Math.abs(bg.ridgeY-ag.ridgeY-.3675)<1e-8);assert(Math.abs(bg.eaveY-ag.eaveY)<.00051);
const neighbours=before.scene.elements.filter(e=>e.kind==='roof'&&e.roofForm==='gable').map(e=>{
 const parts=pitchedRoofParts(e,[...e.at,e.rotation]),beforePairs=strictPairs(bg.parts,parts),afterPairs=strictPairs(ag.parts,parts);
 const newCrossings=afterPairs.filter(p=>!beforePairs.some(q=>p.a===q.a&&p.b===q.b));
 const boxVolume=(a:typeof parts[number],b:typeof parts[number])=>{const x=new Box3().setFromPoints(a.vertices),y=new Box3().setFromPoints(b.vertices);return x.intersect(y).getSize(new Vector3()).toArray().reduce((n,v)=>n*v,1);};
 const existingCrossings=afterPairs.map(p=>({parts:p,hipPart:bg.parts[p.a].vertices.length===8?'fascia':'slope',neighbourPart:parts[p.b].vertices.length===8?'fascia':'slope',beforeAabbOverlapVolume:boxVolume(bg.parts[p.a],parts[p.b]),afterAabbOverlapVolume:boxVolume(ag.parts[p.a],parts[p.b])}));
 const nbox=new Box3().setFromPoints(parts.flatMap(p=>p.vertices));
 const clearance=(g:typeof ag)=>{const box=new Box3().setFromPoints(g.parts.flatMap(p=>p.vertices));return Math.hypot(...['x','y','z'].map(k=>Math.max(0,nbox.min[k as 'x']-box.max[k as 'x'],box.min[k as 'x']-nbox.max[k as 'x'])));};
 const result={id:e.id,beforeContactOrIntersection:pitchedRoofPartsIntersect(bg.parts,parts),afterContactOrIntersection:pitchedRoofPartsIntersect(ag.parts,parts),beforeStrictPairs:beforePairs,afterStrictPairs:afterPairs,newCrossings,existingCrossings,beforeGuaranteedClearanceLowerBound:clearance(bg),afterGuaranteedClearanceLowerBound:clearance(ag),neighbourUnchanged:JSON.stringify(e)===JSON.stringify(outcome.scene.elements.find(n=>n.id===e.id))};
 write(`junction-${e.id}`,result);
 // Record and reject any newly introduced crossing; do not loosen tolerance or repair the scene.
 for(const x of existingCrossings.filter(x=>beforePairs.some(p=>p.a===x.parts.a&&p.b===x.parts.b))){assert(x.afterAabbOverlapVolume<=x.beforeAabbOverlapVolume+1e-9,'Existing overlap enlarged');}
 assert(result.neighbourUnchanged);return result;
});
const meshAccepted=neighbours.every(n=>n.newCrossings.length===0);
const strip=({parts,...v}:ReturnType<typeof geometry>)=>{void parts;return v;};
write('roof-geometry',{before:strip(bg),after:strip(ag),neighbours,sourceRise:2.0825,compiledRise:next.size[1],eaveDeltaMetres:ag.eaveY-bg.eaveY,notes:['Existing compiler rounds element centre and size to millimetres; source rise remains exactly 2.0825.','Contact SAT includes intended shared-edge contact; strict test excludes zero-depth seam contact at 1 micrometre tolerance.','Zero gap at upper-east-suite is the retained abutting seam. Small pre-existing fascia corner overlaps are measured and must not increase; no new roof-slope intersections permitted.','No engineering, waterproof flashing or code certification implied.']});
const saved=saveHouse(outcome.spec,outcome.scene,[...before.history,{instruction:'Retained Terra Stage 6 roof recommendation 1',summary:outcome.summary}]);
const reloaded=loadHouse(saved);assert.equal(JSON.stringify(reloaded.scene.elements),JSON.stringify(outcome.scene.elements));assert.deepEqual(reloaded.components,before.components);
assert.equal(sha256(JSON.stringify(before.spec)),sourceHash);assert.equal(sha256(JSON.stringify(before.scene)),sceneHash);
writeFileSync(`${out}/candidate.save.json`,saved,{flag:'wx'});write('candidate.scene',outcome.scene);write('candidate.checkpoint',{provenance:'Offline exact Terra roof-only candidate; NOT accepted baseline',constructionAccepted:meshAccepted,spec:outcome.spec,operation,preservedPlanWarnings:cp.preservedPlanWarnings});
write('baseline.scene',before.scene);
write('verification',{acceptedConstruction:meshAccepted,rejectionReason:meshAccepted?null:'New roof-slope/fascia seam crossings from existing compiler rounding; strict mesh audit rejects, no automatic repair.',modelCalls:0,sourceHash,sceneHash,baselineElements:377,candidateElements:377,cap:400,remaining:23,rooms:allRooms(outcome.spec).length,bedrooms:allRooms(outcome.spec).filter(r=>r.type==='bedroom').length,bathrooms:allRooms(outcome.spec).filter(r=>r.type==='bath').length,sourceOnlyChange:'blocks[upper-bedroom-bar].roof.rise',diff:outcome.diff,ownershipUnchanged:true,saveReload:true,editability:'Source spec and semantic ownership retained on reload; no second edit executed.',fullValidation:full.findings,relationshipFindings:relationships,facadeApplied:false});
console.log(JSON.stringify({output:out,constructionAccepted:meshAccepted,changed:outcome.diff!.changed,unchanged:376,findings:full.findings,geometry:{before:strip(bg),after:strip(ag),neighbours}}));
