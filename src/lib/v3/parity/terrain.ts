/**
 * Offline DEV/test terrain-audit fixtures. Never used as runtime or persistence authority.
 * Convention: north (-z) is uphill / road side, south (+z) is downhill / view side.
 */
import { cottageObject as obj } from './cottage';
import type { V3Scene, V3SceneObject, V3SceneSite } from '../scene';
import type { V3SiteConnection, V3SiteLevel, V3SiteTransition, V3RoutePoint } from '../siteHierarchy';

const render = { id: 'render', color: '#e6dfd1', surface: 'stucco' as const };
const stone = { id: 'stone', color: '#b9aa92', surface: 'stone' as const };
const paving = { id: 'paving', color: '#8f8a80', surface: 'paving' as const };
const water = { id: 'water', color: '#348b9b', surface: 'water' as const };
const timber = { id: 'timber', color: '#805b3e', surface: 'wood' as const };

const level = (id: string, elevation: number, x: number, z: number, width: number, depth: number, supportType: V3SiteLevel['supportType'] = 'pad', access?: V3SiteLevel['access']): V3SiteLevel =>
  ({ id, elevation, region: { x, z, width, depth }, supportType, role: id, ...(access ? { access } : {}) });
const drive = (id: string, from: string, to: string, route: V3RoutePoint[], width = 5, type: V3SiteConnection['type'] = 'driveway'): V3SiteConnection =>
  ({ id, fromLevelId: from, toLevelId: to, type, route, width, maxGrade: type === 'driveway' ? .15 : undefined });
const mass = (id: string, x: number, z: number, w: number, d: number, h: number, base: number, levelId?: string, extra: Partial<V3SceneObject> = {}) =>
  obj(id, 'building-mass', x, z, w, d, h, base, { material: render, levels: Math.max(1, Math.round(h / 3.4)), roofForm: 'floating-flat', overhang: .9, ...(levelId ? { support: { kind: 'pad', levelId } } : {}), ...extra });
const onLevel = (levelId: string) => ({ support: { kind: 'terrace' as const, levelId } });
/** Natural ground is high-level intent (fall + grade / profile / cliff + sea). V3 derives the surface. */
const meta = (fixture: string, width: number, depth: number, objects: V3SceneObject[], levels: V3SiteLevel[], connections: V3SiteConnection[], transitions: V3SiteTransition[] = [], ground: Partial<V3SceneSite> = {}): V3Scene =>
  ({ version: 3, site: { width, depth, groundMaterial: { id: 'grass', color: '#68745a', surface: 'grass' }, ...ground }, siteHierarchy: { levels, connections, transitions }, objects, relationships: [], metadata: { fixture } });

export function flatLot(): V3Scene {
  return meta('terrain-flat', 100, 100, [
    mass('house', 0, 0, 18, 11, 6.8, .25, 'house-pad'),
    obj('pool-deck', 'terrace', 0, 14, 24, 8, .25, 0, { material: stone, ...onLevel('garden') }),
    obj('pool', 'pool', 0, 14, 12, 4, 1.5, -1.25, { material: water }),
    obj('arrival-court', 'terrace', 14, -16, 14, 10, .2, 0, { material: paving, ...onLevel('arrival') }),
    obj('garden', 'landscape-zone', -24, 8, 10, 20, .15, 0),
  ], [
    level('road', 0, 0, -46, 100, 8, 'terrain', 'entry'), level('arrival', 0, 14, -16, 14, 10, 'pad', 'arrival'),
    level('house-pad', .25, 0, 0, 18, 11), level('garden', 0, 0, 14, 40, 10, 'terrace'),
  ], [
    drive('drive', 'road', 'arrival', [[14, 0, -45], [14, 0, -21]]),
    drive('walk', 'arrival', 'house-pad', [[10, 0, -12], [4, .25, -5]], 1.8, 'path'),
    drive('garden-walk', 'house-pad', 'garden', [[0, .25, 5], [0, 0, 10]], 1.8, 'path'),
  ]);
}

