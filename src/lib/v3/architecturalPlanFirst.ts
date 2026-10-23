/** Plan-first authoring boundary. Geometry lives once in V3's existing semantic fields.
 * The input document is consumed, not retained as a competing editable scene. */
import { z } from 'zod';
import { v3ArchitecturalBlueprintSchema as blueprintSchema, lowerV3ArchitecturalBlueprint, type V3ArchitecturalBlueprint } from './architecturalBlueprint';
import { normalizeArchitecturalBlueprintIdentities, type ArchitecturalIdentityChange } from './architecturalBlueprintIdentity';
import { auditV3Blueprint, type V3BlueprintFinding } from './blueprint';
import { architecturalDraftFinding } from './architecturalAcceptance';
import { normalizeV3GenerationOutput } from './generation';
import { compileV3Scene, type V3Scene } from './scene';
import { authoredPlan } from './authoredPlan';
import { auditV3Interior } from './interior';
import { v3FootprintSchema } from './footprintSchema';
import { SHAPED_SITE_TYPES, siteFeatureConstructionIssues } from './siteFeatureConstruction';
import { plannedSiteType } from './plannedSiteGeometry';
import { resolveFootprint } from './footprint';
import { reviewArchitecturalPlan } from './architecturalPlanReview';
import { planDraftFinding, triageSurfaceEndpoint, ROUTE_FAILURE_CODES, type UnresolvedPlanItem, type UnresolvedPlanKind } from './planRecovery';

const building = blueprintSchema.shape.buildings.element;
const feature = blueprintSchema.shape.features.element;
const connection = blueprintSchema.shape.connections.element;
const opening = building.shape.facade.shape.openings.unwrap().element;
// Entrances belong to the plan: their wall addresses also determine route endpoints.
const accessOpening = z.discriminatedUnion('type',[opening.options[1],opening.options[3]]);
export const v3ArchitecturalPlanSchema = blueprintSchema.omit({
  format:true, materials:true, buildings:true, features:true, connections:true, partitions:true, doors:true,
}).extend({
  format:z.literal('v3-architectural-plan-1'),
  // Omission means no extra claim/constraint, never inferred geometry. Authored
  // reservations and relationships still pass through the same strict audits.
  forms:blueprintSchema.shape.forms.default([]),
  considerations:blueprintSchema.shape.considerations.default([]),
  relationships:blueprintSchema.shape.relationships.default([]),
  roomAdjacencies:blueprintSchema.shape.roomAdjacencies.default([]),
  zones:blueprintSchema.shape.zones.default([]),
  buildings:z.array(building.omit({materialId:true, facade:true, roof:true}).extend({
    // An unresolved relationship-first layout has no invented room geometry.
    storeys:z.array(building.shape.storeys.element.extend({spaces:z.array(building.shape.storeys.element.shape.spaces.element)})).min(1).max(20),
    spaceHeight:building.shape.facade.shape.spaceHeight,roofId:building.shape.roof.shape.id.describe('Stable identity reserved for the future host-derived roof; no roof geometry is designed in this stage.'),accessOpenings:z.array(accessOpening)}).strict()).min(1),
  features:z.array(feature.omit({materialId:true, canopyStyle:true, railing:true, terraceOpenEdges:true}).extend({height:feature.shape.height.optional().describe('Optional vertical extent; omit when construction depth/height is deferred. The authored 2D boundary is independent.')})),
  connections:z.array(connection.omit({materialId:true})),
}).strict();
export const v3ArchitecturalExteriorSchema = z.object({
  materials:blueprintSchema.shape.materials,
  buildings:z.array(building.pick({id:true, materialId:true}).extend({facade:building.shape.facade.omit({spaceHeight:true}),roof:building.shape.roof.omit({id:true})}).strict()),
  features:z.array(feature.pick({id:true, materialId:true, canopyStyle:true, railing:true, terraceOpenEdges:true}).extend({
    height:feature.shape.height.optional().describe('Supply the vertical extent when the saved plan omits height. An explicit saved height is fixed.'),
  }).strict()),
  connections:z.array(connection.pick({id:true, materialId:true})),
  verticalCirculation:z.array(blueprintSchema.shape.verticalCirculation.element.pick({id:true,stairType:true,direction:true,turn:true}).required({stairType:true,direction:true})).optional(),
  partitions:blueprintSchema.shape.partitions.default([]),
  doors:blueprintSchema.shape.doors.default([]),
}).strict();
export const v3PlanFirstDesignSchema = z.object({
  format:z.literal('v3-plan-first-1'),
  plan:v3ArchitecturalPlanSchema.describe('Author this complete 2D estate and room layout FIRST. No roofs, finishes, detailed partitions or exterior assemblies.'),
  exterior:v3ArchitecturalExteriorSchema.describe('Develop the preceding plan by ID. Supply missing feature heights; preserve all authored dimensions. No locations, footprints, room layouts or independent route geometry are permitted here.'),
}).strict();
export type V3ArchitecturalPlan = z.infer<typeof v3ArchitecturalPlanSchema>;
export type V3ArchitecturalExterior = z.infer<typeof v3ArchitecturalExteriorSchema>;
export type V3PlanFirstDesign = z.infer<typeof v3PlanFirstDesignSchema>;

