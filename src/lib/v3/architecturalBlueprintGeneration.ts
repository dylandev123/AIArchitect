import { z } from 'zod';
import { v3PlanFirstDesignSchema, prepareV3ArchitecturalPlan, constructV3PlanMassing, elaborateV3ArchitecturalPlan, sameArchitecturalPlan } from './architecturalPlanFirst';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint, v3ArchitecturalBlueprintSchema, type V3ArchitecturalBlueprint, type V3ArchitecturalPlanningResult } from './architecturalBlueprint';
import type { V3BlueprintFinding } from './blueprint';
import { reviewV3Architecture } from './designReview';
import type { V3Scene } from './scene';
import { normalizeArchitecturalBlueprintIdentities, type ArchitecturalIdentityChange } from './architecturalBlueprintIdentity';
import { ARCHITECTURAL_DESIGN_PROCESS, RELATIONSHIP_FIRST_ROOM_GUIDANCE } from './architecturalDesignGuidance';
import { expandPlanAuthoring, v3RelationshipPlanAuthoringSchema } from './architecturalPlanAuthoring';
import { preparePlanEvaluation } from './architecturalPlanEvaluation';

/** Server-owned opt-in for NEW flat-site generations. No saved-scene migration. */
export const v3ArchitecturalBlueprintEnabled = (flag:string|undefined, terrain:'flat'|'advanced') => flag==='1' && terrain==='flat';

/** One conceptual sequence inside the existing authoring call; no extra request or stored model. */
export const ARCHITECTURAL_DESIGN_SEQUENCE = ARCHITECTURAL_DESIGN_PROCESS;

const instructions=ARCHITECTURAL_DESIGN_SEQUENCE+RELATIONSHIP_FIRST_ROOM_GUIDANCE+`
You are Terra, the architect. Return ONE plan-first design as JSON, format v3-plan-first-1: plan FIRST, then exterior. The one response supplies both; no additional creative or detailed-scene call exists.
PLAN owns site/access, building placements and exact footprints, storey heights and conceptual room zones, accessOpenings and entrance identities, stair/lift reservations, outdoor footprints/datums and route endpoints/bends. Reserve roofId without roof geometry. EXTERIOR addresses planned IDs exactly once and adds finishes, compatible roofs, non-entrance openings and host-relative assemblies. It cannot change placements, footprints, storeys, rooms or routes, or repeat accessOpenings. V3 validates the plan, constructs massing from it, then applies exterior decisions.
Specify the brief's requirements and building program. Optional forms/considerations/relationships/roomAdjacencies/zones are useful only for real intent or constraints; omit empty ledgers. Use derived membership zones unless a reserved allocation is an intentional independent constraint. Conceptual zones do not require detailed partitions or doors: defer those arrays unless explicitly requested. Never omit requested architecture to satisfy validation. Empty/omitted detail means absent, not permission for V3 to invent it.
GEOMETRY: metres; north=-Z, east=+X, yaw radians, flat site datum 0. Building/feature locations are WORLD centres; room and stair x/z are HOST-LOCAL CENTRES, not minimum corners. Room rectangles must fit the real outline without overlap. Storey heights alone determine mass height and floor datums. V3 derives walls, slabs, outline envelopes, host roof placement and route contacts/ribbons/bounds; never duplicate those coordinates. Each building needs ground access and a program entry. Use connected clockwise line/arc outlines or articulated operations for supported nonrectangular forms. Operations can target ground/upper/all floors; arbitrary independent storey polygons, outline holes, splines, overlapping curved masses and stacked hosts are unsupported.
OPENINGS: accessOpenings belong to plan; exterior facade.openings lists only additional openings (explicit [] for none). Door/glazed-door permits passage; glazing-zone/rhythm is a window. MainEntry references a ground door. Fractions address actual facades; every outline opening/assembly part needs its segmentId. Fit spans, sills and heights without overlap/clipping. Assemblies contain real host-relative slab/post/beam/rail parts; rail slabId is local to its assembly. Balcony access needs a door on that level serving the assembly. Primary finish covers walls/slabs; posts/beams use existing dark trim, rails existing glass. Bespoke part finishes are unsupported.
ROOFS: one reserved host-derived roof per mass; flat/floating-flat/terrace pitch 0; mono-pitch/hip/gable/butterfly pitch 1..60 degrees. Nonrectangular hosts support flat/floating-flat/terrace/mono-pitch only. Preserve an unsupported requested roof family in roof.form for an honest diagnostic; never substitute it.
OUTDOORS: terrace (including fully paved motor courts), courtyard (perimeter ring), pool, fountain (basin and central jet), landscape-zone (grass only), path, driveway, canopy (canopyStyle solid/slatted). Terrace/courtyard/pool/fountain/garden/path/driveway boundaries can be shaped with supported line/arc footprints; a circle is a full 360-degree arc. Keep basin/perimeter offsets wide enough for a .22m inset without folded necks; the fountain origin must lie inside its basin. Canopies remain rectangular. Water basins cut islands out of intersecting paving; routes must avoid water. Courtyard paving is #b8ad98, roughness .74, thickness >=.14m; grass roughness .9, thickness >=.12m. Canopy spans >=1m, height >=2.2m. Pool baseElevation + height is the RIM datum, not excavation depth; coordinate it with dry poolside paving. Water material does not design an infinity edge. Shell/coping policies are fixed. No authored trees, furniture, pool equipment or automatic steps/ramps; horizontal route contact does not certify a flush threshold.
ROUTES: reference entrance, site-access or a contact in a named dry surface's local frame. surfaceId declares a NEW exclusive path/driveway owner, never an existing feature; endpoint.objectId references that feature. Terrace/courtyard/landscape support surface endpoints; canopies need a separate dry floor. Choose width/use and obstacle-avoiding bends; V3 derives endpoint world coordinates and owner bounds. Exact curved routes use path:[line/arc segments] in WORLD x/z metres continuously between the named contacts, with waypoints:[] and no approachDistance; arc radius must exceed half the route width by .1m. Ordinary waypoints produce straight segments only. Do not author path boxes or repeat gate/entrance coordinates.
INTERIORS: reserve usable stair flights/landings with explicit host, levels, type/direction/turn. Room names do not build walls. Defer partitions and interior doors unless requested. When requested, use real shared room boundaries and door offsets in METRES from boundary start; only rectangular gaps in solid/glazed/screen partitions are supported, without leaves/hardware. Exterior doors are facade openings.
Stable IDs/references must resolve. Preserve user obligations separately from design choices, report capability gaps and never silently simplify. Return only the design matching this JSON schema: no objects, runtime transforms, meshes, independent roof coordinates, duplicate route geometry, V3 scene or V2 document.
`;

