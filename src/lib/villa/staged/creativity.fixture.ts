/**
 * OFFLINE architectural-variety study (Phase 1, 2026-11-06). Three deliberately different briefs with
 * developer-authored stage answers written the way Terra would answer the CURRENT contracts (structured vision,
 * block heights and ranks, room programme, measured Stage 4/5 design intent). They are NOT AI design evidence.
 * Stages 4-5 choose only from what the measured requests offer; software derives and validates all geometry.
 */
import type {Designer, StageContext, StageNo} from './pipeline';
import type {Programme, ProgRoom} from './programme';
import type {ExteriorDesignV2} from './exterior';
import type {SiteDesignV2} from './siteContract';
import type {Side, Vision} from './spec';
import {exteriorWalls, roofableBlocks} from './exterior';
import {outdoorKind} from './intentions';

export type StudyKey = 'modest' | 'villa' | 'estate';
export const STUDY_BRIEFS: Record<StudyKey, string> = {
  modest: 'Design a modest single-storey Caribbean home with two bedrooms and one bathroom on a flat 40 by 34 metre site. Keep it simple and well proportioned: a pitched hip roof, a covered garden veranda, an open kitchen and living room, and a small garden with palms. No swimming pool.',
  villa: 'Design a luxurious two-storey Mediterranean villa with four bedrooms and four bathrooms on a flat 70 by 56 metre site. Give it a taller principal living volume, a prominent entrance, layered terracotta roofs and a sheltered courtyard. Use warm stucco and pale limestone, a shaded loggia, a generous swimming pool, a terrace and broad shade trees.',
  estate: 'Design a large contemporary Caribbean estate with five bedrooms and five bathrooms on a flat 96 by 72 metre site. Use differentiated wings of distinct heights, generous floor-to-ceiling glazing, flat and gently pitched roofs, a glass living pavilion, a deep covered veranda, a lap pool and a strong outdoor-living composition with palms.',
};
export const STUDY_SITES: Record<StudyKey, {width: number; depth: number}> = {modest: {width: 40, depth: 34}, villa: {width: 70, depth: 56}, estate: {width: 96, depth: 72}};

type Height = 'low' | 'standard' | 'tall' | 'double';
type Rank = 'primary' | 'secondary' | 'service' | 'entrance' | 'feature';
const block = (id: string, role: string, cx: number, cz: number, w: number, d: number, height: Height, rank: Rank, level: 0 | 1 = 0, open = false) => ({id, role, cx, cz, w, d, level, open, height, rank});
const outdoor = (id: string, role: string, cx: number, cz: number, w: number, d: number) => block(id, role, cx, cz, w, d, 'standard', 'secondary', 0, true);
const room = (id: string, blockId: string, type: ProgRoom['type'], area: number, priority: ProgRoom['priority'] = 'normal', facing: ProgRoom['facing'] = 'any'): ProgRoom => ({id, block: blockId, type, name: id.replace(/-/g, ' '), area, priority, facing});
const door = (a: string, b: string) => ({a, b, kind: 'door' as const});
const open = (a: string, b: string) => ({a, b, kind: 'open' as const});
const direction = (name: string, concept: string, hierarchy: string[], roofLanguage: string, entrance: string, outdoorLiving: string, landscape: string, palette: object, vision: Vision) => ({name, concept, hierarchy, roofLanguage, entrance, outdoorLiving, landscape, palette, vision});

