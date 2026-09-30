import type { CompassSide } from "@/types/house";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { HousePrimitive } from "@/lib/house/types";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import { FLOOR_THICKNESS } from "@/lib/house/constants";
import { compileArchitecture, massTotalHeight, type ArchitectureDiagnostics, type CourtyardInfo } from "./compiler";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument, type MassFacade, type MassVolume } from "./document";
import { buildFloorFootprint } from "./geometry/footprint";
import { runDesignQualityGate, type QualityGateResult } from "./stages/qualityGate";
import { worldSideOf } from "./volumePlan";

/**
 * What an accepted V2 document actually turned into, read back from the deterministic compiler's own output —
 * never from the document's intent alone. The architecture critic scores this instead of legacy scene fields
 * (`windows`, `patios`, `porches`, `bays`), which a V2 project never authors. Every quantity here is geometry
 * the compiler built: a glazing zone the footprint clipped away, a capability that fell back, or an open
 * terrace skipped as overlapping contributes nothing.
 */

/** One compiled pane of glass (facade glazing, a glazed door, a glazed prow, or capability glazing such as corner-glazing). */
export interface GlassPane {
  massId: string;
  /** World side the glass faces, from its compiled orientation. */
  side: CompassSide;
  area: number; length: number; height: number;
  door: boolean;
  /** A door, or floor-to-ceiling glass, on the ground floor of a mass at grade — a pane a person could step through. */
  atGrade: boolean;
  /** Faces the courtyard its mass encloses or anchors. */
  facesCourtyard: boolean;
  /** Height of the pane's bottom above its floor slab. */
  sill: number;
  /** A compiled screen (screen-layer battens or brise-soleil fins) stands in front of it. */
  screened: boolean;
  /** Another volume stands in front of it within `VIEW_OBSTRUCTION_M`. */
  obstructedBy?: string;
}

/** One compiled open edge (the header + posts of a recess/projection with `open: true`): a covered outdoor room. */
export interface OutdoorRoom { massId: string; side: CompassSide; width: number; depth: number; area: number; posts: boolean; level: number; atGrade: boolean; facesCourtyard: boolean }

export interface CourtyardEvidence extends CourtyardInfo { width: number; depth: number; valid: boolean }

export interface V2Evidence {
  doc: ArchitecturalDesignDocument;
  masses: MassVolume[];
  diagnostics: ArchitectureDiagnostics;
  gate: QualityGateResult;
  view: CompassSide; arrival: CompassSide;
  glass: GlassPane[];
  outdoorRooms: OutdoorRoom[];
  courtyards: CourtyardEvidence[];
  /** Compiled screen elements: brise-soleil fins and screen-layer battens/rails. */
  screenElements: number;
  /** Distinct (mass, world side) facades a compiled screen stands on. */
  screenedFacades: number;
  /** Every compiler warning (clipped/dropped operations), prefixed with its mass. */
  warnings: string[];
}

/** A pane "sees" the view only if no other volume stands in front of it within this distance. */
export const VIEW_OBSTRUCTION_M = 20;
const MIN_COURTYARD_M = 3;
const WALK_OUT_HEIGHT_M = 1.9;
const WALK_OUT_SILL_M = 0.35;
const GRADE_TOLERANCE_M = 0.6;
const EPS = 1e-6;

type Box = Extract<HousePrimitive, { kind: "box" }>;
const GLASS_LABEL = /glass|glazing|glazed door panel/i;
const NOT_GLASS_LABEL = /frame|mullion/i;
const SCREEN_LABEL = /^(Screen Layer · |Brise Soleil · Fin)/;
const isScreen = (p: HousePrimitive): p is Box => p.kind === "box" && SCREEN_LABEL.test(p.label);
const isGlass = (p: HousePrimitive): p is Box => p.kind === "box" && p.category === "window" && GLASS_LABEL.test(p.label) && !NOT_GLASS_LABEL.test(p.label);

/** The accepted V2 document embedded in a generation's scene JSON — only present when it validated (see finalAssembly.ts). */
export function v2DocumentFromScene(root: Record<string, unknown>): ArchitecturalDesignDocument | undefined {
  const doc = root.architecturalDesignDocument;
  if (!isArchitecturalDesignDocument(doc)) return undefined;
  if (!Array.isArray(doc.massing?.masses) || doc.massing.masses.length === 0 || !Array.isArray(doc.roofs?.recipes)) return undefined;
  try {
    return validateArchitecturalDesignDocument(doc).length === 0 ? doc : undefined;
  } catch {
    return undefined;
  }
}

/** Which mass a compiled primitive belongs to: shell ids are `architecture-<mass>-…`, capability ids embed `-<mass>-`. Longest id wins so `wing` never claims `wing-2`'s geometry. */
function ownerOf(id: string, masses: readonly MassVolume[]): MassVolume | undefined {
  let best: MassVolume | undefined;
  for (const mass of masses) {
    if (!id.startsWith(`architecture-${mass.id}-`) && !id.includes(`-${mass.id}-`)) continue;
    if (!best || mass.id.length > best.id.length) best = mass;
  }
  return best;
}

