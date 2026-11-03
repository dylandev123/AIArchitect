/** An unroofed outdoor space encloses no volume, so it needs no envelope height; enclosed and roofed spaces still do.
 * Developer-authored contract studies only; no AI output and no architectural-quality claim. */
import {describe,expect,it} from 'vitest';
import {compileArchitecturalPlan,deriveBuildingIntent,type ArchitecturalPlan} from './plan';
import {compositionFixture} from './compositions.fixture';
import {compileBuilding,DesignConflict} from '../experimental/semantic-building/compiler';
type Plan=ArchitecturalPlan;
const without=(plan:Plan,...ids:string[]):Plan=>{const next=structuredClone(plan);for(const s of next.spaces)if(ids.includes(s.id))delete s.height;return next;};
const decisions=(plan:Plan):string[]=>{try{compileArchitecturalPlan(plan);return [];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
describe('open-air outdoor spaces',()=>{
 it('derive a zero envelope for unroofed arrival and garden courts in a single-storey house, and still compile',()=>{
  const plan=without(compositionFixture('courtyard'),'arrival','court');
  const byId=Object.fromEntries(compileArchitecturalPlan(plan).vertical.map(v=>[v.id,v]));
  expect(byId.arrival).toMatchObject({height:0,heightSource:'open-air'});
  expect(byId.court).toMatchObject({height:0,heightSource:'open-air'});
  expect(byId.gallery.heightSource).toBe('authored');
 });
 it('applies to a pool-side terrace and any other unroofed outdoor space, not only an arrival court',()=>{
  const plan=compositionFixture('courtyard');
  plan.spaces.push({id:'sun-deck',mass:plan.spaces[0].mass,level:'ground',use:'sun deck',width:6,depth:4,outdoor:true,placement:{relativeTo:'east-wing',side:'north',alignment:'start',gap:0}});
  plan.terraces.push('sun-deck');
  expect(compileArchitecturalPlan(plan).vertical.find(v=>v.id==='sun-deck')).toMatchObject({height:0,heightSource:'open-air'});
 });
 it('still requires a height for enclosed interiors and for roofed outdoor spaces',()=>{
  expect(decisions(without(compositionFixture('courtyard'),'gallery')).join('\n')).toMatch(/gallery: height is required/);
  const veranda=compositionFixture('courtyard');
  veranda.roofs.push({space:'court',form:'flat',rise:.2});
  expect(decisions(without(veranda,'court')).join('\n')).toMatch(/court: height is required/);
 });
 it('keeps an authored outdoor height authoritative',()=>{
  expect(compileArchitecturalPlan(compositionFixture('courtyard')).vertical.find(v=>v.id==='court')).toMatchObject({height:2.7,heightSource:'authored'});
 });
 it('still refuses a same-level overlap with a zero-height open-air space',()=>{
  const {intent}=deriveBuildingIntent(without(compositionFixture('courtyard'),'court'));
  const court=intent.spaces.find(s=>s.id==='court')!,wing=intent.spaces.find(s=>s.id==='west-wing')!;
  court.polygon=wing.polygon.map(p=>[p[0]+.5,p[1]] as [number,number]);
  expect(()=>compileBuilding(intent)).toThrow(/occupied volumes overlap/);
 });
});
