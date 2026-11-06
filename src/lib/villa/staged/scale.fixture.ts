/**
 * OFFLINE Phase 2 scale study (2026-11-06). Three briefs of very different size, answered by DEVELOPER-AUTHORED
 * stage slices written the way Terra would answer the CURRENT contracts (structured vision with a scale plan, block
 * heights/ranks, room programme, measured Stage 4/5 design intent). They prove CONSTRUCTION capability of the one
 * generator at every scale; they are NOT evidence of model creativity. Stages 4-5 choose only from what the measured
 * requests offer; software derives and validates all geometry. All three run through the same five-stage pipeline.
 */
import type {Designer, StageContext, StageNo} from './pipeline';
import type {Programme, ProgRoom} from './programme';
import type {ExteriorDesignV2} from './exterior';
import type {SiteDesignV2} from './siteContract';
import type {Side, Vision} from './spec';
import {exteriorWalls, roofableBlocks} from './exterior';
import {outdoorKind} from './intentions';

export type ScaleKey = 'modest' | 'villa' | 'estate';
export const SCALE_BRIEFS: Record<ScaleKey, string> = {
  modest: 'Design a simple single-storey Caribbean family home with three bedrooms and two bathrooms on a flat 40 by 32 metre lot. Keep it modest and well proportioned: calm hip roofs, a shaded front porch, an open kitchen, living and dining room onto a covered garden veranda, and a small garden with palms. No swimming pool.',
  villa: 'Design a substantial luxury two-storey Mediterranean villa with six bedrooms and seven bathrooms on a flat 90 by 70 metre site. Connect several wings around a double-height living room, with a grand double-height entrance hall, upper-level bedroom terraces, an upper master suite that projects over the arrival court, terracotta roofs stepping down from the living room, a shaded loggia and a large swimming pool.',
  estate: 'Design an extraordinary contemporary Caribbean luxury estate with seven bedroom suites on a spacious flat 150 by 120 metre property. Use multiple architectural wings with dramatic layering: a commanding double-height arrival hall on a formal arrival court, a vast double-height glass great room opening to a deep covered terrace, upper bedroom floors that step back to terraces and project over the court, generous suites, a family wing, a guest wing, a staff wing, a pool pavilion and a resort-scale swimming pool.',
};
export const SCALE_SITES: Record<ScaleKey, {width: number; depth: number}> = {modest: {width: 40, depth: 32}, villa: {width: 90, depth: 70}, estate: {width: 150, depth: 120}};

type Height = 'low' | 'standard' | 'tall' | 'double';
type Rank = 'primary' | 'secondary' | 'service' | 'entrance' | 'feature';
const block = (id: string, role: string, cx: number, cz: number, w: number, d: number, height: Height, rank: Rank, level: 0 | 1 = 0, open = false) => ({id, role, cx, cz, w, d, level, open, height, rank});
const outdoor = (id: string, role: string, cx: number, cz: number, w: number, d: number) => block(id, role, cx, cz, w, d, 'standard', 'secondary', 0, true);
const room = (id: string, blockId: string, type: ProgRoom['type'], area: number, priority: ProgRoom['priority'] = 'normal', facing: ProgRoom['facing'] = 'any'): ProgRoom => ({id, block: blockId, type, name: id.replace(/-/g, ' '), area, priority, facing});
const door = (a: string, b: string) => ({a, b, kind: 'door' as const});
const open = (a: string, b: string) => ({a, b, kind: 'open' as const});
const space = (name: string, kind: NonNullable<Vision['scale']>['principalSpaces'][number]['kind'], approxAreaM2: number, height: 'standard' | 'tall' | 'double' = 'standard') => ({name, kind, approxAreaM2, height});

