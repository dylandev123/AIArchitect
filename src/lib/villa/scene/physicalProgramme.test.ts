import { expect, it } from 'vitest';
import { validateScene } from './model';
import { reviewPhysicalProgramme } from './physicalProgramme';
import { sceneProviderOutputSchema, sceneResponseFormatSchema, resolveSceneResult } from './terra';

const allocation=(name:string,quantity:number,unitNetAreaM2:number,allowanceM2:number,floorIds=['floor'])=>({name,quantity,unitNetAreaM2,allowanceM2,floorIds});
function study(width:number,depth:number,allocations:ReturnType<typeof allocation>[],upper=false) {
 const plan={physicalProgramme:{propertyType:'Developer fixture',basis:'Explicit test demand, never price conversion',allocations}};
 return validateScene({version:'architectural-scene-1',name:'OFFLINE capacity fixture',architecturalPlan:plan,elements:[{id:'floor',kind:'plate',label:'Floor',at:[0,.1,0],size:[width,.2,depth]},...(upper?[{id:'upper',kind:'plate',label:'Upper',at:[0,3.3,0],size:[width,.2,depth]}]:[])]});
}
it('keeps a compact home compact and identifies a six-suite programme that does not fit',()=>{
 const compact=reviewPhysicalProgramme(study(10,9,[allocation('Bedrooms',3,12,12),allocation('Living/service',1,32,10)]));
 expect(compact.status).toBe('capacity-only');expect(compact.groups[0]).toMatchObject({requiredM2:90,capacityM2:90});
 const estate=reviewPhysicalProgramme(study(18,11,[allocation('Suites',6,45,90),allocation('Living/service',1,210,80)]));
 expect(estate.status).toBe('discrepancy');expect(estate.groups[0]).toMatchObject({requiredM2:650,capacityM2:198});
 expect(reviewPhysicalProgramme(study(30,24,[allocation('Suites',6,45,90),allocation('Living/service',1,210,80)])).status).toBe('capacity-only');
});
it('measures constrained multilevel capacity without counting levels as repeated footprint',()=>{
 const result=reviewPhysicalProgramme(study(6,12,[allocation('Home',1,110,25,['floor','upper'])],true));
 expect(result.groups[0]).toMatchObject({requiredM2:135,capacityM2:144});expect(result.groups[0].datums).toHaveLength(2);
});
it('merges partial shared allocations transitively and never double spends floors',()=>{
 const scene=study(6,12,[allocation('A',1,60,0),allocation('B',1,60,0,['upper']),allocation('C',1,60,0,['floor','upper'])],true);
 const result=reviewPhysicalProgramme(scene);expect(result.groups).toHaveLength(1);expect(result.groups[0]).toMatchObject({requiredM2:180,capacityM2:144,status:'underprovided'});
});
it('withholds capacity for overlapping rotated floors, missing floors and profile bounds',()=>{
 const scene=study(10,10,[allocation('Home',1,150,0,['floor','upper'])],true);
 scene.elements[1].at=[1,.1,0];scene.elements[1].rotation=.4;
 expect(reviewPhysicalProgramme(scene).groups[0].capacityM2).toBeNull();
 scene.elements.pop();expect(reviewPhysicalProgramme(scene).groups[0].capacityM2).toBeNull();
});
it('retains legacy runtime reads but requires numeric demand from new Generate providers',()=>{
 const scene=study(10,10,[allocation('Home',1,80,20)]);
 expect(reviewPhysicalProgramme({...scene,architecturalPlan:undefined}).status).toBe('unrecorded');
 const output={name:'Legacy',summary:'Replay',unsupported:[],operations:[]};
 expect(sceneProviderOutputSchema({mode:'generate',prompt:'Home'}).safeParse(output).success).toBe(false);
 const replay=resolveSceneResult({mode:'generate',prompt:'Legacy replay'},{...output,operations:[{op:'add',element:scene.elements[0]}]});
 expect(replay.scene.elements).toEqual(scene.elements);
});

