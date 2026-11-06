import {readFileSync,writeFileSync} from 'node:fs';
import {houseSpecSchema} from '@/lib/villa/staged/spec';
import {compileHouse} from '@/lib/villa/staged/compile';
import {saveHouse,loadHouse} from '@/lib/villa/staged/save';
const spec=houseSpecSchema.parse(JSON.parse(readFileSync('docs/architecture/staged-villa/spec.json','utf8')));
writeFileSync('docs/architecture/staged-villa/casa-corallina.save.json',saveHouse(spec,compileHouse(spec,5).scene));
console.log('reload ok',loadHouse(readFileSync('docs/architecture/staged-villa/casa-corallina.save.json','utf8')).scene.elements.length);
