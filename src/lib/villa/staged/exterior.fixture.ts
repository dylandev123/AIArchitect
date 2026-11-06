import type {ExteriorDesign} from './exterior';

/** DEVELOPER-AUTHORED MOCK of a Terra Stage 4 answer. Used only offline, to exercise the request/schema/derivation path. Not a model output. */
export const mockExteriorDesign = (): ExteriorDesign => ({
  statement: 'MOCK: terracotta hip roofs with deep eaves crown a cream-stucco villa on a honey-stone base.',
  roofFinish: 'terracotta', wallFinish: 'cream-stucco', stone: 'honey-stone', timber: 'teak',
  blockFinishes: [{block: 'main-living-plinth', finish: 'stone'}, {block: 'entry-pavilion', finish: 'stucco'}, {block: 'east-bedroom-wing', finish: 'stucco'}, {block: 'upper-bedroom-bar', finish: 'stucco'}, {block: 'upper-east-suite', finish: 'stucco'}],
  roofs: [{block: 'upper-bedroom-bar', form: 'hip', pitchDeg: 26, eaves: 'very-deep'}, {block: 'upper-east-suite', form: 'gable', pitchDeg: 24, eaves: 'deep'}, {block: 'entry-pavilion', form: 'hip', pitchDeg: 28, eaves: 'deep'}],
  facades: [{block: 'main-living-plinth', side: 's', style: 'glass-wall'}, {block: 'upper-bedroom-bar', side: 's', style: 'glass-wall'}, {block: 'entry-pavilion', side: 'n', style: 'punched'}],
  windowTrim: 'stone-and-shutters', railing: 'parapet', details: {plinth: true, cornice: true},
  entrance: {room: 'arrival-foyer', side: 'n', canopy: 'deep', portal: true, court: 'generous'},
  doors: [{room: 'great-room', side: 's', kind: 'garden'}],
  veranda: {openSpace: 'south-veranda', columns: 'stone-piers', spacing: 'generous', ceiling: 'timber-beams', roof: 'timber', deck: 'limestone'},
  intentions: ['MOCK'],
});