it('requires numeric demand even when a new provider response has all legacy intent fields',async()=>{
 const schema=await sceneResponseFormatSchema({mode:'generate',prompt:'Six-suite estate'});
 const plan={scaleRationale:'Chosen estate scale',arrivalAndCirculation:'Entry',volumeHierarchy:'Living and private',relationshipsAndViews:'Waterfront',roofFacadeAndMaterials:'Stone',intendedSpaces:['Suites'],programme:[{name:'Suites',zone:'private',strategy:'Capacity only',floorIds:['floor'],enclosureIds:[],roofIds:[],accessIds:[],limitation:'Unverified'}]};
 const output={name:'Offline',summary:'Contract test',unsupported:[],operations:[],architecturalPlan:plan};
 expect((await schema.validate!(output) as {success:boolean}).success).toBe(false);
 expect((await schema.validate!({...output,architecturalPlan:{...plan,physicalProgramme:{propertyType:'Estate',basis:'Six requested suites',allocations:[allocation('Suites',6,45,90)]}}}) as {success:boolean}).success).toBe(true);
});
it('uses nested world datums and rejects profile bounds as area proof',()=>{
 const scene=study(10,10,[allocation('Home',1,90,0)]);
 scene.elements.push({...scene.elements[0],id:'parent',kind:'volume',at:[20,0,-10],rotation:.7});
 scene.elements[0].parent='parent';
 expect(reviewPhysicalProgramme(scene).groups[0].capacityM2).toBe(100);
 scene.elements[0].geometry={type:'extrusion',axis:'y',outline:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],holes:[]};
 expect(reviewPhysicalProgramme(scene).groups[0].capacityM2).toBeNull();
});

it.each([
 ['Compact affordable three-bedroom family home',10,9,[allocation('Bedrooms',3,12,12),allocation('Living/service',1,32,10)],false,90],
 ['Substantial luxury waterfront estate with six suites',30,24,[allocation('Suites',6,45,90),allocation('Living/service',1,210,80)],false,720],
 ['Contemporary residence on an 8 metre wide site with 1 metre side reserves',6,12,[allocation('Home',1,110,25,['floor','upper'])],true,144],
] as const)('executes an offline capacity mock for %s without promoting it to a completed house',async(brief,width,depth,allocations,upper,capacity)=>{
 const scene=study(width,depth,[...allocations],upper);
 if(upper)scene.elements.push({...scene.elements[0],id:'support',kind:'volume',at:[0,1.7,0],size:[2,3,2]});
 const floorIds=scene.elements.filter(e=>e.kind==='plate').map(e=>e.id);
 const architecturalPlan={...(scene.architecturalPlan as object),constructionScope:'exterior',scaleRationale:'Offline demand regression',arrivalAndCirculation:'Access unbuilt in this capacity mock',volumeHierarchy:'Capacity fixture only',relationshipsAndViews:'Site and exterior design unverified',roofFacadeAndMaterials:'Envelope intentionally unbuilt',intendedSpaces:['Residence'],programme:[{name:'Residence',zone:'private',strategy:'Capacity test only',floorIds,enclosureIds:[],roofIds:[],accessIds:[],limitation:'No constructed rooms or envelope claimed'}]};
 const schema=await sceneResponseFormatSchema({mode:'generate',prompt:brief});
 const output={name:scene.name,summary:'Deterministic capacity mock, not a model house',unsupported:['Envelope, access and exterior amenities unbuilt'],architecturalPlan,operations:scene.elements.map(element=>({op:'add',element}))};
 expect((await schema.validate!(output) as {success:boolean}).success).toBe(true);
 const replay=resolveSceneResult({mode:'generate',prompt:brief},output);
 expect(replay.architecturalAudit.physicalProgramme.groups[0].capacityM2).toBe(capacity);
 expect(replay.architecturalAudit.status).toBe('incomplete');
 expect(replay.scene.elements).toEqual(scene.elements);
 if(upper)expect(Math.max(...scene.elements.filter(e=>e.kind==='plate').map(e=>e.size[0]))).toBeLessThanOrEqual(8-2);
});
