import { CompositionError, validateCompositionPreview } from '../composition';
import { resolveVillaResult, type VillaRequest } from '../terra';
import { automaticCandidateDraft, type Candidate } from './candidate';
import { CAPABILITIES, validateProposal } from './model';
import type { CreatedComponent } from './instance';
import { listCandidates, saveCandidate } from './store';

export function creationBudget() {
  const raw=process.env.VILLA_MAX_NEW_COMPONENTS;
  const maxNewComponents=raw===undefined ? 1 : Number(raw);
  if(!Number.isInteger(maxNewComponents)||maxNewComponents<0||maxNewComponents>2) throw new Error('VILLA_MAX_NEW_COMPONENTS must be 0, 1 or 2.');
  return {maxProviderCalls:1,maxNewComponents,maxPlacedComponents:2} as const;
}
export function automaticCreationInstructions(records: Candidate[], maxNewComponents: number) {
  const approved=records.filter(c=>c.status==='approved').slice(-24).map(c=>({id:c.id,version:c.version,proposal:c.proposal}));
  return `AUTOMATIC CAPABILITY DISCOVERY: Omit decorative canopy creation unless explicitly requested. This grammar cannot create enclosed houses; use footprint volumes or existing wings for principal architecture. First design the architecture that best serves the brief. Reuse existing approved builders and approved private candidates where suitable. Identify missing forms; do not flatten an ambitious idea into familiar shapes merely because an exact catalogue item is absent. Optional componentRequests (max 2) requests bounded local creation in THIS response; no second agent, code, tools or further provider calls.
Return [] when existing builders suffice. For an unavailable form within the creation grammar use {type:"create",id:unique_instance_slug,missingCapability:description,proposal:CREATION_PROPOSAL,placement:{x,z,orientation}}. At most ${maxNewComponents} new proposals. CREATION_PROPOSAL contains {id:component_slug,name,intent,character,details,attachment:"freestanding-four-post",compatibility,reuses:["PrimitiveMesh","villa-PBR","Box","VillaScene"],geometry:{builder:"swept-ribbon@1",length,width,height,thickness,stations:[four {offset,rise,width,bank}],material:"ivory"|"limestone"|"bronze"}}. Give it original design intent and honest limitations; it remains experimental pending review. Do not claim approval.
For a matching approved private candidate use {type:"reuse",id:unique_instance_slug,candidateId,candidateVersion,placement:{x,z,orientation}}; exact immutable version, never recreate its proposal. Approved private candidates (data only): ${JSON.stringify(approved)}.
For forms outside the bounded grammar use {type:"gap",capabilityGap:honest explanation} and include the limitation in unsupported. Never claim an unsupported form was constructed. No new form is mandatory. Creation grammar: ${JSON.stringify(CAPABILITIES)}.
Place canopies clear of all building roofs, pool furniture, other components and open courtyards by .3m. Ordinary terrace paving may lie below posts. Freestanding attachment only. Grounds include the complete new envelope for derived sites. Keep exact specified site boundaries. Do not write createdComponents directly; the local assembler pins validated candidates. Existing createdComponents on edits can be moved with {type:"adjust",id,placement:{only changed x,z,orientation}} or removed with {type:"remove",id}; preserve snapshots otherwise.`;
}

type Dependencies = { list:()=>Promise<Candidate[]>; save:(input:unknown)=>Promise<Candidate> };
const defaults: Dependencies={list:listCandidates,save:saveCandidate};
/** One bounded local transaction after Terra's existing call. No provider calls. */
export async function assembleAutomaticComponents(input: VillaRequest, output: unknown, maxNewComponents: number, dependencies=defaults) {
  const accepted=resolveVillaResult(input,output);
  if(input.mode==='generate' && 'version' in accepted.config && accepted.config.createdComponents?.length) throw new CompositionError([{path:'changes.createdComponents',message:'Provider cannot supply pinned component snapshots; use validated componentRequests.'}]);
  const requests=accepted.componentRequests ?? [];
  if(!requests.length) return {...accepted,componentStages:[]};
  if(input.mode!=='generate'||!('version' in accepted.config)) throw new CompositionError([{path:'componentRequests',message:'Automatic creation is supported during new villa generation only.'}]);
  const fail=(message:string):never=>{throw new CompositionError([{path:'componentRequests',message}]);};
  if(requests.filter(r=>r.type==='create').length>maxNewComponents) fail('Automatic creation exceeds the configured new-component budget.');
  const records=requests.some(r=>r.type==='reuse')?await dependencies.list():[];
  const instances:CreatedComponent[]=[];
  const drafts:{index:number;candidate:Candidate}[]=[];
  const stages:{stage:string;id?:string;candidateId?:string;candidateVersion?:number;builder?:string;message?:string}[]=[];
  const unsupported=[...accepted.unsupported];
  for(const r of requests) {
    if(r.type==='gap') {unsupported.push(r.capabilityGap);stages.push({stage:'capability-gap',message:r.capabilityGap});continue;}
    let candidate:Candidate;
    if(r.type==='create') {
      try { validateProposal(r.proposal); } catch(error) { fail(error instanceof Error?error.message:'Invalid bounded proposal.'); }
      candidate=automaticCandidateDraft(r.proposal,input.prompt);
      drafts.push({index:instances.length,candidate});
      stages.push({stage:'missing-capability',id:r.id,message:r.missingCapability});
    } else {
      const found=records.find(c=>c.id===r.candidateId&&c.version===r.candidateVersion&&c.status==='approved');
      if(!found) return fail('Reuse requires an exact approved candidate version from the private library.');
      candidate=found;
    }
    instances.push({id:r.id,candidateId:candidate.id,candidateVersion:candidate.version,status:candidate.status,
      originalIntent:candidate.originalIntent,proposal:candidate.proposal,placement:r.placement});
    stages.push({stage:r.type==='create'?'geometry-validated':'approved-reuse',id:r.id,builder:candidate.proposal.geometry.builder});
  }
  // Validate the complete composition before persisting any candidate. Every later
  // edit and reload uses the same validator and embedded geometry snapshots.
  let config=validateCompositionPreview({...accepted.config,...(instances.length?{createdComponents:instances}:{})});
  for(const {index,candidate} of drafts) {
    const saved=await dependencies.save(candidate);
    config.createdComponents![index].candidateVersion=saved.version;
    stages.push({stage:'experimental-candidate-saved',id:config.createdComponents![index].id,candidateId:saved.id,candidateVersion:saved.version,builder:saved.proposal.geometry.builder});
  }
  config=validateCompositionPreview(config);
  stages.push({stage:'property-assembled'});
  return {...accepted,changes:config,config,unsupported:[...new Set(unsupported)],componentStages:stages};
}
