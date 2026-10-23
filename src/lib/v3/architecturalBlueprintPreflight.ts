import { resolveFacadeOpeningBands } from './facadeOpeningRecovery';
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
  findings.push(...architecturalDoorPreflight(bp.doors));

  findings.push(...architecturalOpeningPreflight(bp.buildings));
  return findings;
}

/** Unsupported door forms and overlaps remain visible after reload and edits. */
export function architecturalDoorPreflight(doors: {id:string;program:string;partitionId:string;offset:number;width:number}[]): V3BlueprintFinding[] {
  const findings:V3BlueprintFinding[]=[];
  const fail=(code:string,targetIds:string[],message:string)=>findings.push({code,targetIds,message,severity:'fatal'});
  for (const [index, door] of doors.entries()) {
    if (door.program === 'archway') fail('ARCHITECTURAL_INTERIOR_UNSUPPORTED', [door.id], 'The partition builder constructs rectangular cutouts, not arched openings. Preserve the requested form; no rectangular substitute is authorised.');
    for (const other of doors.slice(index + 1)) if (door.partitionId === other.partitionId && Math.abs(door.offset - other.offset) < (door.width + other.width) / 2 - 1e-8)
      fail('ARCHITECTURAL_DOOR_OVERLAP', [door.id, other.id], 'Interior openings overlap; merging their gaps would lose independently authored door intent.');
  }
  return findings;
}

/** Shared by initial planning and revalidation after ordinary scene edits. */
export function architecturalOpeningPreflight(buildings: Pick<V3ArchitecturalBlueprint['buildings'][number], 'id'|'facade'|'plan'|'storeys'>[]): V3BlueprintFinding[] {
  const findings: V3BlueprintFinding[]=[];
  const fail=(code:string,targetIds:string[],message:string)=>findings.push({code,targetIds,message,severity:'fatal'});
  for (const b of buildings) {
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
      const groups = new Set<string>();
      for (const op of openings) {
        if (op.floors === 'ground' && level !== 0 || op.floors === 'upper' && level === 0) continue;
        const segment = b.plan.kind === 'outline' ? b.plan.segments.find(s => s.id === op.segmentId) : undefined;
        if (b.plan.kind === 'outline' && (!segment || (segment.type === 'line' ? !segment.start || !segment.end : !segment.center || !segment.radius || segment.startAngle === undefined || !segment.sweep))) continue;
        const span = segment ? segmentLength(segment) : b.plan.kind === 'outline' ? 0 : ['north', 'south'].includes(op.facade) ? b.plan.width : b.plan.depth;
        if (!Number.isFinite(span) || span <= 0) continue; // Footprint validation owns malformed geometry.
        const key = segment?.id ?? op.facade;
        if (groups.has(key)) continue;
        groups.add(key);
        const addressed = openings.filter(other => segment ? other.segmentId === segment.id : other.facade === op.facade && other.segmentId === undefined);
        const resolved = resolveFacadeOpeningBands(addressed.map(other=>({...builderOpening(other),facade:'north' as const})), 'north', span, 1, level, height);
        for (const id of resolved.invalidIds)
          fail('ARCHITECTURAL_OPENING_CLIPPED', [b.id, id], `Opening on ${key}, level ${level} cannot be cut at its authored size. Intent is retained; supported wall remains pending refinement.`);
        for (const [a,c] of resolved.conflicts)
          fail('ARCHITECTURAL_OPENING_OVERLAP', [b.id, a.ownerId, c.ownerId], `Opening cuts overlap on ${key}, level ${level}: ${a.key} span [${a.start}, ${a.end}], sill ${a.sill}, height ${a.height}; ${c.key} span [${c.start}, ${c.end}], sill ${c.sill}, height ${c.height}. Both conflicting cuts are withheld; amber wall sections remain unresolved and editable.`);
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
