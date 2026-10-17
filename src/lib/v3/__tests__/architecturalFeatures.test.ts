import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileV3Scene, type V3Scene } from '../scene';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileDetailedRoof, FLAT_ROOF_GAP } from '../construction';
import { rooftopTerraces } from '../rooftopFeatures';
import { v3SceneArchitectPrompt } from '../schema';

const rawObject=(id:string,type:string,x:number,z:number,y:number,w:number,d:number,h:number,extra={})=>({id,type,label:id,semanticRole:id,geometryKind:'box',material:{id:'stone',color:'#aabbcc'},architecture:{x,z,baseElevation:y,width:w,depth:d,height:h},...extra});
const ingest=(objects:ReturnType<typeof rawObject>[])=>ingestV3GenerationOutput({version:3,site:{width:160,depth:180},objects},'flat');

describe('architectural features',()=>{
 it.each(['f2149916','91d583fe','9646933e'])('replays %s with stable IDs, finite geometry and unchanged saved intent',id=>{
  const scene=JSON.parse(readFileSync(`src/lib/v3/__tests__/fixtures/mansions/mansion-${id}.json`,'utf8')).v3Scene as V3Scene,before=JSON.stringify(scene);
  const model=compileV3Scene(scene),ids=model.primitives.map(p=>p.id);
  expect(JSON.stringify(scene)).toBe(before);expect(new Set(ids).size).toBe(ids.length);
  expect(compileV3Scene(JSON.parse(before))).toEqual(model);
  expect(compileV3Scene({...scene,objects:[...scene.objects].reverse()}).primitives.map(p=>p.id).sort()).toEqual([...ids].sort());
  expect(model.primitives.every(p=>(p.kind==='box'?[...p.position,...p.size]:p.vertices).every(Number.isFinite))).toBe(true);
  if(id==='91d583fe')expect(model.primitives.filter(p=>p.componentRole==='butterfly roof plane')).toHaveLength(2);
  if(id==='9646933e'){expect(model.primitives.some(p=>p.componentRole==='floating roof bearing')).toBe(true);expect(model.primitives.some(p=>p.componentRole==='rooftop guardrail')).toBe(true);}
 });
 it('ingests explicit butterfly and builds two inward slopes plus valley gutter at authored rotation and pitch',()=>{
  const result=ingest([rawObject('roof','roof-form',4,7,6,12,8,1.5,{roofForm:'butterfly',pitch:15,overhang:0})]);
  expect(result.ok).toBe(true);expect(result.scene.objects[0].roofForm).toBe('butterfly');
  const o=result.scene.objects[0],parts=compileDetailedRoof(o)!;
  expect(parts.filter(p=>p.componentRole==='butterfly roof plane')).toHaveLength(2);
  const slope=parts.find(p=>p.componentRole==='butterfly roof plane')!;
  if(slope.kind!=='triMesh')throw Error('missing mesh');
  const ys=slope.vertices.filter((_,i)=>i%3===1);expect(Math.min(...ys)).toBeCloseTo(6);expect(Math.max(...ys)).toBeCloseTo(6+Math.tan(Math.PI/12)*4);
  expect(parts.some(p=>p.componentRole==='roof valley gutter')).toBe(true);
  o.transform.rotation[1]=Math.PI/3;expect(compileDetailedRoof(o)![0]).not.toEqual(parts[0]);
 });
 it('explicit roof and canopy fields override legacy names; ordinary solid canopies stay solid',()=>{
  const result=ingest([rawObject('roof','roof-form',0,0,4,10,8,.3,{label:'butterfly roof',roofForm:'flat'}),rawObject('shade','canopy',20,0,0,8,5,3,{label:'pergola',canopyStyle:'solid'})]);
  expect(result.ok).toBe(true);const parts=compileV3Scene(result.scene).primitives;
  expect(parts.some(p=>p.componentRole==='butterfly roof plane')).toBe(false);expect(parts.some(p=>p.componentRole==='canopy roof')).toBe(true);
 });
 it('leaves real gaps between slats, with headers and four corner supports',()=>{
  const result=ingest([rawObject('shade','canopy',0,0,0,8,5,3,{canopyStyle:'slatted'})]);expect(result.ok).toBe(true);
  const parts=compileV3Scene(result.scene).primitives.filter(p=>p.sourceObjectId==='shade');
  const slats=parts.filter(p=>p.componentRole==='pergola slat');expect(slats.length).toBeGreaterThan(2);
  expect(slats.reduce((a,p)=>a+(p.kind==='box'?p.size[0]:0),0)).toBeLessThan(8*.5);
  expect(parts.filter(p=>p.componentRole==='pergola post')).toHaveLength(4);expect(parts.filter(p=>p.componentRole==='pergola header')).toHaveLength(2);
 });
 it('floats on narrow bearings with a real open separation',()=>{
  const o=ingest([rawObject('roof','roof-form',0,0,4,12,8,.3,{roofForm:'floating-flat'})]).scene.objects[0];
  const parts=compileDetailedRoof(o)!;expect(parts.some(p=>p.componentRole==='shadow reveal')).toBe(false);
  const plate=parts.find(p=>p.componentRole==='floating roof plate')!;
  if(plate.kind!=='box')throw Error('missing plate');expect(plate.position[1]-plate.size[1]/2).toBeCloseTo(4+FLAT_ROOF_GAP);
  expect(parts.filter(p=>p.componentRole==='floating roof bearing').every(p=>p.kind==='box'&&p.size[0]<=.12&&p.size[2]<=.12)).toBe(true);
 });
 it.each([0,.4,Math.PI/2])('exposes a partial terrace at yaw %s while retaining the unoccupied roof and access edge',yaw=>{
  const result=ingest([rawObject('host','building-mass',0,0,0,20,16,4,{levels:1}),rawObject('deck','terrace',3,0,4,5,4,.2,{hostId:'host',collision:'walkable',terraceOpenEdges:['west']})]);
  const scene=result.scene;scene.objects[1].architecture!.rotationY=yaw;scene.objects[1].transform.rotation[1]=yaw;
  expect(rooftopTerraces(scene)).toHaveLength(1);
  const parts=compileV3Scene(scene).primitives,roof=parts.find(p=>p.id==='host-roof-plate');expect(roof?.kind).toBe('triMesh');
  expect(parts.some(p=>p.id.startsWith('deck-guard-east'))).toBe(true);expect(parts.some(p=>p.id.startsWith('deck-guard-west'))).toBe(false);
  // Every roof triangle centroid must lie outside the terrace cutout in its local frame.
  if(roof?.kind==='triMesh')for(let i=0;i<roof.vertices.length;i+=9){const v=roof.vertices,x=(v[i]+v[i+3]+v[i+6])/3-3,z=(v[i+2]+v[i+5]+v[i+8])/3;expect(Math.abs(x*Math.cos(yaw)-z*Math.sin(yaw))>=2.5-1e-6||Math.abs(x*Math.sin(yaw)+z*Math.cos(yaw))>=2-1e-6).toBe(true);}
 });
 it('does not treat an unhosted or ground terrace as rooftop occupancy',()=>{
  const scene=ingest([rawObject('host','building-mass',0,0,0,20,16,4),rawObject('deck','terrace',0,0,0,5,4,.2,{hostId:'host'})]).scene;
  expect(rooftopTerraces(scene)).toHaveLength(0);delete scene.objects[1].hostId;expect(rooftopTerraces(scene)).toHaveLength(0);
 });
});

