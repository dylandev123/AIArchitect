/**
 * Independent design input, consumed once into V3. NOT a second scene format:
 * no runtime transforms, meshes, detailed objects or persisted blueprint copy.
 * Existing V3 semantics/builders remain the construction and editing authority.
 */
import { z } from 'zod';
import { siteFeatureConstructionIssues, isWaterFeature } from './siteFeatureConstruction';
import { plannedDrySurface } from './plannedSiteGeometry';
import { resolvedFacadeComposition, v3CompositionSchema } from './composition';
import { LOCAL_FACADE_CODES } from './facadeOpeningRecovery';
import { v3FootprintSchema, type V3Footprint } from './footprintSchema';
import { v3EstatePlanSchema } from './estatePlan';
import { runtimeGeometryFromArchitecture } from './architecture';
import { segmentPoint,segmentLength } from './curvedFootprint';
import { auditV3Blueprint, type V3BlueprintFinding } from './blueprint';
import { approveV3Blueprint, auditV3BlueprintElaboration, type V3BlueprintApproval } from './blueprintApproval';
import { auditV3Interior } from './interior';
import { ingestV3GenerationOutput } from './ingestion';
import { normalizeV3GenerationOutput } from './generation';
import { compileV3Scene, type V3Scene, type V3SceneObject } from './scene';
import { V3_FLOOR_SLAB } from './circulation';
import { effectiveV3Scene } from './derivedSupport';
import { resolveV3Fidelity } from './fidelity';
import { resolveV3JunctionDatums } from './junctionDatums';
import { roofClearanceOverhangs } from './roofClearance';
import { roofFinish,fittedRhythmWidth } from './compositionPolicies';
import { inferV3GeometryKind } from './renderability';
import { footprintFrame,resolveFootprint } from './footprint';
import { assemblyWallOffset } from './footprintConstruction';
import { architecturalBlueprintPreflight, architecturalInteriorPreflight } from './architecturalBlueprintPreflight';
import { auditArchitecturalConstructionFidelity } from './architecturalConstructionFidelity';

import { architecturalDraftFinding, revalidateArchitecturalScene } from './architecturalAcceptance';
import { normalizeArchitecturalBlueprintIdentities, type ArchitecturalIdentityChange } from './architecturalBlueprintIdentity';