const neutralMaterials:V3ArchitecturalBlueprint['materials'] = [
  {id:'plan-stone',color:'#d6d2c8',surface:'stone',roughness:.8},
  {id:'plan-water',color:'#528e9a',surface:'water'},
  {id:'plan-court',color:'#b8ad98',surface:'paving',roughness:.74},
  {id:'plan-grass',color:'#61754b',surface:'grass',roughness:.9},
];
const neutralFeature = (type:string) => (type==='pool'||type==='fountain')?'plan-water':type==='landscape-zone'?'plan-grass':type==='courtyard'?'plan-court':'plan-stone';
/** Compatibility adapter into the EXISTING semantic lowering, never a second builder.
 * Temporary roof declarations are discarded before the plan is inspected or compiled. */
function planningInput(plan:V3ArchitecturalPlan):V3ArchitecturalBlueprint {
  return {...structuredClone(plan),format:'v3-architectural-blueprint-1',materials:neutralMaterials,
    buildings:plan.buildings.map(({accessOpenings,roofId,spaceHeight,...b})=>({...structuredClone(b),materialId:'plan-stone',
      facade:{...(spaceHeight?{spaceHeight}:{}),openings:structuredClone(accessOpenings)},
      roof:{id:roofId,form:'flat',materialId:'plan-stone',pitchDegrees:0,overhang:0,thickness:.25}})),
    // A thin selectable proxy is runtime compatibility only, never an authored pool depth or slab thickness.
    features:plan.features.map(f=>({...structuredClone(f),height:f.height??.01,materialId:neutralFeature(f.type)})),
    connections:plan.connections.map(c=>({...structuredClone(c),materialId:'plan-stone'})),partitions:[],doors:[]};
}
/** Shared shell projection for disposable room-intent development; no construction. */
export function lowerV3ArchitecturalPlan(plan:V3ArchitecturalPlan):V3Scene {
  return lowerV3ArchitecturalBlueprint(planningInput(plan));
}
const finding = (code:string,targetIds:string[],message:string):V3BlueprintFinding => ({code,targetIds,message,severity:'fatal'});
export interface V3PlanStage { ok:boolean; plan?:V3ArchitecturalPlan; scene?:V3Scene; findings:V3BlueprintFinding[]; identityChanges?:ArchitecturalIdentityChange[]; unresolved?:UnresolvedPlanItem[]; }
type PlanConnection = V3ArchitecturalPlan['connections'][number];
/** No detailed construction is called here. Invalid local zones remain visible and editable.
 * With `recover`, a defect confined to ONE connection, site feature or room adjacency withholds
 * only that object: its authored value stays in `unresolved` (never altered or deleted) and the
 * rest of the estate remains a draft. Without it every such defect rejects the plan, as before. */
