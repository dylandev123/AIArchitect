import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {CANONICAL_INSTRUCTIONS,CANONICAL_CONTEXT_PRECEDENCE} from './plan';
import {ARCHITECTURAL_CONCEPT_GUIDANCE} from '../scene/designGuide';
import {CANONICAL_KNOWLEDGE_HEADER} from '../../library/architecture/canonicalKnowledge';

const frozen=JSON.parse(readFileSync('docs/architecture/canonical-acceptance-2026-11-02/provider-request.exact.json','utf8')).input[0].content as string;
describe('architectural mission',()=>{
 it('opens the instructions, ahead of the construction mechanics',()=>{
  expect(CANONICAL_INSTRUCTIONS.startsWith('ROLE AND ARCHITECTURAL MISSION\nYou are the principal residential architect')).toBe(true);
  const i=(re:RegExp)=>CANONICAL_INSTRUCTIONS.search(re);
  for(const h of [/Architectural priorities:/,/DESIGN FREEDOM:/,/RESPONSIBILITIES:/,/SELF-CHECK before returning/]) expect(i(h)).toBeGreaterThan(0);
  expect(i(/SELF-CHECK/)).toBeLessThan(i(/OUTPUT CONTRACT/));
  expect(i(/OUTPUT CONTRACT/)).toBeLessThan(i(/Spaces are rectangular allocations/));
  expect(CANONICAL_INSTRUCTIONS.indexOf('ROLE AND ARCHITECTURAL MISSION')).toBe(CANONICAL_INSTRUCTIONS.lastIndexOf('ROLE AND ARCHITECTURAL MISSION'));
 });
 it('keeps every frozen construction paragraph verbatim',()=>{
  const paras=frozen.slice(frozen.indexOf('Choose a brief-specific'),frozen.indexOf('RETRIEVED ARCHITECTURAL KNOWLEDGE')).trim();
  expect(CANONICAL_INSTRUCTIONS).toContain(paras);
  expect(CANONICAL_INSTRUCTIONS).toContain('Return architectural-plan-1 in a proposed plan or decision-required with unsupported choices. Never return scene operations');
 });
 it('removes the default-to-simple wording and states precedence consistently',()=>{
  expect(ARCHITECTURAL_CONCEPT_GUIDANCE).not.toContain('Simple or complex architecture is valid');
  expect(CANONICAL_KNOWLEDGE_HEADER).toContain('optional suggestions never override them');
  expect(CANONICAL_CONTEXT_PRECEDENCE).toContain('never lowers the architectural standard');
  expect(CANONICAL_INSTRUCTIONS+CANONICAL_KNOWLEDGE_HEADER+ARCHITECTURAL_CONCEPT_GUIDANCE+CANONICAL_CONTEXT_PRECEDENCE).not.toMatch(/restrained home\./);
 });
});
