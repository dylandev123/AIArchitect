import {expect,it,vi} from 'vitest';
import {asSchema} from 'ai';
import {profileFreedomStudy} from './profileFreedom.fixture';
import {applySceneOperations,elementSchema,validateScene,type ArchitecturalScene} from './model';
import {buildProfileGeometry,validateProfile,type ProfileGeometry} from './profileGeometry';
import {sceneResponseFormatSchema,sceneSystemPrompt,resolveSceneResult} from './terra';
import {sceneRelationshipIssues} from './relationships';
import {reviewSceneArchitecture} from './planning';
import {useProjectStore} from '@/store/useProjectStore';
const square=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
const geometry:ProfileGeometry={type:'extrusion',axis:'y',outline:square,holes:[[[-.3,-.3],[-.3,.3],[.3,.3],[.3,-.3]]]};
const empty:ArchitecturalScene={version:'architectural-scene-1',name:'Empty',elements:[]};
const part=(id:string,at=[0,.1,0],size=[10,.2,10])=>elementSchema.parse({id,label:id,kind:'plate',at,size,geometry});
it.each(['angular','flowing','estate'] as const)('creates, renders to triangles, edits and reloads %s through the authoritative executor',study=>{
 const {scene,operations}=profileFreedomStudy(study);
 expect(sceneRelationshipIssues(scene)).toEqual([]);
 expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
 for(const e of scene.elements.filter(e=>e.geometry)){
  const g=buildProfileGeometry(e.geometry!,e.size);expect(g.getAttribute('position').count).toBeGreaterThan(12);
  expect(g.boundingBox!.min.toArray()).toEqual(e.size.map(v=>expect.closeTo(-v/2,4)));
  expect(g.boundingBox!.max.toArray()).toEqual(e.size.map(v=>expect.closeTo(v/2,4)));g.dispose();
 }
 const result=resolveSceneResult({mode:'generate',prompt:'Offline capability replay'}, {name:scene.name,summary:'Developer study',unsupported:[],operations});
 expect(result.scene.elements).toEqual(scene.elements);
 const target=scene.elements.find(e=>e.geometry)!,next=applySceneOperations(scene,[{op:'replace',id:target.id,element:{...target,color:'#d58051'}}]);
 expect(next.elements.find(e=>e.id===target.id)?.color).toBe('#d58051');
 expect(reviewSceneArchitecture(next).issues.join(' ')).toContain('Profile geometry');
 expect(reviewSceneArchitecture(next).geometry.plateSurfaceAreaM2).toBeNull();
});
it('rejects self-crossings, degenerate edges, outside/touching/nested holes and unbounded resource inputs atomically',()=>{
 for(const invalid of [
  {...geometry,outline:[[-.5,-.5],[.5,.5],[-.5,.5],[.5,-.5]]},
  {...geometry,outline:[...square,square[0]]},
  {...geometry,holes:[[[-.5,-.2],[-.3,-.2],[-.3,.2]]]},
  {...geometry,holes:[geometry.holes[0],[[-.1,-.1],[.1,-.1],[0,.1]]]},
  {...geometry,outline:square.map(p=>p.map(v=>v/2))},
 ])expect(()=>validateProfile(invalid)).toThrow();
 expect(()=>elementSchema.parse({...part('bad'),geometry:{type:'arc',axis:'y',start:0,sweep:7,innerRatio:.5,segments:100000}})).toThrow();
 const scene=applySceneOperations(empty,[{op:'add',element:part('ring')}]),before=JSON.stringify(scene);
 expect(()=>applySceneOperations(scene,[{op:'replace',id:'ring',element:{...scene.elements[0],geometry:{...geometry,holes:[square]}}}])).toThrow();
 expect(JSON.stringify(scene)).toBe(before);
});
it('does not invent support across profile holes or reject a pool inside an empty courtyard',()=>{
 const ring=part('ring');
 const floating=elementSchema.parse({id:'floating',label:'floating',kind:'plate',at:[0,.5,0],size:[1,.2,1]});
 expect(()=>applySceneOperations(empty,[{op:'add',element:ring},{op:'add',element:floating}])).toThrow('contact');
 const water=elementSchema.parse({id:'water',label:'water',kind:'water',at:[0,.1,0],size:[4,.05,4]});
 expect(()=>applySceneOperations(empty,[{op:'add',element:ring},{op:'add',element:water}])).not.toThrow();
 expect(()=>applySceneOperations(empty,[{op:'add',element:{...ring,geometry:{...geometry,holes:[]}}},{op:'add',element:water}])).toThrow('water');
});
it('preserves nested transforms, actual support, curve edits, history and saved JSON',()=>{
 const base=part('base'),child=part('child',[0,.2,0],[10,.2,10]);child.parent=base.id;
 const scene=applySceneOperations(empty,[{op:'add',element:base},{op:'add',element:child}]);
 const next=applySceneOperations(scene,[{op:'rotate',id:'base',rotation:.63},{op:'move',id:'base',at:[12,.1,-8]},{op:'replace',id:'child',element:{...child,geometry:{...geometry,holes:[]},material:'bronze',color:'#aa6522'}}]);
 expect(sceneRelationshipIssues(next)).toEqual([]);
 expect(()=>applySceneOperations(next,[{op:'move',id:'child',at:[0,5,0]}])).toThrow();
 const previous=useProjectStore.getState(),saved=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v)}});
 try{useProjectStore.setState({projects:[]});const store=useProjectStore.getState(),p=store.createProject('Profiles','house','direct-scene');store.appendVersion(p.id,'Initial',JSON.stringify(scene));store.appendVersion(p.id,'Profile edit',JSON.stringify(next));store.undo(p.id);expect(validateScene(JSON.parse(store.getProject(p.id)!.houseConfigJson))).toEqual(scene);store.redo(p.id);expect(validateScene(JSON.parse(store.getProject(p.id)!.houseConfigJson))).toEqual(next);}finally{useProjectStore.setState(previous);vi.unstubAllGlobals();}
});
it('exposes both profile branches in the real strict Generate schema and normalizes optional null fields',async()=>{
 const schema=asSchema(await sceneResponseFormatSchema({mode:'generate',prompt:'Curved house'}));
 const wire=JSON.stringify(schema.jsonSchema);expect(wire).toContain('innerRatio');expect(wire).toContain('outline');expect(wire).not.toContain('prefixItems');
 const {operations}=profileFreedomStudy('flowing');
 const parsed=await schema.validate!({name:'Offline',summary:'Curved',unsupported:[],architecturalPlan:{scaleRationale:'Brief',arrivalAndCirculation:'Entry',volumeHierarchy:'Curved',relationshipsAndViews:'Garden',roofFacadeAndMaterials:'Ring',intendedSpaces:['Home'],programme:[{name:'Home',zone:'public',strategy:'enclosed',floorIds:['courtyard-floor'],enclosureIds:['outer-stone'],roofIds:['courtyard-roof'],accessIds:['arrival-door'],limitation:'Interiors deferred'}]},operations});
 expect(parsed.success).toBe(true);
 const system=sceneSystemPrompt({mode:'generate',prompt:'House'});expect(system).toContain('GENERAL-PURPOSE EDITABLE PROFILES');expect(system).not.toContain('curved roofs are available only');
});

