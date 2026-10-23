/** Deterministic evidence; imports no provider and never writes a saved design. */
import { isDeepStrictEqual } from 'node:util';
import { mkdirSync,writeFileSync } from 'node:fs';
import retained from '../src/lib/villa/__tests__/fixtures/garden-boundary.response.json';
import { resolveVillaResult } from '../src/lib/villa/terra';
import { buildComposition,validateComposition,compositionFindings } from '../src/lib/villa/composition';
import { experimentalExamples } from '../src/lib/villa/experimental/examples';
const dir='docs/villa-playground/new-forms';mkdirSync(dir,{recursive:true});
let before;
try{validateComposition({...retained.changes,character:'Retained estate'});}catch(error){before=compositionFindings(error);}
const replay=resolveVillaResult({mode:'generate',prompt:'Offline fictional estate replay; no defined site'},retained);
if(!('version' in replay.config)) throw Error('Composition expected');
const c=replay.config;
const preserved=Object.fromEntries((['wings','connections','terraces','pool','appearance'] as const).map(key=>[key,isDeepStrictEqual(c[key],retained.changes[key])]));
writeFileSync(`${dir}/boundary-replay.json`,JSON.stringify({...replay,providerCalls:0},null,2)+'\n');
writeFileSync(`${dir}/geometry-checks.json`,JSON.stringify({providerCalls:0,before,after:{garden:c.garden,siteMode:c.siteMode,preserved,renderedWings:buildComposition(c).wings.length},experimentalStudies:experimentalExamples()},null,2)+'\n');
console.log(JSON.stringify({before,after:{garden:c.garden,preserved},studies:experimentalExamples().map(c=>c.id)}));
