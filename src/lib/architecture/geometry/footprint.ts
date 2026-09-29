import type { FootprintScope, MassFacade, MassGeometryOperation } from "../document";

/** Local, unrotated mass space: x = width axis (east positive), z = depth axis (south positive). Matches primitiveBuilders.ts's wall convention (north = -z, south = +z, east = +x, west = -x). */
export type Point = readonly [number, number];
export type Corner = "nw" | "ne" | "se" | "sw";

export interface WallEdge {
  a: Point;
  b: Point;
  /** The facade this edge belongs to, for opening placement. Undefined for a notch's own inward cut edges — those are not glazing-eligible. */
  facade?: MassFacade;
  /** True for a recess/projection interval's own outward-facing edge when the op set `open: true` — wall-less (posts or nothing) instead of solid, see `buildColonnadePosts` in openings.ts. */
  open?: boolean;
  /** Colonnade post spacing (meters) carried from the same `open` operation, when given. */
  postSpacing?: number;
  /** Set on a chamfer's own angled edge; `glazed` carries the op's flag so the compiler can build it as glass instead of solid wall. */
  chamfer?: { glazed: boolean };
}

export interface Rect { x0: number; x1: number; z0: number; z1: number }

export interface FloorFootprint {
  /** Closed vertex loop, clockwise, no duplicate consecutive points — the true wall line, angled edges included. Slabs and roofs follow this outline too. */
  polygon: Point[];
  /**
   * `polygon` with each chamfered corner's original square corner restored — always rectilinear. Never built
   * as-is: it's the base `offsetFootprintOutline` grows before cutting each chamfer back at its true angle, and
   * the rectangle source for pitched roof families (gable/hip) that have no way to follow an angled edge.
   */
  hullPolygon: Point[];
  /** Every chamfer applied on this floor (size = the cut's leg length along both adjoining facades). */
  chamfers: { corner: Corner; size: number }[];
  edges: WallEdge[];
  /**
   * Axis-aligned rectangles that, together with `wedges`, tile `polygon` exactly — for floor slabs and roof
   * support surfaces. A chamfered corner's whole size×size square is left out of the rectangles (it can't be
   * one), and its inside half is supplied by the matching wedge instead: never squared back over the cut.
   */
  rects: Rect[];
  /** One right triangle per chamfer — the part of the corner square inside the angled wall. */
  wedges: [Point, Point, Point][];
  warnings: string[];
}

const EPS = 1e-6;
const FACADES: MassFacade[] = ["north", "east", "south", "west"];
const NORMAL: Record<MassFacade, Point> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

const samePoint = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

/**
 * A point at fraction `u` (0..1) along a facade's ORIGINAL (un-notched) edge — always compass-intuitive
 * (u=0 at the west end for north/south, the north end for east/west), independent of clockwise walk
 * direction. Exported so openings.ts can place windows using the same authoring coordinate every
 * geometry operation uses.
 */
export function facadePointAt(facade: MassFacade, u: number, width: number, depth: number): Point {
  const halfW = width / 2;
  const halfD = depth / 2;
  if (facade === "north") return [-halfW + u * width, -halfD];
  if (facade === "south") return [-halfW + u * width, halfD];
  if (facade === "east") return [halfW, -halfD + u * depth];
  return [-halfW, -halfD + u * depth];
}

function offsetPoint(p: Point, facade: MassFacade, depth: number, direction: 1 | -1): Point {
  const [nx, nz] = NORMAL[facade];
  return [p[0] + nx * depth * direction, p[1] + nz * depth * direction];
}

function facadeLength(facade: MassFacade, width: number, depth: number): number {
  return facade === "north" || facade === "south" ? width : depth;
}

function appliesToFloor(scope: FootprintScope | undefined, floorIndex: number): boolean {
  if (!scope || scope === "all") return true;
  if (scope === "ground") return floorIndex === 0;
  return floorIndex > 0;
}

