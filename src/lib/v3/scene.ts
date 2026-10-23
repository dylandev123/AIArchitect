import { compileShapedSiteFeature, siteSurfaceRegions } from './siteFeatureConstruction';
import { supportFloatingRoof } from './roofSupport';
import { BLOCKING_FOOTPRINT_CODES } from './architectureSafety';
import { resolveFootprint } from './footprint';
import { footprintDiagnostics } from './footprintDiagnostics';
import { compileFootprintMass, compileFootprintRoof } from './footprintConstruction';
import { estateRouteVertices, estateRouteSupported, estateRouteObstacles } from './routeGeometry';
import type { V3EstatePlan } from './estatePlan';
import { isSlattedCanopy } from './featureIntent';
import { rooftopTerraces, finishRooftopTerraces } from './rooftopFeatures';
import { resolveV3Fidelity } from './fidelity';
import { deriveV3MassJunctions, junctionRoofScopes } from './junctions';
import { resolveV3JunctionDatums } from './junctionDatums';
import { compileV3MassJunctions } from './junctionCompiler';
import { compositionRoofMaterial, roofFinish } from './compositionPolicies';
import { roofClearanceOverhangs } from './roofClearance';
import { compileV3Composition, resolvedFacadeComposition, type V3Composition } from "./composition";
import { subtractConvex, extrudeOutline, polygonArea } from "@/lib/house/geometry/mesh";
import type { HouseModel, HousePrimitive, PrimitiveCategory, TriMeshPrimitive } from "@/lib/house/types";
import { groundedConnectionRoute, resolveSiteHierarchy, routeLength, type V3SiteHierarchy, type V3SupportRef } from "./siteHierarchy";
import { createV3TerrainSampler, v3TerrainGrid, getObjectBaseY, getObjectTopY, scaledDimensionsOf } from "./elevation";
import { resolveV3Renderable } from "./renderability";
import type { V3ArchitecturalGeometry } from "./architecture";
import { effectiveV3Scene } from "./derivedSupport";
import { v3Capability, v3CategoryFor, type V3CompileContext } from "./capabilities";
import { compileDetailedRoof } from "./construction";
import type { V3Interior } from "./interior";
import { compileV3InteriorWalls } from "./interiorWalls";
import { applyV3Circulation } from "./circulation";
import { withInferredV3Surfaces } from "./materialInference";
import { v3MassLevelCount, v3MassStoreys, v3RooftopTerrace, v3StoreyTargetingDiagnostics } from "./stacking";
import { v3DerivedWallVertices, v3SeaPlaneOutline, type V3NaturalGround, type V3SeaPlane, type V3SiteGrading } from "./grading";

export const V3_SCENE_VERSION = 3 as const;
export type V3ObjectType = string;
export type V3GeometryKind = "box" | "slab" | "plane" | "cylinder" | "path" | "extrusion" | "water" | "proxy";
export type V3CollisionClass = "solid" | "walkable" | "passable" | "water" | "none";
export type V3TerrainOperation = "slopeRegion" | "raiseRegion" | "lowerRegion" | "createTerrace" | "cutIntoSlope" | "gradePath";
export type Vec3 = [number, number, number];
export interface V3Material { id: string; color: string; roughness?: number; metalness?: number; opacity?: number; surface?: "concrete" | "stone" | "wood" | "glass" | "metal" | "stucco" | "paving" | "water" | "grass"; }
export interface V3Transform { position: Vec3; rotation: Vec3; scale: Vec3; }
export interface V3SceneObject {
  /** `type` is a backwards-compatible compiler hint, never a semantic gate. */
  id: string; type: V3ObjectType; semanticRole: string; label: string; geometryKind?: V3GeometryKind; transform: V3Transform; dimensions: Vec3; material: V3Material; collision?: V3CollisionClass;
  parentId?: string; groupId?: string; hostId?: string; source?: { kind: "proxy" | "glb" | "native"; assetId?: string; replaceable?: boolean };
  terrain?: { operation: V3TerrainOperation; rise?: number; direction?: "x" | "z" | "-x" | "-z" };
  /** Explicit authored physical relationship. `hostId` remains a legacy attachment alias. */
  support?: V3SupportRef;
  /** Explicit endpoints for vertical connectors; each names a site level or support object. */
  fromSupportId?: string;
  toSupportId?: string;
  metadata?: Record<string, string | number | boolean>;
  /** Named, base-referenced architectural geometry. When present it is authoritative over runtime arrays. */
  architecture?: V3ArchitecturalGeometry;
  /** Compact architectural intent. The compiler, never Terra, expands it into construction parts. */
  composition?: V3Composition;
  levels?: number;
  facadePreset?: "glass-heavy" | "punched" | "solid" | "privacy";
  facadeNorth?: "glass-heavy" | "punched" | "solid" | "privacy";
  facadeEast?: "glass-heavy" | "punched" | "solid" | "privacy";
  facadeSouth?: "glass-heavy" | "punched" | "solid" | "privacy";
  facadeWest?: "glass-heavy" | "punched" | "solid" | "privacy";
  /** Unimplemented named intent retained separately from supported render forms. */
  unsupportedIntent?: { roofForm?: string };
  canopyStyle?: "solid" | "slatted";
  railing?: "auto" | "none";
  terraceOpenEdges?: Array<"north" | "south" | "east" | "west">;
  roofForm?: "flat" | "floating-flat" | "mono-pitch" | "hip" | "gable" | "butterfly" | "terrace";
  overhang?: number;
  pitch?: number;
  pitchUnit?: "degrees" | "ratio";
}
export interface V3SceneSite { width: number; depth: number; baseElevation?: number; groundMaterial?: V3Material;
  /** High-level natural-ground intent (fall, grade, profile, ridge, cliff). V3 derives the surface; nobody authors vertices. */
  naturalGround?: V3NaturalGround;
  /** Independent sea/lake plane. Never shapes terrain. */
  sea?: V3SeaPlane; }
