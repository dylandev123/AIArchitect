/** Disposable provider input. Expanded once into the existing authoritative V3 plan;
 * never persisted, rendered or compiled as another scene representation. */
import { z } from 'zod';
import { v3ArchitecturalPlanSchema, type V3ArchitecturalPlan } from './architecturalPlanFirst';
import { developRoomLayouts, roomLayoutSchema, roomSizeIntentSchema, type RoomLayoutRequest } from './roomLayout';

const shape = v3ArchitecturalPlanSchema.shape;
const building = shape.buildings.element;
const storey = building.shape.storeys.element;
const space = storey.shape.spaces.element;
const feature = shape.features.element;
const connection = shape.connections.element;
const location = building.shape.location.extend({
  baseElevation: building.shape.location.shape.baseElevation.default(0),
  rotationY: building.shape.location.shape.rotationY.default(0),
});
const opening = building.shape.accessOpenings.element;
const accessOpening = z.discriminatedUnion('type', [
  opening.options[0].extend({height: opening.options[0].shape.height.default(2.4), floors: opening.options[0].shape.floors.default('ground')}),
  opening.options[1].extend({height: opening.options[1].shape.height.default(2.4), floors: opening.options[1].shape.floors.default('ground')}),
]);

/** Keep shape choices, room organization and explicit route contacts. Omitted
 * heights use stated schematic defaults, editable in the ordinary plan editor. */
export const v3PlanAuthoringSchema = z.object({
  format: shape.format,
  concept: shape.concept,
  site: shape.site.extend({baseElevation: shape.site.shape.baseElevation.default(0), north: shape.site.shape.north.default('-z'), groundColor: shape.site.shape.groundColor.default('#61754b')}),
  buildings: z.array(building.omit({roofId: true, spaceHeight: true}).extend({
    role: building.shape.role.optional(), location,
    storeys: z.array(storey.extend({
      id: storey.shape.id.optional(), role: storey.shape.role.optional(), height: storey.shape.height.default(3.6),
      spaces: z.array(space.extend({id: space.shape.id.optional(), role: space.shape.role.optional(),
        footprint:space.shape.footprint.optional().describe('Legacy explicit geometry. With layout, omit this: boundaries are developed from the subdivision.'),
        size:roomSizeIntentSchema.optional(),
      })).min(1),
      layout:roomLayoutSchema.optional(),
    })).min(1).max(20),
    accessOpenings: z.array(accessOpening),
  })).min(1),
  features: z.array(feature.extend({role: feature.shape.role.optional(), location})).default([]),
  connections: z.array(connection.omit({surfaceId: true}).extend({id: connection.shape.id.optional(), waypoints: connection.shape.waypoints.default([])})).default([]),
  verticalCirculation: z.array(shape.verticalCirculation.element.omit({stairType:true, direction:true, turn:true, label:true, semanticRole:true})).default([]),
  requirements: shape.requirements.default([]),
  relationships: shape.relationships,
  roomAdjacencies: shape.roomAdjacencies.default([]).describe('Important same-storey conceptual access relationships. Zones must share a useful edge (aim for at least 0.8m); a corner, overlap or adjacency label does not make a passage. Detailed doors are deferred.'),
}).strict();

/** Advertise coordinated intent for NEW generation. The compatibility parser
 * below still accepts old paid responses and saved explicit room geometry. */
const authorBuilding=v3PlanAuthoringSchema.shape.buildings.element;
const authorStorey=authorBuilding.shape.storeys.element;
export const v3RelationshipPlanAuthoringSchema=v3PlanAuthoringSchema.extend({
  buildings:z.array(authorBuilding.extend({storeys:z.array(authorStorey.extend({
    layout:roomLayoutSchema,
    spaces:z.array(authorStorey.shape.spaces.element.omit({footprint:true}).required({id:true})).min(1),
  })).min(1).max(20)})).min(1),
});

