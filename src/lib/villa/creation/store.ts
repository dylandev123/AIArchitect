import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { candidateSchema, validateCandidate, validateStoredCandidate, type Candidate } from './candidate';
const root=()=>path.join(process.cwd(),'.data','villa-component-candidates');
export async function listCandidates(): Promise<Candidate[]> {
  await mkdir(root(),{recursive:true});
  const names=(await readdir(root())).filter(n=>/^[a-z][a-z0-9-]{0,47}@\d+\.json$/.test(n));
  return Promise.all(names.sort().map(async n=>validateStoredCandidate(JSON.parse(await readFile(path.join(root(),n),'utf8')))));
}
export async function saveCandidate(input: unknown, approve = false) {
  const c=approve ? validateCandidate(input) : validateStoredCandidate(input), records=await listCandidates();
  if(approve) {
    const source=records.find(r=>r.id===c.id&&r.version===c.version);
    if(!source||JSON.stringify(source)!==JSON.stringify(c)||source.status!=='experimental') throw new Error('Approval requires the exact stored experimental version.');
  } else if(c.status!=='experimental') throw new Error('New candidates must be experimental.');
  // Exclusive creation handles concurrent writers without overwriting a pinned version.
  for(let version=Math.max(0,...records.filter(r=>r.id===c.id).map(r=>r.version))+1;version<10000;version++) {
    const next=candidateSchema.parse({...c,version,status:approve?'approved':'experimental',createdAt:new Date().toISOString()});
    try {await writeFile(path.join(root(),`${c.id}@${version}.json`),JSON.stringify(next),{flag:'wx',mode:0o600});return next;}
    catch(error) {if((error as NodeJS.ErrnoException).code!=='EEXIST') throw error;}
  }
  throw new Error('Candidate version limit reached.');
}
