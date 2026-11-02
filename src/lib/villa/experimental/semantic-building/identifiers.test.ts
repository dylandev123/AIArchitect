import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {normalizeSemanticIdentifiers} from './identifiers';
import {constructSemantic,restoreSemantic} from './generation';
const fixture=()=>JSON.parse(readFileSync('docs/architecture/semantic-generation/mocks/family.response.json','utf8'));
it('normalizes every identity and reference atomically without mutating architectural data',()=>{
 const p=fixture(),base=constructSemantic('test',p);if(base.status!=='ready')throw Error('fixture');
 const ids=new Set([p.intent.id,...['levels','masses','spaces','portals','stairs'].flatMap(k=>p.intent[k].map((e:{id:string})=>e.id))]);
 const renamed=JSON.parse(JSON.stringify(p,(_key,value)=>typeof value==='string'&&ids.has(value)?` ${value.toUpperCase().replaceAll('-','_')} `:value));
 const before=JSON.stringify(renamed),result=constructSemantic('test',renamed);
 expect(JSON.stringify(renamed)).toBe(before);expect(result.status).toBe('ready');if(result.status!=='ready')throw Error(result.decisions.join());
 expect(result.session.scene).toEqual(base.session.scene);expect(result.session.compiled.provenance).toEqual(base.session.compiled.provenance);
 expect(result.session.inputEvidence?.response).toEqual(renamed);
 expect(restoreSemantic(JSON.stringify(result.session))).toEqual(result.session);
});
it('rejects collisions across kinds, ambiguous aliases and dangling typed references',()=>{
 const collision=fixture();collision.intent.levels.push({...collision.intent.levels[0],id:collision.intent.spaces[0].id.toUpperCase()});
 expect(()=>normalizeSemanticIdentifiers(collision)).toThrow('collision');
 const ambiguous=fixture();ambiguous.intent.levels.push({...ambiguous.intent.levels[0],id:ambiguous.intent.levels[0].id.toUpperCase()});
 expect(()=>normalizeSemanticIdentifiers(ambiguous)).toThrow('collision');
 const broken=fixture();broken.intent.spaces[0].level=broken.intent.spaces[0].id;
 expect(()=>normalizeSemanticIdentifiers(broken)).toThrow('broken levels reference');
});
it('leaves invalid punctuation for schema rejection and preserves geometric failures',()=>{
 const p=fixture();p.intent.id='bad/id';expect(constructSemantic('test',p).status).toBe('decision-required');
 const q=fixture();q.intent.spaces[0].polygon.reverse();expect(constructSemantic('test',q).status).toBe('decision-required');
});
it('accepts low uncovered outdoor cells while retaining interior minimum height',()=>{
 const p=fixture();p.intent.spaces.filter((s:{outdoor:boolean})=>s.outdoor).forEach((s:{height:number})=>s.height=.2);
 expect(constructSemantic('test',p).status).toBe('ready');
 p.intent.spaces.find((s:{outdoor:boolean})=>!s.outdoor).height=.2;
 expect(constructSemantic('test',p)).toMatchObject({status:'decision-required',decisions:[expect.stringContaining('height')]});
});
it('replays the retained paid response and exposes a genuine typed reference failure',()=>{
 const p=JSON.parse(readFileSync('docs/architecture/semantic-generation/live-fresh-2026-10-31/semantic-proposal.json','utf8'));
 const original=JSON.stringify(p);
 expect(constructSemantic('retained',p)).toMatchObject({status:'decision-required',decisions:[expect.stringContaining('broken masses reference ocean-terrace')]});
 expect(JSON.stringify(p)).toBe(original);
 // Diagnostic isolation only: removing the invalid narrative reference exposes
 // all sixteen identity adaptations without changing the retained response.
 delete p.intent.masses[1].relatesTo;
 const normalized=normalizeSemanticIdentifiers(p);
 expect(normalized.mappings).toHaveLength(16);
 expect(constructSemantic('diagnostic only',p)).toMatchObject({status:'decision-required',decisions:[expect.stringContaining('roof conflicts')]});
});
