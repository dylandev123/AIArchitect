/** Offline orchestration adapter. Never imports a provider or reads credentials. */
import {readFileSync} from 'node:fs';
import {loadTerraStage3} from './stage3Checkpoint';
import {applySlice,legacyDraft,measure} from './pipeline';
import {deriveStage4} from './exterior';
import {deriveSite,STAGE4_BASE} from './site';
import {loadHouse,saveHouse} from './save';
import {editAcceptedStagedSave,stagedSaveHash} from './naturalLanguageEdit';
import {z} from 'zod';
export const rehearsalInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('stage'),brief:z.string().min(10).max(4000),stage:z.number().int().min(2).max(5)}).strict(),
 z.object({action:z.literal('edit'),save:z.string().max(2_000_000),instruction:z.string().min(1).max(1000)}).strict(),
]);
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
export async function studioRehearsal(raw:unknown){
 const input=rehearsalInput.parse(raw);
 if(input.action==='edit'){
  // Deliberately narrow mock grammar: never silently ignores extra requirements.
  const match=/^move the (?:swimming )?pool (\d+(?:\.\d+)?) (?:metres|meters) (closer to|away from) the veranda\.?$/i.exec(input.instruction.trim());
  if(!match)throw Error('Mock supports only: Move the pool 2 metres closer to the veranda.');
  const h=loadHouse(input.save),veranda=h.spec.exterior.verandas.find(v=>v.side==='s');
  if(!veranda)throw Error('No supported south veranda.');
  return {...await editAcceptedStagedSave({save:input.save,instruction:input.instruction,expectedHash:stagedSaveHash(input.save),proposal:{summary:input.instruction,ops:[{op:'move-pool-relative',pool:'pool',veranda:`veranda:${veranda.id}`,direction:match[2].toLowerCase()==='closer to'?'towards':'away',distance:Number(match[1])}]}}),provenance:'Mock planner; real validation; zero provider calls'};
 }
 // Replay is explicit, never advertised as interpreting a new brief.
 if(!/caribbean|tropical/i.test(input.brief)||!/flat/i.test(input.brief)||/hillside|slope|basement|snow|skyscraper/i.test(input.brief))throw Error('This rehearsal supports only a flat-site Caribbean villa. Unsupported requests are not converted to a template.');
 const base=loadTerraStage3();
 let spec=base.spec;
 if(input.stage===2){const first=read('docs/architecture/staged-villa/live-1/raw-response.json');const value=JSON.parse(first.text);spec=applySlice(applySlice(legacyDraft(base.site),1,value.direction),2,{blocks:value.blocks});}
 if(input.stage>=4){const cp=read(`${STAGE4_BASE}.checkpoint.json`);const result=deriveStage4(base.spec,cp.design);if(result.findings.length)throw Error(JSON.stringify(result.findings));spec={...result.spec,trim:cp.spec.trim};}
 if(input.stage===5){const cp=read('docs/architecture/staged-villa/stage5-site/terra-stage5.checkpoint.json');const result=deriveSite(spec,cp.design);if(result.findings.length)throw Error(JSON.stringify(result.findings));spec=result.spec;}
 const built=measure(spec,input.stage as 2|3|4|5,4,3);
 if(built.findings.length||!built.scene)throw Error(JSON.stringify(built.findings));
 const save=input.stage===5?saveHouse(spec,built.scene):undefined;
 if(save)loadHouse(save);
 return {stage:input.stage,brief:input.brief,stageBrief:input.brief,scene:built.scene,spec,save,findings:built.findings,providerCalls:0,costUsd:0,maxCostUsd:0,provenance:'Retained Terra checkpoint replay. Your brief is recorded at every stage; mock geometry is fixed and does not implement it.'};
}
