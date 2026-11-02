import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateScene,applySceneOperations,type ArchitecturalScene} from './model';
import {circulationFindings} from './completion';
import {focusedConstructionFindings} from './focusedConstruction';
import {reviewSceneArchitecture} from './planning';
const load=()=>validateScene(JSON.parse(readFileSync('docs/architecture/completion-network-restored/after.UNAPPROVED.json','utf8')));
it('distinguishes geometric contact from a usable route and does not seed from the pool floor',()=>{
 const s=load();expect(circulationFindings(s)).toEqual([]);
 const findings=focusedConstructionFindings(s);
 expect(findings.find(f=>f.elementIds.includes('stair-tread-07')&&f.elementIds.includes('guest-floor'))?.message).toContain('1.800 m');
 expect(findings.some(f=>f.code==='stair-headroom-obstructed'&&f.elementIds.includes('stair-tread-06'))).toBe(false);
 expect(findings.find(f=>f.code==='stair-headroom-obstructed'&&f.elementIds.includes('stair-tread-07'))?.category).toBe('likely-architectural-incompleteness');
 const collision=applySceneOperations(s,[{op:'move',id:'guest-floor',at:[5,1.7,1]}]);
 expect(focusedConstructionFindings(collision).some(f=>f.code==='stair-headroom-obstructed'&&f.elementIds.includes('guest-floor')&&f.category==='confirmed-technical-defect')).toBe(true);
 expect(findings.some(f=>f.code==='stair-endpoint-disconnected')).toBe(false);
 expect(findings.some(f=>f.code==='upper-access-obstructed')).toBe(false);
 expect(findings.filter(f=>f.code==='upper-access-raised-sill')).toHaveLength(2);
 expect(findings.some(f=>f.code==='pool-wall-bottom-gap')).toBe(false);
 expect(findings.some(f=>f.code==='pool-shallow-basin')).toBe(true);
});
it('allows a sill-aligned small door in a larger opening but catches out-of-opening placement',()=>{
 const s=load();const doorFindings=(s:ArchitecturalScene)=>reviewSceneArchitecture(s).findings.filter(f=>f.elementIds.includes('ocean-loggia-door'));
 expect(doorFindings(s)).toEqual([]);
 const floating=applySceneOperations(s,[{op:'move',id:'ocean-loggia-door',at:[0,-3,0]}]);
 expect(doorFindings(floating).some(f=>f.category==='confirmed-technical-defect')).toBe(true);
 const raised=applySceneOperations(s,[{op:'move',id:'ocean-loggia-door',at:[0,-.2,0]}]);
 expect(doorFindings(raised).some(f=>f.message.includes('door sill does not align'))).toBe(true);
});
it('preserves exact surface union with the executor repair, retaining actual headroom failures',()=>{
 const s=load(),raw=JSON.stringify(s);
 const repaired=applySceneOperations(s,JSON.parse(readFileSync('docs/architecture/completion-functional-review/repair.operations.json','utf8')));
 expect(focusedConstructionFindings(s).some(f=>f.code==='stair-landing-overlap')).toBe(true);
 expect(focusedConstructionFindings(repaired).some(f=>f.code==='stair-landing-overlap')).toBe(false);
 expect(focusedConstructionFindings(repaired).some(f=>f.code==='stair-headroom-obstructed')).toBe(true);
 expect(JSON.stringify(s)).toBe(raw);
});
it('checks the actual upper opening intersection, not merely whether a wall has a door',()=>{
 const s=load();const blocked=applySceneOperations(s,[{op:'replace',id:'guest-west-wall-new',element:{...s.elements.find(e=>e.id==='guest-west-wall-new')!,opening:{x:2,sill:.2,width:1.1,height:2.4,glazed:false}}}]);
 expect(focusedConstructionFindings(blocked).some(f=>f.code==='upper-access-obstructed'&&f.elementIds.includes('guest-floor'))).toBe(true);
});
it('finds missing endpoint contacts and wall-to-bottom gaps without rejecting a shallow reflecting pool',()=>{
 const s=load(),detached={...s,elements:s.elements.filter(e=>!['salon-floor','upper-bridge-landing','owner-floor','guest-floor'].includes(e.id))};
 expect(focusedConstructionFindings(detached).some(f=>f.code==='stair-endpoint-disconnected')).toBe(true);
 const gap={...s,elements:s.elements.map(e=>e.id==='pool-north-wall'?{...e,at:[e.at[0],1,e.at[2]] as [number,number,number]}:e)};
 expect(focusedConstructionFindings(gap).some(f=>f.code==='pool-wall-bottom-gap')).toBe(true);
 expect(focusedConstructionFindings(s).find(f=>f.code==='pool-shallow-basin')?.category).toBe('likely-architectural-incompleteness');
});
it('retains findings in rotated parent coordinates',()=>{
 const s=load(),root=validateScene({version:'architectural-scene-1',name:'Root',elements:[{id:'root',label:'Frame',kind:'volume',at:[40,0,-20],rotation:.7,size:[.1,.1,.1]}]}).elements[0];
 const rotated={...s,elements:[root,...s.elements.map(e=>e.parent?e:{...e,parent:'root'})]};
 expect(focusedConstructionFindings(rotated).map(f=>[f.code,f.elementIds])).toEqual(focusedConstructionFindings(s).map(f=>[f.code,f.elementIds]));
});
