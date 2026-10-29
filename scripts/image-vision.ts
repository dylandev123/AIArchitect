import { learningContext } from '../src/lib/villa/design-learning';
import { listDesignLessonSummaries } from '../src/lib/villa/design-learning-store';
import { loadEnvConfig } from '@next/env';
import { generateText } from 'ai';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from '../src/lib/ai/model';
import { constructVision, interpretSavedImage, visionInstructions } from '../src/lib/villa/image-vision';

async function main() {
  const [mode,id]=process.argv.slice(2);
  if(mode==='replay' && id && /^[a-f0-9-]{36}$/.test(id)) {
    const root=`.data/image-vision/${id}`;
    const raw=JSON.parse(await readFile(`${root}/response.json`,'utf8'));
    const original=await readFile(`${root}/concept.jpg`);
    const meta=JSON.parse(await readFile(`${root}/request.json`,'utf8'));
    if(createHash('sha256').update(original).digest('hex')!==meta.sourceSha256) throw new Error('Reference hash mismatch');
    const proof=constructVision(JSON.parse(raw.text));
    await writeFile(`${root}/proof.json`,JSON.stringify(proof,null,2));
    console.log(`Offline replay validated: ${id}`);return;
  }
  if(mode!=='--authorize-one-live-call' || id) throw new Error('No call made. Use replay <id> or explicitly --authorize-one-live-call after approval.');
  loadEnvConfig(process.cwd());
  if(!isAiConfigured()) throw new Error('OPENAI_API_KEY is not configured');
  const image=await readFile('public/inspiration/villa.jpg');
  const run=randomUUID(),root=`.data/image-vision/${run}`,system=visionInstructions(learningContext(await listDesignLessonSummaries().catch(()=>[]),'Residential architectural concept image reconstruction facade entrance roof windows materials')); 
  await mkdir(root,{recursive:true,mode:0o700});
  await writeFile(`${root}/concept.jpg`,image,{mode:0o600});
  await writeFile(`${root}/request.json`,JSON.stringify({model:getAiModelId(),sourceSha256:createHash('sha256').update(image).digest('hex'),system,providerOptions:AI_PROVIDER_OPTIONS,image:{source:'/inspiration/villa.jpg',mediaType:'image/jpeg'},userText:'Interpret this saved reference and construct its closest supported editable exterior. Return JSON only.',maxRetries:0,maxOutputTokens:12000,createdAt:new Date().toISOString()},null,2),{mode:0o600});
  console.log(`Retaining run: ${run}`);
  const proof=await interpretSavedImage(async()=>{
    const result=await generateText({model:getAiModel(),providerOptions:AI_PROVIDER_OPTIONS,system,maxRetries:0,maxOutputTokens:12000,abortSignal:AbortSignal.timeout(160000),messages:[{role:'user',content:[{type:'text',text:'Interpret this saved reference and construct its closest supported editable exterior. Return JSON only.'},{type:'image',image,mediaType:'image/jpeg'}]}]});
    return {text:result.text,response:result.response,usage:result.totalUsage};
  },async raw=>{await writeFile(`${root}/response.json`,JSON.stringify(raw,null,2),{mode:0o600});});
  await writeFile(`${root}/proof.json`,JSON.stringify(proof,null,2),{mode:0o600});
  console.log(`Validated. Open /dev/villa-playground/image-first?run=${run}`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Image interpretation failed');process.exitCode=1;});
