import { auditV3StairUsability, type V3StairFailure } from './stairUsability';
import { spatialParts } from './routeGeometry';
import { segmentLength } from './curvedFootprint';
import { probe, facadeLength, addressedStrips } from './accessPlanning';
import type { HousePrimitive } from "@/lib/house/types";
import { compileV3Scene, type V3Scene, type V3SceneObject } from "./scene";
import { resolveV3Fidelity } from "./fidelity";
import { createV3TerrainSampler, getObjectBaseY, getObjectTopY, scaledDimensionsOf } from "./elevation";
import { footprintOverlap } from "./reviewGeometry";
import { resolvedFacadeComposition, stackedStoreyOpenings, WALKABLE_OPENING_TYPES, type V3Composition } from "./composition";
import { deriveV3MassJunctions, worldPoint, type JunctionFacade } from "./junctions";
import { primitiveTriangles } from "./junctionGeometry";
import { rooftopTerraces } from "./rooftopFeatures";
import { v3MassLevelCount, v3StoreyBase, v3StoreyTargetingDiagnostics } from "./stacking";
import { auditV3CirculationIntent, resolveV3Circulation, V3_FLOOR_SLAB } from "./circulation";

/**
 * Architectural completeness: can a person actually reach every authored space? A conservative, read-only access
 * graph over storeys, balconies, rooftop terraces, connected wings and outdoor living areas. It never modifies
 * geometry and never prescribes a layout; it reports what is unreachable and the minimal authored fix.
 *
 * Access is never inferred from proximity. Edges come only from walkable authored openings (doors and glazed doors,
 * never glazing), authored circulation, authored stair/ramp connectors, contiguous walkable surfaces at one level,
 * and junction passages proven clear in the compiled geometry.
 */
export type V3CompletenessCode = "UNREACHABLE_STOREY" | "UNREACHABLE_WING" | "INACCESSIBLE_BALCONY" | "INACCESSIBLE_ROOF_TERRACE"
  | "NO_OUTDOOR_LIVING_ACCESS" | "AUTHORED_OPENING_REMOVED" | "CIRCULATION_INTENT_INCOMPLETE" | "AUTHORED_ACCESS_DISCONNECTED" | "AUTHORED_ACCESS_THRESHOLD";
export interface V3CompletenessFinding {
  code: V3CompletenessCode;
  severity: "significant" | "advisory";
  /** First id is the object the minimal fix belongs to. */
  targetIds: string[];
  message: string;
  guidance: string;
}
export type V3AccessNodeKind = "exterior" | "storey" | "roof" | "balcony" | "roof-terrace" | "outdoor";
export interface V3AccessNode { id: string; kind: V3AccessNodeKind; ownerId: string; level?: number; elevation: number; reachable: boolean; reachableFromHouse: boolean; }
export type V3AccessEdgeKind = "door" | "junction" | "stair" | "lift" | "connector" | "surface";
export interface V3AccessEdge { from: string; to: string; kind: V3AccessEdgeKind; via: string; }
export interface V3CompletenessAudit { nodes: V3AccessNode[]; edges: V3AccessEdge[]; findings: V3CompletenessFinding[]; significant: number; circulationFailures: V3StairFailure[]; }

const LEVEL_MATCH = .35, STEP_MATCH = .6, TOUCH = .3, DOOR_REACH = 1.6, ABUT = .2;
const ARRIVAL = /\b(drive|driveway|arrival|motor|parking|turnaround|forecourt|entry|entrance|step|steps|walk|path|service|garage)\b/i;
const text = (o: V3SceneObject) => `${o.id.replace(/-/g, " ")} ${o.semanticRole} ${o.label}`;
const hostIdOf = (o: V3SceneObject) => o.hostId ?? o.support?.hostId ?? o.support?.objectId;
const storeyNode = (massId: string, floor: number) => `${massId}#${floor}`;

interface Surface { id: string; node: string; probe: V3SceneObject; top: number; kind: "outdoor" | "balcony" | "roof-terrace"; living: boolean; hostId?: string; facade?: JunctionFacade; level?: number; area: number }
interface Mass { o: V3SceneObject; levels: number; levelHeight: number; base: number; storeyBase: number; w: number; d: number; openings: NonNullable<V3Composition["openings"]> }