export function prepareV3ArchitecturalPlan(raw:unknown,options:{circulationReservations?:boolean;recover?:boolean}={}):V3PlanStage {
  const {recover=false,...auditOptions}=options;
  const parsed=v3ArchitecturalPlanSchema.safeParse(raw);
  if(!parsed.success)return {ok:false,findings:parsed.error.issues.map(i=>finding('PLAN_INPUT',[i.path.join('.')],i.message))};
  const plan=structuredClone(parsed.data);
  const featureFindings:V3BlueprintFinding[]=[];
  for(const f of plan.features){
    const canonical=plannedSiteType(f.type);
    if(canonical)f.type=canonical;
    else featureFindings.push({code:'PLAN_FEATURE_CONSTRUCTION_DEFERRED',targetIds:[f.id],severity:'advisory',message:`${f.type}: only the authored plan boundary is represented; detailed construction is unsupported. This reservation cannot serve as a dry route endpoint.`});
  }
  const normalized=normalizeArchitecturalBlueprintIdentities(planningInput(plan));
  if(normalized.findings.some(f=>f.severity==='fatal'))return {ok:false,plan:parsed.data,findings:normalized.findings};
  plan.connections.forEach((c,i)=>{c.surfaceId=normalized.blueprint.connections[i].surfaceId;});
  const findings:V3BlueprintFinding[]=[...featureFindings],unresolved=new Map<string,UnresolvedPlanItem>(),reseated=new Map<string,PlanConnection>();
  for(const b of plan.buildings)for(const s of b.storeys)if(!s.spaces.length)findings.push({code:'ROOM_LAYOUT_UNRESOLVED',severity:'advisory',targetIds:[s.id],message:'This storey has no resolved room geometry. Its architectural layout needs an explicit edit before construction.'});
  const key=(kind:UnresolvedPlanKind,id:string)=>`${kind}:${id}`;
  const withhold=(kind:UnresolvedPlanKind,id:string,rawValue:unknown,why:V3BlueprintFinding[])=>{
    if(unresolved.has(key(kind,id)))return;
    unresolved.set(key(kind,id),{kind,id,raw:structuredClone(rawValue),findings:why.map(f=>({...f,targetIds:[id,...f.targetIds.filter(t=>t!==id)]}))});
  };
  const hard:V3BlueprintFinding[]=[];
  for(const b of plan.buildings){
    if(b.plan.kind!=='rectangle'){
      const footprint=b.plan.kind==='outline'?{kind:'outline',segments:b.plan.segments,operations:[]}:{kind:'articulated',operations:b.plan.operations};
      const checked=v3FootprintSchema.safeParse(footprint);
      if(!checked.success)hard.push(finding('PLAN_GEOMETRY',[b.id],checked.error.issues.map(i=>i.message).join('; ')));
      if(b.plan.kind==='outline'&&b.plan.segments.some(s=>s.type==='arc'&&Math.abs(s.startAngle!)>720))hard.push(finding('PLAN_GEOMETRY',[b.id],'Supported arc start angles are within -720..720 degrees.'));
    }
    if(!plan.entrances.some(e=>e.objectId===b.id&&e.level===0)){
      const missing=finding('PLAN_ENTRANCE',[b.id],'Choose a primary ground entrance.');
      (recover?findings:hard).push(missing);
    }
    if(!plan.program.some(p=>p.objectIds.includes(b.id)))hard.push(finding('PLAN_PROGRAM',[b.id],'Declare the building function.'));
  }
  for(const a of plan.roomAdjacencies)if(!plan.buildings.some(b=>b.storeys.some(s=>s.spaces.some(r=>r.id===a.from)&&s.spaces.some(r=>r.id===a.to)))){
    const why=finding('PLAN_ADJACENCY',[a.from,a.to],'Adjacent rooms must occupy the same planned storey.');
    if(recover)withhold('adjacency',`${a.from}|${a.to}`,a,[why]);else hard.push(why);
  }
  if(hard.length)return {ok:false,plan,findings:[...findings,...hard]};

  const authored=(id:string)=>plan.connections.find(c=>c.id===id)!;
  const working=():V3ArchitecturalPlan=>({...plan,
    features:plan.features.filter(f=>!unresolved.has(key('feature',f.id))),
    connections:plan.connections.filter(c=>!unresolved.has(key('connection',c.id))).map(c=>reseated.get(c.id)??c),
    roomAdjacencies:plan.roomAdjacencies.filter(a=>!unresolved.has(key('adjacency',`${a.from}|${a.to}`)))});
  let wp=working(),scene!:V3Scene,audit:V3BlueprintFinding[]=[];
  const deferred=new Set(plan.buildings.map(b=>b.roofId));
  for(let pass=0,limit=2*(plan.connections.length+plan.features.length)+3;pass<limit;pass++){
    wp=working();
    let reseatedNow=false;const before=unresolved.size,stop=()=>!recover&&unresolved.size>before;
    // Resolve references BEFORE the lowering adapter's endpoint lookup.
    const featureIds=new Set(wp.features.map(f=>f.id));
    for(const c of wp.connections){
      const bad:V3BlueprintFinding[]=[];
      for(const e of [c.from,c.to]){
        if(e.kind==='entrance'&&!plan.entrances.some(a=>a.id===e.entranceId))bad.push(finding('PLAN_REFERENCE',[c.id,e.entranceId],'Unknown planned entrance.'));
        if(e.kind==='site-access'&&!plan.site.access.some(a=>a.id===e.accessId))bad.push(finding('PLAN_REFERENCE',[c.id,e.accessId],'Unknown site access.'));
        if(e.kind==='surface'&&!featureIds.has(e.objectId))bad.push(finding('PLAN_REFERENCE',[c.id,e.objectId],'Route endpoint requires a retained planned dry surface.'));
      }
      if(bad.length)withhold('connection',c.id,authored(c.id),bad);
    }
    if(unresolved.size>before){if(stop())break;continue;}
    scene=lowerV3ArchitecturalBlueprint(planningInput(wp));
    scene.objects=scene.objects.filter(o=>o.type!=='roof-form');
    for(const f of wp.features){
      const o=scene.objects.find(o=>o.id===f.id)!;
      if(!plannedSiteType(f.type)){o.geometryKind='slab';o.collision='solid';}
      if(f.footprint&&!resolveFootprint(o,0))withhold('feature',f.id,f,[finding('PLAN_GEOMETRY',[f.id],'Invalid planned site boundary; no rectangular substitute is accepted.')]);
    }
    if(unresolved.size>before){if(stop())break;continue;}
    // Endpoint triage uses the lowered boundaries, so rotated and nonrectangular surfaces are exact.
    const featureObjectIds=new Set(wp.features.map(f=>f.id));
    for(const c of wp.connections)for(const side of ['from','to'] as const){
      const e=c[side];
      if(e.kind!=='surface')continue;
      const triage=triageSurfaceEndpoint(scene,featureObjectIds,e);
      if(triage.status==='unresolved')withhold('connection',c.id,authored(c.id),[finding(triage.code,[c.id,e.objectId],triage.message)]);
      else if(triage.status==='reseat'){
        if(!recover){withhold('connection',c.id,authored(c.id),[finding('PLAN_CONTACT',[c.id,e.objectId],'Contact lies outside its planned dry surface.')]);continue;}
        const next=structuredClone(reseated.get(c.id)??c);
        next[side]={kind:'surface',objectId:triage.objectId,local:triage.local};
        reseated.set(c.id,next);reseatedNow=true;
        findings.push({code:'PLAN_ENDPOINT_RESEATED',severity:'advisory',targetIds:[c.id,triage.objectId,e.objectId],message:`${c.id} ${side}: the authored contact point lies only on dry surface ${triage.objectId}, not ${e.objectId}. The contact point is unchanged; only its surface address was derived.`});
      }
    }
    if(unresolved.size>before||reseatedNow){if(stop())break;continue;}
    audit=auditV3Blueprint(scene,{constructionEvidence:false,...auditOptions}).findings;
    if(!recover)break;
    // A route whose geometry the audit cannot accept is withheld; the audit's own reason is kept.
    const owners=new Map(wp.connections.map(c=>[c.surfaceId,c])),failures=new Map<string,V3BlueprintFinding[]>();
    for(const f of audit){
      if(f.severity!=='fatal'||!ROUTE_FAILURE_CODES.has(f.code)||planDraftFinding(scene,f,[...findings,...audit]))continue;
      const own=f.code==='ESTATE_ROUTE_BLOCKED'||f.code==='ESTATE_POOL_CROSSING'?f.targetIds.slice(0,1):f.targetIds;
      for(const id of new Set(own.flatMap(t=>owners.has(t)?[owners.get(t)!.id]:[])))failures.set(id,[...failures.get(id)??[],f]);
    }
    for(const [id,why] of failures)withhold('connection',id,authored(id),why);
    if(!failures.size)break;
  }
  const items=[...unresolved.values()];
  // Name the entrance defect that made a route unresolvable, so the cause is not buried in generic route codes.
  for(const item of items)if(item.kind==='connection'){
    const c=item.raw as PlanConnection;
    for(const e of [c.from,c.to]){
      const entry=e.kind==='entrance'?plan.entrances.find(a=>a.id===e.entranceId):undefined;
      const cause=entry&&audit.find(f=>(f.code==='BLUEPRINT_ENTRANCE_WALL'||f.code==='BLUEPRINT_ENTRANCE')&&f.targetIds[0]===entry.objectId&&f.targetIds[1]===entry.openingId);
      if(cause&&!item.findings.some(f=>f.code==='PLAN_ENTRANCE_UNRESOLVED'&&f.targetIds.includes(entry.id)))
        item.findings.unshift(finding('PLAN_ENTRANCE_UNRESOLVED',[c.id,entry.id,entry.objectId,entry.openingId],`${c.id} cannot be drawn: its entrance ${entry.id} is retained as authored but ${cause.message}`));
    }
  }
  if(!recover&&items.length)return {ok:false,plan,findings:[...findings,...items.flatMap(i=>i.findings)]};
  // Anything that merely points at a withheld object is explained by it, not a second defect.
  const gone=new Set(items.flatMap(i=>i.kind==='connection'?[i.id,(i.raw as PlanConnection).surfaceId]:i.kind==='feature'?[i.id]:[]));
  findings.push(...audit.map(f=>{
    if(f.severity==='fatal'&&f.targetIds.some(id=>gone.has(id)))return {...f,severity:'advisory' as const,message:`Follows from an unresolved plan object. ${f.message}`};
    // Keep future roof identities in the blueprint index, but no roof geometry exists yet.
    return ['ESTATE_MISSING_OBJECT','BLUEPRINT_REFERENCE'].includes(f.code)&&f.targetIds.some(id=>deferred.has(id))
      ? {...f,severity:'advisory' as const,message:`Reserved roof identity will be resolved during exterior elaboration. ${f.message}`}:f;
  }));
  findings.push(...auditV3Interior(scene).filter(i=>i.code==='ROOM_ADJACENCY_NO_SHARED_BOUNDARY').map(i=>({code:i.code,targetIds:[i.targetId],message:i.message,severity:'advisory' as const})));
  const tolerated=recover?planDraftFinding:architecturalDraftFinding;
  const blocked=findings.some(f=>f.severity==='fatal'&&!tolerated(scene,f,findings));
  // The withheld objects' own diagnostics describe what is unresolved; they never reject the draft.
  findings.push(...items.flatMap(i=>i.findings));
  // Normalization only derives runtime envelopes; the named semantic geometry stays authoritative.
  const canonical=normalizeV3GenerationOutput(scene,'flat').scene;
  canonical.metadata.planDeferredFeatureHeights=wp.features.filter(f=>f.height===undefined).map(f=>f.id);
  if(recover)canonical.metadata.planUnresolved=items;
  canonical.metadata.designPipeline={format:'v3-plan-first-1',stage:'plan',authority:'v3-semantic-plan'};
  // The editable plan keeps every authored object, withheld ones exactly as written.
  const full:V3ArchitecturalPlan={...plan,connections:plan.connections.map(c=>unresolved.has(key('connection',c.id))?c:reseated.get(c.id)??c)};
  // Read-only review follows acceptance: observations improve the editable plan,
  // never add another rejection gate or silently repair approved geometry.
  const review=reviewArchitecturalPlan(canonical,findings);
  canonical.metadata.planQualityReview=review;
  findings.push(...review.findings);
  return {ok:!blocked,plan:full,scene:canonical,findings,identityChanges:normalized.changes,unresolved:items};
}

