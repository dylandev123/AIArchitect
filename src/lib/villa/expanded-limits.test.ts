import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {landscapeAcceptance,validateComposition,type VillaComposition} from './composition';
import {resolveVillaResult} from './terra';
import {estateRouteSchema,circulationPlanting,routeVertices} from './estate-landscape';
import {ellipsePlate,ellipseArc} from './experimental/pavilion-geometry';
import {VILLA_LIMITS as L} from './limits';
const dir='docs/villa-playground/expanded-limits';
const examples=JSON.parse(readFileSync(`${dir}/examples.json`,'utf8')) as VillaComposition[];
describe('expanded estates offline geometry regressions',()=>{
 it.each(examples)('$id retains all authored dimensions and finite reusable geometry',c=>{
  expect(validateComposition(c)).toEqual(c);
  expect(resolveVillaResult({mode:'generate',prompt:'Large estate'},{changes:c,summary:'Estate',unsupported:[]}).config).toEqual(c);
  for(const r of c.estateLandscape?.routes??[])expect(routeVertices(r).every(Number.isFinite)).toBe(true);
  for(const p of c.components??[]){expect(ellipsePlate(p.width/2,p.depth/2,.24).every(Number.isFinite)).toBe(true);expect(ellipseArc(p.width/2,p.depth/2,.2,p.height,20,160).every(Number.isFinite)).toBe(true);}
 });
 it('recovers the retained design with landscape drafts and unchanged architecture',()=>{
  const raw=JSON.parse(readFileSync(`${dir}/original.response.json`,'utf8'));
  const {config:c}=resolveVillaResult({mode:'generate',prompt:'Offline original recovery'},raw);
  if(!('version' in c))throw Error('Expected composition');
  expect(c.wings).toEqual(raw.changes.wings);
  expect(c.estateLandscape).toEqual(raw.changes.estateLandscape);
  expect(landscapeAcceptance(c).unresolved.length).toBeGreaterThan(0);
 });
 it('honours an explicit fixed large site exactly and rejects an explicit small site',()=>{
  const c=examples[0],raw={changes:c,summary:'Estate',unsupported:[]};
  const site={x:0,z:0,width:600,depth:600};
  const result=resolveVillaResult({mode:'generate',prompt:'Fixed lot',site},raw).config as VillaComposition;
  expect(result.siteMode).toBe('fixed');expect(result.garden).toEqual(site);
  expect(()=>resolveVillaResult({mode:'generate',prompt:'Small lot',site:{x:0,z:0,width:12,depth:12}},raw)).toThrow();
 });
 it('rejects combined expensive facades while allowing the larger individual wing',()=>{
  const c=structuredClone(examples.find(c=>c.id==='large-modern')!);
  for(const w of c.wings){w.width=64;w.depth=64;w.storeys=2;}
  expect(()=>validateComposition(c)).toThrow(/browser budget/);
 });
 it('rejects long paths that would silently coarsen safety sampling',()=>{
  expect(estateRouteSchema.safeParse({id:'too-long',kind:'drive',width:12,points:[{x:-500,z:0},{x:500,z:0}],planting:'none'}).success).toBe(false);
 });
 it('reports malformed control counts without throwing from the curve builder',()=>{
  for(const points of [[],[{x:0,z:0}]])expect(estateRouteSchema.safeParse({id:'invalid',kind:'walk',width:2,points,planting:'none'}).success).toBe(false);
 });
 it('bounds decorative planting on long routes without altering route geometry',()=>{
  const c=examples.find(c=>c.id==='large-modern')!,before=structuredClone(c);
  expect(circulationPlanting(c.estateLandscape!,[]).length).toBeLessThanOrEqual(L.circulationPlants);
  expect(c).toEqual(before);
 });
});