const STAGE1: Record<ScaleKey, object> = {
  modest: {name: 'OFFLINE SCALE STUDY: Frangipani House', concept: 'A simple single-storey family home: a living bar and a bedroom wing under calm hip roofs, a shaded front porch and a covered veranda onto a small palm garden.',
    hierarchy: ['Living bar under the main hip roof', 'Bedroom wing', 'Garden veranda'], roofLanguage: 'Two calm terracotta hip roofs.', entrance: 'A shallow porch on the street side.', outdoorLiving: 'A timber veranda along the living room.', landscape: 'Palms and a lawn.',
    palette: {walls: 'ivory', accent: 'timber', roof: 'timber', deck: 'timber'},
    vision: {style: 'Caribbean family cottage', character: 'Simple, shaded, proportional', ambition: 'modest', ambitionEvidence: '"a simple single-storey Caribbean family home", "keep it modest"', composition: 'linear-bar', compositionIntent: 'Living bar and bedroom wing in one line, veranda on the garden side.',
      primaryVolume: 'The living bar', focalPoints: ['The garden veranda'], heightStrategy: 'uniform', roofStrategy: 'single-roof-family', entranceConcept: 'sheltered-porch',
      signatureFeatures: [{feature: 'covered-veranda', intent: 'Shaded outdoor living.'}], briefConstraints: ['single storey', 'three bedrooms, two bathrooms', 'no swimming pool'],
      scale: {footprintM2: 190, grossFloorAreaM2: 190, levels: 1, wings: 2, principalSpaces: [space('Open living, dining and kitchen', 'living', 60), space('Garden veranda', 'covered-terrace', 45)], scaleEvidence: 'Three bedrooms, two bathrooms, one storey, a modest lot: about 190 m².'}}},
  villa: {name: 'OFFLINE SCALE STUDY: Villa Le Terrazze', concept: 'A substantial Mediterranean villa of connected wings: a double-height living pavilion at the centre, a double-height entrance hall on the arrival court, two-storey bedroom wings whose upper floors step back to terraces, and an upper master suite projecting over the court.',
    hierarchy: ['Double-height living pavilion as the crown', 'Double-height entrance hall', 'West family wing with an upper bedroom floor stepping back to a terrace', 'East wing with the projecting upper master suite'],
    roofLanguage: 'Terracotta hips stepping down from the living pavilion.', entrance: 'A grand double-height hall with a deep portal on a formal arrival court.', outdoorLiving: 'A loggia off the living pavilion and a large pool south of the east wing.', landscape: 'Broad shade trees and layered beds.',
    palette: {walls: 'ivory', accent: 'limestone', roof: 'timber', deck: 'limestone'},
    vision: {style: 'Mediterranean villa', character: 'Substantial, layered, sunlit', ambition: 'luxury', ambitionEvidence: '"a substantial luxury two-storey Mediterranean villa with six bedrooms"', composition: 'central-hall-with-wings', compositionIntent: 'A central double-height living pavilion and entrance hall between two two-storey wings; upper floors step back to terraces beside the pavilion.',
      primaryVolume: 'The double-height living pavilion', focalPoints: ['The double-height living room', 'The entrance hall', 'The pool garden'], heightStrategy: 'pronounced-hierarchy', roofStrategy: 'primary-crown-with-lower-wings', entranceConcept: 'tall-entry-hall',
      signatureFeatures: [{feature: 'double-height-living', intent: 'A double-height living room under the crowning roof.'}, {feature: 'entrance-volume', intent: 'A double-height entrance hall.'}, {feature: 'roof-terrace', intent: 'Upper floors step back to bedroom terraces.'}, {feature: 'cantilevered-upper-volume', intent: 'The master suite projects over the arrival court.'}],
      briefConstraints: ['two storeys', 'six bedrooms, seven bathrooms', 'large swimming pool'],
      scale: {footprintM2: 764, grossFloorAreaM2: 1160, levels: 2, wings: 4, principalSpaces: [space('Entrance hall', 'entrance-hall', 100, 'double'), space('Living pavilion', 'living', 224, 'double'), space('Upper master suite', 'master-suite', 120), space('Bedroom terraces', 'upper-terrace', 80), space('Pool garden', 'pool-terrace', 220)], scaleEvidence: 'Six bedrooms, seven bathrooms, two storeys, luxury: about 1,160 m² over 764 m² of footprint.'}}},
  estate: {name: 'OFFLINE SCALE STUDY: Coral Ridge Estate', concept: 'An extraordinary Caribbean estate: a double-height glass great room at the heart, a commanding double-height arrival hall on a formal court, long two-storey family and master wings whose upper floors step back to terraces and project over the court, low guest and staff wings, a pool pavilion and a resort pool.',
    hierarchy: ['Double-height glass great room', 'Double-height arrival hall', 'Two-storey family and master wings with stepped and projecting upper floors', 'Low guest and staff wings', 'Pool pavilion'],
    roofLanguage: 'Flat stone-capped planes over the great room, hall and upper floors; gently pitched bronze roofs over the low wings and pool pavilion.', entrance: 'A commanding double-height arrival hall with a grand canopy on a formal arrival court.', outdoorLiving: 'A deep covered terrace off the great room, a resort pool beside the pool pavilion.', landscape: 'Palms, layered beds and open lawns.',
    palette: {walls: 'ivory', accent: 'limestone', roof: 'bronze', deck: 'timber'},
    vision: {style: 'Contemporary Caribbean estate', character: 'Commanding, layered, open to the garden', ambition: 'estate', ambitionEvidence: '"an extraordinary contemporary Caribbean luxury estate with seven bedroom suites"', composition: 'central-hall-with-wings', compositionIntent: 'A great room and arrival hall on the central axis between long two-storey wings; low wings and the pool pavilion extend the composition and form the arrival court and pool garden.',
      primaryVolume: 'The double-height glass great room', focalPoints: ['The great room and its covered terrace', 'The arrival hall', 'The resort pool'], heightStrategy: 'pronounced-hierarchy', roofStrategy: 'mixed-pitched-and-flat', entranceConcept: 'tall-entry-hall',
      signatureFeatures: [{feature: 'double-height-living', intent: 'A vast double-height great room.'}, {feature: 'glass-pavilion', intent: 'Floor-to-ceiling glass to the court and garden.'}, {feature: 'roof-terrace', intent: 'Upper floors step back to terraces beside the great room.'}, {feature: 'cantilevered-upper-volume', intent: 'The master floor projects over the arrival court.'}],
      briefConstraints: ['seven bedroom suites', 'two storeys', 'resort-scale swimming pool'],
      scale: {footprintM2: 2320, grossFloorAreaM2: 3100, levels: 2, wings: 7, principalSpaces: [space('Arrival hall', 'entrance-hall', 224, 'double'), space('Great room', 'living', 540, 'double'), space('Master suite', 'master-suite', 170), space('Covered terrace', 'covered-terrace', 240), space('Formal arrival court', 'arrival-court', 280), space('Resort pool garden', 'pool-terrace', 430), space('Upper terraces', 'upper-terrace', 190)], scaleEvidence: 'Seven suites, family, guest, staff and pool wings on 18,000 m²: about 3,100 m² over 2,320 m² of footprint.'}}},
};

