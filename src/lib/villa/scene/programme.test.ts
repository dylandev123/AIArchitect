import {it,expect} from 'vitest';
import {programmeSchema,reviewProgramme} from './programme';
import {laderaScene} from './example';
import {reviewSceneArchitecture} from './planning';
it('exposes missing historical commitments without rewriting geometry',()=>{
 const before=JSON.stringify(laderaScene);
 expect(reviewProgramme(laderaScene).status).toBe('unrecorded');
 expect(reviewSceneArchitecture(laderaScene).issues.join(' ')).toContain('Programme construction commitments');
 expect(JSON.stringify(laderaScene)).toBe(before);
});
it('does not count narrative, dangling IDs or duplicated allocations as built rooms',()=>{
 const floor=laderaScene.elements.find(e=>e.kind==='plate')!;
 const entry={name:'Entertaining suite',zone:'public',strategy:'Allocate salon and connect terrace',floorIds:[floor.id],enclosureIds:['absent-wall'],roofIds:['absent-roof'],accessIds:[],limitation:''};
 expect(programmeSchema.safeParse([entry]).success).toBe(true);
 const scene={...laderaScene,architecturalPlan:{intendedSpaces:['Entertaining suite','Guest suite'],programme:[entry,{...entry,name:'Kitchen'}]}};
 const result=reviewProgramme(scene);
 expect(result.issues.join(' ')).toContain('Guest suite has no construction commitment');
 expect(result.issues.join(' ')).toContain('shared floor allocation');
 expect(result.issues.join(' ')).toContain('no access construction');
 expect(result.spaces.every(s=>!s.verifiedComplete)).toBe(true);
});
