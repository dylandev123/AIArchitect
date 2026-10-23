/** Offline source/fixture evidence; never imports the model adapter or reads credentials. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { v3PlanAuthoringSchema, expandPlanAuthoring } from '../src/lib/v3/architecturalPlanAuthoring';
import { preparePlanEvaluation, planEvaluationPrompt, checkoutPlanEvaluation } from '../src/lib/v3/architecturalPlanEvaluation';
import { v3ArchitecturalPlanSchema, splitV3ArchitecturalBlueprint, sameArchitecturalPlan } from '../src/lib/v3/architecturalPlanFirst';
import { planV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { deriveArchitecturalPlan } from '../src/lib/v3/architecturalPlanning';

globalThis.fetch=async()=>{throw Error('External network forbidden');};
const out='docs/architecture/architectural-blueprint-pipeline/plan-authoring';
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const before=read(`${out}/before-schema.json`);
const after=z.toJSONSchema(v3PlanAuthoringSchema,{io:'input',reused:'ref'});
const afterInline=z.toJSONSchema(v3PlanAuthoringSchema,{io:'input'});
const schemaCounts=(schema:unknown)=>{
  let properties=0,required=0,objects=0,alternatives=0;
  const visit=(s:unknown):void=>{
    if(!s||typeof s!=='object')return;
    if(Array.isArray(s)){s.forEach(visit);return;}
    const v=s as Record<string,unknown>;
    if(v.properties){properties+=Object.keys(v.properties).length;objects++;}
    if(Array.isArray(v.required))required+=v.required.length;
    for(const key of ['anyOf','oneOf'])if(Array.isArray(v[key]))alternatives+=v[key].length;
    Object.values(v).forEach(visit);
  };
  visit(schema);return {properties,required,objects,alternatives};
};
const values=(value:unknown):number=>Array.isArray(value)?value.reduce((s,v)=>s+values(v),0):value&&typeof value==='object'?Object.entries(value).reduce((s,[,v])=>s+1+values(v),0):0;
const payload=(value:unknown)=>({minifiedBytes:Buffer.byteLength(JSON.stringify(value)),fields:values(value),estimatedTokensAtFourChars:Math.ceil(JSON.stringify(value).length/4)});
const legacy=read('src/lib/v3/__tests__/fixtures/plan-first-estate.plan.json');
const compact=read('src/lib/v3/__tests__/fixtures/plan-authoring-estate.plan.json');
const checked=preparePlanEvaluation(compact),original=preparePlanEvaluation(legacy);
if(!checked.ok||!original.ok)throw Error('Fixture rejected');
const drawing=(scene:NonNullable<typeof checked.scene>,floor:number|null)=>{
  const d=deriveArchitecturalPlan(scene,null,floor);
  // IDs/ledgers are intentionally derived; all visible building and room polygons stay exact.
  return {buildings:d.buildings,rooms:d.rooms.map(({id,...r})=>{void id;return r;})};
};
const geometry=[null,0,1].map(floor=>({floor,equal:JSON.stringify(drawing(checked.scene!,floor))===JSON.stringify(drawing(original.scene!,floor))}));
if(geometry.some(g=>!g.equal))throw Error('2D geometry drift');
const histories=['2026-10-20','2026-10-21'].map(date=>{
  const file=`src/lib/v3/__tests__/fixtures/architectural-blueprint-live-${date}.json`,raw=readFileSync(file,'utf8'),bp=JSON.parse(raw);
  const full=planV3ArchitecturalBlueprint(bp,{buildFirst:true}),plan=preparePlanEvaluation(splitV3ArchitecturalBlueprint(bp).plan);
  const codes=(findings:typeof full.findings)=>Object.fromEntries([...new Set(findings.map(f=>f.code))].sort().map(code=>[code,findings.filter(f=>f.code===code).length]));
  return {file,sha256:sha(raw),buildings:bp.buildings.map((b:typeof legacy.buildings[number])=>({id:b.id,kind:b.plan.kind,storeys:b.storeys.length,rooms:b.storeys.reduce((sum:number,s:typeof b.storeys[number])=>sum+s.spaces.length,0)})),fullAccepted:full.ok,fullCodes:codes(full.findings),planAccepted:plan.ok,planCodes:codes(plan.findings),legacyExpansionIdentical:JSON.stringify(expandPlanAuthoring(splitV3ArchitecturalBlueprint(bp).plan))===JSON.stringify(v3ArchitecturalPlanSchema.safeParse(splitV3ArchitecturalBlueprint(bp).plan))};
});
const beforePrompt=readFileSync(`${out}/before-prompt.txt`,'utf8'),afterPrompt=planEvaluationPrompt();
writeFileSync(`${out}/after-prompt.txt`,afterPrompt);
const metrics={providerCalls:0,baseline:'Working tree at start of this task, not git HEAD',before:{schemaBytes:Buffer.byteLength(JSON.stringify(before)),schema: schemaCounts(before),requiredRoot:before.required,promptCharacters:beforePrompt.length,fixture:payload(legacy)},after:{schemaBytes:Buffer.byteLength(JSON.stringify(after)),schemaInlineBytes:Buffer.byteLength(JSON.stringify(afterInline)),schema:schemaCounts(afterInline),requiredRoot:after.required,promptCharacters:afterPrompt.length,fixture:payload(compact)},geometry,checkoutAfterReload:sameArchitecturalPlan(checked.scene!,checkoutPlanEvaluation(JSON.parse(JSON.stringify(checked.scene))).scene!),histories,estimateCaveat:'Character/4 estimates, not model tokenization or a prediction of natural response length. Fixture adaptation also removes optional intent ledgers; not all savings are construction bookkeeping.',fixtureProvenance:'Separately adapted offline Lantern Garden example, not a natural Terra response or runtime template.'};
writeFileSync(`${out}/metrics.json`,JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify(metrics,null,2));