// Coordinates: metres, x east, z south, origin at site centre. Arrival north, garden south.
const STAGE2: Record<ScaleKey, ReturnType<typeof block>[]> = {
  modest: [block('living-bar', 'Living bar: porch entry, kitchen, dining and living', 2, -3, 14, 8, 'standard', 'primary'), block('bedroom-wing', 'Bedroom wing', -10, -3, 10, 8, 'standard', 'secondary'),
    outdoor('garden-veranda', 'Covered garden veranda along the living bar', 2, 2.75, 14, 3.5)],
  villa: [block('entrance-hall', 'Double-height entrance hall', 0, -14, 10, 10, 'double', 'entrance'), block('living-pavilion', 'Double-height living pavilion', 0, -2, 16, 14, 'double', 'primary'),
    block('family-wing', 'West family wing: kitchen, family room, media and stair', -19, -6, 22, 10, 'standard', 'secondary'), block('west-bedrooms', 'Upper bedroom floor, stepped back to a terrace by the pavilion', -21, -6, 18, 10, 'standard', 'secondary', 1),
    block('east-wing', 'East wing: study, gym, guest suite and stair', 19, -6, 22, 10, 'standard', 'secondary'), block('master-floor', 'Upper master suite projecting over the arrival court', 21, -7, 18, 12, 'standard', 'secondary', 1),
    outdoor('living-loggia', 'Shaded loggia off the living pavilion', 0, 7.5, 16, 5), outdoor('pool-garden', 'Pool reservation south of the east wing', 19, 5, 22, 12)],
  estate: [block('arrival-hall', 'Commanding double-height arrival hall', 0, -22, 16, 14, 'double', 'entrance'), block('great-room', 'Double-height glass great room', 0, -6, 30, 18, 'double', 'primary'),
    block('family-wing', 'Family wing: kitchen, family room, media and stair', -33, -9, 36, 12, 'standard', 'secondary'), block('family-suites', 'Upper family suites, stepped back to a terrace', -36, -9, 30, 12, 'standard', 'secondary', 1),
    block('master-wing', 'Master wing: study, gym, cinema and stair', 35, -9, 40, 12, 'standard', 'secondary'), block('master-floor', 'Upper master floor projecting over the arrival court', 40, -10, 30, 14, 'standard', 'secondary', 1),
    block('guest-wing', 'Low guest wing', -44, 9, 14, 24, 'low', 'secondary'), block('staff-wing', 'Low staff and service wing', -44, -21, 14, 12, 'low', 'service'),
    block('pool-pavilion', 'Tall pool pavilion', 57, 3, 12, 12, 'tall', 'feature'),
    outdoor('great-veranda', 'Deep covered veranda off the great room', 0, 7, 30, 8), outdoor('resort-pool', 'Resort pool reservation beside the pool pavilion', 33, 3, 36, 12)],
};

