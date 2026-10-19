import { z } from 'zod';

const n = z.number().finite().positive(), unit = z.number().finite().min(0).max(1);
const common = { id: z.string().min(1).max(64).optional(), floors: z.enum(['all','ground','upper']).optional() };
const facade = z.enum(['north','east','south','west']), corner = z.enum(['nw','ne','se','sw']);
const span = { ...common, facade, start: unit, end: unit, depth: n, open: z.boolean().optional(), postSpacing: n.optional() };
const point = z.tuple([z.number().finite(),z.number().finite()]);
// Union-free segment wire format also works in the provider contract; exact fields validated below.
const segment = z.object({id:z.string().min(1).max(64),type:z.enum(['line','arc']),start:point.optional(),end:point.optional(),center:point.optional(),radius:n.min(.5).optional(),startAngle:z.number().finite().optional(),sweep:z.number().finite().min(-360).max(360).optional()}).strict();
const pathFields = {kind:z.enum(['articulated','outline']),segments:z.array(segment).min(1).max(64).optional()};
export const v3FootprintSchema = z.object({ ...pathFields, operations: z.array(z.discriminatedUnion('type', [
  z.object({ ...span, type: z.literal('recess') }).strict(),
  z.object({ ...span, type: z.literal('projection') }).strict(),
  z.object({ ...common, type: z.literal('notch'), corner, width: n, depth: n }).strict(),
  z.object({ ...common, type: z.literal('entry-recess'), facade, width: n, depth: n }).strict(),
  z.object({ ...common, type: z.literal('chamfer'), corner, size: n, glazed: z.boolean().optional() }).strict(),
])).max(64) }).strict().superRefine((f,ctx)=>{
 if(f.kind==='articulated' ? !!f.segments : !f.segments || f.operations.length>0)ctx.addIssue({code:'custom',message:'Use articulated operations or outline segments, exclusively.'});
 for(const s of f.segments??[]){
  if(s.type==='line' ? !s.start||!s.end||s.center!==undefined||s.radius!==undefined||s.startAngle!==undefined||s.sweep!==undefined : !s.center||!s.radius||s.startAngle===undefined||!s.sweep||s.start!==undefined||s.end!==undefined)ctx.addIssue({code:'custom',message:`Invalid ${s.type} segment ${s.id}.`});
 }
});
/** Provider schema avoids unions; ingestion validates the exact discriminated runtime contract. */
export const v3GenerationFootprintSchema=z.object({...pathFields,operations:z.array(z.object({
 ...common,type:z.enum(['recess','projection','notch','entry-recess','chamfer']),facade:facade.optional(),corner:corner.optional(),start:unit.optional(),end:unit.optional(),width:n.optional(),depth:n.optional(),size:n.optional(),open:z.boolean().optional(),postSpacing:n.optional(),glazed:z.boolean().optional(),
}).strict()).max(64)}).strict();
export type V3Footprint = z.infer<typeof v3FootprintSchema>;

