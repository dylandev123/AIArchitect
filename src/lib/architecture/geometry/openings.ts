import type { HousePrimitive } from "@/lib/house/types";
import { box, paintOf, type Paint } from "@/lib/house/architecture/parts";
import { WALL_THICKNESS } from "@/lib/house/constants";
import type { ResolvedMaterial } from "@/lib/house/materials";
import type { MassFacade, MassOpening } from "../document";
import { facadePointAt, type WallEdge } from "./footprint";

export interface OpeningMaterials { exterior: ResolvedMaterial; trim: ResolvedMaterial; glass: ResolvedMaterial }

export interface MassOpeningsResult {
  primitives: HousePrimitive[];
  warnings: string[];
}

const EPS = 1e-6;
const FRAME_THICKNESS = 0.08;
const GLASS_THICKNESS = 0.03;
const FRAME_BORDER = 0.06;
/** Every wall/frame/glass box is centered this far inward from the footprint's outer boundary edge — matches buildWallRingPrimitives' convention so V2 walls read the same as the legacy shell. */
const WALL_INSET = WALL_THICKNESS / 2;

function facadeLength(facade: MassFacade, width: number, depth: number): number {
  return facade === "north" || facade === "south" ? width : depth;
}

/** Inverse of `facadePointAt`: the compass-intuitive u (0..1) of a point known to already lie on that facade's original plane. */
function inverseU(facade: MassFacade, point: readonly [number, number], width: number, depth: number): number {
  const halfW = width / 2, halfD = depth / 2;
  if (facade === "north" || facade === "south") return (point[0] + halfW) / width;
  return (point[1] + halfD) / depth;
}

interface Band { start: number; end: number; sill?: number; height?: number; frame?: boolean; reveal?: number; door?: boolean }

function appliesToFloor(scope: MassOpening["floors"], floorIndex: number): boolean {
  if (!scope || scope === "all") return true;
  if (scope === "ground") return floorIndex === 0;
  return floorIndex > 0;
}

/** Every opening op resolved into 0+ punched bands, in the facade's compass-u (0..1), with sill/height in meters. */
function openingBands(facade: MassFacade, width: number, depth: number, openings: readonly MassOpening[], floorIndex: number, wallHeight: number): Band[] {
  const len = facadeLength(facade, width, depth);
  const bands: Band[] = [];
  for (const op of openings) {
    if (op.facade !== facade || !appliesToFloor(op.floors, floorIndex)) continue;
    if (op.type === "glazing-zone") {
      const start = Math.max(0, Math.min(op.start, op.end));
      const end = Math.min(1, Math.max(op.start, op.end));
      if (end - start < EPS) continue;
      const height = Math.max(0.3, Math.min(wallHeight - 0.2, op.heightRatio * wallHeight));
      const sill = Math.max(0.05, (wallHeight - height) / 2);
      bands.push({ start, end, sill, height, frame: op.frame, reveal: op.reveal });
    } else if (op.type === "door") {
      const start = Math.max(0, Math.min(op.start, op.end));
      const end = Math.min(1, Math.max(op.start, op.end));
      if (end - start >= EPS) bands.push({ start, end, sill: 0, height: Math.max(1.9, Math.min(wallHeight - 0.05, op.height ?? 2.4)), frame: op.frame ?? true, reveal: op.reveal, door: true });
    } else {
      const widthU = Math.min(1, op.width / len);
      const totalSpan = Math.min(1, op.count * widthU + (op.count - 1) * (widthU * 0.4));
      const gapU = op.count > 1 ? (totalSpan - op.count * widthU) / (op.count - 1) : 0;
      let cursor = (1 - totalSpan) / 2;
      for (let i = 0; i < op.count; i++) {
        bands.push({ start: cursor, end: cursor + widthU, sill: op.sill, height: op.height });
        cursor += widthU + gapU;
      }
    }
  }
  return bands.sort((a, b) => a.start - b.start);
}

/** Fills the gaps between punched bands (and before/after them) with plain solid spans covering the full [0,1] facade range. */
function fillSolidGaps(bands: readonly Band[]): { start: number; end: number; opening?: Band }[] {
  const out: { start: number; end: number; opening?: Band }[] = [];
  let cursor = 0;
  for (const b of bands) {
    if (b.start < cursor - EPS) continue; // overlapping request — drop, caller already warned
    if (b.start > cursor + EPS) out.push({ start: cursor, end: b.start });
    out.push({ start: b.start, end: b.end, opening: b });
    cursor = b.end;
  }
  if (cursor < 1 - EPS) out.push({ start: cursor, end: 1 });
  return out;
}

function facadeNormal(facade: MassFacade): [number, number] {
  return facade === "north" ? [0, -1] : facade === "south" ? [0, 1] : facade === "east" ? [1, 0] : [-1, 0];
}

