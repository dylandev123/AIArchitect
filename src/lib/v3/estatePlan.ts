import { v3MassLevelCount } from './stacking';
import { v3Capability } from './capabilities';
import { authoredOverlap, authoredPlan, planArea, authoredSeparation } from './authoredPlan';
import { auditEstateSpatial } from './estateSpatial';
import { z } from 'zod';
import { v3BlueprintSchema } from './blueprintSchema';
import type { V3Scene, V3SceneObject } from './scene';
import type { V3DesignDiagnostic } from './designReview';
import { scaledDimensionsOf, getObjectBaseY, getObjectTopY } from './elevation';

const text = z.string().min(1).max(600), id = z.string().min(1).max(100);
const region = z.object({ x: z.number().finite(), z: z.number().finite(), width: z.number().positive(), depth: z.number().positive() }).strict();
const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const access = z.object({ point, openingId: id.optional() }).strict();
const range = z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }).strict().refine(v => v.min <= v.max);
/** Semantic commitments only. No derived meshes, inferred plans, mandatory amenities or fixed zone taxonomy. */
export const v3EstatePlanSchema = z.object({
  version: z.literal(1), concept: text, character: text,
  blueprint: v3BlueprintSchema.optional(),
  requirements: z.array(z.object({ id, source: z.enum(['user', 'design']), statement: text,
    metric: z.enum(['floorArea', 'siteWidth', 'siteDepth', 'bedrooms', 'budget', 'style', 'feature']),
    objectIds: z.array(id), range: range.optional(), value: text.optional(),
  }).strict()),
  program: z.array(z.object({ id, role: text, kind: z.enum(['residence', 'building', 'amenity', 'landscape']), objectIds: z.array(id).min(1), source: z.enum(['user', 'design']) }).strict()),
  zones: z.array(z.object({ id, purpose: text, objectIds: z.array(id), allocation: region,
    // An explicit clear rectangle, not an inferred percentage of usable area.
    clearSpace: region.extend({ baseElevation: z.number().finite(), height: z.number().positive() }).strict().optional(),
  }).strict()),
  circulation: z.array(z.object({ id, purpose: text, from: id, to: id, via: z.array(id).min(1), spatial: z.object({ from: access, to: access, use: z.enum(['pedestrian', 'vehicle', 'service']), width: z.number().positive().max(100), waypoints: z.array(point).max(100).optional() }).strict().optional() }).strict()),
  architecture: z.array(z.object({ id, objectIds: z.array(id).min(1), form: z.enum(['rectangular', 'joined', 'rotated', 'L-shaped', 'U-shaped', 'polygonal', 'circular', 'curved', 'irregular', 'complex-roof']), intent: text, minWidth: z.number().positive().optional(), minDepth: z.number().positive().optional(), minHeight: z.number().positive().optional() }).strict()).optional(),
  relationships: z.array(z.object({ id, intent: text, from: id, to: id, kind: z.enum(['connects', 'contains', 'aligns', 'hosts', 'supports']) }).strict()),
  considerations: z.array(z.object({ id, intent: text, objectIds: z.array(id), kind: z.enum(['view', 'privacy', 'open-space', 'landscape']) }).strict()),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set<string>();
  for (const entry of [...plan.requirements, ...plan.program, ...plan.zones, ...plan.circulation, ...plan.relationships, ...plan.considerations, ...(plan.architecture ?? []), ...(plan.blueprint?.buildings ?? []), ...(plan.blueprint?.entrances ?? []), ...(plan.blueprint?.allocations ?? [])]) {
    if (ids.has(entry.id)) ctx.addIssue({ code: 'custom', message: `Duplicate estate intent id ${entry.id}` });
    ids.add(entry.id);
  }
});
export type V3EstatePlan = z.infer<typeof v3EstatePlanSchema>;
export type V3EstateCode = 'ESTATE_AMENITY_UNVERIFIED' | 'ESTATE_FORM_UNBUILT' | 'ESTATE_ROUTE_BLOCKED' | 'ESTATE_POOL_CROSSING' | 'ESTATE_ROUTE_UNSUPPORTED' | 'ESTATE_ACCESS_POINT_MISSING' | 'ESTATE_MISSING_OBJECT' | 'ESTATE_ALLOCATION_CONFLICT' | 'ESTATE_ACCESS_MISSING' | 'ESTATE_RELATIONSHIP_MISSING' | 'ESTATE_OPEN_SPACE_BLOCKED' | 'ESTATE_REQUIREMENT_CONFLICT' | 'ESTATE_REQUIREMENT_UNVERIFIED' | 'ESTATE_ACCESS_DISCONNECTED';