/** Inspectable CURRENT plan, directly from persisted fields; no stale second geometry copy.
 * Exact segments/operations are included alongside their resolved drawing polygons. */
export function inspectV3ArchitecturalPlan(scene:V3Scene) {
  const index=scene.estatePlan?.blueprint;
  return {
    site:scene.site,
    buildings:scene.objects.filter(o=>o.type==='building-mass').map(o=>({id:o.id,architecture:o.architecture,levels:o.levels,
      footprint:o.composition?.footprint,spaceHeight:o.composition?.spaceHeight,polygons:Array.from({length:o.levels??1},(_,i)=>authoredPlan(o,i)),
      accessOpenings:o.composition?.openings?.filter(op=>index?.entrances.some(e=>e.objectId===o.id&&e.openingId===op.id))??[]})),
    storeys:scene.interior?.storeys,rooms:scene.interior?.rooms,circulation:scene.interior?.circulation,
    features:scene.objects.filter(o=>index?.outdoorObjectIds.includes(o.id)).map(o=>({id:o.id,type:o.type,architecture:o.architecture,footprint:o.composition?.footprint})),
    entrances:index?.entrances,connections:scene.estatePlan?.circulation,
    estate:scene.estatePlan&&{concept:scene.estatePlan.concept,character:scene.estatePlan.character,access:scene.estatePlan.siteAccess,
      requirements:scene.estatePlan.requirements,program:scene.estatePlan.program,zones:scene.estatePlan.zones,
      architecture:scene.estatePlan.architecture,relationships:scene.estatePlan.relationships,considerations:scene.estatePlan.considerations},
    adjacencies:scene.relationships.filter(r=>r.kind==='adjacent'),
  };
}
export function sameArchitecturalPlan(a:V3Scene,b:V3Scene):boolean {
  // Ground/material finishes and entrances' exterior-only details can change. Horizontal addresses cannot.
  // Only the SOURCE plan can delegate an absent feature height. Runtime .01m
  // proxies never become approved construction dimensions or weaken other axes.
  const deferredHeights=new Set<string>((a.metadata.designPipeline as {stage?:string}|undefined)?.stage==='plan'
    && Array.isArray(a.metadata.planDeferredFeatureHeights)?a.metadata.planDeferredFeatureHeights:[]);
  const geometry=(s:V3Scene)=>{
    const p=inspectV3ArchitecturalPlan(s);
    return {...p,site:{width:p.site.width,depth:p.site.depth,baseElevation:p.site.baseElevation},
      // Flight construction may be deferred; its 2D reservation/host/levels stay fixed.
      circulation:p.circulation?.map(({stairType,direction,turn,...reservation})=>{void stairType;void direction;void turn;return reservation;}),
      features:p.features.map(f=>({...f,architecture:f.architecture&&{...f.architecture,...(deferredHeights.has(f.id)?{height:undefined}:{})}})),
      buildings:p.buildings.map(b=>({...b,accessOpenings:b.accessOpenings.map(op=>({id:op.id,facade:op.facade,segmentId:op.segmentId,...('start' in op?{start:op.start,end:op.end}:{}),floors:op.floors}))}))};
  };
  const stable=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  return stable(geometry(a))===stable(geometry(b));
}

