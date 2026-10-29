import {mkdirSync,writeFileSync} from 'node:fs';
import {residenceCompositionStudies} from '../src/lib/villa/residence-composition-studies';
import {footprintFacadeBays} from '../src/lib/villa/footprint';
const dir='docs/villa-playground/residence-composition';mkdirSync(dir,{recursive:true});
const studies=residenceCompositionStudies();writeFileSync(`${dir}/configurations.json`,JSON.stringify(studies,null,2));
console.log(studies.map(s=>({id:s.id,bays:s.forms?.map(footprintFacadeBays),wings:s.wings.length})));
