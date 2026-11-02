/** Offline evidence only; never calls a provider or constructs a house. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {designProposalSchema,validateDesignProposal,reviewDesignFidelity} from '../src/lib/villa/scene/designProposal';
import {validateScene} from '../src/lib/villa/scene/model';
import {sceneSpatialGeometry,spatialCoordinationFindings} from '../src/lib/villa/scene/spatial';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
const dir='docs/architecture/design-first/sol-planning-comparison-2026-10-30';
const baseline='docs/architecture/design-first/live-after-rehearsal-2026-10-30';
globalThis.fetch=async()=>{throw Error('Network prohibited in offline review');};
const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
// These are derived audits; exact provider evidence is never rewritten.
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,JSON.stringify(v,null,2)+'\n');
const sourceHashes=JSON.parse(readFileSync(`${baseline}/source-hashes.json`,'utf8'));
for(const name of ['spatial','model'])assert.equal(hash(readFileSync(`src/lib/villa/scene/${name}.ts`)),sourceHashes[`src/lib/villa/scene/${name}.ts`]);
const schema=await strictSceneResponseSchema(designProposalSchema);
const results=await Promise.all(['terra','sol'].map(async model=>{
 const text=readFileSync(`${dir}/${model}.proposal.exact.txt`,'utf8');
 const parsed=await schema.validate!(JSON.parse(text));
 assert(typeof parsed!=='boolean'&&parsed.success);
 const p=parsed.value as ReturnType<typeof designProposalSchema.parse>;
 const geometry=validateScene({version:'architectural-scene-1',name:'OFFLINE anchor bounds; NOT a constructed mansion',elements:p.anchors.map(a=>({id:a.id,label:a.id,kind:a.kind,at:a.centre,size:a.size,rotation:a.yaw,material:a.material,panels:a.panels,...(a.color?{color:a.color}:{}),...(a.geometry?{geometry:a.geometry}:{}),...(a.opening?{opening:a.opening}:{}),...(a.roofForm?{roofForm:a.roofForm}:{}),...(a.overhang!==null?{overhang:a.overhang}:{})}))});
 const g=sceneSpatialGeometry(geometry);
 let error='';try{validateDesignProposal(p);}catch(e){error=String(e);}
 const findings=spatialCoordinationFindings({...geometry,architecturalPlan:{spatialRelationships:p.relationships}});
 const fidelity=reviewDesignFidelity(geometry,p);
 const legacyOverheadKindMismatches=p.spaces.flatMap(s=>s.roofIds.filter(id=>g.map.get(id)?.kind!=='roof').map(id=>({space:s.id,id,kind:g.map.get(id)?.kind})));
 const result={model,outputHash:hash(text),schemaParsed:true,anchors:p.anchors.length,spaces:p.spaces.length,routes:p.routes.length,relationships:p.relationships.length,currentSemanticValidationError:error,baselineOverheadKindMismatches:legacyOverheadKindMismatches,baselineSemanticValidationPassed:!error&&!legacyOverheadKindMismatches.length,findings,fidelity,
 relationshipMetrics:p.relationships.map(r=>{const a=g.map.get(r.subject),b=g.map.get(r.target);return {...r,...(a&&b?{planSeparation:g.separation(a,b),subjectBottom:g.bottom(a),subjectTop:g.top(a),targetBottom:g.bottom(b),targetTop:g.top(b)}:{missingAnchor:true})};}),
 missingInteriorAccess:p.spaces.filter(s=>s.environment==='interior'&&!s.accessIds.length).map(s=>s.id),
 anchorTable:p.anchors.map(a=>({id:a.id,kind:a.kind,role:a.role,centre:a.centre,size:a.size,yaw:a.yaw,profile:!!a.geometry,opening:a.opening,designReason:a.designReason})),
 spaces:p.spaces,routesDetail:p.routes,constructionCalls:0,constructedScene:false};
 save(`${model}.offline-audit.json`,result);
 save(`${model}.proposal.parsed.json`,p);
 return result;
}));
assert.equal(results[0].findings.filter(f=>f.code==='spatial-intent-mismatch').length,6);
save('offline-validation.json',{paidRequests:0,spatialAndModelSourcesByteIdenticalToTerraRun:true,method:'Same production wire normalization, spatial/model/fidelity checks on both exact outputs. Null optional profile holes are normalized by the existing SDK schema adapter, not repaired. Current proposal validator adds only previously documented plate-overhead acceptance and schema descriptions; baseline roof-only mismatch list retained separately for both. No repaired geometry.',results:results.map(r=>({model:r.model,anchors:r.anchors,spaces:r.spaces.length,routes:r.routes,relationships:r.relationships,baselineSemanticValidationPassed:r.baselineSemanticValidationPassed,spatialMismatches:r.findings.filter(f=>f.code==='spatial-intent-mismatch').length,missingInteriorAccess:r.missingInteriorAccess,spaceBoundMismatches:r.fidelity.spaceEvidence.filter(s=>s.status==='bounds-mismatch').length}))});
console.log(readFileSync(`${dir}/offline-validation.json`,'utf8'));