const STAGE1: Record<StudyKey, object> = {
  modest: direction('OFFLINE STUDY: Breadfruit Cottage', 'A simple single-storey Caribbean home: one living bar and a short bedroom wing under calm hip roofs, opening to a shaded garden veranda.',
    ['Living bar under the main hip roof', 'Short bedroom wing', 'Garden veranda'], 'Two low terracotta hip roofs, the living roof slightly broader.', 'A modest covered door on the arrival side.', 'A timber veranda along the living room.', 'Palms and an open lawn.',
    {walls: 'ivory', accent: 'timber', roof: 'timber', roofColor: null, deck: 'timber'},
    {style: 'Vernacular Caribbean cottage', character: 'Simple, shaded, proportional', ambition: 'modest', ambitionEvidence: '"a modest single-storey Caribbean home", "keep it simple"', composition: 'linear-bar', compositionIntent: 'A living bar and a short bedroom wing in one line, the veranda along the garden side.',
      primaryVolume: 'The living bar holding kitchen, dining and living', focalPoints: ['The veranda off the living room'], heightStrategy: 'uniform', roofStrategy: 'single-roof-family', entranceConcept: 'sheltered-porch',
      signatureFeatures: [{feature: 'covered-veranda', intent: 'Shade and outdoor living along the garden.'}], briefConstraints: ['single storey', 'no swimming pool', 'hip roof']}),
  villa: direction('OFFLINE STUDY: Villa dei Cipressi', 'A luxurious Mediterranean villa around a sheltered courtyard: a double-height living pavilion crowns the composition, a tall stone entrance hall announces arrival, a two-storey family wing and a lower guest wing complete the U.',
    ['Double-height living pavilion as the crown', 'Tall stone entrance hall', 'Two-storey family wing', 'Low guest wing'], 'Layered terracotta hips: the pavilion highest, the family storey next, the entrance hall and guest wing stepping down.', 'A tall limestone entrance hall with a deep portal on the arrival court.', 'A loggia on the courtyard, a pool garden south of the pavilion.', 'Broad shade trees, layered beds.',
    {walls: 'ivory', accent: 'limestone', roof: 'timber', roofColor: null, deck: 'limestone'},
    {style: 'Mediterranean villa', character: 'Luxurious, layered, sheltered', ambition: 'luxury', ambitionEvidence: '"a luxurious two-storey Mediterranean villa"', composition: 'u-courtyard', compositionIntent: 'Family wing, living pavilion and guest wing embrace a courtyard open to the south garden.',
      primaryVolume: 'The double-height living pavilion', focalPoints: ['The courtyard loggia', 'The double-height living room', 'The entrance hall'], heightStrategy: 'pronounced-hierarchy', roofStrategy: 'primary-crown-with-lower-wings', entranceConcept: 'tall-entry-hall',
      signatureFeatures: [{feature: 'double-height-living', intent: 'A two-storey living room under the crowning roof.'}, {feature: 'entrance-volume', intent: 'A tall stone entrance hall between family wing and pavilion.'}, {feature: 'courtyard', intent: 'A garden court held on three sides.'}, {feature: 'layered-roofs', intent: 'Roofs stepping down from the pavilion.'}],
      briefConstraints: ['two storeys', 'four bedrooms, four bathrooms', 'sheltered courtyard']}),
  estate: direction('OFFLINE STUDY: Sea Grape Estate', 'A contemporary Caribbean estate of differentiated pavilions: a double-height glass living pavilion at the centre, a stone entry gallery, a master wing with a cantilevered upper suite and low pitched guest and service wings.',
    ['Double-height glass living pavilion', 'Cantilevered upper master suite', 'Stone entry gallery', 'Low guest and service wings'], 'Flat planes over the pavilion and master suite; gently pitched bronze roofs on the low wings.', 'A stone entry gallery set forward on the arrival court.', 'A deep covered veranda and a long lap pool.', 'Palms, layered beds and open lawn.',
    {walls: 'ivory', accent: 'limestone', roof: 'bronze', roofColor: null, deck: 'timber'},
    {style: 'Contemporary Caribbean estate', character: 'Open, horizontal, generous', ambition: 'estate', ambitionEvidence: '"a large contemporary Caribbean estate"', composition: 'pavilion-cluster', compositionIntent: 'A central glass pavilion with an entry gallery to the north and wings of distinct heights to east and west.',
      primaryVolume: 'The double-height glass living pavilion', focalPoints: ['The glass living pavilion', 'The lap pool terrace', 'The cantilevered master suite'], heightStrategy: 'pronounced-hierarchy', roofStrategy: 'mixed-pitched-and-flat', entranceConcept: 'prominent-entry-volume',
      signatureFeatures: [{feature: 'glass-pavilion', intent: 'Floor-to-ceiling glass on both long sides.'}, {feature: 'tall-principal-volume', intent: 'The pavilion is the tallest mass.'}, {feature: 'cantilevered-upper-volume', intent: 'The master suite projects beyond its base.'}, {feature: 'covered-veranda', intent: 'A deep veranda off the pavilion.'}],
      briefConstraints: ['five bedrooms, five bathrooms', 'flat and gently pitched roofs', 'lap pool']}),
};