/** `adjacent` joins two rooms on one storey; other kinds join objects or interior datums. */
export interface V3Relationship { from: string; to: string; kind: "supports" | "contains" | "aligns" | "connects" | "hosts" | "adjacent"; }
export interface V3Usage { inputTokens?: number; outputTokens?: number; totalTokens?: number; attempts: number; estimatedCost?: number; contextBytes?: number; schemaBytes?: number; repair: boolean; }
export interface V3Scene { version: typeof V3_SCENE_VERSION; site: V3SceneSite; siteHierarchy?: V3SiteHierarchy; estatePlan?: V3EstatePlan; objects: V3SceneObject[];
  /** Authored semantic storeys/rooms/partitions/doors/circulation. Optional: exterior-only scenes omit it and are never given one. Partitions and circulation compile, into derived (never persisted) walls, stairs and lifts. */
  interior?: V3Interior;
  relationships: V3Relationship[]; metadata: { brief?: string; generatedAt?: string; usage?: V3Usage; architecturalValidation?: import('./architecturalAcceptance').ArchitecturalValidationState; [key: string]: unknown }; }
export interface V3ProjectRoot { version: 3; generationMode: "v3-scene"; v3Scene: V3Scene; }
export const BLANK_V3_SCENE: V3ProjectRoot = { version: 3, generationMode: "v3-scene", v3Scene: { version: 3, site: { width: 180, depth: 180, baseElevation: 0 }, objects: [], relationships: [], metadata: {} } };
export function isV3ProjectRoot(raw: unknown): raw is V3ProjectRoot { return !!raw && typeof raw === "object" && (raw as { generationMode?: unknown }).generationMode === "v3-scene" && (raw as { v3Scene?: { version?: unknown } }).v3Scene?.version === 3; }

const categoryFor = (type: V3ObjectType | undefined): PrimitiveCategory => v3CategoryFor(type);
/** V3 finishes map 1:1 onto the bundled PBR families; water has its own shader and no surface texture. */
const renderSurface = (surface: V3Material["surface"]): HousePrimitive["surface"] => surface === "water" ? undefined : surface;
type P2 = [number, number];
function dimensionsOf(o: V3SceneObject): Vec3 { return scaledDimensionsOf(o); }
function localPoint(o: V3SceneObject, x: number, z: number): P2 {
  const [ox, , oz] = o.transform.position, a = o.transform.rotation[1], c = Math.cos(a), s = Math.sin(a), dx = x - ox, dz = z - oz;
  return [dx * c - dz * s, dx * s + dz * c];
}
export interface V3TerrainSurface { heightAt(x: number, z: number): number; material: V3Material; vertices: number[]; bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Analytic graded surface (exact grade breaks, before pool excavation). Retaining walls size against it. */
  gradedAt?(x: number, z: number): number;
  grading?: V3SiteGrading; }
/** Offline before/after capture only: development builds may bypass fidelity resolution within one compiled bundle. */
function fidelityScene(scene: V3Scene): V3Scene {
  if (process.env.NODE_ENV === "development" && (globalThis as { __V3_FIDELITY_BASELINE__?: boolean }).__V3_FIDELITY_BASELINE__) return scene;
  return resolveV3Fidelity(scene).scene;
}
/** One coherent, sampled terrain surface, with terrain regions applied in authored order. */
export function buildV3TerrainSurface(scene: V3Scene): V3TerrainSurface {
  scene = withInferredV3Surfaces(fidelityScene(effectiveV3Scene(scene)));
  const modifiers = scene.objects.filter((o) => o.type === "terrain-region" && o.terrain);
  const material = modifiers.at(-1)?.material ?? scene.site.groundMaterial ?? { id: "ground", color: "#4a6b42", surface: "grass" as const };
  const minX = -scene.site.width / 2, maxX = scene.site.width / 2, minZ = -scene.site.depth / 2, maxZ = scene.site.depth / 2;
  const { columns, rows, xs, zs } = v3TerrainGrid(scene);
  const terrainWithLevels = createV3TerrainSampler(scene);
  const at = (column: number, row: number): P2 => [xs[column], zs[row]], vertices: number[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = at(column, row), b = at(column + 1, row), c = at(column + 1, row + 1), d = at(column, row + 1);
    vertices.push(a[0], terrainWithLevels(...a), a[1], b[0], terrainWithLevels(...b), b[1], c[0], terrainWithLevels(...c), c[1], a[0], terrainWithLevels(...a), a[1], c[0], terrainWithLevels(...c), c[1], d[0], terrainWithLevels(...d), d[1]);
  }
  return { heightAt: terrainWithLevels, gradedAt: terrainWithLevels.gradedAt, grading: terrainWithLevels.grading, material, vertices, bounds: { minX, maxX, minZ, maxZ } };
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
/** Graded driveways/paths: the ribbon lies on the graded corridor, sampled ~1 m along and at both edges. */
function gradedRibbon(connection: NonNullable<V3Scene["siteHierarchy"]>["connections"][number], terrain: V3TerrainSurface): number[] | undefined {
  const graded = terrain.grading?.connections.find((candidate) => candidate.id === connection.id);
  if (!graded?.graded || graded.profile.length < 2) return undefined;
  const p = graded.profile, half = graded.halfWidth, vertices: number[] = [];
  const side = (i: number): [P2, P2] => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
    return [[p[i][0] - dz / len * half, p[i][2] + dx / len * half], [p[i][0] + dz / len * half, p[i][2] - dx / len * half]];
  };
  const y = (point: P2) => terrain.heightAt(...point) + .055;
  for (let i = 0; i < p.length - 1; i++) {
    const [l0, r0] = side(i), [l1, r1] = side(i + 1), c0: P2 = [p[i][0], p[i][2]], c1: P2 = [p[i + 1][0], p[i + 1][2]];
    // Two strips per station (left→centre, centre→right) so the ribbon follows the corridor crown closely.
    for (const [a0, b0, a1, b1] of [[l0, c0, l1, c1], [c0, r0, c1, r1]] as [P2, P2, P2, P2][])
      vertices.push(a0[0], y(a0), a0[1], b0[0], y(b0), b0[1], b1[0], y(b1), b1[1], a0[0], y(a0), a0[1], b1[0], y(b1), b1[1], a1[0], y(a1), a1[1]);
  }
  return vertices;
}
function connectionRibbon(scene: V3Scene, connection: NonNullable<V3Scene["siteHierarchy"]>["connections"][number], terrain?: V3TerrainSurface): TriMeshPrimitive | undefined {
  const { hierarchy } = resolveSiteHierarchy(scene), resolvedConnection = hierarchy.connections.find((candidate) => candidate.id === connection.id);
  if (!resolvedConnection || resolvedConnection.route.length < 2) return undefined;
  const route = groundedConnectionRoute(resolvedConnection, hierarchy.levels), length = routeLength(route);
  if (length <= 0) return undefined;
  const draped = terrain ? gradedRibbon(connection, terrain) : undefined;
  const vertices: number[] = draped ?? [], half = resolvedConnection.width / 2;
  for (let index = 0; !draped && index < route.length - 1; index++) {
    const a = route[index], b = route[index + 1], dx = b[0] - a[0], dz = b[2] - a[2], segment = Math.hypot(dx, dz);
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
  const [w, , d] = dimensionsOf(o), y = o.transform.position[1], hw = w / 2, hd = d / 2;
  const vertices = [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,-hd],[hw,hd],[-hw,hd]].flatMap(([x,z]) => rotated(o,x,y,z));
  return { kind: "triMesh", id: o.id + "-water", category: "pool", label: o.label + " Water", vertices, color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: true, opacity: o.material.opacity ?? .86, surface: renderSurface(o.material.surface) };
}
type ArchitecturalPart = HousePrimitive & { sourceObjectId?: string };
const part = <T extends HousePrimitive>(o: V3SceneObject, componentRole: string, primitive: T): T => ({ ...primitive, sourceObjectId: o.id, semanticRole: o.semanticRole, componentRole });
const boxPart = (o: V3SceneObject, suffix: string, componentRole: string, position: Vec3, size: Vec3, material = o.material, category: PrimitiveCategory = categoryFor(o.type)): ArchitecturalPart => part(o, componentRole, { kind: "box", id: `${o.id}-${suffix}`, category, label: `${o.label} · ${componentRole}`, position, rotation: o.transform.rotation, size, color: material.color, roughness: material.roughness, metalness: material.metalness, transparent: material.opacity !== undefined && material.opacity < 1, opacity: material.opacity, surface: renderSurface(material.surface) });
const rotated = (o: V3SceneObject, localX: number, y: number, localZ: number): Vec3 => {
  const a = o.transform.rotation[1], c = Math.cos(a), s = Math.sin(a), [x, , z] = o.transform.position;
  return [x + localX * c + localZ * s, y, z - localX * s + localZ * c];
};
const wallMaterial = (o: V3SceneObject): V3Material => o.material.surface === "glass" ? { id: "stucco", color: "#d7d0c4", roughness: .72, surface: "stucco" } : o.material;
const glassMaterial: V3Material = { id: "architectural-glass", color: "#8fbdc9", roughness: .1, metalness: .08, opacity: .42, surface: "glass" };
const darkMetal: V3Material = { id: "dark-metal", color: "#1d2629", roughness: .38, metalness: .7, surface: "metal" };

