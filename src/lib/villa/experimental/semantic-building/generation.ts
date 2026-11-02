/** Experimental, dependency-injected Generate checkpoint. Never imported by production Generate.
 * No network/credential/database access. The caller supplies exactly one planning response. */
import {z} from 'zod';
import {normalizeSemanticIdentifiers,type IdentifierMapping} from './identifiers';
import {compileBuilding,reviseBuilding,DesignConflict} from './compiler';
import {validateScene,type ArchitecturalScene} from '../../scene/model';
const id=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const point=z.tuple([z.number().finite(),z.number().finite()]);
export const semanticIntentSchema=z.strictObject({
 version:z.literal('semantic-pilot-1'),id,thesis:z.string().min(1),
 frame:z.strictObject({origin:point,yaw:z.number().finite()}),
 levels:z.array(z.strictObject({id,top:z.number().finite()})).min(1).max(12),
 masses:z.array(z.strictObject({id,role:z.string(),relatesTo:id.optional()})).min(1).max(100),
 spaces:z.array(z.strictObject({id,mass:id,level:id,use:z.string(),polygon:z.array(point).min(3).max(32),height:z.number().finite(),outdoor:z.boolean().optional(),roof:z.boolean().optional(),material:z.enum(['ivory','limestone','timber','bronze','sage']).optional()})).min(1).max(200),
 portals:z.array(z.strictObject({id,host:z.strictObject({space:id,edge:z.number().int().nonnegative()}),to:id,offset:z.number().finite(),width:z.number().finite(),height:z.number().finite(),mode:z.enum(['door','open','window'])})).max(300),
 stairs:z.array(z.strictObject({id,lower:id,upper:id,start:point,width:z.number().finite(),run:z.number().finite(),risers:z.number().int(),landing:z.number().finite(),headroom:z.number().finite(),bypass:z.literal('right')})).max(20),
 arrival:id,requiredAccess:z.array(id).min(1).max(200),
});
export const semanticProposalSchema=z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('proposed'),intent:semanticIntentSchema,limitations:z.array(z.string())}),
 z.strictObject({status:z.literal('decision-required'),decisions:z.array(z.string()).min(1)}),
]);
export const SEMANTIC_PLANNING_INSTRUCTIONS=`Design architecture from the user's brief, not a fixture. Return a semantic proposal, never scene operations or individually placed walls, panels, slabs or treads.
Use stable identifiers beginning with a lowercase ASCII letter, followed by lowercase letters, digits or hyphens (maximum 40 characters). IDs are unique across entity types; every reference must identify a declared entity of the correct type. Portal offsets are metres from the start of the selected host edge, not fractions.
Choose concept, composition, unequal mass hierarchy, uses, privacy, circulation, arrival sequence, levels, selected convex counterclockwise space polygons in a shared building frame, heights, materials, roofs, portal hosts/offsets and stair flight intent. Coordinates for chosen space outlines remain architectural decisions; adjacency alone cannot choose a layout. Mass relatesTo is narrative, not a placement constraint.
Software derives one wall per full shared edge, floor profiles at level tops, hosted cuts and matching door transforms, connected thresholds, stair treads, upper floor void and landing geometry, world rotation and source bindings. Do not independently calculate these component centres.
Supported: strictly convex straight polygons including angled/tapered cells; exact complete coincident edges at one level; one sill-zero portal per edge between represented cells (outdoor cells for external doors/windows); separate flat polygon roofs without eaves; ascending straight +local-Z flight with explicit right bypass, landing and full void in matching upper/lower stair cells. Lower stair height equals floor-top difference; upper roof required, lower roof absent. Choose stair dimensions and positions; do not ask software to invent them. Thresholds need walking clearance; fixed glazing is not access. Every interior space must be requiredAccess and reachable from selected arrival.
Unsupported: partial shared edges/collinear segmentation, concave or curved cells, multiple openings per edge, ordinary elevated-sill facade windows, pitched/overhanging roofs, arbitrary stair directions, guards, terrain/site grading, pools/planting and full fit-out. Do not omit requested features silently or substitute a simpler house. If the requested architecture needs unsupported features, return decision-required explaining each required choice. limitations must disclose unresolved construction and visual scope. Do not claim a complete or premium home based on coordination. No presets or required room counts.`;
export type PlanningRequest={brief:string;system:string;schema:typeof semanticProposalSchema};
export type SemanticSession={version:'semantic-generation-1';brief:string;proposal:Extract<z.infer<typeof semanticProposalSchema>,{status:'proposed'}>;compiled:ReturnType<typeof compileBuilding>;scene:ArchitecturalScene;inputEvidence?:{response:unknown;identifierMappings:IdentifierMapping[]}};
export type GenerationOutcome={status:'ready';session:SemanticSession}|{status:'decision-required';decisions:string[];response:unknown};
export async function generateSemantic(brief:string,planner:(request:PlanningRequest)=>Promise<unknown>):Promise<GenerationOutcome>{
 if(!brief.trim())throw Error('Provide a design brief.');
 const response=await planner({brief,system:SEMANTIC_PLANNING_INSTRUCTIONS,schema:semanticProposalSchema});
 return constructSemantic(brief,response);
}
export function constructSemantic(brief:string,response:unknown):GenerationOutcome{
 let normalized:ReturnType<typeof normalizeSemanticIdentifiers>;
 try{normalized=normalizeSemanticIdentifiers(response);}catch(error){return {status:'decision-required',decisions:[(error as Error).message],response};}
 const parsed=semanticProposalSchema.safeParse(normalized.response);
 if(!parsed.success)return {status:'decision-required',decisions:parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`),response};
 if(parsed.data.status==='decision-required')return {...parsed.data,response};
 const proposal=parsed.data;
 const omitted=proposal.intent.spaces.filter(s=>!s.outdoor&&!proposal.intent.requiredAccess.includes(s.id));
 if(omitted.length)return {status:'decision-required',decisions:omitted.map(s=>`${s.id}: include every interior allocation in requiredAccess; do not hide unconnected rooms.`),response};
 try{
  const compiled=compileBuilding(proposal.intent),scene=validateScene({...compiled.scene,generationBrief:brief});
  return {status:'ready',session:{version:'semantic-generation-1',brief,proposal,compiled,scene,inputEvidence:{response:structuredClone(response),identifierMappings:normalized.mappings}}};
 }catch(error){if(!(error instanceof DesignConflict))throw error;return {status:'decision-required',decisions:error.decisions,response};}
}
export function reviseSemantic(previous:SemanticSession,response:unknown,current=previous.scene){
 const outcome=constructSemantic(previous.brief,response);if(outcome.status!=='ready')return outcome;
 // Topology identity changes need human migration decisions, not unattended overwrite.
 if(JSON.stringify(previous.proposal.intent.spaces.map(s=>[s.id,s.polygon.length]))!==JSON.stringify(outcome.session.proposal.intent.spaces.map(s=>[s.id,s.polygon.length])))
  return {status:'decision-required' as const,decisions:['Space topology changed; explicit identity migration required.'],response};
 try{const tx=reviseBuilding(previous.compiled,outcome.session.proposal.intent,current);
 return {status:'ready' as const,session:{...outcome.session,scene:validateScene({...tx.scene,generationBrief:previous.brief})},operations:tx.operations};
 }catch(error){if(!(error instanceof DesignConflict))throw error;return {status:'decision-required' as const,decisions:error.decisions,response};}
}
export function restoreSemantic(serialized:string):SemanticSession{
 const raw=JSON.parse(serialized);if(raw.version!=='semantic-generation-1')throw Error('Unsupported semantic session version.');
 const outcome=constructSemantic(z.string().parse(raw.brief),raw.proposal);
 if(outcome.status!=='ready')throw new DesignConflict(outcome.decisions);
 // Recompute trusted compiler bindings; preserve explicit editable scene independently.
 return {...outcome.session,...(raw.inputEvidence?{inputEvidence:raw.inputEvidence}:{}),scene:validateScene(raw.scene)};
}
