import { COMPOSITION_EXAMPLES } from '../composition-examples';
import { buildComposition, validateComposition } from '../composition';
import type { PavilionPlacement } from './curved-pavilion';

const form: PavilionPlacement={id:'round-lounge',builder:'curved-pavilion@1',x:15,z:4,width:8,depth:6,height:3.5,orientation:25,material:'limestone'};
/** Offline studies opt in explicitly, without exposing experimental builders to Terra. */
export function experimentalExamples() {
  const horizon=structuredClone(COMPOSITION_EXAMPLES[0]);
  horizon.id='curve-horizon';horizon.name='Horizon · Curved garden lounge';horizon.character='An elliptical stone pavilion beside an open modern hall.';
  horizon.siteMode='derived';horizon.experimentalForms=[form];
  const breeze=structuredClone(COMPOSITION_EXAMPLES[1]);
  breeze.id='curve-breeze';breeze.name='Breeze · Rounded retreat';breeze.character='A smaller ivory pavilion completes the island garden.';
  breeze.siteMode='derived';breeze.experimentalForms=[{...form,x:17,z:9,width:6.5,depth:5,height:3.2,orientation:105,material:'ivory'}];
  return [horizon,breeze].map(c=>buildComposition(validateComposition(c)));
}
