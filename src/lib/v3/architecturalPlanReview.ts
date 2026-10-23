/** Read-only conceptual planning checks. No provider, geometry edits, scores or acceptance gates. */
import type { V3Scene } from './scene';
import type { V3BlueprintFinding } from './blueprint';
import { sharedBoundaryLength, resolveV3PartitionBoundary, type V3RoomFootprint } from './interior';
import { v3PartitionTypeCapability } from './interiorWalls';
import { estateEndpoint, endpointFits, type EstateRoute } from './routeGeometry';
import { materializeV3ArchitecturalObject } from './architecture';

// Schematic review thresholds, NOT building regulations or accessibility certification.
export const CONCEPTUAL_PASSAGE_WIDTH = .8;
export const CONCEPTUAL_CIRCULATION_WIDTH = .9;
const EPS = .01;
const circulation = /\b(hall|foyer|gallery|corridor|circulation|landing|entry|vestibule)\b/i;
export const ARCHITECTURAL_REVIEW_QUESTIONS = [
  'Does the built form and the space between volumes express a coherent architectural idea and convincing proportions?',
  'Does the arrival sequence lead clearly to a considered entrance?',
  'Are room proportions, public/private/service relationships and everyday circulation believable?',
  'Do privacy, views, climate and indoor-outdoor connections shape the drawing rather than only its description?',
  'Are the storeys and stair landings coherent, and does the design fulfill the brief’s style and ambition?',
] as const;

const contains = (outer: V3RoomFootprint, inner: V3RoomFootprint) =>
  Math.abs(outer.x - inner.x) + inner.width / 2 <= outer.width / 2 + EPS &&
  Math.abs(outer.z - inner.z) + inner.depth / 2 <= outer.depth / 2 + EPS;
const overlap = (a: V3RoomFootprint, b: V3RoomFootprint) =>
  Math.min(a.x + a.width / 2, b.x + b.width / 2) - Math.max(a.x - a.width / 2, b.x - b.width / 2) > EPS &&
  Math.min(a.z + a.depth / 2, b.z + b.depth / 2) - Math.max(a.z - a.depth / 2, b.z - b.depth / 2) > EPS;
// Interior boundary construction tolerates 5cm edits. Conceptual access uses a
// tighter seam tolerance so an undrawn strip is not silently counted as a hall.
const edgeMeets = (a: V3RoomFootprint, b: V3RoomFootprint) =>
  Math.abs(Math.abs(a.x - b.x) - (a.width + b.width) / 2) <= EPS ||
  Math.abs(Math.abs(a.z - b.z) - (a.depth + b.depth) / 2) <= EPS;

/** Reports potential shared-edge access, not constructed door access. Undrawn gaps are
 * unknown circulation, never invented corridors. Existing shell/overlap/level audits
 * remain authoritative; their findings are included separately from new observations. */
