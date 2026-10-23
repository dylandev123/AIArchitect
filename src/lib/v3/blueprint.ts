import { auditV3StairUsability } from './stairUsability';
import { resolveV3Circulation, V3_FLOOR_SLAB } from './circulation';
import { z } from 'zod';
import type { V3Scene, V3SceneObject } from './scene';
import { v3EstatePlanSchema, auditV3EstatePlan } from './estatePlan';
import { stackedStoreyOpenings, v3CompositionSchema } from './composition';
import { materializeV3ArchitecturalScene } from './architecture';
import { authoredPlan, authoredOverlap, authoredSeparation, planArea } from './authoredPlan';
import { footprintContains, resolveFootprint } from './footprint';
import { openingEdges, facadeEdgeSpan } from './footprintConstruction';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { v3MassStoreys, v3MassLevelCount, v3StoreyBase } from './stacking';
import { resolveV3FootprintRoofPlan } from './roofPlanning';
import { addressedStrips } from './accessPlanning';
import { footprintOverlap } from './reviewGeometry';
import { estateRouteAccess } from './routeGeometry';

export interface V3BlueprintFinding { code: string; severity: 'fatal' | 'advisory'; targetIds: string[]; message: string; }
export interface V3BlueprintAudit { ok: boolean; findings: V3BlueprintFinding[]; }
const n = z.number().finite(), id = z.string().min(1), vec = z.tuple([n,n,n]);
const rect = z.object({ x: n, z: n, width: n.positive(), depth: n.positive() }).passthrough();
const support = z.object({ hostId: id.optional(), objectId: id.optional() }).passthrough();
// Only prerequisites consumed by the spatial audit. No facade assemblies, finishes,
// partitions, stair treads or meshes are required for a planning scene.
const inputSchema = z.object({
  version: z.literal(3), site: z.object({ width: n.positive(), depth: n.positive(), baseElevation: n.optional() }).passthrough(),
  estatePlan: v3EstatePlanSchema,
  objects: z.array(z.object({
    id, type: id, dimensions: z.tuple([n.positive(),n.positive(),n.positive()]),
    transform: z.object({ position: vec, rotation: vec, scale: z.tuple([n.positive(),n.positive(),n.positive()]) }),
    architecture: z.object({ x: n, z: n, width: n.positive(), depth: n.positive(), height: n.positive(), baseElevation: n, rotationY: n.optional() }).optional(),
    levels: z.number().int().min(1).max(20).optional(), hostId: id.optional(), support: support.optional(),
    roofForm: z.enum(['flat','floating-flat','mono-pitch','hip','gable','butterfly','terrace']).optional(), pitch: n.optional(), overhang: n.nonnegative().optional(),
    composition: z.object({ footprint: v3CompositionSchema.shape.footprint, openings: v3CompositionSchema.shape.openings,
      spaceHeight: v3CompositionSchema.shape.spaceHeight }).passthrough().optional(),
  }).passthrough()),
  relationships: z.array(z.object({ from: id, to: id, kind: id })),
  siteHierarchy: z.object({ levels: z.array(z.unknown()), connections: z.array(z.object({ surfaceObjectId: id.optional() }).passthrough()) }).passthrough().optional(),
  interior: z.object({
    storeys: z.array(z.object({ id, hostMassId: id, index: z.number().int().nonnegative(), elevation: n, height: n.positive() }).passthrough()),
    rooms: z.array(z.object({ id, hostMassId: id, storeyId: id, footprint: rect }).passthrough()),
    circulation: z.array(z.object({ id, type: z.enum(['stair','lift']), hostMassId: id, fromLevel: z.number().int().nonnegative(), toLevel: z.number().int().positive(), footprint: rect }).passthrough()).optional(),
  }).passthrough().optional(),
}).passthrough();

const hostId = (object: V3SceneObject) => object.support?.hostId ?? object.support?.objectId ?? object.hostId;
type Rect = { x: number; z: number; width: number; depth: number };
export function localRectangleFits(host: V3SceneObject, r: Rect, floor: number) {
  const points: [number,number][] = [[r.x-r.width/2,r.z-r.depth/2],[r.x+r.width/2,r.z-r.depth/2],[r.x+r.width/2,r.z+r.depth/2],[r.x-r.width/2,r.z+r.depth/2]];
  const [w,,d] = scaledDimensionsOf(host);
  return points.every(([x,z]) => Math.abs(x)<=w/2+.001 && Math.abs(z)<=d/2+.001) && footprintContains(host,points,floor);
}