// Also accept partial legacy documents without advertising their bookkeeping in
// the provider prompt. Explicit legacy intent always wins over derived defaults.
const compatibleInput = v3PlanAuthoringSchema.extend({
  character: shape.character.optional(), entrances: shape.entrances.optional(), program: shape.program.optional(),
  verticalCirculation: shape.verticalCirculation.default([]),
  zones: shape.zones, forms: shape.forms, considerations: shape.considerations, roomAdjacencies: shape.roomAdjacencies,
  buildings: z.array(v3PlanAuthoringSchema.shape.buildings.element.extend({roofId: building.shape.roofId.optional(), spaceHeight: building.shape.spaceHeight})).min(1),
  connections: z.array(connection.extend({id: connection.shape.id.optional(), surfaceId: connection.shape.surfaceId.optional(), waypoints: connection.shape.waypoints.default([])})).default([]),
});

export function expandPlanAuthoring(raw: unknown) {
  // Existing projects and fully authored plans retain exactly their semantics.
  const legacy = v3ArchitecturalPlanSchema.safeParse(raw);
  if (legacy.success) return legacy;
  const parsed = compatibleInput.safeParse(raw);
  if (!parsed.success) return parsed;
  const input = parsed.data;
  // Reserve every supplied identity before allocating any derived identity.
  const used = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string') used.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if ((key === 'id' || key === 'roofId' || key === 'surfaceId') && typeof item === 'string') used.add(item);
      else collect(item);
    }
  };
  collect(input);
  const allocate = (stem: string) => {
    const base = stem.slice(0, 56);
    let id = base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id); return id;
  };
  const layoutRequests:RoomLayoutRequest[]=[];
  const buildings = input.buildings.map(b => ({...b, role: b.role ?? b.label,
    roofId: b.roofId ?? allocate(`${b.id}-roof`),
    storeys: b.storeys.map((s, level) => {
      const {layout,...datum}=s,storeyId=s.id??allocate(`${b.id}-level-${level}`);
      const rooms=s.spaces.map((r,index)=>({...r,id:r.id??allocate(`${b.id}-room-${level}-${index}`),role:r.role??r.label}));
      if(layout)layoutRequests.push({storeyId,layout,spaces:rooms});
      return {...datum,id:storeyId,role:s.role??s.label,
        spaces:rooms.flatMap(({size,...r})=>{void size;return r.footprint?[{...r,footprint:r.footprint}]:[];})};
    }),
  }));
  const plan = {...input, character: input.character ?? input.concept, buildings,
    features: input.features.map(f => ({...f, role: f.role ?? f.label})),
    entrances: input.entrances ?? buildings.flatMap(b => b.accessOpenings.map(op => ({id: allocate(`${b.id}-${op.id}-entry`), objectId: b.id, openingId: op.id, level: op.floors === 'upper' ? 1 : 0}))),
    program: input.program ?? buildings.map(b => ({id: allocate(`${b.id}-program`), kind: 'building' as const, role: b.role, objectIds: [b.id], source: 'design' as const})),
    connections: input.connections.map((c, i) => ({...c, id: c.id ?? allocate(`connection-${i}`), surfaceId: c.surfaceId ?? allocate(`route-${i}`)})),
  };
  // Compact routes name the opening itself; canonical entrance IDs remain valid.
  // Resolve only a unique opening ID; ambiguity is left for existing diagnostics.
  for (const c of plan.connections) for (const endpoint of [c.from, c.to]) if (endpoint.kind === 'entrance' && !plan.entrances.some(e => e.id === endpoint.entranceId)) {
    const matches = plan.entrances.filter(e => e.openingId === endpoint.entranceId);
    if (matches.length === 1) endpoint.entranceId = matches[0].id;
  }
  // Missing geometry without an intent is a schema error, never a fabricated room.
  if(input.buildings.some(b=>b.storeys.some(s=>!s.layout&&s.spaces.some(r=>!r.footprint))))
    return {success:false as const,error:new z.ZodError([{code:'custom',path:['buildings'],message:'Every room needs either an explicit footprint or a storey layout.'}])};
  const canonical=v3ArchitecturalPlanSchema.safeParse(plan satisfies V3ArchitecturalPlan);
  if(!canonical.success)return canonical;
  const result=developRoomLayouts(canonical.data,layoutRequests);
  return {success:true as const,data:result.plan,roomPlanning:{...result,requests:layoutRequests}};
}
