/** Opt-in 2D evaluation. The saved V3 scene is the only geometry authority. */
import { z } from 'zod';
import { expandPlanAuthoring, v3PlanAuthoringSchema, v3RelationshipPlanAuthoringSchema } from './architecturalPlanAuthoring';
import type { V3Scene } from './scene';
import { checkoutV3ArchitecturalBlueprint } from './architecturalBlueprint';
import { type V3PlanStage, prepareV3ArchitecturalPlan, sameArchitecturalPlan, splitV3ArchitecturalBlueprint, v3ArchitecturalExteriorSchema } from './architecturalPlanFirst';
import type { UnresolvedPlanItem } from './planRecovery';
import { ARCHITECTURAL_DESIGN_PROCESS, RELATIONSHIP_FIRST_ROOM_GUIDANCE } from './architecturalDesignGuidance';
import { roomLayoutSchema, roomSizeIntentSchema, type RoomLayoutDraft } from './roomLayout';

export const PLAN_EVALUATION_MAX_OUTPUT_TOKENS = 10_000;
export const DEFAULT_PLAN_EXTERIOR_REQUEST = 'Develop this exact saved 2D estate into a complete, coherent exterior. Use the saved concept, requirements and any retained original brief. Choose all deferred roofs, facade materials, glazing, shading, feature heights and stair flight details with your architectural judgment. Preserve every authored plan dimension, location, boundary, room zone, entrance and route.';
export const isV3PlanEvaluation = (scene:V3Scene) => scene.metadata.planEvaluation === true && (scene.metadata.designPipeline as {stage?:string}|undefined)?.stage === 'plan';
/** Objects withheld from the draft because a local defect made them unrepresentable. */
export const unresolvedPlanItems = (scene:V3Scene):UnresolvedPlanItem[] => Array.isArray(scene.metadata.planUnresolved)?scene.metadata.planUnresolved as UnresolvedPlanItem[]:[];
export const planEvaluationEnabled = () => process.env.AI_V3_PLAN_EVALUATION === '1';

export function preparePlanEvaluation(raw:unknown):V3PlanStage {
  const expanded=expandPlanAuthoring(raw);
  if(!expanded.success)return {ok:false,findings:expanded.error.issues.map(i=>({code:'PLAN_INPUT',severity:'fatal' as const,targetIds:[i.path.join('.')],message:i.message}))};
  const result=prepareV3ArchitecturalPlan(expanded.data,{circulationReservations:true,recover:true});
  const development='roomPlanning' in expanded?expanded.roomPlanning:undefined;
  if(development&&result.scene){
    // A geometric subdivision can still strand rooms or miss its fixed entrance.
    // Keep those developed rectangles editable, but do not call them resolved.
    for(const request of development.requests.filter(r=>development.developed.includes(r.storeyId))){
      const host=expanded.data.buildings.find(b=>b.storeys.some(s=>s.id===request.storeyId));
      const ground=host?.storeys[0].id===request.storeyId;
      const access=result.findings.filter(f=>['PLAN_ROOM_ACCESS_UNVERIFIED','PLAN_ENTRY_ROOM_GAP','PLAN_ENTRY_ROOM_MISMATCH'].includes(f.code)
        && f.targetIds.some(id=>id===request.storeyId||request.spaces.some(r=>r.id===id)||ground&&id===host?.id));
      if(access.length){
        const why=access.map(f=>({...f,code:'ROOM_LAYOUT_UNRESOLVED',targetIds:[request.storeyId,...f.targetIds],message:`Room organization needs an explicit access decision. ${f.message}`}));
        development.drafts.push({...structuredClone(request),findings:why});development.findings.push(...why);
      }
    }
  }
  if(development)result.findings.push(...development.findings);
  if(result.scene){
    result.scene.metadata={...result.scene.metadata,planEvaluation:true,planDiagnostics:result.findings,
      ...(development?{roomLayoutDrafts:development.drafts,roomLayoutDevelopment:{version:1,storeyIds:development.developed}}:{})};
  }
  return result;
}

