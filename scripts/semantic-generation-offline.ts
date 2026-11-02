/** End-to-end mock planning responses, never finished-scene fixtures. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateSemantic,constructSemantic,restoreSemantic,reviseSemantic} from '../src/lib/villa/experimental/semantic-building/generation';
import {physicalEvidence} from '../src/lib/villa/experimental/semantic-building/physical';
const dir='docs/architecture/semantic-generation';mkdirSync(dir,{recursive:true});
globalThis.fetch=async()=>{throw Error('Offline: network forbidden');};
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(value,null,2));
const records=[];
for(const name of ['family','luxury']){
 const response=readFileSync(`${dir}/mocks/${name}.response.json`,'utf8');
 let calls=0;
 const outcome=await generateSemantic(name==='family'?'Compact family home with connected garden and sleeping upstairs.':'Multilevel luxury waterfront property with unequal living wings, suites, tall social pavilion and terrace.',async request=>{calls++;assert(request.system.includes('never scene operations'));return JSON.parse(response);});
 if(outcome.status!=='ready')throw Error(outcome.decisions.join('\n'));
 const session=outcome.session,physical=physicalEvidence(session.compiled);
 assert.equal(physical.failures.length,0,JSON.stringify(physical.failures.slice(0,8)));
 assert.equal(JSON.stringify(restoreSemantic(JSON.stringify(session))),JSON.stringify(session));
 const revised=structuredClone(session.proposal);revised.intent.portals.find(p=>p.id==='front-door')!.offset+=.15;
 const revision=reviseSemantic(session,revised);assert.equal(revision.status,'ready');
 save(`${name}.session.json`,session);save(`${name}.json`,session.compiled);save(`${name}.scene.json`,session.scene);save(`${name}.physical.json`,physical);save(`${name}.revision.json`,revision);
 records.push({name,mockPlannerCalls:calls,paidCalls:0,responseHash:createHash('sha256').update(response).digest('hex'),elements:session.scene.elements.length,spaces:session.proposal.intent.spaces.length,physicalChecks:physical.checks.length,failures:physical.failures.length,sceneHash:createHash('sha256').update(JSON.stringify(session.scene)).digest('hex')});
}
save('verification.json',{records,providerCalls:0,databaseCalls:0,source:'Hand-authored mocked semantic AI responses, not actual AI generation or quality evidence.'});
console.log(records);

const negative=JSON.parse(readFileSync(`${dir}/mocks/luxury.response.json`,'utf8'));
negative.intent.portals.find((p:{id:string})=>p.id==='living-link').offset=8.7;
const unchecked=constructSemantic('Negative route study',negative);
assert.equal(unchecked.status,'ready');
if(unchecked.status==='ready'){const physical=physicalEvidence(unchecked.session.compiled);assert(physical.failures.length>0);save('negative-stair-route.physical.json',physical);}
const gap=JSON.parse(readFileSync(`${dir}/mocks/family.response.json`,'utf8'));
gap.intent.spaces.find((s:{id:string})=>s.id==='garden').polygon.forEach((p:number[])=>p[1]+=2);
save('unsupported-gap.json',constructSemantic('Gap requires a design choice',gap));