/** The normal V3 compiler extrudes the same semantic footprints. Only exterior presentation is absent. */
export function constructV3PlanMassing(stage:V3PlanStage) {
  if(!stage.ok||!stage.scene)return undefined;
  const scene=v3ArchitecturalMassingScene(stage.scene);
  scene.metadata.designPipeline={format:'v3-plan-first-1',stage:'massing',authority:'v3-semantic-plan'};
  const model=compileV3Scene(scene);
  // The ordinary mass compiler may emit its default top cover. That is deferred until exterior design.
  model.primitives=model.primitives.filter(p=>p.category!=='roof');
  return {scene,model};
}

/** Objects the 2D draft could not represent. They keep Build in 3D closed (no AI call is made) until corrected. */
export function unresolvedPlanFindings(stage:Pick<V3PlanStage,'unresolved'|'findings'>):V3BlueprintFinding[] {
  return [
    ...(stage.unresolved??[]).map(i=>finding('PLAN_UNRESOLVED',[i.id],`Unresolved ${i.kind} ${i.id} is retained but not drawn. Correct it in the 2D plan before building.`)),
    ...stage.findings.filter(f=>f.code==='PLAN_ENTRANCE'),
  ];
}

/** Unsupported construction only. Missing vertical extents are Terra's exterior decisions. */
export function deferredPlanConstructionFindings(plan:V3ArchitecturalPlan):V3BlueprintFinding[] {
  return plan.features.flatMap(f=>{
    const decisions:string[]=[];
    if(f.footprint&&!SHAPED_SITE_TYPES.has(f.type))decisions.push('Detailed construction of this nonrectangular feature type is unsupported');
    if(!plannedSiteType(f.type))decisions.push(`Detailed construction of ${f.type} is unsupported`);
    return decisions.length?[finding('EXTERIOR_PLAN_DEFERRED',[f.id],`${decisions.join('; ')}. The saved 2D boundary remains valid.`)]:[];
  });
}

