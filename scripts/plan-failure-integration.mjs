// Production HTTP route + real SDK/adapter. This reconstructs failure classes;
// it cannot replay the lost body of an original HTTP error or invent a blueprint.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const source=process.cwd(),root=process.env.PRODUCTION_ROOT;
assert(root&&resolve(root)!==source,'An isolated build is required');
const out=resolve('docs/architecture/architectural-blueprint-pipeline/failed-paid-2d');mkdirSync(out,{recursive:true});
const log=resolve(out,'synthetic-transport.jsonl');writeFileSync(log,'');
const malformed=resolve(out,'synthetic-malformed.txt');writeFileSync(malformed,' \n{"unfinished": [');
const schema=resolve(out,'synthetic-schema.json');writeFileSync(schema,'{"format":"invalid"}');
const geometry=resolve(out,'synthetic-geometry.json');
const plan=JSON.parse(readFileSync(resolve('src/lib/v3/__tests__/fixtures/planned-site-regression.plan.json'),'utf8'));plan.buildings[0].location.x=500;writeFileSync(geometry,JSON.stringify(plan));
const cases=[{name:'recorded-429-class-only',status:429},{name:'invalid-json',file:malformed},{name:'schema',file:schema},{name:'geometry',file:geometry}];
const port=process.env.REPLAY_PORT??'3178',base=`http://127.0.0.1:${port}`,fd=openSync(resolve(out,'server.log'),'w');
const server=spawn(process.execPath,['--import',resolve('scripts/plan-failure-offline-provider.mjs'),resolve(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',port],{cwd:root,env:{...process.env,AI_V3_PLAN_EVALUATION:'1',OFFLINE_PLAN_CASES:JSON.stringify(cases),OFFLINE_PLAN_LOG:log},stdio:['ignore',fd,fd]});
const revisionOf=text=>{let a=0xdeadbeef,b=0x41c6ce57;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677);}a=Math.imul(a^(a>>>16),2246822507)^Math.imul(b^(b>>>13),3266489909);b=Math.imul(b^(b>>>16),2246822507)^Math.imul(a^(a>>>13),3266489909);return (4294967296*(2097151&b)+(a>>>0)).toString(16).padStart(14,'0');};
try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Server exited');try{if((await fetch(base+'/api/ai/plan')).ok){ready=true;break;}}catch{}await delay(200);}assert(ready);
  const currentHouseJson=JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:{version:3,site:{width:180,depth:180},objects:[],relationships:[],metadata:{}}});
  const results=[];
  for(const [i,item] of cases.entries()){
    const response=await fetch(base+'/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'design',prompt:'Synthetic integration test',projectId:'offline-only',currentHouseJson,baseRevision:revisionOf(currentHouseJson)})});
    const body=await response.json();assert.equal(response.status,i<2?502:422,JSON.stringify(body));
    assert.equal(body.failure.category,['provider','parsing','schema','geometry'][i]);assert(!body.json);assert.equal(body.providerCalls,1);
    if(i===0){assert.equal(body.failure.code,'provider_429');assert(!body.recovery);assert(!body.failure.providerCode);}
    else assert.equal(body.recovery.rawResponse,readFileSync(item.file,'utf8'));
    const evidence=JSON.parse(readFileSync(resolve(root,`.v3-debug/plan-evaluations/${body.failureId}.failure.json`),'utf8'));assert.equal(evidence.failure.code,body.failure.code);
    results.push({name:item.name,status:response.status,category:body.failure.category,code:body.failure.code,responseCaptured:!!body.recovery});
  }
  const transport=readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.equal(transport.length,cases.length);assert(transport.every(x=>x.synthetic));
  const proof={result:'PASS',runtime:'next build --webpack + next start',route:'/api/ai/plan',originalResponseReplay:false,reason:'Original latest attempt had HTTP 429 with no retained design response or HTTP body',syntheticFailureClassReplay:true,realProviderCalls:0,retries:0,realProjectsChanged:0,results};
  writeFileSync(resolve(out,'integration-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
}finally{if(server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}closeSync(fd);}
