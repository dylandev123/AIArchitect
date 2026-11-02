import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sceneRequestSchema,sceneMessages,sceneSystemPrompt,type SceneRequest} from './terra';

/** A frozen input to the existing route, never an alternate executor/provider path. */
export async function mansionCoordinationFixture(){
 if(process.env.NODE_ENV!=='development')throw Error('Controlled fixture is development-only.');
 const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
 const dir='docs/architecture/terra-coordination-experiment';
 const input=sceneRequestSchema.parse(await read(`${dir}/request.json`));
 const evidence=await read(`${dir}/coordination-evidence.json`);
 const retained=await read('.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.json');
 const context={system:sceneSystemPrompt(input)+retained.knowledge.text,evidence:undefined,trace:{...retained.knowledge,frozenFixture:'mansion-coordination',knowledgeStatus:'retained approved retrieval snapshot; no new retrieval or learning'}};
 const messages=[...sceneMessages(input),{role:'user' as const,content:JSON.stringify({coordinationEvidence:evidence})}];
 const fingerprint=createHash('sha256').update(JSON.stringify({input,system:context.system,messages})).digest('hex');
 return {input,context,messages,fingerprint};
}
export function assertFixtureInput(input:SceneRequest,expected:SceneRequest){
 const {testing:_,...actual}=input;void _;
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Controlled fixture changed. Reload the retained original case before comparing models.');
}
