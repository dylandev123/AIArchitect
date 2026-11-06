import type {ArchitecturalPlan} from './plan';
import {compositionFixture} from './compositions.fixture';
import {compositionFirstFixture} from './compositionFirst.fixture';
/** DEVELOPER-AUTHORED FIXTURES for roof and facade exposure. Not Terra output and no evidence that any model designs well. Each states the overhangs and
 * rhythms as an author would (one overhang per roof, rhythms on whole walls) and leaves the exposure to the compiler. */
export type ExposureFixture='compact'|'multilevel'|'multi-wing';
export const exposureFixtures:ExposureFixture[]=['compact','multilevel','multi-wing'];
export function exposureFixture(name:ExposureFixture):ArchitecturalPlan{
 if(name==='compact'){
  // One bay over another: a flat gallery roof and a hip over the sleep room, both given deep eaves; they meet along one wall.
  const p=compositionFixture('compact');
  p.roofs=[{space:'gallery',form:'flat',rise:.22,overhang:1},{space:'sleep-room',form:'hip',rise:.9,overhang:.7}];
  return p;
 }
 if(name==='multilevel'){
  // Two storeys on a rotated plan: a gable salon beside a taller stair hall, a hip over the upper gallery, a gable over the suite.
  const p=compositionFixture('waterfront');
  p.orientation=.4;
  const roof=(s:string)=>p.roofs.find(r=>r.space===s)!;
  Object.assign(roof('salon'),{form:'gable',rise:1.2,overhang:.6});Object.assign(roof('upper-gallery'),{form:'hip',rise:.9,overhang:0});Object.assign(roof('master-suite'),{form:'gable',rise:1});
  return p;
 }
 // Wings: a hip pavilion and a gable bar as building-scale roofs, with the porch and deck carrying room-owned roofs that meet the pavilion.
 const p=structuredClone(compositionFirstFixture('pavilion-court'));
 for(const r of p.roofs)r.overhang=.6;
 return p;
}