/** Lossless checkout from CURRENT persisted semantics; no stale input-plan snapshot. */
export function checkoutPlanEvaluation(scene:V3Scene):V3PlanStage {
  const exported=checkoutV3ArchitecturalBlueprint(scene,{planOnly:true});
  if(!exported.blueprint)return {ok:false,findings:exported.findings};
  const plan=splitV3ArchitecturalBlueprint(exported.blueprint).plan;
  const deferred=scene.metadata.planDeferredFeatureHeights;
  if(Array.isArray(deferred))for(const f of plan.features)if(deferred.includes(f.id))delete f.height;
  // Withheld objects stay in the editable plan exactly as authored, so a later edit can correct them.
  for(const item of unresolvedPlanItems(scene)){
    if(item.kind==='connection')plan.connections.push(structuredClone(item.raw) as typeof plan.connections[number]);
    else if(item.kind==='feature')plan.features.push(structuredClone(item.raw) as typeof plan.features[number]);
    else plan.roomAdjacencies.push(structuredClone(item.raw) as typeof plan.roomAdjacencies[number]);
  }
  const checked=preparePlanEvaluation(plan);
  if(checked.scene&&!sameArchitecturalPlan(scene,checked.scene))return {ok:false,findings:[{code:'PLAN_CHECKOUT_LOSS',severity:'fatal' as const,targetIds:['plan'],message:'Current scene contains decisions outside the supported plan contract; the saved design was preserved.'}]};
  // Unresolved intent is a draft attachment, never a second source of room
  // coordinates. Checkout/reload must not rerun it over subsequent manual edits.
  if(checked.scene&&Array.isArray(scene.metadata.roomLayoutDrafts)){
    checked.scene.metadata.roomLayoutDrafts=structuredClone(scene.metadata.roomLayoutDrafts);
    const drafts=scene.metadata.roomLayoutDrafts as {findings?:V3PlanStage['findings']}[];
    checked.findings.push(...drafts.flatMap(d=>d.findings??[]));
    checked.scene.metadata.planDiagnostics=checked.findings;
  }
  return checked;
}

/** Explicit editor action, never a reload-time recipe replay. The current scene
 * supplies every other floor, shell, entry and route. Successful room geometry
 * replaces only this storey's intent; failed intent remains editable. */
export function reviseDraftRoomLayout(scene:V3Scene,storeyId:string,raw:unknown):V3PlanStage {
  const requestSchema=z.object({layout:roomLayoutSchema,spaces:z.array(v3PlanAuthoringSchema.shape.buildings.element.shape.storeys.element.shape.spaces.element.extend({id:z.string(),size:roomSizeIntentSchema.optional()})).min(1)}).strict();
  const parsed=requestSchema.safeParse(raw);
  if(!parsed.success)return {ok:false,findings:parsed.error.issues.map(i=>({code:'PLAN_INPUT',severity:'fatal',targetIds:[storeyId,i.path.join('.')],message:i.message}))};
  const current=checkoutPlanEvaluation(scene);
  if(!current.ok||!current.plan)return current;
  const plan=structuredClone(current.plan),storey=plan.buildings.flatMap(b=>b.storeys).find(s=>s.id===storeyId);
  if(!storey)return {ok:false,findings:[{code:'PLAN_INPUT',severity:'fatal',targetIds:[storeyId],message:'Unknown storey.'}]};
  Object.assign(storey,parsed.data);
  const next=preparePlanEvaluation(plan);
  if(next.scene){
    const retained=Array.isArray(scene.metadata.roomLayoutDrafts)?(scene.metadata.roomLayoutDrafts as RoomLayoutDraft[]).filter(d=>d.storeyId!==storeyId):[];
    const drafts=[...retained,...(next.scene.metadata.roomLayoutDrafts as RoomLayoutDraft[]??[])];
    next.findings.push(...retained.flatMap(d=>d.findings));
    next.scene.metadata={...scene.metadata,...next.scene.metadata,roomLayoutDrafts:drafts,planDiagnostics:next.findings};
  }
  return next;
}