it.each(['x','y','z'] as const)('builds closed correctly oriented profile solids along %s',axis=>{
 const g=buildProfileGeometry({...geometry,axis},[10,4,6]),p=g.getAttribute('position');
 let volume=0;
 for(let i=0;i<p.count;i+=3){const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],c=[p.getX(i+2),p.getY(i+2),p.getZ(i+2)];volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
 expect(volume).toBeCloseTo(10*4*6*(1-.6*.6),3);g.dispose();
});
it('edits curve parameters, dimensions, material and transform independently without regeneration',()=>{
 const scene=profileFreedomStudy('flowing').scene,target=scene.elements.find(e=>e.id==='courtyard-roof')!;
 if(target.geometry?.type!=='arc')throw Error('Expected arc');
 const next=applySceneOperations(scene,[{op:'replace',id:target.id,element:{...target,geometry:{...target.geometry,innerRatio:.55,segments:64}}},{op:'finish',id:target.id,material:'bronze'},{op:'rotate',id:target.id,rotation:.12},{op:'resize',id:target.id,size:[27,.35,21]}]);
 expect(next.elements.find(e=>e.id==='courtyard-floor')).toBe(scene.elements.find(e=>e.id==='courtyard-floor'));
 expect(next.elements.find(e=>e.id===target.id)?.geometry).toMatchObject({innerRatio:.55,segments:64});
 expect(validateScene(JSON.parse(JSON.stringify(next)))).toEqual(next);
});
it('rejects place-on over profile holes rather than assuming a filled flat support',()=>{
 const scene=applySceneOperations(empty,[{op:'add',element:part('ring')},{op:'add',element:elementSchema.parse({id:'post',label:'Post',kind:'volume',at:[8,.5,0],size:[1,1,1]})}]);
 expect(()=>applySceneOperations(scene,[{op:'place-on',id:'post',support:'ring',offset:[0,0]}])).toThrow('horizontal');
});
it('retains the 400-element cap with bounded editable profile scenes',()=>{
 const start=performance.now();
 const operations=Array.from({length:400},(_,i)=>({op:'add',element:part(`profile-${i}`,[i*12,.1,0])}));
 const scene=applySceneOperations(empty,operations);expect(scene.elements).toHaveLength(400);
 expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
 expect(performance.now()-start).toBeLessThan(10000);
 expect(()=>applySceneOperations(scene,[{op:'add',element:part('overflow')}])).toThrow();
});
it('supports conventional straight guards on actual profile cap triangles, preserving courtyard gaps',()=>{
 const rail=(id:string,at:number[],width:number)=>elementSchema.parse({id,label:id,kind:'balcony',at,size:[width,1,.1]});
 const scene=applySceneOperations(empty,[{op:'add',element:part('ring')}]);
 expect(()=>applySceneOperations(scene,[{op:'add',element:rail('edge',[0,.7,4],8)}])).not.toThrow();
 expect(()=>applySceneOperations(scene,[{op:'add',element:rail('over-hole',[0,.7,0],8)}])).toThrow('full rendered span');
});
it('retains occupied-roof rejection using actual profile solids, with courtyard holes kept empty',()=>{
 const floor=elementSchema.parse({id:'room-floor',label:'Floor',kind:'plate',at:[0,.1,0],size:[4,.2,4]});
 const wall=elementSchema.parse({id:'enclosure',label:'Wall',kind:'wall',at:[0,1.7,-2],size:[4,3,.2]});
 const roof=elementSchema.parse({id:'profile-roof',label:'Roof',kind:'roof',at:[0,.4,0],size:[10,.2,10],geometry:{...geometry,holes:[]}});
 const scene={...empty,elements:[floor,wall,roof],architecturalPlan:{programme:[{name:'Home',zone:'public',floorIds:['room-floor'],enclosureIds:['enclosure']}]}};
 expect(sceneRelationshipIssues(scene).some(i=>i.rule==='roof-occupied-volume')).toBe(true);
 const withCourtyard={...scene,elements:[floor,wall,{...roof,geometry}]};
 expect(sceneRelationshipIssues(withCourtyard).some(i=>i.rule==='roof-occupied-volume')).toBe(false);
});