interface FacadeInterval { start: number; end: number; depth: number; direction: 1 | -1; open?: boolean; postSpacing?: number }

/**
 * The corner each facade is entered/exited at when walking the loop clockwise (north, east, south, west,
 * wrapping back to north) — NOT the same as each facade's own u=0/u=1 (see `pointAt`, which is always
 * compass-intuitive: u=0 at the west/north end). South and west are walked in decreasing-u order, so their
 * point lists get reversed at concatenation time; `atEnd` here only drives where a notch's inward corner
 * vertex gets inserted between two consecutive facades.
 */
const FACADE_CORNERS: Record<MassFacade, { atEnd: Corner }> = {
  north: { atEnd: "ne" },
  east: { atEnd: "se" },
  south: { atEnd: "sw" },
  west: { atEnd: "nw" },
};

/**
 * Builds one floor's articulated footprint from the base rectangle plus every operation that applies to
 * `floorIndex`. Never boolean geometry: the boundary is built as a single vertex loop, walking each facade
 * in turn and inserting step-in/step-out vertices for recess/projection and an inward L-cut for notch —
 * the same "stable polygon/segment construction" a plotter would draw.
 */
export function buildFloorFootprint(width: number, depth: number, operations: readonly MassGeometryOperation[], floorIndex: number): FloorFootprint {
  const warnings: string[] = [];
  const ops = operations.filter((op) => appliesToFloor(op.floors, floorIndex));

  const notches: Partial<Record<Corner, { width: number; depth: number }>> = {};
  const chamfers: Partial<Record<Corner, { size: number; glazed: boolean }>> = {};
  const claimedCorners = new Set<Corner>();
  for (const op of ops) {
    if (op.type !== "notch" && op.type !== "chamfer") continue;
    if (claimedCorners.has(op.corner)) { warnings.push(`duplicate operation at corner "${op.corner}" — ignoring the extra one.`); continue; }
    claimedCorners.add(op.corner);
    if (op.type === "notch") notches[op.corner] = { width: Math.max(0, op.width), depth: Math.max(0, op.depth) };
    else chamfers[op.corner] = { size: Math.max(0, op.size), glazed: op.glazed === true };
  }

  // Reserved zones (meters) at each facade's u=0/u=1 end, consumed by an adjacent corner notch or chamfer
  // (a chamfer reserves the same amount on both adjoining facades — it's a symmetric angled cut).
  const reserved: Record<MassFacade, { start: number; end: number }> = { north: { start: 0, end: 0 }, south: { start: 0, end: 0 }, east: { start: 0, end: 0 }, west: { start: 0, end: 0 } };
  const reserveAt = (corner: Corner): [number, number] | undefined => {
    if (notches[corner]) return [notches[corner]!.width, notches[corner]!.depth];
    if (chamfers[corner]) return [chamfers[corner]!.size, chamfers[corner]!.size];
    return undefined;
  };
  const nwReserve = reserveAt("nw"); if (nwReserve) { reserved.north.start = nwReserve[0]; reserved.west.start = nwReserve[1]; }
  const neReserve = reserveAt("ne"); if (neReserve) { reserved.north.end = neReserve[0]; reserved.east.start = neReserve[1]; }
  const seReserve = reserveAt("se"); if (seReserve) { reserved.south.end = seReserve[0]; reserved.east.end = seReserve[1]; }
  const swReserve = reserveAt("sw"); if (swReserve) { reserved.south.start = swReserve[0]; reserved.west.end = swReserve[1]; }

  const intervals: Record<MassFacade, FacadeInterval[]> = { north: [], south: [], east: [], west: [] };
  for (const op of ops) {
    if (op.type === "notch" || op.type === "chamfer") continue;
    const len = facadeLength(op.facade, width, depth);
    let start: number; let end: number; const direction: 1 | -1 = op.type === "projection" ? 1 : -1;
    if (op.type === "entry-recess") {
      const halfWidth = Math.min(op.width, len) / 2;
      start = (len / 2 - halfWidth) / len;
      end = (len / 2 + halfWidth) / len;
    } else {
      start = Math.min(op.start, op.end);
      end = Math.max(op.start, op.end);
    }
    start = Math.max(0, Math.min(1, start));
    end = Math.max(0, Math.min(1, end));
    if (end - start < EPS) { warnings.push(`${op.type} on ${op.facade} has zero width — skipped.`); continue; }
    const open = (op.type === "recess" || op.type === "projection") ? op.open : undefined;
    const postSpacing = (op.type === "recess" || op.type === "projection") ? op.postSpacing : undefined;
    intervals[op.facade].push({ start, end, depth: Math.max(0, op.depth), direction, open, postSpacing });
  }

  // Clip every facade's intervals to the space left by adjacent notches, drop/clip overlaps against each other.
  const edges: WallEdge[] = [];
  const facadePoints: Point[][] = [];
  /** The outward-facing edge of each `open:true` interval, recorded before the south/west point-list reversal below — matched back onto the final loop's edges by endpoint, in either direction. */
  const openEdges: { a: Point; b: Point; postSpacing?: number }[] = [];
  for (const facade of FACADES) {
    const len = facadeLength(facade, width, depth);
    const reservedStartU = reserved[facade].start / len;
    const reservedEndU = 1 - reserved[facade].end / len;
    const sorted = intervals[facade].slice().sort((a, b) => a.start - b.start);
    const accepted: FacadeInterval[] = [];
    let cursor = reservedStartU;
    for (const iv of sorted) {
      const s = Math.max(iv.start, reservedStartU);
      const e = Math.min(iv.end, reservedEndU);
      if (e - s < EPS) { warnings.push(`${facade} operation clipped away entirely by an adjacent notch — skipped.`); continue; }
      if (s < cursor - EPS) { warnings.push(`overlapping operations on ${facade} facade — later one skipped.`); continue; }
      accepted.push({ start: s, end: e, depth: iv.depth, direction: iv.direction, open: iv.open, postSpacing: iv.postSpacing });
      cursor = e;
    }

    const pts: Point[] = [];
    const push = (p: Point) => { if (pts.length === 0 || !samePoint(pts[pts.length - 1], p)) pts.push(p); };
    const effectiveStart = reservedStartU;
    const effectiveEnd = reservedEndU;
    push(facadePointAt(facade, effectiveStart, width, depth));
    for (const iv of accepted) {
      const baseStart = facadePointAt(facade, iv.start, width, depth);
      const baseEnd = facadePointAt(facade, iv.end, width, depth);
      const offsetStart = offsetPoint(baseStart, facade, iv.depth, iv.direction);
      const offsetEnd = offsetPoint(baseEnd, facade, iv.depth, iv.direction);
      push(baseStart);
      push(offsetStart);
      push(offsetEnd);
      push(baseEnd);
      if (iv.open) openEdges.push({ a: offsetStart, b: offsetEnd, postSpacing: iv.postSpacing });
    }
    push(facadePointAt(facade, effectiveEnd, width, depth));
    facadePoints.push(pts);
  }

  // Concatenate the four facades clockwise, inserting a notch's inward corner vertex between them where present.
  // A chamfer inserts nothing: the next facade's (already reserved-back) first point connects straight to this
  // one's last point, which IS the angled edge. `hull` is the same walk with each chamfered corner's original
  // square corner restored (see `FloorFootprint.hullPolygon`); `stepped` instead steps in to the corner
  // square's inner vertex — the rectilinear part of the floor that `rects` covers, leaving the wedge out.
  const halfW = width / 2, halfD = depth / 2;
  const squareCorner: Record<Corner, Point> = { nw: [-halfW, -halfD], ne: [halfW, -halfD], se: [halfW, halfD], sw: [-halfW, halfD] };
  const innerCorner = (corner: Corner, size: number): Point => { const [cx, cz] = squareCorner[corner]; return [cx - Math.sign(cx) * size, cz - Math.sign(cz) * size]; };
  const loop: Point[] = [];
  const hull: Point[] = [];
  const stepped: Point[] = [];
  const pushTo = (target: Point[], p: Point) => { if (target.length === 0 || !samePoint(target[target.length - 1], p)) target.push(p); };
  for (let i = 0; i < FACADES.length; i++) {
    const facade = FACADES[i];
    // pointAt is always compass-intuitive (u=0 at the west/north end); south and west are walked in
    // decreasing-u order for a clockwise loop, so their point lists are reversed here before pushing.
    const ordered = facade === "south" || facade === "west" ? [...facadePoints[i]].reverse() : facadePoints[i];
    for (const p of ordered) { pushTo(loop, p); pushTo(hull, p); pushTo(stepped, p); }
    const endCorner = FACADE_CORNERS[facade].atEnd;
    const notch = notches[endCorner];
    if (notch) {
      const inward: Record<Corner, Point> = {
        nw: [-halfW + notch.width, -halfD + notch.depth],
        ne: [halfW - notch.width, -halfD + notch.depth],
        se: [halfW - notch.width, halfD - notch.depth],
        sw: [-halfW + notch.width, halfD - notch.depth],
      };
      pushTo(loop, inward[endCorner]);
      pushTo(hull, inward[endCorner]);
      pushTo(stepped, inward[endCorner]);
    }
    if (chamfers[endCorner]) { pushTo(hull, squareCorner[endCorner]); pushTo(stepped, innerCorner(endCorner, chamfers[endCorner]!.size)); }
  }
  for (const ring of [loop, hull, stepped]) if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();

  for (let i = 0; i < loop.length; i++) edges.push({ a: loop[i], b: loop[(i + 1) % loop.length] });
  // Tag each edge with a facade when it lies on that facade's original plane (skips notch-inserted diagonal-free cut edges).
  const openEdgeFor = (e: WallEdge) => openEdges.find((o) => (samePoint(o.a, e.a) && samePoint(o.b, e.b)) || (samePoint(o.a, e.b) && samePoint(o.b, e.a)));
  // A chamfer's angled edge always runs between the two points its corner reserved back on each facade.
  const chamferEdges = (Object.entries(chamfers) as [Corner, { size: number; glazed: boolean }][]).map(([corner, c]) => {
    const [cx, cz] = squareCorner[corner];
    const sx = cx > 0 ? -1 : 1, sz = cz > 0 ? -1 : 1;
    return { a: [cx + sx * c.size, cz] as Point, b: [cx, cz + sz * c.size] as Point, glazed: c.glazed };
  });
  const chamferEdgeFor = (e: WallEdge) => chamferEdges.find((c) => (samePoint(c.a, e.a) && samePoint(c.b, e.b)) || (samePoint(c.a, e.b) && samePoint(c.b, e.a)));
  const tagged = edges.map((e) => {
    const open = openEdgeFor(e);
    const chamfer = chamferEdgeFor(e);
    return { ...e, facade: facadeOf(e, width, depth), ...(open ? { open: true as const, ...(open.postSpacing ? { postSpacing: open.postSpacing } : {}) } : {}), ...(chamfer ? { chamfer: { glazed: chamfer.glazed } } : {}) };
  });

  const chamferList = (Object.entries(chamfers) as [Corner, { size: number; glazed: boolean }][]).filter(([, c]) => c.size > EPS).map(([corner, c]) => ({ corner, size: c.size }));
  if (chamferList.length === 0) return { polygon: loop, hullPolygon: loop, chamfers: [], edges: tagged, rects: decomposeToRectangles(loop), wedges: [], warnings };
  const wedges = chamferList.map(({ corner, size }) => {
    const [cx, cz] = squareCorner[corner];
    return [[cx - Math.sign(cx) * size, cz], [cx, cz - Math.sign(cz) * size], innerCorner(corner, size)] as [Point, Point, Point];
  });
  return { polygon: loop, hullPolygon: simplifyCollinearVertices(hull), chamfers: chamferList, edges: tagged, rects: decomposeToRectangles(simplifyCollinearVertices(stepped)), wedges, warnings };
}

