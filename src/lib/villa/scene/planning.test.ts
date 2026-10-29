import { expect, it } from 'vitest';
import { auditArchitecturalPlan } from './planning';
import { laderaPlan } from './planning.fixture';
import { laderaScene } from './example';
import { resolveSceneResult, sceneProviderOutputSchema } from './terra';
it('measures only occupied floors, keeping terraces and double-height air out of area',()=>{
 const audit=auditArchitecturalPlan(laderaScene,laderaPlan);
 expect(audit.status).toBe('consistent');expect(audit.enclosedAreaM2).toBe(307);expect(audit.levels).toBe(2);
});
it('detects missing spaces, roof evidence, entrance and area without mutating geometry',()=>{
 const scene={...laderaScene,elements:laderaScene.elements.filter(e=>!['bridge-floor','east-roof','pivot-door'].includes(e.id))};
 const before=JSON.stringify(scene); const audit=auditArchitecturalPlan(scene,laderaPlan);
 expect(audit.status).toBe('incomplete');expect(audit.issues.join(' ')).toContain('bridge-floor');expect(audit.issues.join(' ')).toContain('east-roof');expect(audit.issues.join(' ')).toContain('pivot-door');expect(JSON.stringify(scene)).toBe(before);
});
it('detects false level counts, duplicate floor accounting and undersized important rooms',()=>{
 const plan=structuredClone(laderaPlan);plan.spaces[1].floorIds=['salon-floor'];plan.spaces[2].level=0;
 const issues=auditArchitecturalPlan(laderaScene,plan).issues.join(' ');
 expect(issues).toContain('counted more than once');expect(issues).toContain('differs from planned');expect(issues).toContain('levels');
});
it('accepts inconsistent planning with visible warnings while preserving legacy replay and scoped edits',()=>{
 const output={name:laderaScene.name,summary:'Complete',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))};
 expect(sceneProviderOutputSchema({mode:'generate',prompt:'House'}).safeParse(output).success).toBe(false);
 expect(resolveSceneResult({mode:'generate',prompt:'House'},{...output,architecturalPlan:{...laderaPlan,levels:3}}).architecturalAudit.issues.join(' ')).toContain('Planned 3 levels');
 expect(resolveSceneResult({mode:'generate',prompt:'Replay'},output).scene).toEqual(laderaScene);
});
it('does not count an open deck with a remote wall as an enclosed room',()=>{
 const scene={...laderaScene,elements:laderaScene.elements.filter(e=>!['salon-front','salon-west','salon-east'].includes(e.id))};
 expect(auditArchitecturalPlan(scene,laderaPlan).issues.join(' ')).toContain('perimeter samples lack enclosure');
});
it('detects duplicate coplanar floor geometry under different IDs',()=>{
 const floor=laderaScene.elements.find(e=>e.id==='salon-floor')!;
 const scene={...laderaScene,elements:[...laderaScene.elements,{...floor,id:'duplicate-floor'}]};
 const plan=structuredClone(laderaPlan);plan.spaces.push({...plan.spaces[0],name:'False extra room',floorIds:['duplicate-floor']});
 expect(auditArchitecturalPlan(scene,plan).issues.join(' ')).toContain('area cannot be counted twice');
});
it('measures parent-transformed spaces without requiring cardinal architecture',()=>{
 const root={...laderaScene.elements[0],id:'root',kind:'volume' as const,at:[50,0,-20] as [number,number,number],rotation:.73};
 const scene={...laderaScene,elements:[root,...laderaScene.elements.map(e=>({...e,parent:'root'}))]};
 expect(auditArchitecturalPlan(scene,laderaPlan).status).toBe('consistent');
});
