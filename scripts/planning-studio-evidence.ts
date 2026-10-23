/** Offline fixtures for production-workspace inspection. Never edits original evidence or real project storage. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { planningStudioBlueprint } from '../src/lib/v3/parity/planningStudio';
import { compileV3Scene, type V3Scene } from '../src/lib/v3/scene';
import { deriveArchitecturalPlan } from '../src/lib/v3/architecturalPlanning';

globalThis.fetch=async()=>{throw Error('Network forbidden during offline studio evidence.');};
const out=process.argv[2]??'/tmp/architectural-planning-studio';mkdirSync(out,{recursive:true});
const fixtures=[];
for(const source of ['2026-10-20','2026-10-21','improved']) {
  const file=source==='improved'?undefined:`src/lib/v3/__tests__/fixtures/architectural-blueprint-live-${source}.json`;
  const original=file?readFileSync(file,'utf8'):JSON.stringify(planningStudioBlueprint());
  const plan=planV3ArchitecturalBlueprint(JSON.parse(original),{buildFirst:true}),built=plan.approval&&constructV3ArchitecturalBlueprint(plan.approval);
  if(!built?.ok||!built.scene)throw Error(`${source}: ${JSON.stringify(built?built.findings:plan.findings)}`);
  const scene:V3Scene=built.scene,start=performance.now(),model=compileV3Scene(scene),compileMs=performance.now()-start;
  const drawings=[];
  for(const floor of [null,0,1]){const start=performance.now(),drawing=deriveArchitecturalPlan(scene,model,floor);drawings.push({floor,deriveMs:performance.now()-start,rooms:drawing.rooms.length,parts:drawing.parts.length,segments:drawing.parts.reduce((s,p)=>s+p.paths.length,0)});}
  const root={version:3,generationMode:'v3-scene',v3Scene:scene};
  writeFileSync(`${out}/${source}.json`,JSON.stringify(root));
  fixtures.push({id:source,path:`${out}/${source}.json`,originalPath:file??'src/lib/v3/parity/planningStudio.ts',originalSha256:createHash('sha256').update(original).digest('hex'),outcome:built.outcome,objects:scene.objects.length,primitives:model.primitives.length,compileMs,drawings});
}
writeFileSync(`${out}/manifest.json`,JSON.stringify({providerCalls:0,fixtures},null,2)+'\n');
console.log(JSON.stringify({out,fixtures},null,2));
