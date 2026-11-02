/** Pool and landscape items may be anchored to a space or to another pool/landscape item.
 * Developer-authored plans exercise the contract only; they are not AI output. */
import {describe,expect,it} from 'vitest';
import {compileArchitecturalPlan,type ArchitecturalPlan} from './plan';
import {canonicalFixture} from './fixture';
import {compositionFixture} from './compositions.fixture';
import {DesignConflict} from '../experimental/semantic-building/compiler';
type Plan=ArchitecturalPlan;
const decisions=(plan:Plan):string[]=>{try{compileArchitecturalPlan(plan);return [];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
const at=(plan:Plan,id:string)=>compileArchitecturalPlan(plan).scene.elements.find(e=>e.id===id)!;
const place=(relativeTo:string,side:'east'|'west'|'north'|'south',gap:number)=>({relativeTo,side,alignment:'centre' as const,gap});

describe('typed site anchors',()=>{
 it('places a lawn beyond a pool exactly where the shared placement rule puts it (two-level house)',()=>{
  const plan=canonicalFixture();
  plan.landscape=[{id:'lawn',kind:'lawn',placement:place('pool','east',2),width:4,depth:4}];
  const pool=at(plan,'pool'),lawn=at(plan,'lawn');
  expect(lawn.at[0]-pool.at[0]).toBeCloseTo(5/2+2+4/2);
  expect(lawn.at[2]-pool.at[2]).toBeCloseTo(0);
 });
 it('chains several levels of site items in a different, multilevel waterfront arrangement',()=>{
  const plan=compositionFixture('waterfront'),pool=plan.pools[0];
  plan.landscape=[
   {id:'bed-a',kind:'bed',placement:place(pool.id,'north',1),width:3,depth:3},
   {id:'lawn-b',kind:'lawn',placement:place('bed-a','north',1),width:3,depth:3},
  ];
  const a=at(plan,'bed-a'),b=at(plan,'lawn-b'),p=at(plan,pool.id);
  expect(a.at[0]-p.at[0]).toBeCloseTo(0);
  expect(a.at[2]-p.at[2]).toBeCloseTo(pool.depth/2+1+3/2);
  expect(b.at[2]-a.at[2]).toBeCloseTo(3/2+1+3/2);
 });
 it('rejects a cycle, a self reference and an unknown anchor, each naming the item',()=>{
  const cycle=canonicalFixture();
  cycle.pools[0].placement=place('lawn','east',2);cycle.landscape=[{id:'lawn',kind:'lawn',placement:place('pool','east',2),width:4,depth:4}];
  expect(decisions(cycle).join('\n')).toMatch(/cyclic site anchor/);
  const self=canonicalFixture();self.landscape=[{id:'lawn',kind:'lawn',placement:place('lawn','east',2),width:4,depth:4}];
  expect(decisions(self).join('\n')).toMatch(/lawn: cyclic site anchor/);
  const unknown=canonicalFixture();unknown.landscape=[{id:'lawn',kind:'lawn',placement:place('nowhere','east',2),width:4,depth:4}];
  expect(decisions(unknown).join('\n')).toMatch(/lawn: site anchor nowhere is neither a space nor a pool\/landscape item/);
 });
 it('still validates geometry: an anchored item outside the site or over another allocation is refused',()=>{
  const far=canonicalFixture();far.site={...far.site,width:30,depth:30};far.landscape=[{id:'lawn',kind:'lawn',placement:place('pool','east',40),width:4,depth:4}];
  expect(decisions(far).join('\n')).toMatch(/lawn: outside site/);
  const over=canonicalFixture();over.landscape=[{id:'lawn',kind:'lawn',placement:place('pool','east',0),width:4,depth:4},{id:'bed',kind:'bed',placement:place('pool','east',0),width:4,depth:4}];
  expect(decisions(over).join('\n')).toMatch(/overlaps occupied site allocation|outside site/);
 });
 it('keeps ids unambiguous: a site item cannot reuse a space id',()=>{
  const plan=canonicalFixture();plan.landscape=[{id:'hall',kind:'lawn',placement:place('pool','east',2),width:4,depth:4}];
  expect(decisions(plan).join('\n')).toMatch(/identifiers must be unique/i);
 });
});
