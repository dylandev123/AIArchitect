import {expect,it,vi} from 'vitest';
import {asSchema} from 'ai';
import {applySceneOperations,elementSchema,operationSchema,validateScene,type ArchitecturalScene} from './model';
import {sceneSpatialGeometry} from './spatial';
import {sceneRelationshipIssues} from './relationships';
import {resolveSceneResult,sceneResponseFormatSchema} from './terra';
import {reviewProgramme} from './programme';
import {useProjectStore} from '@/store/useProjectStore';
const base:ArchitecturalScene={version:'architectural-scene-1',name:'Explicit construction study',elements:[]};
const floor=elementSchema.parse({id:'floor',label:'Floor',kind:'plate',at:[10,.1,-4],rotation:.73,size:[12,.2,12]});
const doorway=operationSchema.parse({op:'assemble',assembly:{kind:'doorway',parameters:{id:'bath-wall',parent:'floor',at:[0,.1,0],width:5,height:3,thickness:.15,openingX:1,openingWidth:.9,openingHeight:2.1}}});
const kitchen=operationSchema.parse({op:'assemble',assembly:{kind:'kitchen-run',parameters:{id:'kitchen',parent:'floor',at:[-3,.1,-3],rotation:Math.PI/2,length:3.6,depth:.6,height:.9,units:6,material:'timber'}}});
it('constructs real wall openings, sill-aligned fitted doors and separate cabinet solids in rotated floor frames',()=>{
 const scene=applySceneOperations(base,[{op:'add',element:floor},doorway,kitchen]);
 const g=sceneSpatialGeometry(scene),wall=g.map.get('bath-wall')!,door=g.map.get('bath-wall-door')!;
 expect(wall.opening).toMatchObject({sill:0,glazed:false,width:.9});
 expect(g.bottom(wall)).toBeCloseTo(.2);expect(g.bottom(door)).toBeCloseTo(.2);
 expect(g.world(door)[3]).toBeCloseTo(.73);
 const cabinets=scene.elements.filter(e=>e.id==='kitchen'||e.id.startsWith('kitchen-unit-'));
 expect(cabinets).toHaveLength(6);
 for(const e of cabinets)expect(g.bottom(e)).toBeCloseTo(.2);
 expect(g.top(g.map.get('kitchen-top')!)).toBeCloseTo(1.1);
 expect(sceneRelationshipIssues(scene)).toEqual([]);
 const edited=applySceneOperations(scene,[{op:'finish',id:'kitchen-unit-3',material:'sage'},{op:'move',id:'floor',at:[15,.1,8]}]);
 expect(edited.elements.find(e=>e.id==='kitchen-unit-3')?.material).toBe('sage');
 expect(validateScene(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
 expect(sceneSpatialGeometry(edited).world(edited.elements.find(e=>e.id===door.id)!)[0]-g.world(door)[0]).toBeCloseTo(5);
});
it.each([[3.425,19,5.7,0],[2.8,16,4.8,1.17],[.15,1,.3,-.4]])('constructs exact stair datums and supported equal rises (%s m)',(rise,risers,run,rotation)=>{
 const scene=applySceneOperations(base,[{op:'add',element:floor},{op:'assemble',assembly:{kind:'straight-stair',parameters:{id:'stair',parent:'floor',at:[0,.1,-3],width:1.2,rise,run,risers,rotation,material:'limestone'}}}]);
 const g=sceneSpatialGeometry(scene),steps=scene.elements.filter(e=>e.kind==='volume');
 expect(steps).toHaveLength(risers);
 steps.forEach((e,i)=>{expect(g.bottom(e)).toBeCloseTo(.2);expect(g.top(e)).toBeCloseTo(.2+(i+1)*rise/risers);});
 const last=steps.at(-1)!;
 expect(g.top(last)).toBeCloseTo(.2+rise);
 // Last far edge meets the explicitly selected run, in the nested floor frame.
 const yaw=.73+rotation,p=g.world(last),start=g.world(floor);
 const sx=start[0]+Math.sin(.73)*-3,sz=start[2]+Math.cos(.73)*-3;
 expect((p[0]-sx)*Math.sin(yaw)+(p[2]-sz)*Math.cos(yaw)+last.size[2]/2).toBeCloseTo(run);
 expect(sceneRelationshipIssues(scene)).toEqual([]);
});
it('rejects impossible door/stair selections atomically rather than resizing or silently downgrading them',()=>{
 const scene=applySceneOperations(base,[{op:'add',element:floor}]),before=JSON.stringify(scene);
 expect(()=>applySceneOperations(scene,[{op:'assemble',assembly:{kind:'doorway',parameters:{id:'bad',at:[0,0,0],width:2,height:3,thickness:.15,openingX:1,openingWidth:1,openingHeight:2}}}])).toThrow('fit');
 expect(()=>applySceneOperations(scene,[{op:'assemble',assembly:{kind:'straight-stair',parameters:{id:'bad',at:[0,0,0],width:1,rise:3,run:2,risers:7}}}])).toThrow('Select');
 expect(JSON.stringify(scene)).toBe(before);
});
it('uses the normal Generate resolver, provider adapter and project history without a parallel construction engine',async()=>{
 const operations=[{op:'add',element:floor},doorway,kitchen];
 const output={name:'Developer construction study',summary:'Explicit construction; not model-generated design evidence.',unsupported:['Room enclosure, bathroom fixtures and circulation are incomplete.'],operations};
 const scene=resolveSceneResult({mode:'generate',prompt:'A kitchen and private bathroom'},output).scene;
 const format=await sceneResponseFormatSchema({mode:'generate',prompt:'A kitchen and private bathroom'});
 expect(JSON.stringify((await asSchema(format).jsonSchema))).toContain('straight-stair');
 expect(JSON.stringify((await asSchema(format).jsonSchema))).toContain('openingWidth');
 const previous=useProjectStore.getState(),saved=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v)}});
 try{
  useProjectStore.setState({projects:[]});const store=useProjectStore.getState(),project=store.createProject('Interior study','house','direct-scene');
  const edited=applySceneOperations(scene,[{op:'finish',id:'kitchen-top',material:'sage'}]);
  store.appendVersion(project.id,'Generate',JSON.stringify(scene));store.appendVersion(project.id,'Edit worktop',JSON.stringify(edited));
  store.undo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(scene);
  store.redo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(edited);
 }finally{useProjectStore.setState(previous);vi.unstubAllGlobals();}
});
it('keeps required versus suggested accommodation and detects labels without interior evidence',()=>{
 const scene=applySceneOperations(base,[{op:'add',element:floor},doorway,kitchen]);
 scene.generationBrief='A kitchen and two bedrooms';
 const entry={name:'Kitchen',zone:'service',purpose:'kitchen',strategy:'Selected run along side wall',requirement:{origin:'user-required',briefQuote:'A kitchen'},floorIds:['floor'],enclosureIds:[],roofIds:[],accessIds:[],limitation:'Appliances/plumbing not supported.',construction:{partitionIds:[],fitOutIds:['kitchen','kitchen-top'],bathroomNames:[],levelAccessIds:[]}};
 scene.architecturalPlan={intendedSpaces:['Kitchen','Bedroom'],programme:[entry,{...entry,name:'Bedroom',zone:'private',purpose:'bedroom',requirement:{origin:'design-choice',briefQuote:''},construction:{...entry.construction,fitOutIds:[]}}]};
 const reviewed=reviewProgramme(scene);
 expect(reviewed.spaces[0].requirement?.origin).toBe('user-required');
 expect(reviewed.issues.join(' ')).toContain('bathroom provision is unrecorded');
 expect(reviewed.spaces.every(s=>s.verifiedComplete===false)).toBe(true);
 scene.architecturalPlan={programme:[{...entry,construction:{...entry.construction,fitOutIds:[]},requirement:{origin:'user-required',briefQuote:'six suites'}}]};
 expect(reviewProgramme(scene).issues.join(' ')).toContain('not an exact excerpt');
 expect(reviewProgramme(scene).issues.join(' ')).toContain('no physical fit-out');
});

