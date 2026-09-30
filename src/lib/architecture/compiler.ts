import type { HouseModel, HousePrimitive, TriMeshPrimitive } from "@/lib/house/types";
import { rotatePrimitiveY, translatePrimitive, buildFloorSlabPrimitive } from "@/lib/house/primitiveBuilders";
import { paintOf } from "@/lib/house/architecture/parts";
import { resolveMaterial, type ResolvedMaterial } from "@/lib/house/materials";
import { buildFlatRoof } from "@/lib/house/roof/flatRoof";
import { buildRoofExpression } from "@/lib/house/roof/expression";
import { FLOOR_THICKNESS, LEVEL_HEIGHT, MATERIAL_COLORS } from "@/lib/house/constants";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import type { CompassSide, RoofType } from "@/types/house";
import type { ArchitecturalDesignDocument, ArchitectureCompileOptions, DoorOpening, MassGeometryOperation, MassOpening, MassRelationship, MassRole, MassVolume, RoofRecipe, RoofRecipeKind, SiteStrategy } from "./document";
import { validateArchitecturalDesignDocument } from "./document";
import { buildFloorFootprint, offsetFootprintOutline, decomposeToRectangles, type FloorFootprint, type Rect, type WallEdge } from "./geometry/footprint";
import { buildPolygonRoofPlate, buildPolygonShedRoof, shedSlope } from "./geometry/roofPlate";
import { butterflyRoofGeometry, gableRoofGeometry, hipRoofGeometry, outlineEdges } from "./geometry/pitchedRoof";
import { getRoofSystem, makePlane, planRoofSystems, resolveRoofFinish, roofShapeOf, type RoofAssembly, type RoofSystem, type RoofSystemPlan, type V3 } from "./roofSystems";
import { extrudeOutline, triMeshOf } from "@/lib/house/geometry/mesh";
import { buildMassOpenings, buildPlainWallEdge, buildGlazedWallEdge, buildColonnadePosts, buildEntryRecessDoor } from "./geometry/openings";
import { buildParapetPrimitives } from "./geometry/parapet";
import "@/lib/capabilities/plugins";
import { requestCapability } from "@/lib/capabilities/engine";
import type { CapabilityOutcome } from "@/lib/capabilities/types";

/** One resolved courtyard system: the anchor mass 2+ others enclose, the void between them, and which compass sides remain open (view, arrival, garden). */
export interface CourtyardInfo { anchorMassId: string; bounds: Rect; enclosingMassIds: string[]; openSides: CompassSide[] }

/** Additive, dev-diagnostics-only view of a compile: never required by rendering. */
export interface ArchitectureDiagnostics {
  massCount: number;
  masses: { id: string; name: string; role: MassRole; position: { x: number; z: number }; rotation: number; elevation: number }[];
  roofs: { massId: string; kind: RoofRecipeKind }[];
  capabilities: { id: string; massId: string; status: CapabilityOutcome["status"]; note?: string }[];
  /** Per-mass articulation trace: what the Architectural Geometry Pass requested vs. what the deterministic compiler could actually build, plus any degradation it had to fall back on. */
  geometry: { massId: string; operationsRequested: number; openingsRequested: number; topFloorRectCount: number; warnings: string[] }[];
  /** Every resolved courtyard system (see `computeCourtyards`). Empty when no mass declared `surrounds-courtyard`. */
  courtyards: CourtyardInfo[];
  /** The mass the composition reads as dominant: `main-living` if present, else the largest footprint. */
  dominantMassId?: string;
  /** The house's primary Roof System, its counterpoint if any, and the system finishing each roof (see `planRoofSystems`). */
  roofSystems: RoofSystemPlan;
  /** Every roof's eave after clearance processing (see `roofClearance`). */
  roofClearance: RoofClearance[];
}

/** Yaw (radians) that turns a mass's local south facade to face `direction`. */
function yawFacingSouthToward(direction: CompassSide): number {
  const [wx, wz] = SIDE_VECTOR[direction];
  return Math.atan2(wx, wz);
}
/** Yaw that turns a mass's local north facade (the conventional arrival/entry side) to face `direction`. */
function yawFacingNorthToward(direction: CompassSide): number {
  const [wx, wz] = SIDE_VECTOR[direction];
  return Math.atan2(-wx, -wz);
}

/**
 * The two fields `resolveMasses` actually reads. Narrower than the full `ArchitecturalDesignDocument` on
 * purpose: `"view-facing"`/`"arrival-facing"` relationships resolve against `siteStrategy`, so any caller
 * that only has a partial document (e.g. mass-expansion resolving positions turn-by-turn, before the rest
 * of the document exists) is forced by the type checker to supply a real `siteStrategy` instead of reaching
 * for an `as unknown as ArchitecturalDesignDocument` cast that would silently let it be `undefined` at
 * runtime — see the `resolvedSoFar` incident this was written to prevent from recurring.
 */
export interface ResolveMassesInput { siteStrategy: SiteStrategy; massing: { masses: readonly MassVolume[] } }

