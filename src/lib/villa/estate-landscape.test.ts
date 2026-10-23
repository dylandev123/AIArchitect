import { describe,it,expect } from 'vitest';
import { ESTATE_EXAMPLES,estateExamples } from './estate-examples';
import { buildComposition,executeCompositionPatch,validateComposition,wingEnvelope } from './composition';
import { circulationPlanting,distanceToBounds,estateLandscapeSchema,landscapeBounds,routeDistance,routeSamples,routeVertices } from './estate-landscape';
import { wingBounds } from '@/app/dev/villa-playground/wing-composition';
import { creativeExamples } from './creative-examples';
import { ARCHITECTURAL_COMPONENTS,terraComponents } from './component-registry';
import { villaProviderOutputSchema } from './terra';

const copy=(i=0)=>structuredClone(ESTATE_EXAMPLES[i]);
describe('estate landscape composition',()=>{
 it('validates three genuinely different deterministic layouts, deriving every occupied reserve',()=>{
  const examples=estateExamples();expect(examples.map(c=>c.wings.length)).toEqual([3,3,3]);
  expect(examples[1].wings.map(w=>w.orientation)).toEqual([0,330,30]);
  expect(examples.map(c=>c.estateLandscape?.beds.length)).toEqual([0,0,4]);
  for(const c of examples){const g=c.garden;for(const b of landscapeBounds(c.estateLandscape!)){
   expect(b.left).toBeGreaterThanOrEqual(g.x-g.width/2);expect(b.right).toBeLessThanOrEqual(g.x+g.width/2);
   expect(b.rear).toBeGreaterThanOrEqual(g.z-g.depth/2);expect(b.front).toBeLessThanOrEqual(g.z+g.depth/2);
  }expect(buildComposition(c).estateLandscape).toEqual(c.estateLandscape);}
 });
 it('never expands a fixed site, and retains its exact coordinates when it fits',()=>{
  const c=copy();c.siteMode='fixed';c.garden={x:0,z:0,width:70,depth:70};expect(()=>validateComposition(c)).toThrow(/fixed site/);
  c.garden={x:-2,z:-15,width:100,depth:110};expect(validateComposition(c).garden).toEqual(c.garden);
 });
 it('retains the compact residential examples without estate additions',()=>{
  for(const c of creativeExamples())expect(c.estateLandscape).toBeUndefined();
 });
 it('rejects a driveway through the house, disconnected court, island encroachment and insufficient lanes',()=>{
  let c=copy();c.estateLandscape!.routes[0].points=[{x:0,z:-25},{x:0,z:-5}];expect(()=>validateComposition(c)).toThrow(/intersects/);
  c=copy();c.estateLandscape!.routes[0].points=[{x:-60,z:-60},{x:-50,z:-50}];expect(()=>validateComposition(c)).toThrow(/meet the motor court/);
  c=copy();c.estateLandscape!.routes[0].points=[{x:-20,z:-25},{x:0,z:-25}];expect(()=>validateComposition(c)).toThrow(/island/);
  c=copy();c.estateLandscape!.court!.islandWidth=18;expect(()=>validateComposition(c)).toThrow(/3.5 m/);
 });
 it('rejects route loops, paving over the pool and planting beds over paths',()=>{
  let c=copy();c.estateLandscape!.routes=[{id:'loop',kind:'walk',width:2,planting:'none',points:[{x:-40,z:0},{x:-30,z:10},{x:-40,z:10},{x:-30,z:0}]}];expect(()=>validateComposition(c)).toThrow(/folds/);
  c=copy();c.estateLandscape!.routes.push({id:'wet-walk',kind:'walk',width:2,planting:'none',points:[{x:-5,z:16},{x:5,z:16}]});expect(()=>validateComposition(c)).toThrow(/pool clearance/);
  c=copy(2);c.estateLandscape!.beds[0].x=0;expect(()=>validateComposition(c)).toThrow(/circulation clear/);
 });
 it('allows circular courts, no island and no court without forcing extra features',()=>{
  const c=copy();c.estateLandscape!.court!.depth=22;c.estateLandscape!.court!.island='none';expect(validateComposition(c).estateLandscape!.court!.island).toBe('none');
  expect(estateExamples()[1].estateLandscape!.court).toBeUndefined();
 });
 it('atomically replaces/removes only the requested landscape and preserves failed edits',()=>{
  const c=estateExamples()[0],before=structuredClone(c),l=structuredClone(c.estateLandscape!);l.court!.island='planted';
  const next=executeCompositionPatch(c,{estateLandscape:l});expect(next.wings).toEqual(c.wings);expect(next.pool).toEqual(c.pool);expect(next.estateLandscape!.court!.island).toBe('planted');
  l.routes[0].points=[{x:0,z:-25},{x:0,z:-5}];expect(()=>executeCompositionPatch(c,{estateLandscape:l})).toThrow();expect(c).toEqual(before);
  expect(executeCompositionPatch(c,{estateLandscape:null}).estateLandscape).toBeUndefined();
 });
 it('produces finite upward-facing smooth ribbons passing through the authored endpoints',()=>{
  for(const c of estateExamples())for(const r of c.estateLandscape!.routes){
   const v=routeVertices(r);expect(v.every(Number.isFinite)).toBe(true);expect(v.length%9).toBe(0);
   const p=routeSamples(r);expect(p[0]).toEqual(r.points[0]);expect(p.at(-1)!.x).toBeCloseTo(r.points.at(-1)!.x,8);expect(p.at(-1)!.z).toBeCloseTo(r.points.at(-1)!.z,8);
   for(let i=0;i<v.length;i+=9){const ax=v[i+3]-v[i],az=v[i+5]-v[i+2],bx=v[i+6]-v[i],bz=v[i+8]-v[i+2];expect(az*bx-ax*bz).toBeGreaterThan(0);}
  }
 });
 it('places circulation planting outside roads, courts, buildings and pool reserves',()=>{
  for(const c of estateExamples()){
   const l=c.estateLandscape!,obstacles=c.wings.map(w=>wingEnvelope(w,c)),plants=circulationPlanting(l,obstacles);
   expect(plants.length).toBeGreaterThan(5);
   for(const p of plants){for(const r of l.routes)expect(routeDistance(p,routeSamples(r))).toBeGreaterThanOrEqual(r.width/2+(p.tree?1.5:.55));for(const b of obstacles)expect(distanceToBounds(p,b)).toBeGreaterThanOrEqual(p.tree?1.5:.55);}
  }
 });
 it('bounds all route parameters and rejects unknown builders',()=>{
  const l=copy().estateLandscape!;expect(estateLandscapeSchema.safeParse({...l,builder:'polygon-mesh@1'}).success).toBe(false);
  l.routes[0].width=2;expect(estateLandscapeSchema.safeParse(l).success).toBe(false);
 });
});
describe('rotated detached wings',()=>{
 it('keeps rotated roof, slab and veranda inside the validated envelope',()=>{
  const c=estateExamples()[1],w=c.wings[1],b=wingEnvelope(w,c),a=w.orientation*Math.PI/180;
  for(const x of [-w.width/2-.65,w.width/2+.65])for(const z of [-w.depth/2-.65,w.depth/2+w.veranda+.4]){
   const px=w.x+Math.cos(a)*x+Math.sin(a)*z,pz=w.z-Math.sin(a)*x+Math.cos(a)*z;
   // Roof and veranda are separate envelopes, not a single enlarged corner rectangle.
   if(z>w.depth/2 && Math.abs(x)>w.width/2)continue;
   expect(px).toBeGreaterThanOrEqual(b.left-.01);expect(px).toBeLessThanOrEqual(b.right+.01);expect(pz).toBeGreaterThanOrEqual(b.rear-.01);expect(pz).toBeLessThanOrEqual(b.front+.01);
  }
  expect(wingBounds(w).right-wingBounds(w).left).toBeCloseTo(Math.cos(a)*w.width+Math.abs(Math.sin(a))*w.depth);
 });
 it('rejects connected rotated wings, diagonal galleries, arbitrary angles and rotated main wings',()=>{
  let c=copy(1);c.wings[1].detached=false;expect(()=>validateComposition(c)).toThrow(/detached/);
  c=copy(1);c.connections=[{id:'diagonal',from:'sky-house',to:'west-salon',width:2}];expect(()=>validateComposition(c)).toThrow(/diagonal gallery/);
  c=copy(1);c.wings[1].orientation=31;expect(()=>validateComposition(c)).toThrow();
  c=copy(1);c.wings[0].orientation=15;expect(()=>validateComposition(c)).toThrow(/secondary/);
 });
 it('keeps local approved capabilities separate from the currently advertised Terra placement contract',()=>{
  expect(ARCHITECTURAL_COMPONENTS.find(c=>c.id==='estate-landscape')?.availability).toBe('local');
  expect(terraComponents().map(c=>c.id)).toEqual(['curved-pavilion']);
  const generate=villaProviderOutputSchema({mode:'generate',prompt:'offline estate'});
  expect(generate.safeParse({changes:estateExamples()[0],summary:'offline',unsupported:[]}).success).toBe(false);
  const rotated=estateExamples()[1];delete rotated.estateLandscape;
  expect(generate.safeParse({changes:rotated,summary:'offline',unsupported:[]}).success).toBe(false);
  const edit=villaProviderOutputSchema({mode:'edit',prompt:'offline edit',current:estateExamples()[0]});
  expect(edit.safeParse({changes:{estateLandscape:ESTATE_EXAMPLES[0].estateLandscape},summary:'offline',unsupported:[]}).success).toBe(false);
 });
});