// Coordinates: metres, x east, z south, origin at site centre.
const STAGE2: Record<StudyKey, ReturnType<typeof block>[]> = {
  modest: [block('living-bar', 'Living bar with kitchen, dining and living', 2, -2, 12, 8, 'standard', 'primary'), block('bedroom-wing', 'Short bedroom wing', -8, -2.5, 8, 7, 'standard', 'secondary'),
    outdoor('garden-veranda', 'Covered garden veranda along the living bar', 2, 4, 12, 4)],
  villa: [block('family-wing', 'Family wing: kitchen, dining and stair below', -6, -12, 20, 8, 'standard', 'secondary'), block('bedroom-storey', 'Upper bedroom storey over the family wing', -6, -12, 20, 8, 'standard', 'secondary', 1),
    block('entrance-hall', 'Tall stone entrance hall', 7, -12, 6, 8, 'tall', 'entrance'), block('living-pavilion', 'Double-height living pavilion', 11, -1, 14, 14, 'double', 'primary'),
    block('guest-wing', 'Low guest wing on the courtyard', -12, 0, 8, 16, 'low', 'secondary'),
    outdoor('court-loggia', 'Shaded loggia on the courtyard', 2.5, -1, 3, 10), outdoor('court-terrace', 'Courtyard terrace between the guest wing and the loggia', -3.5, 1, 9, 6), outdoor('pool-garden', 'Pool reservation south of the living pavilion', 11, 10, 14, 8)],
  estate: [block('living-pavilion', 'Double-height glass living pavilion', 0, 2, 18, 14, 'double', 'primary'), block('entry-gallery', 'Stone entry gallery', 0, -9, 10, 8, 'standard', 'entrance'),
    block('master-wing', 'Master wing: study, gym and stair', 18, 2, 18, 10, 'standard', 'secondary'), block('master-suite', 'Cantilevered upper master suite', 21.5, 2, 17, 10, 'standard', 'secondary', 1),
    block('guest-wing', 'Low guest wing', -18, 3, 18, 8, 'low', 'secondary'), block('service-wing', 'Low service and media wing', -20, -5, 14, 8, 'low', 'service'),
    outdoor('pavilion-veranda', 'Deep covered veranda off the pavilion', 0, 11.5, 18, 5), outdoor('lap-pool', 'Pool reservation for a lap pool south of the master wing', 19.5, 11.2, 18, 8.4)],
};