let promptCache:string|undefined;
/** The exact input schema is transmitted in JSON mode; provider strict-schema union support is not assumed. */
export function v3ArchitecturalBlueprintPrompt():string {
  const plan=v3PlanFirstDesignSchema.shape.plan;
  const authoring=plan.extend({buildings:z.array(plan.shape.buildings.element.extend({
    storeys:v3RelationshipPlanAuthoringSchema.shape.buildings.element.shape.storeys,
  })).min(1)});
  return promptCache??=instructions+JSON.stringify(z.toJSONSchema(v3PlanFirstDesignSchema.extend({plan:authoring}),{io:'input'}));
}

const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const STAIR_REPAIR=new Set(['CIRCULATION_NOT_USABLE','CIRCULATION_OUTSIDE_HOST','STAIR_APPROACH_UNSUPPORTED','STAIR_ACCESS_BLOCKED','STAIR_OPENING_BLOCKED']);
const ROUTE_REPAIR=new Set(['ESTATE_ROUTE_BLOCKED','ESTATE_POOL_CROSSING','ESTATE_ACCESS_DISCONNECTED']);

/** Narrow existing objective-repair budget: no missing program/roof/amenity/layout is ever invented. */
function repairTargets(bp:{verticalCirculation:V3ArchitecturalBlueprint['verticalCirculation'];connections:{id:string;surfaceId:string}[]},findings:V3BlueprintFinding[]) {
  const stairs=new Set<string>(),routes=new Set<string>();
  for(const f of findings.filter(f=>f.severity==='fatal')){
    if(f.code==='BLUEPRINT_VERTICAL')continue; // checked below against a diagnosed unusable stair in that host
    const stair=STAIR_REPAIR.has(f.code)&&bp.verticalCirculation.find(c=>f.targetIds.includes(c.id));
    const route=ROUTE_REPAIR.has(f.code)&&bp.connections.find(c=>f.targetIds.includes(c.id)||f.targetIds.includes(c.surfaceId));
    if(stair)stairs.add(stair.id);else if(route)routes.add(route.id);else return;
  }
  if(findings.some(f=>f.severity==='fatal'&&f.code==='BLUEPRINT_VERTICAL'&&!bp.verticalCirculation.some(c=>stairs.has(c.id)&&f.targetIds.includes(c.hostMassId))))return;
  return stairs.size||routes.size?{stairs,routes}:undefined;
}

