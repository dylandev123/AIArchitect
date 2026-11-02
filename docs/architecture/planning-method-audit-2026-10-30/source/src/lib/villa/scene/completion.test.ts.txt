import { asSchema } from 'ai';
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateScene, type ArchitecturalScene } from './model';
import { circulationFindings } from './completion';
import { reviewSceneArchitecture } from './planning';
import { prepareArchitectureCompletion, sceneSystemPrompt, sceneResponseFormatSchema, sceneRuntimeOutputSchema, resolveSceneResult, sceneMessages } from './terra';
const retained=(file:string)=>validateScene(JSON.parse(readFileSync(file,'utf8')));
const dir='docs/villa-playground/';
it('keeps known retained defects visible after the separate door repair',()=>{
 const original=retained(dir+'redesign-strict-live/after.UNAPPROVED.json');
 const repaired=retained(dir+'redesign-technical-review/repaired.UNAPPROVED.json');
 expect(reviewSceneArchitecture(original).findings.filter(f=>f.category==='confirmed-technical-defect').length).toBeGreaterThanOrEqual(3);
 const findings=reviewSceneArchitecture(repaired).findings;
 expect(findings.some(f=>f.category==='confirmed-technical-defect')).toBe(false);
 for(const code of ['vertical-route-missing','upper-floor-gap','shared-boundary-blocked','pool-evidence-missing']) expect(findings.some(f=>f.code===code),code).toBe(true);
 expect(findings.find(f=>f.code==='shared-boundary-blocked' && f.elementIds.includes('kitchen-floor'))).toBeDefined();
});
const stairs=():ArchitecturalScene=>validateScene({version:'architectural-scene-1',name:'Connected steps',elements:Array.from({length:13},(_,i)=>({id:i===0?'lower-floor':i===12?'upper-floor':`tread-${i}`,label:i===0||i===12?'Room floor':'Stair tread',kind:'plate',at:[i*.3,i*.2-.1,0],size:[i===0||i===12?2:.3,.2,2]}))});
it('requires a spatially connected sequence, tolerates rotated parents and ignores isolated decorative steps',()=>{
 const valid=stairs();expect(circulationFindings(valid)).toEqual([]);
 const broken={...valid,elements:valid.elements.map(e=>e.id==='tread-6'?{...e,at:[30,e.at[1],0] as [number,number,number]}:e)};
 expect(circulationFindings(broken).some(f=>f.code==='vertical-route-missing')).toBe(true);
 const root=validateScene({version:'architectural-scene-1',name:'Root',elements:[{id:'root',label:'Transform',kind:'volume',at:[40,3,-20],rotation:.7,size:[.1,.1,.1]}]}).elements[0];
 expect(circulationFindings({...valid,elements:[root,...valid.elements.map(e=>({...e,parent:'root'}))]})).toEqual([]);
});
it('prepares an autonomous completion request without mutation or a provider call',()=>{
 const current=stairs(),raw=JSON.stringify(current),request=prepareArchitectureCompletion(current);
 expect(request.mode).toBe('edit');expect(request.editIntent).toBe('complete');
 expect(sceneSystemPrompt(request)).toContain('An inaccessible upper residence is incomplete');
 expect(JSON.stringify(current)).toBe(raw);
});
it('does not require openings between private rooms or mistake a usable public opening for blockage',()=>{
 const scene=validateScene({version:'architectural-scene-1',name:'Valid boundary',elements:[
 {id:'living-floor',label:'Living floor',kind:'plate',at:[0,.1,0],size:[4,.2,4]},
 {id:'dining-floor',label:'Dining floor',kind:'plate',at:[4,.1,0],size:[4,.2,4]},
 {id:'shared-wall',label:'Shared wall',kind:'wall',at:[2,1.7,0],rotation:Math.PI/2,size:[4,3,.2],opening:{x:0,sill:0,width:1,height:2.2,glazed:false}},
 ]});
 expect(circulationFindings(scene)).toEqual([]);
 const closed={...scene,elements:scene.elements.map(e=>e.id==='shared-wall'?{...e,opening:undefined}:e)};
 expect(circulationFindings(closed).map(f=>f.code)).toEqual(['shared-boundary-blocked']);
 const privateRooms={...closed,elements:closed.elements.map(e=>e.kind==='plate'?{...e,id:e.id.replace('living','bedroom-one').replace('dining','bedroom-two'),label:'Private bedroom floor'}:e)};
 expect(circulationFindings(privateRooms)).toEqual([]);
});

it('supplies the full retained scene and findings without network access or mutation', async()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try {
 for(const file of ['redesign-strict-live/after.UNAPPROVED.json','redesign-technical-review/repaired.UNAPPROVED.json']) {
  const current=retained(dir+file),snapshot=JSON.stringify(current),request=prepareArchitectureCompletion(current);
  expect(request.current).toEqual(current);
  const context=JSON.parse(sceneMessages(request)[0].content[0].text!);
  expect(context.current).toEqual(current);
  for(const finding of reviewSceneArchitecture(current).findings) expect(request.prompt).toContain(finding.code);
  const instructions=sceneSystemPrompt(request);
  expect(instructions).toContain('Ordinary ambiguity is permission');
  expect(instructions).toContain("Assumptions:");
  expect(instructions).not.toContain('REDESIGN MODE:');
  const schema=await sceneResponseFormatSchema(request);
  const json=(await asSchema(schema).jsonSchema) as {required:string[];properties:Record<string,{minItems?:number}>};
  expect(json.required).toEqual(expect.arrayContaining(['operations','architecturalPlan']));
  expect(json.properties.operations.minItems).toBe(1);
  const plan=JSON.parse(readFileSync(dir+'redesign-live/concept-only.NOT-CONSTRUCTED.json','utf8')).architecturalPlan;
  const output={name:current.name,summary:'Offline contract check',unsupported:[],architecturalPlan:plan,operations:[]};
  expect(sceneRuntimeOutputSchema(request).safeParse(output).success).toBe(false);
  expect(()=>resolveSceneResult(request,{...output,operations:[{op:'finish',id:current.elements[0].id,material:'ivory'}]})).toThrow('requires construction operations');
  expect(()=>resolveSceneResult(request,{...output,operations:[{op:'move',id:current.elements[0].id,at:current.elements[0].at}]})).toThrow('made no architectural change');
  expect(()=>resolveSceneResult(request,{...output,operations:[{op:'move',id:'missing-element',at:[0,0,0]}]})).toThrow();
  expect(JSON.stringify(current)).toBe(snapshot);
 }
 expect(network).not.toHaveBeenCalled();
 } finally {network.mockRestore();}
});