function segmentGeometry(facade: MassFacade, u0: number, u1: number, width: number, depth: number): { center: Vec3Local; length: number; alongX: boolean } {
  const [p0x, p0z] = facadePointAt(facade, u0, width, depth);
  const [p1x, p1z] = facadePointAt(facade, u1, width, depth);
  const [nx, nz] = facadeNormal(facade);
  const cx = (p0x + p1x) / 2 - nx * WALL_INSET;
  const cz = (p0z + p1z) / 2 - nz * WALL_INSET;
  const alongX = facade === "north" || facade === "south";
  const length = Math.hypot(p1x - p0x, p1z - p0z);
  return { center: [cx, cz], length, alongX };
}

type Vec3Local = [number, number];

/**
 * Replaces one tagged wall segment's naive full-height box with plain-solid and punched-opening bands: below
 * a sill and above a window head it's still solid wall; the window itself is a frame + glass insert at the
 * wall's own plane. No boolean cut — the solid wall is simply never built across an opening's span.
 */
function buildSegment(facade: MassFacade, edgeU0: number, edgeU1: number, width: number, depth: number, openings: readonly MassOpening[], floorIndex: number, wallBaseY: number, wallHeight: number, idPrefix: string, materials: OpeningMaterials, _warnings: string[]): HousePrimitive[] {
  const edgeLenU = edgeU1 - edgeU0;
  if (edgeLenU < EPS) return [];
  // Bands are computed against the FULL facade (0..1), then clipped to this segment's own [edgeU0, edgeU1].
  const requested = openingBands(facade, width, depth, openings, floorIndex, wallHeight);
  const clipped: Band[] = [];
  for (const b of requested) {
    const s = Math.max(b.start, edgeU0), e = Math.min(b.end, edgeU1);
    if (e - s < EPS) continue;
    // An articulated footprint naturally divides a facade into segments. Splitting an opening across
    // those segments is expected (and each resulting piece is built), so it is not a compiler warning.
    clipped.push({ ...b, start: s, end: e });
  }
  const bands = fillSolidGaps(clipped.map((b) => ({ ...b, start: (b.start - edgeU0) / edgeLenU, end: (b.end - edgeU0) / edgeLenU })));

  const out: HousePrimitive[] = [];
  const exteriorPaint = paintOf(materials.exterior);
  const trimPaint = paintOf(materials.trim);
  const glassPaint = paintOf(materials.glass);
  let windowIndex = 0;
  bands.forEach((band, bandIndex) => {
    const u0 = edgeU0 + band.start * edgeLenU;
    const u1 = edgeU0 + band.end * edgeLenU;
    if (u1 - u0 < EPS) return;
    const { center, length, alongX } = segmentGeometry(facade, u0, u1, width, depth);
    // Backward-compatible id: an unmodified facade (one band covering the whole segment) keeps today's
    // plain `wall-<level>-<facade>` id exactly; only a facade actually carved by an operation gets suffixed.
    const bandId = bands.length > 1 ? `${idPrefix}-${bandIndex}` : idPrefix;
    if (!band.opening) {
      out.push(box(bandId, "wall", "Wall", [center[0], wallBaseY + wallHeight / 2, center[1]], alongX ? [length, wallHeight, WALL_THICKNESS] : [WALL_THICKNESS, wallHeight, length], exteriorPaint));
      return;
    }
    const sill = Math.max(0, Math.min(wallHeight - 0.2, band.opening.sill ?? 0.9));
    const height = Math.max(0.3, Math.min(wallHeight - sill, band.opening.height ?? wallHeight - sill - 0.3));
    if (sill > 0.02) out.push(box(`${bandId}-sill-wall`, "wall", "Wall (below sill)", [center[0], wallBaseY + sill / 2, center[1]], alongX ? [length, sill, WALL_THICKNESS] : [WALL_THICKNESS, sill, length], exteriorPaint));
    const headHeight = wallHeight - sill - height;
    if (headHeight > 0.02) out.push(box(`${bandId}-head-wall`, "wall", "Wall (above head)", [center[0], wallBaseY + sill + height + headHeight / 2, center[1]], alongX ? [length, headHeight, WALL_THICKNESS] : [WALL_THICKNESS, headHeight, length], exteriorPaint));
    const winId = `${idPrefix}-${band.opening.door ? "door" : "window"}-${windowIndex++}`;
    const winY = wallBaseY + sill + height / 2;
    // `reveal` sets the glass/frame back from the wall's outer face along the facade's own outward normal —
    // the sill/head walls above stay at the original plane, so the setback reads as a shaded recess.
    const reveal = band.opening.reveal ?? 0;
    const [nx, nz] = facadeNormal(facade);
    const glassCenter: Vec3Local = [center[0] - nx * reveal, center[1] - nz * reveal];
    out.push(box(`${winId}-frame`, "window", band.opening.door ? "Door Frame" : "Window Frame", [glassCenter[0], winY, glassCenter[1]], alongX ? [length, height, FRAME_THICKNESS] : [FRAME_THICKNESS, height, length], trimPaint));
    const glassLength = Math.max(0.1, length - FRAME_BORDER * 2);
    out.push(box(`${winId}-${band.opening.door ? "panel" : "glass"}`, "window", band.opening.door ? "Glazed Door Panel" : "Window Glass", [glassCenter[0], winY, glassCenter[1]], alongX ? [glassLength, height - FRAME_BORDER * 2, GLASS_THICKNESS] : [GLASS_THICKNESS, height - FRAME_BORDER * 2, glassLength], glassPaint));
    // `frame: true` adds a heavier structural surround (posts at each end of the band, full sill-to-head
    // height) instead of just the plain window frame above — for a facade meant to read as deliberately framed.
    if (band.opening.frame) {
      const postSize = FRAME_THICKNESS * 2.5;
      const postSpan = sill + height + headHeight;
      const postY = wallBaseY + postSpan / 2;
      const halfLen = length / 2 - postSize / 2;
      const postAt = (offset: number): Vec3Local => alongX ? [center[0] + offset, center[1]] : [center[0], center[1] + offset];
      [-halfLen, halfLen].forEach((offset, i) => {
        const [px, pz] = postAt(offset);
        out.push(box(`${winId}-surround-${i}`, "wall", "Window Surround Post", [px, postY, pz], alongX ? [postSize, postSpan, postSize] : [postSize, postSpan, postSize], trimPaint));
      });
    }
  });
  return out;
}

