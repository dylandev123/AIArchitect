/** Explicit development-only comparison; never run by build, tests, or the application. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createOpenAI} from '@ai-sdk/openai';
import {generateText,Output,jsonSchema} from 'ai';
import {backgroundResponseFetch} from './lib/background-response';
import {sceneRuntimeOutputSchema,resolveSceneResult} from '../src/lib/villa/scene/terra';

const [command,destination,ack]=process.argv.slice(2);
if(process.env.NODE_ENV!=='development'||!['submit','resume'].includes(command)||!destination||ack!=='--allow-openai')throw Error('Explicit development execution required: submit|resume DIRECTORY --allow-openai');
if(!process.env.OPENAI_API_KEY?.trim())throw Error('Load the existing server credential before running.');
const directory=resolve(destination);
if(!directory.startsWith(resolve('.data/sol-high-background')+'/'))throw Error('Use a new child directory under .data/sol-high-background (create the parent first).');
const source='docs/architecture/sol-high-once';
const retained=JSON.parse(await readFile(`${source}/retained.json`,'utf8'));
const diagnostic=JSON.parse(await readFile(`${source}/retained.diagnostics.json`,'utf8'));
const provider=createOpenAI({fetch:backgroundResponseFetch(directory,command==='resume')});
// Freeze the failed Sol attempt's context/schema. Only background/storage behavior changes.
try{
 const result=await generateText({model:provider.responses('gpt-6.1-sol'),system:retained.requestSystem,messages:diagnostic.messages,
  output:Output.object({schema:jsonSchema(diagnostic.requestSchema.jsonSchema)}),
  providerOptions:{openai:{strictJsonSchema:true,reasoningEffort:'high'}},maxOutputTokens:30000,maxRetries:0});
 await writeFile(`${directory}/sdk-result.json`,JSON.stringify({text:result.text,usage:result.totalUsage,response:result.response,providerMetadata:result.providerMetadata,finishReason:result.finishReason},null,2),{mode:0o600});
 if(result.finishReason!=='stop')throw Error('Incomplete SDK output; raw response and usage retained.');
 const output=sceneRuntimeOutputSchema(retained.input).parse(result.output);
 const resolved=resolveSceneResult(retained.input,output);
 await writeFile(`${directory}/UNAPPROVED-scene.json`,JSON.stringify(resolved,null,2),{mode:0o600});
 console.log('Completed; retained locally for review. No project imported or changed.');
}catch(error){
 // Never serialize request headers or potentially credential-bearing transport errors.
 console.error('Stopped without retry. Inspect retained state/raw files; resume only with a provider response ID.');
 throw error;
}