/** Generic geometry is intentionally boring but always visible and selectable. */
function compileGenericGeometry(o: V3SceneObject, geometryKind: V3GeometryKind): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o);
  if (geometryKind === "cylinder") {
    const vertices: number[] = [], segments = 12, y = o.transform.position[1];
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
      const p = (angle: number, top: boolean): Vec3 => rotated(o, Math.cos(angle) * w / 2, y + (top ? h / 2 : -h / 2), Math.sin(angle) * d / 2);
      vertices.push(...p(a, false), ...p(b, false), ...p(b, true), ...p(a, false), ...p(b, true), ...p(a, true));
    }
    return [part(o, "generic cylinder", { kind: "triMesh", id: o.id, category: categoryFor(o.type), label: o.label, vertices, color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: o.material.opacity !== undefined && o.material.opacity < 1, opacity: o.material.opacity, surface: renderSurface(o.material.surface) })];
  }
  const height = geometryKind === "plane" ? Math.min(h, .05) : geometryKind === "slab" ? Math.min(h, .3) : h;
  return [part(o, geometryKind === "proxy" ? "render proxy" : `generic ${geometryKind}`, { kind: "box", id: o.id, category: categoryFor(o.type), label: o.label, position: o.transform.position, rotation: o.transform.rotation, size: [w, Math.max(.02, height), d], color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: o.material.opacity !== undefined && o.material.opacity < 1, opacity: o.material.opacity, bevel: geometryKind === "proxy" ? .08 : undefined, surface: renderSurface(o.material.surface) })];
}