const STAGE3: Record<StudyKey, Programme> = {
  modest: {rooms: [room('foyer', 'living-bar', 'foyer', 8, 'core', 'n'), room('living', 'living-bar', 'living', 34, 'core', 's'), room('dining', 'living-bar', 'dining', 18, 'normal', 's'), room('kitchen', 'living-bar', 'kitchen', 22, 'normal', 'n'), room('bar-hall', 'living-bar', 'hall', 8, 'flex'),
    room('wing-hall', 'bedroom-wing', 'hall', 8, 'flex'), room('bedroom-one', 'bedroom-wing', 'bedroom', 16, 'core', 'n'), room('bedroom-two', 'bedroom-wing', 'bedroom', 14, 'core', 's'), room('bathroom', 'bedroom-wing', 'bath', 6)],
  connections: [open('foyer', 'living'), open('living', 'dining'), open('dining', 'kitchen'), door('foyer', 'bar-hall'), door('bar-hall', 'wing-hall'), door('wing-hall', 'bedroom-one'), door('wing-hall', 'bedroom-two'), door('wing-hall', 'bathroom')], stairs: [], intentions: ['Living opens to the veranda.']},
  villa: {rooms: [room('foyer', 'entrance-hall', 'foyer', 48, 'core', 'n'),
    room('kitchen', 'family-wing', 'kitchen', 36, 'core', 'n'), room('dining', 'family-wing', 'dining', 34, 'normal', 's'), room('stair-hall', 'family-wing', 'stair', 24, 'core'), room('ground-gallery', 'family-wing', 'gallery', 40, 'flex'), room('powder-room', 'family-wing', 'bath', 8),
    room('living', 'living-pavilion', 'living', 196, 'core', 's'),
    room('guest-gallery', 'guest-wing', 'gallery', 30, 'flex'), room('guest-bedroom', 'guest-wing', 'bedroom', 30, 'core', 'w'), room('guest-bath', 'guest-wing', 'bath', 10), room('study', 'guest-wing', 'media', 40, 'normal', 'e'),
    room('landing', 'bedroom-storey', 'gallery', 30, 'flex'), room('main-bedroom', 'bedroom-storey', 'bedroom', 36, 'core', 'n'), room('main-bath', 'bedroom-storey', 'bath', 14), room('bedroom-two', 'bedroom-storey', 'bedroom', 24, 'core', 's'), room('bedroom-three', 'bedroom-storey', 'bedroom', 24, 'core', 's'), room('family-bath', 'bedroom-storey', 'bath', 10)],
  connections: [open('foyer', 'living'), door('foyer', 'ground-gallery'), door('ground-gallery', 'kitchen'), open('kitchen', 'dining'), door('ground-gallery', 'stair-hall'), door('ground-gallery', 'powder-room'), door('ground-gallery', 'guest-gallery'),
    door('guest-gallery', 'guest-bedroom'), door('guest-bedroom', 'guest-bath'), door('guest-gallery', 'study'),
    door('landing', 'main-bedroom'), door('main-bedroom', 'main-bath'), door('landing', 'bedroom-two'), door('landing', 'bedroom-three'), door('landing', 'family-bath')],
  stairs: [{id: 'main-stair', room: 'stair-hall', landing: 'landing'}], intentions: ['Every principal room looks into the courtyard.', 'The living pavilion is one double-height room.']},
  estate: {rooms: [room('foyer', 'entry-gallery', 'foyer', 30, 'core', 'n'), room('entry-hall', 'entry-gallery', 'gallery', 50, 'flex'),
    room('living', 'living-pavilion', 'living', 140, 'core', 's'), room('dining', 'living-pavilion', 'dining', 64, 'normal', 's'), room('kitchen', 'living-pavilion', 'kitchen', 48, 'normal', 'n'),
    room('master-hall', 'master-wing', 'gallery', 40, 'flex'), room('study', 'master-wing', 'lounge', 34, 'normal', 's'), room('gym', 'master-wing', 'media', 34, 'normal', 'n'), room('stair-hall', 'master-wing', 'stair', 24, 'core'), room('powder-room', 'master-wing', 'bath', 8),
    room('landing', 'master-suite', 'gallery', 30, 'flex'), room('master-bedroom', 'master-suite', 'bedroom', 46, 'core', 's'), room('master-bath', 'master-suite', 'bath', 20), room('sitting-room', 'master-suite', 'lounge', 30, 'normal', 'e'), room('bedroom-two', 'master-suite', 'bedroom', 26, 'core', 'n'), room('bath-two', 'master-suite', 'bath', 10),
    room('guest-gallery', 'guest-wing', 'gallery', 30, 'flex'), room('guest-one', 'guest-wing', 'bedroom', 26, 'core', 's'), room('guest-two', 'guest-wing', 'bedroom', 26, 'core', 's'), room('guest-three', 'guest-wing', 'bedroom', 26, 'core', 'n'), room('guest-bath-one', 'guest-wing', 'bath', 8), room('guest-bath-two', 'guest-wing', 'bath', 8), room('guest-bath-three', 'guest-wing', 'bath', 8),
    room('service-hall', 'service-wing', 'hall', 24, 'flex'), room('media-room', 'service-wing', 'media', 56, 'core', 'n'), room('staff-bath', 'service-wing', 'bath', 8)],
  connections: [open('foyer', 'entry-hall'), open('entry-hall', 'living'), open('living', 'dining'), open('dining', 'kitchen'), door('living', 'master-hall'), door('master-hall', 'study'), door('master-hall', 'gym'), door('master-hall', 'stair-hall'), door('master-hall', 'powder-room'),
    door('landing', 'master-bedroom'), door('master-bedroom', 'master-bath'), door('landing', 'sitting-room'), door('landing', 'bedroom-two'), door('landing', 'bath-two'),
    door('living', 'guest-gallery'), door('guest-gallery', 'guest-one'), door('guest-gallery', 'guest-two'), door('guest-gallery', 'guest-three'), door('guest-one', 'guest-bath-one'), door('guest-two', 'guest-bath-two'), door('guest-three', 'guest-bath-three'),
    door('guest-gallery', 'service-hall'), door('service-hall', 'media-room'), door('service-hall', 'staff-bath')],
  stairs: [{id: 'master-stair', room: 'stair-hall', landing: 'landing'}], intentions: ['The pavilion is glazed on both long sides.', 'Bedrooms are grouped in quiet wings.']},
};

