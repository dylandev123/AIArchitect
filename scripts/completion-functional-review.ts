/** Offline replay, evidence and a surface-preserving deterministic repair. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateScene,applySceneOperations,type SceneOperation} from '../src/lib/villa/scene/model';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {circulationFindings} from '../src/lib/villa/scene/completion';
import {focusedConstructionFindings} from '../src/lib/villa/scene/focusedConstruction';
globalThis.fetch=async()=>{throw Error('Network forbidden in offline review');};
const dir='docs/architecture/completion-functional-review';mkdirSync(dir,{recursive:true});
const sources={original:'docs/villa-playground/25m-mansion-recovery/original.scene.json',redesigned:'docs/villa-playground/redesign-technical-review/repaired.UNAPPROVED.json',completed:'docs/architecture/completion-network-restored/after.UNAPPROVED.json'};
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const preserved=Object.values(sources).concat(['docs/architecture/completion-network-restored/response.json','docs/architecture/completion-network-restored/operations.json','docs/architecture/completion-network-restored/capture-bundle.UNAPPROVED.json']).map(path=>({path,sha256:hash(path)}));
const scenes=Object.fromEntries(Object.entries(sources).map(([k,p])=>[k,validateScene(read(p))]));
const ops=read('docs/architecture/completion-network-restored/operations.json');
const replay=applySceneOperations(scenes.redesigned,ops);assert.deepEqual(replay.elements,scenes.completed.elements);assert.deepEqual(replay.terrain,scenes.completed.terrain);assert.equal(ops.length,46);
const completed=scenes.completed,at=(id:string)=>completed.elements.find(e=>e.id===id)!;
const tread=at('stair-tread-17'),landing=at('upper-bridge-landing');
assert.deepEqual(tread.at,[1.875,3.5,1]);assert.deepEqual(tread.size,[.25,.2,1.4]);assert.deepEqual(landing.at,[1.75,3.5,.5]);assert.deepEqual(landing.size,[1.5,.2,2]);
// Rectangle subtraction: tread [1.75,2] × [.3,1.7] minus landing
// [1,2.5] × [-.5,1.5] leaves [1.75,2] × [1.5,1.7].
const repair:SceneOperation[]=[{op:'resize',id:tread.id,size:[.25,.2,.2]},{op:'move',id:tread.id,at:[1.875,3.5,1.6]}];
const repaired=applySceneOperations(completed,repair);
for(let x=1.7;x<=2.55;x+=.025)for(let z=-.55;z<=1.75;z+=.025){const contains=(e:typeof tread)=>Math.abs(x-e.at[0])<=e.size[0]/2+1e-9&&Math.abs(z-e.at[2])<=e.size[2]/2+1e-9;assert.equal(contains(tread)||contains(landing),contains(repaired.elements.find(e=>e.id===tread.id)!)||contains(landing));}
assert.equal(focusedConstructionFindings(repaired).filter(f=>f.code==='stair-landing-overlap').length,0);
const changed=repaired.elements.filter(e=>JSON.stringify(e)!==JSON.stringify(at(e.id))).map(e=>e.id);assert.deepEqual(changed,[tread.id]);
const audits=Object.fromEntries(Object.entries({...scenes,repaired}).map(([name,s])=>[name,{elements:s.elements.length,circulation:circulationFindings(s),focused:focusedConstructionFindings(s),audit:reviewSceneArchitecture(s)}]));
const treads=completed.elements.filter(e=>/^stair-tread-/.test(e.id));
const evidence={providerCalls:0,approved:false,liveSceneModified:false,replay:{operations:ops.length,adds:ops.filter((o:{op:string})=>o.op==='add').length,replacements:ops.filter((o:{op:string})=>o.op==='replace').length,exactElements:true},preserved,repair:{operations:repair,changed,duplicateAreaRemovedM2:.3,walkingSurfaceUnionPreserved:true,routeFixed:false},stairs:{runAxis:'negative X',widthM:1.4,goingM:.25,riseM:.2,floorToFloorM:3.4,treadCount:17,treads:treads.map(e=>({id:e.id,min:e.at.map((n,i)=>n-e.size[i]/2),max:e.at.map((n,i)=>n+e.size[i]/2),walkingY:e.at[1]+e.size[1]/2})),lowerApproach:{x:6,z:[.3,1.7],floorY:.2},upperLanding:{x:[1,2.5],z:[-.5,1.5],walkingY:3.6},guestSlab:{x:[2.5,7.5],z:[-2,4],undersideY:3.4},headroomAtTread01:3,headroomAtTread14:.4,ownerOpening:{x:1,z:[-.55,.55],bottomY:3.8,topY:6.2},guestOpening:{x:2.5,z:[.45,1.55],bottomY:3.8,topY:6.2},guestLandingConflict:{landingZ:[-.5,1.5],openingZ:[.45,1.55],clearOverlapM:1.05,landingCentreZ:.5,guestOpeningCentreZ:1,westWallSpansX:[2.35,2.65],treadsIntersectingWall:['stair-tread-14','stair-tread-15']}},door:{id:'ocean-loggia-door',panelWorldY:[.4,3.2],openingWorldY:[.4,6.2],panelWidth:3.2,openingWidth:13.2,correctSillAlignedPanelCentreLocalY:-1.7,oldAuditExpectedLocalY:-.2,repair:'none: sill alignment correct; oversized portal closure is a design question'},pool:{bottomY:.04,waterY:.2,depthM:.16,wallY:[0,1.2],copingTopY:.2,wallAboveCopingM:1,basinX:[-6,6],basinZ:[-18,-12],northCopingZ:[-12,-11.4],loggiaDeckZ:[-11,-7],drySurfaceGapM:.4,repair:'none: depth, wall datum and dry access require design intent'},audits};
writeFileSync(`${dir}/repair.operations.json`,JSON.stringify(repair,null,2));writeFileSync(`${dir}/repaired.UNAPPROVED.json`,JSON.stringify(repaired,null,2));writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2));
for(const p of preserved)assert.equal(hash(p.path),p.sha256);
console.log(JSON.stringify({providerCalls:0,preserved:true,changed,findings:Object.fromEntries(Object.entries(audits).map(([k,a])=>[k,a.focused.map(f=>({code:f.code,ids:f.elementIds}))]))},null,2));