it('normalizes strict nullable helper parameters through the real provider adapter without inventing parts',async()=>{
 const schema=asSchema(await sceneResponseFormatSchema({mode:'generate',prompt:'A kitchen'}));
 const parameters={id:'run',at:[0,0,0],parent:null,rotation:null,material:null,length:2.4,depth:.6,height:.9,units:4};
 const plan={scaleRationale:'Compact',arrivalAndCirculation:'One level',volumeHierarchy:'Main room',relationshipsAndViews:'Garden',roofFacadeAndMaterials:'Timber',intendedSpaces:['Kitchen'],programme:[{name:'Kitchen',zone:'service',strategy:'Run selected by author',floorIds:[],enclosureIds:[],roofIds:[],accessIds:[],limitation:'Unenclosed fit-out only',requirement:null,purpose:'kitchen',construction:null}],spatialRelationships:null,designDecisions:null};
 const checked=await schema.validate!({name:'Adapter study',summary:'Offline fixture',unsupported:['Unenclosed fit-out only'],architecturalPlan:plan,operations:[{op:'assemble',assembly:{kind:'kitchen-run',parameters}}]});
 expect(checked.success).toBe(true);
 if(!checked.success)throw checked.error;
 expect(checked.value.operations[0]).toEqual(operationSchema.parse({op:'assemble',assembly:{kind:'kitchen-run',parameters:{...parameters,parent:undefined,rotation:undefined,material:undefined}}}));
});