/**
 * Processes masses in an order where every relationship target is already resolved, instead of raw array
 * order. In practice mass-expansion always appends a mass after the ones it can target, so this rarely
 * reorders anything for AI-produced input — it exists so a relationship's target being declared later in
 * the array (a hand-authored fixture, a future AI ordering) resolves correctly instead of silently being
 * skipped (`byId.get(rel.target)` returning undefined). A genuine cycle (should never happen — nothing
 * upstream can produce one) falls back to original order for the unresolved remainder rather than looping
 * forever; its dangling relationships are then skipped exactly as before.
 */
function resolutionOrder(masses: readonly MassVolume[]): MassVolume[] {
  const ids = new Set(masses.map((m) => m.id));
  const resolved = new Set<string>();
  const order: MassVolume[] = [];
  let pending = [...masses];
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    const next: MassVolume[] = [];
    for (const mass of pending) {
      const deps = (mass.relationships ?? []).filter((r) => r.kind !== "view-facing" && r.kind !== "arrival-facing").map((r) => r.target);
      if (deps.every((d) => resolved.has(d) || !ids.has(d))) { order.push(mass); resolved.add(mass.id); progress = true; }
      else next.push(mass);
    }
    pending = next;
  }
  order.push(...pending);
  return order;
}

/**
 * Groups every `surrounds-courtyard` relationship by its shared target into a real courtyard system: the
 * void between the anchor and each enclosing mass, and which compass sides are left open (a view, an
 * arrival gap, a garden edge) because no mass claims them. Only fires for an anchor with 2+ enclosing
 * masses — a single one is just an offset placement, not an enclosed courtyard.
 */
export function computeCourtyards(masses: readonly MassVolume[]): CourtyardInfo[] {
  const byId = new Map(masses.map((m) => [m.id, m] as const));
  const bySides = new Map<string, { mass: MassVolume; side: CompassSide }[]>();
  for (const mass of masses) {
    for (const rel of mass.relationships ?? []) {
      if (rel.kind !== "surrounds-courtyard" || !rel.side) continue;
      const list = bySides.get(rel.target) ?? [];
      list.push({ mass, side: rel.side });
      bySides.set(rel.target, list);
    }
  }
  const courtyards: CourtyardInfo[] = [];
  for (const [anchorId, enclosing] of bySides) {
    const anchor = byId.get(anchorId);
    if (!anchor || enclosing.length < 2) continue;
    const bounds: Rect = { x0: anchor.position.x - anchor.width / 2, x1: anchor.position.x + anchor.width / 2, z0: anchor.position.z - anchor.depth / 2, z1: anchor.position.z + anchor.depth / 2 };
    const openSides = new Set<CompassSide>(["north", "south", "east", "west"]);
    for (const { mass, side } of enclosing) {
      openSides.delete(side);
      const nx0 = mass.position.x - mass.width / 2, nx1 = mass.position.x + mass.width / 2;
      const nz0 = mass.position.z - mass.depth / 2, nz1 = mass.position.z + mass.depth / 2;
      if (side === "east" && nx0 > bounds.x1) bounds.x1 = nx0;
      if (side === "west" && nx1 < bounds.x0) bounds.x0 = nx1;
      if (side === "north" && nz1 < bounds.z0) bounds.z0 = nz1;
      if (side === "south" && nz0 > bounds.z1) bounds.z1 = nz0;
    }
    courtyards.push({ anchorMassId: anchorId, bounds, enclosingMassIds: enclosing.map((e) => e.mass.id), openSides: [...openSides] });
  }
  return courtyards;
}

/** `main-living` if present, else the largest footprint — the mass the roof stage (overhang scale) and quality gate (hierarchy check) treat as dominant. */
export function pickDominantMass(masses: readonly MassVolume[]): MassVolume | undefined {
  const mainLiving = masses.find((m) => m.role === "main-living");
  if (mainLiving) return mainLiving;
  return masses.reduce<MassVolume | undefined>((best, m) => (!best || m.width * m.depth > best.width * best.depth ? m : best), undefined);
}

/**
 * Resolves every mass's world position/rotation/elevation from its AUTHORED relationships (`resolutionOrder`
 * picks a safe processing order). Pure execution: a rotation only ever comes from the mass's own authored
 * `rotation` or an explicit rotation-setting relationship (`view-facing`, `arrival-facing`, `rotationOffset`).
 * A courtyard wing is never turned toward the void on the architect's behalf — `surrounds-courtyard` places
 * it, and how it faces is the architect's decision. Exported for the stage pipeline: resolving positions
 * incrementally as each mass is proposed reuses this unchanged.
 */