const expanded = (o: V3SceneObject, by: number): V3SceneObject => { const [w, , d] = scaledDimensionsOf(o); return { ...o, architecture: undefined, dimensions: [w + 2 * by, 1, d + 2 * by], transform: { ...o.transform, scale: [1, 1, 1] } }; };
const planArea = (o: V3SceneObject) => { const [w, , d] = scaledDimensionsOf(o); return w * d; };
const appliesTo = (scope: "all" | "ground" | "upper" | undefined, storey: number) => !scope || scope === "all" ? true : scope === "ground" ? storey === 0 : storey > 0;

/** Segment–triangle intersection (Möller–Trumbore); `t` in (0,1) only. */
function segmentHits(a: number[], b: number[], v: number[], i: number): boolean {
  const e1 = [v[i + 3] - v[i], v[i + 4] - v[i + 1], v[i + 5] - v[i + 2]], e2 = [v[i + 6] - v[i], v[i + 7] - v[i + 1], v[i + 8] - v[i + 2]], dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const p = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-10) return false;
  const inv = 1 / det, s = [a[0] - v[i], a[1] - v[i + 1], a[2] - v[i + 2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
  if (u < 0 || u > 1) return false;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], w = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) * inv;
  if (w < 0 || u + w > 1) return false;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return t > 1e-6 && t < 1 - 1e-6;
}
/** Door leaves are closed but walkable; every other wall or pane blocks movement. */
const isBarrier = (p: HousePrimitive) => (p.category === "wall" || p.category === "window") && !/door/i.test(p.label);
interface Blocker { tri: number[]; min: number[]; max: number[] }
function blockers(primitives: HousePrimitive[]): Blocker[] {
  return primitives.filter(isBarrier).map((p) => {
    const tri = primitiveTriangles(p).vertices, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tri.length; i++) { min[i % 3] = Math.min(min[i % 3], tri[i]); max[i % 3] = Math.max(max[i % 3], tri[i]); }
    return { tri, min, max };
  });
}
function blocked(a: number[], b: number[], list: Blocker[]): boolean {
  const lo = [0, 1, 2].map((k) => Math.min(a[k], b[k])), hi = [0, 1, 2].map((k) => Math.max(a[k], b[k]));
  for (const item of list) {
    if ([0, 1, 2].some((k) => item.max[k] < lo[k] - 1e-6 || item.min[k] > hi[k] + 1e-6)) continue;
    for (let i = 0; i < item.tri.length; i += 9) if (segmentHits(a, b, item.tri, i)) return true;
  }
  return false;
}