/**
 * Builds every wall along one floor's facade-tagged edges, carving in whatever `openings` request. Edges with
 * no facade tag (a notch's inward cut, or a recessed dent's setback run) are still built as plain full-height
 * solid walls by the caller — this function only ever touches edges that lie on an original facade plane,
 * matching the compass-u coordinate every opening op is authored in. `levelIdPrefix` is just the floor level
 * (e.g. "wall-0"); the facade name and, only when needed, a segment/band index are appended here so an
 * unmodified mass (no operations at all) produces byte-identical ids to the legacy shell (`wall-0-south`, …).
 */
export function buildMassOpenings(taggedEdges: readonly WallEdge[], width: number, depth: number, openings: readonly MassOpening[], floorIndex: number, wallBaseY: number, wallHeight: number, levelIdPrefix: string, materials: OpeningMaterials): MassOpeningsResult {
  const warnings: string[] = [];
  const primitives: HousePrimitive[] = [];
  const byFacade = new Map<MassFacade, WallEdge[]>();
  for (const edge of taggedEdges) {
    if (!edge.facade) continue;
    const list = byFacade.get(edge.facade) ?? [];
    list.push(edge);
    byFacade.set(edge.facade, list);
  }
  for (const [facade, facadeEdges] of byFacade) {
    facadeEdges.forEach((edge, segmentIndex) => {
      const idPrefix = facadeEdges.length > 1 ? `${levelIdPrefix}-${facade}-${segmentIndex}` : `${levelIdPrefix}-${facade}`;
      const u0 = inverseU(facade, edge.a, width, depth);
      const u1 = inverseU(facade, edge.b, width, depth);
      primitives.push(...buildSegment(facade, Math.min(u0, u1), Math.max(u0, u1), width, depth, openings, floorIndex, wallBaseY, wallHeight, idPrefix, materials, warnings));
    });
  }
  return { primitives, warnings };
}

/**
 * A chamfer edge with `glazed: true`: a full-height framed glass wall following the angled cut exactly (a
 * glazed prow), with a thin solid head band above it so it still meets the slab/roof like a wall does. Any
 * edge direction works — the panel is rotated to the edge the same way `buildPlainWallEdge` rotates an
 * angled solid wall.
 */
