import { expect,it } from 'vitest';
import { laderaScene } from './example';
import { proposalFixture } from './designProposal.fixture';
import { reviewDesignFidelity, validateDesignProposal } from './designProposal';
import { architecturalFreedomStudy } from './architecturalFreedom.fixture';
import { strictSceneResponseSchema } from './terra';
import { designProposalSchema } from './designProposal';
import { Output } from 'ai';

it('preserves world geometry including nested/rotated parts, profiles and exact choices',()=>{
 const p=proposalFixture(laderaScene,['salon-floor','bridge-floor']);
 expect(reviewDesignFidelity(laderaScene,p).issues).toEqual([]);
 const changed=structuredClone(laderaScene);changed.elements.find(e=>e.id==='salon-floor')!.size[0]-=1;
 expect(reviewDesignFidelity(changed,p).issues.join(' ')).toContain('dimensions');
 const removed=structuredClone(laderaScene);removed.elements=removed.elements.filter(e=>e.kind!=='entrance');
 expect(reviewDesignFidelity(removed,p).issues.join(' ')).toContain('omitted');
 const material=structuredClone(laderaScene);material.elements[0].material='sage';
 expect(reviewDesignFidelity(material,p).issues.join(' ')).toContain('material');
 expect(reviewDesignFidelity(laderaScene,p).accommodation.every(s=>!s.completedUsableRoom)).toBe(true);
});
it('does not prescribe one level, one roof form, symmetry, IDs or a rectangular mansion layout',()=>{
 const {scene}=architecturalFreedomStudy();
 const p=proposalFixture(scene,['west-ground','west-upper','arrival-hall','east-salon']);
 expect(reviewDesignFidelity(scene,p).issues).toEqual([]);
 expect(new Set(p.anchors.map(a=>a.yaw)).size).toBeGreaterThan(2);
 expect(new Set(p.spaces.map(s=>s.centre[1])).size).toBeGreaterThan(1);
});
it('rejects missing references, duplicate commitments and fixed-glass access',()=>{
 const p=proposalFixture(laderaScene,['salon-floor']);
 const missing=structuredClone(p);missing.routes[0].via=['invented'];
 expect(()=>validateDesignProposal(missing)).toThrow('absent anchor');
 const duplicate=structuredClone(p);duplicate.anchors.push(duplicate.anchors[0]);
 expect(()=>validateDesignProposal(duplicate)).toThrow('duplicate');
 const glass=structuredClone(p);glass.spaces[0].accessIds=[laderaScene.elements.find(e=>e.kind==='glazing')!.id];
 expect(()=>validateDesignProposal(glass)).toThrow('actual entrance');
});
it('serializes a strict planning wire contract without operations or optional object keys',async()=>{
 const schema=await strictSceneResponseSchema(designProposalSchema);
 const format=await Output.object({schema}).responseFormat;
 if(format?.type!=='json'||!format.schema)throw Error('Missing JSON schema');
 const visit=(n:Record<string,unknown>)=>{
  if(n.properties){expect(n.required).toEqual(Object.keys(n.properties));expect(n.additionalProperties).toBe(false);Object.values(n.properties).forEach(v=>visit(v as Record<string,unknown>));}
  if(n.items)visit(n.items as Record<string,unknown>);
  if(n.anyOf)(n.anyOf as Record<string,unknown>[]).forEach(visit);
 };
 visit(format.schema as Record<string,unknown>);expect(format.schema.properties).not.toHaveProperty('operations');
});
it('rejects inconsistent space dimensions and overlapping constructed-space declarations before operations',()=>{
 const p=proposalFixture(laderaScene,['salon-floor']);
 const oversized=structuredClone(p);oversized.spaces[0].size[0]+=10;
 expect(()=>validateDesignProposal(oversized)).toThrow('does not fit');
 const overlap=structuredClone(p);overlap.spaces[0].stage='constructed-space';overlap.spaces.push({...overlap.spaces[0],id:'second-room'});
 expect(()=>validateDesignProposal(overlap)).toThrow('overlap');
 const relation=structuredClone(p);relation.relationships=[{subject:p.spaces[0].floorId,target:p.spaces[0].roofIds[0],relation:'above',clearance:0,reason:'Contradictory test relation.'}];
 expect(()=>validateDesignProposal(relation)).toThrow('inconsistent spatial');
});
it('preserves curved/profile commitments instead of accepting a box with the same bounds',async()=>{
 const {profileFreedomStudy}=await import('./profileFreedom.fixture');
 const {scene}=profileFreedomStudy('flowing');
 const p=proposalFixture(scene);
 expect(reviewDesignFidelity(scene,p).status).toBe('matched-anchors');
 const box=structuredClone(scene);const target=box.elements.find(e=>e.geometry)!;delete target.geometry;
 expect(reviewDesignFidelity(box,p).issues.join(' ')).toContain('profile');
});
it('allows open outdoor spaces without inventing enclosure or roofs',()=>{
 const p=proposalFixture(laderaScene,['salon-floor','balcony-deck']);
 const outdoor=p.spaces.find(s=>s.floorId==='balcony-deck')!;
 outdoor.environment='outdoor';outdoor.enclosureIds=[];outdoor.roofIds=[];outdoor.accessIds=[];
 expect(()=>validateDesignProposal(p)).not.toThrow();
});

it('accepts upper floor plates as overhead commitments across existing configurations',()=>{
 for(const [scene, floors] of [[laderaScene,['salon-floor']], [architecturalFreedomStudy().scene,['west-ground','west-upper']]] as const){
  const p=proposalFixture(scene,[...floors]);
  const plate=p.anchors.find(a=>a.kind==='plate'&&a.id!==p.spaces[0].floorId)!;
  // Reference-kind contract only: shelter coverage is not certified by this check.
  p.spaces[0].roofIds=[plate.id];
  expect(()=>validateDesignProposal(p)).not.toThrow();
  plate.kind='water';
  expect(()=>validateDesignProposal(p)).toThrow('roof or plate');
 }
});
