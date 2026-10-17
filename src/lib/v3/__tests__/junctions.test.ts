import { describe, expect, it } from 'vitest';
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from '../scene';
import { cottageObject as obj } from '../parity/cottage';
import { deriveV3MassJunctions, junctionRoofEnvelope, roofForMass } from '../junctions';
import { resolveV3JunctionDatums } from '../junctionDatums';
import { primitiveTriangles, subtractJunctionVolume } from '../junctionGeometry';
import { validateV3Scene } from '../validation';
import { dreamMansion } from '../parity/mansion';
import { materializeV3ArchitecturalObject } from '../architecture';
import type { HousePrimitive } from '@/lib/house/types';
const mass=(id:string,x:number,z:number,w=10,d=8,h=3,extra:Partial<V3SceneObject>={})=>obj(id,'building-mass',x,z,w,d,h,0,{levels:1,roofForm:'flat',facadePreset:'punched',...extra});
const scene=(objects:V3SceneObject[]):V3Scene=>({version:3,site:{width:100,depth:100},objects,relationships:[],metadata:{}});
const pair=()=>scene([mass('main',-5,0,10,8,3,{composition:{massHierarchy:'primary'}}),mass('wing',5,0)]);
const sorted=(s:V3Scene)=>compileV3Scene(s).primitives.sort((a,b)=>a.id.localeCompare(b.id));
const related=(p:HousePrimitive,id:string)=>p.sourceObjectId===id||p.sourceObjectIds?.includes(id);
function triangleCentres(p:HousePrimitive) {const {vertices}=primitiveTriangles(p);return Array.from({length:vertices.length/9},(_,i)=>[0,1,2].map(k=>(vertices[i*9+k]+vertices[i*9+3+k]+vertices[i*9+6+k])/3));}
function areaAt(p:HousePrimitive,y:number) {const {vertices:v}=primitiveTriangles(p);let area=0;for(let i=0;i<v.length;i+=9)if([v[i+1],v[i+4],v[i+7]].every(n=>Math.abs(n-y)<1e-6))area+=Math.abs((v[i+3]-v[i])*(v[i+8]-v[i+2])-(v[i+6]-v[i])*(v[i+5]-v[i+2]))/2;return area;}