/** 5% fall north→south over 120 m: house, arrival and pool on graded pads. */
export function gentleSlope(): V3Scene {
  return meta('terrain-gentle', 120, 120, [
    mass('house', 0, 0, 18, 11, 6.8, .3, 'house-pad'),
    obj('pool-deck', 'terrace', 0, 16, 24, 8, .25, -1.05, { material: stone, ...onLevel('pool-terrace') }),
    obj('pool', 'pool', 0, 16, 12, 4, 1.5, -2.3, { material: water }),
    obj('arrival-court', 'terrace', 14, -20, 14, 10, .2, 1.0, { material: paving, ...onLevel('arrival') }),
    obj('garden', 'landscape-zone', -26, 10, 10, 20, .15, -.6),
  ], [
    level('road', 2.85, 0, -57, 120, 6, 'terrain', 'entry'), level('arrival', 1.2, 14, -20, 14, 10, 'pad', 'arrival'),
    level('house-pad', .3, 0, 0, 18, 11), level('pool-terrace', -.8, 0, 16, 24, 8, 'terrace'),
  ], [
    drive('drive', 'road', 'arrival', [[30, 2.85, -56], [24, 2.2, -40], [16, 1.2, -25]]),
    drive('walk', 'arrival', 'house-pad', [[10, 1.2, -16], [4, .3, -5]], 1.8, 'path'),
    drive('pool-steps', 'house-pad', 'pool-terrace', [[0, .3, 5], [0, -.8, 12]], 1.8, 'path'),
  ], [{ id: 'pool-edge', fromLevelId: 'house-pad', toLevelId: 'pool-terrace', type: 'graded-slope' }], { naturalGround: { fall: 'z', grade: .05 } });
}

/** 25% hillside: upper arrival, two-level house stepping down, pool terrace on fill, switchback drive. */
export function steepHillside(): V3Scene {
  return meta('terrain-hillside', 120, 120, [
    // Upper (entry) mass sits on the arrival-level pad; lower mass is embedded into the slope, its south face exposed.
    mass('upper-wing', 0, -8, 20, 9, 3.6, 2.2, 'upper-pad'),
    mass('lower-wing', 0, 2, 22, 11, 6.8, -1.2, 'lower-pad', { support: { kind: 'pad', levelId: 'lower-pad', grounding: 'embedded' } }),
    obj('cantilever-deck', 'terrace', 0, 9.5, 16, 4, .25, 2.2, { material: timber, support: { kind: 'object', hostId: 'lower-wing', relationship: 'cantilevered-from' } }),
    obj('pool-deck', 'terrace', 0, 17, 26, 9, .3, -1.5, { material: stone, ...onLevel('pool-terrace') }),
    obj('pool', 'pool', 0, 17, 14, 4, 1.5, -2.7, { material: water }),
    obj('arrival-court', 'terrace', 0, -20, 22, 12, .2, 2.0, { material: paving, ...onLevel('arrival') }),
    obj('pool-retaining', 'retaining-wall', 0, 21.8, 26, .5, 3, -6),
    obj('garden-west', 'landscape-zone', -30, 0, 14, 20, .15, 0),
  ], [
    level('road', 14, 0, -57, 120, 6, 'terrain', 'entry'), level('arrival', 2.2, 0, -20, 22, 12, 'pad', 'arrival'),
    level('upper-pad', 2.2, 0, -8, 20, 9), level('lower-pad', -1.2, 0, 2, 22, 11), level('pool-terrace', -1.2, 0, 17, 26, 9, 'terrace'),
  ], [
    // 11.8 m drop: one straight 12%-ish run is ~98 m, so the drive switchbacks across the slope, with a short turning leg at the hairpin.
    drive('drive', 'road', 'arrival', [[45, 14, -57], [-40, 9, -51], [-44, 8, -39], [-14, 4, -31], [0, 2.2, -26]]),
    drive('entry-walk', 'arrival', 'upper-pad', [[0, 2.2, -15], [0, 2.2, -11]], 2, 'path'),
    drive('house-stair', 'upper-pad', 'lower-pad', [[-9.5, 2.2, -6], [-9.5, -1.2, 2]], 1.4, 'path'),
    drive('stair', 'arrival', 'pool-terrace', [[10, 2.2, -16], [10, -1.2, 13]], 1.6, 'path'),
  ], [
    { id: 'pool-wall', fromLevelId: 'lower-pad', toLevelId: 'pool-terrace', type: 'retaining-edge', objectId: 'pool-retaining' },
    { id: 'upper-step', fromLevelId: 'upper-pad', toLevelId: 'lower-pad', type: 'retaining-edge' },
  ], { naturalGround: { fall: 'z', grade: .25 } });
}