interface Look {entry: Side; garden: Side; roofs: Record<string, {form: 'hip' | 'gable' | 'flat'; pitchDeg: number; eaves: 'shallow' | 'deep' | 'very-deep'}>; finishes: Record<string, 'stucco' | 'stone' | 'timber-clad'>; glass: string[]; rest: Omit<ExteriorDesignV2, 'blockFinishes' | 'roofs' | 'facades' | 'entrance' | 'doors' | 'verandas' | 'intentions'> & {canopy: 'none' | 'shallow' | 'deep'; portal: boolean; court: 'compact' | 'generous'; columns: 'slender-bronze' | 'stone-piers' | 'timber-posts'; roof: 'limestone' | 'timber' | 'bronze'; deck: 'limestone' | 'timber'}}
const LOOK: Record<StudyKey, Look> = {
  modest: {entry: 'n', garden: 's', roofs: {'living-bar': {form: 'hip', pitchDeg: 24, eaves: 'deep'}, 'bedroom-wing': {form: 'hip', pitchDeg: 24, eaves: 'deep'}}, finishes: {}, glass: [],
    rest: {statement: 'OFFLINE STUDY: simple hip roofs, plain openings, a timber veranda.', roofFinish: 'terracotta', wallFinish: 'warm-white-stucco', stone: 'coral-stone', timber: 'teak', windowTrim: 'plain', railing: 'parapet', details: {plinth: false, cornice: false}, canopy: 'shallow', portal: false, court: 'compact', columns: 'timber-posts', roof: 'timber', deck: 'timber'}},
  villa: {entry: 'n', garden: 's', roofs: {'bedroom-storey': {form: 'hip', pitchDeg: 24, eaves: 'deep'}, 'entrance-hall': {form: 'hip', pitchDeg: 26, eaves: 'deep'}, 'living-pavilion': {form: 'hip', pitchDeg: 30, eaves: 'deep'}, 'guest-wing': {form: 'hip', pitchDeg: 22, eaves: 'deep'}},
    finishes: {'entrance-hall': 'stone'}, glass: ['living-pavilion:s', 'living-pavilion:w'],
    rest: {statement: 'OFFLINE STUDY: terracotta hips stepping down from the living pavilion; a stone entrance hall.', roofFinish: 'aged-terracotta', wallFinish: 'cream-stucco', stone: 'pale-limestone', timber: 'dark-walnut', windowTrim: 'stone-and-shutters', railing: 'parapet', details: {plinth: true, cornice: true}, canopy: 'deep', portal: true, court: 'generous', columns: 'stone-piers', roof: 'timber', deck: 'limestone'}},
  estate: {entry: 'n', garden: 's', roofs: {'living-pavilion': {form: 'flat', pitchDeg: 0, eaves: 'very-deep'}, 'entry-gallery': {form: 'flat', pitchDeg: 0, eaves: 'deep'}, 'master-suite': {form: 'flat', pitchDeg: 0, eaves: 'deep'}, 'guest-wing': {form: 'hip', pitchDeg: 16, eaves: 'deep'}, 'service-wing': {form: 'hip', pitchDeg: 16, eaves: 'deep'}},
    finishes: {'entry-gallery': 'stone', 'master-suite': 'timber-clad'}, glass: ['living-pavilion:s', 'living-pavilion:n', 'master-wing:s', 'master-suite:s'],
    rest: {statement: 'OFFLINE STUDY: flat planes over glass, gently pitched bronze wings.', roofFinish: 'warm-bronze', wallFinish: 'warm-white-stucco', stone: 'pale-limestone', timber: 'dark-walnut', windowTrim: 'plain', railing: 'glass', details: {plinth: false, cornice: false}, canopy: 'deep', portal: false, court: 'generous', columns: 'slender-bronze', roof: 'limestone', deck: 'timber'}},
};

