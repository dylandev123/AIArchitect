import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { compileV3Scene } from '../scene';
import { expressiveCottage } from '../parity/cottage';
import { regressionLadder } from './regressionLadder';
import { ingestV3GenerationOutput } from '../ingestion';
it('preserves exact pre-feature geometry for the unaffected simple and expressive cottage scenes',()=>{
 const scenes=[{name:'cottage',scene:expressiveCottage()},...regressionLadder.map(x=>({name:x.name,scene:ingestV3GenerationOutput(x.raw).scene}))];
 const baseline: Record<string,string> = {
  'simple cottage':'d1462be26512a54ab0bc0260fa1146776fe05b3a0ab4c4ae9a3270ce0028bd6e',
  'expressive cottage':'8def4d7af6bc4173f0415c18364bbade189b4c45bc03646658376acbbbc643c2',
 };
 for(const x of scenes.filter(x=>baseline[x.name])) expect(createHash('sha256').update(JSON.stringify(compileV3Scene(x.scene))).digest('hex'),x.name).toBe(baseline[x.name]);
});
