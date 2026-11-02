import { z } from 'zod';
import { compileBuilding, DesignConflict, type BuildingIntent, type Point } from '../experimental/semantic-building/compiler';
import { coverOf, type Cover } from '../experimental/semantic-building/vertical';
import { isMassAnchor, massMembers, boundsOf, massAnchorProblem } from './massAnchor';
import { locate, resolveLayout, rootSpaces, type Rect } from './layout';
import { coordinatePlan } from './spatial';
import { placePortals, exposedFascia, fasciaSides, roofFootprints, ELEMENT_EDGE, FASCIA_DEPTH, FASCIA_THICKNESS, type Side } from './coordination';
import { sceneTerrainSchema, elementSchema, validateScene, type SceneElement } from '../scene/model';
const id=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const dimension=z.number().finite().positive().max(100);
const material=z.enum(['ivory','limestone','timber','bronze','sage']);
export const isNewGeneration=(mode:unknown):boolean=>mode==='generate';
const placement=z.object({relativeTo:id.nullable(),side:z.enum(['origin','north','east','south','west','same']),alignment:z.enum(['start','centre','end']),gap:z.number().finite().min(0).max(50)}).strict();
/** A declared architectural relationship that software verifies against the resolved arrangement (never repairs):
 * separate = minimum clear plan distance between two wings/spaces/site items (privacy, acoustics, view);
 * adjoin = the two share at least `amount` metres of wall on one level (a real connection is possible);
 * enclose = at least fraction `amount` (0..1) of an outdoor space's perimeter is bounded by interior rooms (a court is enclosed, not merely near). */