/** Known fixed-plan defects must be explained before spending an exterior call.
 * Future roofs and flight details are absent at this stage; room draft findings
 * retain the existing construction policy. Never suppress other fatal findings. */
export function planConstructionBlockers(stage:V3PlanStage):V3BlueprintFinding[] {
  const findings=[...(stage.scene?stage.scene.objects.filter(o=>stage.plan?.features.some(f=>f.id===o.id)).flatMap(o=>siteFeatureConstructionIssues(o).map(message=>finding('EXTERIOR_PLAN_GEOMETRY',[o.id],message))):[]),...unresolvedPlanFindings(stage),...(stage.plan?deferredPlanConstructionFindings(stage.plan):[])];
  findings.push(...stage.findings.filter(f=>f.severity==='fatal'
    && (!stage.scene||!architecturalDraftFinding(stage.scene,f,stage.findings))));
  findings.push(...stage.findings.filter(f=>f.code==='ROOM_LAYOUT_UNRESOLVED').map(f=>({...f,severity:'fatal' as const})));
  return [...new Map(findings.map(f=>[JSON.stringify([f.code,f.targetIds,f.message]),f])).values()];
}

/** Exterior may select host-relative assemblies/roof forms/finishes, never replace plan geometry. */
export function elaborateV3ArchitecturalPlan(stage:V3PlanStage,raw:unknown):{blueprint?:V3ArchitecturalBlueprint;findings:V3BlueprintFinding[]} {
  if(!stage.ok||!stage.plan||!stage.scene)return {findings:stage.findings};
  const unresolved=unresolvedPlanFindings(stage);
  if(unresolved.length)return {findings:unresolved};
  const parsed=v3ArchitecturalExteriorSchema.safeParse(raw);
  if(!parsed.success)return {findings:parsed.error.issues.map(i=>finding('EXTERIOR_INPUT',[i.path.join('.')],i.message))};
  const exterior=parsed.data,plan=stage.plan,findings:V3BlueprintFinding[]=[];
  findings.push(...deferredPlanConstructionFindings(plan));
  if(findings.length)return {findings};
  for(const key of ['buildings','features','connections'] as const){
    const expected=plan[key].map(e=>e.id),actual=exterior[key].map(e=>e.id);
    if(actual.length!==expected.length||new Set(actual).size!==actual.length||expected.some(id=>!actual.includes(id)))findings.push(finding('EXTERIOR_HOSTS',[key],'Exterior must address every planned identity exactly once.'));
  }
  for(const f of plan.features){
    const e=exterior.features.find(e=>e.id===f.id);
    if(f.height===undefined&&e?.height===undefined)findings.push(finding('EXTERIOR_HEIGHT_REQUIRED',[f.id],'Terra must supply the deferred feature height before construction.'));
    else if(f.height!==undefined&&e?.height!==undefined&&e.height!==f.height)findings.push(finding('EXTERIOR_PLAN_OVERRIDE',[f.id],'The saved feature height is fixed; only missing heights may be designed.'));
  }
  const flights=exterior.verticalCirculation??[];
  if(new Set(flights.map(c=>c.id)).size!==flights.length||flights.some(c=>!plan.verticalCirculation.some(p=>p.id===c.id&&p.type==='stair')))
    findings.push(finding('EXTERIOR_HOSTS',['verticalCirculation'],'Flight details must address a unique existing stair reservation.'));
  for(const flight of flights){
    const reserved=plan.verticalCirculation.find(c=>c.id===flight.id);
    if(reserved&&(['stairType','direction','turn'] as const).some(key=>reserved[key]!==undefined&&flight[key]!==reserved[key]))
      findings.push(finding('EXTERIOR_PLAN_OVERRIDE',[flight.id],'Explicit flight decisions are already approved; only deferred construction details may be supplied.'));
  }
  if(findings.length)return {findings};
  const buildings=plan.buildings.map(({accessOpenings,roofId,spaceHeight,...b})=>{
    const e=exterior.buildings.find(e=>e.id===b.id)!;
    for(const op of e.facade.openings??[])if(accessOpenings.some(a=>a.id===op.id))findings.push(finding('EXTERIOR_PLAN_OVERRIDE',[b.id,op.id],'Entrance wall addresses belong to the 2D plan. Do not repeat or override them in exterior.openings.'));
    return {...structuredClone(b),...structuredClone(e),roof:{...structuredClone(e.roof),id:roofId},facade:{...structuredClone(e.facade),...(spaceHeight?{spaceHeight}:{}),openings:[...structuredClone(accessOpenings),...structuredClone(e.facade.openings??[])]}};
  });
  if(findings.length)return {findings};
  const blueprint:V3ArchitecturalBlueprint={...structuredClone(plan),format:'v3-architectural-blueprint-1',materials:exterior.materials,buildings,
    verticalCirculation:plan.verticalCirculation.map(c=>({...structuredClone(c),...flights.find(f=>f.id===c.id)})),
    features:plan.features.map(f=>({...structuredClone(f),...exterior.features.find(e=>e.id===f.id)!,height:f.height??exterior.features.find(e=>e.id===f.id)!.height!})),
    connections:plan.connections.map(c=>({...structuredClone(c),...exterior.connections.find(e=>e.id===c.id)!})),
    partitions:exterior.partitions,doors:exterior.doors};
  const scene=lowerV3ArchitecturalBlueprint(blueprint);
  if(!sameArchitecturalPlan(stage.scene,scene))return {findings:[finding('EXTERIOR_PLAN_DRIFT',['plan'],'Exterior elaboration changed authoritative planning geometry.')]};
  return {blueprint,findings};
}

