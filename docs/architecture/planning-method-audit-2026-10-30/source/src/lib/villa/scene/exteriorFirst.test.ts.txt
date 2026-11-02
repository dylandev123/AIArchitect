import {expect,it,vi} from 'vitest';
import {asSchema} from 'ai';
import {exteriorStudy} from './exteriorFirst.fixture';
import {applySceneOperations,operationSchema,validateScene} from './model';
import {reviewSceneArchitecture} from './planning';
import {reviewProgramme} from './programme';
import {sceneSpatialGeometry} from './spatial';
import {sceneRelationshipIssues} from './relationships';
import {sceneResponseFormatSchema,sceneSystemPrompt,resolveSceneResult} from './terra';
import {useProjectStore} from '@/store/useProjectStore';

it('prioritizes exterior composition in the actual Generate instructions and retains explicitly requested interiors',()=>{
 const system=sceneSystemPrompt({mode:'generate',prompt:'A six-bedroom Caribbean estate'});
 expect(system).toContain('Concept → Massing → Levels → Roofs → Façades → Entrances');
 expect(system).toContain('Bedroom count drives footprint/wing/level capacity');
 expect(system).toContain('only explicitly requested interior work uses interior-inclusive');
 expect(system).not.toContain('Reserve budget for rooms before satellites');
 expect(system).not.toContain('Reference built partitions/cabinets and separate bathroom entries');
 expect(system).toContain('kitchen-run');expect(system).toContain('facade-bay');
});
it.each([false,true])('constructs a distinct editable exterior offline, preserving real access and pool/roof checks (layered=%s)',layered=>{
 const {scene,architecturalAudit}=exteriorStudy(layered);
 expect(sceneRelationshipIssues(scene)).toEqual([]);
 expect(architecturalAudit.issues).toEqual([]);
 expect(architecturalAudit.designStage).toBe('Exterior-designed, interiors unfinished');
 expect(architecturalAudit.interiorsDeferred).toBe(true);
 expect(architecturalAudit.programme.spaces.every(s=>s.verifiedComplete===false)).toBe(true);
 expect(scene.elements.some(e=>e.assemblyKind==='kitchen-run')).toBe(false);
 expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
 if(layered){
  expect(scene.elements.filter(e=>e.kind==='roof')).toHaveLength(3);
  expect(scene.elements.some(e=>e.kind==='water')).toBe(true);
  const bad=scene.elements.find(e=>e.id==='terrace')!;
  expect(()=>applySceneOperations(scene,[{op:'move',id:bad.id,at:[0,.1,17]}])).toThrow('water plane');
  expect(()=>applySceneOperations(scene,[{op:'move',id:'balcony-guard',at:[-4,3.8,4.94]}])).toThrow('Railing base');
  expect(()=>applySceneOperations(scene,[{op:'move',id:'upper-floor',at:[-4,15,-1]}])).toThrow();
 }
});
it('defers fit-out obligations only in exterior scope and preserves provenance, references and exterior defects',()=>{
 const {scene}=exteriorStudy(false),plan=structuredClone(scene.architecturalPlan) as Record<string,unknown>;
 const historical={...scene,architecturalPlan:{...plan,constructionScope:undefined}};
 expect(reviewProgramme(historical).issues.join(' ')).toContain('interior construction commitments');
 expect(reviewProgramme(scene).issues.join(' ')).not.toContain('interior construction commitments');
 const programme=structuredClone((plan.programme as Record<string,unknown>[]));
 programme[0].requirement={origin:'user-required',briefQuote:'a hundred rooms'};
 programme[0].enclosureIds=['missing'];
 const broken={...scene,architecturalPlan:{...plan,programme}};
 expect(reviewProgramme(broken).issues.join(' ')).toContain('not an exact excerpt');
 expect(reviewProgramme(broken).issues.join(' ')).toContain('missing or wrong kind');
 expect(reviewProgramme(broken).spaces[0].verifiedComplete).toBe(false);
 expect(reviewSceneArchitecture({...scene,architecturalPlan:{...plan,constructionScope:'interior-inclusive'}}).interiorsDeferred).toBe(false);
});
it('checks joint overhead coverage without requiring a single giant roof or hiding gaps',()=>{
 const {scene}=exteriorStudy(true);
 expect(reviewProgramme(scene).issues).toEqual([]);
 const missing={...scene,elements:scene.elements.filter(e=>e.id!=='balcony-deck')};
 expect(reviewProgramme(missing).issues.join(' ')).toContain('full overhead coverage unverified');
 const rotated=structuredClone(scene),angle=.47;
 rotated.elements.forEach(e=>{if(!e.parent){const [x,y,z]=e.at;e.at=[25+Math.cos(angle)*x+Math.sin(angle)*z,y,-10-Math.sin(angle)*x+Math.cos(angle)*z];e.rotation+=angle;}});
 expect(reviewProgramme(rotated).issues).toEqual([]);
});
it.each([0,Math.PI/2,.71])('fits independently editable facade infill in nested rotated frames (%s)',rotation=>{
 const {scene}=exteriorStudy(false);
 const next=applySceneOperations(scene,[{op:'assemble',assembly:{kind:'facade-bay',parameters:{id:'test-bay',parent:'main-floor',at:[0,.1,0],rotation,width:4,height:3,thickness:.2,openingX:.4,sill:.8,openingWidth:2.4,openingHeight:1.6,infill:'glazing',panels:4}}}]);
 const g=sceneSpatialGeometry(next),wall=g.map.get('test-bay')!,panel=g.map.get('test-bay-panel')!;
 expect(panel.at[1]).toBeCloseTo(.1);expect(g.bottom(panel)).toBeCloseTo(1);
 expect(wall.opening?.glazed).toBe(false);expect(panel.parent).toBe(wall.id);
 const edited=applySceneOperations(next,[{op:'finish',id:panel.id,material:'sage'}]);
 expect(edited.elements.find(e=>e.id===wall.id)).toEqual(wall);
});
it('rejects impossible facade choices without mutating a scene',()=>{
 const scene=exteriorStudy(false).scene,before=JSON.stringify(scene);
 const parameters={id:'bad',at:[0,0,0],width:3,height:3,thickness:.2,openingX:0,sill:.4,openingWidth:1.2,openingHeight:2.3,infill:'entrance'};
 expect(()=>applySceneOperations(scene,[{op:'assemble',assembly:{kind:'facade-bay',parameters}}])).toThrow('sill zero');
 expect(()=>operationSchema.parse({op:'assemble',assembly:{kind:'facade-bay',parameters:{...parameters,infill:'glazing',openingX:2}}})).toThrow('must fit');
 expect(JSON.stringify(scene)).toBe(before);
});
it('normalizes exterior scope and facade parameters through the provider strict adapter',async()=>{
 const schema=asSchema(await sceneResponseFormatSchema({mode:'generate',prompt:'Compact exterior'}));
 const {scene,operations}=exteriorStudy(false);
 const normalized=await schema.validate!({name:scene.name,summary:'Offline',unsupported:[],architecturalPlan:scene.architecturalPlan,operations});
 expect(normalized.success).toBe(true);
 expect(JSON.stringify(schema.jsonSchema)).toContain('facade-bay');
});
it('keeps facade edits and deferred scope through actual project history, Undo/Redo and JSON reload',()=>{
 const scene=exteriorStudy(true).scene,previous=useProjectStore.getState(),saved=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v)}});
 try{
  useProjectStore.setState({projects:[]});const store=useProjectStore.getState(),project=store.createProject('Exterior study','house','direct-scene');
  const next=applySceneOperations(scene,[{op:'finish',id:'upper-front-panel',material:'sage'}]);
  store.appendVersion(project.id,'Generate',JSON.stringify(scene));store.appendVersion(project.id,'Panel finish',JSON.stringify(next));
  store.undo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(scene);
  store.redo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(next);
  expect(reviewSceneArchitecture(next).interiorsDeferred).toBe(true);
 }finally{useProjectStore.setState(previous);vi.unstubAllGlobals();}
});
it('keeps pool coping and metre-wide side decks abutting without duplicate walking surfaces',()=>{
 const scene=exteriorStudy(true).scene,g=sceneSpatialGeometry(scene);
 for(const sign of ['minus','plus']){
  const coping=g.map.get(`pool-coping-x-${sign}`)!,deck=g.map.get(`pool-deck-x-${sign}`)!;
  expect(Math.abs(deck.at[0])-deck.size[0]/2).toBeCloseTo(Math.abs(coping.at[0])+coping.size[0]/2);
  expect(deck.size[0]).toBe(1);
 }
 expect(reviewSceneArchitecture(scene).geometry.overlaps).toEqual([]);
});
it('retains a fresh Generate exterior scope without mutating the supplied result or claiming verified completeness',()=>{
 const study=exteriorStudy(false),output={name:study.name,summary:study.summary,unsupported:study.unsupported,architecturalPlan:study.scene.architecturalPlan,operations:study.operations},before=JSON.stringify(output);
 expect(resolveSceneResult({mode:'generate',prompt:'Three-bedroom family home'},output).architecturalAudit.interiorsDeferred).toBe(true);
 expect(JSON.stringify(output)).toBe(before);
});