export function resolveMasses(doc: ResolveMassesInput): MassVolume[] {
  const byId = new Map<string, MassVolume>();
  for (const source of resolutionOrder(doc.massing.masses)) {
    const mass = { ...source, position: { ...source.position } };
    if (mass.placementLocked) { byId.set(mass.id, mass); continue; }
    for (const rel of mass.relationships ?? []) {
      if (rel.kind === "view-facing") { mass.rotation = yawFacingSouthToward(doc.siteStrategy.viewDirection); continue; }
      if (rel.kind === "arrival-facing") { mass.rotation = yawFacingNorthToward(doc.siteStrategy.arrivalDirection); continue; }
      const target = byId.get(rel.target); if (!target) continue;
      const distance = rel.distance ?? 0;
      if (rel.kind === "stepped-above") mass.elevation = target.elevation + distance;
      if (rel.kind === "stepped-below") mass.elevation = target.elevation - distance;
      if (["adjacent-to", "connected-to", "offset-from", "separated-from", "surrounds-courtyard", "bridge-between"].includes(rel.kind) && rel.side) {
        const gap = rel.kind === "connected-to" ? 0 : distance;
        if (rel.side === "east") mass.position.x = target.position.x + target.width / 2 + mass.width / 2 + gap;
        if (rel.side === "west") mass.position.x = target.position.x - target.width / 2 - mass.width / 2 - gap;
        if (rel.side === "north") mass.position.z = target.position.z - target.depth / 2 - mass.depth / 2 - gap;
        if (rel.side === "south") mass.position.z = target.position.z + target.depth / 2 + mass.depth / 2 + gap;
      }
      if (rel.rotationOffset !== undefined) mass.rotation = target.rotation + rel.rotationOffset;
    }
    byId.set(mass.id, mass);
  }
  return doc.massing.masses.map((m) => byId.get(m.id)!);
}

/**
 * A mass's total height (grade to roofline) is `floors * LEVEL_HEIGHT` unless it declares an explicit
 * `height` override — the sub-volume extension this enables: a mass whose declared height doesn't divide
 * evenly by the standard level (a soaring double-height entry hall, a lower-ceilinged service block) without
 * inventing a second geometry system. Floors within such a mass split that height evenly; multi-floor masses
 * with an override are rare but not rejected.
 */
export function massTotalHeight(mass: MassVolume): number { return mass.height ?? mass.floors * LEVEL_HEIGHT; }
/** Per-mass level height derived from `massTotalHeight` — identical to the global `LEVEL_HEIGHT` unless the mass overrides its height. */
function massLevelHeight(mass: MassVolume): number { return massTotalHeight(mass) / mass.floors; }

interface MassShellMaterials { exterior: ReturnType<typeof resolveMaterial>; trim: ReturnType<typeof resolveMaterial>; glass: ReturnType<typeof resolveMaterial> }

interface MassShellResult { primitives: HousePrimitive[]; warnings: string[]; topFloor: FloorFootprint }

const doorOnFloor = (door: DoorOpening, level: number) => !door.floors || door.floors === "all" || (door.floors === "ground" ? level === 0 : level > 0);
/** Height of a door the architect authored without one — a numeric default for an authored door, never a door of the compiler's own. */
const AUTHORED_DOOR_HEIGHT = 2.4;

/**
 * The AUTHORED door an entry recess is entered through on `level`: the door on that facade whose span overlaps
 * the recess. The compiler never supplies one — a recess with no authored door is built as the solid recess it
 * was authored as and reported, so the missing door is repaired by the Geometry Pass, not invented here.
 */
function entryRecessDoor(recess: NonNullable<WallEdge["entryRecess"]>, openings: readonly MassOpening[], mass: MassVolume, level: number): { width: number; height: number; frame: boolean } | undefined {
  const len = recess.facade === "north" || recess.facade === "south" ? mass.width : mass.depth;
  const authored = openings.find((o): o is DoorOpening => o.type === "door" && o.facade === recess.facade && doorOnFloor(o, level) && Math.min(o.start, o.end) < recess.end && Math.max(o.start, o.end) > recess.start);
  return authored ? { width: Math.abs(authored.end - authored.start) * len, height: authored.height ?? AUTHORED_DOOR_HEIGHT, frame: authored.frame ?? true } : undefined;
}

/** Doors that land in an entry recess are built in its back wall, not as slivers on the facade plane beside it. */
function withoutRecessedDoors(openings: readonly MassOpening[], recesses: readonly NonNullable<WallEdge["entryRecess"]>[]): readonly MassOpening[] {
  if (!recesses.length) return openings;
  return openings.filter((o) => o.type !== "door" || !recesses.some((r) => r.facade === o.facade && Math.min(o.start, o.end) < r.end && Math.max(o.start, o.end) > r.start));
}

/**
 * The deterministic mass shell compiler: turns a mass's base rectangle + its `operations`/`openings` into
 * floor slabs, walls (with facade-aware openings carved in) and a top-floor rectangle decomposition for
 * roofs — all in local, unrotated mass space, identical in structure to the legacy `generateHouseModel`
 * shell for a mass with no operations (same floor/wall ids), but able to produce articulated footprints for
 * one with them. Never calls into `generateHouseModel`: that stays legacy-only.
 */
