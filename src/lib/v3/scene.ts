import type { HouseModel, HousePrimitive, PrimitiveCategory, TriMeshPrimitive } from "@/lib/house/types";
import { resolveSiteHierarchy, routeLength, type V3SiteHierarchy, type V3SupportRef } from "./siteHierarchy";
import { sampleFinalTerrainHeight, scaledDimensionsOf } from "./elevation";

export const V3_SCENE_VERSION = 3 as const;
export type V3ObjectType = "volume" | "wall" | "slab" | "surface" | "glass-panel" | "opening" | "column" | "beam" | "railing" | "stair" | "ramp" | "roof" | "canopy" | "path" | "retaining-wall" | "fence" | "gate" | "terrain-region" | "pool" | "water-surface" | "proxy-asset" | "native-asset" | "light";
export type V3CollisionClass = "solid" | "walkable" | "passable" | "water" | "none";
export type V3TerrainOperation = "slopeRegion" | "raiseRegion" | "lowerRegion" | "createTerrace" | "cutIntoSlope" | "gradePath";
export type Vec3 = [number, number, number];
export interface V3Material { id: string; color: string; roughness?: number; metalness?: number; opacity?: number; surface?: "concrete" | "stone" | "wood" | "glass" | "metal" | "stucco" | "paving" | "water" | "grass"; }
export interface V3Transform { position: Vec3; rotation: Vec3; scale: Vec3; }
export interface V3SceneObject {
  id: string; type: V3ObjectType; semanticRole: string; label: string; transform: V3Transform; dimensions: Vec3; material: V3Material; collision?: V3CollisionClass;
  parentId?: string; groupId?: string; hostId?: string; source?: { kind: "proxy" | "glb" | "native"; assetId?: string; replaceable?: boolean };
  terrain?: { operation: V3TerrainOperation; rise?: number; direction?: "x" | "z" | "-x" | "-z" };
  /** Explicit authored physical relationship. `hostId` remains a legacy attachment alias. */
  support?: V3SupportRef;
  /** Explicit endpoints for vertical connectors; each names a site level or support object. */
  fromSupportId?: string;
  toSupportId?: string;
  metadata?: Record<string, string | number | boolean>;
}
export interface V3SceneSite { width: number; depth: number; baseElevation?: number; groundMaterial?: V3Material; }
export interface V3Relationship { from: string; to: string; kind: "supports" | "contains" | "aligns" | "connects" | "hosts"; }
export interface V3Usage { inputTokens?: number; outputTokens?: number; totalTokens?: number; attempts: number; estimatedCost?: number; contextBytes?: number; schemaBytes?: number; repair: boolean; }
export interface V3Scene { version: typeof V3_SCENE_VERSION; site: V3SceneSite; siteHierarchy?: V3SiteHierarchy; objects: V3SceneObject[]; relationships: V3Relationship[]; metadata: { brief?: string; generatedAt?: string; usage?: V3Usage; [key: string]: unknown }; }
export interface V3ProjectRoot { version: 3; generationMode: "v3-scene"; v3Scene: V3Scene; }
export const BLANK_V3_SCENE: V3ProjectRoot = { version: 3, generationMode: "v3-scene", v3Scene: { version: 3, site: { width: 180, depth: 180, baseElevation: 0 }, objects: [], relationships: [], metadata: {} } };
export function isV3ProjectRoot(raw: unknown): raw is V3ProjectRoot { return !!raw && typeof raw === "object" && (raw as { generationMode?: unknown }).generationMode === "v3-scene" && (raw as { v3Scene?: { version?: unknown } }).v3Scene?.version === 3; }

