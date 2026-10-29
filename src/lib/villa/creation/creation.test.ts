import { describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mockProposal, ribbonMesh, sampleRibbon, validateProposal, validatePlacement, worldBounds, defaultPlacement } from './model';
import { candidateDraft, validatePinnedStudy } from './candidate';
import { listCandidates, saveCandidate } from './store';
import { COMPOSITION_EXAMPLES } from '../composition-examples';
import { terraComponents } from '../component-registry';
const image='data:image/png;base64,'+Buffer.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x02\x80\0\0\x01\x68','binary').toString('base64');
const evidence=()=>COMPOSITION_EXAMPLES.slice(0,2).map((villa,i)=>({villa,placement:i?{x:15,z:8,orientation:25}:defaultPlacement,image,view:'Poolside',reviewed:true}));
afterEach(()=>vi.restoreAllMocks());
describe('bounded architectural creation',()=>{
 it('constructs two distinct closed, consistently oriented, finite meshes within budget',()=>{
  const meshes=['wave','fan'].map(v=>ribbonMesh(mockProposal(v as 'wave'|'fan')));
  expect(meshes[0]).not.toEqual(meshes[1]);
  for(const vertices of meshes) {
   expect(vertices.every(Number.isFinite)).toBe(true);expect(vertices.length/9).toBeLessThan(3000);
   const edges=new Map<string,number>();let volume=0;
   for(let i=0;i<vertices.length;i+=9){const [a,b,c]=[vertices.slice(i,i+3),vertices.slice(i+3,i+6),vertices.slice(i+6,i+9)];
    const key=(v:number[])=>v.map(x=>x.toFixed(7)).join(',');
    for(const [u,v] of [[a,b],[b,c],[c,a]]){const e=[key(u),key(v)].sort().join('|');edges.set(e,(edges.get(e)??0)+1);}
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
   }
   expect([...edges.values()].every(n=>n===2)).toBe(true);expect(volume).toBeGreaterThan(1);
  }
 });
 it('honors dimensions, station edits, floor clearance and rotated envelopes',()=>{
  const p=mockProposal(); expect(sampleRibbon(p,0,0)[0]).toBe(-4.5);expect(sampleRibbon(p,1,0)[0]).toBe(4.5);
  const changed=structuredClone(p);changed.geometry.stations[1].rise+=.6;expect(ribbonMesh(changed)).not.toEqual(ribbonMesh(p));
  for(const orientation of [0,25,90,179,270,359]) {
   const placement={x:0,z:0,orientation},b=worldBounds(p,placement),a=orientation*Math.PI/180;
   for(let i=0;i<=72;i++)for(const v of [-1,0,1]) {const [x,y,z]=sampleRibbon(p,i/72,v);expect(y).toBeGreaterThanOrEqual(2.6);const X=x*Math.cos(a)+z*Math.sin(a),Z=-x*Math.sin(a)+z*Math.cos(a);expect(X).toBeGreaterThanOrEqual(b.left);expect(X).toBeLessThanOrEqual(b.right);expect(Z).toBeGreaterThanOrEqual(b.rear);expect(Z).toBeLessThanOrEqual(b.front);}
  }
 });
 it('rejects unknown builders, code, invalid dimensions, bank and incompatible attachments',()=>{
  const p=mockProposal();
  for(const invalid of [{...p,code:'alert(1)'},{...p,attachment:'wall'},{...p,geometry:{...p.geometry,builder:'arbitrary@1'}},{...p,geometry:{...p.geometry,length:Infinity}},{...p,geometry:{...p.geometry,width:5,height:3,stations:p.geometry.stations.map(s=>({...s,width:1.5,bank:18}))}}])expect(()=>validateProposal(invalid)).toThrow();
  expect(()=>validatePlacement(p,{x:0,z:-5,orientation:0},COMPOSITION_EXAMPLES[0])).toThrow(/clearance/);
  expect(()=>validatePlacement(p,{x:0,z:12,orientation:0},COMPOSITION_EXAMPLES[0])).toThrow(/clearance/);
  expect(()=>validatePlacement(p,{x:100,z:100,orientation:0},COMPOSITION_EXAMPLES[0])).toThrow(/garden/);
  for(const e of evidence())expect(()=>validatePlacement(p,e.placement,e.villa)).not.toThrow();
 });
 it('stores immutable versions, requires approval for reuse, and never exposes candidates to paid Terra',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'villa-creation-'));vi.spyOn(process,'cwd').mockReturnValue(dir);
  try {
   const draft=candidateDraft(mockProposal(),'Wave canopy',evidence());
   expect(()=>validatePinnedStudy({schemaVersion:1,candidate:draft,villa:COMPOSITION_EXAMPLES[0],placement:defaultPlacement})).toThrow(/approved/);
   const first=await saveCandidate(draft),second=await saveCandidate(first,true);
   expect(first.status).toBe('experimental');expect(second.status).toBe('approved');expect(second.version).toBe(2);
   await expect(saveCandidate({...first,originalIntent:'tampered'},true)).rejects.toThrow(/exact/);
   const study=validatePinnedStudy({schemaVersion:1,candidate:second,villa:COMPOSITION_EXAMPLES[0],placement:defaultPlacement});
   await saveCandidate({...draft,proposal:{...draft.proposal,name:'Changed later'}});
   expect((await listCandidates()).find(c=>c.version===1)).toEqual(first);expect(study.candidate.proposal.name).toBe('Tidal Ribbon');
   expect(terraComponents().some(c=>c.id===draft.id)).toBe(false);
   expect(()=>candidateDraft(mockProposal(),'test',[evidence()[0],evidence()[0]])).toThrow(/different/);
  }finally{vi.restoreAllMocks();await rm(dir,{recursive:true,force:true});}
 });
});
