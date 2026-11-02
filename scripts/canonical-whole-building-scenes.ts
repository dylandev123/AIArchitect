/** Writes the compiled scene of each developer fixture for the browser comparison. Offline. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {compactFamilyHome,asymmetricMultilevel,courtyardHouse,luxuryEstate} from '../src/lib/villa/canonical/spatial.fixture';
const dir='docs/architecture/canonical-whole-building-2026-11-02/browser';mkdirSync(dir,{recursive:true});
for(const [n,f] of Object.entries({compact:compactFamilyHome,multilevel:asymmetricMultilevel,courtyard:courtyardHouse,estate:luxuryEstate}))writeFileSync(`${dir}/${n}.scene.json`,JSON.stringify(compileArchitecturalPlan(f()).scene));
