/** Developer-authored offline capability proof. No provider imports. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateScene,applySceneOperations,type SceneElement,type SceneOperation} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {focusedConstructionFindings} from '../src/lib/villa/scene/focusedConstruction';
globalThis.fetch=async()=>{throw Error('Offline proof: network forbidden');};
const dir='docs/architecture/construction-assemblies';mkdirSync(dir,{recursive:true});
const originalPaths=['docs/architecture/completion-network-restored/after.UNAPPROVED.json','docs/architecture/completion-network-restored/response.json','docs/architecture/completion-network-restored/operations.json'];
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const preserved=originalPaths.map(path=>({path,sha256:hash(path)}));
const part=(id:string,kind:SceneElement['kind'],at:number[],size:number[])=>({id,label:id,kind,at,size,rotation:0,material:'limestone',panels:4});
// Lower datum .2, upper 3.6. 17 rises of .2; 16 treads then landing.
const stairParts=[part('lower-floor','plate',[-.75,.1,0],[1.5,.2,4]),part('upper-floor','plate',[2.4,3.5,0],[4.8,.2,4])];
for(let i=1;i<=16;i++)stairParts.push(part(`stair-tread-${i}`,'plate',[(i-.5)*.3,.1+i*.2,0],[.3,.2,1.4]));
stairParts.push(part('upper-landing','plate',[5.4,3.5,0],[1.2,.2,1.4]));
// Replace only the explicitly selected host slab with a frame: void x=0..4.8,z=-.8...8.
const stairBase=validateScene({version:'architectural-scene-1',name:'Developer stair assembly proof',elements:stairParts});
const operations:SceneOperation[]=[{op:'replace',id:'upper-floor',element:validateScene({version:'architectural-scene-1',name:'segment',elements:[part('upper-floor','plate',[2.4,3.5,-1.4],[4.8,.2,1.2])]}).elements[0]},...[
 part('upper-floor-north','plate',[2.4,3.5,1.4],[4.8,.2,1.2]),
 part('upper-floor-exit','plate',[6.6,3.5,0],[1.2,.2,4]),
 part('landing-support','volume',[5.4,1.7,0],[.3,3.4,.3]),
 part('floor-support-south','volume',[2.4,1.7,-1.6],[.3,3.4,.3]),
 part('floor-support-north','volume',[2.4,1.7,1.6],[.3,3.4,.3]),
].map(element=>({op:'add',element:validateScene({version:'architectural-scene-1',name:'part',elements:[element]}).elements[0]} as SceneOperation))];
const stair=applySceneOperations(stairBase,operations);
assert.deepEqual(sceneRelationshipIssues(stair),[]);
assert.deepEqual(focusedConstructionFindings(stair),[]);
// Exact axis-aligned interval proof, not merely IDs or contact tolerance.
const treads=stair.elements.filter(e=>e.id.startsWith('stair-tread'));
const upper=stair.elements.filter(e=>e.id.startsWith('upper-'));
const overlap=(a:SceneElement,b:SceneElement,axis:number)=>Math.min(a.at[axis]+a.size[axis]/2,b.at[axis]+b.size[axis]/2)-Math.max(a.at[axis]-a.size[axis]/2,b.at[axis]-b.size[axis]/2);
for(const t of treads)for(const f of upper)assert(!(overlap(t,f,0)>1e-8&&overlap(t,f,2)>1e-8),'slab/landing intersects flight');
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8);
close(treads[0].at[0]-.15,0);close(treads[15].at[0]+.15,4.8);close(stair.elements.find(e=>e.id==='upper-landing')!.at[0]-.6,4.8);
// Rectangular basin: interior x=-3..3,z=-2..2; depth 1.4, water .2, coping/deck .3.
const poolParts=[part('pool-basin-floor','plate',[0,-1.3,0],[6.4,.2,4.4]),part('pool-water','water',[0,.2,0],[6,.02,4])];
for(const s of [-1,1]){
 poolParts.push(part(`pool-wall-${s===1?'north':'south'}`,'wall',[0,-.45,s*2.1],[6.4,1.5,.2]));
 poolParts.push(part(`pool-wall-${s===1?'east':'west'}`,'wall',[s*3.1,-.45,0],[.2,1.5,4]));
 poolParts.push(part(`pool-coping-${s===1?'north':'south'}`,'plate',[0,.25,s*2.35],[7.2,.1,.7]));
 poolParts.push(part(`pool-coping-${s===1?'east':'west'}`,'plate',[s*3.35,.25,0],[.7,.1,4]));
 poolParts.push(part(`pool-deck-${s===1?'north':'south'}`,'plate',[0,.15,s*3.45],[9.2,.3,1.5]));
 poolParts.push(part(`pool-deck-${s===1?'east':'west'}`,'plate',[s*4.1,.15,0],[1,.3,5.4]));
}
const pool=applySceneOperations(validateScene({version:'architectural-scene-1',name:'Developer pool assembly proof',elements:[]}),poolParts.map(element=>({op:'add',element})));
assert.deepEqual(sceneRelationshipIssues(pool),[]);assert.deepEqual(focusedConstructionFindings(pool),[]);
close(.2-(-1.2),1.4);
// Full 1m-wide dry rectangular circuit at deck datum: each segment meets the next,
// entirely outside basin and touching coping; sample both width boundaries.
const route=[[[-4.1,-3.45],[4.1,-3.45]],[[4.1,-3.45],[4.1,3.45]],[[4.1,3.45],[-4.1,3.45]],[[-4.1,3.45],[-4.1,-3.45]]];
for(const [a,b] of route)for(let i=0;i<=100;i++)for(const side of [-.5,.5]){const x=a[0]+(b[0]-a[0])*i/100+(a[0]===b[0]?side:0),z=a[1]+(b[1]-a[1])*i/100+(a[1]===b[1]?side:0);assert(pool.elements.some(e=>e.id.startsWith('pool-deck')&&Math.abs(x-e.at[0])<=e.size[0]/2+1e-8&&Math.abs(z-e.at[2])<=e.size[2]/2+1e-8));}
for(const [name,scene] of Object.entries({stair,pool}))writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(scene,null,2));
writeFileSync(`${dir}/pool.operations.json`,JSON.stringify(poolParts.map(element=>({op:'add',element})),null,2));
writeFileSync(`${dir}/stair.operations.json`,JSON.stringify(operations,null,2));writeFileSync(`${dir}/stair.before.json`,JSON.stringify(stairBase,null,2));
writeFileSync(`${dir}/verification.json`,JSON.stringify({providerCalls:0,developerAuthored:true,approved:false,preserved,stairs:{floorToFloor:3.4,rises:17,rise:.2,going:.3,void:[0,4.8,-.8,.8],landing:[4.8,6,-.7,.7],headroom:'No overhead geometry above flight; open stairwell',unobstructedWidth:1.4,lowerApproach:[-1.5,0],upperExit:[6,7.2],slabAndLandingOverlap:false},pool:{basinTop:-1.2,water:.2,depth:1.4,wallTop:.3,copingTop:.3,deckTop:.3,dryRouteWidth:1,route},relationshipIssues:[],focusedFindings:[],limitations:['No excavation or hydraulic simulation','No code or engineering approval','Guards and handrails not detailed in this isolated geometry proof']},null,2));
for(const p of preserved)assert.equal(hash(p.path),p.sha256);
console.log('Offline stairwell, landing, basin and dry-route proofs passed; originals preserved.');