export function planEvaluationPrompt() {
  return `You are Terra, the architect. Design an estate master plan and conceptual floor layouts from the brief. Return ONLY a v3-architectural-plan-1 JSON document matching the schema below.
${ARCHITECTURAL_DESIGN_PROCESS}
${RELATIONSHIP_FIRST_ROOM_GUIDANCE}
Coordinates are metres: north=-z, x/z are CENTRES, building/feature locations are world-space, room/stair rectangles are host-local; rotationY is radians. Rectangle, articulated recess/projection/notch/chamfer and connected line/arc outlines are supported. Outline startAngle/sweep are degrees; openings address segmentId on outlines, facade otherwise, with start/end fractions 0..1. L/U/H plans can use concave line outlines or articulated operations. Frame enclosed courts with separate connected wings: a single outline has no holes. Openings on touching connected volumes need explicit usable exterior access; do not assume a relationship cuts a doorway. No splines or overlapping curved mass unions. Room rectangles are conceptual zones inside the chosen shell, not detailed partitions.
Each building needs a ground door/glazed-door in accessOpenings. A connection's entranceId may name that opening ID (unique across buildings); do not repeat entrances in a separate table. Connections otherwise reference site-access IDs or local contacts on named dry features. Choose route width/use and any bends to avoid buildings/water. V3 derives route owners, endpoint world coordinates, roof IDs, storey/room IDs and building program records. Omit repeated role text. For touching rectilinear wings, relationships may declare connects. Give separate volumes deliberately different storey counts when appropriate; per-storey operations can target ground/upper articulated outlines. Declare roomAdjacencies for important same-floor access and verify their actual shared edges. Requirements record actual user obligations separately from design choices; omit empty ledgers.
Reserve stair/lift location, host and connected levels for multi-storey layouts; detailed flight fit, treads, landings and headroom are later construction decisions. Storey height may be omitted for the schematic default 3.6m, door height for 2.4m, baseElevation/rotationY for 0. These explicit defaults remain editable before construction. Feature types: terrace (fully paved plazas/decks/motor courts), courtyard (a paved perimeter around an open garden), pool, fountain (basin with a central water jet), landscape-zone (lawns/gardens), path, driveway, canopy. Features can use footprint:{kind:"outline",operations:[],segments:[...]} for circles, arcs and polygons within their width/depth envelope; these boundaries now construct in 3D for terrace/courtyard/pool/fountain/landscape-zone/path/driveway. A circle is one arc with center:[0,0],radius:r,startAngle:0,sweep:360 and width/depth >=2r. Keep the fountain origin inside its basin. Basin and courtyard offsets need room for a .22m inset with no folded narrow necks. Canopies remain rectangular; use several rectangular covers or later supported host facade assemblies. Place a fountain/pool within paving to create an island: water basins cut out the intersecting paving in construction; do not route a driveway centreline through water. For an exact curved connection, supply path:[line/arc segments] in WORLD x/z metres continuously from its named from contact to to contact, with waypoints:[] and no approachDistance; arc radius must exceed half the route width by .1m. Otherwise waypoints define straight segments only. A closed circular motor-court surface may use a circular driveway footprint with a separate fountain island; access connections still carry their own endpoints. For every feature the boundary is authoritative; its label never creates geometry. Omit feature height when vertical design is undecided; no pool excavation/slab bookkeeping.
Keep geometry inside the flat site and references resolvable. Defer roofs, finishes, facade assemblies and detailed interiors. No meshes, runtime arrays, V2 or terrain changes. One response, no repair call. Schema:\n${JSON.stringify(z.toJSONSchema(v3RelationshipPlanAuthoringSchema,{io:'input',reused:'ref'}))}`;
}
export function planExteriorPrompt() {
  return `You are Terra, the architect developing the exact saved V3 estate plan into a beautiful, complete exterior for V3 to construct. Return ONLY the exterior document matching this schema. Address every existing building/feature/connection ID exactly once. The saved plan is your design source, not an invitation to generate a new house.
${ARCHITECTURAL_DESIGN_PROCESS}
Develop the plan's spatial concept, requirements and retained original brief into coherent roof proportions, facade depth, glazing, shade and materials; consider arrival eye level, privacy and outdoor living. You are delegated all genuinely deferred exterior decisions. No additional user specifications are required. Honor optional exterior preferences when compatible with the plan. If a brief or preference conflicts with approved geometry, preserve the plan.
FEATURE HEIGHTS: supply features[].height for every feature whose saved height is absent. This is a new vertical construction decision, not the thin runtime drawing proxy. Preserve explicit saved heights and all x/z locations, base elevations, widths, depths, rotations and footprints. Use terrace/path/driveway thicknesses appropriate for paving, grass thickness at least .12m, courtyard thickness at least .14m, and canopy height at least 2.2m. Courtyard paving uses #b8ad98 with roughness .74; grass uses roughness .9. Pool/fountain baseElevation + height is the rim datum, not excavation depth; coordinate the rim with the saved poolside paving datums. Do not change a saved datum to accommodate a chosen height. Never invent equipment, trees or furnishings unsupported by the contract.
ROOFS AND FACADES: choose one host-derived roof per reserved identity. Flat/floating-flat/terrace pitch is 0; pitched forms use degrees. Nonrectangular hosts support flat/floating-flat/terrace/mono-pitch. Openings must fit actual wall segments and storey heights without overlap; outline hosts need segmentId. Never repeat planned accessOpenings in facade.openings. Host-relative slab/post/beam/railing assemblies may develop shade, entries and balconies; balcony access needs an existing or additional door on its level. No independent roof coordinates or generic replacement masses.
For stairs without flight decisions, supply verticalCirculation entries with the existing reservation ID and stairType/direction/turn as needed for a usable flight WITHIN its exact rectangle; preserve any explicit flight decisions. No detailed interior design is required: leave partitions and doors empty. Do not change or add plan locations, footprints, authored heights, room zones, entrances, circulation reservations/hosts/levels, site features, requirements or identities. If the design cannot be developed faithfully, do not substitute geometry. One response; no repair call. Schema:\n${JSON.stringify(z.toJSONSchema(v3ArchitecturalExteriorSchema,{io:'input'}))}`;
}