/** Chooses only from the measured request, as Terra does: listed walls, roofable blocks, retained open spaces. */
function exterior(k: StudyKey, ctx: StageContext): ExteriorDesignV2 {
  const spec = ctx.draft, walls = exteriorWalls(spec), L = LOOK[k];
  const main = walls.find(w => w.type === 'foyer' && w.level === 0 && w.side === L.entry && w.free >= 2.4) ?? walls.find(w => w.type === 'foyer' && w.level === 0 && w.free >= 2.4);
  if (!main) throw Error('Study: the measured foyer has no usable exterior wall');
  // Doors onto every retained outdoor room first (one per open space), then garden-side doors.
  const usable = walls.filter(w => w.level === 0 && w.free >= 2.1 && ['living', 'dining', 'lounge', 'bedroom', 'media'].includes(w.type));
  const ontoOpen = spec.openSpaces.filter(o => outdoorKind(o) !== 'pool').flatMap(o => usable.filter(w => w.outside.includes(o.id)).slice(0, 1));
  const garden = [...ontoOpen, ...usable.filter(w => w.side === L.garden && !ontoOpen.includes(w))].slice(0, 5).map(w => ({room: w.room, side: w.side, kind: 'garden' as const}));
  const terrace = walls.filter(w => w.level === 1 && w.free >= 2.1 && w.outside.startsWith('roof terrace')).slice(0, 2).map(w => ({room: w.room, side: w.side, kind: 'terrace' as const}));
  const {canopy, portal, court, columns, roof, deck, ...rest} = L.rest;
  return {...rest,
    blockFinishes: spec.blocks.map(b => ({block: b.id, finish: L.finishes[b.id] ?? 'stucco'})),
    roofs: roofableBlocks(spec).map(b => ({block: b.id, ...(L.roofs[b.id] ?? {form: 'hip' as const, pitchDeg: 22, eaves: 'deep' as const})})),
    facades: [...spec.blocks.map(b => ({block: b.id, side: L.garden, style: L.glass.includes(`${b.id}:${L.garden}`) ? 'glass-wall' as const : 'large-windows' as const})),
      ...L.glass.filter(g => !g.endsWith(`:${L.garden}`)).map(g => ({block: g.split(':')[0], side: g.split(':')[1] as Side, style: 'glass-wall' as const})),
      ...spec.blocks.filter(b => !L.glass.includes(`${b.id}:${L.entry}`)).map(b => ({block: b.id, side: L.entry, style: 'punched' as const}))],
    entrance: {room: main.room, side: main.side, canopy, portal, court},
    doors: [...garden, ...terrace].slice(0, 7),
    verandas: spec.openSpaces.filter(o => outdoorKind(o) === 'veranda').map(o => ({openSpace: o.id, columns, spacing: 'generous' as const, ceiling: 'timber-beams' as const, roof, deck})),
    intentions: ['Generous glazing toward the garden; calmer walls toward arrival.']};
}