/** Read-only planning gate. Shared estate access evidence may inspect compiled junction passages;
 * this never invokes ingestion, changes construction decisions or calls a provider. */
export function auditV3Blueprint(input: unknown, options:{constructionEvidence?:boolean;circulationReservations?:boolean}={}): V3BlueprintAudit {
  const findings: V3BlueprintFinding[] = [];
  const add = (code: string, targetIds: string[], message: string, severity: 'fatal' | 'advisory' = 'fatal') => findings.push({ code, severity, targetIds, message });
  const finish = () => ({ ok: !findings.some(f => f.severity === 'fatal'), findings });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) add('BLUEPRINT_INVALID_INPUT',['estatePlan'],`${issue.path.join('.')}: ${issue.message}`);
    return finish();
  }
  // Use the original V3 representation after checking prerequisites; projection parsing
  // is not a new normalizer and must not drop unexamined semantic fields.
  const scene = materializeV3ArchitecturalScene(input as V3Scene), plan = scene.estatePlan!, bp = plan.blueprint;
  if (!bp) { add('BLUEPRINT_MISSING',['estatePlan'],'An authored blueprint is required at this planning boundary.'); return finish(); }
  const objects = new Map(scene.objects.map(o => [o.id,o]));
  const unique = (values: string[], domain: string) => {
    if (new Set(values).size !== values.length) add('BLUEPRINT_DUPLICATE_ID',[domain],`Ambiguous ${domain} ids.`);
  };
  unique(scene.objects.map(o=>o.id),'objects');
  unique((scene.interior?.storeys ?? []).map(s=>s.id),'storeys');
  unique((scene.interior?.storeys ?? []).map(s=>`${s.hostMassId}:${s.index}`),'storey levels');
  unique((scene.interior?.rooms ?? []).map(r=>r.id),'rooms');
  unique((scene.interior?.circulation ?? []).map(c=>c.id),'circulation');
  for (const o of scene.objects) unique((o.composition?.openings ?? []).map(op=>op.id),o.id);
  unique([...scene.objects.map(o=>o.id),...(scene.interior?.storeys ?? []).map(s=>s.id),...(scene.interior?.rooms ?? []).map(r=>r.id),...(scene.interior?.circulation ?? []).map(c=>c.id)],'scene semantics');
  if (findings.length) return finish();
  const ref = (value: string, owner: string, type?: string) => {
    const o = objects.get(value);
    if (!o || type && o.type !== type) add('BLUEPRINT_REFERENCE',[owner,value],`${owner} needs ${type ?? 'object'} ${value}.`);
    return o && (!type || o.type === type) ? o : undefined;
  };
  const buildings = scene.objects.filter(o=>o.type==='building-mass');
  for (const b of bp.buildings) ref(b.objectId,b.id,'building-mass');
  for (const o of buildings) {
    if (!bp.buildings.some(b=>b.objectId===o.id)) add('BLUEPRINT_BUILDING_UNPLANNED',[o.id],'Every building needs a spatial hierarchy entry.');
    if (o.levels !== undefined && o.levels !== v3MassLevelCount(o)) add('BLUEPRINT_STOREYS',[o.id],'Authored storey count contradicts the available building height.');
    if (hostId(o) && !objects.has(hostId(o)!)) add('BLUEPRINT_REFERENCE',[o.id,hostId(o)!],'Missing authored building support host.');
    for (let level=0;level<v3MassLevelCount(o);level++) if (o.composition?.footprint && !resolveFootprint(o,level)) add('BLUEPRINT_FOOTPRINT',[o.id],`Invalid footprint on level ${level}; no rectangular substitute is accepted.`);
  }
  if (findings.some(f=>f.code==='BLUEPRINT_FOOTPRINT')) return finish();
  for (const o of scene.objects) {
    if (plan.circulation.some(r=>r.spatial && r.via.includes(o.id)) || scene.siteHierarchy?.connections.some(c=>c.surfaceObjectId===o.id)) continue;
    for (let level=0;level<(o.type==='building-mass'?v3MassLevelCount(o):1);level++)
      if (authoredPlan(o,level).some(([x,z])=>Math.abs(x)>scene.site.width/2+.05 || Math.abs(z)>scene.site.depth/2+.05)) add('BLUEPRINT_SITE_BOUNDS',[o.id],`${o.id}, level ${level} exceeds the fixed ${scene.site.width} × ${scene.site.depth}m site.`);
  }
  // Existing plan audits already check allocations, clear space, explicit constraints,
  // joined groups, route corridors, real destination thresholds and relationship edges.
  for (const finding of auditV3EstatePlan(scene,options)) add(finding.code,finding.targetIds,finding.message,finding.severity==='advisory'?'advisory':'fatal');
  for (const relationship of plan.relationships) {
    const from=objects.get(relationship.from),to=objects.get(relationship.to);
    if (!from || !to) continue; // Existing estate audit reports unresolved relationships.
    if (relationship.kind==='contains' && planArea(authoredPlan(to))-authoredOverlap(from,to)>.05)
      add('BLUEPRINT_CONTAINMENT',[relationship.id,from.id,to.id],'Declared contained footprint extends outside its containing footprint.');
    const roof=from.type==='roof-form'?from:to.type==='roof-form'?to:undefined;
    const roofHost=roof===from?to:from;
    if (relationship.kind==='hosts' && roof && hostId(roof)!==roofHost.id)
      add('BLUEPRINT_ROOF_HOST',[relationship.id,from.id,to.id],'Planned roof host disagrees with the roof object host.');
    if (relationship.kind==='aligns' || relationship.kind==='supports' || relationship.kind==='hosts' && !roof)
      add('BLUEPRINT_RELATIONSHIP_UNVERIFIED',[relationship.id,from.id,to.id],'Relationship references agree; its architectural axis or physical support needs a more specific authored/constructed contract.','advisory');
  }
  for (const entry of bp.entrances) {
    const o = ref(entry.objectId,entry.id,'building-mass'); if (!o) continue;
    const op = stackedStoreyOpenings(o.composition?.openings ?? [],v3StoreyBase(o,scene),entry.level).find(op=>op.id===entry.openingId);
    if (!op || !['door','glazed-door'].includes(op.type) || !('start' in op) || entry.level>=v3MassLevelCount(o) || op.end<=op.start) {
      add('BLUEPRINT_ENTRANCE',[o.id,entry.openingId],`${entry.id} needs an actual door on an existing local level.`); continue;
    }
    const globalLevel = entry.level + v3StoreyBase(o,scene);
    if (op.floors==='ground' && globalLevel!==0 || op.floors==='upper' && globalLevel===0) add('BLUEPRINT_ENTRANCE',[o.id,op.id],`${entry.id} targets a level excluded by its opening.`);
    const fp = resolveFootprint(o,entry.level);
    if (o.composition?.footprint?.kind==='outline') {
      if (!o.composition.footprint.segments?.some(s=>s.id===op.segmentId)) add('BLUEPRINT_ENTRANCE_WALL',[o.id,op.id],`${entry.id} has no valid authored line/arc segment.`);
    } else if (fp) {
      const edges = openingEdges(fp.edges,op.facade,op.start,op.end,fp.frame.width,fp.frame.depth).filter(edge=>{
        const span = facadeEdgeSpan(edge,fp.frame.width,fp.frame.depth);
        return span.start<=op.start+1e-6 && span.end>=op.end-1e-6;
      });
      if (edges.length!==1) add('BLUEPRINT_ENTRANCE_WALL',[o.id,op.id],`${entry.id} must fit one actual wall segment; its span crosses or ambiguously addresses wall planes.`);
    }
  }
  for (const b of buildings) {
    if (!bp.entrances.some(e=>e.objectId===b.id)) add('BLUEPRINT_ENTRY_UNDECIDED',[b.id],'No entrance is designated; access intent needs an authored decision.','advisory');
    const mainEntry = b.composition?.mainEntry;
    if (mainEntry && !bp.entrances.some(e=>e.objectId===b.id && e.openingId===mainEntry.openingId && e.level===0))
      add('BLUEPRINT_MAIN_ENTRY',[b.id,mainEntry.openingId],'The composed main entrance must be designated in the blueprint on local level 0.');
  }
  for (const value of bp.outdoorObjectIds) ref(value,'blueprint.outdoorObjectIds');
  for (const value of bp.routeIds) if (!plan.circulation.some(r=>r.id===value)) add('BLUEPRINT_REFERENCE',[value],'Missing estate circulation route.');
  for (const route of plan.circulation) {
    if (!bp.routeIds.includes(route.id)) add('BLUEPRINT_ROUTE_UNPLANNED',[route.id],'An authored estate route is absent from the blueprint.');
    for (const side of ['from','to'] as const) if (objects.get(route[side])?.type==='building-mass' && !bp.entrances.some(e=>e.objectId===route[side] && (!route.spatial || e.level===0 && e.openingId===estateRouteAccess(scene,route,side)?.openingId)))
      add('BLUEPRINT_ROUTE_ENTRY',[route.id,route[side]],'Building destinations must reference a designated entrance.');
    if (!route.spatial) for (const side of ['from','to'] as const) {
      const host = objects.get(route[side]), surface = objects.get(side==='from'?route.via[0]:route.via.at(-1)!);
      if (host?.type!=='building-mass' || !surface) continue;
      const [w,,d] = scaledDimensionsOf(host);
      const entries = bp.entrances.filter(e=>e.objectId===host.id);
      const contacts = entries.filter(entry=>{
        const op = host.composition?.openings?.find(op=>op.id===entry.openingId);
        if (!op || !('start' in op) || 'serves' in op && op.serves && op.serves!==surface.id) return false;
        return addressedStrips({o:host,w,d},`${entry.id}:threshold`,op.facade,op.start,op.end,.05,getObjectBaseY(host),op.segmentId,entry.level).some(strip=>footprintOverlap(strip,surface)>.001);
      });
      if (!contacts.length) add('BLUEPRINT_ROUTE_THRESHOLD',[route.id,host.id,surface.id],'The route surface does not meet a designated entrance on its actual wall.');
      else if (!contacts.some(e=>Math.abs(getObjectBaseY(host)+v3MassStoreys(host,scene)[e.level].elevation+.26-getObjectTopY(surface))<=.1))
        add('BLUEPRINT_THRESHOLD_TRANSITION',[route.id,host.id,surface.id],'Door and route surface have different finished elevations; author any intended step or ramp.','advisory');
    }
  }
  const roofs = scene.objects.filter(o=>o.type==='roof-form');
  for (const value of bp.roofObjectIds) ref(value,'blueprint.roofObjectIds','roof-form');
  for (const roof of roofs) {
    if (!bp.roofObjectIds.includes(roof.id)) add('BLUEPRINT_ROOF_UNPLANNED',[roof.id],'Explicit roof is absent from blueprint.');
    const host = objects.get(hostId(roof) ?? '');
    const aliases = [roof.hostId,roof.support?.hostId,roof.support?.objectId].filter((id): id is string=>!!id);
    if (host?.type!=='building-mass' || new Set(aliases).size>1) add('BLUEPRINT_ROOF_HOST',[roof.id],'Explicit roof must reference one actual building host without conflicting aliases.');
  }
  for (const host of buildings) {
    if (host.unsupportedIntent?.roofForm) add('BLUEPRINT_ROOF_UNSUPPORTED',[host.id],`Unresolved building roof intent: ${host.unsupportedIntent.roofForm}.`);
    const explicit = roofs.filter(r=>hostId(r)===host.id);
    for (const roof of explicit.length ? explicit : [host]) {
      if (roof.unsupportedIntent?.roofForm) add('BLUEPRINT_ROOF_UNSUPPORTED',[roof.id],`Unresolved roof intent: ${roof.unsupportedIntent.roofForm}.`);
      if (host.composition?.footprint) for (const d of resolveV3FootprintRoofPlan(host,roof).diagnostics) add(d.code,[host.id,roof.id],d.message);
    }
  }
  const connectors = scene.interior?.circulation ?? [];
  const reservationsOnly = options.constructionEvidence === false && options.circulationReservations === true;
  // A 2D reservation chooses placement and connectivity, not a buildable flight.
  // Construction keeps the full physical checks, including sole vertical access.
  if (!reservationsOnly) for (const failure of auditV3StairUsability(scene)) add(failure.code,[failure.targetId],failure.message);
  const usable = new Set(reservationsOnly ? connectors.map(c=>c.id) : resolveV3Circulation(scene).filter(c=>c.usable).map(c=>c.entry.id));
  for (const value of bp.verticalCirculationIds) if (!connectors.some(c=>c.id===value)) add('BLUEPRINT_REFERENCE',[value],'Missing authored vertical circulation.');
  // Preliminary graph uses resolved usable endpoints; detailed physical checks run before approval.
  // Touching, explicitly connected wings share equal datums.
  const graph = new Map<string,Set<string>>(), node = (o: V3SceneObject,l: number) => `${o.id}:${l}`;
  const link = (a: string,b: string) => { graph.set(a,new Set([...(graph.get(a) ?? []),b])); graph.set(b,new Set([...(graph.get(b) ?? []),a])); };
  for (const c of connectors) {
    if (!bp.verticalCirculationIds.includes(c.id)) { add('BLUEPRINT_VERTICAL_UNPLANNED',[c.id],'Vertical circulation is absent from blueprint.'); continue; }
    const host = objects.get(c.hostMassId);
    if (host?.type!=='building-mass' || c.toLevel<=c.fromLevel || c.toLevel>v3MassLevelCount(host)) { add('BLUEPRINT_VERTICAL',[c.id],'Invalid vertical circulation host or level range.'); continue; }
    let fits = true;
    for (let l=c.fromLevel;l<=Math.min(c.toLevel,v3MassLevelCount(host)-1);l++) fits = localRectangleFits(host,c.footprint,l) && fits;
    if (!fits) { add('BLUEPRINT_VERTICAL',[c.id,host.id],'Stair/lift reservation leaves its host footprint.'); continue; }
    if (!usable.has(c.id)) continue;
    // Stairs serve their actual endpoints; only a lift stops at intermediate storeys.
    if(c.type==='lift') for (let l=c.fromLevel;l<c.toLevel;l++) link(node(host,l),node(host,l+1));
    else link(node(host,c.fromLevel),node(host,c.toLevel));
  }
  for (const a of buildings) for (const b of buildings) if (a.id<b.id && scene.relationships.some(r=>r.kind==='connects' && (r.from===a.id&&r.to===b.id || r.from===b.id&&r.to===a.id))) {
    for (let la=0;la<v3MassLevelCount(a);la++) for (let lb=0;lb<v3MassLevelCount(b);lb++) {
      const ya=getObjectBaseY(a)+v3MassStoreys(a,scene)[la].elevation, yb=getObjectBaseY(b)+v3MassStoreys(b,scene)[lb].elevation;
      if (Math.abs(ya-yb)<.05 && authoredSeparation(a,b,la,lb)<=.05) link(node(a,la),node(b,lb));
    }
  }
  for (const b of buildings) {
    const below = objects.get(hostId(b) ?? '');
    if (below?.type==='building-mass' && Math.abs(getObjectBaseY(b)-getObjectTopY(below))<.05) {
      // A connector's top must actually land within the stacked mass, not merely its host envelope.
      const landing = connectors.some(c=>usable.has(c.id) && c.hostMassId===below.id && c.toLevel===v3MassLevelCount(below) && bp.verticalCirculationIds.includes(c.id) && rectangleLandsIn(below,c.footprint,b));
      if (landing) link(node(below,v3MassLevelCount(below)),node(b,0));
      else add('BLUEPRINT_VERTICAL',[b.id,below.id],'Stacked mass has no planned vertical landing inside its footprint.');
    }
  }
  const reached = new Set<string>();
  // Each independent ground building may have its own ground access; never seed an upper stacked mass.
  for (const b of buildings) if (v3StoreyBase(b,scene)===0) reached.add(node(b,0));
  const queue = [...reached];
  for (let i=0;i<queue.length;i++) for (const next of graph.get(queue[i]) ?? []) if (!reached.has(next)) { reached.add(next); queue.push(next); }
  for (const b of buildings) for (let level=0;level<v3MassLevelCount(b);level++) if (!reached.has(node(b,level))) add('BLUEPRINT_VERTICAL',[b.id],`No planned vertical route reaches local level ${level}.`);

  const rooms = scene.interior?.rooms ?? [], storeys = scene.interior?.storeys ?? [];
  for (const s of storeys) {
    const host = objects.get(s.hostMassId);
    // V3Storey.elevation is the finished floor, as used by rooms, partitions and
    // stairs. The structural slab datum is lower by the shared slab thickness.
    if (host?.type!=='building-mass' || s.index>=v3MassLevelCount(host) || Math.abs(s.elevation-(storeys.filter(p=>p.hostMassId===host.id&&p.index<s.index).reduce((sum,p)=>sum+p.height,0)+V3_FLOOR_SLAB))>.05 || Math.abs(storeys.filter(p=>p.hostMassId===host.id).reduce((sum,p)=>sum+p.height,0)-scaledDimensionsOf(host)[1])>.05) add('BLUEPRINT_STOREYS',[s.id,s.hostMassId],'Finished-floor datum/height contradicts its constructed building level.');
  }
  for (const room of rooms) {
    const host = objects.get(room.hostMassId), storey = storeys.find(s=>s.id===room.storeyId && s.hostMassId===room.hostMassId);
    if (!host || !storey || !localRectangleFits(host,room.footprint,storey.index)) add('BLUEPRINT_SPACE_OUTSIDE_HOST',[room.id],'Allocated room must lie inside its actual host storey footprint.');
    for (const other of rooms) if (room.id<other.id && room.storeyId===other.storeyId) {
      const a=room.footprint,b=other.footprint;
      if (Math.min(a.x+a.width/2,b.x+b.width/2)-Math.max(a.x-a.width/2,b.x-b.width/2)>.01 && Math.min(a.z+a.depth/2,b.z+b.depth/2)-Math.max(a.z-a.depth/2,b.z-b.depth/2)>.01) add('BLUEPRINT_SPACE_OVERLAP',[room.id,other.id],'Two allocated rooms occupy the same floor area.');
    }
  }
  for (const a of buildings) for (const b of buildings) if (a.id<b.id) {
    let overlaps = false;
    for (let la=0;la<v3MassLevelCount(a);la++) for (let lb=0;lb<v3MassLevelCount(b);lb++) {
      const sa=v3MassStoreys(a,scene)[la],sb=v3MassStoreys(b,scene)[lb],ah=sa.height,bh=sb.height;
      const ay=getObjectBaseY(a)+sa.elevation,by=getObjectBaseY(b)+sb.elevation;
      if (ay+ah>by+.01 && by+bh>ay+.01 && authoredOverlap(a,b,la,lb)>.02) overlaps = true;
    }
    if (!overlaps) continue;
    const joined = scene.relationships.some(r=>['connects','contains','hosts','supports'].includes(r.kind) && (r.from===a.id&&r.to===b.id || r.from===b.id&&r.to===a.id))
      || plan.architecture?.some(c=>['joined','L-shaped','U-shaped'].includes(c.form) && c.objectIds.includes(a.id) && c.objectIds.includes(b.id));
    if (!joined) add('BLUEPRINT_BUILDING_OVERLAP',[a.id,b.id],'Independent building volumes overlap without an authored joining or hosting decision.');
  }
  for (const allocation of bp.allocations) {
    const req = plan.requirements.find(r=>r.id===allocation.requirementId);
    if (!req) add('BLUEPRINT_REFERENCE',[allocation.id,allocation.requirementId],'Missing requirement for allocation.');
    for (const value of allocation.objectIds) ref(value,allocation.id);
    for (const value of allocation.roomIds) if (!rooms.some(r=>r.id===value)) add('BLUEPRINT_REFERENCE',[allocation.id,value],'Missing room allocation.');
    if (req?.objectIds.some(value=>!allocation.objectIds.includes(value) && !allocation.roomIds.some(id=>rooms.find(r=>r.id===id)?.hostMassId===value))) add('BLUEPRINT_ALLOCATION',[allocation.id],'Allocation disagrees with the requirement object references.');
  }
  for (const req of plan.requirements) if (['feature','bedrooms'].includes(req.metric) && !bp.allocations.some(a=>a.requirementId===req.id)) add('BLUEPRINT_ALLOCATION',[req.id],'Required spaces/features need explicit object or room allocation.');
  // A pool cannot occupy enclosed building volume. Stacked or joined buildings
  // and overlapping garden/terrace compositions are left to their explicit contracts.
  for (const pool of scene.objects.filter(o=>o.type==='pool')) for (const b of buildings) if (authoredOverlap(pool,b)>.01 && getObjectTopY(pool)>getObjectBaseY(b) && getObjectBaseY(pool)<getObjectTopY(b)) add('BLUEPRINT_SPACE_OVERLAP',[pool.id,b.id],'Pool and building occupy the same volume.');
  return finish();
}

function rectangleLandsIn(host: V3SceneObject, rectangle: Rect, destination: V3SceneObject) {
  const c=Math.cos(host.transform.rotation[1]),s=Math.sin(host.transform.rotation[1]), a=destination.transform.rotation[1];
  const dx=host.transform.position[0]+rectangle.x*c+rectangle.z*s-destination.transform.position[0], dz=host.transform.position[2]-rectangle.x*s+rectangle.z*c-destination.transform.position[2];
  // Require the entire reservation, including rotation, within the destination.
  const rel=host.transform.rotation[1]-a, ec=Math.abs(Math.cos(rel)), es=Math.abs(Math.sin(rel));
  return localRectangleFits(destination,{x:dx*Math.cos(a)-dz*Math.sin(a),z:dx*Math.sin(a)+dz*Math.cos(a),width:rectangle.width*ec+rectangle.depth*es,depth:rectangle.width*es+rectangle.depth*ec},0);
}