const STAGE3: Record<ScaleKey, Programme> = {
  modest: {rooms: [room('foyer', 'living-bar', 'foyer', 8, 'core', 'n'), room('living', 'living-bar', 'living', 34, 'core', 's'), room('dining', 'living-bar', 'dining', 18, 'normal', 's'), room('kitchen', 'living-bar', 'kitchen', 20, 'normal', 'n'), room('bar-hall', 'living-bar', 'hall', 8, 'flex'),
    room('wing-hall', 'bedroom-wing', 'hall', 10, 'flex'), room('bedroom-one', 'bedroom-wing', 'bedroom', 15, 'core', 's'), room('bath-one', 'bedroom-wing', 'bath', 6), room('bedroom-two', 'bedroom-wing', 'bedroom', 12, 'core', 'n'), room('bedroom-three', 'bedroom-wing', 'bedroom', 12, 'core', 'w'), room('bath-two', 'bedroom-wing', 'bath', 5)],
  connections: [open('foyer', 'living'), open('living', 'dining'), open('dining', 'kitchen'), door('foyer', 'bar-hall'), door('bar-hall', 'wing-hall'), door('bedroom-one', 'bath-one'), door('wing-hall', 'bedroom-one'), door('wing-hall', 'bedroom-two'), door('wing-hall', 'bedroom-three'), door('wing-hall', 'bath-two')], stairs: [], intentions: ['Living opens to the veranda.']},
  villa: {rooms: [room('foyer', 'entrance-hall', 'foyer', 100, 'core', 'n'),
    room('living', 'living-pavilion', 'living', 150, 'core', 's'), room('dining', 'living-pavilion', 'dining', 74, 'normal', 's'),
    room('west-gallery', 'family-wing', 'gallery', 50, 'flex'), room('kitchen', 'family-wing', 'kitchen', 40, 'core', 'n'), room('family-room', 'family-wing', 'lounge', 50, 'normal', 's'), room('media', 'family-wing', 'media', 36, 'normal', 'n'), room('west-stair', 'family-wing', 'stair', 24, 'core'), room('powder', 'family-wing', 'bath', 8),
    room('west-landing', 'west-bedrooms', 'gallery', 40, 'flex'), room('bedroom-a', 'west-bedrooms', 'bedroom', 28, 'core', 's'), room('bath-a', 'west-bedrooms', 'bath', 10), room('bedroom-b', 'west-bedrooms', 'bedroom', 26, 'core', 's'), room('bath-b', 'west-bedrooms', 'bath', 9), room('bedroom-c', 'west-bedrooms', 'bedroom', 26, 'core', 'n'), room('bath-c', 'west-bedrooms', 'bath', 9),
    room('east-gallery', 'east-wing', 'gallery', 44, 'flex'), room('study', 'east-wing', 'lounge', 36, 'normal', 'n'), room('guest-bedroom', 'east-wing', 'bedroom', 32, 'core', 's'), room('guest-bath', 'east-wing', 'bath', 10), room('gym', 'east-wing', 'media', 34, 'normal', 'n'), room('east-stair', 'east-wing', 'stair', 24, 'core'),
    room('east-landing', 'master-floor', 'gallery', 36, 'flex'), room('master-bedroom', 'master-floor', 'bedroom', 50, 'core', 's'), room('master-bath', 'master-floor', 'bath', 24), room('master-sitting', 'master-floor', 'lounge', 34, 'normal', 'n'), room('bedroom-f', 'master-floor', 'bedroom', 30, 'core', 'e'), room('bath-f', 'master-floor', 'bath', 10)],
  connections: [open('foyer', 'living'), open('living', 'dining'), door('living', 'west-gallery'), door('dining', 'east-gallery'),
    door('west-gallery', 'kitchen'), open('west-gallery', 'family-room'), door('west-gallery', 'media'), door('west-gallery', 'west-stair'), door('west-gallery', 'powder'),
    door('west-landing', 'bedroom-a'), door('bedroom-a', 'bath-a'), door('west-landing', 'bedroom-b'), door('bedroom-b', 'bath-b'), door('west-landing', 'bedroom-c'), door('bedroom-c', 'bath-c'),
    door('east-gallery', 'study'), door('east-gallery', 'guest-bedroom'), door('guest-bedroom', 'guest-bath'), door('east-gallery', 'gym'), door('east-gallery', 'east-stair'),
    door('east-landing', 'master-bedroom'), door('master-bedroom', 'master-bath'), door('east-landing', 'master-sitting'), door('east-landing', 'bedroom-f'), door('bedroom-f', 'bath-f')],
  stairs: [{id: 'west-stair-flight', room: 'west-stair', landing: 'west-landing'}, {id: 'east-stair-flight', room: 'east-stair', landing: 'east-landing'}], intentions: ['The entrance hall opens straight into the double-height living room.', 'Bedrooms sit upstairs in two wings, each with its own stair.']},
  estate: {rooms: [room('foyer', 'arrival-hall', 'foyer', 224, 'core', 'n'),
    room('great-living', 'great-room', 'living', 300, 'core', 's'), room('great-dining', 'great-room', 'dining', 120, 'normal', 's'), room('bar-lounge', 'great-room', 'lounge', 120, 'normal', 'n'),
    room('family-gallery', 'family-wing', 'gallery', 80, 'flex'), room('kitchen', 'family-wing', 'kitchen', 70, 'core', 'n'), room('breakfast', 'family-wing', 'dining', 40, 'normal', 's'), room('family-room', 'family-wing', 'lounge', 100, 'normal', 's'), room('media-room', 'family-wing', 'media', 60, 'normal', 'n'), room('family-stair', 'family-wing', 'stair', 24, 'core'), room('family-powder', 'family-wing', 'bath', 8),
    room('family-landing', 'family-suites', 'gallery', 50, 'flex'), room('suite-one', 'family-suites', 'bedroom', 60, 'core', 's'), room('suite-one-bath', 'family-suites', 'bath', 18), room('suite-two', 'family-suites', 'bedroom', 56, 'core', 's'), room('suite-two-bath', 'family-suites', 'bath', 16), room('suite-three', 'family-suites', 'bedroom', 56, 'core', 'n'), room('suite-three-bath', 'family-suites', 'bath', 16), room('upper-family-lounge', 'family-suites', 'lounge', 60, 'normal', 'e'),
    room('master-gallery', 'master-wing', 'gallery', 90, 'flex'), room('study', 'master-wing', 'lounge', 120, 'normal', 'n'), room('gym', 'master-wing', 'media', 80, 'normal', 's'), room('cinema', 'master-wing', 'media', 90, 'normal', 'n'), room('spa', 'master-wing', 'bath', 40), room('master-stair', 'master-wing', 'stair', 24, 'core'), room('master-powder', 'master-wing', 'bath', 8),
    room('master-landing', 'master-floor', 'gallery', 60, 'flex'), room('master-bedroom', 'master-floor', 'bedroom', 90, 'core', 's'), room('master-bath', 'master-floor', 'bath', 50), room('master-dressing', 'master-floor', 'lounge', 60, 'normal'), room('master-sitting', 'master-floor', 'lounge', 70, 'normal', 'e'), room('suite-six', 'master-floor', 'bedroom', 50, 'core', 'n'), room('suite-six-bath', 'master-floor', 'bath', 16),
    room('guest-gallery', 'guest-wing', 'gallery', 50, 'flex'), room('guest-one', 'guest-wing', 'bedroom', 50, 'core', 'w'), room('guest-one-bath', 'guest-wing', 'bath', 16), room('guest-two', 'guest-wing', 'bedroom', 50, 'core', 's'), room('guest-two-bath', 'guest-wing', 'bath', 16), room('guest-lounge', 'guest-wing', 'lounge', 70, 'normal', 'e'), room('guest-kitchenette', 'guest-wing', 'kitchen', 30, 'normal', 'w'), room('guest-media', 'guest-wing', 'media', 40, 'normal', 'e'),
    room('staff-hall', 'staff-wing', 'hall', 30, 'flex'), room('staff-lounge', 'staff-wing', 'lounge', 60, 'normal', 'n'), room('staff-kitchen', 'staff-wing', 'kitchen', 40, 'normal', 'w'), room('staff-bath', 'staff-wing', 'bath', 10), room('staff-store', 'staff-wing', 'media', 30, 'normal', 'w'),
    room('pool-lounge', 'pool-pavilion', 'lounge', 100, 'core', 'e'), room('pool-bath', 'pool-pavilion', 'bath', 14), room('pool-bar', 'pool-pavilion', 'kitchen', 30, 'normal', 's')],
  connections: [open('foyer', 'great-living'), open('great-living', 'great-dining'), open('great-living', 'bar-lounge'), door('great-living', 'family-gallery'), door('great-living', 'master-gallery'),
    door('family-gallery', 'kitchen'), open('kitchen', 'breakfast'), open('family-gallery', 'family-room'), door('family-gallery', 'media-room'), door('family-gallery', 'family-stair'), door('family-gallery', 'family-powder'),
    door('family-landing', 'upper-family-lounge'), door('family-landing', 'suite-one'), door('suite-one', 'suite-one-bath'), door('family-landing', 'suite-two'), door('suite-two', 'suite-two-bath'), door('family-landing', 'suite-three'), door('suite-three', 'suite-three-bath'),
    door('master-gallery', 'study'), door('master-gallery', 'gym'), door('master-gallery', 'cinema'), door('master-gallery', 'spa'), door('master-gallery', 'master-stair'), door('master-gallery', 'master-powder'),
    door('master-landing', 'master-bedroom'), door('master-bedroom', 'master-bath'), door('master-bedroom', 'master-dressing'), door('master-landing', 'master-sitting'), door('master-landing', 'suite-six'), door('suite-six', 'suite-six-bath'),
    door('family-room', 'guest-gallery'), door('guest-gallery', 'guest-one'), door('guest-one', 'guest-one-bath'), door('guest-gallery', 'guest-two'), door('guest-two', 'guest-two-bath'), door('guest-gallery', 'guest-lounge'), open('guest-lounge', 'guest-kitchenette'), door('guest-gallery', 'guest-media'),
    door('kitchen', 'staff-hall'), door('staff-hall', 'staff-lounge'), door('staff-hall', 'staff-kitchen'), door('staff-hall', 'staff-bath'), door('staff-hall', 'staff-store'),
    door('gym', 'pool-lounge'), door('pool-lounge', 'pool-bath'), open('pool-lounge', 'pool-bar')],
  stairs: [{id: 'family-stair-flight', room: 'family-stair', landing: 'family-landing'}, {id: 'master-stair-flight', room: 'master-stair', landing: 'master-landing'}], intentions: ['The arrival hall opens on axis into the great room and its terrace.', 'Family, master, guest and staff life each have their own wing.']},
};

