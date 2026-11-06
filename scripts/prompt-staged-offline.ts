/** Zero provider imports/calls and no database access. Authored mocks, never AI-quality evidence. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MOCK_BRIEFS,PromptMockDesigner} from '@/lib/villa/staged/promptMocks';
import {advancePromptRun,promptInput,type PromptRun} from '@/lib/villa/staged/promptGeneration';
import {allRooms} from '@/lib/villa/staged/layout';
import {loadHouse} from '@/lib/villa/staged/save';
const dir='docs/architecture/prompt-staged-generation';mkdirSync(dir,{recursive:true});
const summary=[];
for(const [index,brief] of MOCK_BRIEFS.entries()){
 const name=['compact','spanish','estate'][index];
 const run:PromptRun={input:promptInput.parse({brief})},designer=new PromptMockDesigner(brief);
 let out;
 for(let stage=1;stage<=5;stage++){
  out=await advancePromptRun(run,designer);
  if(out.findings.length||out.stage!==stage)throw Error(JSON.stringify(out));
  writeFileSync(`${dir}/${name}.stage${stage}.json`,JSON.stringify({provenance:designer.label,...out},null,2));
 }
 const h=loadHouse(out!.save!);
 writeFileSync(`${dir}/${name}.save.json`,out!.save!);
 writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(h.scene));
 summary.push({name,brief,provenance:designer.label,stages:out!.checkpoints.map(c=>c.stage),bedrooms:allRooms(h.spec).filter(r=>r.type==='bedroom').length,storeys:Math.max(...h.spec.blocks.map(b=>b.level))+1,grossArea:h.spec.blocks.reduce((s,b)=>s+b.w*b.d,0),elements:h.scene.elements.length,findings:out!.findings,calls:out!.calls,providerCalls:0,costUsd:0,sceneSha256:createHash('sha256').update(JSON.stringify(h.scene)).digest('hex')});
}
writeFileSync(`${dir}/offline-results.json`,JSON.stringify(summary,null,2));
console.log(summary.map(r=>({name:r.name,bedrooms:r.bedrooms,storeys:r.storeys,elements:r.elements,findings:r.findings.length})));