function buildMassShell(mass: MassVolume, materials: MassShellMaterials): MassShellResult {
  const primitives: HousePrimitive[] = [];
  const warnings: string[] = [];
  let topFloor: FloorFootprint | undefined;
  const operations: readonly MassGeometryOperation[] = mass.operations ?? [];
  // Only what the architect authored: a mass with no openings is compiled with none.
  const openings: readonly MassOpening[] = mass.openings ?? [];
  const exteriorPaint = paintOf(materials.exterior);
  const levelHeight = massLevelHeight(mass);
  const wallHeight = levelHeight - FLOOR_THICKNESS;

  for (let level = 0; level < mass.floors; level++) {
    const footprint = buildFloorFootprint(mass.width, mass.depth, operations, level);
    warnings.push(...footprint.warnings.map((w) => `floor ${level}: ${w}`));
    const floorY = level * levelHeight;
    footprint.rects.forEach((rect, i) => {
      const suffix = footprint.rects.length > 1 ? `-${i}` : "";
      primitives.push(buildFloorSlabPrimitive(
        { center: [(rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2], width: rect.x1 - rect.x0, depth: rect.z1 - rect.z0 },
        floorY, FLOOR_THICKNESS, `floor-${level}${suffix}`, `Floor Slab ${level + 1}`, MATERIAL_COLORS.floor
      ));
    });
    // A chamfered corner's slab is the triangle inside the angled wall — never the square the rects leave out.
    footprint.wedges.forEach((wedge, i) => primitives.push(triMeshOf(
      `floor-${level}-wedge-${i}`, "floor", `Floor Slab ${level + 1}`, extrudeOutline(wedge.map((p) => [p[0], p[1]] as [number, number]), floorY, floorY + FLOOR_THICKNESS, { bottom: true }),
      { color: MATERIAL_COLORS.floor, roughness: .8, metalness: 0 },
    )));

    const wallBaseY = floorY + FLOOR_THICKNESS;
    const taggedEdges = footprint.edges.filter((e) => e.facade);
    const openEdges = footprint.edges.filter((e) => !e.facade && e.open);
    const untaggedEdges = footprint.edges.filter((e) => !e.facade && !e.open);
    const recesses = untaggedEdges.flatMap((e) => (e.entryRecess ? [e.entryRecess] : []));
    const openingsResult = buildMassOpenings(taggedEdges, mass.width, mass.depth, withoutRecessedDoors(openings, recesses), level, wallBaseY, wallHeight, `wall-${level}`, materials);
    primitives.push(...openingsResult.primitives);
    warnings.push(...openingsResult.warnings.map((w) => `floor ${level}: ${w}`));
    untaggedEdges.forEach((edge, i) => {
      const entryDoor = edge.entryRecess && entryRecessDoor(edge.entryRecess, openings, mass, level);
      if (edge.entryRecess && !entryDoor && level === 0) warnings.push(`floor 0: entry-recess on the ${edge.entryRecess.facade} facade has no authored door — built solid; author a door inside the recess.`);
      if (entryDoor) primitives.push(...buildEntryRecessDoor(edge, entryDoor, wallBaseY, wallHeight, `wall-${level}-entry-${i}`, materials));
      else if (edge.chamfer?.glazed) primitives.push(...buildGlazedWallEdge(edge, wallBaseY, wallHeight, `wall-${level}-cut-${i}`, materials));
      else primitives.push(buildPlainWallEdge(edge, wallBaseY, wallHeight, `wall-${level}-cut-${i}`, exteriorPaint));
    });
    openEdges.forEach((edge, i) => primitives.push(...buildColonnadePosts(edge, wallBaseY, wallHeight, `wall-${level}-open-${i}`, exteriorPaint)));

    if (level === mass.floors - 1) topFloor = footprint;
  }
  return { primitives, warnings, topFloor: topFloor ?? topFloorFootprintFor(mass) };
}

/** Cheap standalone top-floor footprint, for callers (e.g. roofs-only mode) that need it without building the full shell. */
function topFloorFootprintFor(mass: MassVolume): FloorFootprint {
  return buildFloorFootprint(mass.width, mass.depth, mass.operations ?? [], mass.floors - 1);
}

/**
 * One roof plate per rectangle of the mass's FINAL articulated top-floor footprint — never the original
 * width/depth rectangle blindly. A mass with no operations decomposes to exactly one rectangle, so its
 * roof is identical to before; an articulated mass gets one plate per rectangle instead of one giant plane
 * stretched over the whole bounding box, which is what produced the overlapping-roof look this replaces.
 *
 * For the flat/floating-flat family, the overhang is applied to the footprint's actual outline ONCE (see
 * `offsetFootprintOutline`), then that grown outline is decomposed into plates — not each rectangle of the
 * unexpanded footprint independently, which re-overlaps neighboring rectangles by up to 2×overhang and merges
 * a stepped/notched footprint back into one visual slab (the roof was hiding the walls' own articulation).
 * A chamfered (prow) footprint has angled edges no rectangle can follow, so its flat plate is one polygon
 * extrusion of the grown outline instead — the roof keeps the prow's angle rather than squaring the corner.
 *
 * Shed roofs likewise follow the grown outline as one sloped plane, sized by the recipe's own overhang and
 * pitch. Ridge families (gable/hip/butterfly) build per rectangle of the square-cornered hull, also from the
 * recipe's own pitch and overhang (see geometry/pitchedRoof.ts): they have no way to follow an angled edge,
 * which is why roof composition keeps them off chamfered volumes.
 *
 * Every family ends the same way: the geometry is handed to the mass's Roof System as faces + edges, and the
 * system's `finish` hook returns the finished roof — its own finish, fitted surface pattern and edge trim.
 */
function roofPrimitives(recipe: RoofRecipe, mass: MassVolume, topFloor: FloorFootprint, options: ArchitectureCompileOptions, system: RoofSystem): HousePrimitive[] {
  const exterior = resolveMaterial(options.materials.exterior);
  const finish = resolveRoofFinish(system, options.materials.roof);
  const roof: ResolvedMaterial = finish.paint;
  const base = mass.elevation + massTotalHeight(mass);
  const kind = recipe.kind === "mono-pitch" ? "shed" : recipe.kind === "pavilion" ? "hip" : recipe.kind === "cross-gable" ? "gable" : recipe.kind;
  const yaw = mass.rotation + (recipe.orientation ?? 0);
  const place = (p: HousePrimitive) => rotatePrimitiveY(translatePrimitive(p, mass.position.x, mass.position.z), mass.position.x, mass.position.z, yaw);
  const fallbackRect: Rect = { x0: -mass.width / 2, x1: mass.width / 2, z0: -mass.depth / 2, z1: mass.depth / 2 };
  const isFlatFamily = kind === "flat" || kind === "floating-flat";
  const overhang = Math.max(0, recipe.overhang ?? .6);
  const prefix = `architecture-${mass.id}-roof`;
  const grownOutline = () => (overhang > 0 ? offsetFootprintOutline(topFloor, mass.width, mass.depth, overhang).polygon : topFloor.polygon);
  const shape = roofShapeOf(recipe);
  const finished = (assembly: Omit<RoofAssembly, "id" | "shape">) => system.finish({ id: prefix, shape, ...assembly }, { finish, trim: paintOf(resolveMaterial(options.materials.trim)) }).map(place);

  if (kind === "shed") {
    const input = { id: prefix, outline: grownOutline(), footprint: topFloor.polygon, wallPlateY: base, pitchDeg: shape.pitchDeg, thickness: .2, roof: paintOf(roof), exterior: paintOf(exterior) };
    const built = buildPolygonShedRoof(input);
    const slab = built.find((p): p is TriMeshPrimitive => p.kind === "triMesh" && p.id === `${prefix}-slope`);
    // The slab becomes the system's surface face: low along the outline's south edge, rising north.
    const { zMax, top } = shedSlope(input);
    const xs = input.outline.map((p) => p[0]); const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const corners = input.outline.map((p): V3 => [p[0], top(p[0], p[1]), p[1]]);
    const plane = makePlane("slope", corners, [x0, top(x0, zMax), zMax], [x1, top(x1, zMax), zMax], slab?.vertices ?? []);
    const edges = outlineEdges(input.outline, top, (a, b, out) => (Math.abs(a[1] - b[1]) > 1e-6 ? "rake" : out[1] > 0 ? "eave" : "high-eave"));
    return finished({ planes: [plane], edges, structure: built.filter((p) => p !== slab), slab: true });
  }

  const chamfered = topFloor.chamfers.length > 0;
  if (isFlatFamily) {
    const grownPolygon = grownOutline();
    const gap = kind === "floating-flat" ? recipe.expression?.verticalGap ?? .18 : recipe.expression?.verticalGap ?? 0;
    const thickness = recipe.expression?.thickness ?? .25;
    // Mirrors buildRoofExpression's own defaults (plane thickness .25, no gap unless floating-flat): the roof deck's top.
    const deckTop = base + gap + thickness;
    const structure: HousePrimitive[] = [];
    if (chamfered) structure.push(...buildPolygonRoofPlate({ id: prefix, outline: grownPolygon, footprint: topFloor.polygon, wallPlateY: base, gap, thickness, roof: paintOf(roof), exterior: paintOf(exterior) }));
    else {
      let rects = decomposeToRectangles(grownPolygon);
      if (rects.length === 0) rects = [fallbackRect];
      // Flat recipes share a parameterized plane, fascia, soffit and closure assembly. `rects` are already grown
      // by `overhang` (see above), so the expression itself applies zero additional expansion.
      rects.forEach((rect, i) => structure.push(...buildRoofExpression({
        id: `${prefix}${rects.length > 1 ? `-${i}` : ""}`, width: rect.x1 - rect.x0, depth: rect.z1 - rect.z0, wallPlateY: base, roofMaterial: roof, exteriorMaterial: exterior,
        parameters: { ...recipe.expression, overhang: 0, verticalGap: kind === "floating-flat" ? recipe.expression?.verticalGap ?? .18 : recipe.expression?.verticalGap },
      }).map((p) => translatePrimitive(p, (rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2))));
    }
    // Opt-in only (see RoofRecipe.parapet doc comment): one loop around the roof's own already-grown polygon,
    // not per rectangle — a parapet is one continuous perimeter wall, not a separate ring per roof plate.
    const parapetTop = recipe.parapet ? deckTop + recipe.parapet.height : undefined;
    const parapetThickness = recipe.parapet?.thickness ?? 0.18;
    if (parapetTop !== undefined) structure.push(...buildParapetPrimitives(grownPolygon, base, parapetTop, parapetThickness, paintOf(exterior), `architecture-${mass.id}-parapet`));
    // The deck as a face with nothing to mesh (the plate is already built): pattern lines drain across its shorter side.
    const xs = grownPolygon.map((p) => p[0]), zs = grownPolygon.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const low: [V3, V3] = x1 - x0 >= z1 - z0 ? [[x0, deckTop, z1], [x1, deckTop, z1]] : [[x0, deckTop, z0], [x0, deckTop, z1]];
    const deck = makePlane("deck", grownPolygon.map((p): V3 => [p[0], deckTop, p[1]]), low[0], low[1], []);
    return finished({ planes: [deck], edges: outlineEdges(grownPolygon, () => deckTop, () => "perimeter"), structure, ...(parapetTop !== undefined ? { parapet: { topY: parapetTop, thickness: parapetThickness } } : {}) });
  }

  const hullRects = chamfered ? decomposeToRectangles(topFloor.hullPolygon) : topFloor.rects;
  const rects = hullRects.length > 0 ? hullRects : [fallbackRect];
  if (kind === "gable" || kind === "hip" || kind === "butterfly") {
    const build = kind === "gable" ? gableRoofGeometry : kind === "hip" ? hipRoofGeometry : butterflyRoofGeometry;
    const parts = rects.map((rect) => build({ rect, wallPlateY: base, pitchDeg: shape.pitchDeg, overhang }));
    const infill = parts.flatMap((p) => p.infill);
    return finished({
      planes: parts.flatMap((p, i) => p.planes.map((plane) => (rects.length > 1 ? { ...plane, id: `${plane.id}-${i}` } : plane))),
      edges: parts.flatMap((p) => p.edges),
      structure: infill.length ? [triMeshOf(`${prefix}-infill`, "roof", "Roof Wall Infill", infill, paintOf(exterior))] : [],
    });
  }
  // "mixed" names no buildable family: the legacy parapet slab, in the system's finish.
  return finished({ planes: [], edges: [], structure: rects.flatMap((rect, i) => buildFlatRoof(rect.x1 - rect.x0, rect.z1 - rect.z0, base, `${prefix}${rects.length > 1 ? `-${i}` : ""}`, roof, exterior).map((p) => translatePrimitive(p, (rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2))) });
}

/** Axis-aligned footprint bounds, ignoring rotation — same approximation level the capability plugins already use (e.g. courtyard-edge-wall). */
function footprintAABB(mass: MassVolume): Rect {
  return { x0: mass.position.x - mass.width / 2, x1: mass.position.x + mass.width / 2, z0: mass.position.z - mass.depth / 2, z1: mass.position.z + mass.depth / 2 };
}

/** 0 when the two footprints overlap/touch on an axis; otherwise the gap along whichever axis actually separates them (the smaller of the two is a conservative floor, not the true diagonal distance in a corner case). */
function footprintGap(a: Rect, b: Rect): number {
  const gapX = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
  const gapZ = Math.max(0, Math.max(a.z0 - b.z1, b.z0 - a.z1));
  return Math.max(gapX, gapZ);
}

const MIN_ROOF_OVERHANG = 0.3;
/** Overhang a recipe without one is compiled with (fixtures / pre-authority documents; a V2 stage roof always authors its own). */
const UNAUTHORED_OVERHANG = 0.6;
/** A trim keeps the authored roof language while the eave keeps at least this share of its authored reach… */
const LANGUAGE_PRESERVING_TRIM_RATIO = 0.5;
/** …or loses no more than this much of it (a small eave trimmed to the minimum is still the same roof). */
const LANGUAGE_PRESERVING_TRIM_M = 0.3;

/** One roof's eave after clearance processing, and whether the trim still reads as the roof the architect authored. */
export interface RoofClearance { massId: string; authored: number; cleared: number; neighborId?: string; gap?: number; preservesLanguage: boolean }

/** The deepest authored overhang that `cleared` would still be an intent-preserving trim of. */
export const maxPreservedOverhang = (cleared: number) => Math.max(cleared / LANGUAGE_PRESERVING_TRIM_RATIO, cleared + LANGUAGE_PRESERVING_TRIM_M);

/**
 * Collision clearance for eaves: where two neighboring roof volumes would merge, each eave is trimmed to half
 * the gap between the footprints (never below `MIN_ROOF_OVERHANG`). It only ever shortens an eave — never the
 * roof family, pitch, orientation or expression — and it reports, per roof, whether what is left is still the
 * authored roof (`preservesLanguage`). A trim that is not is a Roof Composition repair / a blocking integrity
 * failure, never a silently different roof. Relationships never exempt a collision.
 */
export function roofClearance(masses: readonly MassVolume[], roofs: readonly RoofRecipe[]): RoofClearance[] {
  const authored = new Map(roofs.map((r) => [r.massId, Math.max(0, r.overhang ?? UNAUTHORED_OVERHANG)] as const));
  const cleared = new Map(authored);
  const cause = new Map<string, { neighborId: string; gap: number }>();
  for (let i = 0; i < masses.length; i++) {
    for (let j = i + 1; j < masses.length; j++) {
      const a = masses[i], b = masses[j];
      if (!cleared.has(a.id) || !cleared.has(b.id)) continue;
      const gap = footprintGap(footprintAABB(a), footprintAABB(b));
      const oa = cleared.get(a.id)!, ob = cleared.get(b.id)!;
      if (oa + ob <= gap) continue;
      const share = Math.max(MIN_ROOF_OVERHANG, gap / 2);
      if (oa > share) { cleared.set(a.id, share); cause.set(a.id, { neighborId: b.id, gap }); }
      if (ob > share) { cleared.set(b.id, share); cause.set(b.id, { neighborId: a.id, gap }); }
    }
  }
  return [...authored].map(([massId, reach]) => {
    const kept = cleared.get(massId)!;
    return { massId, authored: reach, cleared: kept, ...cause.get(massId), preservesLanguage: kept >= reach || reach <= maxPreservedOverhang(kept) + 1e-9 };
  });
}

/** What the shell compiler reports for one mass (clipped/dropped operations, a recess with no authored door) — the Geometry Pass's own dry run. */
export function massShellWarnings(mass: MassVolume): string[] {
  const material = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });
  return buildMassShell(mass, { exterior: material, trim: material, glass: material }).warnings;
}

export function compileArchitecture(doc: ArchitecturalDesignDocument, options: ArchitectureCompileOptions): { model: HouseModel; errors: string[]; diagnostics?: ArchitectureDiagnostics } {
  const errors = validateArchitecturalDesignDocument(doc); if (errors.length) return { model: { id: "architecture-invalid", primitives: [] }, errors };
  const masses = resolveMasses(doc); const primitives: HousePrimitive[] = [];
  const clearance = roofClearance(masses, doc.roofs.recipes);
  const clearedOverhangs = new Map(clearance.map((c) => [c.massId, c.cleared] as const));
  const dominantMassId = pickDominantMass(masses)?.id;
  const roofSystems = planRoofSystems(doc.roofs, dominantMassId, options.materials.roof.material);
  const capabilityDiagnostics: ArchitectureDiagnostics["capabilities"] = [];
  const geometryDiagnostics: ArchitectureDiagnostics["geometry"] = [];
  const shellMaterials: MassShellMaterials = { exterior: resolveMaterial(options.materials.exterior), trim: resolveMaterial(options.materials.trim), glass: resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass }) };
  for (const mass of masses) {
    let topFloor: FloorFootprint;
    if (options.mode !== "roofs-only") {
      const shell = buildMassShell(mass, shellMaterials);
      topFloor = shell.topFloor;
      // "Openings" mode isolates just the facade openings (plus whatever capability plugins add — see below):
      // every other shell primitive is dropped rather than skipped at the source, since openings are carved
      // out of the same wall pass that builds the plain solid walls.
      const shellSource = options.mode === "openings-only" ? shell.primitives.filter((p) => p.category === "window") : shell.primitives;
      const shellPrimitives = shellSource.map((p) => ({ ...p, id: `architecture-${mass.id}-${p.id}`, label: `${mass.name}: ${p.label}` }));
      geometryDiagnostics.push({ massId: mass.id, operationsRequested: mass.operations?.length ?? 0, openingsRequested: mass.openings?.length ?? 0, topFloorRectCount: shell.topFloor.rects.length, warnings: shell.warnings });
      // A cantilevered mass offsets every primitive above the ground floor along its declared side, in world space.
      const cantileverOffset = mass.cantilever ? SIDE_VECTOR[mass.cantilever.direction] : undefined;
      const levelHeight = massLevelHeight(mass);
      primitives.push(...shellPrimitives.map((p) => {
        // Shell primitives are still in un-lifted local space here, so a box's center / a mesh's lowest vertex gives its floor.
        const localY = p.kind === "box" ? p.position[1] : Math.min(...p.vertices.filter((_, i) => i % 3 === 1));
        const floorIndex = Math.floor((localY + 1e-6) / levelHeight);
        const lifted = p.kind === "box" ? { ...p, position: [p.position[0], p.position[1] + mass.elevation, p.position[2]] as [number, number, number] } : { ...p, vertices: p.vertices.map((v, i) => i % 3 === 1 ? v + mass.elevation : v) };
        const placed = rotatePrimitiveY(translatePrimitive(lifted, mass.position.x, mass.position.z), mass.position.x, mass.position.z, mass.rotation);
        if (cantileverOffset && floorIndex >= 1) {
          const distance = mass.cantilever!.distance;
          return translatePrimitive(placed, cantileverOffset[0] * distance, cantileverOffset[1] * distance);
        }
        return placed;
      }));
      // A compact marker makes mass-only inspection readable without a special renderer — "massing-only" shows
      // it alongside the real shell; "geometry-only" shows just the real articulated shell on its own.
      if (options.mode === "massing-only") primitives.push({ kind: "box", id: `architecture-${mass.id}-debug-footprint`, category: "floor", label: `${mass.name} · rot ${(mass.rotation * 180 / Math.PI).toFixed(0)}° · elev ${mass.elevation}m`, position: [mass.position.x, mass.elevation + 0.025, mass.position.z], rotation: [0, mass.rotation, 0], size: [mass.width, 0.05, mass.depth], color: "#ff9d2e", roughness: .65 });
    } else {
      topFloor = topFloorFootprintFor(mass);
      geometryDiagnostics.push({ massId: mass.id, operationsRequested: mass.operations?.length ?? 0, openingsRequested: mass.openings?.length ?? 0, topFloorRectCount: topFloor.rects.length, warnings: [] });
    }
    if (options.mode !== "massing-only" && options.mode !== "geometry-only" && options.mode !== "openings-only") for (const recipe of doc.roofs.recipes.filter((r) => r.massId === mass.id)) {
      const cleared = clearedOverhangs.get(mass.id);
      const system = getRoofSystem(roofSystems.roofs.find((r) => r.recipeId === recipe.id && r.massId === mass.id)!.system)!;
      primitives.push(...roofPrimitives(cleared !== undefined && cleared !== recipe.overhang ? { ...recipe, overhang: cleared } : recipe, mass, topFloor, options, system));
    }
    // Architectural stages declare intent. Only the capability engine chooses and invokes geometry plugins.
    // Always runs (even in "openings-only") — capability output like corner-glazing IS opening geometry.
    for (const intent of doc.capabilities?.filter((request) => request.parameters?.massId === mass.id) ?? []) {
      const outcome = requestCapability(intent, { primitives, target: mass, allMasses: masses });
      if (outcome.remove?.length) {
        const toRemove = new Set(outcome.remove);
        for (let i = primitives.length - 1; i >= 0; i--) if (toRemove.has(primitives[i].id)) primitives.splice(i, 1);
      }
      primitives.push(...outcome.primitives);
      capabilityDiagnostics.push({ id: outcome.id, massId: mass.id, status: outcome.status, note: outcome.note });
    }
  }
  const diagnostics: ArchitectureDiagnostics = {
    massCount: masses.length,
    masses: masses.map((m) => ({ id: m.id, name: m.name, role: m.role, position: m.position, rotation: m.rotation, elevation: m.elevation })),
    roofs: doc.roofs.recipes.map((r) => ({ massId: r.massId, kind: r.kind })),
    capabilities: capabilityDiagnostics,
    geometry: geometryDiagnostics,
    courtyards: computeCourtyards(masses),
    dominantMassId,
    roofSystems,
    roofClearance: clearance,
  };
  return { model: { id: "architectural-design-document", primitives }, errors: [], diagnostics };
}