const n = z.number().finite(), id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{1,63}$/);
const text = z.string().min(1).max(2000), label = z.string().min(1).max(100);
const region = z.object({ x:n, z:n, width:n.positive(), depth:n.positive() }).strict().describe('Host-local rectangle: x/z are its CENTRE in metres, width/depth its full spans.');
const location = z.object({ x:n, z:n, baseElevation:n, rotationY:n }).strict();
const material = z.object({ id, color:z.string().regex(/^#[0-9a-fA-F]{6}$/), roughness:n.min(0).max(1).optional(), metalness:n.min(0).max(1).optional(), opacity:n.min(0).max(1).optional(), surface:z.enum(['concrete','stone','wood','glass','metal','stucco','paving','water','grass']) }).strict();
const plan = z.discriminatedUnion('kind', [
  z.object({ kind:z.literal('rectangle'), width:n.positive(), depth:n.positive() }).strict(),
  z.object({ kind:z.literal('articulated'), width:n.positive(), depth:n.positive(), operations:v3FootprintSchema.shape.operations }).strict(),
  // An outline's symmetric V3 addressing envelope is measured, never AI-authored again.
  z.object({ kind:z.literal('outline'), segments:v3FootprintSchema.shape.segments.unwrap() }).strict(),
]);
const facade = z.object({
  openings:v3CompositionSchema.shape.openings,
  mainEntry:v3CompositionSchema.shape.mainEntry,
  facadeRoles:v3CompositionSchema.shape.facadeRoles,
  massHierarchy:v3CompositionSchema.shape.massHierarchy,
  spaceHeight:v3CompositionSchema.shape.spaceHeight,
  assemblies:v3CompositionSchema.shape.assemblies,
}).strict();
const space = z.object({ id, label, role:label, program:label, footprint:region }).strict();
const storey = z.object({ id, label, role:label, height:n.min(2.2).max(12), spaces:z.array(space).min(1) }).strict();
const vertical = z.object({ id, type:z.enum(['stair','lift']), hostMassId:id, fromLevel:n.int().min(0), toLevel:n.int().min(1), footprint:region, stairType:z.enum(['straight','l-shaped','u-shaped','spiral']).optional(), direction:z.enum(['north','south','east','west']).optional(), turn:z.enum(['left','right']).optional(), label:label.optional(), semanticRole:label.optional() }).strict();
const endpoint = z.discriminatedUnion('kind', [
  z.object({ kind:z.literal('entrance'), entranceId:id, approachDistance:n.min(.02).max(100).optional() }).strict(),
  z.object({ kind:z.literal('site-access'), accessId:id }).strict(),
  // Authored point on a named surface, in that surface's local frame. No world copy.
  z.object({ kind:z.literal('surface'), objectId:id, local:z.tuple([n,n]) }).strict(),
]);
const estate = v3EstatePlanSchema.shape;

export const v3ArchitecturalBlueprintSchema = z.object({
  format:z.literal('v3-architectural-blueprint-1'),
  concept:text, character:text,
  site:z.object({ width:n.positive(), depth:n.positive(), baseElevation:z.literal(0), groundColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),
    // V3's coordinate frame is fixed: north=-z, east=+x, yaw in radians.
    north:z.literal('-z'), access:estate.siteAccess.unwrap(),
  }).strict(),
  materials:z.array(material).min(1),
  buildings:z.array(z.object({ id, label, role:label, materialId:id, location, plan,
    storeys:z.array(storey).min(1).max(20), facade,
    // Family remains a string so unsupported requested architecture gets an explicit diagnostic.
    roof:z.object({ id, form:label, materialId:id, pitchDegrees:n.min(0).max(89), overhang:n.nonnegative(), thickness:n.min(.18).max(.35) }).strict(),
  }).strict()).min(1),
  entrances:z.array(z.object({ id, objectId:id, openingId:id, level:n.int().min(0).max(19) }).strict()),
  features:z.array(z.object({ id, label, role:label, type:label, materialId:id, location, width:n.positive(), depth:n.positive(), height:n.positive(), footprint:v3FootprintSchema.optional(),
    canopyStyle:z.enum(['solid','slatted']).optional(), railing:z.enum(['auto','none']).optional(), terraceOpenEdges:z.array(z.enum(['north','south','east','west'])).optional(),
  }).strict()),
  connections:z.array(z.object({ id, surfaceId:id.describe('Declares the exclusive generated path/driveway object for THIS connection. Choose a new unique ID, never a feature ID or another connection surfaceId. Surface endpoints reference existing features separately.'), purpose:text, from:endpoint, to:endpoint, use:z.enum(['pedestrian','vehicle','service']), width:n.positive().max(100), waypoints:z.array(z.tuple([n,n,n])).max(100), path:v3FootprintSchema.shape.segments.optional().describe('Optional exact line/arc centreline in WORLD x/z metres, from the named source contact to destination. Omit waypoints and entrance approachDistance when using path.'), materialId:id }).strict()),
  verticalCirculation:z.array(vertical),
  requirements:estate.requirements, program:estate.program, zones:estate.zones,
  forms:estate.architecture.unwrap(), relationships:estate.relationships, considerations:estate.considerations,
  roomAdjacencies:z.array(z.object({ from:id, to:id }).strict()),
  partitions:z.array(z.object({ id, storeyId:id, roomAId:id, roomBId:id.nullable(), boundaryId:z.string().min(1), partitionType:z.enum(['wall','glazed','screen','open','exterior-wall']), semanticRole:label, thickness:n.positive().max(1).optional() }).strict()),
  doors:z.array(z.object({ id, partitionId:id, offset:n, width:n.positive(), program:z.enum(['door','double-door','sliding-door','pocket-door','opening','archway']), semanticRole:label }).strict()),
}).strict();
export type V3ArchitecturalBlueprint = z.infer<typeof v3ArchitecturalBlueprintSchema>;
type BlueprintEndpoint = z.infer<typeof endpoint>;
const ROOFS = new Set(['flat','floating-flat','mono-pitch','hip','gable','butterfly','terrace']);
const FEATURES = new Set(['terrace','courtyard','pool','fountain','landscape-zone','canopy','path','driveway']);
const stable = (value:unknown):string => JSON.stringify(value, (_key,v) => v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
const same = (a:unknown,b:unknown) => stable(a)===stable(b);

/** Ignore only compatibility projections. Every semantic architectural field stays protected. */
function canonicalSemantics(scene:V3Scene):V3Scene {
  const s=structuredClone(scene);
  for(const o of s.objects){
    const route=s.estatePlan?.circulation.some(r=>r.spatial&&r.via.includes(o.id));
    if(o.architecture||route){delete (o as Partial<V3SceneObject>).transform;delete (o as Partial<V3SceneObject>).dimensions;}
    if(route)delete o.architecture;
  }
  return s;
}

/** Reuse the actual compiler's effective policies, and refuse their design overrides. */
export function constructionPolicyConflicts(scene:V3Scene):V3BlueprintFinding[]{
  const effective=resolveV3JunctionDatums(resolveV3Fidelity(effectiveV3Scene(scene)).scene).scene;
  const eaves=roofClearanceOverhangs(effective),out:V3BlueprintFinding[]=[];
  const fail=(target:string,message:string)=>out.push({code:'ARCHITECTURAL_COMPILER_OVERRIDE',targetIds:[target],message,severity:'fatal'});
  for(const original of scene.objects){
    const built=effective.objects.find(o=>o.id===original.id);
    if(!built||!same([original.architecture,original.composition,original.levels,original.roofForm,original.pitch,original.overhang],[built.architecture,built.composition,built.levels,built.roofForm,built.pitch,built.overhang]))
      fail(original.id,'Existing effective construction would alter approved placement, footprint, storeys, facade or roof intent. Explicit replanning is required.');
    if(original.type==='roof-form'&&built){
      if(Math.abs((eaves.get(original.id)??original.overhang!)-original.overhang!)>1e-8)fail(original.id,'Existing roof clearance would trim the approved overhang. Resolve roof spacing/eaves in the blueprint.');
      if(!same(roofFinish(effective,built),original.material))fail(original.id,'Existing roof finish policy would replace this material. This slice cannot faithfully construct that finish choice.');
    }
    if(original.type==='building-mass'){
      if(!['stone','stucco','concrete','wood','metal'].includes(original.material.surface??''))fail(original.id,'V3 wall construction cannot faithfully use this primary wall finish. Choose glazing through explicit facade openings.');
      const frame=footprintFrame(original);
      if(original.composition?.footprint?.kind!=='outline'){
        const resolved=resolvedFacadeComposition(original,frame.width,frame.depth,original.dimensions[1]/(original.levels??1));
        if(resolved.openings?.some(op=>!original.composition?.openings?.some(authored=>authored.id===op.id)))
          fail(original.id,'Facade roles would invent unchosen opening geometry. Author those openings explicitly or remove the role that requests automatic geometry.');
      }
      for(const opening of original.composition?.openings??[])if(opening.type==='opening-rhythm'){
        const segment=original.composition?.footprint?.segments?.find(s=>s.id===opening.segmentId);
        const span=segment?segmentLength(segment):['north','south'].includes(opening.facade)?frame.width:frame.depth;
        if(Math.abs(fittedRhythmWidth(span,opening.count,opening.width)-opening.width)>1e-8)out.push({code:'ARCHITECTURAL_OPENING_CLIPPED',targetIds:[original.id,opening.id],severity:'fatal',message:`Opening ${opening.id} exceeds the supported facade bay width; its wall is retained without narrowing the intent.`});
      }
    }
    if(original.type==='courtyard'&&(original.dimensions[1]<.14||original.material.color.toLowerCase()!=='#b8ad98'||original.material.surface!=='paving'||original.material.roughness!==.74||original.material.metalness||original.material.opacity!==undefined&&original.material.opacity!==1))
      fail(original.id,'V3 courtyard semantics build a perimeter with fixed #b8ad98 paving/roughness .74 and height >=.14m. A custom finish or thinner ring is unsupported by this slice.');
    if(original.type==='landscape-zone'&&(original.dimensions[1]<.12||original.material.surface!=='grass'||original.material.roughness!==.9||original.material.metalness||original.material.opacity!==undefined&&original.material.opacity!==1))
      fail(original.id,'V3 landscape-zone semantics build grass groundcover, height >=.12m and roughness .9; trees and custom planting construction are separate capabilities.');
  }
  return out;
}

/** Exact line/arc extrema; preserve the authored local origin, segments and all opening fractions. */
export function architecturalPlanEnvelope(p:V3ArchitecturalBlueprint['buildings'][number]['plan']):{width:number;depth:number;footprint?:V3Footprint} {
  if(p.kind==='rectangle')return {width:p.width,depth:p.depth};
  if(p.kind==='articulated')return {width:p.width,depth:p.depth,footprint:{kind:'articulated',operations:p.operations}};
  const points = p.segments.flatMap(s=>{
    const result=[segmentPoint(s,0),segmentPoint(s,1)];
    if(s.type==='arc')for(const angle of [0,90,180,270])for(let turn=-2;turn<=2;turn++){
      const u=(angle+360*turn-s.startAngle!)/s.sweep!;
      if(u>0&&u<1)result.push(segmentPoint(s,u));
    }
    return result;
  });
  return {width:2*Math.max(...points.map(p=>Math.abs(p[0]))),depth:2*Math.max(...points.map(p=>Math.abs(p[1]))),footprint:{kind:'outline',operations:[],segments:p.segments}};
}

/** Pure semantic lowering. No provider, design inference, scene repair or geometry builder. */
export function lowerV3ArchitecturalBlueprint(bp:V3ArchitecturalBlueprint):V3Scene {
  const materials=new Map(bp.materials.map(m=>[m.id,m]));
  const object=(entry:{id:string;label:string;role:string;materialId:string},type:string,architecture:NonNullable<V3SceneObject['architecture']>):V3SceneObject=>({
    id:entry.id,label:entry.label,semanticRole:entry.role,type,geometryKind:inferV3GeometryKind({type,dimensions:[architecture.width,architecture.height,architecture.depth]}),architecture,...runtimeGeometryFromArchitecture(architecture),material:structuredClone(materials.get(entry.materialId)!),
  });
  const objects:V3SceneObject[]=[], interior:NonNullable<V3Scene['interior']>={storeys:[],rooms:[],circulation:structuredClone(bp.verticalCirculation),partitions:structuredClone(bp.partitions),doors:structuredClone(bp.doors)};
  for(const b of bp.buildings){
    const {width,depth,footprint}=architecturalPlanEnvelope(b.plan),height=b.storeys.reduce((sum,s)=>sum+s.height,0);
    objects.push({...object(b,'building-mass',{...b.location,width,depth,height}),levels:b.storeys.length,collision:'solid',composition:{...structuredClone(b.facade),...(footprint?{footprint:structuredClone(footprint)}:{})}});
    objects.push({...object({id:b.roof.id,label:`${b.label} roof`,role:`Roof of ${b.id}`,materialId:b.roof.materialId},'roof-form',{...b.location,baseElevation:b.location.baseElevation+height,width,depth,height:b.roof.thickness}),hostId:b.id,roofForm:b.roof.form as V3SceneObject['roofForm'],pitch:b.roof.pitchDegrees,pitchUnit:'degrees',overhang:b.roof.overhang});
    let elevation=0;
    b.storeys.forEach((s,index)=>{
      interior.storeys.push({id:s.id,label:s.label,semanticRole:s.role,hostMassId:b.id,index,elevation:elevation+V3_FLOOR_SLAB,height:s.height});
      for(const r of s.spaces)interior.rooms.push({id:r.id,label:r.label,semanticRole:r.role,program:r.program,storeyId:s.id,hostMassId:b.id,footprint:structuredClone(r.footprint)});
      elevation+=s.height;
    });
  }
  for(const f of bp.features)objects.push({...object(f,f.type,{...f.location,width:f.width,depth:f.depth,height:f.height}),
    ...(f.footprint?{composition:{footprint:structuredClone(f.footprint)}}:{}),
    ...(f.canopyStyle===undefined?{}:{canopyStyle:f.canopyStyle}),...(f.railing===undefined?{}:{railing:f.railing}),...(f.terraceOpenEdges===undefined?{}:{terraceOpenEdges:structuredClone(f.terraceOpenEdges)}),
    collision:isWaterFeature(f)?'water':f.type==='landscape-zone'?'none':f.type==='canopy'?'solid':'walkable'});
  const resolveEndpoint=(e:BlueprintEndpoint)=>{
    if(e.kind==='entrance'){
      const entry=bp.entrances.find(i=>i.id===e.entranceId)!;
      return {objectId:entry.objectId,access:{entranceId:e.entranceId,...(e.approachDistance===undefined?{}:{approachDistance:e.approachDistance})}};
    }
    if(e.kind==='site-access')return {objectId:e.accessId,access:{}};
    const f=bp.features.find(f=>f.id===e.objectId)!,a=f.location.rotationY,[x,z]=e.local;
    return {objectId:f.id,access:{point:[f.location.x+x*Math.cos(a)+z*Math.sin(a),f.location.baseElevation,f.location.z-x*Math.sin(a)+z*Math.cos(a)] as [number,number,number]}};
  };
  const circulation=bp.connections.map(c=>{
    const from=resolveEndpoint(c.from),to=resolveEndpoint(c.to);
    // Placeholder is immediately replaced by existing canonical ribbon bounds.
    // It is never an AI-authored path box or a geometric constraint.
    objects.push(object({id:c.surfaceId,label:c.purpose.slice(0,100),role:c.purpose.slice(0,100),materialId:c.materialId},c.use==='vehicle'?'driveway':'path',{x:0,z:0,baseElevation:bp.site.baseElevation,width:1,depth:1,height:.01}));
    return {id:c.id,purpose:c.purpose,from:from.objectId,to:to.objectId,via:[c.surfaceId],spatial:{from:from.access,to:to.access,use:c.use,width:c.width,waypoints:structuredClone(c.waypoints),...(c.path?{path:structuredClone(c.path)}:{})}};
  });
  return {version:3,site:{width:bp.site.width,depth:bp.site.depth,baseElevation:0,naturalGround:{elevation:0,grade:0},groundMaterial:{id:'ground',color:bp.site.groundColor,surface:'grass'}},objects,interior,
    estatePlan:{version:1,concept:bp.concept,character:bp.character,siteAccess:structuredClone(bp.site.access),requirements:structuredClone(bp.requirements),program:structuredClone(bp.program),zones:structuredClone(bp.zones),architecture:structuredClone(bp.forms),relationships:structuredClone(bp.relationships),considerations:structuredClone(bp.considerations),circulation,
      blueprint:{version:1,buildings:bp.buildings.map(b=>({id:`bp-${b.id}`,objectId:b.id,role:b.role})),entrances:structuredClone(bp.entrances),roofObjectIds:bp.buildings.map(b=>b.roof.id),outdoorObjectIds:bp.features.map(f=>f.id),routeIds:bp.connections.map(c=>c.id),verticalCirculationIds:bp.verticalCirculation.map(c=>c.id),allocations:bp.requirements.filter(r=>r.metric==='feature'||r.metric==='bedrooms').map(r=>({id:`bp-${r.id}`,requirementId:r.id,objectIds:[...r.objectIds],roomIds:[]}))}},
    relationships:[...bp.relationships.map(({from,to,kind})=>({from:bp.connections.find(c=>c.id===from)?.surfaceId??from,to:bp.connections.find(c=>c.id===to)?.surfaceId??to,kind})),...bp.roomAdjacencies.map(r=>({...r,kind:'adjacent' as const}))],metadata:{}};
}

export interface V3ArchitecturalPlanningResult { ok:boolean; findings:V3BlueprintFinding[]; approval?:V3ArchitecturalApproval; blueprint?:V3ArchitecturalBlueprint; identityChanges?:ArchitecturalIdentityChange[]; }
/** Opaque, in-memory evidence. No serialized approval can authorize construction. */
export interface V3ArchitecturalApproval { readonly kind:'v3-architectural-approval'; }
const approvals=new WeakMap<V3ArchitecturalApproval,{scene:V3Scene;existing:V3BlueprintApproval;buildFirst?:boolean;findings:V3BlueprintFinding[]}>();

/** Validate independent design BEFORE accepting detailed construction; never repairs or invents design. */
export function planV3ArchitecturalBlueprint(raw:unknown,options:{buildFirst?:boolean}={}):V3ArchitecturalPlanningResult {
  const findings:V3BlueprintFinding[]=[],fail=(code:string,targetIds:string[],message:string)=>findings.push({code,targetIds,message,severity:'fatal'});
  const parsed=v3ArchitecturalBlueprintSchema.safeParse(raw);
  if(!parsed.success)return {ok:false,findings:parsed.error.issues.map(i=>({code:'ARCHITECTURAL_BLUEPRINT_INPUT',severity:'fatal',targetIds:[i.path.join('.')],message:i.message}))};
  const identities=normalizeArchitecturalBlueprintIdentities(parsed.data);
  const bp=identities.blueprint;
  findings.push(...identities.findings);
  // Identity ambiguity must stop before any map/find-based relationship lookup.
  if(findings.some(f=>f.severity==='fatal'))return {ok:false,findings,blueprint:bp,identityChanges:[]};
  findings.push(...architecturalBlueprintPreflight(bp));
  const evidence={blueprint:bp,identityChanges:identities.changes};
  const mats=new Set(bp.materials.map(m=>m.id));
  for(const [owner,ref] of [...bp.buildings.flatMap(b=>[[b.id,b.materialId],[b.roof.id,b.roof.materialId]]),...bp.features.map(f=>[f.id,f.materialId]),...bp.connections.map(c=>[c.id,c.materialId])])if(!mats.has(ref))fail('ARCHITECTURAL_MATERIAL',[owner,ref],'Missing major material.');
  for(const b of bp.buildings){
    const composition=v3CompositionSchema.safeParse(b.facade);
    if(b.facade.openings===undefined)fail('ARCHITECTURAL_FACADE_UNDECIDED',[b.id],'Declare all intended openings explicitly, or [] for intentionally solid facades.');
    if(!composition.success)for(const issue of composition.error.issues)fail('ARCHITECTURAL_ASSEMBLY_INPUT',[b.id],`${issue.path.join('.')}: ${issue.message}`);
    for(const assembly of b.facade.assemblies??[]){
      if(!assembly.parts.length)fail('ARCHITECTURAL_ASSEMBLY_INPUT',[b.id,assembly.id],'An assembly needs explicit construction parts; its name does not construct geometry.');
      for(const part of assembly.parts)if(part.type==='railing'&&!part.edges.length)fail('ARCHITECTURAL_ASSEMBLY_INPUT',[b.id,assembly.id,part.id],'Choose the railing edges explicitly; an empty guard constructs nothing.');
      for(const part of assembly.parts)if(part.type!=='railing'){
        if((part.level??0)>=b.storeys.length)fail('ARCHITECTURAL_ASSEMBLY_LEVEL',[b.id,assembly.id,part.id],'Assembly must address an existing local storey.');
        if(b.plan.kind==='outline'&&!b.plan.segments.some(s=>s.id===part.segmentId))fail('ARCHITECTURAL_ASSEMBLY_HOST',[b.id,assembly.id,part.id],'Line/arc assemblies require an explicit existing segmentId.');
        if(b.plan.kind!=='outline'&&part.segmentId)fail('ARCHITECTURAL_ASSEMBLY_HOST',[b.id,assembly.id,part.id],'segmentId is only supported on an explicit line/arc outline.');
      }
    }
    if(!ROOFS.has(b.roof.form))fail('ARCHITECTURAL_ROOF_UNSUPPORTED',[b.id,b.roof.id],`V3 cannot construct requested roof ${b.roof.form}.`);
    else if(['flat','floating-flat','terrace'].includes(b.roof.form)?b.roof.pitchDegrees!==0:b.roof.pitchDegrees<1||b.roof.pitchDegrees>60)fail('ARCHITECTURAL_ROOF_PITCH',[b.roof.id],'Pitch must match V3 construction: 0 for flat families, 1–60 degrees for pitched families.');
    if(!bp.entrances.some(e=>e.objectId===b.id&&e.level===0))fail('ARCHITECTURAL_ENTRANCE_UNDECIDED',[b.id],'Choose an actual ground entrance before constructing this building.');
    if(!bp.program.some(p=>p.objectIds.includes(b.id)))fail('ARCHITECTURAL_PROGRAM_UNDECIDED',[b.id],'The building needs a declared function in the property program.');
    if(b.plan.kind!=='rectangle'){
      const fp=b.plan.kind==='outline'?{kind:'outline',segments:b.plan.segments,operations:[]}:{kind:'articulated',operations:b.plan.operations};
      if(!v3FootprintSchema.safeParse(fp).success)fail('ARCHITECTURAL_FOOTPRINT',[b.id],'Malformed line/arc outline or articulated operations.');
      if(b.plan.kind==='outline'&&b.plan.segments.some(s=>s.type==='arc'&&Math.abs(s.startAngle!)>720))fail('ARCHITECTURAL_FOOTPRINT',[b.id],'Arc startAngle must be within -720..720 degrees.');
    }
  }
  for(const c of bp.verticalCirculation)if(c.type==='stair'&&(!c.stairType||!c.direction||(['l-shaped','u-shaped'].includes(c.stairType)&&!c.turn)))fail('ARCHITECTURAL_CIRCULATION_UNDECIDED',[c.id],'Choose stair type, direction, and turn for a turning stair explicitly; construction cannot choose the layout.');
  for(const f of bp.features){

    if(!FEATURES.has(f.type))fail('ARCHITECTURAL_FEATURE_UNSUPPORTED',[f.id],`This slice cannot construct ${f.type}; no generic substitute will be built.`);
    if(f.type==='canopy'&&!f.canopyStyle)fail('ARCHITECTURAL_FEATURE_UNDECIDED',[f.id],'Choose solid or slatted canopy construction explicitly.');
    if(f.type!=='canopy'&&f.canopyStyle||f.type!=='terrace'&&(f.railing!==undefined||f.terraceOpenEdges!==undefined))fail('ARCHITECTURAL_FEATURE_INPUT',[f.id],'Canopy style belongs only to canopies; railing and open edges belong only to terraces.');
    if(f.type==='canopy'&&(f.width<1||f.depth<1||f.height<2.2))fail('ARCHITECTURAL_FEATURE_INPUT',[f.id],'Supported canopies require >=1m plan spans and >=2.2m height for the existing posts/headers.');
  }
  for(const c of bp.connections)for(const e of [c.from,c.to]){
    if(e.kind==='entrance'&&bp.entrances.filter(i=>i.id===e.entranceId).length!==1)fail('ARCHITECTURAL_REFERENCE',[c.id,e.entranceId],'Choose one existing entrance.');
    if(e.kind==='site-access'&&bp.site.access.filter(a=>a.id===e.accessId).length!==1)fail('ARCHITECTURAL_REFERENCE',[c.id,e.accessId],'Choose one explicit site access.');
    if(e.kind==='surface'){
      const f=bp.features.find(f=>f.id===e.objectId);
      if(!f||!plannedDrySurface(f.type))fail('ARCHITECTURAL_REFERENCE',[c.id,e.objectId],'Endpoint needs an existing dry surface.');
      else if(Math.abs(e.local[0])>f.width/2+.001||Math.abs(e.local[1])>f.depth/2+.001)fail('ARCHITECTURAL_SURFACE_CONTACT',[c.id,f.id],'Authored surface contact lies outside its footprint.');
    }
  }
  if(findings.some(f=>f.severity==='fatal'&&(!options.buildFirst||f.code!=='ARCHITECTURAL_DOOR_OVERLAP'&&!LOCAL_FACADE_CODES.has(f.code))))return {ok:false,findings,...evidence};
  const semantic=lowerV3ArchitecturalBlueprint(bp);
  for(const o of semantic.objects.filter(o=>bp.features.some(f=>f.id===o.id)))for(const message of siteFeatureConstructionIssues(o))fail('ARCHITECTURAL_FEATURE_CONSTRUCTION_DEFERRED',[o.id],message);
  for(const o of semantic.objects)if(o.type==='building-mass'&&o.composition?.footprint?.kind==='articulated')for(const assembly of o.composition.assemblies??[])for(const part of assembly.parts)if(part.type!=='railing'){
    const fp=resolveFootprint(o,part.level??0);
    if(!fp||!assemblyWallOffset(fp,part))fail('ARCHITECTURAL_ASSEMBLY_HOST',[o.id,assembly.id,part.id],'Assembly needs one actual wall plane or a slab bridging two outer recess shoulders. No attachment will be chosen automatically.');
  }
  if(findings.some(f=>f.severity==='fatal'&&(!options.buildFirst||f.code!=='ARCHITECTURAL_DOOR_OVERLAP'&&!LOCAL_FACADE_CODES.has(f.code))))return {ok:false,findings,...evidence};
  // Existing measurement/contact/roof/space checks operate on lowered semantics.
  // No compileV3Scene, constructed passage or detailed mesh is allowed at this gate.
  const blocking=()=>findings.some(f=>f.severity==='fatal'&&(!options.buildFirst||!architecturalDraftFinding(semantic,f,findings)));
  const preliminary=auditV3Blueprint(semantic,{constructionEvidence:false});
  findings.push(...preliminary.findings);
  findings.push(...auditV3Interior(semantic).filter(i=>i.severity!=='advisory').map(i=>({code:i.code,targetIds:[i.targetId],message:i.message,severity:'fatal' as const})));
  findings.push(...architecturalInteriorPreflight(semantic));
  if(blocking())return {ok:false,findings,...evidence};
  findings.push(...constructionPolicyConflicts(semantic));
  if(blocking())return {ok:false,findings,...evidence};
  const scene=normalizeV3GenerationOutput(semantic,'flat').scene;
  if(!same(canonicalSemantics(semantic),canonicalSemantics(scene)))return {ok:false,...evidence,findings:[...findings,{code:'ARCHITECTURAL_NORMALIZATION_DRIFT',targetIds:['scene'],message:'Compatibility normalization changed authored semantics; this design needs explicit support.',severity:'fatal'}]};
  const checked=approveV3Blueprint(scene,{constructionEvidence:false,...(options.buildFirst?{allowFinding:(f:V3BlueprintFinding)=>architecturalDraftFinding(scene,f,findings)}:{})});
  if(!checked.ok||!checked.approval)return {ok:false,...evidence,findings:[...findings,...checked.findings]};
  const approval:V3ArchitecturalApproval=Object.freeze({kind:'v3-architectural-approval'});
  approvals.set(approval,{scene:structuredClone(scene),existing:checked.approval,buildFirst:options.buildFirst,findings:structuredClone(findings)});
  return {ok:true,findings,approval,...evidence};
}

export interface V3ArchitecturalConstruction { ok:boolean; findings:V3BlueprintFinding[]; outcome?:'complete'|'draft'|'cannot-construct'; scene?:V3Scene; model?:ReturnType<typeof compileV3Scene>; }
/** Only this function publishes editable V3 construction. No AI elaboration parameter exists. */
export function constructV3ArchitecturalBlueprint(approval:V3ArchitecturalApproval):V3ArchitecturalConstruction {
  const entry=approvals.get(approval);
  if(!entry)return {ok:false,findings:[{code:'ARCHITECTURAL_APPROVAL_REQUIRED',severity:'fatal',targetIds:['blueprint'],message:'Run preliminary planning in this process before construction.'}]};
  if(entry.buildFirst)return revalidateArchitecturalScene(entry.scene,entry.findings);
  const result=ingestV3GenerationOutput(structuredClone(entry.scene),'flat',{requireBlueprint:true,requireDesignConsistency:true,approvedBlueprint:entry.existing});
  const findings=[...constructionPolicyConflicts(entry.scene),...(result.blueprint?.findings??[]),...result.validation.issues.map(i=>({code:i.code,severity:i.severity==='advisory'?'advisory' as const:'fatal' as const,targetIds:i.targetIds??[i.targetId],message:i.message})),
    ...(result.geometryAudit?.errors??[]).map(message=>({code:'ARCHITECTURAL_COMPILED_GEOMETRY',severity:'fatal' as const,targetIds:['construction'],message}))];
  // Ingestion is a compatibility normalizer, not permission to drop an approved design.
  if(!same(entry.scene,result.scene))findings.push({code:'ARCHITECTURAL_CONSTRUCTION_DRIFT',severity:'fatal',targetIds:['scene'],message:'Ingestion altered approved semantic data; construction is refused.'});
  if(!result.ok||findings.some(f=>f.severity==='fatal'))return {ok:false,findings};
  const model=compileV3Scene(result.scene);
  findings.push(...auditArchitecturalConstructionFidelity(result.scene,model));
  for(const o of result.scene.objects)if(!model.primitives.some(p=>p.sourceObjectId===o.id||p.sourceObjectIds?.includes(o.id)))
    findings.push({code:'ARCHITECTURAL_COMPONENT_UNBUILT',severity:'fatal',targetIds:[o.id],message:'Approved architectural component emitted no construction; no saveable scene is returned.'});
  for(const e of result.scene.estatePlan!.blueprint!.entrances)if(!model.primitives.some(p=>p.id.startsWith(`${e.objectId}:${e.openingId}:level-${e.level}:`)))
    findings.push({code:'ARCHITECTURAL_ENTRANCE_UNBUILT',severity:'fatal',targetIds:[e.id,e.objectId,e.openingId],message:'The designated entrance emitted no constructed opening.'});
  for(const o of result.scene.objects)for(const assembly of o.composition?.assemblies??[])for(const part of assembly.parts){
    const prefix=`${o.id}${o.composition?.footprint?'-':'-composition-'}assembly-${assembly.id}-${part.id}`;
    const expected=part.type==='railing'?[...new Set(part.edges)].map(edge=>`${prefix}-${edge}`):[prefix];
    if(expected.some(id=>!model.primitives.some(p=>p.sourceObjectId===o.id&&p.id===id)))findings.push({code:'ARCHITECTURAL_ASSEMBLY_UNBUILT',severity:'fatal',targetIds:[o.id,assembly.id,part.id],message:'An explicit assembly part or guard edge emitted no construction; a name alone is insufficient.'});
  }
  return findings.some(f=>f.severity==='fatal')?{ok:false,findings}:{ok:true,findings,scene:result.scene,model};
}

/**
 * Reopen the supported semantic design FROM the current V3 scene after reload.
 * Missing major spaces, independent roofs or unsupported assemblies are diagnosed;
 * this is deliberately not a migration or an architecture-invention fallback.
 */
export function checkoutV3ArchitecturalBlueprint(scene:V3Scene, options:{planOnly?:boolean}={}):V3ArchitecturalPlanningResult & {blueprint?:V3ArchitecturalBlueprint} {
  const findings:V3BlueprintFinding[]=[],fail=(target:string,message:string)=>findings.push({code:'ARCHITECTURAL_CHECKOUT_UNSUPPORTED',severity:'fatal',targetIds:[target],message});
  const estate=scene.estatePlan,index=estate?.blueprint;
  if(!estate||!index||!scene.interior)return {ok:false,findings:[{code:'ARCHITECTURAL_CHECKOUT_INCOMPLETE',severity:'fatal',targetIds:['scene'],message:'No complete indexed storey/space design is available; author the missing architecture explicitly.'}]};
  const routeOwners=new Set(estate.circulation.flatMap(r=>r.via));
  const features=scene.objects.filter(o=>(FEATURES.has(o.type)||options.planOnly&&index.outdoorObjectIds.includes(o.id))&&!routeOwners.has(o.id));
  const materials=new Map<string,z.infer<typeof material>>();
  for(const o of scene.objects){
    const parsed=material.safeParse(o.material);
    if(!parsed.success)fail(o.id,'Material needs an explicit supported finish.');
    else if(materials.has(o.material.id)&&!same(materials.get(o.material.id),parsed.data))fail(o.id,'One material id names conflicting finishes.');
    else materials.set(o.material.id,parsed.data!);
    if(!['building-mass','roof-form'].includes(o.type)&&!FEATURES.has(o.type)&&!routeOwners.has(o.id)&&!(options.planOnly&&index.outdoorObjectIds.includes(o.id)))fail(o.id,'Object has no independent-blueprint construction mapping in this slice.');
    if(o.composition?.roofDatumGroup)fail(o.id,'Shared roof datums need a future blueprint mapping; they will not be dropped.');
    if(o.composition?.assemblies?.some(a=>!a.parts.length))fail(o.id,'An empty assembly has no construction mapping.');
    if(o.support||o.type==='building-mass'&&o.hostId)fail(o.id,'Explicit supported/stacked objects need a future host contract.');
    if(o.type==='building-mass'&&(!o.architecture||!o.levels))fail(o.id,'Building needs explicit canonical architecture and storey count.');
  }
  const buildings:V3ArchitecturalBlueprint['buildings']=[];
  for(const [buildingIndex,b] of scene.objects.filter(o=>o.type==='building-mass').entries()){
    const reserved=index.roofObjectIds[buildingIndex];
    // Plan checkout uses only the reserved identity. This temporary declaration is
    // stripped by the plan adapter; it is never approved, compiled or persisted.
    const roofs=options.planOnly&&reserved?[{id:reserved,architecture:{height:.25},roofForm:'flat' as const,material:b.material,pitch:0,overhang:0}]:scene.objects.filter(r=>r.type==='roof-form'&&r.hostId===b.id);
    const a=b.architecture,roof=roofs[0];
    if(!a||roofs.length!==1||!roof.architecture||!roof.roofForm){fail(b.id,'Exactly one supported explicit hosted roof is required.');continue;}
    const datums=scene.interior.storeys.filter(s=>s.hostMassId===b.id).sort((a,b)=>a.index-b.index);
    if(datums.length!==b.levels||datums.some((s,i)=>s.index!==i||!options.planOnly&&!scene.interior!.rooms.some(r=>r.storeyId===s.id))){fail(b.id,'All storeys need stable datums and authored major spaces.');continue;}
    const fp=b.composition?.footprint;
    const p:V3ArchitecturalBlueprint['buildings'][number]['plan']=fp?.kind==='outline'?{kind:'outline',segments:structuredClone(fp.segments!)}:fp?{kind:'articulated',width:a.width,depth:a.depth,operations:structuredClone(fp.operations)}:{kind:'rectangle',width:a.width,depth:a.depth};
    const {footprint:unusedFootprint,roofDatumGroup:unusedGroup,...facade}=b.composition??{};
    void unusedFootprint;void unusedGroup;
    buildings.push({id:b.id,label:b.label,role:b.semanticRole,materialId:b.material.id,location:{x:a.x,z:a.z,baseElevation:a.baseElevation,rotationY:a.rotationY??0},plan:p,
      storeys:datums.map(s=>({id:s.id,label:s.label,role:s.semanticRole,height:s.height,spaces:scene.interior!.rooms.filter(r=>r.storeyId===s.id).map(r=>({id:r.id,label:r.label,role:r.semanticRole,program:r.program,footprint:structuredClone(r.footprint)}))})),facade,
      roof:{id:roof.id,form:roof.roofForm,materialId:roof.material.id,pitchDegrees:roof.pitch??0,overhang:roof.overhang??.75,thickness:roof.architecture.height}});
  }
  const connections:V3ArchitecturalBlueprint['connections']=[];
  const extractEndpoint=(r:NonNullable<V3Scene['estatePlan']>['circulation'][number],side:'from'|'to'):BlueprintEndpoint|undefined=>{
    const e=r.spatial![side];
    if(e.entranceId)return {kind:'entrance',entranceId:e.entranceId,...(e.approachDistance===undefined?{}:{approachDistance:e.approachDistance})};
    if(estate.siteAccess?.some(a=>a.id===r[side])&&!e.point&&!e.openingId)return {kind:'site-access',accessId:r[side]};
    const f=features.find(o=>o.id===r[side]),a=f?.architecture;
    if(!a||!e.point||e.openingId||Math.abs(e.point[1]-a.baseElevation)>1e-8)return;
    const dx=e.point[0]-a.x,dz=e.point[2]-a.z,yaw=a.rotationY??0;
    const clean=(value:number)=>Math.round(value*1e10)/1e10;
    return {kind:'surface',objectId:f!.id,local:[clean(dx*Math.cos(yaw)-dz*Math.sin(yaw)),clean(dx*Math.sin(yaw)+dz*Math.cos(yaw))]};
  };
  for(const r of estate.circulation){
    const owner=scene.objects.find(o=>o.id===r.via[0]);
    if(!r.spatial||r.via.length!==1||!owner){fail(r.id,'Connections need a single canonical spatial owner.');continue;}
    const from=extractEndpoint(r,'from'),to=extractEndpoint(r,'to');
    if(!from||!to){fail(r.id,'Connection needs named entrances/site access or explicit dry-surface contacts.');continue;}
    connections.push({id:r.id,surfaceId:owner.id,purpose:r.purpose,from,to,use:r.spatial.use,width:r.spatial.width,waypoints:structuredClone(r.spatial.waypoints??[]),...(r.spatial.path?{path:structuredClone(r.spatial.path)}:{}),materialId:owner.material.id});
  }
  if(features.some(f=>!f.architecture))fail('features','Site features need named canonical geometry.');
  if(findings.length)return {ok:false,findings};
  const bp:V3ArchitecturalBlueprint={format:'v3-architectural-blueprint-1',concept:estate.concept,character:estate.character,
    site:{width:scene.site.width,depth:scene.site.depth,baseElevation:0,north:'-z',groundColor:scene.site.groundMaterial?.color??'#4a6b42',access:structuredClone(estate.siteAccess??[])},materials:[...materials.values()],buildings,entrances:structuredClone(index.entrances),
    features:features.map(f=>({id:f.id,label:f.label,role:f.semanticRole,type:f.type,materialId:f.material.id,location:{x:f.architecture!.x,z:f.architecture!.z,baseElevation:f.architecture!.baseElevation,rotationY:f.architecture!.rotationY??0},width:f.architecture!.width,depth:f.architecture!.depth,height:f.architecture!.height,
      ...(f.composition?.footprint?{footprint:structuredClone(f.composition.footprint)}:{}),
      ...(f.canopyStyle===undefined?{}:{canopyStyle:f.canopyStyle}),...(f.railing===undefined?{}:{railing:f.railing}),...(f.terraceOpenEdges===undefined?{}:{terraceOpenEdges:structuredClone(f.terraceOpenEdges)}),
    })),connections,verticalCirculation:structuredClone(scene.interior.circulation??[]),
    requirements:structuredClone(estate.requirements),program:structuredClone(estate.program),zones:structuredClone(estate.zones),forms:structuredClone(estate.architecture??[]),relationships:structuredClone(estate.relationships),considerations:structuredClone(estate.considerations),roomAdjacencies:scene.relationships.filter(r=>r.kind==='adjacent').map(({from,to})=>({from,to})),partitions:structuredClone(scene.interior.partitions??[]) as V3ArchitecturalBlueprint['partitions'],doors:structuredClone(scene.interior.doors??[]) as V3ArchitecturalBlueprint['doors']};
  if(options.planOnly)return {ok:true,findings,blueprint:bp};
  const planned=planV3ArchitecturalBlueprint(bp,{buildFirst:!!scene.metadata.architecturalValidation});
  if(!planned.approval)return planned;
  // Refuse an export that would silently erase semantics (including legacy extra
  // envelopes, facade presets, roof positions, unsupported intent or site terrain).
  const projected=approvals.get(planned.approval)!.scene;
  const stripMetadata=(s:V3Scene)=>({...canonicalSemantics(s),metadata:{}});
  if(!same(stripMetadata(scene),stripMetadata(projected)))return {ok:false,findings:[{code:'ARCHITECTURAL_CHECKOUT_LOSS',targetIds:['scene'],message:'This scene contains architectural data outside the supported round-trip contract. Keep editing it with existing V3 tools.',severity:'fatal'}]};
  return {...planned,blueprint:bp};
}

/**
 * Explicit replan against the last in-memory approval. Three-way semantic merge:
 * unrelated local edits/additions survive; concurrent changes to a changed field
 * fail atomically. No blueprint/revision tracking is persisted in the V3 project.
 */
export function reviseV3ArchitecturalBlueprint(current:V3Scene,base:V3ArchitecturalApproval,raw:unknown):V3ArchitecturalConstruction {
  const prior=approvals.get(base),buildFirst=prior?.buildFirst||!!current.metadata.architecturalValidation,planned=planV3ArchitecturalBlueprint(raw,{buildFirst});
  if(!prior||!planned.approval)return {ok:false,findings:prior?planned.findings:[{code:'ARCHITECTURAL_APPROVAL_REQUIRED',severity:'fatal',targetIds:['blueprint'],message:'The in-memory base approval is required for this replan.'}]};
  const next=approvals.get(planned.approval)!.scene,merged=structuredClone(current),findings:V3BlueprintFinding[]=[];
  const conflict=(path:string)=>findings.push({code:'ARCHITECTURAL_EDIT_CONFLICT',severity:'fatal',targetIds:[path],message:'A local scene edit conflicts with this blueprint revision; reconcile explicitly.'});
  // Merge keyed collections at field granularity. Coordinates/footprints are atomic values.
  const merge=(before:unknown,after:unknown,local:unknown,path:string):unknown=>{
    if(same(before,after))return local;
    if(same(local,before)||same(local,after))return structuredClone(after);
    if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(local)&&[...before,...after,...local].every(v=>v&&typeof v==='object'&&typeof v.id==='string')){
      const ids=[...new Set([...local,...after].map(v=>v.id))];
      return ids.flatMap(key=>{const a=before.find(v=>v.id===key),b=after.find(v=>v.id===key),c=local.find(v=>v.id===key),value=merge(a,b,c,`${path}:${key}`);return value===undefined?[]:[value];});
    }
    if(before&&after&&local&&typeof before==='object'&&typeof after==='object'&&typeof local==='object'&&!Array.isArray(before)&&!Array.isArray(after)&&!Array.isArray(local)){
      const a=before as Record<string,unknown>,b=after as Record<string,unknown>,c=local as Record<string,unknown>;
      return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])].flatMap(key=>{
        const value=merge(a[key],b[key],c[key],`${path}.${key}`);return value===undefined?[]:[[key,value]];
      }));
    }
    conflict(path);return local;
  };
  // Runtime arrays, derived from architecture/ribbons, cannot create merge conflicts.
  Object.assign(merged,merge(canonicalSemantics(prior.scene),canonicalSemantics(next),canonicalSemantics(current),'scene'));
  if(findings.length)return {ok:false,findings};
  const normalized=normalizeV3GenerationOutput(merged,'flat').scene;
  // This is a trusted local replan, not raw provider ingestion. Preserve project provenance/usage.
  normalized.metadata=structuredClone(merged.metadata);
  const checked=approveV3Blueprint(normalized,buildFirst?{constructionEvidence:false,allowFinding:f=>architecturalDraftFinding(normalized,f)}:{});
  if(!checked.approval)return {ok:false,findings:checked.findings};
  const approval:V3ArchitecturalApproval=Object.freeze({kind:'v3-architectural-approval'});
  approvals.set(approval,{scene:normalized,existing:checked.approval,buildFirst,findings:[]});
  const built=constructV3ArchitecturalBlueprint(approval);
  // Ensure construction still satisfies the newly approved geometry, while permitting
  // unchanged fields explicitly edited through the regular V3 editor.
  if(built.scene&&!buildFirst){
    const audit=auditV3BlueprintElaboration(checked.approval,built.scene);
    if(!audit.ok)return {ok:false,findings:audit.findings};
  }
  return built;
}

