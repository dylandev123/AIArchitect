import {mkdirSync, writeFileSync} from 'node:fs';
import {villaSpec} from '@/lib/villa/staged/villa.fixture';
import {compileHouse, type Stage} from '@/lib/villa/staged/compile';
mkdirSync('docs/architecture/staged-villa', {recursive: true});
for (const stage of [2,3,4,5] as Stage[]) {
  const c = compileHouse(villaSpec, stage);
  writeFileSync(`docs/architecture/staged-villa/probe-stage${stage}.scene.json`, JSON.stringify(c.scene));
}