/** Offline/recovery adapter only. Production authoring is instructed to create the plan separately. */
export function splitV3ArchitecturalBlueprint(bp:V3ArchitecturalBlueprint):V3PlanFirstDesign {
  const {materials,buildings,features,connections,partitions,doors,...common}=structuredClone(bp);
  return {format:'v3-plan-first-1',plan:{...common,format:'v3-architectural-plan-1',
    buildings:buildings.map(({materialId,facade,roof,...b})=>{void materialId;return {...b,...(facade.spaceHeight?{spaceHeight:facade.spaceHeight}:{}),roofId:roof.id,accessOpenings:(facade.openings??[]).filter((op):op is z.infer<typeof accessOpening> => (op.type==='door'||op.type==='glazed-door')&&bp.entrances.some(e=>e.objectId===b.id&&e.openingId===op.id))};}),
    features:features.map(({materialId,canopyStyle,railing,terraceOpenEdges,...f})=>{void materialId;void canopyStyle;void railing;void terraceOpenEdges;return f;}),
    connections:connections.map(({materialId,...c})=>{void materialId;return c;})},
    exterior:{materials,buildings:buildings.map(({id,materialId,facade,roof})=>({id,materialId,roof:(({id,...intent})=>{void id;return intent;})(roof),facade:{...(({spaceHeight,...rest})=>{void spaceHeight;return rest;})(facade),openings:facade.openings?.filter(op=>!bp.entrances.some(e=>e.objectId===id&&e.openingId===op.id))}})),
      features:features.map(({id,materialId,canopyStyle,railing,terraceOpenEdges})=>({id,materialId,...(canopyStyle?{canopyStyle}:{}),...(railing?{railing}:{}),...(terraceOpenEdges?{terraceOpenEdges}:{})})),
      connections:connections.map(({id,materialId})=>({id,materialId})),partitions,doors}};
}

/** Presentation projection of CURRENT semantic plan; never saved as a second live design. */
export function v3ArchitecturalMassingScene(input:V3Scene):V3Scene {
  const scene=structuredClone(input),index=scene.estatePlan?.blueprint;
  scene.objects=scene.objects.filter(o=>o.type!=='roof-form');
  if(index)index.roofObjectIds=[];
  for(const o of scene.objects)if(o.type==='building-mass'){
    o.composition={footprint:o.composition?.footprint,spaceHeight:o.composition?.spaceHeight,openings:o.composition?.openings?.filter(op=>index?.entrances.some(e=>e.objectId===o.id&&e.openingId===op.id))??[]};
    o.material=neutralMaterials[0];
  }
  for(const o of scene.objects)if(index?.outdoorObjectIds.includes(o.id)){
    o.material=neutralMaterials.find(m=>m.id===neutralFeature(o.type))!;
    delete o.canopyStyle;delete o.railing;delete o.terraceOpenEdges;
  }
  if(scene.interior){scene.interior.partitions=[];scene.interior.doors=[];}
  scene.metadata.designPipeline={format:'v3-plan-first-1',stage:'massing',authority:'v3-semantic-plan'};
  return scene;
}
