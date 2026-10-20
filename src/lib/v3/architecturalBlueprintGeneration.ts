import { z } from 'zod';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint, v3ArchitecturalBlueprintSchema, type V3ArchitecturalBlueprint } from './architecturalBlueprint';
import type { V3BlueprintFinding } from './blueprint';
import { reviewV3Architecture } from './designReview';
import type { V3Scene } from './scene';

/** Server-owned opt-in for NEW flat-site generations. No saved-scene migration. */
export const v3ArchitecturalBlueprintEnabled = (flag:string|undefined, terrain:'flat'|'advanced') => flag==='1' && terrain==='flat';

const instructions=`You are Terra, the architect. Author ONE complete independent architectural blueprint as JSON, format v3-architectural-blueprint-1. Architectural decisions are authored once in this document. V3 deterministically constructs the approved design; there is no detailed-scene authoring call.
Resolve the user's actual brief: concept, style, estate arrangement, all buildings, footprints, storeys, major functional spaces, private/service partitions and doors where needed, entrances, circulation, compatible roofs, outdoor living, access and materials. Choose the composition creatively. No fixed architectural template, mandatory amenity, pool, style or building count exists. Empty collections mean intentionally absent. Never invent an amenity to fill an array. Do not omit requested architecture to pass validation. Missing design decisions and unsupported features are reported, not inferred by construction.
Metres; world north=-Z, east=+X, yaw in radians. Site is flat at datum 0. Each building owns location, footprint, ordered uniform-height storeys/spaces and roof intent. Outline envelopes and roof placement are derived: never repeat them. Clockwise connected line/arc segments preserve curved and unusual architecture; no holes, variable per-storey outlines, spline walls, overlapping curved masses or stacked hosts in this contract. Rectangular major spaces must fit the real outline. Every building needs an explicit ground entrance and program entry. Facade openings must be explicit (use [] for intentionally solid walls); a label never constructs a room, opening, equipment or vegetation. MainEntry references a ground door. The primary building finish supplies walls/assembly slabs; posts/beams use existing dark trim and rails existing glass. Bespoke part finishes are unsupported.
Each mass has one roof: flat/floating-flat/terrace pitch 0, mono-pitch/hip/gable/butterfly pitch 1..60 degrees. Nonrectangular hosts support only flat, floating-flat, terrace or mono-pitch. Never replace requested unsupported roofs; retain the requested family in roof.form for an honest capability diagnostic.
Assemblies are nested in facade: explicit slabs/posts/beams/rails address facade fractions, local levels/elevations, and segmentId for ALL line/arc hosts. Rail slabId is local to its assembly. Balconies need a door on that level serving that assembly. V3 derives their world geometry from their host. Do not author meshes or world coordinates for facade parts.
Features support terrace, courtyard (perimeter ring, not solid paving), pool, landscape-zone (grass cover only) and canopy (explicit canopyStyle solid/slatted). Courtyard material must be paving #b8ad98 roughness .74 and thickness >=.14; groundcover grass roughness .9 and thickness >=.12. Canopies require >=1m spans and >=2.2m height. Pool material is water; existing shell/coping policy is fixed. Terrace railing/open edges are explicit optional construction parameters. No automatic pool equipment, trees or furniture.
Connections reference an entrance, named site access, or an explicit contact in a named dry surface's local frame. Width/use and every obstacle-avoiding bend are your decisions; V3 derives contact points, route ribbon and owner bounds. Never repeat gate/entrance coordinates as path boxes. Site access chooses a boundary point once. Surface endpoints support terraces/courtyard/landscape only; canopies require a separate dry surface if access is intended. Finished-floor steps/ramps from estate routes are unsupported; horizontal contact is not flush threshold certification.
Stairs/lifts need explicit host-local reservations and served levels; choose type/direction/turn, fit their treads/landings and preserve room access. Room names do not generate walls; partitions and doors must reference actual room boundaries. All stable ids/references must resolve. Requirements distinguish user obligations from design choices. Preserve unsupported intent and report missing necessary decisions, never silently simplify.
Interior door records construct rectangular cutouts in explicit solid/glazed/screen partitions, without door leaves or hardware. Arched cutouts are unsupported. Exterior doors must be facade openings; a door on an open or exterior-wall partition is not constructed. Opening heights, sills and spans must fit without builder clipping; overlapping openings are contradictions, not permission to merge or substitute them.
Return only the blueprint matching the following JSON schema. Do NOT return objects, runtime transforms, a complete V3 scene, independent roof coordinates, duplicate route geometry or a V2 document. The application validates completeness BEFORE elaboration.
`;

let promptCache:string|undefined;
/** The exact input schema is transmitted in JSON mode; provider strict-schema union support is not assumed. */
export function v3ArchitecturalBlueprintPrompt():string {
  return promptCache??=instructions+JSON.stringify(z.toJSONSchema(v3ArchitecturalBlueprintSchema));
}

const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const STAIR_REPAIR=new Set(['CIRCULATION_NOT_USABLE','CIRCULATION_OUTSIDE_HOST','STAIR_APPROACH_UNSUPPORTED','STAIR_ACCESS_BLOCKED','STAIR_OPENING_BLOCKED']);
const ROUTE_REPAIR=new Set(['ESTATE_ROUTE_BLOCKED','ESTATE_POOL_CROSSING','ESTATE_ACCESS_DISCONNECTED']);