export function auditV3Completeness(input: V3Scene): V3CompletenessAudit {
  const { scene } = resolveV3Fidelity(input);
  const nodes = new Map<string, V3AccessNode>(), edges: V3AccessEdge[] = [], findings: V3CompletenessFinding[] = [];
  const node = (id: string, kind: V3AccessNodeKind, ownerId: string, elevation: number, level?: number) => { if (!nodes.has(id)) nodes.set(id, { id, kind, ownerId, elevation, ...(level === undefined ? {} : { level }), reachable: false, reachableFromHouse: false }); };
  const edge = (from: string, to: string, kind: V3AccessEdgeKind, via: string) => { if (from !== to && nodes.has(from) && nodes.has(to) && !edges.some((e) => e.via === via && ((e.from === from && e.to === to) || (e.from === to && e.to === from)))) edges.push({ from, to, kind, via }); };
  const finding = (code: V3CompletenessCode, severity: V3CompletenessFinding["severity"], targetIds: string[], message: string, guidance: string) => findings.push({ code, severity, targetIds, message, guidance });
  const siteBase = scene.site.baseElevation ?? 0, ground = createV3TerrainSampler(scene);
  node("exterior", "exterior", "site", siteBase);

  // Storeys of every building mass, with the openings the compiler actually resolves for each facade.
  const masses: Mass[] = scene.objects.filter((o) => o.type === "building-mass").map((o) => {
    const [w, h, d] = scaledDimensionsOf(o), levels = v3MassLevelCount(o), levelHeight = h / levels;
    return { o, levels, levelHeight, base: getObjectBaseY(o), storeyBase: v3StoreyBase(o, scene), w, d, openings: resolvedFacadeComposition(o, w, d, levelHeight).openings ?? [] };
  });
  const massById = new Map(masses.map((m) => [m.o.id, m]));
  for (const m of masses) {
    for (let f = 0; f < m.levels; f++) node(storeyNode(m.o.id, f), "storey", m.o.id, m.base + f * m.levelHeight + V3_FLOOR_SLAB, m.storeyBase + f);
    node(`${m.o.id}#roof`, "roof", m.o.id, getObjectTopY(m.o));
  }

  // Walkable surfaces: outdoor objects, facade assembly slabs (balconies above ground) and rooftop terraces.
  const surfaces: Surface[] = [], roofTerraceIds = new Set(rooftopTerraces(scene).map((t) => t.id));
  for (const o of scene.objects) {
    if (!["terrace", "deck", "courtyard", "veranda", "balcony", "pool-deck"].includes(o.type) || (o.collision && !["walkable", "passable"].includes(o.collision))) continue;
    const host = scene.objects.find((h) => h.id === hostIdOf(o));
    if (host?.type === "pool") continue; // An island in the water is an amenity, not a reachable floor.
    const base = getObjectBaseY(o), top = o.type === "veranda" ? base + .2 : getObjectTopY(o), elevated = base - ground(o.transform.position[0], o.transform.position[2]) > 2;
    const kind: Surface["kind"] = o.type === "balcony" ? "balcony" : roofTerraceIds.has(o.id) || (elevated && o.type !== "veranda") ? "roof-terrace" : "outdoor";
    surfaces.push({ id: o.id, node: o.id, probe: o, top, kind, living: kind === "outdoor" && !ARRIVAL.test(text(o)), hostId: hostIdOf(o), area: planArea(o) });
  }
  for (const m of masses) for (const assembly of m.o.composition?.assemblies ?? []) for (const part of assembly.parts) {
    // A slab at its level's floor datum is walkable; one raised within the storey is a canopy, portico or lanai roof.
    if (part.type !== "slab" || (part.elevation ?? 0) > STEP_MATCH) continue;
    const length = facadeLength(m, part.facade), level = part.level ?? 0, y = m.base + level * m.levelHeight + (part.elevation ?? 0);
    const probes = addressedStrips(m, `${m.o.id}/${assembly.id}/${part.id}`, part.facade, part.start, part.end, part.depth, y,part.segmentId,part.level??0);
    const upper = m.storeyBase + level > 0;
    for(const surface of probes)surfaces.push({ id: assembly.id, node: surface.id, probe: surface, top: y + (part.thickness ?? .2), kind: upper ? "balcony" : "outdoor", living: !upper && !ARRIVAL.test(`${assembly.id} ${assembly.intent}`), hostId: m.o.id, facade: part.facade, level, area: (part.end - part.start) * (m.o.composition?.footprint?.segments?.find(s=>s.id===part.segmentId)?segmentLength(m.o.composition.footprint.segments.find(s=>s.id===part.segmentId)!):length) * part.depth / probes.length });
  }
  for (const s of surfaces) node(s.node, s.kind === "roof-terrace" ? "roof-terrace" : s.kind, s.hostId ?? s.id, s.top);

  // Contiguous walkable surfaces at one level form one floor; the ground connects to grounded outdoor surfaces.
  for (let i = 0; i < surfaces.length; i++) {
    const a = surfaces[i];
    if (a.kind === "outdoor" && Math.abs(a.top - ground(a.probe.transform.position[0], a.probe.transform.position[2])) <= STEP_MATCH) edge(a.node, "exterior", "surface", `ground:${a.node}`);
    for (let j = i + 1; j < surfaces.length; j++) {
      const b = surfaces[j];
      if (Math.abs(a.top - b.top) <= LEVEL_MATCH - .05 && footprintOverlap(expanded(a.probe, TOUCH), b.probe) > .05) edge(a.node, b.node, "surface", `contiguous:${a.node}|${b.node}`);
    }
  }
  // Authored stair/ramp connectors between named supports.
  const supportNode = (id: string | undefined) => !id ? undefined : surfaces.find((s) => s.id === id || s.node === id)?.node ?? (massById.has(id) ? storeyNode(id, 0) : nodes.has(id) ? id : undefined);
  for (const o of scene.objects.filter((c) => (c.type === "stair" || c.type === "ramp") && c.fromSupportId && c.toSupportId)) {
    const from = supportNode(o.fromSupportId), to = supportNode(o.toSupportId);
    if (from && to) edge(from, to, "connector", o.id);
  }

  // Doors: compiled, walkable, and opening onto something at their own floor level.
  const model = compileV3Scene(input), ids = new Set(model.primitives.map((p) => p.id));
  const compiledOpening = (m: Mass, openingId: string, floor: number) => [...ids].some((id) => id.startsWith(`${m.o.id}:${openingId}:level-${floor}:`));
  const exteriorDoors = new Map<string, string[]>();
  for (const m of masses) for (let f = 0; f < m.levels; f++) {
    const floorY = m.base + f * m.levelHeight + V3_FLOOR_SLAB, here = storeyNode(m.o.id, f);
    for (const op of stackedStoreyOpenings(m.openings, m.storeyBase, f)) {
      if (!WALKABLE_OPENING_TYPES.has(op.type) || !("start" in op) || !appliesTo(op.floors, m.storeyBase + f) || !compiledOpening(m, op.id, f)) continue;
      const reaches=addressedStrips(m, `${m.o.id}:${op.id}:reach`,op.facade,op.start,op.end,DOOR_REACH,floorY-.5,op.segmentId,f),sills=addressedStrips(m,`${m.o.id}:${op.id}:sill`,op.facade,op.start,op.end,ABUT,floorY-.5,op.segmentId,f);
      if('serves' in op&&op.serves){
        // One curved assembly has many tangent probes. Test its complete surface,
        // rather than treating the first strip as the whole balcony.
        const targets=surfaces.filter(s=>s.id===op.serves);
        const target=targets[0]??scene.objects.filter(o=>o.id===op.serves&&['path','driveway'].includes(o.type)).flatMap(o=>spatialParts(scene,o).map(probe=>({probe,top:getObjectTopY(probe)})))[0];
        const targetParts=scene.objects.find(o=>o.id===op.serves);
        const probes=targetParts?spatialParts(scene,targetParts):targets.length?targets.map(s=>s.probe):target?[target.probe]:[];
        if(target){
          const meets=sills.some(sill=>probes.some(part=>footprintOverlap(sill,part)>.02));
          if(!meets)finding('AUTHORED_ACCESS_DISCONNECTED',[...(scene.estatePlan?.relationships??[]),...(scene.relationships??[])].some(r=>r.kind==='connects'&&((r.from===m.o.id&&r.to===op.serves)||(r.to===m.o.id&&r.from===op.serves)))?'significant':'advisory',[m.o.id,op.serves],
            `Door ${op.id} does not meet ${op.serves} at its resolved wall; world threshold strips=${JSON.stringify(sills.map(s=>({position:s.transform.position,dimensions:s.dimensions})))}. Proximity is not a constructed connection.`,
            'Author a landing or connecting path at the resolved wall; retain the door and destination.');
          if(Math.abs(target.top-floorY)>.1)finding('AUTHORED_ACCESS_THRESHOLD','advisory',[m.o.id,op.serves],
            `Door ${op.id} threshold is ${floorY.toFixed(2)} m; ${op.serves} surface is ${target.top.toFixed(2)} m. Direct stepped access may be possible, but no step-free transition is authored.`,
            'If continuous or step-free access is intended, author the landing/step/ramp; no transition is inferred.');
        }
      }
      for(let sample=0;sample<reaches.length;sample++){
      // At ground level the door may open onto ground before the surface; above it, the floor must abut the facade.
      const reach=reaches[sample],sill=sills[sample];
      // A door into another mass is a partition: its passage is proven by the junction pass, never as exterior access.
      const intoMass = masses.some((other) => other !== m && footprintOverlap(sill, other.o) > .02 && floorY > other.base - .5 && floorY < getObjectTopY(other.o) - 1);
      for (const s of surfaces) {
        if (intoMass || (s.hostId === m.o.id && s.kind === "roof-terrace")) continue; // Its own roof is above this storey.
        const levelOk = Math.abs(s.top - floorY) <= (s.kind === "outdoor" ? STEP_MATCH : LEVEL_MATCH + .1);
        // `serves` documents intent; physical access still needs the surface at the door's level and against it.
        if (!levelOk || footprintOverlap(s.kind === "outdoor" ? reach : sill, s.probe) <= .02) continue;
        if (s.kind === "roof-terrace" && guardBlocks(scene, s.probe, m, op.facade)) continue;
        edge(here, s.node, "door", `${m.o.id}:${op.id}`);
      }
      const [wx, , wz] = reach.transform.position;
      if (!intoMass && Math.abs(floorY - ground(wx, wz)) <= 1.2) { edge(here, "exterior", "door", `${m.o.id}:${op.id}`); exteriorDoors.set(m.o.id, [...(exteriorDoors.get(m.o.id) ?? []), op.id]); }
    }
  }

  }

  // Junction passages: storeys at one floor level whose shared face is proven clear in the compiled geometry.
  const barrierList = blockers(model.primitives), junctions = deriveV3MassJunctions(scene);
  for (const j of junctions.junctions.filter((k) => k.supported)) {
    const a = massById.get(j.massA), b = massById.get(j.massB);
    if (!a || !b) continue;
    for (let fa = 0; fa < a.levels; fa++) for (let fb = 0; fb < b.levels; fb++) {
      const ya = a.base + fa * a.levelHeight + V3_FLOOR_SLAB, yb = b.base + fb * b.levelHeight + V3_FLOOR_SLAB;
      if (Math.abs(ya - yb) > LEVEL_MATCH || Math.min(ya, yb) + 2 > j.relativeElevation.shared[1]) continue;
      if (passageClear(j.sharedWalls, massById, Math.max(ya, yb) + 1.1, barrierList)) edge(storeyNode(a.o.id, fa), storeyNode(b.o.id, fb), "junction", j.id);
    }
  }

  // Authored circulation (usable only); a lift serves every storey it passes, a stair its two ends.
  const circulation = resolveV3Circulation(scene), circulationFailures=auditV3StairUsability(scene,model.primitives);
  const failedCirculation=new Set(circulationFailures.map(f=>f.targetId));
  for (const r of circulation.filter((c) => c.usable && !failedCirculation.has(c.entry.id))) {
    const host = r.host.id, stops = r.entry.type === "lift" ? Array.from({ length: r.entry.toLevel - r.entry.fromLevel + 1 }, (_, i) => r.entry.fromLevel + i) : [r.entry.fromLevel, r.entry.toLevel];
    const target = (level: number) => {
      if (level < (massById.get(host)?.levels ?? 0)) return storeyNode(host, level);
      if (r.exit === "stacked" && r.stackedMassId) return storeyNode(r.stackedMassId, 0);
      const f = r.entry.footprint, area = f.width * f.depth, footprint = probe(r.host, `${r.entry.id}:footprint`, f.x, f.z, f.width, f.depth);
      return surfaces.find((s) => s.kind === "roof-terrace" && s.hostId === host && footprintOverlap(footprint, s.probe) >= area * .5)?.node ?? `${host}#roof`;
    };
    for (let i = 1; i < stops.length; i++) edge(target(stops[i - 1]), target(stops[i]), r.entry.type === "lift" ? "lift" : "stair", r.entry.id);
  }

  // Reachability from the site, and from inside the house without walking around the outside.
  const adjacency = new Map<string, string[]>();
  for (const e of edges) { adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]); adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from]); }
  const flood = (starts: string[], mark: (n: V3AccessNode) => void, avoid?: string) => {
    const queue = [...starts], seen = new Set(starts);
    while (queue.length) { const id = queue.shift()!, n = nodes.get(id); if (n) mark(n); for (const next of adjacency.get(id) ?? []) if (!seen.has(next) && next !== avoid) { seen.add(next); queue.push(next); } }
  };
  flood(["exterior"], (n) => { n.reachable = true; });
  flood([...nodes.values()].filter((n) => n.kind === "storey").map((n) => n.id), (n) => { if (n.id !== "exterior") n.reachableFromHouse = true; }, "exterior");

  // Findings: wings and storeys first, then the exterior spaces they serve.
  const neighbours = (m: Mass) => junctions.junctions.filter((j) => j.supported && (j.massA === m.o.id || j.massB === m.o.id)).map((j) => j.massA === m.o.id ? j.massB : j.massA);
  for (const m of masses) {
    const unreachable = Array.from({ length: m.levels }, (_, f) => f).filter((f) => !nodes.get(storeyNode(m.o.id, f))!.reachable);
    if (!unreachable.length) continue;
    const groundMass = m.storeyBase === 0 && m.base - ground(m.o.transform.position[0], m.o.transform.position[2]) < 1.5;
    if (groundMass && unreachable.includes(0)) {
      const joined = neighbours(m);
      finding("UNREACHABLE_WING", planArea(m.o) >= 12 ? "significant" : "advisory", [m.o.id, ...joined],
        `${m.o.id} has no way in: no walkable exterior door${joined.length ? `, and its junction with ${joined.join(", ")} is closed by a wall or glazing` : ""}.`,
        joined.length ? `Add a door or glazed-door on the face ${m.o.id} shares with ${joined[0]} (or an exterior door on ${m.o.id}); do not move or resize either mass.` : `Add a ground-floor door or glazed-door on an exterior facade of ${m.o.id}.`);
    }
    const upper = unreachable.filter((f) => f > 0 || !groundMass);
    if (!upper.length) continue;
    const anyCirculation = circulation.some((c) => c.host.id === m.o.id || c.stackedMassId === m.o.id);
    const levelsText = upper.map((f) => m.storeyBase + f).join(", ");
    const below = !groundMass && m.storeyBase > 0 ? scene.objects.find((o) => o.id === hostIdOf(m.o))?.id : undefined;
    finding("UNREACHABLE_STOREY", "significant", [m.o.id, ...(below ? [below] : [])],
      `${m.o.id} storey ${levelsText} (building level) is unreachable: ${anyCirculation ? "its authored circulation is unusable or does not reach it" : "no stair or lift serves it"}.`,
      below ? `Author circulation (type stair or lift) in ${below} from level 0 to its roof level (${massById.get(below)?.levels ?? 1}) with a plan rectangle inside ${m.o.id}'s footprint; V3 never places a stair automatically.`
        : `Author circulation (type stair or lift) in ${m.o.id}, or in a mass joined to it at the same floor level, from level 0 to level ${Math.max(...upper)}, with a plan rectangle inside the host; V3 never places a stair automatically.`);
  }
  for (const s of surfaces.filter((x) => x.kind === "balcony")) {
    const n = nodes.get(s.node)!;
    if (n.reachable) continue;
    const hasDoor = edges.some((e) => e.kind === "door" && (e.from === s.node || e.to === s.node));
    finding("INACCESSIBLE_BALCONY", hasDoor ? "advisory" : "significant", [s.hostId ?? s.id, s.id],
      hasDoor ? `Balcony ${s.id} has a door, but the storey it serves is unreachable.` : `Balcony ${s.id}${s.facade ? ` on the ${s.facade} facade` : ""} has no walkable door from the storey it serves; glazing is not access.`,
      hasDoor ? `Resolve the unreachable storey of ${s.hostId}; keep the balcony.` : `Add a glazed-door (or door) on the ${s.facade ?? "adjoining"} facade of ${s.hostId} at level ${s.level ?? 1}, overlapping the balcony span, with serves:"${s.id}"; keep the balcony and other openings.`);
  }
  for (const s of surfaces.filter((x) => x.kind === "roof-terrace")) {
    if (nodes.get(s.node)!.reachable) continue;
    const adjoining = masses.filter((m) => m.o.id !== s.hostId && footprintOverlap(expanded(s.probe, 1.5), m.o) > .05 && Array.from({ length: m.levels }, (_, f) => m.base + f * m.levelHeight + V3_FLOOR_SLAB).some((y) => Math.abs(y - s.top) <= LEVEL_MATCH + .1));
    const guarded = adjoining.find((m) => (["north", "south", "east", "west"] as const).some((f) => guardBlocks(scene, s.probe, m, f)));
    const gapped = adjoining.find((m) => footprintOverlap(expanded(m.o, ABUT), s.probe) <= .02);
    finding("INACCESSIBLE_ROOF_TERRACE", "significant", [s.id, ...(s.hostId ? [s.hostId] : []), ...adjoining.map((m) => m.o.id)],
      `Rooftop terrace ${s.id} has no access: no usable stair or lift reaches it${adjoining.length ? ` and no walkable door from ${adjoining.map((m) => m.o.id).join(", ")} opens onto it` : ""}${gapped ? `; an open gap separates it from ${gapped.o.id}` : ""}${guarded ? `; its guard runs across the edge facing ${guarded.o.id}` : ""}.`,
      adjoining.length ? `Author circulation in ${s.hostId} reaching its roof level with a plan rectangle inside ${s.id}; or, where ${s.id} abuts ${adjoining[0].o.id}, add a glazed-door on that facade at terrace level with serves:"${s.id}" and list the terrace edge in terraceOpenEdges.`
        : `Author circulation (stair or lift) in ${s.hostId} from level 0 to its roof level with a plan rectangle inside ${s.id}; V3 builds the stair head enclosure.`);
  }
  // Outdoor living: one finding per contiguous area the house cannot open onto.
  const living = surfaces.filter((s) => s.kind === "outdoor" && s.living), grouped = new Set<string>();
  for (const s of living) {
    if (grouped.has(s.node) || nodes.get(s.node)!.reachableFromHouse) continue;
    const group: Surface[] = [], queue = [s.node];
    while (queue.length) {
      const id = queue.shift()!;
      if (grouped.has(id)) continue;
      grouped.add(id);
      const member = surfaces.find((x) => x.node === id);
      if (member) group.push(member);
      for (const e of edges) if (e.kind === "surface" && (e.from === id || e.to === id)) { const other = e.from === id ? e.to : e.from; if (other !== "exterior" && !grouped.has(other)) queue.push(other); }
    }
    const lived = group.filter((g) => g.living), area = lived.reduce((sum, g) => sum + g.area, 0);
    const near = masses.filter((m) => m.storeyBase === 0 && lived.some((g) => footprintOverlap(expanded(m.o, 6), g.probe) > .05));
    if (!lived.length) continue;
    finding("NO_OUTDOOR_LIVING_ACCESS", area >= 20 && near.length ? "significant" : "advisory", [...near.map((m) => m.o.id), ...lived.map((g) => g.id)],
      `Outdoor living area ${lived.map((g) => g.id).join(", ")} (${Math.round(area)} m²) has no walkable door from the house; ${near.length ? `the facades of ${near.map((m) => m.o.id).join(", ")} toward it are glazing or solid` : "no building opens onto it"}.`,
      near.length ? `Add a glazed-door (operation sliding for a door wall) on the ${facadeFacing(near[0], lived[0].probe) ?? "facing"} facade of ${near[0].o.id} at ground level, overlapping ${lived[0].id}, with serves:"${lived[0].id}"; keep the existing glazing and the area itself.` : `Connect ${lived[0].id} to the house with a path or terrace from a ground-floor door; keep its position.`);
  }
  // Openings the compiler drops, and circulation intent it cannot build.
  for (const d of junctions.diagnostics.filter((x) => x.code === "JUNCTION_OPENING_REMOVED")) finding("AUTHORED_OPENING_REMOVED", "advisory", [d.massId ?? d.junctionId], d.message, `Move opening ${d.openingId} to an exterior facade of ${d.massId}, or make the shared face a partition with a door; nothing is removed automatically.`);
  for (const d of v3StoreyTargetingDiagnostics(scene).filter((x) => /not rendered/.test(x.message))) finding("AUTHORED_OPENING_REMOVED", "advisory", [d.targetId], d.message, `Retarget opening ${d.openingId} of ${d.targetId} to a storey it has.`);
  for (const issue of auditV3CirculationIntent(scene)) finding("CIRCULATION_INTENT_INCOMPLETE", issue.code === "CIRCULATION_OVERLAP" ? "advisory" : "significant", [issue.targetId], issue.message, issue.code === "CIRCULATION_LOCATION_MISSING"
    ? `Give ${issue.targetId} a plan rectangle (x, z, width, depth) inside its host; it is never placed automatically.` : `Correct ${issue.targetId}'s storeys or plan rectangle so a usable ${/lift/i.test(issue.message) ? "lift" : "stair"} fits inside its host; keep the host unchanged.`);
  for(const failure of circulationFailures.filter(f=>f.code.startsWith('STAIR_')))finding('CIRCULATION_INTENT_INCOMPLETE','significant',[failure.targetId],failure.message,'Correct only this diagnosed stair; preserve its identity, host, intended levels and unrelated architecture.');
  return { circulationFailures, nodes: [...nodes.values()], edges, findings, significant: findings.filter((f) => f.severity === "significant").length };
}