export const constraintSchema=z.object({id,kind:z.enum(['separate','adjoin','enclose']),a:id,b:id.optional(),amount:z.number().finite().min(0).max(100),reason:z.string()}).strict();
export type ArchitecturalConstraint=z.infer<typeof constraintSchema>;
/** No authored component coordinates, polygon arrays, slab datums or riser counts. */
export const architecturalPlanSchema=z.object({
 version:z.literal('architectural-plan-1'),id,thesis:z.string().min(1),orientation:z.number().finite(),
 site:sceneTerrainSchema,
 levels:z.array(z.object({id,above:id.nullable(),rise:dimension}).strict()).min(1).max(12),
 masses:z.array(z.object({id,role:z.string(),relatesTo:id.optional(),placement:placement.optional()}).strict()).min(1).max(100),
 spaces:z.array(z.object({id,mass:id,level:id,use:z.string(),width:dimension,depth:dimension,height:dimension.optional(),outdoor:z.boolean(),facadeMaterial:material.optional(),placement}).strict()).min(1).max(200),
 portals:z.array(z.object({id,host:z.object({space:id,side:z.enum(['south','east','north','west','shared','exposed'])}).strict(),to:id,alignment:z.enum(['start','centre','end']),width:dimension,height:dimension,mode:z.enum(['door','open','window']),sill:z.number().finite().min(0).max(8).optional()}).strict()).max(300),
 stairs:z.array(z.object({id,lower:id,upper:id,width:dimension,run:dimension,landing:dimension,headroom:dimension}).strict()).max(20),
 arrival:id,
 roofs:z.array(z.object({space:id,form:z.enum(['flat','gable','hip']),rise:z.number().finite().min(.18).max(8).optional(),overhang:z.number().finite().min(0).max(3).optional(),material:material.optional()}).strict()).max(200),
 screens:z.array(z.object({id,space:id,side:z.enum(['south','east','north','west']),alignment:z.enum(['start','centre','end']),width:dimension,height:dimension,sill:z.number().finite().min(0).max(8),standOff:z.number().finite().min(.15).max(3),depth:z.number().finite().min(.07).max(.5),panels:z.number().int().min(2).max(40),material}).strict()).max(60).optional(),
 terraces:z.array(id).max(100),
 pools:z.array(z.object({id,placement,width:dimension,depth:dimension,waterDepth:z.number().min(.3).max(3),level:id}).strict()).max(10),
 landscape:z.array(z.object({id,kind:z.enum(['lawn','bed']),placement,width:dimension,depth:dimension}).strict()).max(100),
 constraints:z.array(constraintSchema).max(40).optional(),
 materials:z.object({floor:material,wall:material,roof:material}).strict(),
 cameraViews:z.array(z.enum(['Aerial','Arrival','Garden','Poolside'])).length(4),
}).strict();
export type ArchitecturalPlan=z.infer<typeof architecturalPlanSchema>;
/** Compiler-derived vertical facts per space; never authored, never serialized into the plan. */
export type VerticalEvidence={id:string;level:string;height:number;heightSource:'authored'|'derived:upper-datum'|'derived:storey-rise';cover:Cover};
export const canonicalProposalSchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('proposed'),plan:architecturalPlanSchema,limitations:z.array(z.string())}).strict(),
 z.object({status:z.literal('decision-required'),decisions:z.array(z.string()).min(1)}).strict(),
]);
export const CANONICAL_INSTRUCTIONS=`ROLE AND ARCHITECTURAL MISSION
You are the principal residential architect of a world-class architectural practice, commissioned to design beautiful, original, sophisticated and buildable homes. Your responsibility is to create exceptional architecture that responds intelligently to each client's requirements, site, climate, context and aspirations. The brief is an architectural commission, not a checklist of rooms; express one coherent design vision through the entire building.
Architectural priorities:
1. Concept: establish a compelling, distinctive design idea for this commission; every major spatial and formal decision should support it.
2. Massing and composition: create deliberate relationships between volumes, wings, levels, rooflines, solid forms and open spaces, rather than assembling unrelated rectangular rooms.
3. Spatial experience: design a meaningful arrival sequence, an inviting entrance, impressive primary spaces, appropriate privacy and circulation, indoor-outdoor transitions and connections to the landscape.
4. Proportion and beauty: consider building proportions, facade rhythm, window placement, light, shadow, depth, material relationships and visual balance. Every elevation deserves architectural consideration.
5. Character: develop a design language suited to the client's preferences, location and budget. Luxury is quality, generosity, craftsmanship, refinement and spatial experience, not merely size.
6. Originality: avoid repetitive suites, generic corridors, interchangeable rectangular wings and uninspired arrangements; give each project its own identity.
7. Coherence and constructibility: develop relationships that can be represented and coordinated through the supported canonical building system, preserving circulation, accessibility, spatial compatibility and the client's mandatory requirements.
DESIGN FREEDOM: Symmetry, pitched roofs, multiple storeys, courtyards or any number of wings are not required. A restrained modern home can be exceptional, and so can a dramatic, complex estate. Choose the architecture the commission deserves, not the arrangement easiest to express in JSON. Do not add complexity merely to appear sophisticated, and do not simplify solely to avoid making architectural decisions; restraint must be a deliberate design choice.
RESPONSIBILITIES: You determine the vision, composition, spatial relationships, programme organisation, character and intended physical connections. Software derives supported geometry, coordinates declared relationships and validates physical constraints; it does not invent architectural excellence, decide missing relationships or repair incompatible decisions. Construction constraints are necessary conditions for architecture, not its objective. If the intended design needs unsupported capabilities or an ambiguous decision, report that explicitly rather than silently substituting an inferior building.
SELF-CHECK before returning: Is there a clear concept that answers this brief? Are wings, volumes and spaces meaningfully related? Are entrance and spatial sequence thoughtfully organised? Are proportions, facades, views, light and outdoor relationships considered? Is the design distinctive rather than generic or repetitive? Are declared relationships physically coherent and supported? Are all mandatory client requirements preserved? If the concept is ordinary, reconsider the architectural decisions before finalising.
OUTPUT CONTRACT
This is the sole new-house authoring path. Return architectural-plan-1 in a proposed plan or decision-required with unsupported choices. Never return scene operations, component coordinates, polygons, wall/slab/tread arrays, calculated world transforms, access-target lists or riser counts.
Choose a brief-specific architectural thesis, mass hierarchy, room uses and dimensions, privacy, levels, openings, circulation, terraces, pools, landscape, materials and camera views. Software owns placement coordinates, shared walls, cuts, matching doors, floors, roofs, stairs, collisions and evidence. Do not silently simplify or omit a requested feature.
Spaces are rectangular allocations. Choose one root space with placement relativeTo:null, side:origin, alignment:centre, gap:0. All other spaces refer to another space by relativeTo and side north (+Z), east (+X), south (-Z), west (-X), or same (stacked plan alignment). Alignment start/centre/end aligns the perpendicular dimension. gap is a selected design separation; connected rooms require gap:0 and a shared segment wide enough for the selected opening. References may be forward but must not cycle. Software centres the whole allocation on the site and applies orientation in radians.
Compose the building as WINGS first, then rooms inside each wing. Every entry of masses is a wing (a group of rooms that belong together: a living pavilion, a sleeping wing, a link, a court). A wing may carry its own placement {relativeTo, side, alignment, gap} that places the WHOLE wing by its envelope against another wing's envelope (relativeTo a wing id) or against one space: north/east/south/west put it beside the anchor, "same" stacks its envelope over the anchor's footprint, alignment start/centre/end aligns the perpendicular dimension of the two envelopes, gap is a selected separation (a detached pavilion has gap>0 and an outdoor landing). Rooms of a placed wing are arranged in that wing's own frame: exactly one room of it is the wing's local origin (relativeTo:null, side:origin, alignment:centre, gap:0) and every other room of the wing is placed against another room of the same wing; a room of a placed wing is never anchored outside its wing. Software arranges the rooms, takes the wing's envelope, and moves the wing as one rigid body to satisfy its placement, so you never calculate where a wing's corners or rooms land and resizing a room moves what is placed against its wing. Exactly one root space exists among wings without placement. A wing without placement keeps the older meaning: its rooms are placed individually (against rooms, or against a whole wing by relativeTo:<wing id>, never "same" against a wing). Reasoning room by room hides collisions: two wings placed on adjacent sides of one wing both claim its corner whenever each is longer than that wing along the other's axis, so choose alignment and gap for each wing deliberately. Nothing requires symmetry, a particular number of wings or levels, or any one circulation idiom; relate wings as the concept demands (shared wall, link wing, court between wings, stacked over, detached across a gap).
Optional constraints state relationships your concept depends on; software measures each on the resolved arrangement and rejects the plan if one is not met (it never moves anything): kind "separate" (a, b wings/rooms/site items: minimum clear plan distance in metres, for privacy or quiet), "adjoin" (a, b: minimum metres of shared wall on one level, so a connection is possible), "enclose" (a: a court or terrace; amount 0..1 is the share of its perimeter bounded by interior rooms). Give the reason. Declare only what the concept needs; contradictory declarations (separate and adjoin on one pair) are rejected.
Levels use above:null and rise from site elevation for the one ground datum, or above:<level id> and rise as floor-to-floor height. Space height is the envelope height and is normally omitted (null): the compiler derives it, to the floor datum of the level stacked above the space, otherwise to the rise of the next level, so never restate level rises. State height only for a deliberate departure with nothing stacked above (a roofed double-height room) or where no level above supplies a storey height (a single-storey house or a top storey). A stated height beyond the floor datum above it, and an open-to-above void beneath a stacked plan, are not expressible: use decision-required. Floor thickness reduces actual clear height. Every interior must be reachable from arrival. A space whose top is exposed needs a roof entry; a space wholly covered by spaces above must have none (the floor above is its cover); a space only partly covered by spaces above takes a roof entry and the compiler roofs just its exposed remainder (flat only, no overhang; a pitched roof against the taller wall above is not expressible, so give such a space a flat roof or keep the upper rooms wholly over or clear of it). Roofs are declared only in roofs, once per roofed space.
Portal host side selects a room edge; to must share a segment at the same level, or be exterior for an exposed fixed window (doors/passages require an explicit outdoor landing allocation). Alignment selects the opening at start, centre or end of that directed edge with software-owned margins. Edges run counter-clockwise: south edge west→east, east edge south→north, north edge east→west, west edge north→south, so on a north or west wall portal start is the east or north end, the opposite of room-placement alignment where start is always the west or south end. Instead of choosing the edge, host side "shared" (a door or open passage to a neighbouring room) makes software find the wall the two rooms share and place the opening inside that shared segment at start/centre/end of it, and host side "exposed" (a fixed window to the exterior) makes software use the room's one exterior wall run wide enough for it, refusing as ambiguous when several qualify. Prefer them: a connection is a relationship, not a coordinate. Software never infers a connection: every interior room, including each upper room, needs its own door or open passage to a neighbouring room, landing or circulation space that leads toward the arrival, in addition to the stair that reaches that landing; a wing may be entered directly from the room beside it, from a link wing, or across an outdoor landing. A window needs a wall exposed to the outside: a wall shared with a bath, hall, neighbouring room or terrace is not exterior, a room enclosed on every edge cannot have an exterior window or screen, and placing a room beside another changes that wall for every opening and screen already on it. Supported modes: door, open, fixed window. Only windows may have a nonzero sill. Multiple openings on an edge are allowed at distinct alignments with at least 0.36m piers; openings cannot cross a room junction. Fixed windows are not access. No independent door transforms.
Stairs connect matching lower and upper rectangular cells. The compiler centres the flight across the lower cell, starts after the south landing, derives risers from level rise, creates the upper void, and reserves a right-side bypass. Choose dimensions that fit the cells, keep lower roof absent and upper roof present. More complex stairs require decision-required.
Terraces refer to outdoor spaces. Pools and landscape use relative placement against a space, or against another pool or landscape item (for example a lawn beyond a pool; no cycles), in the building frame; the compiler owns world positions. Every pool and landscape item must lie within the site, which is centred on the room cells, so size the site for the pool and lawn as well as the house. Pools use a selected level top; landscape sits at site elevation. Pools include basin shell and water; landscape lawn/bed means ground surfaces, not planting. All four cameraViews must occur once: Aerial, Arrival, Garden, Poolside. Software chooses their poses.
Supported scope: flat site, rectangular room cells composed into asymmetric L/U arrangements with partial shared edges, multiple facade openings and elevated fixed windows, flat/gable/hip roofs with selected rise and uniform overhang, per-space facade materials, wall-relative editable slatted screens, the described straight stair, rectangular pools and lawn/bed surfaces. Roof rise defaults to 0.18m only for historical flat plans; select rise for pitched roofs (>=0.6m). Roof undersides meet space wall tops. Select stepped, separated roofs; intersecting roof bounds require decision-required, not automatic valleys. A gable or hip roof stays within its own room cell: a gable or hip may abut a neighbour of any height or roof form (flat or pitched), and its 0.1 m fascia boards are built only on edges no other room shares, so neighbouring rooms need no matching heights. Pitched roofs are not valid over a space that has a room stacked over part of it (no lean-to or valley junction: give that space a flat roof, or keep the upper rooms wholly over or wholly clear of it), and an overhang is valid only where nothing stands within its reach at the roof's height (over open ground, or over a neighbour whose wall top and roof lie below the roof underside); rooms never overlap, which no roof can repair. Screens require explicit side, alignment, width, height, sill, standOff, depth, panels and material; they must stand on an exposed facade (never a wall shared with another room) and must not obstruct a passable opening. Outdoor roofed spaces are verandas/canopies without invented columns. Unsupported requested polygonal/curved outlines, overlapping occupied cells, roof valleys/junctions, grading, trees/planting, arbitrary stairs, guards, engineering and full fit-out require decision-required. Never substitute a simpler house or claim a complete/premium home from an envelope. Disclose limitations.`;
/** Retrieved knowledge and shared concept guidance predate this contract and still speak of scene
 * operations and deferred interiors. Stated after them so the plan contract governs. */