function sideOfVector(x: number, z: number): CompassSide {
  return (Object.keys(SIDE_VECTOR) as CompassSide[]).reduce((best, side) => {
    const [bx, bz] = SIDE_VECTOR[best], [sx, sz] = SIDE_VECTOR[side];
    return sx * x + sz * z > bx * x + bz * z ? side : best;
  });
}

/** Rotated footprint's exact world AABB. */
function worldBounds(mass: MassVolume): { x0: number; x1: number; z0: number; z1: number } {
  const c = Math.abs(Math.cos(mass.rotation)), s = Math.abs(Math.sin(mass.rotation));
  const hx = (mass.width * c + mass.depth * s) / 2, hz = (mass.width * s + mass.depth * c) / 2;
  return { x0: mass.position.x - hx, x1: mass.position.x + hx, z0: mass.position.z - hz, z1: mass.position.z + hz };
}

/** Nearest other volume a ray from (x, z) along (dx, dz) at height y hits within `VIEW_OBSTRUCTION_M`. */
function obstruction(x: number, y: number, z: number, dx: number, dz: number, owner: MassVolume, masses: readonly MassVolume[]): string | undefined {
  let nearest: { id: string; t: number } | undefined;
  for (const other of masses) {
    if (other.id === owner.id) continue;
    if (y < other.elevation - EPS || y > other.elevation + massTotalHeight(other) + EPS) continue;
    const b = worldBounds(other);
    let t0 = 0, t1 = VIEW_OBSTRUCTION_M;
    for (const [o, d, lo, hi] of [[x, dx, b.x0, b.x1], [z, dz, b.z0, b.z1]] as const) {
      if (Math.abs(d) < EPS) { if (o < lo || o > hi) { t0 = Infinity; break; } continue; }
      const a = (lo - o) / d, c = (hi - o) / d;
      t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c));
    }
    if (t0 <= t1 && (!nearest || t0 < nearest.t)) nearest = { id: other.id, t: t0 };
  }
  return nearest?.id;
}

/** A world point in its mass's local frame: which local facade it stands on, and where along it (compass u). */
function localPlacement(mass: MassVolume, x: number, z: number): { facade: MassFacade; u: number } {
  const dx = x - mass.position.x, dz = z - mass.position.z;
  const c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
  // Inverse of rotatePrimitiveY's (x·cos + z·sin, −x·sin + z·cos).
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const ns = Math.abs(lz) / (mass.depth / 2) >= Math.abs(lx) / (mass.width / 2);
  return ns ? { facade: lz < 0 ? "north" : "south", u: (lx + mass.width / 2) / mass.width } : { facade: lx > 0 ? "east" : "west", u: (lz + mass.depth / 2) / mass.depth };
}

type ScreenSpans = Map<string, { start: number; end: number }>;
function screenSpans(primitives: readonly HousePrimitive[], masses: readonly MassVolume[]): { spans: ScreenSpans; elements: number } {
  const spans: ScreenSpans = new Map();
  let elements = 0;
  for (const p of primitives) {
    if (!isScreen(p)) continue;
    const mass = ownerOf(p.id, masses);
    if (!mass) continue;
    elements++;
    const { facade, u } = localPlacement(mass, p.position[0], p.position[2]);
    const half = /Rail/.test(p.label) ? Math.max(p.size[0], p.size[2]) / 2 / (facade === "north" || facade === "south" ? mass.width : mass.depth) : 0;
    const key = `${mass.id}:${worldSideOf(facade, mass.rotation)}`;
    const span = spans.get(key) ?? { start: Infinity, end: -Infinity };
    spans.set(key, { start: Math.min(span.start, u - half), end: Math.max(span.end, u + half) });
  }
  return { spans, elements };
}

function glassPanes(primitives: readonly HousePrimitive[], masses: readonly MassVolume[], courtyards: readonly CourtyardInfo[], screens: ScreenSpans): GlassPane[] {
  const panes: GlassPane[] = [];
  for (const p of primitives) {
    if (!isGlass(p)) continue;
    const mass = ownerOf(p.id, masses);
    if (!mass) continue;
    // A pane is a thin box: its facing is the thinner horizontal axis, turned by the box's own yaw (same convention as rotatePrimitiveY).
    const alongX = p.size[0] >= p.size[2];
    const [lx, lz] = alongX ? [0, 1] : [1, 0];
    const yaw = p.rotation[1], c = Math.cos(yaw), s = Math.sin(yaw);
    let nx = lx * c + lz * s, nz = -lx * s + lz * c;
    // Outward is away from the mass centre (the cantilever shift is along the facade normal, so it never flips this).
    if (nx * (p.position[0] - mass.position.x) + nz * (p.position[2] - mass.position.z) < 0) { nx = -nx; nz = -nz; }
    const length = Math.max(p.size[0], p.size[2]), height = p.size[1];
    const levelHeight = massTotalHeight(mass) / mass.floors;
    const ground = p.position[1] - mass.elevation < levelHeight;
    const door = /door/i.test(p.label);
    // Floor-to-ceiling: the pane starts at the ground-floor slab (glass is inset by its frame border, hence the tolerance).
    const floorIndex = Math.max(0, Math.floor((p.position[1] - mass.elevation) / levelHeight));
    const sill = p.position[1] - height / 2 - (mass.elevation + floorIndex * levelHeight + FLOOR_THICKNESS);
    const side = sideOfVector(nx, nz);
    panes.push({
      massId: mass.id, side, area: length * height, length, height, door,
      atGrade: ground && mass.elevation <= GRADE_TOLERANCE_M && (door || (height >= WALK_OUT_HEIGHT_M && sill <= WALK_OUT_SILL_M)),
      sill,
      screened: (() => { const span = screens.get(`${mass.id}:${side}`); const { u } = localPlacement(mass, p.position[0], p.position[2]); return !!span && u >= span.start - 0.03 && u <= span.end + 0.03; })(),
      facesCourtyard: courtyardSideFor(mass, courtyards) === side,
      obstructedBy: obstruction(p.position[0] + nx * 0.2, p.position[1], p.position[2] + nz * 0.2, nx, nz, mass, masses),
    });
  }
  return panes;
}

