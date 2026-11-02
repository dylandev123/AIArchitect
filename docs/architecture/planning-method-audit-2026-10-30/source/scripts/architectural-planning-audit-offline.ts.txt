/** Bounded arithmetic experiment, NOT a layout engine or model-generated house.
 * No provider, database, route invocation, or retained-evidence writes. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { doorwayOperations, straightStairOperations } from '../src/lib/villa/scene/assemblies';
import { validateScene, type SceneOperation } from '../src/lib/villa/scene/model';
import { sceneSpatialGeometry } from '../src/lib/villa/scene/spatial';
import { strictSceneResponseSchema } from '../src/lib/villa/scene/terra';
import { designProposalSchema } from '../src/lib/villa/scene/designProposal';

globalThis.fetch=async()=>{throw Error('Network prohibited in architectural audit');};
const out='docs/architecture/planning-method-audit-2026-10-30';
mkdirSync(out,{recursive:true});
type Zone={id:string;x0:number;x1:number;z0:number;z1:number};
// Intent must select both spaces, the opening centre and dimensions. This
// experiment only resolves one shared straight boundary in a chosen local frame.
function boundary(a:Zone,b:Zone,selected:number|undefined,width:number) {
 assert(selected!==undefined,'missing opening location: return to designer');
 assert(Math.abs(a.x1-b.x0)<1e-8,'no selected shared boundary: do not invent a link');
 const lo=Math.max(a.z0,b.z0),hi=Math.min(a.z1,b.z1);
 assert(hi-lo>0,'corner contact is not a doorway boundary');
 assert(selected-width/2>=lo+.1&&selected+width/2<=hi-.1,'opening exceeds shared edge margins');
 return {x:a.x1,z:(lo+hi)/2,length:hi-lo,openingX:(lo+hi)/2-selected};
}
const cases=[
 {name:'compact-family',frame:[7,0,-13],yaw:0,width:5,depth:7,split:2,door:1.2,wall:2.8,datum:.2},
 {name:'distributed-luxury-estate',frame:[-42,0,61],yaw:.63,width:11,depth:14,split:5,door:2,wall:3.7,datum:.45},
 {name:'constrained-multilevel',frame:[23,0,9],yaw:-1.1,width:3.2,depth:8.5,split:3.1,door:.9,wall:2.6,datum:3.4},
];
const results=cases.map(c=>{
 const suite:Zone={id:`${c.name}-suite`,x0:0,x1:c.width,z0:0,z1:c.depth};
 const corridor:Zone={id:`${c.name}-corridor`,x0:c.width,x1:c.width+1.6,z0:0,z1:c.depth};
 const bath:Zone=c.name==='constrained-multilevel'
  ? {id:`${c.name}-bath`,x0:c.width+1.6,x1:c.width+3.6,z0:0,z1:c.split}
  : {id:`${c.name}-bath`,x0:-2.4,x1:0,z0:0,z1:c.split};
 const ops:SceneOperation[]=[{op:'add',element:{id:`${c.name}-frame`,label:'explicit local frame',kind:'volume',at:c.frame as [number,number,number],size:[.01,.01,.01],rotation:c.yaw,panels:1,material:'ivory'}}];
 const connections=[{a:suite,b:corridor,location:c.depth*.65},c.name==='constrained-multilevel'
  ? {a:corridor,b:bath,location:c.split/2} : {a:bath,b:suite,location:c.split/2}];
 for(const [i,intent] of connections.entries()){
  const edge=boundary(intent.a,intent.b,intent.location,c.door);
  ops.push(...doorwayOperations({id:`${c.name}-threshold-${i}`,parent:`${c.name}-frame`,at:[edge.x,c.datum,edge.z],rotation:Math.PI/2,
   width:edge.length,height:c.wall,thickness:.15,openingX:edge.openingX,openingWidth:c.door,openingHeight:2.1}));
 }
 const scene=validateScene({version:'architectural-scene-1',name:'DETERMINISTIC PARTS ONLY; not a complete house',elements:ops.flatMap(op=>op.op==='add'?[op.element]:[])});
 const g=sceneSpatialGeometry(scene);
 const thresholds=connections.map((intent,i)=>{
  const wall=g.map.get(`${c.name}-threshold-${i}`)!,door=g.map.get(`${wall.id}-door`)!;
  const w=g.world(wall),d=g.world(door),o=wall.opening!;
  const expected=[w[0]+Math.cos(w[3])*o.x,g.bottom(wall)+o.sill+o.height/2,w[2]-Math.sin(w[3])*o.x];
  expected.forEach((v,j)=>assert(Math.abs(v-d[j])<1e-8));
  assert(Math.abs(g.bottom(door)-c.datum)<1e-8);
  return {from:intent.a.id,to:intent.b.id,doorId:door.id,worldCentre:d,worldSill:g.bottom(door),openingAligned:true};
 });
 // Explicit relationship graph, not inferred room navigation.
 assert(thresholds.some(t=>t.from===suite.id&&t.to===corridor.id));
 assert(thresholds.some(t=>t.from===bath.id&&t.to===suite.id || t.from===corridor.id&&t.to===bath.id));
 return {case:c.name,inputs:c,zones:[suite,corridor,bath],thresholds,scene,
  scope:'Two explicitly selected shared-edge openings only. No full enclosure, circulation, style or house-quality certification.'};
});
const a:Zone={id:'a',x0:0,x1:4,z0:0,z1:5};
const b:Zone={id:'b',x0:4,x1:7,z0:0,z1:5};
const refusals=[
 ['unspecified opening',()=>boundary(a,b,undefined,1)],
 ['detached pavilion',()=>boundary(a,{...b,x0:7},2,1)],
 ['corner contact',()=>boundary(a,{...b,z0:5,z1:8},5,1)],
 ['oversized opening',()=>boundary(a,b,.2,2)],
] as const;
for(const [,test] of refusals)assert.throws(test);
// Existing helper, selected stair type, base, heading, risers, run and width.
// This tests construction arithmetic, never auto-selects stair architecture.
const stair=straightStairOperations({id:'tight-house-rise',at:[21,.2,-7],rotation:.47,width:1.1,rise:3.2,run:4.8,risers:16});
const stairScene=validateScene({version:'architectural-scene-1',name:'selected stair component only',elements:stair.flatMap(o=>o.op==='add'?[o.element]:[])});
const sg=sceneSpatialGeometry(stairScene),last=stairScene.elements.at(-1)!;
assert(Math.abs(sg.top(last)-3.4)<1e-8);
assert.throws(()=>straightStairOperations({id:'bad-rise',at:[0,0,0],width:1,rise:3.2,run:2,risers:10}));
// A different site topology: distributed estate with an explicitly selected
// outdoor link. No route is synthesized from adjacency or proximity prose.
const estateSite=validateScene({version:'architectural-scene-1',name:'distributed site fixture only',elements:[
 {id:'estate-west-deck',label:'west deck',kind:'plate',at:[-10,.35,0],size:[10,.2,8]},
 {id:'estate-selected-link',label:'explicit outdoor route',kind:'plate',at:[0,.35,1],size:[10,.2,1.8]},
 {id:'estate-east-deck',label:'east deck',kind:'plate',at:[10,.35,3],size:[10,.2,10]},
 {id:'estate-curved-screen',label:'selected curved screen, unrelated to threshold solving',kind:'volume',at:[10,2,10],size:[8,3,4],
  geometry:{type:'arc',axis:'y',start:0,sweep:Math.PI,innerRatio:.9,segments:20}},
]});
const eg=sceneSpatialGeometry(estateSite),[west,link,east]=estateSite.elements;
assert(eg.separation(west,link)<=0&&eg.separation(link,east)<=0);
assert(eg.separation(west,east)>0);
assert.equal(estateSite.elements[3].geometry?.type,'arc');
const schema=await strictSceneResponseSchema(designProposalSchema);
writeFileSync(`${out}/provider-proposal-schema.current.json`,JSON.stringify(await schema.jsonSchema,null,2)+'\n');
writeFileSync(`${out}/offline-results.json`,JSON.stringify({paidCalls:0,network:'fetch denied',modelProducedArchitecture:false,
 results,estateSite:{scene:estateSite,topology:'pavilion-deck → explicitly selected outdoor link → offset pavilion-deck',linkContactsBoth:true,withoutLinkDisconnected:true,curvedScreenPreserved:true},refusals:refusals.map(([name])=>({name,refused:true})),stair:{steps:stairScene.elements.length,top:sg.top(last),selectedUpperDatum:3.4,invalidRatioRefused:true,
 limitations:['Landings, support, slab opening, headroom, guards and arrival route still require explicit design and independent checking. A matching top is not a usable stair certificate.']},
 unsupported:['Curved or polygonal shared-edge solving was NOT implemented. Preserve existing profile geometry and return unresolved intent for review.','A distributed estate needs explicitly selected outdoor links; separated buildings are not silently joined.','Fixtures demonstrate part placement across frames and sizes, not three completed architectural designs.']},null,2)+'\n');
console.log('PASS: three arrangements, six shared-edge thresholds, four refusal cases, selected rotated stair and invalid stair refusal.');