interface Look {entry: Side; garden: Side; roofs: Record<string, {form: 'hip' | 'gable' | 'flat'; pitchDeg: number; eaves: 'shallow' | 'deep' | 'very-deep'}>; finishes: Record<string, 'stucco' | 'stone' | 'timber-clad'>; glass: string[]; rest: Omit<ExteriorDesignV2, 'blockFinishes' | 'roofs' | 'facades' | 'entrance' | 'doors' | 'verandas' | 'intentions'> & {canopy: ExteriorDesignV2['entrance']['canopy']; portal: boolean; court: ExteriorDesignV2['entrance']['court']; columns: 'slender-bronze' | 'stone-piers' | 'timber-posts'; roof: 'limestone' | 'timber' | 'bronze'; deck: 'limestone' | 'timber'}}
const LOOK: Record<ScaleKey, Look> = {
  modest: {entry: 'n', garden: 's', roofs: {}, finishes: {}, glass: [],
    rest: {statement: 'OFFLINE SCALE STUDY: calm hip roofs, plain openings, a timber veranda.', roofFinish: 'terracotta', wallFinish: 'warm-white-stucco', stone: 'coral-stone', timber: 'teak', windowTrim: 'plain', railing: 'parapet', details: {plinth: false, cornice: false}, canopy: 'shallow', portal: false, court: 'compact', columns: 'timber-posts', roof: 'timber', deck: 'timber'}},
  villa: {entry: 'n', garden: 's', roofs: {'living-pavilion': {form: 'hip', pitchDeg: 30, eaves: 'deep'}, 'entrance-hall': {form: 'hip', pitchDeg: 26, eaves: 'deep'}, 'west-bedrooms': {form: 'hip', pitchDeg: 22, eaves: 'deep'}, 'master-floor': {form: 'hip', pitchDeg: 22, eaves: 'deep'}},
    finishes: {'entrance-hall': 'stone'}, glass: ['living-pavilion:s', 'living-pavilion:e', 'living-pavilion:w'],
    rest: {statement: 'OFFLINE SCALE STUDY: terracotta hips stepping down from the living pavilion; a stone double-height entrance hall.', roofFinish: 'aged-terracotta', wallFinish: 'cream-stucco', stone: 'pale-limestone', timber: 'dark-walnut', windowTrim: 'stone-and-shutters', railing: 'parapet', details: {plinth: true, cornice: true}, canopy: 'grand', portal: true, court: 'grand', columns: 'stone-piers', roof: 'timber', deck: 'limestone'}},
  estate: {entry: 'n', garden: 's', roofs: {'great-room': {form: 'flat', pitchDeg: 0, eaves: 'very-deep'}, 'arrival-hall': {form: 'flat', pitchDeg: 0, eaves: 'deep'}, 'family-suites': {form: 'flat', pitchDeg: 0, eaves: 'deep'}, 'master-floor': {form: 'flat', pitchDeg: 0, eaves: 'deep'}, 'guest-wing': {form: 'hip', pitchDeg: 18, eaves: 'deep'}, 'staff-wing': {form: 'hip', pitchDeg: 18, eaves: 'deep'}, 'pool-pavilion': {form: 'hip', pitchDeg: 20, eaves: 'very-deep'}},
    finishes: {'arrival-hall': 'stone', 'master-floor': 'timber-clad', 'family-suites': 'timber-clad'}, glass: ['great-room:s', 'great-room:n', 'pool-pavilion:w', 'family-wing:s', 'master-wing:s'],
    rest: {statement: 'OFFLINE SCALE STUDY: flat planes over glass and the upper floors, gently pitched bronze low wings.', roofFinish: 'warm-bronze', wallFinish: 'warm-white-stucco', stone: 'pale-limestone', timber: 'dark-walnut', windowTrim: 'stone-surrounds', railing: 'glass', details: {plinth: true, cornice: false}, canopy: 'grand', portal: true, court: 'grand', columns: 'slender-bronze', roof: 'limestone', deck: 'timber'}},
};