/** Shared by `projectArchitectureToLegacy` and the V2 Final Assembly trim (finalAssembly.ts) — one place mapping the V2 roof vocabulary onto the legacy `RoofType` enum. */
export const ROOF_KIND_TO_LEGACY_TYPE: Record<RoofRecipeKind, RoofType> = { flat: "flat", "floating-flat": "flat", shed: "shed", "mono-pitch": "shed", gable: "gable", hip: "hip", butterfly: "butterfly", pavilion: "hip", "cross-gable": "gable", mixed: "flat" };

/** Compatibility projection intentionally selects a primary mass; it does not flatten the new composition. */
export function projectArchitectureToLegacy(doc: ArchitecturalDesignDocument): Record<string, unknown> {
  const main = doc.massing.masses.find((m) => m.role === "main-living") ?? doc.massing.masses[0];
  const recipe = doc.roofs.recipes.find((r) => r.massId === main?.id);
  return { house: { width: main?.width ?? 10, depth: main?.depth ?? 8, floors: main?.floors ?? 1, roof: ROOF_KIND_TO_LEGACY_TYPE[recipe?.kind ?? "flat"] }, architectureDocument: doc };
}

/** One mass's full architectural state, for dev diagnostics/reporting and the design-quality gate — never required by rendering. */
export interface MassReportEntry {
  id: string; name: string; role: MassRole;
  width: number; depth: number; floors: number;
  position: { x: number; z: number }; rotation: number; elevation: number;
  relationships: readonly MassRelationship[];
  operations: readonly MassGeometryOperation[];
  openings: readonly MassOpening[];
  roof?: { kind: RoofRecipeKind; overhang?: number };
  capabilities: { id: string; status: CapabilityOutcome["status"]; note?: string }[];
  primitiveCount: number;
}

