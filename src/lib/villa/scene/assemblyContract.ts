import {z} from 'zod';
// Independent of the executor to keep the provider/runtime contract identical.
const id=z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);
const at=z.array(z.number().finite().min(-10000).max(10000)).length(3);
const material=z.enum(['ivory','limestone','timber','bronze','sage']);
export const wingAssemblySchema=z.object({
 id,at,rotation:z.number().finite().min(-10000).max(10000).default(0),
 width:z.number().min(4).max(40),depth:z.number().min(4).max(30),
 height:z.number().min(2.4).max(12),bays:z.number().int().min(1).max(8),material:material.default('ivory'),
 roofForm:z.enum(['flat','gable','hip']),roofRise:z.number().min(.6).max(5),overhang:z.number().min(0).max(3),
 entryBay:z.number().int().min(0).max(7).nullable().default(null),
}).strict().superRefine((p,c)=>{if(p.width/p.bays<=.9)c.addIssue({code:'custom',message:'Wing bays must exceed .9m.'});if(p.entryBay!==null&&p.entryBay>=p.bays)c.addIssue({code:'custom',message:'entryBay must identify an existing bay.'});});
export const poolAssemblySchema=z.object({id,at,rotation:z.number().finite().default(0),width:z.number().min(2).max(30),depth:z.number().min(2).max(30),basinDepth:z.number().min(.5).max(3),material:material.default('limestone')}).strict();
export const assemblySchema=z.union([
 z.object({kind:z.literal('residential-wing'),parameters:wingAssemblySchema}).strict(),
 z.object({kind:z.literal('rectangular-pool'),parameters:poolAssemblySchema}).strict(),
]);
