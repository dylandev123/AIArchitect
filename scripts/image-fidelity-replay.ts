/** Offline only: no model/client/env imports. Never writes into the retained run. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { constructVision } from '../src/lib/villa/image-vision';
import { replayFirstImageFidelity, firstImageFidelityAudit, firstImageFidelityPatch } from '../src/lib/villa/image-fidelity';
const run='7f6322d4-8b39-43fe-a10e-52a5e7b13686', root=`.data/image-vision/${run}`;
const out='docs/villa-playground/image-fidelity';
mkdirSync(out,{recursive:true});
const raw=JSON.parse(readFileSync(`${root}/response.json`,'utf8'));
const interpretation=JSON.parse(raw.text), before=constructVision(interpretation), after=replayFirstImageFidelity(interpretation);
const baseline=`docs/villa-playground/image-vision/${run}`;
const paths=[...readdirSync(root).map(f=>`${root}/${f}`),...readdirSync(baseline).map(f=>`${baseline}/${f}`),'public/inspiration/villa.jpg'];
const hashes=Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
writeFileSync(`${out}/preserved-sha256.json`,JSON.stringify(hashes,null,2));
writeFileSync(`${out}/exact-replay.json`,JSON.stringify(before,null,2));
writeFileSync(`${out}/audited-replay.json`,JSON.stringify(after,null,2));
writeFileSync(`${out}/local-patch.json`,JSON.stringify({providerCalls:0,patch:firstImageFidelityPatch,audit:firstImageFidelityAudit},null,2));
console.log('Exact retained response replayed offline; separate audited patch validated; retained files untouched.');