export const CANONICAL_CONTEXT_PRECEDENCE=`
CONTRACT PRECEDENCE: Retrieved knowledge and guidance above may mention scene operations, parts, transforms or "exterior scope defers interior fit-out". Those phrases describe retired direct-scene authoring. Here only architectural-plan-1 applies: express every idea as masses, spaces, portals, stairs, roofs, screens, pools or landscape; plan the requested rooms as spaces; state anything unsupported as a limitation or decision-required. Precedence resolves contract conflicts only; it never lowers the architectural standard or overrides mandatory user requirements.
`;
export function isCanonicalPlan(value:unknown):boolean{return !!value&&typeof value==='object'&&'version' in value&&value.version==='architectural-plan-1';}
export { locate };
export type { Rect };
const fail=(message:string):never=>{throw new DesignConflict([message]);};
/** Resolve the model's selected dimensional relationships. Cycles and unsupported
 * layouts reject; there is no hidden packing, fallback template or repair. */
export function deriveBuildingIntent(raw:unknown){const parsed=architecturalPlanSchema.parse(raw);return derive(parsed);}
function derive(plan:ArchitecturalPlan){
 const tops=new Map<string,number>();
 if(rootSpaces(plan).length!==1)fail('Choose exactly one root space.');
 if(plan.levels.filter(l=>l.above===null).length!==1)fail('Choose exactly one ground level.');
 const resolveLevel=(key:string,active=new Set<string>()):number=>{
  if(tops.has(key))return tops.get(key)!;
  const l=plan.levels.find(l=>l.id===key);if(!l||active.has(key))return fail(`${key}: missing or cyclic level reference.`);
  active.add(key);const top=(l.above===null?plan.site.elevation:resolveLevel(l.above,active))+l.rise;tops.set(key,top);return top;
 };
 plan.levels.forEach(l=>resolveLevel(l.id));
 // One resolver for rooms and whole wings (layout.ts); an unresolvable relationship rejects with every reason.
 const layout=resolveLayout(plan),rects=layout.rects;
 if(layout.problems.length)throw new DesignConflict(layout.problems.map(q=>q.message));
 const all=[...rects.values()],x0=Math.min(...all.map(r=>r.x)),x1=Math.max(...all.map(r=>r.x+r.width)),z0=Math.min(...all.map(r=>r.z)),z1=Math.max(...all.map(r=>r.z+r.depth));
 const c=Math.cos(plan.orientation),s=Math.sin(plan.orientation),cx=(x0+x1)/2,cz=(z0+z1)/2;
 const world=(p:Point):Point=>[c*(p[0]-cx)+s*(p[1]-cz),-s*(p[0]-cx)+c*(p[1]-cz)];
 const origin=world([0,0]);
 const polygons=new Map(plan.spaces.map(space=>{const r=rects.get(space.id)!;return [space.id,[[r.x,r.z],[r.x+r.width,r.z],[r.x+r.width,r.z+r.depth],[r.x,r.z+r.depth]] as Point[]];}));
 const verticals=plan.spaces.map(space=>({id:space.id,level:space.level,polygon:polygons.get(space.id)!}));
 const levelTop=(id:string)=>tops.get(id)??fail(`${id}: missing level.`);
 const vertical:VerticalEvidence[]=[];
 const spaces=plan.spaces.map(space=>{
  const cover=coverOf(verticals.find(v=>v.id===space.id)!,verticals,levelTop),own=levelTop(space.level);
  let height=space.height,source:VerticalEvidence['heightSource']='authored';
  if(height===undefined){
   const stacked=cover.datum,storeys=plan.levels.filter(l=>l.above===space.level);
   if(stacked!==undefined){height=stacked-own;source='derived:upper-datum';}
   else if(storeys.length===1){height=storeys[0].rise;source='derived:storey-rise';}
   else fail(`${space.id}: height is required: nothing is stacked above it and ${storeys.length?'several levels sit above its level':'no level above its level supplies a storey height'}. State the envelope height (for example a deliberate double-height or the top storey).`);
  }
  vertical.push({id:space.id,level:space.level,height:height!,heightSource:source,cover});
  return {...space,height:height!,material:space.facadeMaterial,polygon:polygons.get(space.id)!,roof:plan.roofs.some(roof=>roof.space===space.id)};
 });
 const placements=placePortals({spaces:plan.spaces,portals:plan.portals,stairs:plan.stairs},Object.fromEntries(rects));
 const intent:BuildingIntent={version:'semantic-pilot-1',id:plan.id,thesis:plan.thesis,frame:{origin,yaw:plan.orientation},levels:plan.levels.map(l=>({id:l.id,top:tops.get(l.id)!})),masses:plan.masses,spaces,
 portals:plan.portals.map(p=>{
  const placed=placements.get(p.id);
  if(!placed)return fail(`${p.id}: missing opening host.`);
  if(placed.problem!==undefined)return fail(`${p.id}: ${placed.problem}`);
  const edge={south:0,east:1,north:2,west:3}[placed.side];
  return {...p,host:{space:p.host.space,edge},offset:placed.centre};}),
 stairs:plan.stairs.map(st=>{const r=rects.get(st.lower)??fail(`${st.id}: missing lower stair room.`),lower=spaces.find(s=>s.id===st.lower),upper=spaces.find(s=>s.id===st.upper);const rise=Number(tops.get(upper?.level??''))-Number(tops.get(lower?.level??''));return {...st,start:[r.x+r.width/2,r.z+st.landing+.1] as Point,risers:Math.ceil((rise-1e-8)/.18),bypass:'right' as const};}),arrival:plan.arrival,requiredAccess:spaces.filter(s=>!s.outdoor).map(s=>s.id)};
 // A pool or landscape item is anchored to a space or to another pool/landscape item (ids are unique across
 // all entity types, so a reference is unambiguous). Chains resolve recursively; a cycle or unknown id rejects.
 type SiteItem=ArchitecturalPlan['pools'][number]|ArchitecturalPlan['landscape'][number];
 const siteDefs=new Map<string,SiteItem>([...plan.pools,...plan.landscape].map(item=>[item.id,item]));
 const siteRects=new Map<string,Rect>();
 const resolveSite=(item:SiteItem,active=new Set<string>()):Rect=>{
  if(siteRects.has(item.id))return siteRects.get(item.id)!;
  const anchor=item.placement.relativeTo;
  if(anchor===null)return fail(`${item.id}: site allocation needs a space or site-item anchor.`);
  if(active.has(item.id)||anchor===item.id)return fail(`${item.id}: cyclic site anchor.`);
  active.add(item.id);
  const base=rects.get(anchor)??(isMassAnchor(plan,anchor)?(()=>{const problem=massAnchorProblem(plan,item.id,anchor,item.placement.side);if(problem)return fail(problem);return boundsOf(massMembers(plan,anchor).map(m=>rects.get(m.id)!));})():siteDefs.has(anchor)?resolveSite(siteDefs.get(anchor)!,active):fail(`${item.id}: site anchor ${anchor} is neither a space nor a pool/landscape item.`));
  const r=locate(item.width,item.depth,item.placement,base);siteRects.set(item.id,r);return r;
 };
 const siteItem=(item:SiteItem)=>{const r=resolveSite(item);return {...item,centre:world([r.x+r.width/2,r.z+r.depth/2]),top:'level' in item?(tops.get(item.level)??fail(`${item.id}: missing pool level.`)):plan.site.elevation};};
 return {intent,vertical,sitePools:plan.pools.map(siteItem),siteLandscape:plan.landscape.map(siteItem)};
}
export function compileArchitecturalPlan(raw:unknown){
 const parsed=architecturalPlanSchema.safeParse(raw);
 if(!parsed.success)throw new DesignConflict(parsed.error.issues.map(issue=>`unsupported-plan-contract ${issue.path.join('.')||'plan'}: ${issue.message}`));
 const authored=parsed.data;
 let derived!:ReturnType<typeof derive>;
 try{derived=derive(authored);}catch(error){
  if(!(error instanceof DesignConflict))throw error;
  // A fundamental arrangement fault (overlapping wings, a violated declaration) is the cause; door failures that follow from it are secondary, so it is reported first.
  const primary=coordinatePlan(authored).errors.filter(e=>e.kind==='collision'||e.kind==='constraint'||e.kind==='declaration').map(e=>e.message);
  throw new DesignConflict([...primary,...error.decisions]);
 }
 const plan={...authored,...derived.intent,pools:derived.sitePools,landscape:derived.siteLandscape};
 const ids=[...plan.levels,...plan.masses,...plan.spaces,...plan.portals,...plan.stairs,...plan.pools,...plan.landscape,...(authored.screens??[])].map(e=>e.id);
 if(new Set(ids).size!==ids.length)fail('Plan identifiers must be unique across all entity types.');
 if(plan.site.grade!==0||plan.site.cliff)fail('Graded sites require a compiler extension.');
 if(new Set(plan.cameraViews).size!==4)fail('Each camera view is required once.');
 if(new Set(plan.roofs.map(r=>r.space)).size!==plan.roofs.length)fail('Duplicate roof allocation.');
 // Overhead enclosure: every roofless interior must be wholly covered by the floor datum at its envelope top.
 const enclosure:string[]=[];
 for(const room of plan.spaces){
  if(room.outdoor||room.roof)continue;
  const evidence=derived.vertical.find(v=>v.id===room.id)!,cover=evidence.cover,top=plan.levels.find(l=>l.id===room.level)!.top;
  if(cover.state==='full'&&Math.abs(cover.datum!-top-room.height)<1e-6)continue;
  enclosure.push(`${room.id}: incomplete overhead enclosure: `+(cover.state==='none'?'no roof is selected and no space is stacked above it.'
   :cover.state==='partial'?`unsupported-capability: only ${Math.round(cover.fraction*100)}% is covered by ${cover.by.join(', ')}; the rest is open to the sky and a roof is one slab over a whole space. Split ${room.id} into a covered space and a roofed space.`
   :`its envelope top is ${(top+room.height).toFixed(2)}m but the ${cover.level} floor covering it is at ${cover.datum!.toFixed(2)}m; omit the height so it reaches the floor above, or select a roof.`));
 }
 for(const roof of plan.roofs)if(!plan.spaces.some(s=>s.id===roof.space))fail('Unknown roof space.');
 for(const terrace of plan.terraces)if(!plan.spaces.some(s=>s.id===terrace&&s.outdoor))fail('Terrace must reference an outdoor space.');
 // Whole-building coordination: declared constraints are verified against the resolved arrangement, and every overlap is
 // explained at the placement decision where its two chains meet. Nothing is moved; a violated declaration rejects.
 const coordination=coordinatePlan(authored);
 let compiled!:ReturnType<typeof compileBuilding>,compilerDecisions:string[]=[];
 try{compiled=compileBuilding(derived.intent);}catch(error){if(!(error instanceof DesignConflict))throw error;compilerDecisions=error.decisions;}
 const spatial=coordination.errors.filter(e=>e.kind==='constraint'||e.kind==='declaration'||(e.kind==='collision'&&compilerDecisions.length>0)).map(e=>e.message);
 if(enclosure.length||compilerDecisions.length||spatial.length)throw new DesignConflict([...enclosure,...compilerDecisions,...spatial]);
 const walls=compiled.scene.elements.filter(e=>e.kind==='wall');
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j];
  if(Math.abs(Math.sin(a.rotation-b.rotation))>1e-6)continue;
  const dx=b.at[0]-a.at[0],dz=b.at[2]-a.at[2],along=Math.abs(dx*Math.cos(a.rotation)-dz*Math.sin(a.rotation)),across=Math.abs(dx*Math.sin(a.rotation)+dz*Math.cos(a.rotation));
  if(across<1e-6&&along<(a.size[0]+b.size[0])/2-1e-6&&Math.min(a.at[1]+a.size[1]/2,b.at[1]+b.size[1]/2)-Math.max(a.at[1]-a.size[1]/2,b.at[1]-b.size[1]/2)>1e-6)fail(`${a.id}/${b.id}: unsupported-capability: staggered levels create overlapping wall sections; coordinate envelope heights or extend vertical boundary segmentation.`);
 }

 const elements=compiled.scene.elements.map(e=>({...e,material:e.kind==='roof'?plan.materials.roof:e.kind==='plate'?plan.materials.floor:e.kind==='wall'?(authored.spaces.find(s=>compiled.provenance[e.id].sources.includes(s.id)&&!s.outdoor)?.facadeMaterial??plan.materials.wall):e.material}));
 applyExteriorIntent(authored,compiled,elements);
 const cFrame=Math.cos(authored.orientation),sFrame=Math.sin(authored.orientation);
 const occupied=compiled.scene.elements.filter(e=>e.kind==='plate').map(e=>({x:cFrame*e.at[0]-sFrame*e.at[2],z:sFrame*e.at[0]+cFrame*e.at[2],w:e.size[0],d:e.size[2]}));
 for(const item of [...plan.pools,...plan.landscape]){
  const [x,z]=item.centre,w=item.width,d=item.depth,margin='waterDepth' in item?.4:0;
  const c=Math.cos(authored.orientation),sn=Math.sin(authored.orientation);
  const projectedW=Math.abs(c)*(w+margin)+Math.abs(sn)*(d+margin);
  const projectedD=Math.abs(sn)*(w+margin)+Math.abs(c)*(d+margin);
  if(Math.abs(x)+projectedW/2>plan.site.width/2||Math.abs(z)+projectedD/2>plan.site.depth/2)fail(`${item.id}: outside site.`);
  const localX=c*x-sn*z,localZ=sn*x+c*z;
  if(occupied.some(b=>Math.abs(localX-b.x)<(w+margin+b.w)/2&&Math.abs(localZ-b.z)<(d+margin+b.d)/2))fail(`${item.id}: overlaps occupied site allocation (conservative bounds).`);
  occupied.push({x:localX,z:localZ,w:w+margin,d:d+margin});
  const emit=(suffix:string,kind:'plate'|'water',offset:[number,number,number],size:readonly number[],finish:z.infer<typeof material>)=>{
   elements.push(elementSchema.parse({id:suffix?`${item.id}-${suffix}`:item.id,label:item.id,kind,at:[x+c*offset[0]+sn*offset[2],offset[1],z-sn*offset[0]+c*offset[2]],rotation:authored.orientation,size,material:finish}));
  };
  if('waterDepth' in item){
   emit('','water',[0,item.top-.1,0],[w,.1,d],'sage');
   emit('base','plate',[0,item.top-item.waterDepth-.1,0],[w+.4,.2,d+.4],'limestone');
   emit('west','plate',[-w/2-.1,item.top-item.waterDepth/2,0],[.2,item.waterDepth,d+.4],'limestone');
   emit('east','plate',[w/2+.1,item.top-item.waterDepth/2,0],[.2,item.waterDepth,d+.4],'limestone');
   emit('north','plate',[0,item.top-item.waterDepth/2,-d/2-.1],[w,item.waterDepth,.2],'limestone');
   emit('south','plate',[0,item.top-item.waterDepth/2,d/2+.1],[w,item.waterDepth,.2],'limestone');
  }else emit('','plate',[0,item.top-.03,0],[w,.1,d],item.kind==='lawn'?'sage':'limestone');
 }
 for(const e of elements)if(Math.abs(e.at[0])+(Math.abs(Math.cos(e.rotation))*e.size[0]+Math.abs(Math.sin(e.rotation))*e.size[2])/2>plan.site.width/2||Math.abs(e.at[2])+(Math.abs(Math.sin(e.rotation))*e.size[0]+Math.abs(Math.cos(e.rotation))*e.size[2])/2>plan.site.depth/2)fail(`${e.id}: geometry exceeds site bounds.`);
 const provenance={...compiled.provenance};
 for(const e of elements)if(!provenance[e.id]){const source=[...plan.pools,...plan.landscape].find(s=>e.id===s.id||e.id.startsWith(`${s.id}-`));provenance[e.id]={sources:[source!.id],rule:'site intent → bounded site geometry'};}
 const scene=validateScene({...compiled.scene,terrain:plan.site,elements,architecturalPlan:authored});
 return {...compiled,provenance,vertical:derived.vertical,compiler:'architectural-plan-1.2',scene,operations:scene.elements.map(element=>({op:'add' as const,element}))};
}