describe('scale contract (offline, no claim about model compliance)',()=>{
 it.each(['flat','advanced'] as const)('%s includes mansion ambition, constraint precedence, small-house protection and open creative choices',mode=>{
  const prompt=v3SceneArchitectPrompt(mode);
  for(const text of ['ordinary house','luxury villa','mansion','ultra-luxury estate','US$5–10 million','NOT a construction-cost estimate','Explicit user budgets, dimensions','always take precedence','Small-house, cottage and modest-home','do not simply scale up','NOT required features','Terra independently selects','No minimum floor area'])expect(prompt).toContain(text);
  expect(prompt).not.toContain('keep the site simple');
 });
 it('accepts a large site and diverse substantial program without resizing or imposing amenities',()=>{
  const objects=[rawObject('residence','building-mass',0,0,0,60,35,12,{levels:3}),rawObject('guesthouse','building-mass',65,0,0,18,12,4),rawObject('theatre','building-mass',-60,20,0,22,20,7),rawObject('court','sports-court',0,60,0,30,18,.1)];
  const result=ingest(objects);expect(result.ok).toBe(true);expect(result.scene.site.width).toBe(160);expect(result.scene.objects).toHaveLength(4);expect(result.scene.objects[0].architecture?.width).toBe(60);
 });
});
