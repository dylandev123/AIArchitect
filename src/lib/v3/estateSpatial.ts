import { resolveFootprint } from './footprint';
import { endpointFits, estateEndpoint, estateRouteAccess, estateRouteSupported, estateRouteSegments, siteAccessFits, spatialPlanPoints, spatialParts } from './routeGeometry';
import { estateAccessEvidence, isEstateDestination, type EstateAccessEvidence } from './estateAccess';
import { authoredOverlap, realizesForm, authoredSeparation } from './authoredPlan';
import type { V3Scene, V3SceneObject } from './scene';
import type { V3EstateCode } from './estatePlan';
import type { V3DesignDiagnostic } from './designReview';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { materializeV3ArchitecturalScene } from './architecture';

export { estateRoutePoints, estateRouteSupported, estateRouteSegments } from './routeGeometry';
export function auditEstateSpatial(input: V3Scene, accessEvidence?: EstateAccessEvidence): V3DesignDiagnostic[] {
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
      const points=selected.flatMap(o=>spatialPlanPoints(scene,o));
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
  const evidence = accessEvidence ?? estateAccessEvidence(scene);
  if (plan.circulation.some(r => r.spatial)) for (const entry of plan.program) {
    if (!['residence','building','amenity'].includes(entry.kind) || entry.access==='optional') continue;
    for (const id of entry.objectIds) {
      const object=scene.objects.find(o=>o.id===id);
      if (object && isEstateDestination(object) && !evidence.reached.has(id)) add('ESTATE_ACCESS_MISSING',[id],`${entry.id}: planned destination has no authored route or proven architectural passage/dry approach.`);
    }
  }
  for (const access of plan.siteAccess ?? []) if (!siteAccessFits(scene,access.id,access.point)) add('ESTATE_ACCESS_POINT_MISSING',[access.id],`${access.id}: authored site access must have a unique id and lie on its declared site boundary.`);
  for (const route of plan.circulation) {
    if (!route.spatial) continue;
    for (const side of ['from','to'] as const) {
      const object = scene.objects.find(o => o.id === route[side]);
      const point = estateEndpoint(scene,route,side);
      if (!point || !(object ? endpointFits(object,{...estateRouteAccess(scene,route,side),point},route.spatial.width,route.spatial.use,scene) : siteAccessFits(scene,route[side],point))) add('ESTATE_ACCESS_POINT_MISSING',[route[side],...route.via],`${route.id}: ${side} endpoint needs an unambiguous blueprint entrance on this host, a suitable ground-level opening or an explicit surface/site point. No entrance or route is chosen automatically.`);
    }
    if (!estateRouteSupported(scene,route)) { add('ESTATE_ROUTE_UNSUPPORTED',route.via,`${route.id}: requires one exclusive path/driveway owner and nonzero flat-ground segments without a site hierarchy; no route was invented.`); continue; }
    const segments = estateRouteSegments(scene,route);
    for (const object of scene.objects) {
      if (route.via.includes(object.id)) continue;
      const water = object.type === 'pool' || object.collision === 'water';
      const solid = object.type === 'building-mass' || object.collision === 'solid';
      if (!water && !solid) continue;
      if (spatialParts(scene,object).some(part=>segments.some(segment => authoredOverlap(segment,part)>.02 && (water || getObjectTopY(part)>segment.transform.position[1] && getObjectBaseY(part)<segment.transform.position[1]+2)))) add(water?'ESTATE_POOL_CROSSING':'ESTATE_ROUTE_BLOCKED',[...route.via,object.id],`${route.id}: route width intersects ${object.id}; an authored detour or explicit supported bridge is required.`);
    }
    if (segments.some(s => {
      const [x,,z]=s.transform.position, [w,,d]=s.dimensions, a=s.transform.rotation[1];
      return Math.abs(x)+(Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*d)/2>scene.site.width/2 || Math.abs(z)+(Math.abs(Math.sin(a))*w+Math.abs(Math.cos(a))*d)/2>scene.site.depth/2;
    })) add('ESTATE_ACCESS_DISCONNECTED',route.via,`${route.id}: route corridor leaves the site.`);
  }
  return out;
}