/** Facade of a mass facing a plan probe, by its dominant local offset. */
function facadeFacing(m: Mass, target: V3SceneObject): JunctionFacade | undefined {
  const dx = target.transform.position[0] - m.o.transform.position[0], dz = target.transform.position[2] - m.o.transform.position[2], yaw = m.o.transform.rotation[1];
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  if (Math.hypot(lx, lz) < .5) return undefined;
  return Math.abs(lx) / m.w > Math.abs(lz) / m.d ? (lx > 0 ? "east" : "west") : (lz > 0 ? "south" : "north");
}

/**
 * A derived rooftop guard stands across the terrace edge facing a door unless that edge is an authored open edge,
 * the terrace is explicitly unguarded, or the edge lies within the adjoining mass (where the compiler trims it).
 */
function guardBlocks(scene: V3Scene, terrace: V3SceneObject, m: Mass, doorFacade: JunctionFacade): boolean {
  if (terrace.railing === "none" || !rooftopTerraces(scene).some((t) => t.id === terrace.id)) return false;
  const [w, , d] = scaledDimensionsOf(terrace), yaw = terrace.transform.rotation[1];
  const centre = worldPoint(m.o, doorFacade === "east" ? m.w / 2 : doorFacade === "west" ? -m.w / 2 : 0, 0, doorFacade === "south" ? m.d / 2 : doorFacade === "north" ? -m.d / 2 : 0);
  const dx = centre[0] - terrace.transform.position[0], dz = centre[2] - terrace.transform.position[2];
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const edge: JunctionFacade = Math.abs(lx) / w > Math.abs(lz) / d ? (lx > 0 ? "east" : "west") : (lz > 0 ? "south" : "north");
  if (terrace.terraceOpenEdges?.includes(edge)) return false;
  // The rail runs 6 cm inside the terrace edge; it is trimmed only where the mass beyond the facade covers it.
  const gap = edge === "east" || edge === "west" ? Math.abs(lx) - w / 2 : Math.abs(lz) - d / 2;
  return gap > -.06;
}

