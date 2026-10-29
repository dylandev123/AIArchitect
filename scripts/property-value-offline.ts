import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ARCHITECTURAL_KNOWLEDGE_SEEDS} from '../src/lib/library/architecture/seeds';
import {retrieveArchitecturalKnowledge} from '../src/lib/library/architecture/retrieval';
import {PROPERTY_VALUE_GUIDANCE} from '../src/lib/library/architecture/propertyValue';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {validateScene} from '../src/lib/villa/scene/model';
const dir='docs/architecture/property-value';mkdirSync(dir,{recursive:true});
// Approval is simulated in memory only. Production revisions remain proposed.
const mockApproved=ARCHITECTURAL_KNOWLEDGE_SEEDS.map(e=>e.category==='property-value'?{...e,status:'approved' as const}:e);
const examples=['$100k compact family home','$400k family home with garden','$800k contemporary residence','$2m tropical villa','$4m coastal luxury residence','$8m estate','$15m mansion','$25m tropical waterfront estate with pool','$25m Mediterranean urban mansion with courtyard','$75m estate with guest house','$100 million tropical estate','luxurious tropical residence'];
const retrieval=examples.map(brief=>({brief,production:retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,brief),mockApproved:retrieveArchitecturalKnowledge(mockApproved,brief)}));
writeFileSync(`${dir}/retrieval.json`,JSON.stringify(retrieval,null,2));
writeFileSync(`${dir}/proposed-recipes.json`,JSON.stringify(PROPERTY_VALUE_GUIDANCE,null,2));
const knowledge=retrieveArchitecturalKnowledge(mockApproved,'$25m tropical waterfront estate entrance roof facade');
const result=resolveSceneResult({mode:'generate',prompt:'Offline authored knowledge construction contract'}, {name:'Entrance contract fixture',summary:'Authored mock, not AI design quality evidence',unsupported:['Room programme and access beyond threshold are not modelled'],operations:[
 {op:'add',element:{id:'threshold',label:'threshold',kind:'plate',at:[0,.1,0],size:[6,.2,4]}},
 {op:'add',element:{id:'entry-wall',label:'entry wall',kind:'wall',at:[0,2.2,0],size:[6,4,.3],opening:{x:0,sill:0,width:2,height:3,glazed:false}}},
 {op:'add',element:{id:'door',label:'door',kind:'entrance',parent:'entry-wall',at:[0,-.5,0],size:[2,3,.15]}},
 {op:'add',element:{id:'shelter',label:'shelter',kind:'roof',at:[0,4.35,0],size:[7,.3,4]}},
 ]},knowledge.evidence);
assert(result.scene.knowledgeEvidence?.some(e=>e.id==='property-value-25m-50m'));
assert.equal(validateScene(JSON.parse(JSON.stringify(result.scene))).elements.length,4);
writeFileSync(`${dir}/mock-construction.json`,JSON.stringify({providerCalls:0,approval:'mock only',scene:result.scene,limitation:'Proves construction/evidence transport, not autonomous value-driven quality. One entrance assembly is not an estate.'},null,2));
console.log('Offline value retrieval and construction evidence saved; no provider calls');
