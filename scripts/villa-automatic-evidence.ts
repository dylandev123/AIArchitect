/** Offline evidence only. Private candidates live in an isolated temporary directory. */
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { assembleAutomaticComponents } from '../src/lib/villa/creation/automatic';
import { mockProposal } from '../src/lib/villa/creation/model';
import { candidateDraft } from '../src/lib/villa/creation/candidate';
import { listCandidates,saveCandidate } from '../src/lib/villa/creation/store';
import { COMPOSITION_EXAMPLES } from '../src/lib/villa/composition-examples';
import { resolveVillaResult } from '../src/lib/villa/terra';
const workspace=process.cwd(),dir=path.join(workspace,'docs/villa-playground/automatic-creation');
await mkdir(dir,{recursive:true});
const temporary=await mkdtemp(path.join(os.tmpdir(),'villa-auto-evidence-'));
const prompt='Design an extraordinary Caribbean house with a new freestanding bronze sail canopy beside the garden terrace.';
const placement={x:15,z:8,orientation:25};
try {
 process.chdir(temporary);
 const proposal=mockProposal('fan');
 const provider={changes:{...COMPOSITION_EXAMPLES[1],id:'sail-house',name:'Sail House',siteMode:'derived' as const},summary:'An island residence with an original bronze sail canopy. The new canopy is experimental and awaits review.',unsupported:[],componentRequests:[{type:'create' as const,id:'garden-sail',missingCapability:'A rising flared bronze canopy absent from the approved library.',proposal,placement}]};
 const input={mode:'generate' as const,prompt};
 const created=await assembleAutomaticComponents(input,provider,1);
 const experimental=(await listCandidates())[0];
 // Synthetic review fixture exercises the existing approval mechanism; it is not
 // human architectural approval and never enters the user's private library.
 const image='data:image/png;base64,'+Buffer.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x02\x80\0\0\x01\x68','binary').toString('base64');
 const reviewed=await saveCandidate(candidateDraft(proposal,prompt,COMPOSITION_EXAMPLES.slice(0,2).map((villa,i)=>({villa,placement:i?placement:{x:14,z:6,orientation:0},image,view:'Poolside',reviewed:true}))));
 const approved=await saveCandidate(reviewed,true);
 const reused=await assembleAutomaticComponents(input,{...provider,summary:'Reused the approved bronze sail canopy without a creation request.',componentRequests:[{type:'reuse',id:'garden-sail',candidateId:approved.id,candidateVersion:approved.version,placement}]},0);
 const plain=await assembleAutomaticComponents(input,{changes:{...COMPOSITION_EXAMPLES[1],siteMode:'derived'},summary:'A normal Caribbean house using existing builders.',unsupported:[],componentRequests:[]},1);
 const edited=resolveVillaResult({mode:'edit',prompt:'Rotate the canopy',current:created.config},{changes:{createdComponents:[{type:'adjust',id:'garden-sail',placement:{orientation:35}}]},summary:'Rotated the existing canopy, preserving its version and geometry.',unsupported:[]});
 await writeFile(path.join(dir,'offline-fixtures.json'),JSON.stringify({prompt,provider,created,reused,plain,edited,experimental,approvalNote:'Synthetic reviewed evidence in a temporary library only; no real design approved or published.'},null,2));
} finally {process.chdir(workspace);await rm(temporary,{recursive:true,force:true});}
