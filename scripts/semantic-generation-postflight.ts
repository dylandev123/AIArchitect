/** Offline preservation of a single provider proposal. No network, database or repair. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {constructSemantic} from '../src/lib/villa/experimental/semantic-building/generation';
import {physicalEvidence} from '../src/lib/villa/experimental/semantic-building/physical';
const dir='docs/architecture/semantic-generation/live-fresh-2026-10-31';
globalThis.fetch=async()=>{throw Error('Postflight is offline');};
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const wire=readFileSync(`${dir}/request.exact.json`,'utf8'),request=JSON.parse(wire),provider=JSON.parse(readFileSync(`${dir}/response.exact.json`,'utf8'));
if(provider.error||provider.status!=='completed'){
 save('validation.json',{accepted:false,providerStatus:provider.status,error:provider.error,incompleteDetails:provider.incomplete_details,repairs:0});
 process.exitCode=1;
}else{
 try{
  const providerOutput=JSON.parse(readFileSync(`${dir}/proposal.exact.txt`,'utf8'));
  // The unchanged provider schema requires a top-level proposal envelope.
  const proposal=providerOutput.proposal;save('semantic-proposal.json',proposal);
  const outcome=constructSemantic(request.input.find((i:{role:string})=>i.role==='user').content,proposal);save('construction-outcome.json',outcome);
  if(outcome.status==='ready'){
   const session=outcome.session;save('session.json',session);save('compiled.json',session.compiled);save('scene.json',session.scene);
   const physical=physicalEvidence(session.compiled);save('physical.json',physical);
   save('validation.json',{status:'compiled',physicalFailures:physical.failures,physicalCheckCount:physical.checks.length,elements:session.scene.elements.length,sceneSha256:createHash('sha256').update(JSON.stringify(session.scene)).digest('hex'),requestSha256:createHash('sha256').update(wire).digest('hex'),repairs:0,refinements:0,qualification:'Compilation is not architectural or physical acceptance.'});
  }else save('validation.json',{status:outcome.status,decisions:outcome.decisions,geometryProduced:false,repairs:0,refinements:0});
 }catch(error){save('postflight-error.json',{name:(error as Error).name,message:(error as Error).message,repairs:0});process.exitCode=1;}
}
