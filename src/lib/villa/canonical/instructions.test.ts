import {expect,it} from 'vitest';
import {CANONICAL_INSTRUCTIONS,CANONICAL_CONTEXT_PRECEDENCE} from './plan';
import {readdirSync,readFileSync} from 'node:fs';
it('canonical instructions ask for no legacy artefacts and tell the planner what the compiler derives',()=>{
 for(const forbidden of [/(?<!never )return (scene )?operations/i,/translate .* into .*operations/i,/v3-plan/i,/spatial-proposal/i,/semantic-pilot/i,/exterior scope defers/i])expect(CANONICAL_INSTRUCTIONS).not.toMatch(forbidden);
 expect(CANONICAL_INSTRUCTIONS).toContain('architectural-plan-1');
 expect(CANONICAL_INSTRUCTIONS).toMatch(/height is the envelope height and is normally omitted \(null\)/);
 expect(CANONICAL_INSTRUCTIONS).not.toMatch(/must not exceed that upper level's rise/);
 expect(CANONICAL_CONTEXT_PRECEDENCE).toContain('architectural-plan-1');
});
it('the retired-author project lists only files that exist, and the active gate is closed',async()=>{
 const {retiredAuthorSuites}=await import('../../../../vitest.config' as string);
 const {legacyHouseAuthoringEnabled,canonicalGenerationRequired}=await import('./authority');
 expect(legacyHouseAuthoringEnabled()).toBe(false);expect(canonicalGenerationRequired('generate')).toBe(true);expect(canonicalGenerationRequired('edit')).toBe(false);
 for(const pattern of retiredAuthorSuites){
  const dir=pattern.replace(/\/\*\*\/.*$/,'').replace(/\/[^/]*$/,pattern.includes('**')?'':'');
  if(pattern.includes('**'))expect(readdirSync(pattern.split('/**')[0]).length).toBeGreaterThan(0);
  else expect(readFileSync(pattern,'utf8').length,dir).toBeGreaterThan(0);
 }
});