export function auditV3EstatePlan(scene: V3Scene): V3DesignDiagnostic[] {
  if (!scene.estatePlan) return [];
  const parsed = v3EstatePlanSchema.safeParse(scene.estatePlan);
  if (!parsed.success) return []; // Structural validation reports malformed plans separately.
  const plan = parsed.data, out: V3DesignDiagnostic[] = [], objects = new Map(scene.objects.map(o => [o.id, o]));
  const add = (code: V3EstateCode, ids: string[], message: string, advisory = false) => out.push({ code, severity: advisory ? 'advisory' : 'significant', targetIds: ids, message, guidance: 'Resolve only this estate commitment using its stable ids. Preserve estatePlan and unrelated objects, materials, roofs and geometry. Never erase a commitment to silence a finding.' } as V3DesignDiagnostic);
  for (const entry of plan.program) if (entry.kind==='building' || entry.kind==='residence') {
    // A program groups a building with its roofs, courts and amenities. It must
    // contain an actual building, but its associated objects need not be masses.
    if (!entry.objectIds.some(ref=>objects.get(ref)?.type==='building-mass')) add('ESTATE_REQUIREMENT_CONFLICT', entry.objectIds, `${entry.id}: planned building program contains no building mass.`);
  }
  for(const entry of plan.program.filter(p=>p.kind==='amenity'))for(const ref of entry.objectIds){const o=objects.get(ref);if(o&&(v3Capability(o.type)?.renderability!=='specialized'||/fountain|tennis|basketball/i.test(`${entry.role} ${o.label}`)))add('ESTATE_AMENITY_UNVERIFIED',[ref],`${entry.id}: ${o.label} has no certified specialized construction for that amenity; a generic slab, box or water basin is not proof of the named equipment.`,true);}
  const refs = [...plan.program, ...plan.zones, ...plan.requirements, ...plan.considerations];
  for (const entry of refs) for (const ref of entry.objectIds) if (!objects.has(ref)) add('ESTATE_MISSING_OBJECT', [ref], `${entry.id} references missing authored object ${ref}.`);
  for (const zone of plan.zones) {
    const r = zone.allocation;
    if (Math.abs(r.x)+r.width/2>scene.site.width/2+.25 || Math.abs(r.z)+r.depth/2>scene.site.depth/2+.25) add('ESTATE_ALLOCATION_CONFLICT', zone.objectIds, `${zone.id}: allocation exceeds the site boundary.`);
    for (const ref of zone.objectIds) {
      const o = objects.get(ref);
      if (o && authoredPlan(o).some(([x,z]) => Math.abs(x-r.x)>r.width/2+.25 || Math.abs(z-r.z)>r.depth/2+.25)) add('ESTATE_ALLOCATION_CONFLICT', [ref], `${zone.id}: ${ref} exceeds allocation x=[${r.x-r.width/2},${r.x+r.width/2}], z=[${r.z-r.depth/2},${r.z+r.depth/2}].`);
    }
    if (zone.clearSpace) {
      const c = zone.clearSpace;
      const probe: V3SceneObject = { id: zone.id, type: 'slab', label: zone.purpose, semanticRole: zone.purpose, material: { id: 'probe', color: '#ffffff' }, dimensions: [c.width,c.height,c.depth], transform: { position: [c.x,c.baseElevation+c.height/2,c.z], rotation: [0,0,0], scale: [1,1,1] } };
      for (const o of scene.objects) if ((o.collision === 'solid' || o.collision === 'water' || ['building-mass','pool'].includes(o.type)) && getObjectTopY(o)>c.baseElevation+.1 && getObjectBaseY(o)<c.baseElevation+c.height && authoredOverlap(probe,o)>.1) add('ESTATE_OPEN_SPACE_BLOCKED', [o.id], `${zone.id}: ${o.id} occupies its reserved usable space.`);
    }
  }
  const linked = (from: string, to: string, kind: string) => scene.relationships.some(r => r.kind===kind && (r.from===from && r.to===to || kind==='connects' && r.from===to && r.to===from));
  for (const r of plan.relationships) if (!objects.has(r.from) || !objects.has(r.to) || !linked(r.from,r.to,r.kind)) add('ESTATE_RELATIONSHIP_MISSING', [r.from,r.to], `${r.id}: missing authored ${r.kind} relationship.`);
  for (const route of plan.circulation) {
    if (route.spatial) continue; // Physical authored routes are audited below, independently of graph declarations.
    // A surface may also be an endpoint; that does not require a self-edge.
    const chain = [route.from,...route.via,route.to].filter((ref,i,all)=>i===0||ref!==all[i-1]);
    for (const ref of chain) if (!objects.has(ref)) add('ESTATE_MISSING_OBJECT', [ref], `${route.id} references missing authored access object ${ref}.`);
    if (chain.some(ref => !objects.has(ref)) || chain.slice(1).some((ref,i) => !linked(chain[i],ref,'connects'))) add('ESTATE_ACCESS_MISSING', chain, `${route.id}: missing ${route.purpose} access chain.`);
    for (let i=1;i<chain.length;i++) {
      const a=objects.get(chain[i-1]), b=objects.get(chain[i]);
      // Routed surfaces have derived bounds; siteHierarchy audits their route geometry instead.
      if (a && b && !scene.siteHierarchy?.connections.some(c=>c.surfaceObjectId===a.id || c.surfaceObjectId===b.id) && authoredSeparation(a,b)>.05) add('ESTATE_ACCESS_DISCONNECTED', [a.id,b.id], `${route.id}: ${a.id} → ${b.id} gap=${authoredSeparation(a,b).toFixed(2)}m; author a continuous route to the actual destination opening.`);
    }
  }
  for (const req of plan.requirements) {
    const selected = req.objectIds.map(ref => objects.get(ref)).filter((o): o is V3SceneObject => !!o);
    let actual: number | undefined;
    if (req.metric==='siteWidth') actual=scene.site.width;
    if (req.metric==='siteDepth') actual=scene.site.depth;
    if (req.metric==='floorArea' && selected.length===req.objectIds.length && selected.length) actual=selected.filter(o=>o.type==='building-mass').reduce((sum,o)=>{const [w,,d]=scaledDimensionsOf(o);return sum+(o.composition?.footprint?Array.from({length:v3MassLevelCount(o)},(_,floor)=>planArea(authoredPlan(o,floor))).reduce((a,b)=>a+b,0):w*d*v3MassLevelCount(o));},0);
    if (req.metric==='bedrooms' && scene.interior?.rooms.length) actual=scene.interior.rooms.filter(r => r.program === 'bedroom' && (!req.objectIds.length || req.objectIds.includes(r.hostMassId))).length;
    if (actual!==undefined && req.range && (actual<req.range.min-.01 || actual>req.range.max+.01)) add('ESTATE_REQUIREMENT_CONFLICT', req.objectIds, `${req.id}: ${req.metric} is ${actual}, expected ${req.range.min}–${req.range.max}.`);
    else if (req.metric!=='feature' && (actual===undefined || !req.range)) add('ESTATE_REQUIREMENT_UNVERIFIED', req.objectIds, `${req.id}: ${req.metric} is retained as intent; no deterministic verification is available.`, true);
    if (req.metric==='feature' && !req.objectIds.length) add('ESTATE_REQUIREMENT_UNVERIFIED', [], `${req.id}: feature has no authored reference.`, true);
  }
  return [...out, ...auditEstateSpatial(scene)];
}