const STAGE5: Record<StudyKey, SiteDesignV2> = {
  modest: {statement: 'OFFLINE STUDY: a small palm garden, no pool.', pool: {scale: 'none', anchor: 'veranda', separation: 'close', water: 'turquoise'}, terrace: {finish: 'warm-paving', sunbeds: 'none', social: 'dining'}, arrival: {finish: 'warm-paving', character: 'garden-court'}, planting: {trees: 'palm', count: 'four', stature: 'medium', beds: 'restrained', lawn: 'open-lawn'}, lighting: 'arrival-only', intentions: ['Palms shade the veranda.']},
  villa: {statement: 'OFFLINE STUDY: a generous pool garden south of the pavilion, shade trees around the court.', pool: {scale: 'generous', anchor: 'pool-intention', separation: 'promenade', water: 'deep-jade'}, terrace: {finish: 'limestone', sunbeds: 'two', social: 'dining-and-lounge'}, arrival: {finish: 'limestone', character: 'tree-avenue'}, planting: {trees: 'canopy', count: 'eight', stature: 'varied-tall', beds: 'layered', lawn: 'garden-panels'}, lighting: 'arrival-and-garden', intentions: ['Shade trees line the arrival.']},
  estate: {statement: 'OFFLINE STUDY: a lap pool terrace and palms.', pool: {scale: 'lap', anchor: 'pool-intention', separation: 'promenade', water: 'turquoise'}, terrace: {finish: 'limestone', sunbeds: 'two', social: 'dining-and-lounge'}, arrival: {finish: 'limestone', character: 'tree-avenue'}, planting: {trees: 'palm', count: 'ten', stature: 'varied-tall', beds: 'layered', lawn: 'open-lawn'}, lighting: 'arrival-and-garden', intentions: ['Palms line the drive.']},
};

/** Offline designer for one study. `flatten` reproduces what the generator could build before heights existed. */
export class StudyDesigner implements Designer {
  readonly label: string;
  readonly requests: StageNo[] = [];
  constructor(readonly key: StudyKey, readonly opts: {flatten?: boolean; stage2?: (blocks: ReturnType<typeof block>[]) => unknown[]} = {}) { this.label = `OFFLINE STUDY ${key}${opts.flatten ? ' (heights removed)' : ''}: authored answers, zero provider calls`; }
  async design(stage: StageNo, ctx: StageContext) {
    this.requests.push(stage);
    const k = this.key;
    let blocks = STAGE2[k].map(b => this.opts.flatten ? {...b, height: 'standard' as const} : b);
    if (this.opts.stage2) blocks = this.opts.stage2(blocks) as typeof blocks;
    const value: unknown = stage === 1 ? STAGE1[k] : stage === 2 ? {blocks} : stage === 3 ? STAGE3[k] : stage === 4 ? exterior(k, ctx) : STAGE5[k];
    return {value: structuredClone(value), usage: {model: 'offline-study', inputTokens: 0, outputTokens: 0, costUsd: 0}};
  }
  async correct(): Promise<never> { throw Error('Offline study: no corrections'); }
}
