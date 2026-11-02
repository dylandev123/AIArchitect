import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {beginProposalRevision,submitProposalRevision,reviewProposal,restoreProposalRevision,proposalRevisionRequest,MAX_DESIGN_REVISIONS} from './proposalRevision';
import {retainedProposal,mockedRetainedRevision} from '../../../../../scripts/semantic-proposal-revision-fixtures';
import {compactIntent} from './fixtures';
import {constructSemantic,reviseSemantic} from './generation';
import {physicalEvidence} from './physical';
import {applySceneOperations} from '../../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
const scope=(p:ReturnType<typeof compactIntent>)=>[...p.levels,...p.masses,...p.spaces,...p.portals,...p.stairs].map(x=>x.id.toLowerCase());
it('reports independent retained blockers with dimensions without modifying the paid response',()=>{
 const p=retainedProposal(),original=JSON.stringify(p),report=reviewProposal(p);
 expect(report.findings.filter(f=>f.code==='portal-fit')).toHaveLength(12);
 expect(report.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['reference','roof-floor','partial-edge','stair-section','construction']));
 expect(report.findings.find(f=>f.code==='stair-section')?.facts).toMatchObject({rise:4.2,going:.15,minimumRun:6,minimumLength:9.18,fits:false});
 expect(JSON.stringify(p)).toBe(original);expect(constructSemantic('brief',p).status).toBe('decision-required');
});
it('constructs the labelled mock relationship revision deterministically with complete history and editable geometry',()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline'));
 try{
 const original=retainedProposal(),proposal=mockedRetainedRevision();
 const state=beginProposalRevision('Original mansion brief',original,scope(proposal.intent));
 const ready=submitProposalRevision(state,proposal);
 expect(ready.attempts[0].findings).toEqual([]);expect(ready.status).toBe('ready');
 expect(ready.original).toEqual(original);expect(state.attempts).toEqual([]);
 expect(physicalEvidence(ready.session!.compiled).failures).toEqual([]);
 expect(submitProposalRevision(state,proposal)).toEqual(ready);
 expect(restoreProposalRevision(JSON.stringify(ready))).toEqual(ready);
 const edited=applySceneOperations(ready.session!.scene,[{op:'finish',id:'great-salon-roof',material:'sage'}]);
 expect(restoreProposalRevision(JSON.stringify({...ready,session:{...ready.session,scene:edited}})).session!.scene).toEqual(edited);
 expect(network).not.toHaveBeenCalled();
 }finally{network.mockRestore();}
});
it('bounds repeated invalid revisions and preserves every attempt; refuses silent concept/scope changes',()=>{
 const p=retainedProposal(),s=beginProposalRevision('brief',p,['social-belvedere']);
 const outside=submitProposalRevision(s,mockedRetainedRevision());expect(outside.status).toBe('revisable');
 expect(outside.attempts[0].findings.some(f=>f.code==='preservation')).toBe(true);
 const exhausted=submitProposalRevision(outside,p);expect(exhausted.status).toBe('escalation-required');expect(exhausted.attempts).toHaveLength(MAX_DESIGN_REVISIONS);
 expect(()=>submitProposalRevision(exhausted,p)).toThrow('Revision closed');expect(restoreProposalRevision(JSON.stringify(exhausted))).toEqual(exhausted);
 const valid=mockedRetainedRevision();valid.intent.thesis='Entirely different house';
 expect(submitProposalRevision(beginProposalRevision('brief',p,scope(valid.intent)),valid).attempts[0].findings.some(f=>f.code==='preservation')).toBe(true);
});
it('requires all dependencies to coordinate, rejecting an isolated stair or roof fix',()=>{
 for(const kind of ['stair','roof']){
 const p=retainedProposal();if(kind==='stair')p.intent.stairs[0].run=6;else p.intent.spaces.find((s:{id:string})=>s.id==='guest-suite-3').roof=false;
 const r=submitProposalRevision(beginProposalRevision('brief',retainedProposal(),scope(p.intent)),p);
 expect(r.status).toBe('revisable');expect(r.session).toBeUndefined();expect(r.attempts[0].findings.length).toBeGreaterThan(0);
 }
});
it('handles a different angled two-level arrangement, physical failures and impossible geometry',()=>{
 const good={status:'proposed' as const,intent:compactIntent(),limitations:['Developer mock; unfinished']},bad=structuredClone(good);
 bad.intent.stairs[0].run=2;
 const s=beginProposalRevision('Narrow angled home',bad,['ascent']);const r=submitProposalRevision(s,good);
 expect(r.attempts[0].findings).toEqual([]);expect(r.status).toBe('ready');
 const impossible=structuredClone(good);impossible.intent.stairs[0].run=20;
 expect(submitProposalRevision(s,impossible).session).toBeUndefined();
 const obstructed=JSON.parse(readFileSync('docs/architecture/semantic-generation/mocks/luxury.response.json','utf8'));obstructed.intent.portals.find((p:{id:string})=>p.id==='living-link').offset=8.7;
 // The kernel's own stair-threshold guard now rejects this layout deterministically before any
 // sampled physical review is reached (previously it compiled and only the physical probe flagged it).
 const construction=constructSemantic('brief',obstructed);
 expect(construction.status).toBe('decision-required');
 expect(JSON.stringify((construction as {decisions?:string[]}).decisions)).toContain('living-link: unsupported-capability: left threshold crosses the selected stair flight/void');
 expect(reviewProposal(obstructed).findings.some(f=>f.code==='construction'&&JSON.stringify(f).includes('living-link'))).toBe(true);
});
it('preserves generated revision dependencies, manual edits and project Undo/Redo after construction',()=>{
 const original=retainedProposal(),p=mockedRetainedRevision(),r=submitProposalRevision(beginProposalRevision('brief',original,scope(p.intent)),p);
 if(!r.session)throw Error(JSON.stringify(r.attempts));
 const next=structuredClone(p);next.intent.portals[0].offset+=.2;
 const edited=applySceneOperations(r.session.scene,[{op:'finish',id:'great-salon-roof',material:'sage'}]);
 const revision=reviseSemantic(r.session,next,edited);if(revision.status!=='ready')throw Error(revision.decisions.join('\n'));
 expect(revision.operations).toHaveLength(2);expect(revision.session.scene.elements.find(e=>e.id==='great-salon-roof')!.material).toBe('sage');
 const conflict=applySceneOperations(edited,[{op:'move',id:'arrival-to-salon',at:[1,2,3]}]);
 expect(reviseSemantic(r.session,next,conflict).status).toBe('decision-required');
 const old=useProjectStore.getState(),storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
 try{
 useProjectStore.setState({projects:[]});const store=useProjectStore.getState(),project=store.createProject('Mock revision','house','direct-scene');
 store.appendVersion(project.id,'Construct mocked revision',JSON.stringify(r.session.scene));store.appendVersion(project.id,'Revise portal',JSON.stringify(revision.session.scene));
 store.undo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(JSON.parse(JSON.stringify(r.session.scene)));
 store.redo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(JSON.parse(JSON.stringify(revision.session.scene)));expect(storage.size).toBeGreaterThan(0);
 }finally{useProjectStore.setState(old);vi.unstubAllGlobals();}
});

