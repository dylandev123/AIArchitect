/** Raw production-shaped semantic output. No runtime arrays or provider calls. */
const object = (id: string, type: string, x: number, z: number, baseElevation: number, width: number, depth: number, height: number, extra = {}) => ({ id, type, semanticRole: id, label: id, architecture: { x, z, baseElevation, width, depth, height }, material: { id: 'stone', color: '#c1b49c', surface: 'stone' }, ...extra });
const scene = (objects: ReturnType<typeof object>[], extra = {}) => ({ version: 3, site: { width: 120, depth: 120, baseElevation: 0 }, objects, relationships: [], ...extra });
const simple = [
  object('living', 'building-mass', 0, 0, 0, 12, 8, 3.4, { levels: 1, facadePreset: 'punched' }),
  object('roof', 'roof-form', 0, 0, 3.4, 12, 8, .4, { hostId: 'living', roofForm: 'gable', pitch: 22 }),
  object('glazing', 'glass-wall', 0, 4, .3, 7, .12, 2.7),
  object('porch', 'terrace', 0, 6, 0, 10, 4, .24),
  object('path', 'path', 0, -14, 0, 2, 20, .12),
  object('pool', 'pool', 0, 15, -1.4, 8, 4, 1.4),
];
const expressive = [
  ...simple,
  object('bedroom-wing', 'building-mass', 11, 2, 0, 8, 7, 3.2, { roofForm: 'mono-pitch', pitch: 12, facadePreset: 'privacy' }),
  object('breezeway', 'canopy', 6.5, 0, 0, 3, 5, 3.1, { hostId: 'living' }),
  object('timber-screen', 'custom-screen', -6, 1, .3, .2, 4, 2.6, { material: { id: 'timber', color: '#926541', surface: 'wood' } }),
  object('veranda', 'canopy', 0, 6, 0, 10, 4, 3.2, { hostId: 'living' }),
  object('pool-deck', 'terrace', 0, 15, -.2, 12, 8, .2),
  object('garden', 'landscape-zone', -15, 10, 0, 8, 16, .18),
  object('driveway', 'path', 20, -18, 0, 5, 32, .15),
];
const villa = [
  object('main', 'building-mass', 0, 0, 0, 16, 10, 6.8, { levels: 2, roofForm: 'floating-flat' }),
  object('west', 'building-mass', -13, 5, 0, 10, 14, 3.4, { levels: 1 }),
  object('east', 'building-mass', 13, 5, 0, 10, 14, 6.8, { levels: 2 }),
  object('balcony', 'balcony', 0, 7, 3.4, 10, 4, .24, { hostId: 'main' }),
  object('courtyard', 'courtyard', 0, 12, 0, 12, 10, .2),
  object('terrace', 'terrace', 0, 22, 0, 28, 8, .2),
  object('pool', 'pool', 0, 30, -1.4, 14, 5, 1.4),
  object('driveway', 'path', 25, -18, 0, 5, 35, .15),
  object('garden', 'landscape-zone', -26, 10, 0, 10, 28, .15),
];
const hillside = [
  object('hill', 'terrain-region', 0, 0, -1, 120, 120, 1, { terrainOperation: 'slopeRegion', terrainRise: 10, terrainDirection: '-z' }),
  object('lower', 'building-mass', 0, 8, 0, 18, 12, 3.4, { levels: 1 }),
  object('main', 'building-mass', 0, 0, 3.4, 24, 14, 6.8, { levels: 2, roofForm: 'floating-flat' }),
  object('upper-wing', 'building-mass', 19, -5, 6.8, 12, 12, 3.4, { levels: 1, roofForm: 'mono-pitch' }),
  object('arrival', 'terrace', 0, -22, 3.2, 24, 12, .2),
  object('driveway', 'path', 0, -40, 0, 6, 28, .15),
  object('retaining', 'retaining-wall', -18, 5, 0, .6, 24, 3.4),
  object('upper-terrace', 'terrace', 0, 11, 3.2, 26, 8, .2),
  object('lower-terrace', 'terrace', 0, 23, -.2, 28, 12, .2),
  object('stairs', 'stair', 17, 17, 0, 2, 9, 3.4),
  object('pool', 'pool', 0, 26, -1.4, 16, 5, 1.4),
  object('garden', 'landscape-zone', -28, 12, 0, 14, 30, .2),
];
export const regressionLadder = [
  { name: 'simple cottage', raw: scene(simple) },
  { name: 'expressive cottage', raw: scene(expressive) },
  { name: 'medium villa', raw: scene(villa) },
  { name: 'large hillside house', raw: scene(hillside) },
];