/**
 * Turns a compiled document + its diagnostics into one full report per mass — role, dimensions, resolved
 * placement, relationships, operations, openings, roof, capability outcomes, and how many primitives it
 * actually produced. Built once, reused by the design-quality gate (`qualityGate.ts`) and dev-diagnostics
 * tooling (`ArchitectureDebugPanel.tsx`), so "what did this design actually turn into" is answered in one
 * place instead of re-read ad hoc — this is what a one-off audit of a live run would otherwise have needed.
 */
export function describeCompiledDesign(doc: ArchitecturalDesignDocument, model: HouseModel, diagnostics: ArchitectureDiagnostics): MassReportEntry[] {
  const masses = resolveMasses(doc);
  return masses.map((mass) => {
    const roof = doc.roofs.recipes.find((r) => r.massId === mass.id);
    const prefix = `architecture-${mass.id}-`;
    const capabilityPattern = `-${mass.id}-`;
    const primitiveCount = model.primitives.filter((p) => p.id.startsWith(prefix) || p.id.includes(capabilityPattern)).length;
    return {
      id: mass.id, name: mass.name, role: mass.role,
      width: mass.width, depth: mass.depth, floors: mass.floors,
      position: mass.position, rotation: mass.rotation, elevation: mass.elevation,
      relationships: mass.relationships ?? [],
      operations: mass.operations ?? [],
      openings: mass.openings ?? [],
      roof: roof ? { kind: roof.kind, overhang: roof.overhang } : undefined,
      capabilities: diagnostics.capabilities.filter((c) => c.massId === mass.id).map((c) => ({ id: c.id, status: c.status, note: c.note })),
      primitiveCount,
    };
  });
}