export function assessV3ArchitecturalBlueprintRepair(before:unknown,after:unknown,findings:V3BlueprintFinding[]):boolean {
  const initial=v3ArchitecturalBlueprintSchema.safeParse(before),next=v3ArchitecturalBlueprintSchema.safeParse(after);
  if(!initial.success||!next.success)return false;
  const a=normalizeArchitecturalBlueprintIdentities(initial.data),b=normalizeArchitecturalBlueprintIdentities(next.data);
  if([...a.findings,...b.findings].some(f=>f.severity==='fatal'))return false;
  const beforeBlueprint=a.blueprint,afterBlueprint=b.blueprint;
  const targets=repairTargets(beforeBlueprint,findings);if(!targets)return false;
  const strip=(bp:V3ArchitecturalBlueprint)=>({...bp,
    verticalCirculation:bp.verticalCirculation.map(c=>{if(!targets.stairs.has(c.id))return c;const {footprint,stairType,direction,turn,...protectedFields}=c;void footprint;void stairType;void direction;void turn;return protectedFields;}),
    connections:bp.connections.map(c=>{if(!targets.routes.has(c.id))return c;const {waypoints,...protectedFields}=c;void waypoints;return protectedFields;}),
  });
  return stable(strip(beforeBlueprint))===stable(strip(afterBlueprint));
}

export interface V3ArchitecturalAuthorRequest { repair?:{blueprint:unknown;findings:V3BlueprintFinding[];planFirst?:unknown}; }
export interface V3ArchitecturalAuthorResponse { output:unknown; finishReason?:string; }
export interface V3ArchitecturalStage { stage:'plan'|'massing'|'exterior'; scene:V3Scene; findings:V3BlueprintFinding[]; }
export interface V3ArchitecturalGenerationResult { ok:boolean; attempts:number; phase:'planning'|'construction'|'brief'|'repair'|'output'; findings:V3BlueprintFinding[]; scene?:V3Scene; planningScene?:V3Scene; outcome?:'complete'|'draft'|'cannot-construct'; }
export interface V3ArchitecturalAttempt {
  attempt: 0|1; rawBlueprint: unknown; normalizedBlueprint?: V3ArchitecturalBlueprint;
  identityChanges: ArchitecturalIdentityChange[]; findings: V3BlueprintFinding[];
  decision: 'accepted'|'repair-requested'|'rejected';
}