/** V2's flat roof plate default; pitched roofs take their own slab thickness from the shared builders. */
const IMPLICIT_ROOF_THICKNESS = .25;
/** Exposed intermediate slab edge: metres proud of the facade, band height, finish. */
const SLAB_EDGE = { proud: .04, height: .24, color: "#bdb5a8" };
/** Small pure V3 construction kit. It borrows V2's proven wall/slab/roof vocabulary, not its document authority. */
function compileBuildingMass(o: V3SceneObject, includeRoof = true, roofOverhang = o.overhang, roofMaterial = o.material, storeyBase = 0, scene?: V3Scene): HousePrimitive[] {
  const articulated = compileFootprintMass({...o,material:wallMaterial(o)}, includeRoof, roofOverhang, roofMaterial, storeyBase, scene);
  if (articulated) return articulated.parts;
  if (o.composition?.footprint) o = {...o, composition:{...o.composition, footprint:undefined}};
  const [w, h, d] = dimensionsOf(o), base = o.transform.position[1] - h / 2, levelCount = v3MassLevelCount(o), storeys = v3MassStoreys(o, scene), levelH = storeys[0].height, wall = wallMaterial(o), out: HousePrimitive[] = [];
  const push = (suffix: string, role: string, lx: number, y: number, lz: number, size: Vec3, material = wall, category: PrimitiveCategory = "wall") => { if (size.every((value) => value > 0)) out.push(boxPart(o, suffix, role, rotated(o, lx, y, lz), size, material, category)); };
  for (let floor = 0; floor <= levelCount; floor++) push(`slab-${floor + 1}`, "floor slab", 0, base + (floor === levelCount ? h : storeys[floor].elevation) + (floor === levelCount ? -.13 : .13), 0, [w, .26, d], { id: "concrete", color: "#b8b0a4", roughness: .72, surface: "concrete" }, "floor");
  // V2's expressed floor datum: each intermediate slab edge reads as a band just proud of the facade, so a
  // multi-storey mass reads as stacked floors rather than one tall extruded box.
  for (let floor = 1; floor < levelCount; floor++) {
    // Each band spans 1 cm inside the wall face to `proud` outside; north/south bands wrap the corners.
    const y = base + (floor === levelCount ? h : storeys[floor].elevation), t = SLAB_EDGE.proud + .01, c = (SLAB_EDGE.proud - .01) / 2, long = w + 2 * SLAB_EDGE.proud;
    const slabEdge: V3Material = { id: "slab-edge", color: SLAB_EDGE.color, roughness: .78, surface: "concrete" };
    for (const [side, lx, lz, size] of [["north", 0, -d / 2 - c, [long, SLAB_EDGE.height, t]], ["south", 0, d / 2 + c, [long, SLAB_EDGE.height, t]], ["east", w / 2 + c, 0, [t, SLAB_EDGE.height, d]], ["west", -w / 2 - c, 0, [t, SLAB_EDGE.height, d]]] as const)
      push(`slab-edge-${floor + 1}-${side}`, "floor slab edge", lx, y, lz, [...size] as Vec3, slabEdge, "floor");
  }
  out.push(...compileV3Composition({ ...o, material: wall, composition: resolvedFacadeComposition(o,w,d,levelH) }, w,d,h,levelCount,storeyBase,scene));
  if (includeRoof) out.push(...compileRoofForm({ ...o, architecture: undefined, type: "roof-form", dimensions: [w, IMPLICIT_ROOF_THICKNESS, d], transform: { ...o.transform, position: [o.transform.position[0], base + h + IMPLICIT_ROOF_THICKNESS / 2, o.transform.position[2]], scale: [1,1,1] }, roofForm: o.roofForm ?? "flat", overhang: roofOverhang, material: roofMaterial }, wall));
  return out;
}
function compileRoofForm(o: V3SceneObject, exterior?: V3Material): HousePrimitive[] {
  const detailed = compileDetailedRoof(o, exterior);
  if (detailed) return detailed;
  const form = o.roofForm ?? "flat", overhang = Math.max(0, o.overhang ?? .75), [w, h, d] = dimensionsOf(o), roof = { ...o.material, surface: o.material.surface === "glass" ? "metal" as const : o.material.surface };
  const plate = boxPart(o, "roof-plate", form === "floating-flat" ? "floating roof plate" : form === "terrace" ? "roof terrace" : "flat roof plate", o.transform.position, [w + overhang * 2, Math.max(h, .28), d + overhang * 2], roof, "roof");
  if (form !== "floating-flat") return [plate];
  return [boxPart(o, "roof-shadow", "shadow reveal", [o.transform.position[0], o.transform.position[1] - .23, o.transform.position[2]], [w, .14, d], darkMetal, "roof"), plate];
}
function compilePool(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), [x, y, z] = o.transform.position, coping: V3Material = { id: "pool-coping", color: "#d6cbb6", roughness: .68, surface: "paving" }, basin: V3Material = { id: "pool-basin", color: "#1e586d", roughness: .34, surface: "concrete" };
  // Legacy array pools historically use position.y as the water plane. Named
  // pools use ordinary base-referenced height, so water is deterministically
  // derived below their top rim; legacy array pools retain their historic rim datum.
  const rimY = o.architecture ? getObjectTopY(o) : y;
  const floorThickness = Math.min(.2, h * .15), wallThickness = Math.min(.22, w * .1, d * .1);
  const bottomY = rimY - h, waterY = rimY - Math.min(.04, h * .04);
  const innerW = w - wallThickness * 2, innerD = d - wallThickness * 2;
  const waterObject: V3SceneObject = { ...o, architecture: undefined, dimensions: [innerW, Math.min(.02,h*.02), innerD], transform: { ...o.transform, position: [x,waterY,z], scale: [1,1,1] } };
  // A hollow shell keeps the water exposed; its inset/freeboard prevents
  // coplanar water/concrete faces even for very small authored envelopes.
  const out: HousePrimitive[] = [boxPart(o, "basin", "pool basin", [x,bottomY+floorThickness/2,z], [w,floorThickness,d], basin, "pool"), part(o, "water surface", poolSurface(waterObject))];
  [[0,-d/2+wallThickness/2],[0,d/2-wallThickness/2]].forEach(([dx,dz], i) => out.push(boxPart(o, `shell-ns-${i}`, "pool shell", rotated(o,dx,bottomY+h/2,dz), [w,h,wallThickness], basin,"pool")));
  [[-w/2+wallThickness/2,0],[w/2-wallThickness/2,0]].forEach(([dx,dz], i) => out.push(boxPart(o, `shell-ew-${i}`, "pool shell", rotated(o,dx,bottomY+h/2,dz), [wallThickness,h,innerD], basin,"pool")));
  [[0, -d/2], [0, d/2]].forEach(([dx, dz], i) => out.push(boxPart(o, `coping-ns-${i}`, "pool coping", rotated(o, dx, rimY + .05, dz), [w + .5, .16, .38], coping, "pool")));
  [[-w/2, 0], [w/2, 0]].forEach(([dx, dz], i) => out.push(boxPart(o, `coping-ew-${i}`, "pool coping", rotated(o, dx, rimY + .05, dz), [.38, .16, d], coping, "pool")));
  return out;
}
/** Cut overlapping water basins out of authored walking surfaces, including rotated pools. */
function compilePoolDeck(o: V3SceneObject, scene: V3Scene): HousePrimitive[] | undefined {
  const [w,h,d] = dimensionsOf(o), top = getObjectTopY(o), base = top - h;
  // Keep legacy rectangular construction byte-identical. Exact boundary cuts
  // are required only when a new shaped basin/fountain participates.
  let pieces:P2[][];
  if(scene.objects.some(p=>p.type==='fountain'||p.type==='pool'&&p.composition?.footprint))pieces=siteSurfaceRegions(o,scene);
  else {
    const outline:P2[]=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>{const p=rotated(o,x,0,z);return [p[0],p[2]];});
    pieces=[outline];
    for(const pool of scene.objects.filter(candidate=>candidate.type==='pool')){
      const [pw,ph,pd]=dimensionsOf(pool),rim=pool.architecture?getObjectTopY(pool):pool.transform.position[1];
      if(base>rim+.15||top<rim-ph)continue;
      const hole:P2[]=[[-pw/2,-pd/2],[pw/2,-pd/2],[pw/2,pd/2],[-pw/2,pd/2]].map(([x,z])=>{const p=rotated(pool,x,0,z);return [p[0],p[2]];});
      pieces=pieces.flatMap(piece=>subtractConvex(piece,hole));
    }
  }
  const area = pieces.reduce((sum,piece) => sum + polygonArea(piece),0);
  if (!pieces.length || Math.abs(area-w*d) < 1e-6) return undefined;
  return [part(o,"pool deck", { kind: "triMesh", id: `${o.id}-surface`, category: "patio", label: o.label, vertices: pieces.flatMap(piece => extrudeOutline(piece,base,top,{ bottom: true })), color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, surface: renderSurface(o.material.surface) })];
}

