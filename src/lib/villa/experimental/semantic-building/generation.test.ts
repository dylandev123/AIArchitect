import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {generateSemantic,constructSemantic,restoreSemantic,reviseSemantic} from './generation';
import {physicalEvidence} from './physical';
import {applySceneOperations} from '../../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
const mock=(name='family')=>JSON.parse(readFileSync(`docs/architecture/semantic-generation/mocks/${name}.response.json`,'utf8'));
it.each(['family','luxury'])('runs %s mock planning through real construction, physical checks, reload and history',async name=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline'));
 const old=useProjectStore.getState();const storage=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
 try{
 const planner=vi.fn(async()=>mock(name));const outcome=await generateSemantic('Exact brief',planner);
 expect(planner).toHaveBeenCalledTimes(1);expect(outcome.status).toBe('ready');if(outcome.status!=='ready')throw Error('Failed');
 const session=outcome.session;expect(physicalEvidence(session.compiled).failures).toEqual([]);
 expect(JSON.stringify(restoreSemantic(JSON.stringify(session)))).toEqual(JSON.stringify(session));
 const response=mock(name);response.intent.portals.find((p:{id:string})=>p.id==='front-door').offset+=.15;
 const revision=reviseSemantic(session,response);expect(revision.status).toBe('ready');if(revision.status!=='ready')throw Error('Failed');
 expect(revision.operations).toHaveLength(2);
 const edited=applySceneOperations(revision.session.scene,[{op:'finish',id:revision.session.scene.elements[0].id,material:'sage'}]);
 const editedSession={...revision.session,scene:edited};expect(restoreSemantic(JSON.stringify(editedSession)).scene).toEqual(edited);
 useProjectStore.setState({projects:[]});const store=useProjectStore.getState(),p=store.createProject('Experimental','house','direct-scene');
 store.appendVersion(p.id,'Generate',JSON.stringify(session.scene));store.appendVersion(p.id,'Revision and finish',JSON.stringify(edited));
 store.undo(p.id);expect(JSON.parse(store.getProject(p.id)!.houseConfigJson)).toEqual(JSON.parse(JSON.stringify(session.scene)));
 store.redo(p.id);expect(JSON.parse(store.getProject(p.id)!.houseConfigJson)).toEqual(JSON.parse(JSON.stringify(edited)));expect(storage.size).toBeGreaterThan(0);
 expect(network).not.toHaveBeenCalled();
 }finally{network.mockRestore();useProjectStore.setState(old);vi.unstubAllGlobals();}
});
it('surfaces malformed, unsupported and hidden inaccessible decisions without geometry',async()=>{
 expect(constructSemantic('brief',{status:'decision-required',decisions:['Pitched roofs unsupported.']})).toMatchObject({status:'decision-required'});
 const malformed=mock();malformed.intent.spaces[0].polygon[0]=[null,0];expect(constructSemantic('brief',malformed).status).toBe('decision-required');
 const gap=mock();gap.intent.spaces.find((s:{id:string})=>s.id==='garden').polygon.forEach((p:number[])=>p[1]+=2);expect(constructSemantic('brief',gap).status).toBe('decision-required');
 const hidden=mock();hidden.intent.requiredAccess=['arrival'];expect(constructSemantic('brief',hidden)).toMatchObject({status:'decision-required',decisions:expect.arrayContaining([expect.stringContaining('requiredAccess')])});
 const planner=vi.fn(async()=>{throw Error('Provider failure');});await expect(generateSemantic('brief',planner)).rejects.toThrow('Provider failure');expect(planner).toHaveBeenCalledTimes(1);
});
it('refuses manual dependent edits and topology migration; preserves unrelated finish',()=>{
 const o=constructSemantic('brief',mock());if(o.status!=='ready')throw Error('Failed');const s=o.session;
 const response=mock();response.intent.portals.find((p:{id:string})=>p.id==='front-door').offset+=.15;
 const manual=applySceneOperations(s.scene,[{op:'move',id:'front-door',at:[0,1,0]}]);
 expect(reviseSemantic(s,response,manual)).toMatchObject({status:'decision-required',decisions:[expect.stringContaining('manual edit')]});
 const roof=s.scene.elements.find(e=>e.kind==='roof')!;
 const finished=applySceneOperations(s.scene,[{op:'finish',id:roof.id,material:'sage'}]);const revised=reviseSemantic(s,response,finished);
 if(revised.status!=='ready')throw Error('Failed');expect(revised.session.scene.elements.find(e=>e.id===roof.id)?.material).toBe('sage');
});
it('revises level-dependent treads, void and cover without changing the chosen composition',()=>{
 const o=constructSemantic('brief',mock('luxury'));if(o.status!=='ready')throw Error('Failed');
 const p=mock('luxury');p.intent.levels[1].top+=.1;
 p.intent.spaces.filter((s:{level:string;outdoor:boolean;roof:boolean})=>s.level==='ground'&&!s.outdoor&&!s.roof).forEach((s:{height:number})=>s.height+=.1);
 const r=reviseSemantic(o.session,p);if(r.status!=='ready')throw Error(r.decisions.join('\n'));
 expect(physicalEvidence(r.session.compiled).failures).toEqual([]);
 expect(r.session.compiled.stairEvidence[0]).toMatchObject({endpoint:expect.closeTo(3.9,8)});
 expect(r.session.proposal.intent.spaces.map(s=>s.polygon)).toEqual(o.session.proposal.intent.spaces.map(s=>s.polygon));
 expect(r.session.scene.elements.map(e=>e.id)).toEqual(o.session.scene.elements.map(e=>e.id));
});
it('rejects a left stair threshold that graph connectivity alone used to accept',()=>{
 const p=mock('luxury');p.intent.portals.find((p:{id:string})=>p.id==='living-link').offset=8.7;
 const o=constructSemantic('brief',p);expect(o.status).toBe('decision-required');
 if(o.status==='decision-required')expect(o.decisions.join(' ')).toContain('stair flight/void');
});