/** Minimum clear walkable width through a shared face (door surrounds and jambs narrow an opening). */
const CLEAR_WIDTH = .7;
/** Samples the shared face at walking height: a clear run through the compiled walls is a passage. */
function passageClear(regions: ReturnType<typeof deriveV3MassJunctions>["junctions"][number]["sharedWalls"], masses: Map<string, Mass>, y: number, list: Blocker[]): boolean {
  for (const r of regions) {
    const m = masses.get(r.massId);
    if (!m || y < r.elevation[0] + .3 || y > r.elevation[1] - .3) continue;
    const alongX = r.facade === "north" || r.facade === "south", normal = r.facade === "south" || r.facade === "east" ? 1 : -1;
    let run = 0, previous: number | undefined;
    for (let t = r.span[0] + .1; t <= r.span[1] - .1 + 1e-9; t += .1) {
      const inner = worldPoint(m.o, alongX ? t : r.at - normal * .45, y, alongX ? r.at - normal * .45 : t), outer = worldPoint(m.o, alongX ? t : r.at + normal * .45, y, alongX ? r.at + normal * .45 : t);
      if (blocked(inner, outer, list)) { run = 0; previous = undefined; continue; }
      run += previous === undefined ? 0 : t - previous; previous = t;
      if (run >= CLEAR_WIDTH - 1e-9) return true;
    }
  }
  return false;
}