it('returns dimensional revision context, preserves narrowed scope and escalates an explicit redesign request',()=>{
 const p={status:'proposed' as const,intent:compactIntent(),limitations:['Developer mock']};p.intent.stairs[0].run=2;
 const state=beginProposalRevision('Narrow home',p,['ascent']),packet=proposalRevisionRequest(state);
 expect(packet.editableIds).toEqual(['ascent']);expect(packet.maximumAttempts).toBe(2);
 expect(packet.dependencyReview.spaces).toEqual(['stair-hall','upper-gallery']);
 expect(packet.dependencyReview.portals).toEqual(expect.arrayContaining(['street-door','day-door','sleep-door']));
 expect(packet.preserved.entities.some(x=>x.id==='day-room')).toBe(true);
 const r=submitProposalRevision(state,{status:'decision-required',decisions:['A turning stair requires a broader redesign.']});
 expect(r.status).toBe('escalation-required');expect(r.attempts).toHaveLength(1);expect(r.session).toBeUndefined();
 expect(restoreProposalRevision(JSON.stringify(r))).toEqual(r);
 const changed={...structuredClone(p),intent:compactIntent()};changed.intent.spaces[0].use='Unrequested replacement';
 const broad=beginProposalRevision('Narrow home',p,['ascent','street-step']);
 expect(submitProposalRevision(broad,changed).attempts[0].findings.some(f=>f.code==='preservation')).toBe(true);
 const ids=structuredClone(changed);ids.intent.spaces[0].id='replacement';
 expect(submitProposalRevision(broad,ids).session).toBeUndefined();
});