/** Chooses only from the measured request, as Terra does: listed walls, roofable blocks, retained open spaces. */
function exterior(k: ScaleKey, ctx: StageContext): ExteriorDesignV2 {
  const spec = ctx.draft, walls = exteriorWalls(spec), L = LOOK[k];
  const main = walls.find(w => w.type === 'foyer' && w.level === 0 && w.side === L.entry && w.free >= 2.4) ?? walls.find(w => w.type === 'foyer' && w.level === 0 && w.free >= 2.4);
  if (!main) throw Error('Scale study: the measured foyer has no usable exterior wall');
  const usable = walls.filter(w => w.level === 0 && w.free >= 2.1 && ['living', 'dining', 'lounge', 'bedroom', 'media'].includes(w.type));
  const ontoOpen = spec.openSpaces.filter(o => outdoorKind(o) !== 'pool').flatMap(o => usable.filter(w => w.outside.includes(o.id)).slice(0, 2));
  // One door onto the pool terrace (so its paving is reached dry), then garden-side doors.
  const ontoPool = spec.openSpaces.filter(o => outdoorKind(o) === 'pool').flatMap(o => usable.filter(w => w.outside.includes(o.id) && !ontoOpen.includes(w)).slice(0, 1));
  const garden = [...ontoOpen, ...ontoPool, ...usable.filter(w => w.side === L.garden && !ontoOpen.includes(w) && !ontoPool.includes(w))].slice(0, 9).map(w => ({room: w.room, side: w.side, kind: 'garden' as const}));
  // Upper rooms open onto the stepped-back roof terraces below them.
  const terrace = walls.filter(w => w.level === 1 && w.free >= 2.1 && w.outside.startsWith('roof terrace')).slice(0, 4).map(w => ({room: w.room, side: w.side, kind: 'terrace' as const}));
  const {canopy, portal, court, columns, roof, deck, ...rest} = L.rest;
  return {...rest,
    blockFinishes: spec.blocks.map(b => ({block: b.id, finish: L.finishes[b.id] ?? 'stucco'})),
    roofs: roofableBlocks(spec).map(b => ({block: b.id, ...(L.roofs[b.id] ?? {form: 'hip' as const, pitchDeg: 22, eaves: 'deep' as const})})),
    facades: [...spec.blocks.map(b => ({block: b.id, side: L.garden, style: L.glass.includes(`${b.id}:${L.garden}`) ? 'glass-wall' as const : 'large-windows' as const})),
      ...L.glass.filter(g => !g.endsWith(`:${L.garden}`)).map(g => ({block: g.split(':')[0], side: g.split(':')[1] as Side, style: 'glass-wall' as const})),
      ...spec.blocks.filter(b => !L.glass.includes(`${b.id}:${L.entry}`)).map(b => ({block: b.id, side: L.entry, style: 'punched' as const}))],
    entrance: {room: main.room, side: main.side, canopy, portal, court},
    doors: [...garden, ...terrace],
    verandas: spec.openSpaces.filter(o => outdoorKind(o) === 'veranda').map(o => ({openSpace: o.id, columns, spacing: 'generous' as const, ceiling: 'timber-beams' as const, roof, deck})),
    intentions: ['Generous glazing toward the garden; calmer walls toward arrival.']};
}

