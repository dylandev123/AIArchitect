/** Reproducible review of every retained live attempt; never calls a provider. */
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
const root='docs/architecture/generation-quality';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const attempts=[];
for(const name of readdirSync(root).filter(n=>/^(baseline|improved|final)-/.test(n))){
 const dir=`${root}/${name}`;
 if(!existsSync(`${dir}/summary.json`))continue;
 const summary=read(`${dir}/summary.json`),started=read(`${dir}/started.json`),result=read(`${dir}/result.json`);
 const scene=result.scene??result.recoverableDraft;
 let replayVerified=false;
 if(result.scene){
  const {architecturalPlan,name,summary,unsupported,operations}=result;
  const replay=resolveSceneResult({mode:'generate',prompt:started.prompt},{architecturalPlan,name,summary,unsupported,operations},scene.knowledgeEvidence);
  assert.deepEqual(JSON.parse(JSON.stringify(replay.scene)),scene);replayVerified=true;
 }
 const audit=scene?reviewSceneArchitecture(scene):undefined;
 const row={name,prompt:started.prompt,...summary,replayVerified,sceneHash:scene?createHash('sha256').update(readFileSync(`${dir}/scene.json`)).digest('hex'):undefined,relationships:scene?sceneRelationshipIssues(scene):undefined,audit};
 attempts.push(row);
 if(audit)writeFileSync(`${dir}/current-audit.json`,JSON.stringify(audit,null,2));
}
const providerCalls=attempts.reduce((n,r)=>n+r.providerCalls,0);
writeFileSync(`${root}/verification.json`,JSON.stringify({providerCalls,accepted:attempts.filter(r=>r.accepted).length,attempts},null,2));
console.log(JSON.stringify(attempts.map(r=>({name:r.name,providerCalls:r.providerCalls,accepted:r.accepted,elements:r.elements,replayVerified:r.replayVerified,relationshipFindings:r.relationships?.length,architecturalFindings:r.audit?.issues.length}))));