/** Upper slope (5–10 %) breaking at z≈+27 into a 30 m sea cliff; independent sea plane at -32. */
export function cliffside(): V3Scene {
  return meta('terrain-cliff', 140, 180, [
    mass('main-house', 0, -6, 24, 12, 7.2, -.8, 'house-pad'),
    mass('guest-wing', -18, -12, 10, 10, 3.6, .2, 'guest-pad'),
    obj('infinity-deck', 'terrace', 0, 8, 30, 9, .3, -2.0, { material: stone, ...onLevel('pool-terrace') }),
    obj('infinity-pool', 'pool', 0, 10, 20, 4.5, 1.4, -3.1, { material: water }),
    obj('cliff-guard', 'fence', 0, 17, 60, .1, 1.1, -3.5, { material: { id: 'glass', color: '#9fb7c0', surface: 'glass', opacity: .4 } }),
    obj('arrival-court', 'terrace', 0, -30, 26, 12, .2, 1.3, { material: paving, ...onLevel('arrival') }),
    obj('terrace-retaining', 'retaining-wall', 0, 12.6, 30, .5, 2, -4),
    obj('lower-garden', 'landscape-zone', 32, 6, 16, 14, .15, -3),
    obj('upper-garden', 'landscape-zone', -40, -30, 20, 20, .15, 2),
  ], [
    level('road', 4.6, 0, -86, 140, 8, 'terrain', 'entry'), level('arrival', 1.5, 0, -30, 26, 12, 'pad', 'arrival'),
    level('house-pad', -.8, 0, -6, 24, 12), level('guest-pad', .2, -18, -12, 10, 10), level('pool-terrace', -1.7, 0, 8, 30, 9, 'terrace'),
  ], [
    drive('drive', 'road', 'arrival', [[50, 4.6, -84], [20, 2.8, -60], [0, 1.5, -36]]),
    drive('guest-walk', 'arrival', 'guest-pad', [[-12, 1.5, -25], [-16, .2, -16]], 2, 'path'),
    drive('house-walk', 'arrival', 'house-pad', [[0, 1.5, -24], [0, -.8, -12]], 2, 'path'),
    drive('pool-walk', 'house-pad', 'pool-terrace', [[10, -.8, 0], [10, -1.7, 4]], 2, 'path'),
  ], [{ id: 'terrace-edge', fromLevelId: 'house-pad', toLevelId: 'pool-terrace', type: 'retaining-edge', objectId: 'terrace-retaining' }], {
    naturalGround: { fall: 'z', profile: [[-90, 4.8], [-30, 1.4], [-6, -.9], [20, -3.2], [90, -5]], cliff: { at: 27, drop: 30, run: 9 } },
    sea: { level: -32 },
  });
}

/** Three cascading terraces (0, -2.5, -5) on a 15% slope with authored retaining walls between them. */
export function steppedTerraces(): V3Scene {
  return meta('terrain-stepped', 110, 110, [
    mass('house', 0, -12, 20, 11, 6.8, 0, 'top'),
    obj('mid-terrace', 'terrace', 0, 4, 34, 10, .2, -2.7, { material: stone, ...onLevel('middle') }),
    obj('pool', 'pool', 0, 18, 14, 4, 1.5, -6.3, { material: water }),
    obj('pool-deck', 'terrace', 0, 18, 30, 10, .2, -5.2, { material: stone, ...onLevel('bottom') }),
    obj('wall-1', 'retaining-wall', 0, -1.2, 34, .5, 3, -2.7),
    obj('wall-2', 'retaining-wall', 0, 12.6, 34, .5, 3, -5.2),
    obj('vineyard', 'landscape-zone', -32, 10, 16, 30, .15, -3),
  ], [
    level('road', 5.5, 0, -50, 110, 8, 'terrain', 'entry'), level('top', 0, 0, -14, 34, 16, 'pad', 'arrival'),
    level('middle', -2.5, 0, 4, 34, 10, 'terrace'), level('bottom', -5, 0, 18, 34, 10, 'terrace'),
  ], [
    drive('drive', 'road', 'top', [[40, 5.5, -48], [16, 1.6, -36], [12, 0, -22]]),
    drive('stair-1', 'top', 'middle', [[-14, 0, -6.5], [-14, -2.5, 0]], 1.6, 'path'),
    drive('stair-2', 'middle', 'bottom', [[14, -2.5, 8], [14, -5, 14]], 1.6, 'path'),
  ], [
    { id: 'step-1', fromLevelId: 'top', toLevelId: 'middle', type: 'retaining-edge', objectId: 'wall-1' },
    { id: 'step-2', fromLevelId: 'middle', toLevelId: 'bottom', type: 'retaining-edge', objectId: 'wall-2' },
  ], { naturalGround: { fall: 'z', elevation: -2.5, grade: .15 } });
}

export const TERRAIN_FIXTURES = { flat: flatLot, gentle: gentleSlope, hillside: steepHillside, cliff: cliffside, stepped: steppedTerraces } as const;
export type TerrainFixtureName = keyof typeof TERRAIN_FIXTURES;
