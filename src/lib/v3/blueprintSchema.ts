import { z } from 'zod';

const id = z.string().min(1).max(100);
const ids = z.array(id).refine(values => new Set(values).size === values.length, 'References must be unique');
/** An index into the SAME V3 scene, never a second collection of geometric objects. */
export const v3BlueprintSchema = z.object({
  version: z.literal(1),
  buildings: z.array(z.object({ id, objectId: id, role: z.string().min(1).max(600) }).strict()),
  entrances: z.array(z.object({ id, objectId: id, openingId: id, level: z.number().int().min(0).max(19) }).strict()),
  verticalCirculationIds: ids,
  roofObjectIds: ids,
  outdoorObjectIds: ids,
  routeIds: ids,
  /** Required program uses existing objects/rooms; no independent allocation rectangles. */
  allocations: z.array(z.object({ id, requirementId: id, objectIds: ids, roomIds: ids }).strict()
    .refine(value => value.objectIds.length + value.roomIds.length > 0, 'Allocate at least one object or room')),
}).strict().superRefine((blueprint, ctx) => {
  const entries = [...blueprint.buildings, ...blueprint.entrances, ...blueprint.allocations];
  if (new Set(entries.map(entry => entry.id)).size !== entries.length)
    ctx.addIssue({ code: 'custom', message: 'Blueprint semantic ids must be unique' });
  if (new Set(blueprint.buildings.map(entry => entry.objectId)).size !== blueprint.buildings.length)
    ctx.addIssue({ code: 'custom', message: 'Each building must have one blueprint entry' });
});
export type V3Blueprint = z.infer<typeof v3BlueprintSchema>;