/** Narrow existing objective-repair budget: no missing program/roof/amenity/layout is ever invented. */
function repairTargets(bp:V3ArchitecturalBlueprint,findings:V3BlueprintFinding[]) {
  const stairs=new Set<string>(),routes=new Set<string>();
  for(const f of findings.filter(f=>f.severity==='fatal')){
    if(f.code==='BLUEPRINT_VERTICAL')continue; // checked below against a diagnosed unusable stair in that host
    const stair=STAIR_REPAIR.has(f.code)&&bp.verticalCirculation.find(c=>f.targetIds.includes(c.id));
    const route=ROUTE_REPAIR.has(f.code)&&bp.connections.find(c=>f.targetIds.includes(c.id)||f.targetIds.includes(c.surfaceId));
    if(stair)stairs.add(stair.id);else if(route)routes.add(route.id);else return;
  }
  if(findings.some(f=>f.severity==='fatal'&&f.code==='BLUEPRINT_VERTICAL'&&!bp.verticalCirculation.some(c=>stairs.has(c.id)&&f.targetIds.includes(c.hostMassId))))return;
  return stairs.size||routes.size?{stairs,routes}:undefined;
}

export function assessV3ArchitecturalBlueprintRepair(before:unknown,after:unknown,findings:V3BlueprintFinding[]):boolean {
  const a=v3ArchitecturalBlueprintSchema.safeParse(before),b=v3ArchitecturalBlueprintSchema.safeParse(after);
  if(!a.success||!b.success)return false;
  const targets=repairTargets(a.data,findings);if(!targets)return false;
  const strip=(bp:V3ArchitecturalBlueprint)=>({...bp,
    verticalCirculation:bp.verticalCirculation.map(c=>{if(!targets.stairs.has(c.id))return c;const {footprint,stairType,direction,turn,...protectedFields}=c;void footprint;void stairType;void direction;void turn;return protectedFields;}),
    connections:bp.connections.map(c=>{if(!targets.routes.has(c.id))return c;const {waypoints,...protectedFields}=c;void waypoints;return protectedFields;}),
  });
  return stable(strip(a.data))===stable(strip(b.data));
}

export interface V3ArchitecturalAuthorRequest { repair?:{blueprint:unknown;findings:V3BlueprintFinding[]}; }
export interface V3ArchitecturalAuthorResponse { output:unknown; finishReason?:string; }
export interface V3ArchitecturalGenerationResult { ok:boolean; attempts:number; phase:'planning'|'construction'|'brief'|'repair'|'output'; findings:V3BlueprintFinding[]; scene?:V3Scene; }

/** One authoring call; ONLY the existing one bounded objective follow-up, never an elaboration call. */
export async function generateV3FromArchitecturalBlueprint(brief:string,author:(request:V3ArchitecturalAuthorRequest)=>Promise<V3ArchitecturalAuthorResponse>):Promise<V3ArchitecturalGenerationResult>{
  // Known explicit capability gaps must not disappear merely because a model omits
  // them from its requirement ledger. This bounded vocabulary is not general NLU.
  const unsupported=[...brief.matchAll(/\b(mansard|gambrel|sawtooth|barrel[- ]vault|dome|hyperbolic)\b/gi)].filter(m=>! /\b(no|not|without|exclude|excluding|avoid)\s+(?:\w+\s+){0,3}$/i.test(brief.slice(Math.max(0,m.index!-50),m.index)));
  if(unsupported.length)return {ok:false,attempts:0,phase:'brief',findings:unsupported.map(m=>({code:'ARCHITECTURAL_BRIEF_CAPABILITY',severity:'fatal',targetIds:['brief'],message:`Requested ${m[0]} architecture has no supported construction in this blueprint contract. Preserve the decision; no substitute is generated.`}))};
  let repair:V3ArchitecturalAuthorRequest['repair'];
  for(let attempts=1;attempts<=2;attempts++){
    const result=await author({repair});
    if(result.finishReason==='length')return {ok:false,attempts,phase:'output',findings:[{code:'V3_OUTPUT_TRUNCATED',severity:'fatal',targetIds:['blueprint'],message:'Blueprint reached its output limit; no incomplete design is constructed or retried.'}]};
    if(result.finishReason!==undefined&&result.finishReason!=='stop')return {ok:false,attempts,phase:'output',findings:[{code:'ARCHITECTURAL_OUTPUT_INCOMPLETE',severity:'fatal',targetIds:['blueprint'],message:'Provider did not complete blueprint authoring normally; no candidate is constructed or retried.'}]};
    if(repair&&!assessV3ArchitecturalBlueprintRepair(repair.blueprint,result.output,repair.findings))return {ok:false,attempts,phase:'repair',findings:[{code:'ARCHITECTURAL_REPAIR_SCOPE',severity:'fatal',targetIds:['blueprint'],message:'Repair changed protected design decisions. No scene is returned.'}]};
    const plan=planV3ArchitecturalBlueprint(result.output);
    const built=plan.approval?constructV3ArchitecturalBlueprint(plan.approval):undefined;
    const phase=built?'construction' as const:'planning' as const,findings=[...plan.findings,...(built?.findings??[])];
    if(built?.ok&&built.scene){
      // Reuse independent brief review, without granting it another creative revision call.
      const review=reviewV3Architecture(built.scene,{brief});
      const missing=review.diagnostics.filter(d=>d.code==='MISSING_REQUESTED_FEATURE'||d.code==='UNSUPPORTED_ARCHITECTURAL_INTENT');
      if(missing.length)return {ok:false,attempts,phase:'brief',findings:[...findings,...missing.map(d=>({code:d.code,severity:'fatal' as const,targetIds:d.targetIds,message:d.message}))]};
      return {ok:true,attempts,phase,findings,scene:built.scene};
    }
    const parsed=v3ArchitecturalBlueprintSchema.safeParse(result.output);
    if(attempts===2||!parsed.success||!repairTargets(parsed.data,findings))return {ok:false,attempts,phase,findings};
    repair={blueprint:structuredClone(result.output),findings:findings.filter(f=>f.severity==='fatal')};
  }
  throw new Error('Unreachable bounded blueprint attempt.');
}
