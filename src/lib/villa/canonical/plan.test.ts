import { describe,it,expect } from 'vitest';
import { compileArchitecturalPlan, architecturalPlanSchema } from './plan';
import { canonicalFixture } from './fixture';
import { validateScene } from '../scene/model';
import { DesignConflict } from '../experimental/semantic-building/compiler';
import { readFileSync } from 'node:fs';
const plan=canonicalFixture;
describe('canonical architectural compiler',()=>{
 it('deterministically produces the complete supported allocation, not a shell-only substitute',()=>{
  const input=plan(),a=compileArchitecturalPlan(input),b=compileArchitecturalPlan(input);
  expect(a.scene).toEqual(b.scene);expect(validateScene(JSON.parse(JSON.stringify(a.scene)))).toEqual(a.scene);
  for(const room of input.spaces)expect(a.scene.elements.some(e=>e.id===`${room.id}-floor`)).toBe(true);
  expect(a.boundaries.length).toBeGreaterThan(0);
  for(const p of input.portals)expect(a.portalEvidence.some(e=>(e as {id:string}).id===p.id)).toBe(true);
  expect(a.stairEvidence).toHaveLength(1);expect(a.scene.elements.find(e=>e.id==='gallery-floor')?.geometry).toMatchObject({type:'extrusion',holes:expect.any(Array)});
  expect(a.scene.elements.filter(e=>e.id.startsWith('pool'))).toHaveLength(6);
  expect(a.scene.elements.find(e=>e.id==='lawn')?.material).toBe('sage');
  for(const r of input.roofs)expect(a.scene.elements.find(e=>e.id===`${r.space}-roof`)?.material).toBe('timber');
  expect(a.access.reachable).toEqual(expect.arrayContaining(input.spaces.filter(s=>!s.outdoor).map(s=>s.id)));
 });
 it('rejects missing enclosure, unreachable rooms and derived geometry arrays',()=>{
  const missing=plan();missing.roofs=missing.roofs.filter(r=>r.space!=='sleep-room');expect(()=>compileArchitecturalPlan(missing)).toThrow('overhead');
  const disconnected=plan();disconnected.portals=disconnected.portals.filter(p=>p.id!=='sleep-door');expect(()=>compileArchitecturalPlan(disconnected)).toThrow('route');
  expect(architecturalPlanSchema.safeParse({...plan(),operations:[]}).success).toBe(false);
 });
 it('rejects omitted access, invalid hosts, overlapping rooms, pool collision and unsupported terrain',()=>{
  expect(architecturalPlanSchema.safeParse({...plan(),requiredAccess:[]}).success).toBe(false);
  const host=plan();host.portals[0].to='sleep-room';expect(()=>compileArchitecturalPlan(host)).toThrow();
  const overlap=plan();overlap.spaces[1].placement={relativeTo:'hall',side:'same',alignment:'start',gap:0};expect(()=>compileArchitecturalPlan(overlap)).toThrow();
  const collision=plan();collision.pools[0].placement={relativeTo:'day-room',side:'same',alignment:'start',gap:0};expect(()=>compileArchitecturalPlan(collision)).toThrow('overlaps');
  const graded=plan();graded.site.grade=.1;expect(()=>compileArchitecturalPlan(graded)).toThrow('Graded');
 });
});
it('derives coordinates from dimensions and rejects cycles instead of accepting coordinate arrays',()=>{
 const p=plan();const first=compileArchitecturalPlan(p);
 const changed=plan();changed.spaces.find(s=>s.id==='day-room')!.width=6;changed.spaces.find(s=>s.id==='sleep-room')!.width=6;changed.spaces.find(s=>s.id==='rear-deck')!.width=6;
 const next=compileArchitecturalPlan(changed);
 expect(next.scene.elements.find(e=>e.id==='day-room-floor')!.size[0]).toBe(6);
 expect(next.scene.elements.find(e=>e.id==='hall-floor')!.at).not.toEqual(first.scene.elements.find(e=>e.id==='hall-floor')!.at);
 expect(Object.keys(next.provenance)).toHaveLength(next.scene.elements.length);
 const cycle=plan();cycle.spaces[1].placement.relativeTo='rear-deck';expect(()=>compileArchitecturalPlan(cycle)).toThrow('cyclic');
 expect(architecturalPlanSchema.safeParse({...p,frame:{origin:[0,0],yaw:0}}).success).toBe(false);
 const coords=plan();Object.assign(coords.spaces[0],{polygon:[[0,0],[1,0],[1,1]]});expect(architecturalPlanSchema.safeParse(coords).success).toBe(false);
});
describe('stacked-volume coordination reporting',()=>{
 it('reports every retained-mansion overlap with its vertical cause and does not reposition or tolerate any',()=>{
  const retained=JSON.parse(readFileSync('docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','utf8')).plan;
  let decisions:string[]=[];
  try{compileArchitecturalPlan(retained);}catch(error){expect(error).toBeInstanceOf(DesignConflict);decisions=(error as DesignConflict).decisions;}
  const pairs=decisions.filter(d=>d.includes('occupied volumes overlap')).map(d=>d.split(':')[0]).sort();
  expect(pairs).toEqual(['foyer/upper-bath-6','foyer/upper-suite-6','gallery/upper-landing','gallery/upper-lounge','living/upper-bath-4','living/upper-suite-4'].sort());
  expect(decisions.find(d=>d.startsWith('foyer/upper-suite-6')) ).toMatch(/rises 0\.60m above the upper floor datum/);
 });
 it('keeps the clash when a lower room is taller than the rise, and accepts it once height equals the rise',()=>{
  const clash=plan();const lower=clash.spaces.find(s=>clash.levels.find(l=>l.id===s.level)?.above===null&&clash.spaces.some(u=>u.placement.side==='same'&&u.placement.relativeTo===s.id));
  if(!lower)return;
  const taller={...clash,spaces:clash.spaces.map(s=>s.id===lower.id?{...s,height:(s.height??0)+.5}:s)};
  expect(()=>compileArchitecturalPlan(taller)).toThrow(/occupied volumes overlap|incomplete overhead enclosure/);
  expect(()=>compileArchitecturalPlan(plan())).not.toThrow();
 });
});