export const V3_ESTATE_PLAN_PROMPT = `SPATIAL DESIGN CONTRACT: Resolve the geometry of every feature you choose to author before returning the scene. This is a functional contract, not a template: no particular door, path, amenity, roof, style or composition is required.
A door must operate on a buildable wall plane. Compute its span against recess/return boundaries; author distinct doors yourself when multiple planes are intended. Preserve unusual forms rather than flattening them. Paths must terminate at their intended doors/surfaces, including recessed entry walls, not just the building envelope. Use serves and circulation endpoint openingId to identify destinations; author route bends explicitly where needed. Joined objects must actually touch (0.05m geometric tolerance); an axis or view alignment is not a physical joint. Compute surface tops and door floor datums, and explicitly design landings, steps or ramps where transitions need them; a graph connection does not build access. Allocations must contain the physical footprints of all their members, including rotated geometry. Keep every object and allocation within the authored site; do not enlarge a user-defined site to hide an overrun. Reconcile plan and objects in this same response. Never rely on normalization to move objects, clip doors, connect gaps, invent steps or choose missing architecture.
ESTATE MASTER PLANNING: Establish estatePlan before objects in this same response; do not make a separate planning call. Design the whole property around a distinctive concept, then fulfill it with authored objects. No fixed zone names, building counts, courtyards, pools, sports or style checklist. A single sculptural house or compact urban mansion can be complete.
estatePlan:{version:1,concept,character,requirements:[{id,source:"user"|"design",statement,metric:"floorArea"|"siteWidth"|"siteDepth"|"bedrooms"|"budget"|"style"|"feature",objectIds,range?:{min,max},value?}],program:[{id,role,kind:"residence"|"building"|"amenity"|"landscape",objectIds,source}],zones:[{id,purpose,objectIds,allocation:{x,z,width,depth},clearSpace?:{x,z,width,depth,baseElevation,height}}],circulation:[{id,purpose,from,to,via:[objectId]}],relationships:[{id,intent,from,to,kind:"connects"|"contains"|"aligns"|"hosts"|"supports"}],considerations:[{id,intent,objectIds,kind:"view"|"privacy"|"open-space"|"landscape"}]}.
Use stable authored object ids, never generated mesh ids. Allocate world-space rectangles generously enough for rotated footprints; reserve clearSpace only where occupancy must remain clear. Describe arrival, pedestrian and service access as appropriate; every consecutive object in each circulation chain must have an authored connects relationship. Mirror planned relationships in scene.relationships. Record views, privacy, landscape and intentional open spaces without pretending textual intentions are measurable geometry.
Separate explicit user requirements from your choices. Preserve stated budgets (with currency), floor areas, site dimensions, bedrooms, style and amenities verbatim in statements; encode measurable limits in ranges (equal min/max for exact values). Floor area is gross mass footprint times storeys, not net room area. Never enlarge explicitly sized buildings. For unspecified mansions US$5–10M is only a conceptual design-ambition reference, never a construction estimate. Budget and style remain unverified intent. Do not fabricate a user budget. Be ambitious when requested and let the property concept drive the program.`;

