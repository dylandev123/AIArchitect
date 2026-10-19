import { authoredOverlap, authoredPlan, realizesForm, authoredSeparation } from './authoredPlan';
import { segmentPoint, segmentLength } from './curvedFootprint';
import { resolveFootprint } from './footprint';
import { facadeEdgeSpan, openingEdges } from './footprintConstruction';
import type { V3Scene, V3SceneObject, Vec3 } from './scene';
import type { V3EstatePlan, V3EstateCode } from './estatePlan';
import type { V3DesignDiagnostic } from './designReview';
import { localPlan } from './reviewGeometry';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { materializeV3ArchitecturalScene } from './architecture';

type Route = V3EstatePlan['circulation'][number];
export const estateRoutePoints = (route: Route): Vec3[] => route.spatial ? [route.spatial.from.point, ...(route.spatial.waypoints ?? []), route.spatial.to.point] : [];
/** Only explicit flat routes, with one unambiguous surface owner, can use the existing ribbon compiler. */
export function estateRouteSupported(scene: V3Scene, route: Route): boolean {
  if (!route.spatial || route.via.length !== 1 || (scene.site.naturalGround && ((scene.site.naturalGround.grade??0)!==0 || scene.site.naturalGround.cliff)) || scene.siteHierarchy) return false;
  const owner = scene.objects.find(o => o.id === route.via[0]);
  const points = estateRoutePoints(route), base = scene.site.baseElevation ?? 0;
  return !!owner && ['path', 'driveway'].includes(owner.type)
    && scene.estatePlan!.circulation.filter(r => r.spatial && r.via.includes(owner.id)).length === 1
    && points.every(p => Math.abs(p[1] - base) < .01)
    && points.slice(1).every((p,i) => Math.hypot(p[0]-points[i][0],p[2]-points[i][2]) > .01);
}
export function estateRouteSegments(scene: V3Scene, route: Route): V3SceneObject[] {
  const owner = scene.objects.find(o => o.id === route.via[0]);
  if (!owner || !route.spatial) return [];
  const points = estateRoutePoints(route);
  return points.slice(1).map((b,i) => {
    const a = points[i], dx = b[0]-a[0], dz = b[2]-a[2];
    return { ...owner, architecture: undefined, dimensions: [route.spatial!.width,.1,Math.hypot(dx,dz)], transform: { position: [(a[0]+b[0])/2,a[1]+.05,(a[2]+b[2])/2], rotation: [0,Math.atan2(dx,dz),0], scale: [1,1,1] } };
  });
}
function endpointFits(object: V3SceneObject, access: NonNullable<Route['spatial']>['from'], width: number, use: string): boolean {
  const [x,z] = localPlan(object,[access.point[0],access.point[2]]), [w,,d] = scaledDimensionsOf(object);
  if (Math.abs(access.point[1]-(object.type === 'building-mass' ? getObjectBaseY(object) : getObjectTopY(object))) > .25) return false;
  if (object.type !== 'building-mass') return Math.abs(x)<=w/2+.25 && Math.abs(z)<=d/2+.25;
  const op = object.composition?.openings?.find(o => o.id === access.openingId);
  if (!op || !['door','glazed-door'].includes(op.type) || op.floors === 'upper' || !('start' in op)) return false;
  if(object.composition?.footprint?.kind==='outline'){
    const segment=object.composition.footprint.segments?.find(s=>s.id===op.segmentId);if(!segment||!resolveFootprint(object,0))return false;
    const count=Math.max(2,Math.ceil(segmentLength(segment)*(op.end-op.start)/.1));
    const distance=Math.min(...Array.from({length:count+1},(_,i)=>{const p=segmentPoint(segment,op.start+(op.end-op.start)*i/count);return Math.hypot(p[0]-x,p[1]-z);}));
    return distance<=.25&&(op.end-op.start)*segmentLength(segment)>=(use==='pedestrian'?Math.min(width,.8):width);
  }
  if (object.composition?.footprint) {
    const fp=resolveFootprint(object,0); if(!fp)return false;
    const horizontal=op.facade==='north'||op.facade==='south',span=horizontal?fp.frame.width:fp.frame.depth;
    const lx=x-fp.frame.x,lz=z-fp.frame.z,along=(horizontal?lx:lz)/span+.5;
    const edges=openingEdges(fp.edges,op.facade,op.start,op.end,fp.frame.width,fp.frame.depth);
    if(edges.length!==1)return false;
    const edge=edges[0],a=facadeEdgeSpan(edge,fp.frame.width,fp.frame.depth);
    return Math.abs((horizontal?lz:lx)-(horizontal?edge.a[1]:edge.a[0]))<=.25 && along>=Math.max(op.start,a.start) && along<=Math.min(op.end,a.end) && (Math.min(op.end,a.end)-Math.max(op.start,a.start))*span >= (use==='pedestrian'?Math.min(width,.8):width);
  }
  const horizontal = op.facade === 'north' || op.facade === 'south', span = horizontal ? w : d;
  // Match compileV3Composition: north/south run +X; east/west run +Z.
  const along = (horizontal ? x : z) / span + .5;
  const edge = op.facade === 'north' ? -d/2 : op.facade === 'south' ? d/2 : op.facade === 'east' ? w/2 : -w/2;
  const clearance = use === 'pedestrian' ? Math.min(width,.8) : width;
  return Math.abs((horizontal ? z : x)-edge) <= .25 && along >= op.start && along <= op.end && (op.end-op.start)*span >= clearance;
}
export function auditEstateSpatial(input: V3Scene): V3DesignDiagnostic[] {
  const scene = materializeV3ArchitecturalScene(input), plan = scene.estatePlan;
  if (!plan) return [];
  const out: V3DesignDiagnostic[] = [];
  const add = (code: V3EstateCode, ids: string[], message: string) => out.push({code,severity:'significant',targetIds:ids,message,guidance:'Preserve architectural intent and unrelated geometry. Correct only this authored route or missing access. Unsupported forms require a future geometry capability; never substitute boxes or erase commitments.'});
  for (const claim of plan.architecture ?? []) {
    const objects = claim.objectIds.map(id => scene.objects.find(o => o.id === id));
    for (const id of claim.objectIds.filter((_,i) => !objects[i])) add('ESTATE_MISSING_OBJECT',[id],`${claim.id}: missing architectural commitment object.`);
    const unsupported = claim.form==='complex-roof'&&objects.some(o=>!o||o.unsupportedIntent?.roofForm) || ['circular','curved'].includes(claim.form)&&!objects.every(o=>o&&realizesForm(o,claim.form)) || ['polygonal','irregular'].includes(claim.form) && !objects.every(o=>o?.composition?.footprint && resolveFootprint(o,0)) && (claim.form==='polygonal'||objects.length<2);
    if (unsupported) add('ESTATE_FORM_UNBUILT',claim.objectIds,`${claim.id}: ${claim.form} intent lacks matching constructed footprint/roof geometry. Author supported semantic geometry; labels and proxies are not construction.`);
    if(claim.form==='complex-roof'&&!unsupported)out.push({code:'ESTATE_REQUIREMENT_UNVERIFIED',severity:'advisory',targetIds:claim.objectIds,message:`${claim.id}: supported individual roof forms are present; arbitrary roof intersections and the subjective complexity claim are not certified.`,guidance:'Preserve supported roof choices; inspect junctions without inventing a new roof system.'});
    const selected=objects.filter((o):o is V3SceneObject=>!!o);
    if(selected.length){
      // Minimum dimensions describe the named composition, not every component
      // (a roof plate need not independently satisfy the residence's height).
      const points=selected.flatMap(o=>authoredPlan(o));
      const [w,h,d]=selected.length===1?scaledDimensionsOf(selected[0]):[
        Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),
        Math.max(...selected.map(getObjectTopY))-Math.min(...selected.map(getObjectBaseY)),
        Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])),
      ];
      if(w<(claim.minWidth??0)||d<(claim.minDepth??0)||h<(claim.minHeight??0))add('ESTATE_REQUIREMENT_CONFLICT',claim.objectIds,`${claim.id}: authored ${w} × ${d} × ${h}m composition does not meet its declared architectural scale.`);
    }
    if (['joined','L-shaped','U-shaped'].includes(claim.form)&&(claim.form==='joined'||!objects.every(o=>o&&realizesForm(o,'polygonal')))) {
      const masses = objects.filter((o): o is V3SceneObject => !!o && (claim.form==='joined' || o.type === 'building-mass'));
      const reached = new Set(masses.slice(0,1));
      for (let n=0;n<masses.length;n++) for (const o of masses) if ([...reached].some(a => authoredSeparation(a,o)<=.05)) reached.add(o);
      if (masses.length < (claim.form === 'U-shaped' ? 3 : 2) || reached.size !== masses.length) add('ESTATE_FORM_UNBUILT',claim.objectIds,`${claim.id}: declared connected composition lacks touching authored objects.`);
      // Connectivity is necessary, not sufficient to certify an L/U silhouette.
      out.push({code:'ESTATE_REQUIREMENT_UNVERIFIED',severity:'advisory',targetIds:claim.objectIds,message:`${claim.id}: composition connectivity checked; exact ${claim.form} silhouette and roof intersections require review.`,guidance:'Inspect the authored composition; preserve valid creative choices.'});
    }
  }
  const namedIntent = [plan.concept, ...plan.requirements.map(r=>r.statement)].join(' ');
  if (/\b(circular|curved|polygonal)\s+(mansion|house|residence|building)\b/i.test(namedIntent) && !out.some(d=>d.code==='ESTATE_FORM_UNBUILT') && !scene.objects.some(o=>realizesForm(o,/circular/i.test(namedIntent)?'circular':/curved/i.test(namedIntent)?'curved':'polygonal'))) {
    add('ESTATE_FORM_UNBUILT',plan.program.filter(p=>p.kind==='residence').flatMap(p=>p.objectIds),'Estate concept explicitly requests a nonrectangular building; current mass geometry cannot fulfill it.');
  }
  for (const o of scene.objects.filter(o => o.type === 'building-mass')) if (/\b(circular|curved|polygonal)\b/i.test(`${o.label} ${o.semanticRole}`) && !realizesForm(o,/circular/i.test(`${o.label} ${o.semanticRole}`)?'circular':/curved/i.test(`${o.label} ${o.semanticRole}`)?'curved':'polygonal') && !plan.architecture?.some(c=>c.objectIds.includes(o.id) && ['circular','curved','polygonal'].includes(c.form))) add('ESTATE_FORM_UNBUILT',[o.id],`${o.id}: named nonrectangular building intent compiles as a rectangular mass.`);
  if (plan.circulation.some(r => r.spatial)) for (const entry of plan.program) {
    if (!['residence','building','amenity'].includes(entry.kind)) continue;
    for (const id of entry.objectIds) if (!plan.circulation.some(r => r.from === id || r.to === id)) add('ESTATE_ACCESS_MISSING',[id],`${entry.id}: planned destination has no authored estate access route.`);
  }
  for (const route of plan.circulation) {
    if (!route.spatial) continue;
    if (!estateRouteSupported(scene,route)) { add('ESTATE_ROUTE_UNSUPPORTED',route.via,`${route.id}: requires one exclusive path/driveway owner and nonzero flat-ground segments without a site hierarchy; no route was invented.`); continue; }
    for (const side of ['from','to'] as const) {
      const object = scene.objects.find(o => o.id === route[side]);
      if (!object || !endpointFits(object,route.spatial[side],route.spatial.width,route.spatial.use)) add('ESTATE_ACCESS_POINT_MISSING',[route[side],...route.via],`${route.id}: ${side} endpoint does not meet its destination surface or a suitable ground-level opening.`);
    }
    const segments = estateRouteSegments(scene,route);
    for (const object of scene.objects) {
      if (route.via.includes(object.id)) continue;
      const water = object.type === 'pool' || object.collision === 'water';
      const solid = object.type === 'building-mass' || object.collision === 'solid';
      if (!water && !solid) continue;
      if (segments.some(segment => authoredOverlap(segment,object)>.02 && (water || getObjectTopY(object)>segment.transform.position[1] && getObjectBaseY(object)<segment.transform.position[1]+2))) add(water?'ESTATE_POOL_CROSSING':'ESTATE_ROUTE_BLOCKED',[...route.via,object.id],`${route.id}: route width intersects ${object.id}; an authored detour or explicit supported bridge is required.`);
    }
    if (segments.some(s => {
      const [x,,z]=s.transform.position, [w,,d]=s.dimensions, a=s.transform.rotation[1];
      return Math.abs(x)+(Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*d)/2>scene.site.width/2 || Math.abs(z)+(Math.abs(Math.sin(a))*w+Math.abs(Math.cos(a))*d)/2>scene.site.depth/2;
    })) add('ESTATE_ACCESS_DISCONNECTED',route.via,`${route.id}: route corridor leaves the site.`);
  }
  return out;
}
