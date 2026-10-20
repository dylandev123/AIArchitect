import { openingBands } from '@/lib/architecture/geometry/openings';
import type { V3ArchitecturalBlueprint } from './architecturalBlueprint';
import type { V3BlueprintFinding } from './blueprint';
import { builderOpening } from './composition';
import { segmentLength } from './curvedFootprint';
import { deriveV3PartitionWall, v3DoorHeadHeight } from './interiorWalls';
import type { V3Scene } from './scene';

/** Decision/identity checks only. No scene compilation or architectural preferences. */
export function architecturalBlueprintPreflight(bp: V3ArchitecturalBlueprint): V3BlueprintFinding[] {
  const findings: V3BlueprintFinding[] = [];
  const fail = (code: string, targetIds: string[], message: string) => findings.push({ code, targetIds, message, severity: 'fatal' });
  const semanticIds = new Set([
    ...bp.buildings.flatMap(b => [b.id, b.roof.id, ...b.storeys.flatMap(s => [s.id, ...s.spaces.map(r => r.id)])]),
    ...bp.features.map(f => f.id), ...bp.connections.map(c => c.surfaceId),
    ...bp.verticalCirculation.map(c => c.id), ...bp.partitions.map(p => p.id), ...bp.doors.map(d => d.id),
  ]);
  // Access and object endpoints share a lookup domain downstream. A gate cannot
  // shadow a building, route owner, room or circulation identity.
  for (const access of bp.site.access) if (semanticIds.has(access.id))
    fail('ARCHITECTURAL_DUPLICATE_ID', [access.id], 'Site access identity collides with scene semantics.');
  const rooms = new Set(bp.buildings.flatMap(b => b.storeys.flatMap(s => s.spaces.map(r => r.id))));
  for (const adjacency of bp.roomAdjacencies) for (const ref of [adjacency.from, adjacency.to]) if (!rooms.has(ref))
    fail('ARCHITECTURAL_REFERENCE', [ref], 'Room adjacency must reference an existing functional space.');
  for (const adjacency of bp.roomAdjacencies) if (adjacency.from === adjacency.to)
    fail('ARCHITECTURAL_REFERENCE', [adjacency.from], 'A room adjacency must name two different spaces.');
  for (const [index, door] of bp.doors.entries()) {
    if (door.program === 'archway') fail('ARCHITECTURAL_INTERIOR_UNSUPPORTED', [door.id], 'The partition builder constructs rectangular cutouts, not arched openings. Preserve the requested form; no rectangular substitute is authorised.');
    for (const other of bp.doors.slice(index + 1)) if (door.partitionId === other.partitionId && Math.abs(door.offset - other.offset) < (door.width + other.width) / 2 - 1e-8)
      fail('ARCHITECTURAL_DOOR_OVERLAP', [door.id, other.id], 'Interior openings overlap; merging their gaps would lose independently authored door intent.');
  }

  for (const b of bp.buildings) {
    const openings = b.facade.openings ?? [];
    for (const op of openings) {
      if ('start' in op && op.end <= op.start)
        fail('ARCHITECTURAL_OPENING_SPAN', [b.id, op.id], 'Opening end must exceed start; reversing or dropping the span would change design intent.');
      if (op.floors === 'upper' && b.storeys.length < 2)
        fail('ARCHITECTURAL_OPENING_TARGET', [b.id, op.id], 'Upper opening has no storey to construct it on.');
      if (b.plan.kind === 'outline' ? !b.plan.segments.some(s => s.id === op.segmentId) : op.segmentId !== undefined)
        fail('ARCHITECTURAL_OPENING_TARGET', [b.id, op.id], 'Opening must address its actual supported wall: an existing segment for outlines, a facade otherwise.');
    }
    // Use the shared plan-only band policy to expose clipping/reversal/overlap
    // before construction. This does not invoke a mesh builder.
    for (let level = 0; level < b.storeys.length; level++) {
      const height = b.storeys[level].height - (b.plan.kind === 'rectangle' ? 0 : level === b.storeys.length - 1 ? .52 : .26);
      const groups = new Map<string, { start: number; end: number; id: string }[]>();
      for (const op of openings) {
        if (op.floors === 'ground' && level !== 0 || op.floors === 'upper' && level === 0) continue;
        const segment = b.plan.kind === 'outline' ? b.plan.segments.find(s => s.id === op.segmentId) : undefined;
        if (b.plan.kind === 'outline' && (!segment || (segment.type === 'line' ? !segment.start || !segment.end : !segment.center || !segment.radius || segment.startAngle === undefined || !segment.sweep))) continue;
        const span = segment ? segmentLength(segment) : b.plan.kind === 'outline' ? 0 : ['north', 'south'].includes(op.facade) ? b.plan.width : b.plan.depth;
        if (!Number.isFinite(span) || span <= 0) continue; // Footprint validation owns malformed geometry.
        const bands = openingBands('north', span, 1, [{ ...builderOpening(op), facade: 'north' }], level, height);
        const requestedHeight = op.type === 'glazing-zone' ? op.heightRatio * height : op.height;
        if (!bands.length || bands.some(band => requestedHeight !== undefined && Math.abs((band.height ?? 0) - requestedHeight) > 1e-8
          || (band.sill ?? 0) > height - .2 || (band.height ?? 0) < .3 || (band.sill ?? 0) + (band.height ?? 0) > height + 1e-8))
          fail('ARCHITECTURAL_OPENING_CLIPPED', [b.id, op.id], `Opening on level ${level} would be dropped or resized by construction; resolve its height, sill and span explicitly.`);
        const key = segment?.id ?? op.facade, existing = groups.get(key) ?? [];
        for (const band of bands) {
          const conflict = existing.find(other => Math.min(other.end, band.end) - Math.max(other.start, band.start) > 1e-8);
          if (conflict) fail('ARCHITECTURAL_OPENING_OVERLAP', [b.id, conflict.id, op.id], `Opening spans overlap on ${key}, level ${level}; construction cannot choose which intent to clip.`);
          existing.push({ start: band.start, end: band.end, id: op.id });
        }
        groups.set(key, existing);
      }
    }
  }
  return findings;
}

/** The existing plan-only wall resolver exposes dropped/clamped door cutouts. */
export function architecturalInteriorPreflight(scene: V3Scene): V3BlueprintFinding[] {
  const findings: V3BlueprintFinding[] = [];
  for (const partition of scene.interior?.partitions ?? []) {
    const doors = scene.interior!.doors?.filter(d => d.partitionId === partition.id) ?? [];
    if (!doors.length) continue;
    const wall = deriveV3PartitionWall(scene, partition);
    if (!wall) continue; // The ordinary interior audit owns invalid boundaries/references.
    for (const door of doors) {
      const opening = wall.openings.find(o => o.doorId === door.id);
      if (!wall.construction || !opening || Math.abs(opening.end - opening.start - door.width) > 1e-8
        || Math.abs((opening.start + opening.end) / 2 - door.offset) > 1e-8
        || Math.abs(opening.headY - wall.floorY - v3DoorHeadHeight(door.program)) > 1e-8)
        findings.push({ code: 'ARCHITECTURAL_DOOR_CLIPPED', targetIds: [partition.id, door.id], severity: 'fatal', message: 'Interior door would be omitted or resized. Door records support rectangular cutouts in constructed partitions; exterior doors belong in facade openings.' });
    }
  }
  return findings;
}