const rectOf=(polygon:Point[]):Rect=>{const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);return {x:Math.min(...xs),z:Math.min(...zs),width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)};};
/** Construction only: roof section and facade-relative attachments selected by the planner. */
function applyExteriorIntent(plan:ArchitecturalPlan,compiled:ReturnType<typeof compileBuilding>,elements:SceneElement[]){
 const bounds=(e:SceneElement,local=false)=>{
  const yaw=e.rotation-(local?plan.orientation:0),c=Math.cos(plan.orientation),s=Math.sin(plan.orientation);
  return {x:local?c*e.at[0]-s*e.at[2]:e.at[0],z:local?s*e.at[0]+c*e.at[2]:e.at[2],w:Math.abs(Math.cos(yaw))*e.size[0]+Math.abs(Math.sin(yaw))*e.size[2],d:Math.abs(Math.sin(yaw))*e.size[0]+Math.abs(Math.cos(yaw))*e.size[2],bottom:e.at[1]-e.size[1]/2,top:e.at[1]+e.size[1]/2};
 };
 const intersects=(a:ReturnType<typeof bounds>,b:ReturnType<typeof bounds>)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-6&&Math.abs(a.z-b.z)<(a.d+b.d)/2-1e-6&&Math.min(a.top,b.top)-Math.max(a.bottom,b.bottom)>1e-6;
 const roofsOf=(space:string)=>elements.filter(e=>e.kind==='roof'&&compiled.provenance[e.id]?.sources[0]===space);
 for(const r of plan.roofs){
  const pieces=roofsOf(r.space),partial=compiled.partialRoofs[r.space];
  if(r.rise===undefined&&r.form!=='flat')fail(`${r.space}: unsupported-capability: pitched roof requires selected rise.`);
  const rise=r.rise??.18,overhang=r.overhang??0;
  if(r.form!=='flat'&&rise<.6)fail(`${r.space}: pitched roof rise must be >=0.6m.`);
  if(partial&&r.form!=='flat')fail(`${r.space}: unsupported-capability: ${r.form} roof over the exposed remainder beside ${partial.join(', ')}: a pitched roof would abut the taller wall above and needs a lean-to or valley junction. Select a flat roof for ${r.space}, or place the upper rooms wholly over or wholly clear of it.`);
  if(partial&&overhang>0)fail(`${r.space}: unsupported-capability: overhang on the exposed remainder beside ${partial.join(', ')} would extend into the storey above; omit the overhang.`);
  for(const [index,e] of pieces.entries()){
   const bottom=e.at[1]-e.size[1]/2;
   if(r.form!=='flat')delete e.geometry;
   e.at[1]=bottom+rise/2;e.size=[e.size[0]+(r.form==='flat'?2*overhang:0),rise,e.size[2]+(r.form==='flat'?2*overhang:0)];
   if(r.form!=='flat'){e.roofForm=r.form;e.overhang=overhang;}
   const own=compiled.intent.spaces.find(s=>s.id===r.space)!,piece=rectOf(compiled.roofPieces[r.space]?.[index]??own.polygon);
   const neighbours=compiled.intent.spaces.filter(s=>s.id!==r.space&&s.level===own.level).map(s=>rectOf(s.polygon));
   const boards=r.form==='flat'?[]:exposedFascia(r.form,piece,neighbours,overhang);
   // Only when a board is withheld; an unobstructed roof keeps the builder default so existing scenes are unchanged.
   if(r.form!=='flat'&&boards.length<fasciaSides(r.form,piece).length)e.fascia=boards.map(side=>ELEMENT_EDGE[side]);
   e.material=r.material??plan.materials.roof;
   const solids=roofFootprints(piece,overhang,boards).map(f=>({rect:f.rect,bottom:f.board?bottom-FASCIA_DEPTH:bottom,top:f.board?bottom:bottom+rise}));
   for(const other of compiled.intent.spaces.filter(s=>!s.outdoor&&s.id!==r.space)){
    const top=compiled.intent.levels.find(l=>l.id===other.level)!.top,volume=rectOf(other.polygon);
    const horizontal=solids.some(f=>Math.min(f.rect.x+f.rect.width,volume.x+volume.width)-Math.max(f.rect.x,volume.x)>1e-6&&Math.min(f.rect.z+f.rect.depth,volume.z+volume.depth)-Math.max(f.rect.z,volume.z)>1e-6&&Math.min(f.top,top+other.height)-Math.max(f.bottom,top)>1e-6);
    if(horizontal)fail(`${r.space}/${other.id}: unsupported-capability: roof/eaves penetrate occupied volume; select separated sections.`);
   }
   compiled.provenance[e.id]={sources:[r.space,plan.spaces.find(s=>s.id===r.space)!.level],rule:partial?'selected flat roof over the exposed remainder of a partly covered space → editable profile slab; underside at wall top':'selected roof form/rise/overhang → existing editable roof builder; underside at wall top'};
  }
 }
 // Slope envelope (eaves) and the fascia boards actually built, against the site, other roofs and floors. Reject uncertain junctions rather than trim roofs.
 const roofs=elements.filter(e=>e.kind==='roof');
 const roofSolids=(e:SceneElement)=>{
  const b=bounds(e,true),pitched=!!e.roofForm&&e.roofForm!=='flat',rect={x:b.x-b.w/2,z:b.z-b.d/2,width:b.w,depth:b.d};
  const boards=!pitched?[]:e.fascia?e.fascia.map(edge=>(Object.keys(ELEMENT_EDGE) as Side[]).find(side=>ELEMENT_EDGE[side]===edge)!):fasciaSides(e.roofForm!,rect);
  return roofFootprints(rect,pitched?e.overhang??0:0,boards).map(f=>({rect:f.rect,bottom:f.board?b.bottom-FASCIA_DEPTH:b.bottom,top:f.board?b.bottom:b.top}));
 };
 const touches=(a:ReturnType<typeof roofSolids>,b:ReturnType<typeof roofSolids>)=>a.some(x=>b.some(y=>Math.abs(x.rect.x+x.rect.width/2-y.rect.x-y.rect.width/2)<(x.rect.width+y.rect.width)/2-1e-6&&Math.abs(x.rect.z+x.rect.depth/2-y.rect.z-y.rect.depth/2)<(x.rect.depth+y.rect.depth)/2-1e-6&&Math.min(x.top,y.top)-Math.max(x.bottom,y.bottom)>1e-6));
 for(const roof of roofs){
  const b=bounds(roof),pitched=!!roof.roofForm&&roof.roofForm!=='flat',extra=pitched?(roof.overhang??0)+(roof.fascia===undefined?FASCIA_THICKNESS:roof.fascia.length?FASCIA_THICKNESS:0):0,projected=2*extra*(Math.abs(Math.cos(roof.rotation))+Math.abs(Math.sin(roof.rotation)));
  if(Math.abs(b.x)+(b.w+projected)/2>plan.site.width/2||Math.abs(b.z)+(b.d+projected)/2>plan.site.depth/2)fail(`${roof.id}: roof eaves exceed site.`);
  for(const other of roofs)if(other.id!==roof.id&&touches(roofSolids(roof),roofSolids(other)))fail(`${roof.id}/${other.id}: unsupported-capability: intersecting roof bounds require selected separated roof sections or a junction extension.`);
  for(const other of elements.filter(e=>e.kind==='plate')){
   if(compiled.provenance[other.id]?.sources.includes(compiled.provenance[roof.id].sources[0]))continue;
   const ob=bounds(other,true);
   if(touches(roofSolids(roof),[{rect:{x:ob.x-ob.w/2,z:ob.z-ob.d/2,width:ob.w,depth:ob.d},bottom:ob.bottom,top:ob.top}]))fail(`${roof.id}/${other.id}: unsupported-capability: roof intersects occupied construction bounds.`);
  }
 }
 for(const screen of plan.screens??[]){
  const space=compiled.intent.spaces.find(s=>s.id===screen.space)??fail(`${screen.id}: missing screen space.`);
  if(space.outdoor)fail(`${screen.id}: screen needs an interior facade host.`);
  const edge={south:0,east:1,north:2,west:3}[screen.side],a=space.polygon[edge],b=space.polygon[(edge+1)%4],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  const offset=screen.alignment==='centre'?len/2:screen.alignment==='start'?screen.width/2+.25:len-screen.width/2-.25;
  if(offset-screen.width/2<0||offset+screen.width/2>len||screen.sill+screen.height>space.height)fail(`${screen.id}: screen exceeds facade dimensions.`);
  const parts=compiled.boundaries.filter(b=>b.spaces.includes(space.id)&&Math.abs((b.a[0]-a[0])*dz-(b.a[1]-a[1])*dx)<1e-6&&Math.abs((b.b[0]-a[0])*dz-(b.b[1]-a[1])*dx)<1e-6);
  const t=(p:Point)=>((p[0]-a[0])*dx+(p[1]-a[1])*dz)/len;
  if(parts.some(b=>b.spaces.some(id=>id!==space.id&&!compiled.intent.spaces.find(s=>s.id===id)!.outdoor)&&Math.min(Math.max(t(b.a),t(b.b)),offset+screen.width/2)-Math.max(Math.min(t(b.a),t(b.b)),offset-screen.width/2)>1e-6))fail(`${screen.id}: screen is on a shared interior boundary.`);
  for(const p of compiled.intent.portals.filter(p=>p.host.space===space.id&&p.host.edge===edge&&p.mode!=='window'))if(Math.abs(p.offset-offset)<(p.width+screen.width)/2)fail(`${screen.id}: screen obstructs a passable opening.`);
  const local:Point=[a[0]+dx/len*offset+dz/len*screen.standOff,a[1]+dz/len*offset-dx/len*screen.standOff],f=compiled.intent.frame,c=Math.cos(f.yaw),s=Math.sin(f.yaw);
  const top=compiled.intent.levels.find(l=>l.id===space.level)!.top;
  const e=elementSchema.parse({id:screen.id,label:screen.id,kind:'screen',at:[f.origin[0]+c*local[0]+s*local[1],top+screen.sill+screen.height/2,f.origin[1]-s*local[0]+c*local[1]],rotation:Math.atan2(-dz,dx)+f.yaw,size:[screen.width,screen.height,screen.depth],material:screen.material,panels:screen.panels});
  if(elements.some(other=>other.kind!=='roof'&&intersects(bounds(e,true),bounds(other,true))))fail(`${screen.id}: screen intersects construction bounds.`);
  elements.push(e);compiled.provenance[e.id]={sources:[screen.id,space.id,space.level],rule:'selected facade screen → existing editable slat primitive'};
 }
}