describe('derived connected mass junctions',()=>{
  it('identifies walls, elevations, roof relationship and material transition with stable pair ids',()=>{
    const s=pair(),d=deriveV3MassJunctions(s);
    expect(d.junctions).toHaveLength(1);
    expect(d.junctions[0]).toMatchObject({id:'junction:main|wing:envelope',relationship:'touching',supported:true,materialTransition:'continuous',roof:{relationship:'same-datum'}});
    expect(d.junctions[0].sharedWalls.map(w=>[w.massId,w.facade])).toEqual([['main','east'],['wing','west']]);
    expect(deriveV3MassJunctions({...s,objects:[mass('unrelated',35,35),...s.objects].reverse()}).junctions).toEqual(d.junctions);
  });
  it('removes both internal facades while retaining exposed authored openings unchanged',()=>{
    const s=pair();s.objects[0].composition={massHierarchy:'primary',openings:[{id:'intentional-entry',type:'door',facade:'north',floors:'ground',start:.2,end:.4}]};
    const before=compileV3Scene(s,{junctions:false}),after=compileV3Scene(s);
    expect(after.primitives.filter(p=>p.id.startsWith('main:east:')||p.id.startsWith('wing:west:'))).toHaveLength(0);
    const entrance=(ps:HousePrimitive[])=>ps.filter(p=>p.id.includes(':intentional-entry:'));
    expect(entrance(after.primitives)).toEqual(entrance(before.primitives));
    expect(entrance(after.primitives).length).toBeGreaterThan(0);
  });
  it('keeps an explicitly authored connecting door aperture while removing its opposite facade',()=>{
    const s=pair();s.objects[0].composition={massHierarchy:'primary',openings:[{id:'connecting-door',type:'door',facade:'east',floors:'ground',start:.3,end:.6}]};
    const before=compileV3Scene(s,{junctions:false}),after=compileV3Scene(s);
    const door=(ps:HousePrimitive[])=>ps.filter(p=>p.id.includes(':connecting-door:'));
    expect(door(after.primitives)).toEqual(door(before.primitives));expect(door(after.primitives).length).toBeGreaterThan(0);
    expect(after.primitives.filter(p=>p.id.startsWith('wing:west:'))).toHaveLength(0);
    expect(deriveV3MassJunctions(s).diagnostics.some(d=>d.code==='JUNCTION_AUTHORED_PARTITION')).toBe(true);
  });
  it('clips only the actual partial shared span and shared height of a taller wall',()=>{
    const s=scene([mass('main',-5,0,10,12,7),mass('wing',5,2,10,4,3)]),out=compileV3Scene(s);
    const remaining=out.primitives.filter(p=>p.id.startsWith('main:east:'));
    expect(remaining.length).toBeGreaterThan(0);
    for(const p of remaining)for(const [x,y,z] of triangleCentres(p))expect(Math.abs(x)<.51&&z>0+1e-6&&z<4-1e-6&&y<3-1e-6).toBe(false);
    expect(remaining.some(p=>triangleCentres(p).some(([,y])=>y>3))).toBe(true);
  });
  it('resolves overlapping and coplanar facades deterministically without changing material owners',()=>{
    const s=scene([mass('main',0,0,10,8,3,{composition:{massHierarchy:'primary'}}),mass('wing',6,0,10,8,3,{material:{id:'wood',color:'#805b3e',surface:'wood'}})]),d=deriveV3MassJunctions(s);
    expect(d.junctions[0].relationship).toBe('overlapping');expect(d.junctions[0].materialTransition).toBe('expressed-edge');
    const out=compileV3Scene(s);
    for(const p of out.primitives.filter(p=>p.sourceObjectId==='wing'&&p.componentRole==='facade wall'))for(const [x,,z] of triangleCentres(p))expect(x<5-1e-6&&Math.abs(z)>3.5).toBe(false);
    expect(out.primitives.filter(p=>p.sourceObjectId==='wing'&&p.componentRole==='facade wall').every(p=>p.color==='#805b3e')).toBe(true);
  });
  it.each(['flat','gable'] as const)('merges aligned %s roofs into one complete assembly with no internal fascia',form=>{
    const s=pair();s.objects=s.objects.map(o=>({...o,roofForm:form,pitch:20}));const out=compileV3Scene(s);
    const roof=out.primitives.filter(p=>p.category==='roof');
    expect(roof.length).toBeGreaterThan(0);expect(roof.every(p=>p.id.startsWith('junction:main|wing:envelope:joined-roof'))).toBe(true);
    expect(roof.every(p=>p.sourceObjectIds?.join('|')==='main|wing'&&['main','wing'].includes(p.sourceObjectId??''))).toBe(true);
    if(form==='flat')expect(roof.filter(p=>p.componentRole==='junction flat roof plate').reduce((n,p)=>n+areaAt(p,3.25),0)).toBeCloseTo(21.5*9.5);
    expect(validateV3CompiledGeometry(s,out).ok).toBe(true);
  });
  it('terminates a lower roof at a taller occupied wall and adds abutment flashing',()=>{
    const s=scene([mass('main',-5,0,10,8,7),mass('wing',5,0)]),out=compileV3Scene(s);
    expect(out.primitives.some(p=>p.componentRole==='junction abutment flashing')).toBe(true);
    for(const p of out.primitives.filter(p=>p.sourceObjectId==='wing'&&p.category==='roof'))for(const [x,y,z] of triangleCentres(p))expect(x< -1e-6&&Math.abs(z)<4&&y<7).toBe(false);
  });
  it('constructs simple orthogonal pitched valleys and pitched/flat transition flashing',()=>{
    for(const second of ['gable','flat'] as const) {
      const s=scene([mass('main',0,0,16,8,4,{roofForm:'gable',pitch:25}),mass('wing',5,7,8,16,4.6,{roofForm:second,pitch:25})]),out=compileV3Scene(s);
      expect(out.primitives.some(p=>p.componentRole===(second==='gable'?'junction valley flashing':'junction roof flashing'))).toBe(true);
      expect(validateV3CompiledGeometry(s,out).ok).toBe(true);
      const ids=out.primitives.map(p=>p.id);expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('diagnoses skew, separated connections and near datums without rewriting authored geometry',()=>{
    const s=pair();s.objects[1]=materializeV3ArchitecturalObject({...s.objects[1],architecture:{...s.objects[1].architecture!,rotationY:.4}});
    const saved=JSON.stringify(s);expect(validateV3Scene(s,{lenient:true}).warnings.join()).toContain('JUNCTION_SKEW_UNSUPPORTED');
    expect(compileV3Scene(s)).toEqual(compileV3Scene(s,{junctions:false}));expect(JSON.stringify(s)).toBe(saved);
    s.objects[1]=mass('wing',30,0);s.relationships=[{from:'main',to:'wing',kind:'connects'}];expect(deriveV3MassJunctions(s).diagnostics[0].code).toBe('JUNCTION_SEPARATED');
    s.objects[1]=mass('wing',5,0,10,8,3.2);expect(deriveV3MassJunctions(s).diagnostics[0].code).toBe('JUNCTION_AMBIGUOUS_DATUM');
  });
  it('emits diagnostics for terrace/parapet and multi-way roof conditions',()=>{
    const s=pair();s.objects[1].roofForm='terrace';expect(deriveV3MassJunctions(s).diagnostics.some(d=>d.code==='JUNCTION_ROOF_UNSUPPORTED')).toBe(true);
    s.objects=[mass('one',0,0),mass('two',4,0),mass('three',2,3)];
    const d=deriveV3MassJunctions(s);expect(d.diagnostics.filter(d=>d.code==='JUNCTION_MULTI_ROOF_UNSUPPORTED')).toHaveLength(3);
    expect(d.junctions.every(j=>j.roof.relationship==='unsupported')).toBe(true);
    expect(validateV3CompiledGeometry(s).ok).toBe(true);
  });
  it('aligns explicit datum groups to the primary host without altering saved mass/roof heights',()=>{
    const s=pair();s.objects.push(obj('main-roof','roof-form',-5,0,10,8,.25,3.2,{hostId:'main',roofForm:'flat',composition:{roofDatumGroup:'arrival'}}),obj('wing-roof','roof-form',5,0,10,8,.25,3,{hostId:'wing',roofForm:'flat',composition:{roofDatumGroup:'arrival'}}));
    const saved=JSON.stringify(s),r=resolveV3JunctionDatums(s);
    expect(r.scene.objects.find(o=>o.id==='wing-roof')!.architecture!.baseElevation).toBe(3.2);
    expect(r.closures).toHaveLength(8);expect(JSON.stringify(s)).toBe(saved);expect(r.diagnostics).toEqual([]);
    s.objects[2].architecture!.baseElevation=2; s.objects[2]=materializeV3ArchitecturalObject(s.objects[2]);
    expect(resolveV3JunctionDatums(s).diagnostics[0].code).toBe('DATUM_ALIGNMENT_BLOCKED');
  });
  it('closes cut solid wall ends with their own material',()=>{
    const p:HousePrimitive={kind:'box',id:'wall',category:'wall',label:'wall',color:'#aa8877',surface:'wood',position:[0,0,0],size:[2,2,2],rotation:[0,0,0]};
    const cut=subtractJunctionVolume(p,[{normal:[-1,0,0],constant:0}])!;
    expect(cut.color).toBe(p.color);expect(cut.surface).toBe('wood');
    const mesh=primitiveTriangles(cut).vertices;let capArea=0;
    for(let i=0;i<mesh.length;i+=9)if([mesh[i],mesh[i+3],mesh[i+6]].every(x=>Math.abs(x)<1e-7))capArea+=Math.abs((mesh[i+4]-mesh[i+1])*(mesh[i+8]-mesh[i+2])-(mesh[i+7]-mesh[i+1])*(mesh[i+5]-mesh[i+2]))/2;
    expect(capArea).toBeCloseTo(4);
  });
  it('keeps one full upper/underside coverage at a non-rectangular flat roof meeting',()=>{
    const s=scene([mass('main',-5,0,10,12),mass('wing',5,3,10,6)]),out=compileV3Scene(s);
    const plates=out.primitives.filter(p=>p.componentRole==='flat roof plate');
    // Clearance leaves 0.25 m eaves: union of 10.5x12.5 and 10.5x6.5, overlap .5x6.5.
    const expected=10.5*12.5+10.5*6.5-.5*6.5;
    expect(plates.reduce((n,p)=>n+areaAt(p,3.25),0)).toBeCloseTo(expected);
    expect(plates.reduce((n,p)=>n+areaAt(p,3),0)).toBeCloseTo(expected);
  });
  it('preserves clipped UV interpolation and original child identity',()=>{
    const mesh:HousePrimitive={kind:'triMesh',id:'surface',label:'test',category:'roof',vertices:[0,0,0,2,0,0,0,0,2],uvs:[0,0,2,0,0,2],color:'#ffffff'};
    const clipped=subtractJunctionVolume(mesh,[{normal:[-1,0,0],constant:-1}]);
    expect(clipped?.id).toBe('surface');expect(clipped?.kind).toBe('triMesh');
    if(clipped?.kind==='triMesh')for(let i=0;i<clipped.vertices.length/3;i++){expect(clipped.uvs![i*2]).toBeCloseTo(clipped.vertices[i*3]);expect(clipped.uvs![i*2+1]).toBeCloseTo(clipped.vertices[i*3+2]);}
  });
  it('keeps mansion IDs, geometry, and junction derivation stable across reload and ordering',()=>{
    const s=dreamMansion(),saved=JSON.stringify(s),out=sorted(s);
    expect(sorted(JSON.parse(saved))).toEqual(out);expect(sorted({...s,objects:[...s.objects].reverse()})).toEqual(out);
    expect(new Set(out.map(p=>p.id)).size).toBe(out.length);expect(JSON.stringify(s)).toBe(saved);
    expect(deriveV3MassJunctions(s).junctions).toHaveLength(4);
    expect(validateV3CompiledGeometry(s).ok).toBe(true);
  });
  it.each(['move','roof','material'] as const)('%s changes only the local mansion dependency region',kind=>{
    const s=dreamMansion();s.objects.push(mass('detached',35,30));const changed=structuredClone(s);
    const target=changed.objects.find(o=>o.id===(kind==='roof'?'great-roof':'primary-wing'))!;
    if(kind==='move') {target.architecture!.z-=1;Object.assign(target,materializeV3ArchitecturalObject(target));}
    if(kind==='roof')target.pitch=22;
    if(kind==='material')target.material={id:'new-stone',color:'#bb9988',surface:'stone'};
    const before=sorted(s),after=sorted(changed);
    const unaffected=kind==='roof'?['pool','pool-deck','view-garden','service-wing','detached']:['pool','pool-deck','view-garden','service-wing','family-wing','arrival-link','detached'];
    for(const id of unaffected)expect(after.filter(p=>related(p,id)),id).toEqual(before.filter(p=>related(p,id)));
    expect(after).not.toEqual(before);
    expect(deriveV3MassJunctions(changed).junctions.map(j=>j.id)).toEqual(deriveV3MassJunctions(s).junctions.map(j=>j.id));
  });
  it('merged roof finish zones retain identical geometry and ids when one finish changes',()=>{
    const s=pair();s.objects.push(obj('roof-aa','roof-form',-5,0,10,8,.25,3,{hostId:'main',roofForm:'flat',material:{id:'metal-a',color:'#445566',surface:'metal'}}),obj('roof-bb','roof-form',5,0,10,8,.25,3,{hostId:'wing',roofForm:'flat',material:{id:'metal-b',color:'#445566',surface:'metal'}}));
    const changed=structuredClone(s);changed.objects[3].material.color='#664433';
    const before=sorted(s),after=sorted(changed);
    expect(after.map(p=>p.id)).toEqual(before.map(p=>p.id));
    expect(after.map(p=>primitiveTriangles(p).vertices)).toEqual(before.map(p=>primitiveTriangles(p).vertices));
    expect(after.filter(p=>p.sourceObjectId==='roof-aa')).toEqual(before.filter(p=>p.sourceObjectId==='roof-aa'));
  });
  it('a roof finish edit cannot propagate to a detached wing',()=>{
    const s=dreamMansion();s.objects.push(mass('detached',35,30));const changed=structuredClone(s);changed.objects.find(o=>o.id==='great-roof')!.material={id:'new-roof',color:'#664433',surface:'metal'};
    expect(sorted(changed).filter(p=>related(p,'detached'))).toEqual(sorted(s).filter(p=>related(p,'detached')));
  });
  it('roof envelope planes agree with the shared pitched construction datum',()=>{
    const s=scene([mass('main',0,0,12,8,4,{roofForm:'gable',pitch:20,overhang:.75})]);
    const r=roofForMass(s,s.objects[0]),e=junctionRoofEnvelope(r,.75);
    expect(e.slopes).toHaveLength(2);
    expect(e.slopes.every(p=>p.normal[1]>0)).toBe(true);
  });
});