export const V3_CREATIVE_ARCHITECTURE_PROMPT = `CREATIVE ARCHITECTURAL VISION: First choose a coherent design identity, scale/program, mass composition, roof character, arrival sequence, outdoor living, recreation, landscape and privacy strategy. Explain why these decisions belong together in concept/character. Explicit user constraints outrank every design choice. Luxury ambition must be expressed in actual spatial dimensions, hierarchy and usable spaces, not adjectives. Mediterranean, classical, castle-inspired, modern tropical, sculptural contemporary and hybrids are possibilities, never templates or required amenities. Choose one monumental residence or connected pavilions as the brief warrants; do not randomly shuffle styles or repeat a rectangular mansion template.
Represent distinctive geometry in optional estatePlan.architecture:[{id,objectIds,form:rectangular|joined|rotated|L-shaped|U-shaped|polygonal|circular|curved|irregular|complex-roof,intent,minWidth?,minDepth?,minHeight?}]. Declare meaningful minimum dimensions for grand arrival courts, large garden spaces and monumental entrances using their actual object ids. Minimum dimensions apply to the whole referenced composition; a single object uses its local dimensions and a group uses its combined world envelope. A joined group must physically touch; a thematic water-garden axis with gaps is not a joined construction. Building/residence programs must include a building mass and may also reference its roofs and amenities. These are authored design commitments, not universal size defaults. Rectangular rotated masses, joined wings and single articulated L/U or chamfered footprints are supported via composition.footprint. Circular/curved buildings and irregular polygons use composition.footprint kind:"outline" with stable line/arc segments and segmentId-addressed openings/assemblies. Flat, terrace, floating-flat and mono-pitch roofs follow those outlines. Arbitrary roof intersections, domes and curved mass Boolean unions are NOT supported. Preserve explicitly requested unsupported forms as commitments and report them; never call a box or cylinder proxy a faithful circular mansion. Single articulated footprints support recesses, projections, corner notches and chamfers. Choose them only when appropriate to your concept; rectangular architecture remains valid.
For actual estate routes add spatial:{from:{point:[x,y,z],openingId?},to:{point:[x,y,z],openingId?},use:pedestrian|vehicle|service,width,waypoints?:[[x,y,z],...]} to a circulation entry. from/to object ids remain on the entry; via must contain exactly one authored path/driveway surface owner, whose material is used. Points are world coordinates. Author every bend; the compiler never finds a route for you. v1 supports flat ground routes only. Building endpoints must identify a ground door/glazed-door opening and meet its facade span. Connect amenities and pavilions explicitly; graph edges alone do not demonstrate physical access. Keep routes clear of buildings, pools and obstacles, with adequate authored width. No automatic detours or unusual-architecture simplification.`;
