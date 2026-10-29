import { mkdirSync,writeFileSync } from 'node:fs';
import { stackedVolumeExamples } from '../src/lib/villa/stacked-volume-examples';
import { rectangleFromPoints,resolveStack } from '../src/lib/villa/stacked-volumes';
import { footprintFacadeBays } from '../src/lib/villa/footprint';
const dir='docs/villa-playground/stacked-volumes';mkdirSync(dir,{recursive:true});
const configurations=stackedVolumeExamples();
writeFileSync(`${dir}/configurations.json`,JSON.stringify({provenance:'Offline hand-authored inputs to the shared volume builder. No AI calls.',configurations},null,2)+'\n');
writeFileSync(`${dir}/geometry-checks.json`,JSON.stringify(configurations.map(c=>{const f=c.forms![0];return {id:c.id,facadeBays:footprintFacadeBays(f),levels:resolveStack(rectangleFromPoints(f.points),f.height,f.stack!)};}),null,2)+'\n');
