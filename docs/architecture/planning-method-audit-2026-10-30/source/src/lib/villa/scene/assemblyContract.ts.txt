import {z} from 'zod';
// Independent of the executor to keep the provider/runtime contract identical.
const id=z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);
const at=z.array(z.number().finite().min(-10000).max(10000)).length(3);
const material=z.enum(['ivory','limestone','timber','bronze','sage']);
export const wingAssemblySchema=z.object({
 id,at,rotation:z.number().finite().min(-10000).max(10000).default(0),
 width:z.number().min(4).max(40),depth:z.number().min(4).max(30),
 height:z.number().min(2.4).max(12),bays:z.number().int().min(1).max(8),
 bayWidths:z.array(z.number().min(.91).max(40)).min(1).max(8).optional(),material:material.default('ivory'),
 roofForm:z.enum(['flat','gable','hip']),roofRise:z.number().min(.6).max(5),overhang:z.number().min(0).max(3),
 entryBay:z.number().int().min(0).max(7).nullable().default(null),
}).strict().superRefine((p,c)=>{if(p.bayWidths&&(p.bayWidths.length!==p.bays||Math.abs(p.bayWidths.reduce((a,b)=>a+b,0)-p.width)>1e-6))c.addIssue({code:'custom',message:'Selected bayWidths must match bays and sum to width.'});if(p.width/p.bays<=.9)c.addIssue({code:'custom',message:'Wing bays must exceed .9m.'});if(p.entryBay!==null&&p.entryBay>=p.bays)c.addIssue({code:'custom',message:'entryBay must identify an existing bay.'});});
export const poolAssemblySchema=z.object({id,at,rotation:z.number().finite().default(0),width:z.number().min(2).max(30),depth:z.number().min(2).max(30),basinDepth:z.number().min(.5).max(3),material:material.default('limestone')}).strict();
// Interior helpers take an explicitly selected base datum, optionally in a floor's
// local frame. They never choose rooms, floor areas, adjacency or accommodation.
const placement = {id, at, parent:id.optional(), rotation:z.number().finite().default(0), material:material.default('ivory')};
export const doorwayAssemblySchema=z.object({...placement,
 width:z.number().min(.8).max(40),height:z.number().min(2).max(12),thickness:z.number().min(.08).max(.6),
 openingX:z.number().finite(),openingWidth:z.number().min(.6).max(5),openingHeight:z.number().min(1.8).max(5),
}).strict().superRefine((p,c)=>{
 if(Math.abs(p.openingX)+p.openingWidth/2>p.width/2 || p.openingHeight>p.height)
  c.addIssue({code:'custom',message:'Door opening must fit the selected partition.'});
});
/** Selected facade segment: base datum, real cut, independently editable infill. */
export const facadeBayAssemblySchema=z.object({...placement,
 width:z.number().min(.8).max(40),height:z.number().min(2).max(12),thickness:z.number().min(.08).max(.6),
 openingX:z.number().finite(),sill:z.number().min(0).max(10),
 openingWidth:z.number().min(.6).max(20),openingHeight:z.number().min(.4).max(10),
 infill:z.enum(['glazing','entrance']),panels:z.number().int().min(1).max(40).default(4),
}).strict().superRefine((p,c)=>{
 if(Math.abs(p.openingX)+p.openingWidth/2>p.width/2 || p.sill+p.openingHeight>p.height)
  c.addIssue({code:'custom',message:'Facade opening must fit the selected wall.'});
 if(p.infill==='entrance' && (p.sill!==0 || p.openingHeight<1.8))
  c.addIssue({code:'custom',message:'Facade entrance needs sill zero and at least 1.8m opening height.'});
});
export const kitchenRunAssemblySchema=z.object({...placement,
 length:z.number().min(.6).max(12),depth:z.number().min(.4).max(1.2),height:z.number().min(.7).max(1.1),
 units:z.number().int().min(1).max(12),
}).strict().superRefine((p,c)=>{if(p.length/p.units<.3)c.addIssue({code:'custom',message:'Kitchen units must be at least .3m wide.'});});
export const straightStairAssemblySchema=z.object({...placement,
 width:z.number().min(.8).max(4),rise:z.number().min(.1).max(6),run:z.number().min(.3).max(20),
 risers:z.number().int().min(1).max(40),
}).strict().superRefine((p,c)=>{
 if(p.rise/p.risers>.2 || p.run/p.risers<.25)
  c.addIssue({code:'custom',message:'Select risers/run with rise <= .2m and tread depth >= .25m; no automatic resizing.'});
});
export const assemblySchema=z.union([
 z.object({kind:z.literal('residential-wing'),parameters:wingAssemblySchema}).strict(),
 z.object({kind:z.literal('rectangular-pool'),parameters:poolAssemblySchema}).strict(),
 z.object({kind:z.literal('facade-bay'),parameters:facadeBayAssemblySchema}).strict(),
 z.object({kind:z.literal('doorway'),parameters:doorwayAssemblySchema}).strict(),
 z.object({kind:z.literal('kitchen-run'),parameters:kitchenRunAssemblySchema}).strict(),
 z.object({kind:z.literal('straight-stair'),parameters:straightStairAssemblySchema}).strict(),
]);