/** One authoring call; ONLY the existing one bounded objective follow-up, never an elaboration call. */
export async function generateV3FromArchitecturalBlueprint(brief:string,author:(request:V3ArchitecturalAuthorRequest)=>Promise<V3ArchitecturalAuthorResponse>,options:{onAttempt?:(attempt:V3ArchitecturalAttempt)=>void|Promise<void>;allowRepair?:boolean;requirePlanFirst?:boolean;onStage?:(stage:V3ArchitecturalStage)=>void|Promise<void>}={}):Promise<V3ArchitecturalGenerationResult>{
  // Known explicit capability gaps must not disappear merely because a model omits
  // them from its requirement ledger. This bounded vocabulary is not general NLU.
  const unsupported=[...brief.matchAll(/\b(mansard|gambrel|sawtooth|barrel[- ]vault|dome|hyperbolic)\b/gi)].filter(m=>! /\b(no|not|without|exclude|excluding|avoid)\s+(?:\w+\s+){0,3}$/i.test(brief.slice(Math.max(0,m.index!-50),m.index)));
  if(unsupported.length)return {ok:false,attempts:0,phase:'brief',findings:unsupported.map(m=>({code:'ARCHITECTURAL_BRIEF_CAPABILITY',severity:'fatal',targetIds:['brief'],message:`Requested ${m[0]} architecture has no supported construction in this blueprint contract. Preserve the decision; no substitute is generated.`}))};
  let repair:V3ArchitecturalAuthorRequest['repair'];
  for(let attempts=1;attempts<=2;attempts++){
    const result=await author({repair});
    let planIdentityChanges:ArchitecturalIdentityChange[]=[];
    const observe=async(findings:V3BlueprintFinding[],decision:V3ArchitecturalAttempt['decision'],plan?:V3ArchitecturalPlanningResult)=>{
      await options.onAttempt?.({attempt:(attempts-1) as 0|1,rawBlueprint:structuredClone(result.output),normalizedBlueprint:plan?.blueprint?structuredClone(plan.blueprint):undefined,identityChanges:structuredClone([...planIdentityChanges,...(plan?.identityChanges??[])]),findings:structuredClone(findings),decision});
    };
    if(result.finishReason!==undefined&&result.finishReason!=='stop'){
      const findings:V3BlueprintFinding[]=[result.finishReason==='length'?{code:'V3_OUTPUT_TRUNCATED',severity:'fatal',targetIds:['blueprint'],message:'Blueprint reached its output limit; no incomplete design is constructed or retried.'}:{code:'ARCHITECTURAL_OUTPUT_INCOMPLETE',severity:'fatal',targetIds:['blueprint'],message:'Provider did not complete blueprint authoring normally; no candidate is constructed or retried.'}];
      await observe(findings,'rejected');return {ok:false,attempts,phase:'output',findings};
    }
    let output=result.output;
    let planningScene:V3Scene|undefined;
    const isPlanFirst=!!output&&typeof output==='object'&&(output as {format?:unknown}).format==='v3-plan-first-1';
    if(isPlanFirst&&repair?.planFirst){
      const before=v3PlanFirstDesignSchema.safeParse(repair.planFirst),after=v3PlanFirstDesignSchema.safeParse(output);
      const targets=before.success?repairTargets(before.data.plan,repair.findings):undefined;
      const strip=(d:import('./architecturalPlanFirst').V3PlanFirstDesign)=>({...d,plan:{...d.plan,
        verticalCirculation:d.plan.verticalCirculation.map(c=>{if(!targets?.stairs.has(c.id))return c;const {footprint,stairType,direction,turn,...rest}=c;void footprint;void stairType;void direction;void turn;return rest;}),
        connections:d.plan.connections.map(c=>{if(!targets?.routes.has(c.id))return c;const {waypoints,...rest}=c;void waypoints;return rest;})}});
      if(!before.success||!after.success||!targets||stable(strip(before.data))!==stable(strip(after.data))){
        const findings:V3BlueprintFinding[]=[{code:'ARCHITECTURAL_REPAIR_SCOPE',severity:'fatal',targetIds:['plan'],message:'Repair changed protected plan or exterior decisions.'}];
        await observe(findings,'rejected');return {ok:false,attempts,phase:'repair',findings};
      }
    }
    if(isPlanFirst){
      // Validate the independent PLAN before inspecting exterior decisions or compiling anything.
      const document=output as {plan?:unknown;exterior?:unknown};
      const expanded=expandPlanAuthoring(document.plan);
      if(!expanded.success){const findings:V3BlueprintFinding[]=expanded.error.issues.map(i=>({code:'PLAN_INPUT',severity:'fatal',targetIds:[i.path.join('.')],message:i.message}));await observe(findings,'rejected');return {ok:false,attempts,phase:'planning',findings};}
      const hasRoomIntent='roomPlanning' in expanded&&expanded.roomPlanning.requests.length>0;
      const stage=hasRoomIntent?preparePlanEvaluation(document.plan):prepareV3ArchitecturalPlan(expanded.data);
      if(Array.isArray(stage.scene?.metadata.roomLayoutDrafts)&&stage.scene.metadata.roomLayoutDrafts.length){
        planningScene=stage.scene;
        await observe(stage.findings,'rejected');
        return {ok:false,attempts,phase:'planning',findings:stage.findings,planningScene};
      }
      planIdentityChanges=stage.identityChanges??[];
      planningScene=stage.scene;
      if(stage.scene)await options.onStage?.({stage:'plan',scene:structuredClone(stage.scene),findings:structuredClone(stage.findings)});
      if(!stage.ok){
        const canRepair=options.allowRepair!==false&&attempts===1&&stage.plan&&!!repairTargets(stage.plan,stage.findings);
        await observe(stage.findings,canRepair?'repair-requested':'rejected');
        if(canRepair){repair={blueprint:stage.plan,findings:stage.findings,planFirst:structuredClone(result.output)};continue;}
        return {ok:false,attempts,phase:'planning',findings:stage.findings,planningScene};
      }
      const massing=constructV3PlanMassing(stage)!;
      await options.onStage?.({stage:'massing',scene:structuredClone(massing.scene),findings:structuredClone(stage.findings)});
      const envelope=v3PlanFirstDesignSchema.safeParse({...output as object,plan:stage.plan});
      if(!envelope.success){
        const findings:V3BlueprintFinding[]=envelope.error.issues.map(i=>({code:'PLAN_FIRST_INPUT',severity:'fatal',targetIds:[i.path.join('.')],message:i.message}));
        await observe(findings,'rejected');return {ok:false,attempts,phase:'construction',findings,planningScene};
      }
      const exterior=elaborateV3ArchitecturalPlan(stage,envelope.data.exterior);
      if(!exterior.blueprint){await observe(exterior.findings,'rejected');return {ok:false,attempts,phase:'construction',findings:exterior.findings,planningScene};}
      output=exterior.blueprint;
    } else if(options.requirePlanFirst){
      const findings:V3BlueprintFinding[]=[{code:'PLAN_FIRST_REQUIRED',severity:'fatal',targetIds:['plan'],message:'New generation requires a separately authored 2D plan followed by host-relative exterior decisions. Legacy complete blueprints remain available for offline recovery only.'}];
      await observe(findings,'rejected');return {ok:false,attempts,phase:'planning',findings};
    }
    if(repair&&!repair.planFirst&&!assessV3ArchitecturalBlueprintRepair(repair.blueprint,output,repair.findings)){
      const findings:V3BlueprintFinding[]=[{code:'ARCHITECTURAL_REPAIR_SCOPE',severity:'fatal',targetIds:['blueprint'],message:'Repair changed protected design decisions. No scene is returned.'}];
      await observe(findings,'rejected');return {ok:false,attempts,phase:'repair',findings};
    }
    const plan=planV3ArchitecturalBlueprint(output,{buildFirst:true});
    const built=plan.approval?constructV3ArchitecturalBlueprint(plan.approval):undefined;
    const phase=built?'construction' as const:'planning' as const,findings=[...plan.findings,...(built?.findings??[])];
    const parsed=v3ArchitecturalBlueprintSchema.safeParse(plan.blueprint??output);
    const canRepair=options.allowRepair!==false&&attempts===1&&parsed.success&&!!repairTargets(parsed.data,findings)&&!built?.ok;
    // Retain each original attempt before any follow-up can replace it. Observers
    // receive copies and cannot mutate approved architecture or repair input.
    if(built?.ok&&built.scene){
      // Reuse independent brief review, without granting it another creative revision call.
      const review=reviewV3Architecture(built.scene,{brief});
      const missing=review.diagnostics.filter(d=>d.code==='MISSING_REQUESTED_FEATURE'||d.code==='UNSUPPORTED_ARCHITECTURAL_INTENT');
      if(missing.length){
        const rejected=[...findings,...missing.map(d=>({code:d.code,severity:'fatal' as const,targetIds:d.targetIds,message:d.message}))];
        await observe(rejected,'rejected',plan);return {ok:false,attempts,phase:'brief',findings:rejected,planningScene};
      }
      if(planningScene&&!sameArchitecturalPlan(planningScene,built.scene)){
        const drift:V3BlueprintFinding[]=[{code:'PLAN_CONSTRUCTION_DRIFT',severity:'fatal',targetIds:['plan'],message:'Construction changed the accepted 2D layout.'}];
        await observe(drift,'rejected',plan);return {ok:false,attempts,phase:'construction',findings:drift,planningScene};
      }
      if(planningScene){
        built.scene.metadata.designPipeline={format:'v3-plan-first-1',stage:'exterior',authority:'v3-semantic-plan',sequence:['plan','massing','exterior']};
        await options.onStage?.({stage:'exterior',scene:structuredClone(built.scene),findings:structuredClone(findings)});
      }
      await observe(findings,'accepted',plan);
      return {ok:true,attempts,phase,findings,scene:built.scene,planningScene,outcome:built.outcome??'complete'};
    }
    await observe(findings,canRepair?'repair-requested':'rejected',plan);
    if(!canRepair||!parsed.success)return {ok:false,attempts,phase,findings,planningScene};
    repair={blueprint:structuredClone(parsed.data),findings:findings.filter(f=>f.severity==='fatal'),...(isPlanFirst?{planFirst:structuredClone(result.output)}:{})};
  }
  throw new Error('Unreachable bounded blueprint attempt.');
}