const STAGE5: Record<ScaleKey, SiteDesignV2> = {
  modest: {statement: 'OFFLINE SCALE STUDY: a small palm garden, no pool.', pool: {scale: 'none', anchor: 'veranda', separation: 'close', water: 'turquoise'}, terrace: {finish: 'warm-paving', sunbeds: 'none', social: 'dining'}, arrival: {finish: 'warm-paving', character: 'garden-court'}, planting: {trees: 'palm', count: 'four', stature: 'medium', beds: 'restrained', lawn: 'open-lawn'}, lighting: 'arrival-only', intentions: ['Palms shade the veranda.']},
  villa: {statement: 'OFFLINE SCALE STUDY: a large pool garden south of the east wing, shade trees along the arrival.', pool: {scale: 'lap', anchor: 'pool-intention', separation: 'promenade', water: 'deep-jade'}, terrace: {finish: 'limestone', sunbeds: 'four', social: 'dining-and-lounge'}, arrival: {finish: 'limestone', character: 'tree-avenue'}, planting: {trees: 'canopy', count: 'ten', stature: 'varied-tall', beds: 'layered', lawn: 'garden-panels'}, lighting: 'arrival-and-garden', intentions: ['Shade trees line the arrival.']},
  estate: {statement: 'OFFLINE SCALE STUDY: a resort pool beside the pool pavilion, palms along the arrival avenue.', pool: {scale: 'resort', anchor: 'pool-intention', separation: 'promenade', water: 'turquoise'}, terrace: {finish: 'limestone', sunbeds: 'four', social: 'dining-and-lounge'}, arrival: {finish: 'limestone', character: 'tree-avenue'}, planting: {trees: 'palm', count: 'ten', stature: 'varied-tall', beds: 'layered', lawn: 'open-lawn'}, lighting: 'arrival-and-garden', intentions: ['Palms line the arrival avenue.']},
};

/** Offline designer for one scale study. Every geometric consequence is derived and validated by the real pipeline. */
export class ScaleDesigner implements Designer {
  readonly label: string;
  readonly requests: StageNo[] = [];
  constructor(readonly key: ScaleKey) { this.label = `OFFLINE SCALE STUDY ${key}: developer-authored answers, zero provider calls`; }
  async design(stage: StageNo, ctx: StageContext) {
    this.requests.push(stage);
    const k = this.key, value: unknown = stage === 1 ? STAGE1[k] : stage === 2 ? {blocks: STAGE2[k]} : stage === 3 ? STAGE3[k] : stage === 4 ? exterior(k, ctx) : STAGE5[k];
    return {value: structuredClone(value), usage: {model: 'offline-study', inputTokens: 0, outputTokens: 0, costUsd: 0}};
  }
  async correct(): Promise<never> { throw Error('Offline scale study: no corrections'); }
}
