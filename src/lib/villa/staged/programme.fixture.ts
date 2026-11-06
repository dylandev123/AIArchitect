import type {Programme, ProgRoom} from './programme';

type K = ProgRoom['type'];
const room = (id: string, block: string, type: K, area: number, priority: ProgRoom['priority'] = 'normal', facing: ProgRoom['facing'] = 'any', name = id.replace(/-/g, ' ')): ProgRoom => ({id, block, type, name, area, priority, facing});
const door = (a: string, b: string) => ({a, b, kind: 'door' as const});
const open = (a: string, b: string) => ({a, b, kind: 'open' as const});

/**
 * HIGH-LEVEL room programmes (no coordinates, no splits) for the real Terra-designed
 * Breezeway Courtyard Villa massing. These are what a model is asked to produce; the solver
 * builds every rectangle. They are developer-authored stand-ins until the live call.
 */
export const breezewayProgramme: Programme = {
  rooms: [
    room('arrival-foyer', 'entry-pavilion', 'foyer', 22, 'core', 'n'), room('entry-gallery', 'entry-pavilion', 'gallery', 18, 'flex'),
    room('great-living', 'main-living-plinth', 'living', 80, 'core', 's'), room('dining', 'main-living-plinth', 'dining', 36, 'normal', 's'),
    room('kitchen', 'main-living-plinth', 'kitchen', 34, 'normal'), room('stair-hall', 'main-living-plinth', 'stair', 26, 'core'), room('powder-room', 'main-living-plinth', 'bath', 8, 'core'),
    room('guest-bedroom', 'east-bedroom-wing', 'bedroom', 32, 'normal', 'e'), room('guest-bath', 'east-bedroom-wing', 'bath', 10, 'core'),
    room('east-gallery', 'east-bedroom-wing', 'gallery', 14, 'flex'), room('family-lounge', 'east-bedroom-wing', 'lounge', 40, 'flex', 's'),
    room('upper-landing', 'upper-bedroom-bar', 'hall', 28, 'flex'), room('bedroom-two', 'upper-bedroom-bar', 'bedroom', 30, 'normal', 'n'), room('bath-two', 'upper-bedroom-bar', 'bath', 10, 'core'),
    room('bedroom-three', 'upper-bedroom-bar', 'bedroom', 30, 'normal', 's'), room('bath-three', 'upper-bedroom-bar', 'bath', 10, 'core'),
    room('primary-hall', 'upper-east-suite', 'hall', 9, 'flex'), room('primary-bedroom', 'upper-east-suite', 'bedroom', 34, 'core', 'e'), room('primary-bath', 'upper-east-suite', 'bath', 12, 'core'),
  ],
  connections: [
    door('arrival-foyer', 'entry-gallery'), open('arrival-foyer', 'great-living'), open('great-living', 'dining'), open('dining', 'kitchen'),
    door('kitchen', 'stair-hall'), door('great-living', 'powder-room'), door('great-living', 'east-gallery'), door('east-gallery', 'guest-bedroom'),
    door('guest-bedroom', 'guest-bath'), open('east-gallery', 'family-lounge'),
    door('upper-landing', 'bedroom-two'), door('bedroom-two', 'bath-two'), door('upper-landing', 'bedroom-three'), door('bedroom-three', 'bath-three'),
    door('upper-landing', 'primary-hall'), door('primary-hall', 'primary-bedroom'), door('primary-bedroom', 'primary-bath'),
  ],
  stairs: [{id: 'main-stair', room: 'stair-hall', landing: 'upper-landing'}],
  intentions: ['Living and dining face the south veranda and pool.', 'Primary suite is a private upper wing reached through its own hall.'],
};