const categoryFor = (type: V3ObjectType): PrimitiveCategory => {
  if (type === "roof" || type === "canopy") return "roof";
  if (type === "wall" || type === "retaining-wall" || type === "fence" || type === "gate") return type === "retaining-wall" ? "retainingWall" : "wall";
  if (type === "slab" || type === "surface") return "floor";
  if (type === "glass-panel" || type === "opening") return "window";
  if (type === "stair" || type === "ramp") return "stairs";
  if (type === "path") return "path";
  if (type === "pool" || type === "water-surface") return "pool";
  if (type === "terrain-region") return "landscape";
  return "building";
};
const renderSurface = (surface: V3Material["surface"]): HousePrimitive extends { surface?: infer S } ? S : never => surface === "paving" ? "tile" as never : (surface === "water" || surface === "grass" ? undefined : surface) as never;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
type P2 = [number, number];
function dimensionsOf(o: V3SceneObject): Vec3 { return scaledDimensionsOf(o); }
function localPoint(o: V3SceneObject, x: number, z: number): P2 {
  const [ox, , oz] = o.transform.position, a = o.transform.rotation[1], c = Math.cos(a), s = Math.sin(a), dx = x - ox, dz = z - oz;
  return [dx * c - dz * s, dx * s + dz * c];
}
export interface V3TerrainSurface { heightAt(x: number, z: number): number; material: V3Material; vertices: number[]; bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; }
function excludesTerrain(o: V3SceneObject, x: number, z: number) {
  if (o.type === "volume" && o.metadata?.embedded === true) return false;
  if (!["volume", "slab", "surface", "pool", "water-surface"].includes(o.type)) return false;
  const [lx, lz] = localPoint(o, x, z), [w, , d] = dimensionsOf(o);
  return Math.abs(lx) < w / 2 && Math.abs(lz) < d / 2;
}
/** One coherent, sampled terrain surface, with terrain regions applied in authored order. */
export function buildV3TerrainSurface(scene: V3Scene): V3TerrainSurface {
  const modifiers = scene.objects.filter((o) => o.type === "terrain-region" && o.terrain);
  const material = modifiers.at(-1)?.material ?? scene.site.groundMaterial ?? { id: "ground", color: "#4a6b42", surface: "grass" as const };
  const minX = -scene.site.width / 2, maxX = scene.site.width / 2, minZ = -scene.site.depth / 2, maxZ = scene.site.depth / 2;
  // This is intentionally the same final sampler support resolution and validation use.
  const terrainWithLevels = (x: number, z: number) => sampleFinalTerrainHeight(x, z, scene);
  const step = clamp(Math.max(scene.site.width, scene.site.depth) / 72, 1.5, 2.5), columns = Math.ceil((maxX - minX) / step), rows = Math.ceil((maxZ - minZ) / step);
  const at = (column: number, row: number): P2 => [minX + (maxX - minX) * column / columns, minZ + (maxZ - minZ) * row / rows], vertices: number[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = at(column, row), b = at(column + 1, row), c = at(column + 1, row + 1), d = at(column, row + 1);
    if (scene.objects.some((o) => excludesTerrain(o, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2))) continue;
    vertices.push(a[0], terrainWithLevels(...a), a[1], b[0], terrainWithLevels(...b), b[1], c[0], terrainWithLevels(...c), c[1], a[0], terrainWithLevels(...a), a[1], c[0], terrainWithLevels(...c), c[1], d[0], terrainWithLevels(...d), d[1]);
  }
  return { heightAt: terrainWithLevels, material, vertices, bounds: { minX, maxX, minZ, maxZ } };
}
function pathRibbon(o: V3SceneObject, terrain: V3TerrainSurface): TriMeshPrimitive {
  const [w, , length] = dimensionsOf(o), [x, , z] = o.transform.position, angle = o.transform.rotation[1], sx = Math.sin(angle), cz = Math.cos(angle), count = Math.max(2, Math.ceil(length / 2)), vertices: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = -length / 2 + length * i / count, b = -length / 2 + length * (i + 1) / count;
    const p: P2[] = [[x-w/2*cz+a*sx,z+w/2*sx+a*cz],[x+w/2*cz+a*sx,z-w/2*sx+a*cz],[x+w/2*cz+b*sx,z-w/2*sx+b*cz],[x-w/2*cz+b*sx,z+w/2*sx+b*cz]], y = p.map((point) => terrain.heightAt(...point) + .055);
    vertices.push(p[0][0],y[0],p[0][1],p[1][0],y[1],p[1][1],p[2][0],y[2],p[2][1],p[0][0],y[0],p[0][1],p[2][0],y[2],p[2][1],p[3][0],y[3],p[3][1]);
  }
  return { kind: "triMesh", id: o.id, category: "path", label: o.label, vertices, color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: o.material.opacity !== undefined && o.material.opacity < 1, opacity: o.material.opacity, surface: renderSurface(o.material.surface) };
}
function connectionRibbon(scene: V3Scene, connection: NonNullable<V3Scene["siteHierarchy"]>["connections"][number]): TriMeshPrimitive | undefined {
  const { hierarchy } = resolveSiteHierarchy(scene), resolvedConnection = hierarchy.connections.find((candidate) => candidate.id === connection.id);
  if (!resolvedConnection || resolvedConnection.route.length < 2) return undefined;
  const length = routeLength(resolvedConnection.route);
  if (length <= 0) return undefined;
  const vertices: number[] = [], half = resolvedConnection.width / 2;
  for (let index = 0; index < resolvedConnection.route.length - 1; index++) {
    const a = resolvedConnection.route[index], b = resolvedConnection.route[index + 1], dx = b[0] - a[0], dz = b[2] - a[2], segment = Math.hypot(dx, dz);
    if (segment <= 0) continue;
    const nx = -dz / segment * half, nz = dx / segment * half;
    const y0 = a[1] + .055, y1 = b[1] + .055;
    vertices.push(a[0]+nx,y0,a[2]+nz,a[0]-nx,y0,a[2]-nz,b[0]-nx,y1,b[2]-nz,a[0]+nx,y0,a[2]+nz,b[0]-nx,y1,b[2]-nz,b[0]+nx,y1,b[2]+nz);
  }
  if (!vertices.length) return undefined;
  const surface = connection.surfaceObjectId ? scene.objects.find((object) => object.id === connection.surfaceObjectId)?.material : undefined;
  return { kind: "triMesh", id: `v3-connection-${connection.id}`, category: connection.type === "driveway" || connection.type === "path" ? "path" : "stairs", label: `${connection.type} ${connection.id}`, vertices, color: surface?.color ?? (connection.type === "driveway" ? "#383838" : "#a69d8d"), roughness: surface?.roughness ?? .84, metalness: surface?.metalness ?? 0, surface: "tile" };
}
function poolSurface(o: V3SceneObject): TriMeshPrimitive {
  const [w, , d] = dimensionsOf(o), [x, y, z] = o.transform.position, hw = w / 2, hd = d / 2;
  return { kind: "triMesh", id: o.id + "-water", category: "pool", label: o.label + " Water", vertices: [x-hw,y,z-hd,x+hw,y,z-hd,x+hw,y,z+hd,x-hw,y,z-hd,x+hw,y,z+hd,x-hw,y,z+hd], color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: true, opacity: o.material.opacity ?? .86, surface: renderSurface(o.material.surface) };
}
function terrainLine(o: V3SceneObject, terrain: V3TerrainSurface, retaining: boolean): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), alongX = w >= d, length = alongX ? w : d, thickness = alongX ? d : w, segments = Math.max(1, Math.ceil(length / 3)), out: HousePrimitive[] = [];
  for (let i = 0; i < segments; i++) {
    const start = -length / 2 + length * i / segments, end = -length / 2 + length * (i + 1) / segments, middle = (start + end) / 2, a = o.transform.rotation[1], c = Math.cos(a), s = Math.sin(a);
    const point = (along: number, side: number): P2 => alongX ? [o.transform.position[0] + along*c - side*s,o.transform.position[2] + along*s + side*c] : [o.transform.position[0] + side*c + along*s,o.transform.position[2] + side*s - along*c];
    const left = point(middle, thickness / 2 + .2), right = point(middle, -thickness / 2 - .2), ground = Math.min(terrain.heightAt(...left), terrain.heightAt(...right)), top = retaining ? Math.max(terrain.heightAt(...left), terrain.heightAt(...right)) + .1 : ground + h, height = Math.max(retaining ? .35 : h, top - ground), center = point(middle, 0);
    out.push({ kind: "box", id: segments === 1 ? o.id : o.id + "-" + (i + 1), category: categoryFor(o.type), label: o.label, position: [center[0], ground + height / 2, center[1]], rotation: [0, a, 0], size: alongX ? [end-start,height,thickness] : [thickness,height,end-start], color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: o.material.opacity !== undefined && o.material.opacity < 1, opacity: o.material.opacity, surface: renderSurface(o.material.surface) });
  }
  return out;
}
export interface V3CompileOptions { debug?: boolean; }
/** Scene-first compiler: terrain intent becomes a shared heightfield, while architectural elevations remain authored. */
export function compileV3Scene(scene: V3Scene, options: V3CompileOptions = {}): HouseModel {
  const terrain = buildV3TerrainSurface(scene), primitives: HousePrimitive[] = [];
  if (terrain.vertices.length) primitives.push({ kind: "triMesh", id: "v3-terrain-surface", category: "landscape", label: "V3 Terrain Surface", vertices: terrain.vertices, color: terrain.material.color, roughness: terrain.material.roughness, metalness: terrain.material.metalness, surface: renderSurface(terrain.material.surface) });
  const authoredConnectionSurfaceIds = new Set(resolveSiteHierarchy(scene).hierarchy.connections.map((connection) => connection.surfaceObjectId).filter((id): id is string => !!id));
  for (const connection of resolveSiteHierarchy(scene).hierarchy.connections) {
    const ribbon = connectionRibbon(scene, connection);
    if (ribbon) primitives.push(ribbon);
  }
  for (const o of scene.objects) {
    if (o.type === "terrain-region") continue;
    if (o.type === "path") { if (!authoredConnectionSurfaceIds.has(o.id)) primitives.push(pathRibbon(o, terrain)); continue; }
    if (o.type === "pool") { primitives.push(poolSurface(o)); continue; }
    if (o.type === "retaining-wall" || o.type === "fence") { primitives.push(...terrainLine(o, terrain, o.type === "retaining-wall")); continue; }
    if (o.type === "gate" && o.metadata?.followsTerrain) { primitives.push(...terrainLine(o, terrain, false)); continue; }
    const transparent = o.type === "glass-panel" || o.type === "water-surface" || o.material.opacity !== undefined && o.material.opacity < 1;
    primitives.push({ kind: "box", id: o.id, category: categoryFor(o.type), label: o.label, position: o.transform.position, rotation: o.transform.rotation, size: dimensionsOf(o), color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent, opacity: o.material.opacity, bevel: o.type === "volume" || o.type === "proxy-asset" ? .08 : undefined, surface: renderSurface(o.material.surface) });
  }
  if (options.debug && process.env.NODE_ENV !== "production") for (const level of resolveSiteHierarchy(scene).hierarchy.levels) {
    primitives.push({ kind: "box", id: "v3-debug-level-" + level.id, category: "landscape", label: `${level.id} @ ${level.elevation.toFixed(1)}m`, position: [level.region.x, level.elevation + .03, level.region.z], rotation: [0, level.region.rotation ?? 0, 0], size: [level.region.width, .06, level.region.depth], color: "#ff00ff", transparent: true, opacity: .22 });
  }
  if (options.debug && process.env.NODE_ENV !== "production") for (const o of scene.objects.filter((candidate) => candidate.type === "terrain-region")) {
    const [w, , d] = dimensionsOf(o), [x, y, z] = o.transform.position;
    primitives.push({ kind: "box", id: "v3-debug-" + o.id, category: "landscape", label: o.id + ": " + o.semanticRole, position: [x, y, z], rotation: o.transform.rotation, size: [w, .06, d], color: "#ff00ff", transparent: true, opacity: .28 });
  }
  return { id: "v3-scene", primitives };
}
export interface V3CompiledGeometryAudit { ok: boolean; errors: string[]; warnings: string[]; }
/** Objective compiler integrity pass: finite/bounds checks, never an aesthetic judge. */
export function validateV3CompiledGeometry(scene: V3Scene, model = compileV3Scene(scene), options: { lenient?: boolean } = {}): V3CompiledGeometryAudit {
  const errors: string[] = [], warnings: string[] = [];
  // Non-finite/incomplete geometry is always an error. Envelope/bounds findings are only warnings in lenient (render-first) mode.
  const physical = options.lenient ? warnings : errors;
  for (const p of model.primitives) {
    const values = p.kind === "box" ? [...p.position, ...p.size, ...p.rotation] : p.vertices;
    if (!values.every(Number.isFinite)) errors.push(p.id + " has non-finite compiled geometry.");
    if (p.kind === "triMesh" && p.vertices.length % 9 !== 0) errors.push(p.id + " has incomplete triangles.");
  }
  const siteLimit = Math.max(scene.site.width, scene.site.depth) * 1.25, ground = model.primitives.find((p) => p.id === "v3-terrain-surface");
  if (ground?.kind === "triMesh" && ground.vertices.some((v, i) => i % 3 !== 1 && Math.abs(v) > siteLimit)) physical.push("Terrain geometry exceeds site bounds.");
  const connectionSurfaceIds = new Set(resolveSiteHierarchy(scene).hierarchy.connections.flatMap((connection) => connection.surfaceObjectId ? [connection.surfaceObjectId] : []));
  for (const o of scene.objects.filter((candidate) => candidate.type === "path")) {
    if (connectionSurfaceIds.has(o.id)) continue;
    const p = model.primitives.find((candidate) => candidate.id === o.id);
    if (p?.kind !== "triMesh") { physical.push(o.id + " did not compile as a path ribbon."); continue; }
    const [w, , d] = dimensionsOf(o), allowance = Math.max(w, d) * .08 + .25;
    let outside = false;
    for (let i = 0; i < p.vertices.length; i += 3) {
      const [lx, lz] = localPoint(o, p.vertices[i], p.vertices[i + 2]);
      if (Math.abs(lx) > w / 2 + allowance || Math.abs(lz) > d / 2 + allowance) outside = true;
    }
    if (outside) physical.push(o.id + " extends outside its authored path envelope.");
  }
  // Ordinary primitives must retain their authored, bounded box rather than acquiring an accidental scale/offset.
  for (const o of scene.objects.filter((candidate) => !["terrain-region", "path", "pool", "retaining-wall", "fence"].includes(candidate.type))) {
    const p = model.primitives.find((candidate) => candidate.id === o.id);
    if (p?.kind !== "box") continue;
    const expected = dimensionsOf(o);
    if (p.size.some((value, index) => value > expected[index] + .001) || p.position.some((value, index) => Math.abs(value - o.transform.position[index]) > .001)) physical.push(o.id + " compiled outside its authored bounds.");
  }
  for (const o of scene.objects.filter((candidate) => candidate.type === "retaining-wall" || candidate.type === "fence")) if (!model.primitives.some((p) => p.id === o.id || p.id.startsWith(o.id + "-"))) physical.push(o.id + " has no terrain-following compiled geometry.");
  if (!ground) warnings.push("Scene has no visible terrain surface.");
  return { ok: errors.length === 0, errors, warnings };
}
export function v3SceneCameraEnvelope(scene: V3Scene): { width: number; depth: number; height: number } {
  const extents = scene.objects.reduce((box, o) => {
    const [x, y, z] = o.transform.position, [w, h, d] = dimensionsOf(o);
    return { minX: Math.min(box.minX, x-w/2), maxX: Math.max(box.maxX, x+w/2), minY: Math.min(box.minY, y-h/2), maxY: Math.max(box.maxY, y+h/2), minZ: Math.min(box.minZ, z-d/2), maxZ: Math.max(box.maxZ, z+d/2) };
  }, { minX: -scene.site.width/4, maxX: scene.site.width/4, minY: 0, maxY: 10, minZ: -scene.site.depth/4, maxZ: scene.site.depth/4 });
  return { width: Math.max(8, extents.maxX-extents.minX), depth: Math.max(8, extents.maxZ-extents.minZ), height: Math.max(4, extents.maxY-extents.minY) };
}
export const v3ObjectSummary = (o: V3SceneObject) => ({ id: o.id, type: o.type, role: o.semanticRole, position: o.transform.position, dimensions: o.dimensions, material: o.material.id, groupId: o.groupId, hostId: o.hostId });
