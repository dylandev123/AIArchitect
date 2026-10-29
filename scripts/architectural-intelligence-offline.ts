/** Offline only: no env/key loading, provider calls or production library writes. */
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { architecturalRequestContext } from '../src/lib/villa/scene/knowledgeContext';
import { estateConceptStudy, estateStudyBrief } from '../src/lib/villa/scene/estateConcepts.fixture';
import { generationSceneRequest } from '../src/lib/villa/scene/terra';
import { researchIntakeFixture } from '../src/lib/library/architecture/research.fixture';
import { researchKnowledgeProposals } from '../src/lib/library/architecture/research';
import { emptySnapshot } from '../src/lib/library/store';
import { sceneRelationshipIssues } from '../src/lib/villa/scene/relationships';
const dir='docs/architecture/architectural-intelligence';
const temp=await mkdtemp(path.join(tmpdir(),'terra-intelligence-'));
const original={...process.env};
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('Offline evidence: network forbidden');};
try {
 process.env.DATABASE_URL='';process.env.POSTGRES_URL='';process.env.VERCEL='';
 process.env.AI_LIBRARY_PATH=path.join(temp,'library.json');
 const snapshot=JSON.parse(await readFile('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
 await writeFile(process.env.AI_LIBRARY_PATH,JSON.stringify({...emptySnapshot(),...snapshot}));
 await mkdir(dir,{recursive:true});
 const summaries=[];
 for(const concept of ['court','promenade'] as const){
  const scene=estateConceptStudy(concept);
  await writeFile(`${dir}/${concept}.scene.json`,JSON.stringify(scene,null,2));
  summaries.push({concept,author:'developer-authored offline study',elements:scene.elements.length,
   wingFloorSurfaceM2:scene.elements.filter(e=>e.assemblyKind==='residential-wing').reduce((n,e)=>n+e.size[0]*e.size[2],0),
   issues:sceneRelationshipIssues(scene),limitations:'Not autonomous Terra output, not a completed programme, not proof of architectural beauty.'});
 }
 const context=await architecturalRequestContext(generationSceneRequest(estateStudyBrief));
 await writeFile(`${dir}/request-context.json`,JSON.stringify(context,null,2));
 await writeFile(`${dir}/research-proposals.json`,JSON.stringify(researchKnowledgeProposals([researchIntakeFixture]),null,2));
 await writeFile(`${dir}/evidence.json`,JSON.stringify({providerCalls:0,networkCalls:0,brief:estateStudyBrief,approvedKnowledge:context.trace.metrics.approvedActive,selected:context.trace.selected,summaries},null,2));
 console.log(JSON.stringify(summaries));
} finally {
 globalThis.fetch=originalFetch;
 for(const key of ['DATABASE_URL','POSTGRES_URL','VERCEL','AI_LIBRARY_PATH']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}
 await rm(temp,{recursive:true,force:true});
}