export function buildGlazedWallEdge(edge: WallEdge, wallBaseY: number, wallHeight: number, id: string, materials: OpeningMaterials): HousePrimitive[] {
  const dx = edge.b[0] - edge.a[0];
  const dz = edge.b[1] - edge.a[1];
  const length = Math.hypot(dx, dz);
  if (length < EPS) return [];
  const nx = dz / length, nz = -dx / length;
  const cx = (edge.a[0] + edge.b[0]) / 2 - nx * WALL_INSET;
  const cz = (edge.a[1] + edge.b[1]) / 2 - nz * WALL_INSET;
  const rotation: [number, number, number] = [0, Math.atan2(dx, dz), 0];
  const headHeight = Math.min(0.3, wallHeight * 0.1);
  const glassHeight = wallHeight - headHeight;
  const glassY = wallBaseY + glassHeight / 2;
  return [
    box(`${id}-head-wall`, "wall", "Wall (above glazed chamfer)", [cx, wallBaseY + glassHeight + headHeight / 2, cz], [WALL_THICKNESS, headHeight, length], paintOf(materials.exterior), rotation),
    box(`${id}-window-frame`, "window", "Angled Glazing Frame", [cx, glassY, cz], [FRAME_THICKNESS, glassHeight, length], paintOf(materials.trim), rotation),
    box(`${id}-window-glass`, "window", "Angled Glazing", [cx, glassY, cz], [GLASS_THICKNESS, glassHeight - FRAME_BORDER * 2, Math.max(0.1, length - FRAME_BORDER * 2)], paintOf(materials.glass), rotation),
  ];
}

const POST_SIZE = 0.16;
const HEADER_HEIGHT = 0.14;

/**
 * The wall-less counterpart to `buildPlainWallEdge`, for an edge from a recess/projection with `open: true`
 * (a veranda, colonnade, deep covered terrace or screened pavilion edge): a header beam always spans the
 * opening (so it still reads as "under a roofline," not a floating roof with nothing below it); evenly
 * spaced posts are added only when `postSpacing` was given — its absence is a deliberate single unbroken
 * open span, not a missing value. Never glazing-eligible, same as `buildPlainWallEdge`.
 */
export function buildColonnadePosts(edge: WallEdge, wallBaseY: number, wallHeight: number, id: string, paint: Paint): HousePrimitive[] {
  const dx = edge.b[0] - edge.a[0];
  const dz = edge.b[1] - edge.a[1];
  const length = Math.hypot(dx, dz);
  if (length < EPS) return [];
  const nx = dz / length, nz = -dx / length;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const cx = (edge.a[0] + edge.b[0]) / 2 - nx * WALL_INSET;
  const cz = (edge.a[1] + edge.b[1]) / 2 - nz * WALL_INSET;
  const out: HousePrimitive[] = [
    box(`${id}-header`, "wall", "Colonnade Header", [cx, wallBaseY + wallHeight - HEADER_HEIGHT / 2, cz], alongX ? [length, HEADER_HEIGHT, POST_SIZE] : [POST_SIZE, HEADER_HEIGHT, length], paint),
  ];
  if (edge.postSpacing && edge.postSpacing > 0) {
    const postCount = Math.max(2, Math.round(length / edge.postSpacing) + 1);
    for (let i = 0; i < postCount; i++) {
      const t = i / (postCount - 1);
      const px = edge.a[0] + dx * t - nx * WALL_INSET;
      const pz = edge.a[1] + dz * t - nz * WALL_INSET;
      out.push(box(`${id}-post-${i}`, "wall", "Colonnade Post", [px, wallBaseY + wallHeight / 2, pz], [POST_SIZE, wallHeight, POST_SIZE], paint));
    }
  }
  return out;
}

/**
 * A plain full-height solid wall box for an edge with no facade tag — a notch's inward L-cut, a chamfer's
 * angled cut, or a recess/projection's own step-in/step-out run. These are never glazing-eligible (see the
 * module doc above), so they skip the opening-band machinery entirely. A horizontal or vertical edge (every
 * op except `chamfer` only ever produces these) keeps the exact unrotated box convention below — its outward
 * normal read straight off the edge's own direction, not an approximation. A genuinely angled edge (a
 * chamfered corner) is rotated to follow it exactly instead, since no axis-aligned box could.
 */
export function buildPlainWallEdge(edge: WallEdge, wallBaseY: number, wallHeight: number, id: string, paint: Paint): HousePrimitive {
  const dx = edge.b[0] - edge.a[0];
  const dz = edge.b[1] - edge.a[1];
  const length = Math.hypot(dx, dz);
  const nx = length > EPS ? dz / length : 0;
  const nz = length > EPS ? -dx / length : 0;
  const cx = (edge.a[0] + edge.b[0]) / 2 - nx * WALL_INSET;
  const cz = (edge.a[1] + edge.b[1]) / 2 - nz * WALL_INSET;
  const alongX = Math.abs(dz) < EPS;
  const alongZ = Math.abs(dx) < EPS;
  if (alongX || alongZ) {
    return box(id, "wall", "Wall", [cx, wallBaseY + wallHeight / 2, cz], alongX ? [length, wallHeight, WALL_THICKNESS] : [WALL_THICKNESS, wallHeight, length], paint);
  }
  const yaw = Math.atan2(dx, dz);
  return box(id, "wall", "Wall", [cx, wallBaseY + wallHeight / 2, cz], [WALL_THICKNESS, wallHeight, length], paint, [0, yaw, 0]);
}