export function reviewArchitecturalPlan(scene: V3Scene, existing: V3BlueprintFinding[] = []) {
  const findings: V3BlueprintFinding[] = [];
  const note = (code: string, targetIds: string[], message: string) => findings.push({code, targetIds, message, severity: 'advisory'});
  const rooms = scene.interior?.rooms ?? [], storeys = scene.interior?.storeys ?? [];
  const graph = new Map(rooms.map(r => [r.id, new Set<string>()]));
  const join = (a: string, b: string) => { graph.get(a)?.add(b); graph.get(b)?.add(a); };
  for (const s of storeys) {
    const floor = rooms.filter(r => r.storeyId === s.id && r.hostMassId === s.hostMassId);
    for (const r of floor) if (circulation.test(r.program) && Math.min(r.footprint.width, r.footprint.depth) < CONCEPTUAL_CIRCULATION_WIDTH - EPS)
      note('PLAN_NARROW_CIRCULATION', [r.id], `Circulation zone is narrower than the ${CONCEPTUAL_CIRCULATION_WIDTH}m schematic review threshold. Review its usable width; this is not a code assessment.`);
    for (let i = 0; i < floor.length; i++) for (let j = i + 1; j < floor.length; j++) {
      const a = floor[i], b = floor[j];
      if (Math.min(a.footprint.width, a.footprint.depth, b.footprint.width, b.footprint.depth) < CONCEPTUAL_PASSAGE_WIDTH - EPS ||
        !edgeMeets(a.footprint, b.footprint) || overlap(a.footprint, b.footprint) || sharedBoundaryLength(a.footprint, b.footprint) < CONCEPTUAL_PASSAGE_WIDTH - EPS) continue;
      const partitions = scene.interior?.partitions?.filter(p => p.storeyId === s.id &&
        (p.roomAId === a.id && p.roomBId === b.id || p.roomAId === b.id && p.roomBId === a.id)) ?? [];
      const blocked = partitions.some(p => {
        if (!v3PartitionTypeCapability(p.partitionType).blocksMovement) return false;
        const boundary = resolveV3PartitionBoundary(scene, p.id);
        return !boundary || !scene.interior?.doors?.some(d => d.partitionId === p.id && d.width >= CONCEPTUAL_PASSAGE_WIDTH - EPS &&
          d.offset - d.width / 2 >= -EPS && d.offset + d.width / 2 <= boundary.length + EPS);
      });
      if (!blocked) join(a.id, b.id);
    }
  }
  for (const relation of scene.relationships.filter(r => r.kind === 'adjacent')) {
    const a = rooms.find(r => r.id === relation.from), b = rooms.find(r => r.id === relation.to);
    if (a && b && a.storeyId === b.storeyId && a.hostMassId === b.hostMassId &&
      (!edgeMeets(a.footprint, b.footprint) || sharedBoundaryLength(a.footprint, b.footprint) < CONCEPTUAL_PASSAGE_WIDTH - EPS))
      note('PLAN_ADJACENCY_PASSAGE', [a.id, b.id], `Declared adjacency has less than ${CONCEPTUAL_PASSAGE_WIDTH}m of shared edge. Move/resize the zones or revise the access intent; adjacency alone creates no passage.`);
  }
  const seeds = new Set<string>();
  for (const entry of scene.estatePlan?.blueprint?.entrances ?? []) {
    if (entry.level !== 0) continue; // upper access is reached through reservations below
    const rawHost = scene.objects.find(o => o.id === entry.objectId);
    if (!rawHost) continue;
    const host = materializeV3ArchitecturalObject(rawHost);
    const contact = estateEndpoint(scene, {from: host.id, spatial: {from: {entranceId: entry.id}}} as EstateRoute, 'from');
    if (!contact) continue; // existing wall-address diagnostics explain this defect
    if (!endpointFits(host, {point: contact, openingId: entry.openingId}, CONCEPTUAL_PASSAGE_WIDTH, 'pedestrian', scene)) {
      note('PLAN_ENTRY_NARROW', [entry.id, host.id], `The addressed entry does not fit the ${CONCEPTUAL_PASSAGE_WIDTH}m schematic passage threshold. Review its actual opening span.`);
      continue;
    }
    const dx = contact[0] - host.transform.position[0], dz = contact[2] - host.transform.position[2], angle = host.transform.rotation[1];
    const x = dx * Math.cos(angle) - dz * Math.sin(angle), z = dx * Math.sin(angle) + dz * Math.cos(angle);
    const candidates = rooms.filter(r => r.hostMassId === host.id && storeys.some(s => s.id === r.storeyId && s.index === 0)).filter(r => {
      const f = r.footprint, ex = Math.abs(x - f.x), ez = Math.abs(z - f.z);
      return Math.min(f.width, f.depth) >= CONCEPTUAL_PASSAGE_WIDTH - EPS &&
        (Math.abs(ex - f.width / 2) <= EPS && ez <= f.depth / 2 - CONCEPTUAL_PASSAGE_WIDTH / 2 + EPS ||
        Math.abs(ez - f.depth / 2) <= EPS && ex <= f.width / 2 - CONCEPTUAL_PASSAGE_WIDTH / 2 + EPS);
    });
    const op = host.composition?.openings?.find(o => o.id === entry.openingId);
    const serves = op && 'serves' in op ? op.serves : undefined;
    if (!candidates.length) note('PLAN_ENTRY_ROOM_GAP', [entry.id, host.id], 'The entrance contact does not meet a room-zone edge with a usable schematic span. Draw the entrance hall/vestibule to the actual shell; any unallocated circulation remains unverified.');
    else {
      for (const r of candidates) seeds.add(r.id);
      // Legacy serves may instead name a balcony/terrace assembly. Only a room
      // reference asserts which interior zone the opening is meant to serve.
      if (serves && rooms.some(r => r.id === serves) && !candidates.some(r => r.id === serves)) note('PLAN_ENTRY_ROOM_MISMATCH', [entry.id, serves], 'The entrance’s serves reference does not match the zone at its actual wall contact. Review the room placement or opening address.');
    }
  }
  for (const reservation of scene.interior?.circulation ?? []) {
    const landingRooms: string[][] = [];
    // Roof destinations have no room datum; construction audits their roof landing.
    const floors = storeys.filter(s => s.hostMassId === reservation.hostMassId && s.index >= reservation.fromLevel && s.index <= reservation.toLevel).sort((a, b) => a.index - b.index);
    for (const s of floors) {
      const candidates = rooms.filter(r => r.storeyId === s.id && r.hostMassId === s.hostMassId && contains(r.footprint, reservation.footprint));
      if (!candidates.length) note('PLAN_STAIR_LANDING_ZONE', [reservation.id, s.id], 'No room zone contains the complete vertical-circulation reservation on this floor. Draw an aligned stair/landing hall; overlap alone cannot establish access.');
      landingRooms.push(candidates.map(r => r.id));
    }
    for (let i = 1; i < landingRooms.length; i++) if (floors[i].index === floors[i - 1].index + 1)
      for (const a of landingRooms[i - 1]) for (const b of landingRooms[i]) join(a, b);
  }
  const reached = new Set(seeds), queue = [...seeds];
  for (let i = 0; i < queue.length; i++) for (const next of graph.get(queue[i]) ?? []) if (!reached.has(next)) {reached.add(next); queue.push(next);}
  for (const s of storeys) {
    const unreachable = rooms.filter(r => r.storeyId === s.id && !reached.has(r.id));
    if (unreachable.length) note('PLAN_ROOM_ACCESS_UNVERIFIED', [s.id, ...unreachable.map(r => r.id)], 'These zones have no potential shared-edge path from a drawn ground entrance through aligned circulation reservations. Draw connecting circulation or intended outdoor access. Missing zones, gaps or detailed doors may explain it; no path has been invented.');
  }
  const objective = [...existing.filter(f => /SPACE_|ENTRANCE|ADJACENCY|VERTICAL|CIRCULATION|STAIR_|ESTATE_(ACCESS|ROUTE|POOL)|PLAN_(ENTRANCE|REFERENCE|GEOMETRY)/.test(f.code)), ...findings];
  return {
    version: 1 as const,
    objective: {
      scope: 'Conceptual room access and existing geometry audits; potential adjacency is not a built doorway or a walkability certificate.',
      passageWidth: CONCEPTUAL_PASSAGE_WIDTH, circulationWidth: CONCEPTUAL_CIRCULATION_WIDTH,
      roomCount: rooms.length, potentialAccessRoomIds: [...reached].sort(), findings: objective,
    },
    architecturalJudgment: {status: 'requires-design-review' as const, questions: ARCHITECTURAL_REVIEW_QUESTIONS,
      limitation: 'No aesthetic score or claim of excellence. A valid rectangle can be appropriate; generic composition and exceptional architecture require review of the actual drawing against the brief.'},
    findings,
  };
}
