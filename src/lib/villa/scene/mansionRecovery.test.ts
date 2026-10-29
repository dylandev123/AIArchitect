import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {applySceneOperations,validateScene} from './model';
import {sceneRelationshipIssues} from './relationships';
import {auditArchitecturalPlan} from './planning';
const dir='docs/villa-playground/25m-mansion-recovery';
const original=validateScene(JSON.parse(readFileSync(`${dir}/original.scene.json`,'utf8')));
const corrected=validateScene(JSON.parse(readFileSync(`${dir}/corrected.scene.json`,'utf8')));
it('preserves the retained bytes and changes only two world-space railing elevations',()=>{
 expect(createHash('sha256').update(readFileSync(`${dir}/original.response.json`)).digest('hex')).toBe('c1613800abe2efaa2bb5f200f8c807bc345df7bebd3eed9965f5436b8a44c9e5');
 expect(sceneRelationshipIssues(original).map(i=>[i.id,i.rule])).toEqual([['east-terrace-rail','railing-deck'],['west-terrace-rail','railing-deck']]);
 expect(corrected.elements).toHaveLength(67);
 for(const e of corrected.elements){const before=original.elements.find(o=>o.id===e.id)!;
  expect(e).toEqual(e.id.endsWith('terrace-rail')?{...before,at:[before.at[0],4.2,before.at[2]]}:before);
 }
 expect(sceneRelationshipIssues(corrected)).toEqual([]);
});
it('still rejects a buried base, a floating base, a rail overrun, and removal of its supporting deck',()=>{
 for(const at of [[12,3.8,-4.8],[12,4.6,-4.8],[13,4.2,-4.8]])
  expect(()=>applySceneOperations(corrected,[{op:'move',id:'east-terrace-rail',at}])).toThrow('supporting deck');
 expect(()=>applySceneOperations(corrected,[{op:'remove',id:'east-terrace-deck'}])).toThrow('supporting deck');
});
it('round trips scoped edits without altering architecture or concealing plan inconsistencies',()=>{
 const edited=applySceneOperations(corrected,[{op:'move',id:'main-entrance',at:[.5,1.6,9.82]}]);
 expect(edited.elements.filter(e=>e.id!=='main-entrance')).toEqual(corrected.elements.filter(e=>e.id!=='main-entrance'));
 expect(validateScene(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
 const plan=JSON.parse(readFileSync(`${dir}/original.response.json`,'utf8')).output.architecturalPlan;
 expect(auditArchitecturalPlan(corrected,plan).issues).toContain('Enclosed floors retreat-floor and owner-floor overlap at the same datum; area cannot be counted twice.');
});
