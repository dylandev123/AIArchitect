import { z } from 'zod';
import { footprintSchema, validateFootprint, footprintFacadeBays } from '../footprint';
import { executeCompositionPatch, type VillaComposition } from '../composition';
import { inspectCapture } from '../visual-review';

/** Architecture candidates are immutable, portable data snapshots of the proven
 * enclosed-building grammar. Ribbon candidates and their stored versions are unchanged. */
export const architectureCandidateSchema=z.object({
 schemaVersion:z.literal(1),kind:z.literal('enclosed-architecture'),
 id:z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),version:z.number().int().min(1),
 status:z.enum(['experimental','reviewed']),intent:z.string().min(1).max(4000),
 form:footprintSchema,
 evidence:z.array(z.object({view:z.enum(['Aerial','Arrival','Poolside']),image:z.string().max(6000000)}).strict()).max(3),
}).strict();
export type ArchitectureCandidate=z.infer<typeof architectureCandidateSchema>;
export function validateArchitectureCandidate(input:unknown){
 const c=architectureCandidateSchema.parse(input);validateFootprint(c.form);
 if(footprintFacadeBays(c.form)>300)throw Error('Architecture exceeds the facade budget.');
 if(c.form.x!==0||c.form.z!==0||c.form.orientation!==0)throw Error('Reusable architecture must use a local origin; placement belongs to the destination.');
 c.evidence.forEach(e=>inspectCapture(e.image));
 if(c.status==='reviewed'&&new Set(c.evidence.map(e=>e.view)).size!==3)throw Error('Reviewed architecture requires three captured exterior views.');
 return c;
}
export function architectureCandidateDraft(form:unknown,intent:string,previous?:ArchitectureCandidate){
 const f=footprintSchema.parse(form);if(previous)validateArchitectureCandidate(previous);
 return validateArchitectureCandidate({schemaVersion:1,kind:'enclosed-architecture',id:previous?.id??f.id,version:(previous?.version??0)+1,status:'experimental',intent,form:{...f,x:0,z:0,orientation:0},evidence:[]});
}
/** Same atomic executor and site/collision checks used by Terra; no generated code. */
export function previewArchitectureCandidate(input:unknown,current:VillaComposition,placement:{id:string;x:number;z:number;orientation:number}){
 const c=validateArchitectureCandidate(input);
 return executeCompositionPatch(current,{forms:[{type:'put',form:{...c.form,...placement}}]});
}