/**
 * Keeps `a*x + b*z >= c` of a simple polygon (one Sutherland–Hodgman pass). Used only to cut a single corner
 * off, where the line crosses the boundary exactly twice, so the result stays a simple polygon.
 */
function clipHalfPlane(polygon: readonly Point[], a: number, b: number, c: number): Point[] {
  const out: Point[] = [];
  const value = (p: Point) => a * p[0] + b * p[1] - c;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const vp = value(p), vq = value(q);
    if (vp >= -EPS) out.push(p);
    if ((vp > EPS && vq < -EPS) || (vp < -EPS && vq > EPS)) {
      const t = vp / (vp - vq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  const loop: Point[] = [];
  for (const p of out) if (loop.length === 0 || !samePoint(loop[loop.length - 1], p)) loop.push(p);
  if (loop.length > 1 && samePoint(loop[0], loop[loop.length - 1])) loop.pop();
  return loop;
}

/**
 * The footprint's true outline grown outward by `distance` on every edge — angled chamfer edges included.
 * A rectilinear footprint is just `offsetRectilinearPolygon`. A chamfered one grows its square-cornered hull
 * the same way, then cuts each chamfered corner back along the chamfer's own line moved out by `distance`, so
 * a roof over a prow keeps the prow's angle (with an even overhang along it) instead of squaring the corner.
 */
export function offsetFootprintOutline(footprint: Pick<FloorFootprint, "polygon" | "hullPolygon" | "chamfers">, width: number, depth: number, distance: number): { polygon: Point[]; warnings: string[] } {
  if (footprint.chamfers.length === 0) return offsetRectilinearPolygon(footprint.polygon, distance);
  const grown = offsetRectilinearPolygon(footprint.hullPolygon, Math.max(0, distance));
  let polygon = grown.polygon;
  for (const { corner, size } of footprint.chamfers) {
    // Inward axis signs at this corner; the chamfer line is sx*(x-cx) + sz*(z-cz) = size, and its gradient has
    // length √2, so moving it `distance` outward lowers that constant by distance·√2.
    const cx = corner === "ne" || corner === "se" ? width / 2 : -width / 2;
    const cz = corner === "se" || corner === "sw" ? depth / 2 : -depth / 2;
    const sx = cx > 0 ? -1 : 1, sz = cz > 0 ? -1 : 1;
    polygon = clipHalfPlane(polygon, sx, sz, size - Math.max(0, distance) * Math.SQRT2 + sx * cx + sz * cz);
  }
  return { polygon, warnings: grown.warnings };
}

function facadeOf(edge: WallEdge, width: number, depth: number): MassFacade | undefined {
  const halfW = width / 2, halfD = depth / 2;
  const { a, b } = edge;
  if (Math.abs(a[1] - b[1]) < EPS) {
    if (Math.abs(a[1] + halfD) < EPS) return "north";
    if (Math.abs(a[1] - halfD) < EPS) return "south";
  }
  if (Math.abs(a[0] - b[0]) < EPS) {
    if (Math.abs(a[0] - halfW) < EPS) return "east";
    if (Math.abs(a[0] + halfW) < EPS) return "west";
  }
  return undefined;
}

/** Standard ray-casting point-in-polygon test; works for any simple polygon regardless of convexity. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  const [px, pz] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersects = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Removes a vertex that sits mid-edge rather than at a real turn — both its neighboring edges run the same
 * direction (both horizontal at the same z, or both vertical at the same x). Two adjacent operations can leave
 * one of these where their boundaries happen to coincide (see `offsetRectilinearPolygon`); the wall/opening
 * builders tolerate it fine (it just reads as two aligned segments), but it breaks the strict H/V alternation
 * offsetting relies on.
 */
function simplifyCollinearVertices(polygon: readonly Point[]): Point[] {
  const pts = polygon.map((p) => [...p] as [number, number]);
  let changed = true;
  while (changed && pts.length > 4) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const prevHorizontal = Math.abs(prev[1] - curr[1]) < EPS;
      const nextHorizontal = Math.abs(curr[1] - next[1]) < EPS;
      const prevVertical = Math.abs(prev[0] - curr[0]) < EPS;
      const nextVertical = Math.abs(curr[0] - next[0]) < EPS;
      if ((prevHorizontal && nextHorizontal && Math.abs(prev[1] - next[1]) < EPS) || (prevVertical && nextVertical && Math.abs(prev[0] - next[0]) < EPS)) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/**
 * Grows a simple, axis-aligned (rectilinear) polygon outward by `distance`, uniformly, on every edge — a real
 * offset of the footprint's own boundary, not a bounding-box expansion. Used for roof-plate sizing: a roof
 * that's built by independently expanding each rectangle of an articulated footprint's rectangle decomposition
 * (see `decomposeToRectangles`) re-overlaps neighboring rectangles and erases the articulation it was supposed
 * to sit above (a recess, notch or projection). Offsetting the true polygon once, THEN decomposing the result,
 * keeps the roof following the real footprint instead.
 *
 * Every edge here is axis-aligned by construction (`buildFloorFootprint` only ever produces horizontal/vertical
 * segments), and they strictly alternate H/V walking the loop, so each new vertex is the trivial intersection of
 * one shifted horizontal line and one shifted vertical line — no general line-intersection math needed. The one
 * real hazard is a reflex (concave) corner — the inside of a notch or recess — where growing outward can cause
 * the two offset edges meeting there to overshoot past each other once `distance` exceeds the feature's own
 * size (e.g. a 2.5m-deep notch under a 1.3m roof overhang on both sides: 2×1.3 > 2.5). Rather than general
 * polygon boolean cleanup, each edge that comes out reversed from its original direction is detected (a cheap,
 * local check) and collapsed to a single point — the feature simply closes up under the roof at that spot,
 * which is the physically correct outcome for a notch/recess too small for its own overhang to clear.
 */
export function offsetRectilinearPolygon(rawPolygon: readonly Point[], distance: number): { polygon: Point[]; warnings: string[] } {
  const warnings: string[] = [];
  if (distance <= EPS || rawPolygon.length < 4) return { polygon: [...rawPolygon], warnings };

  // Two adjacent operations (e.g. a notch and a projection) can share a boundary, leaving a redundant vertex
  // that sits mid-edge rather than at a real turn. Strip those first so edges strictly alternate H/V below.
  const polygon = simplifyCollinearVertices(rawPolygon);
  if (polygon.length < 4) return { polygon: [...rawPolygon], warnings };

  const n = polygon.length;
  const testEps = 0.01;
  interface EdgeInfo { horizontal: boolean; coord: number }
  const edges: EdgeInfo[] = [];
  for (let i = 0; i < n; i++) {
    const a = polygon[i]; const b = polygon[(i + 1) % n];
    const horizontal = Math.abs(a[1] - b[1]) < EPS;
    const vertical = Math.abs(a[0] - b[0]) < EPS;
    if (!horizontal && !vertical) { warnings.push("roof offset: non-axis-aligned edge — skipped uniform growth."); return { polygon: [...polygon], warnings }; }
    const coord = horizontal ? a[1] : a[0];
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const negProbe: Point = horizontal ? [mid[0], mid[1] - testEps] : [mid[0] - testEps, mid[1]];
    const negIsOutside = !pointInPolygon(negProbe, polygon);
    const sign = negIsOutside ? -1 : 1;
    edges.push({ horizontal, coord: coord + sign * distance });
  }

  const rawVertices: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = edges[(i - 1 + n) % n];
    const curr = edges[i];
    if (prev.horizontal === curr.horizontal) { warnings.push("roof offset: two consecutive edges share an orientation — skipped uniform growth."); return { polygon: [...polygon], warnings }; }
    const x = prev.horizontal ? curr.coord : prev.coord;
    const z = prev.horizontal ? prev.coord : curr.coord;
    rawVertices.push([x, z]);
  }

  // Collapse any edge whose direction reversed relative to the original (an overshot reflex corner).
  const collapsed = rawVertices.map((v) => [...v] as [number, number]);
  for (let i = 0; i < n; i++) {
    const a = polygon[i]; const b = polygon[(i + 1) % n];
    const newA = collapsed[i]; const newB = collapsed[(i + 1) % n];
    const horizontal = Math.abs(a[1] - b[1]) < EPS;
    const origDelta = horizontal ? b[0] - a[0] : b[1] - a[1];
    const newDelta = horizontal ? newB[0] - newA[0] : newB[1] - newA[1];
    if (origDelta !== 0 && Math.sign(origDelta) !== Math.sign(newDelta) && Math.abs(newDelta) > EPS) {
      const mid: Point = [(newA[0] + newB[0]) / 2, (newA[1] + newB[1]) / 2];
      collapsed[i][0] = mid[0]; collapsed[i][1] = mid[1];
      collapsed[(i + 1) % n][0] = mid[0]; collapsed[(i + 1) % n][1] = mid[1];
      warnings.push(`roof offset: a footprint feature was smaller than the roof overhang (${distance}m) — it closes up under the roof there.`);
    }
  }

  const loop: Point[] = [];
  for (const p of collapsed) if (loop.length === 0 || !samePoint(loop[loop.length - 1], p)) loop.push(p);
  if (loop.length > 1 && samePoint(loop[0], loop[loop.length - 1])) loop.pop();
  return { polygon: loop, warnings };
}

/**
 * Decomposes a simple rectilinear polygon into axis-aligned rectangles: classify each cell of the grid formed
 * by the polygon's own coordinate lines as inside/outside (ray casting on the cell center), then greedily
 * merge inside cells first along rows, then vertically. Not optimal (doesn't minimize rectangle count) but
 * deterministic and always correct for the rectilinear, non-self-intersecting polygons this compiler builds —
 * no boolean/CSG library needed.
 */
export function decomposeToRectangles(polygon: readonly Point[]): Rect[] {
  if (polygon.length < 3) return [];
  const xs = [...new Set(polygon.map((p) => p[0]))].sort((a, b) => a - b);
  const zs = [...new Set(polygon.map((p) => p[1]))].sort((a, b) => a - b);
  const rows: Rect[][] = [];
  for (let j = 0; j < zs.length - 1; j++) {
    const z0 = zs[j], z1 = zs[j + 1];
    const zc = (z0 + z1) / 2;
    const rowRects: Rect[] = [];
    let runStart: number | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      const inside = pointInPolygon([(x0 + x1) / 2, zc], polygon);
      if (inside && runStart === null) runStart = x0;
      if (!inside && runStart !== null) { rowRects.push({ x0: runStart, x1: x0, z0, z1 }); runStart = null; }
    }
    if (runStart !== null) rowRects.push({ x0: runStart, x1: xs[xs.length - 1], z0, z1 });
    rows.push(rowRects);
  }
  // Vertical merge: adjacent rows with an identical x-span and touching z bounds become one rectangle.
  const merged: Rect[] = [];
  const consumed = rows.map((row) => row.map(() => false));
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      if (consumed[j][i]) continue;
      let rect = rows[j][i];
      consumed[j][i] = true;
      let k = j + 1;
      while (k < rows.length) {
        const match = rows[k].findIndex((r, idx) => !consumed[k][idx] && Math.abs(r.x0 - rect.x0) < EPS && Math.abs(r.x1 - rect.x1) < EPS && Math.abs(r.z0 - rect.z1) < EPS);
        if (match === -1) break;
        consumed[k][match] = true;
        rect = { ...rect, z1: rows[k][match].z1 };
        k++;
      }
      merged.push(rect);
    }
  }
  return merged;
}
