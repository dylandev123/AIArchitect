/** Offline only: produces reviewable payloads for the browser fixture harness. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { validatedCompositionExamples } from '../src/lib/villa/composition-examples';
import { buildComposition } from '../src/lib/villa/composition';
const directory='docs/villa-playground/terra-compositions';
mkdirSync(directory,{recursive:true});
const configurations=validatedCompositionExamples();
writeFileSync(`${directory}/deterministic-configurations.json`,JSON.stringify({provenance:'Deterministic component configurations. No model calls or prompt interpretation.',configurations},null,2)+'\n');
console.log(JSON.stringify(configurations.map(c=>({id:c.id,wings:c.wings.length,galleries:buildComposition(c).wings.filter(w=>w.connects).length,style:c.appearance.style}))));
