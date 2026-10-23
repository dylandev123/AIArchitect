/** Recoverable 2D planning. A localized defect withholds ONLY its own object; the rest of
 * the estate stays an editable draft. Nothing is moved, deleted, substituted or invented:
 * the authored value is retained verbatim as an unresolved item beside the draft.
 *
 * Classification (plan stage only; construction acceptance is unchanged):
 *  - core-blocking: schema, ambiguous identity, building footprint/site bounds/overlap,
 *    anything not listed below. The core layout cannot be represented faithfully.
 *  - route/feature/adjacency-unresolved: the single object cannot be represented; it is
 *    withheld, kept in `planUnresolved`, and every finding that merely follows from it is
 *    downgraded to advisory.
 *  - draft-tolerable: drawn exactly as authored with a diagnostic (entrance wall address,
 *    feature outside the site, missing entrance/access, room conflicts).
 */
import type { V3BlueprintFinding } from './blueprint';
import type { V3Scene, V3SceneObject } from './scene';
import { architecturalDraftFinding } from './architecturalAcceptance';
import { authoredPlan, type PlanPoint } from './authoredPlan';
import { plannedDrySurface } from './plannedSiteGeometry';

export type UnresolvedPlanKind = 'connection' | 'feature' | 'adjacency';
/** `raw` is the authored (identity-normalized) value, unchanged, ready to be re-inserted into a plan. */
export interface UnresolvedPlanItem { kind: UnresolvedPlanKind; id: string; raw: unknown; findings: V3BlueprintFinding[]; }

/** Route-attributable audit findings. Never tolerated by drawing a guessed path. */
export const ROUTE_FAILURE_CODES = new Set(['ESTATE_ROUTE_BLOCKED', 'ESTATE_POOL_CROSSING', 'ESTATE_ROUTE_UNSUPPORTED', 'ESTATE_ACCESS_POINT_MISSING', 'ESTATE_ACCESS_DISCONNECTED']);
const POINT_TOLERANCE = .001;
/** A contact this deep inside water is a pool endpoint; shallower is the shared coping edge. */
const WATER_INTERIOR = .05;

const edgeDistance = (p: PlanPoint, polygon: PlanPoint[]) => Math.min(...polygon.map((a, i) => {
  const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dz = b[1] - a[1], len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}));
const inside = (p: PlanPoint, polygon: PlanPoint[]) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
};
/** Containment in the authored boundary, counting its edge. */
export const planContains = (object: V3SceneObject, p: PlanPoint, margin = POINT_TOLERANCE) => {
  const polygon = authoredPlan(object);
  return inside(p, polygon) || edgeDistance(p, polygon) <= margin;
};
const planInterior = (object: V3SceneObject, p: PlanPoint) => {
  const polygon = authoredPlan(object);
  return inside(p, polygon) && edgeDistance(p, polygon) > WATER_INTERIOR;
};

export type EndpointTriage =
  | { status: 'ok' }
  | { status: 'reseat'; objectId: string; local: [number, number] }
  | { status: 'unresolved'; code: string; message: string };

/** One authored surface contact against the lowered scene. Only a world point that lies on exactly
 * one dry surface can be re-addressed; the point itself, and so the walkway, never moves. */
export function triageSurfaceEndpoint(scene: V3Scene, plannedIds: ReadonlySet<string>, endpoint: {objectId: string; local: [number, number]}): EndpointTriage {
  const target = scene.objects.find(o => o.id === endpoint.objectId);
  if (!target) return { status: 'unresolved', code: 'PLAN_REFERENCE', message: `Route endpoint names ${endpoint.objectId}, which is not a retained feature.` };
  const a = target.architecture, yaw = a?.rotationY ?? 0, [lx, lz] = endpoint.local;
  if (!a) return { status: 'unresolved', code: 'PLAN_REFERENCE', message: `${target.id} has no authored boundary.` };
  const world: PlanPoint = [a.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), a.z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
  const featureSurfaces = scene.objects.filter(o => plannedIds.has(o.id));
  const dry = (o: V3SceneObject) => plannedDrySurface(o.type) && o.collision !== 'water';
  if (dry(target) && planContains(target, world)) return { status: 'ok' };
  const water = featureSurfaces.filter(o => (o.type === 'pool' || o.collision === 'water') && planInterior(o, world));
  const candidates = featureSurfaces.filter(o => o.id !== target.id && dry(o) && planContains(o, world));
  const why = !dry(target)
    ? `${target.id} (${target.type}) is not a dry surface, so a route cannot end there.`
    : `Contact lies outside the authored boundary of ${target.id}.`;
  if (water.length) return { status: 'unresolved', code: 'PLAN_REFERENCE', message: `${why} The contact point lies in water (${water.map(o => o.id).join(', ')}); no dry destination was chosen.` };
  if (candidates.length > 1) return { status: 'unresolved', code: 'PLAN_ENDPOINT_AMBIGUOUS', message: `${why} The contact lies on several dry surfaces (${candidates.map(o => o.id).join(', ')}); choose one.` };
  const other = candidates[0], oa = other?.architecture;
  if (other && oa && Math.abs(oa.baseElevation - a.baseElevation) < .01) {
    const dx = world[0] - oa.x, dz = world[1] - oa.z, oy = oa.rotationY ?? 0, clean = (v: number) => Math.round(v * 1e10) / 1e10;
    return { status: 'reseat', objectId: other.id, local: [clean(dx * Math.cos(oy) - dz * Math.sin(oy)), clean(dx * Math.sin(oy) + dz * Math.cos(oy))] };
  }
  return { status: 'unresolved', code: dry(target) ? 'PLAN_CONTACT' : 'PLAN_REFERENCE', message: `${why} No other authored dry surface contains this contact, so no destination was chosen.` };
}

/** Plan-stage tolerance, in addition to the construction acceptance exceptions. Each rule is
 * limited to findings about objects that exist and are drawn exactly as authored. */
export function planDraftFinding(scene: V3Scene, f: V3BlueprintFinding, failures: V3BlueprintFinding[]): boolean {
  if (architecturalDraftFinding(scene, f, failures)) return true;
  const object = (id: string | undefined) => scene.objects.find(o => o.id === id);
  switch (f.code) {
    // The entrance stays as authored; any route that needed its wall address is unresolved.
    case 'BLUEPRINT_ENTRANCE_WALL': case 'BLUEPRINT_ENTRANCE':
      return object(f.targetIds[0])?.type === 'building-mass' && !!object(f.targetIds[0])?.composition?.openings?.some(op => op.id === f.targetIds[1]);
    case 'PLAN_ENTRANCE': return object(f.targetIds[0])?.type === 'building-mass';
    // Destinations without a route are a design gap, not an unrepresentable layout.
    case 'ESTATE_ACCESS_MISSING': return f.targetIds.length > 0 && f.targetIds.every(id => !!object(id));
    // Site features may overhang the boundary; a building outside it is never accepted here.
    case 'BLUEPRINT_SITE_BOUNDS': return f.targetIds.length === 1 && !!object(f.targetIds[0]) && object(f.targetIds[0])!.type !== 'building-mass';
    case 'ESTATE_ACCESS_POINT_MISSING': return f.targetIds.length === 1 && !!scene.estatePlan?.siteAccess?.some(a => a.id === f.targetIds[0]);
    default: return false;
  }
}
