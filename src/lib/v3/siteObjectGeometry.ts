import type { V3SceneObject, V3Transform, Vec3 } from './scene';
import type { V3SiteHierarchy } from './siteHierarchy';

const vector = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));
export const hasValidV3Box = (o: V3SceneObject): boolean => vector(o.transform?.position) && vector(o.transform?.rotation) && vector(o.transform?.scale) && o.transform.scale.every(n => n > 0) && vector(o.dimensions) && o.dimensions.every(n => n > 0);
export const isV3OptionalSiteObject = (o: V3SceneObject): boolean => ['path', 'driveway', 'terrace', 'landscape-zone', 'retaining-wall', 'pool', 'deck', 'pool-deck', 'terrain-region'].includes(o.type);

/** Only explicit connection ownership grants route authority. Never infer a building footprint from its support pad. */
export function deriveV3ConnectionBox(o: V3SceneObject, hierarchy?: V3SiteHierarchy): { transform: V3Transform; dimensions: Vec3 } | undefined {
  if (!['path', 'driveway'].includes(o.type)) return undefined;
  const connections = hierarchy?.connections?.filter(c => c.surfaceObjectId === o.id) ?? [];
  if (connections.length !== 1) return undefined;
  const c = connections[0];
  const from = hierarchy?.levels?.find(l => l.id === c.fromLevelId), to = hierarchy?.levels?.find(l => l.id === c.toLevelId);
  if (!from || !to || !Number.isFinite(from.elevation) || !Number.isFinite(to.elevation) || !['path', 'driveway'].includes(c.type) || !Number.isFinite(c.width) || c.width <= 0 || !Array.isArray(c.route) || c.route.length < 2) return undefined;
  const points: Vec3[] = [];
  for (const p of c.route) {
    if (vector(p)) points.push(p);
    else if (Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number' && Number.isFinite(n))) points.push([p[0], from.elevation, p[1]]);
    else return undefined;
  }
  if (!points.some(p => Math.hypot(p[0] - points[0][0], p[2] - points[0][2]) > 0)) return undefined;
  const xs = points.map(p => p[0]), zs = points.map(p => p[2]), ys = [...points.map(p => p[1]), from.elevation, to.elevation];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const dimensions: Vec3 = [maxX - minX + c.width, Math.max(.1, maxY - minY), maxZ - minZ + c.width];
  const position: Vec3 = [minX / 2 + maxX / 2, minY / 2 + maxY / 2, minZ / 2 + maxZ / 2];
  if (!vector(position) || !vector(dimensions) || dimensions.some(n => n <= 0)) return undefined;
  return { transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions };
}
