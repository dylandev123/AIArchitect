import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import baseline from './footprintBaseline.json';
import { PARITY_FIXTURES } from '../parity/fixtures';
import { SAVED_MANSIONS, savedMansion, functionalMansion } from '../parity/functionalMansions';
import { compileV3Scene } from '../scene';
test('nine pre-footprint scene compilations stay byte-identical',()=>{
 const scenes={...Object.fromEntries(Object.entries(PARITY_FIXTURES).map(([k,v])=>[k,v()])),...Object.fromEntries(SAVED_MANSIONS.flatMap(k=>[[k,savedMansion(k)],[k+'-functional',functionalMansion(k)]]))};
 expect(Object.fromEntries(Object.entries(scenes).map(([k,v])=>[k,createHash('sha256').update(JSON.stringify(compileV3Scene(v))).digest('hex')]))).toEqual(baseline);
});