function compileBalcony(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), [x, y, z] = o.transform.position, rail: V3Material = { ...glassMaterial, opacity: .34 };
  return [boxPart(o, "deck", "balcony slab", [x, y, z], [w, Math.max(.2, h), d], { id: "balcony-stone", color: "#b8ae9d", roughness: .65, surface: "concrete" }, "balcony"), boxPart(o, "rail-front", "glass railing", rotated(o, 0, y + .62, d/2), [w, 1.15, .07], rail, "balcony"), boxPart(o, "rail-left", "glass railing", rotated(o, -w/2, y + .62, 0), [.07, 1.15, d], rail, "balcony"), boxPart(o, "rail-right", "glass railing", rotated(o, w/2, y + .62, 0), [.07, 1.15, d], rail, "balcony")];
}
function compileCourtyard(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), t = Math.min(Math.min(w,d) / 3, 1.2, Math.max(.35, Math.min(w, d) / 7)), stone: V3Material = { id: "courtyard-paving", color: "#b8ad98", roughness: .74, surface: "paving" };
  return [[0,-d/2+t/2,w,t],[0,d/2-t/2,w,t],[-w/2+t/2,0,t,d-2*t],[w/2-t/2,0,t,d-2*t]].map(([lx,lz,pw,pd], i) => boxPart(o, `court-frame-${i + 1}`, "courtyard perimeter", rotated(o,lx,o.transform.position[1],lz), [pw, Math.max(.14,h), pd], stone, "floor"));
}
/** Groundcover only: trees and shrubs are presentation-only planting derived from the zone (see `v3VegetationPlacements`). */
function compileLandscapeZone(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), [x, y, z] = o.transform.position, green: V3Material = { id: "planting", color: o.material.color, roughness: .9, surface: "grass" };
  return [boxPart(o, "groundcover", "landscape groundcover", [x,y,z], [w,Math.max(.12,h),d], green, "landscape")];
}
function compileColumnLine(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), alongX = w >= d, length = alongX ? w : d, count = Math.max(2, Math.min(10, Math.round(length / 3) + 1)), out: HousePrimitive[] = [];
  for (let i = 0; i < count; i++) { const along = -length / 2 + length * i / (count - 1); out.push(boxPart(o, `column-${i + 1}`, "structural column", rotated(o, alongX ? along : 0, o.transform.position[1], alongX ? 0 : along), [Math.min(.36,w), h, Math.min(.36,d)], o.material, "building")); }
  return out;
}
function compileRailingRun(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), alongX = w >= d, glass = o.material.surface === "glass" ? o.material : { ...glassMaterial, color: o.material.color === "#000000" ? glassMaterial.color : o.material.color };
  return [boxPart(o, "railing", "railing run", o.transform.position, [w, h, d], glass, "balcony"), ...compileColumnLine({ ...o, architecture: undefined, transform: { ...o.transform, scale: [1,1,1] }, type: "column-line", dimensions: alongX ? [w, h, Math.max(.08, d)] : [Math.max(.08,w), h, d], material: darkMetal }).filter((_, index) => index % 2 === 0)];
}
function terrainLine(o: V3SceneObject, terrain: V3TerrainSurface, retaining: boolean): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), alongX = w >= d, length = alongX ? w : d, thickness = alongX ? d : w, segments = Math.max(1, Math.ceil(length / 1.5)), out: HousePrimitive[] = [];
  for (let i = 0; i < segments; i++) {
    const start = -length / 2 + length * i / segments, end = -length / 2 + length * (i + 1) / segments, middle = (start + end) / 2, a = o.transform.rotation[1];
    const point = (along: number, side: number): P2 => { const p = rotated(o, alongX ? along : side, 0, alongX ? side : along); return [p[0], p[2]]; };
    const left = point(middle, thickness / 2 + .2), right = point(middle, -thickness / 2 - .2), sample = retaining && terrain.gradedAt ? terrain.gradedAt : terrain.heightAt, leftY = sample(...left), rightY = sample(...right), ground = Math.min(leftY, rightY), grade = Math.abs(leftY - rightY), actsAsRetaining = retaining && grade >= .2, top = actsAsRetaining ? Math.max(leftY, rightY) + .1 : ground + h, height = Math.max(actsAsRetaining ? .35 : h, top - ground), center = point(middle, 0);
    out.push(part(o, retaining ? "retaining wall" : "fence segment", { kind: "box", id: segments === 1 ? o.id : o.id + "-" + (i + 1), category: categoryFor(o.type), label: o.label, position: [center[0], ground + height / 2, center[1]], rotation: [0, a, 0], size: alongX ? [end-start,height,thickness] : [thickness,height,end-start], color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness, transparent: o.material.opacity !== undefined && o.material.opacity < 1, opacity: o.material.opacity, surface: renderSurface(o.material.surface) }));
  }
  return out;
}
/** Rise and run are semantic dimensions; the engine owns every tread. */
function compileConnector(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), base = getObjectBaseY(o);
  if (o.type === "ramp") {
    const points: Vec3[] = [[-w/2,base,-d/2],[w/2,base,-d/2],[w/2,base+h,d/2],[-w/2,base,-d/2],[w/2,base+h,d/2],[-w/2,base+h,d/2]];
    return [part(o, "ramp surface", { kind: "triMesh", id: o.id, category: "stairs", label: o.label, vertices: points.flatMap(([x,y,z]) => rotated(o,x,y,z)), color: o.material.color, roughness: o.material.roughness, surface: renderSurface(o.material.surface) })];
  }
  const count = Math.max(1, Math.min(160, Math.ceil(h / .18))), run = d / count;
  return Array.from({ length: count }, (_, index) => {
    const rise = h * (index + 1) / count;
    return boxPart(o, `step-${index + 1}`, "stair tread", rotated(o,0,base+rise/2,-d/2+run*(index+.5)), [w,rise,run], o.material,"stairs");
  });
}
function compileCanopy(o: V3SceneObject): HousePrimitive[] {
  const [w, h, d] = dimensionsOf(o), y = o.transform.position[1], named = !!o.architecture;
  const roofThickness = named ? Math.min(.28, Math.max(.18, h * .08)) : Math.max(.18, h);
  const roofY = named ? getObjectTopY(o) - roofThickness / 2 : y;
  const postHeight = named ? Math.max(.2, h - roofThickness) : 3;
  const postY = named ? getObjectBaseY(o) + postHeight / 2 : y - 1.55;
  const out: HousePrimitive[] = [boxPart(o, "roof", "canopy roof", [o.transform.position[0], roofY, o.transform.position[2]], [w, roofThickness, d], o.material, "roof")];
  if (isSlattedCanopy(o)) {
    out.length = 0;
    const beam = Math.min(.18,w/8,d/8), count = Math.max(2,Math.ceil(w/.42));
    for(let i=0;i<count;i++) out.push(boxPart(o, `slat-${i}`, "pergola slat", rotated(o,-w/2+beam/2+(w-beam)*i/(count-1),roofY,0), [beam,roofThickness,d], o.material,"roof"));
    for(const side of [-1,1]) {
      out.push(boxPart(o, `header-${side}`, "pergola header", rotated(o,0,roofY-roofThickness,side*(d/2-.18)),[w,.22,.18],o.material,"roof"));
      for(const end of [-1,1]) out.push(boxPart(o, `pergola-post-${side}-${end}`, "pergola post",rotated(o,end*(w/2-.18),postY,side*(d/2-.18)),[.18,postHeight,.18],o.material,"building"));
    }
    return out;
  }
  for (const [lx, lz] of [[-w/2+.28,-d/2+.28],[w/2-.28,-d/2+.28]]) out.push(boxPart(o, `post-${lx < 0 ? "left" : "right"}`, "canopy post", rotated(o,lx,postY,lz), [.28,postHeight,.28], darkMetal, "building"));
  return out;
}
/** Construction functions the capability registry dispatches to. Internal to the V3 compiler. */
export const v3CompileKit = {
  compileShapedSiteFeature,
  part, pathRibbon, terrainLine, compilePool, compilePoolDeck, compileBalcony, compileCourtyard, compileLandscapeZone, compileColumnLine, compileRailingRun, compileConnector, compileCanopy, compileBuildingMass,
  compileTerraceSurface: (o: V3SceneObject): HousePrimitive[] => [boxPart(o, "surface", "terrace surface", o.transform.position, dimensionsOf(o), o.material, "patio")],
  compileRoofForm: (o: V3SceneObject, scene: V3Scene, clearedOverhang: number | undefined): HousePrimitive[] => {
    const host = scene.objects.find(host => host.id === (o.hostId ?? o.support?.hostId ?? o.support?.objectId));
    const roof = { ...o, material: roofFinish(scene, o), overhang: clearedOverhang ?? o.overhang };
    return host?.composition?.footprint && (host.composition.footprint.kind==='outline' || Array.from({length:v3MassLevelCount(host)},(_,floor)=>resolveFootprint(host,floor)).every(Boolean)) ? compileFootprintRoof(host, roof).parts : supportFloatingRoof(compileRoofForm(roof, host?.material), roof, host);
  },
};
export interface V3CompileOptions { debug?: boolean; /** Offline regression comparison only. Production defaults to resolving junctions. */ junctions?: boolean; }
/** Scene-first compiler: terrain intent becomes a shared heightfield, while architectural elevations remain authored. */
export function compileV3Scene(scene: V3Scene, options: V3CompileOptions = {}): HouseModel {
  // Rooftop terraces need *authored* support: derived support is inferred from overlap, which alone never removes a roof.
  const occupiedRoofs = rooftopTerraces(scene);
  const rooftopTerraceHosts = new Set(scene.objects.filter((o) => v3RooftopTerrace(o, scene)).map((o) => o.id));
  // Effective scene: authored intent plus derived support. Derived support is resolved here, never persisted.
  // Absent render surfaces are inferred from semantic material ids (effective scene only, never persisted).
  scene = withInferredV3Surfaces(fidelityScene(effectiveV3Scene(scene)));
  const datum = options.junctions === false ? { scene, closures: [] } : resolveV3JunctionDatums(scene);
  scene = datum.scene;
  const roofOverhangs = roofClearanceOverhangs(scene), roofMaterial = compositionRoofMaterial(scene);
  const junctions = options.junctions === false ? [] : deriveV3MassJunctions(scene).junctions;
  const roofScopes = junctionRoofScopes(scene, junctions);
  const terrain = buildV3TerrainSurface(scene), primitives: HousePrimitive[] = [];
  // Natural rock faces (cliffs) render as rock; everything else is the ground material. Same heightfield, split by slope.
  const ground: number[] = [], rock: number[] = [];
  for (let i = 0; i < terrain.vertices.length; i += 9) {
    const v = terrain.vertices, run = Math.max(Math.hypot(v[i] - v[i + 3], v[i + 2] - v[i + 5]), Math.hypot(v[i] - v[i + 6], v[i + 2] - v[i + 8]), Math.hypot(v[i + 3] - v[i + 6], v[i + 5] - v[i + 8]));
    const rise = Math.max(v[i + 1], v[i + 4], v[i + 7]) - Math.min(v[i + 1], v[i + 4], v[i + 7]), cx = (v[i] + v[i + 3] + v[i + 6]) / 3, cz = (v[i + 2] + v[i + 5] + v[i + 8]) / 3;
    const natural = terrain.grading?.natural, naturalRise = natural ? Math.abs(natural(cx, cz - .5) - natural(cx, cz + .5)) + Math.abs(natural(cx - .5, cz) - natural(cx + .5, cz)) : 0;
    (rise > run * 1.2 && rise > 1 && naturalRise > 1.2 ? rock : ground).push(...v.slice(i, i + 9));
  }
  if (ground.length) primitives.push({ kind: "triMesh", id: "v3-terrain-surface", sourceObjectIds: scene.objects.filter((object) => object.type === "terrain-region" && object.terrain).map((object) => object.id), category: "landscape", label: "V3 Terrain Surface", vertices: ground, color: terrain.material.color, roughness: terrain.material.roughness, metalness: terrain.material.metalness, surface: renderSurface(terrain.material.surface) });
  if (rock.length) primitives.push({ kind: "triMesh", id: "v3-terrain-rock", category: "rock", label: "Natural rock face", vertices: rock, color: "#857a6b", roughness: .95, metalness: 0, surface: "stone" });
  // Derived retaining walls (compiled, never authored) and the independent sea plane.
  for (const wall of terrain.grading?.walls ?? []) primitives.push({ kind: "triMesh", id: wall.id, category: "retainingWall", label: `Retaining wall (${wall.kind}) ${wall.levelId ?? wall.connectionId} ${wall.side}`, vertices: v3DerivedWallVertices(wall), color: "#a59c8c", roughness: .86, metalness: 0, surface: "stone" });
  const sea = scene.site.sea && terrain.grading ? v3SeaPlaneOutline(scene.site, terrain.grading.natural) : undefined;
  if (sea && scene.site.sea) { const y = scene.site.sea.level, [a, b, c, d] = sea; primitives.push({ kind: "triMesh", id: "v3-ocean-water", category: "waterway", label: "Sea", vertices: [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], a[0], y, a[1], c[0], y, c[1], d[0], y, d[1]], color: "#1f5f78", roughness: .2, metalness: 0, transparent: true, opacity: .92 }); }
  const connections = resolveSiteHierarchy(scene).hierarchy.connections;
  const connectionSurfaceIds = new Set(connections.map((connection) => connection.surfaceObjectId).filter((id): id is string => !!id));
  for (const connection of connections) {
    const ribbon = connectionRibbon(scene, connection, terrain);
    if (ribbon) {
      const owner = scene.objects.find((object) => object.id === connection.surfaceObjectId);
      primitives.push(owner ? part(owner, "connection surface", ribbon) : ribbon);
    }
  }
  // Estate routes construct the canonical flat corridor without altering terrain or persisted hierarchy.
  for (const route of scene.estatePlan?.circulation ?? []) {
    // Invalid canonical intent must never fall back to an unrelated compatibility box.
    if (route.spatial) route.via.forEach(id=>connectionSurfaceIds.add(id));
    if (!estateRouteSupported(scene, route)) continue;
    const owner = scene.objects.find(o => o.id === route.via[0])!;
    const unresolved=!!scene.estatePlan?.blueprint && estateRouteObstacles(scene,route).length>0;
    const ribbon: TriMeshPrimitive = {kind:'triMesh',id:`v3-connection-estate:${route.id}`,category:'path',label:`${route.spatial!.use==='pedestrian'?'path':'driveway'} estate:${route.id}`,vertices:estateRouteVertices(scene,route),color:owner.material.color,roughness:owner.material.roughness??.84,metalness:owner.material.metalness??0,surface:'tile'};
    primitives.push(part(owner, unresolved?'unresolved route guide':'estate route surface', unresolved?{...ribbon,label:`Unresolved route guide: ${route.id}`,color:'#e6a23c',transparent:true,opacity:.45}:ribbon)); connectionSurfaceIds.add(owner.id);
  }
  const context: V3CompileContext = { scene, terrain, roofOverhangs, roofMaterial, connectionSurfaceIds, rooftopTerraceHosts };
  for (const o of scene.objects) {
    if (connectionSurfaceIds.has(o.id) && ["path", "driveway"].includes(o.type)) continue;
    // Registered capabilities compile first; `undefined` (or an unregistered semantic type) uses generic/proxy geometry.
    const scope = options.junctions === false ? undefined : roofScopes.get(o.id);
    const scopedContext = !scope ? context : o.type === 'building-mass' ? { ...context, roofMaterial: compositionRoofMaterial(scope) } : o.type === 'roof-form' ? { ...context, scene: scope } : context;
    const compiled = compileShapedSiteFeature(o,scene) ?? v3Capability(o.type)?.compile?.(o, scopedContext);
    primitives.push(...(compiled ?? compileGenericGeometry(o, resolveV3Renderable(o).geometryKind)));
  }
  primitives.push(...datum.closures);
  // Derived interior walls come last, so exterior output is identical with or without an interior.
  primitives.push(...compileV3InteriorWalls(scene));
  if (options.debug && process.env.NODE_ENV !== "production") for (const level of resolveSiteHierarchy(scene).hierarchy.levels) {
    primitives.push({ kind: "box", id: "v3-debug-level-" + level.id, category: "landscape", label: `${level.id} @ ${level.elevation.toFixed(1)}m`, position: [level.region.x, level.elevation + .03, level.region.z], rotation: [0, level.region.rotation ?? 0, 0], size: [level.region.width, .06, level.region.depth], color: "#ff00ff", transparent: true, opacity: .22 });
  }
  if (options.debug && process.env.NODE_ENV !== "production") for (const o of scene.objects.filter((candidate) => candidate.type === "terrain-region")) {
    const [w, , d] = dimensionsOf(o), [x, y, z] = o.transform.position;
    primitives.push({ kind: "box", id: "v3-debug-" + o.id, category: "landscape", label: o.id + ": " + o.semanticRole, position: [x, y, z], rotation: o.transform.rotation, size: [w, .06, d], color: "#ff00ff", transparent: true, opacity: .28 });
  }
  const finished = finishRooftopTerraces(scene, occupiedRoofs, options.junctions === false ? primitives : compileV3MassJunctions(scene, primitives, roofOverhangs, junctions));
  // Authored vertical circulation is last: floor openings cut the finished slabs/roofs it passes through.
  return { id: "v3-scene", primitives: applyV3Circulation(scene, finished) };
}
/** Informational composition counters for debugging richer scenes. They never reject a generation. */
export interface V3ArchitecturalMetrics {
  architecturalMassCount: number;
  facadeOpeningOrGlazingCount: number;
  roofFormCount: number;
  coveredOutdoorArea: number;
  poolOrSiteAmenityCount: number;
  landscapeZoneCount: number;
  authoredObjectCount: number;
  compiledPrimitiveCount: number;
}
export function v3ArchitecturalMetrics(scene: V3Scene, model = compileV3Scene(scene)): V3ArchitecturalMetrics {
  const high = scene.objects, metric = (o: V3SceneObject) => v3Capability(o.type)?.metrics;
  const covered = high.filter((o) => metric(o)?.coveredOutdoor).reduce((total, o) => total + dimensionsOf(o)[0] * dimensionsOf(o)[2], 0);
  return {
    architecturalMassCount: high.filter((o) => metric(o)?.mass).length,
    facadeOpeningOrGlazingCount: model.primitives.filter((p) => (p.category === "window" && p.componentRole !== "glazing frame") || p.componentRole === "facade glazing").length,
    roofFormCount: high.filter((o) => metric(o)?.roof?.(o)).length,
    coveredOutdoorArea: Math.round(covered * 10) / 10,
    poolOrSiteAmenityCount: high.filter((o) => metric(o)?.siteAmenity).length,
    landscapeZoneCount: high.filter((o) => metric(o)?.landscape).length,
    authoredObjectCount: high.length,
    compiledPrimitiveCount: model.primitives.length,
  };
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
    if (p.kind === "box" && p.size.some((value) => value <= 0)) errors.push(p.id + " has non-positive compiled dimensions.");
    if (p.kind === "triMesh" && (p.vertices.length === 0 || p.vertices.length % 9 !== 0)) errors.push(p.id + " has incomplete triangles.");
  }
  const siteLimit = Math.max(scene.site.width, scene.site.depth) * 1.25, ground = model.primitives.find((p) => p.id === "v3-terrain-surface");
  if (ground?.kind === "triMesh" && ground.vertices.some((v, i) => i % 3 !== 1 && Math.abs(v) > siteLimit)) physical.push("Terrain geometry exceeds site bounds.");
  const connectionSurfaceIds = new Set(resolveSiteHierarchy(scene).hierarchy.connections.flatMap((connection) => connection.surfaceObjectId ? [connection.surfaceObjectId] : []));
  for (const route of scene.estatePlan?.circulation ?? []) {
    if (!estateRouteSupported(scene, route)) continue;
    route.via.forEach(id => connectionSurfaceIds.add(id));
    const ribbon = model.primitives.find(p => p.id === `v3-connection-estate:${route.id}`);
    const expected = estateRouteVertices(scene, route);
    if (ribbon?.kind !== 'triMesh' || ribbon.sourceObjectId !== route.via[0] || ribbon.vertices.length !== expected.length
      || ribbon.vertices.some((v, i) => Math.abs(v - expected[i]) > 1e-8))
      errors.push(`${route.id} did not retain its canonical estate route ribbon.`);
  }
  for (const o of scene.objects.filter((candidate) => v3Capability(candidate.type)?.validation?.compiledShape === "path-ribbon")) {
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
  for (const o of scene.objects.filter((candidate) => !v3Capability(candidate.type)?.validation?.compiledBoundsExempt)) {
    const p = model.primitives.find((candidate) => candidate.id === o.id);
    if (p?.kind !== "box") continue;
    const expected = dimensionsOf(o);
    if (p.size.some((value, index) => value > expected[index] + .001) || p.position.some((value, index) => Math.abs(value - o.transform.position[index]) > .001)) physical.push(o.id + " compiled outside its authored bounds.");
  }
  for (const o of scene.objects.filter((candidate) => v3Capability(candidate.type)?.validation?.compiledShape === "terrain-following")) if (!model.primitives.some((p) => p.id === o.id || p.id.startsWith(o.id + "-"))) physical.push(o.id + " has no terrain-following compiled geometry.");
  if (!ground) warnings.push("Scene has no visible terrain surface.");
  // Opening floor targets that cannot be resolved are reported, never dropped silently.
  for (const diagnostic of footprintDiagnostics(scene)) (BLOCKING_FOOTPRINT_CODES.has(diagnostic.code) ? errors : warnings).push(`${diagnostic.code} [${diagnostic.targetId}]: ${diagnostic.message}`);
  for (const diagnostic of v3StoreyTargetingDiagnostics(scene)) warnings.push(`${diagnostic.code} [${diagnostic.targetId}]: ${diagnostic.message}`);
  return { ok: errors.length === 0, errors, warnings };
}
export const v3ObjectSummary = (o: V3SceneObject) => ({ id: o.id, type: o.type, role: o.semanticRole, position: o.transform.position, dimensions: o.dimensions, material: o.material.id, groupId: o.groupId, hostId: o.hostId });