/** Local facade an axis-aligned open edge sits on (a recess never reaches past the mass's own centre line). */
function localFacadeOf(a: readonly [number, number], b: readonly [number, number]): MassFacade {
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  if (Math.abs(a[1] - b[1]) < EPS) return mz < 0 ? "north" : "south";
  return mx > 0 ? "east" : "west";
}

function courtyardSideFor(mass: MassVolume, courtyards: readonly CourtyardInfo[]): CompassSide | undefined {
  const court = courtyards.find((c) => c.anchorMassId === mass.id || c.enclosingMassIds.includes(mass.id));
  if (!court) return undefined;
  const cx = (court.bounds.x0 + court.bounds.x1) / 2, cz = (court.bounds.z0 + court.bounds.z1) / 2;
  if (Math.abs(cx - mass.position.x) < EPS && Math.abs(cz - mass.position.z) < EPS) return undefined;
  return sideOfVector(cx - mass.position.x, cz - mass.position.z);
}

/** Open edges exactly as the compiler builds them (`buildFloorFootprint` → `buildColonnadePosts`), kept only where the header primitive really exists. */
function outdoorRooms(primitiveIds: ReadonlySet<string>, masses: readonly MassVolume[], courtyards: readonly CourtyardInfo[]): OutdoorRoom[] {
  const rooms: OutdoorRoom[] = [];
  for (const mass of masses) {
    const courtSide = courtyardSideFor(mass, courtyards);
    for (let level = 0; level < mass.floors; level++) {
      const footprint = buildFloorFootprint(mass.width, mass.depth, mass.operations ?? [], level);
      footprint.edges.filter((e) => !e.facade && e.open).forEach((edge, i) => {
        if (!primitiveIds.has(`architecture-${mass.id}-wall-${level}-open-${i}-header`)) return;
        const facade = localFacadeOf(edge.a, edge.b);
        const width = Math.hypot(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]);
        const op = (mass.operations ?? []).find((o) => (o.type === "projection" || o.type === "recess") && o.open && o.facade === facade);
        const depth = op && "depth" in op ? op.depth : 0;
        const side = worldSideOf(facade, mass.rotation);
        rooms.push({ massId: mass.id, side, width, depth, area: width * depth, posts: Boolean(edge.postSpacing), level, atGrade: level === 0 && mass.elevation <= GRADE_TOLERANCE_M, facesCourtyard: courtSide === side });
      });
    }
  }
  return rooms;
}

/** Compiles the accepted document (deterministic, no AI) and reads back what was actually built. Undefined when it does not compile. */
export function collectV2Evidence(doc: ArchitecturalDesignDocument): V2Evidence | undefined {
  const compiled = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
  if (compiled.errors.length || !compiled.diagnostics) return undefined;
  const diagnostics = compiled.diagnostics;
  const primitives = compiled.model.primitives;
  // The compiler resolves placement internally; re-resolve identically so evidence and geometry agree.
  const masses = doc.massing.masses.map((m) => ({ ...m, ...diagnostics.masses.find((d) => d.id === m.id) })) as MassVolume[];
  const courtyards = diagnostics.courtyards.map((c) => {
    const width = c.bounds.x1 - c.bounds.x0, depth = c.bounds.z1 - c.bounds.z0;
    return { ...c, width, depth, valid: c.enclosingMassIds.length + 1 >= 3 && width >= MIN_COURTYARD_M && depth >= MIN_COURTYARD_M };
  });
  const screens = screenSpans(primitives, masses);
  return {
    doc, masses, diagnostics,
    gate: runDesignQualityGate(doc, diagnostics),
    view: doc.siteStrategy.viewDirection, arrival: doc.siteStrategy.arrivalDirection,
    glass: glassPanes(primitives, masses, courtyards, screens.spans),
    outdoorRooms: outdoorRooms(new Set(primitives.map((p) => p.id)), masses, courtyards),
    courtyards,
    screenElements: screens.elements,
    screenedFacades: screens.spans.size,
    warnings: diagnostics.geometry.flatMap((g) => g.warnings.map((w) => `${g.massId}: ${w}`)),
  };
}
