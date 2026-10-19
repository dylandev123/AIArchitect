/** Offline DEV/test fixtures at three house scales. Never used as runtime or persistence authority. */
import { compileArchitecture } from '@/lib/architecture/compiler';
import { ARCHITECTURE_FIXTURES } from '@/lib/architecture/fixtures';
import { DEFAULT_MATERIALS_CONFIG } from '@/types/house';
import type { MassVolume, MassOpening, MassRole, ArchitecturalDesignDocument } from '@/lib/architecture/document';
import { compileV3Scene, type V3Material, type V3Scene, type V3SceneObject } from '../scene';
import { cottageObject as obj, expressiveCottage } from './cottage';
import { builderOpening } from '../composition';

const render: V3Material = { id: 'render', color: '#e9e4da', surface: 'stucco', roughness: .82 };
const stone: V3Material = { id: 'stone', color: '#d3c9b8', surface: 'stone', roughness: .72 };
const timber: V3Material = { id: 'timber', color: '#9b7554', surface: 'wood' };
const roofMetal: V3Material = { id: 'roof', color: '#42494a', surface: 'metal', roughness: .55 };
const site = (width: number, depth: number, fixture: string) => ({ version: 3 as const, site: { width, depth, groundMaterial: { id: 'grass', color: '#68745a', surface: 'grass' as const } }, relationships: [], metadata: { fixture } });

/** ~250 m²: flat-roofed living pavilion, two-storey bedroom wing, timber garage, glazed entry link. */
export function mediumVilla(): V3Scene {
  return { ...site(80, 64, 'matched-medium-villa'), objects: [
    obj('main-living', 'building-mass', 0, 0, 16, 9, 3.8, .3, { levels: 1, material: render, roofForm: 'floating-flat', overhang: 1.4, composition: { openings: [
      { id: 'view', type: 'glazing-zone', facade: 'south', start: .05, end: .95, heightRatio: .92 },
      { id: 'garden', type: 'glazing-zone', facade: 'east', start: .5, end: .95, heightRatio: .92 },
      { id: 'kitchen', type: 'opening-rhythm', facade: 'north', count: 4, width: 1.4, height: 1.4, sill: 1 },
    ] } }),
    obj('bedroom-wing', 'building-mass', -13.5, -2.5, 10, 8, 6.6, .3, { levels: 2, material: stone, facadePreset: 'punched', facadeSouth: 'glass-heavy', roofForm: 'mono-pitch', pitch: 10, overhang: .9 }),
    obj('entry', 'building-mass', 9.25, -2.5, 2.5, 4, 3.2, .3, { levels: 1, material: render, facadePreset: 'solid', facadeNorth: 'glass-heavy', facadeSouth: 'glass-heavy', roofForm: 'floating-flat', overhang: .3 }),
    obj('garage', 'building-mass', 14, -3, 7, 7, 3.2, .3, { levels: 1, material: timber, facadePreset: 'solid', facadeNorth: 'punched', roofForm: 'flat', overhang: .4 }),
    obj('veranda', 'veranda', 0, 6.3, 16, 3.6, 3.4, .3, { material: timber }),
    obj('pool-deck', 'terrace', 0, 12.2, 22, 6, .25, 0),
    obj('pool', 'pool', 2, 12.2, 10, 3.2, 1.3, -1.05, { material: { id: 'water', color: '#348b9b', surface: 'water' } }),
    obj('entry-path', 'path', 9.25, -9, 1.8, 9, .12, 0),
    obj('driveway', 'path', 14, -14, 5, 15, .12, 0),
    obj('garden-west', 'landscape-zone', -24, 6, 8, 14, .15, 0),
  ] };
}

/** ~600 m²: two-storey hipped main house, gabled east wing, terraced timber west wing, detached guest pavilion. */
export function largeHouse(): V3Scene {
  return { ...site(110, 84, 'matched-large-house'), objects: [
    obj('main-living', 'building-mass', 0, 0, 22, 11, 7, .3, { levels: 2, material: render, composition: { openings: [
      { id: 'view', type: 'glazing-zone', facade: 'south', floors: 'ground', start: .04, end: .96, heightRatio: .9 },
      { id: 'upper-view', type: 'opening-rhythm', facade: 'south', floors: 'upper', count: 6, width: 1.8, height: 2, sill: .5 },
      { id: 'entry', type: 'door', facade: 'north', floors: 'ground', start: .44, end: .56, height: 2.8, reveal: .4 },
      { id: 'north-rhythm', type: 'opening-rhythm', facade: 'north', floors: 'upper', count: 5, width: 1.2, height: 1.5, sill: .9 },
      { id: 'east-rhythm', type: 'opening-rhythm', facade: 'east', count: 3, width: 1.2, height: 1.5, sill: .9 },
      { id: 'west-rhythm', type: 'opening-rhythm', facade: 'west', count: 3, width: 1.2, height: 1.5, sill: .9 },
    ] } }),
    obj('main-roof', 'roof-form', 0, 0, 22, 11, .3, 7.3, { hostId: 'main-living', roofForm: 'hip', pitch: 18, overhang: 1.2, material: roofMetal }),
    obj('east-wing', 'building-mass', 18, -2, 14, 9, 3.6, .3, { levels: 1, material: stone, facadePreset: 'punched', facadeSouth: 'glass-heavy', roofForm: 'gable', pitch: 20, overhang: 1 }),
    obj('west-wing', 'building-mass', -17.5, -3, 13, 10, 6.8, .3, { levels: 2, material: timber, facadePreset: 'punched', facadeSouth: 'glass-heavy', roofForm: 'terrace', overhang: .3 }),
    obj('guest-pavilion', 'building-mass', 22, 14, 8, 7, 3.3, .3, { levels: 1, material: render, facadePreset: 'punched', facadeWest: 'glass-heavy', roofForm: 'mono-pitch', pitch: 12, overhang: .9 }),
    obj('veranda', 'veranda', 0, 7.5, 22, 4, 3.4, .3, { material: timber }),
    obj('east-veranda', 'veranda', 18, 4, 14, 3, 3.1, .3, { material: timber }),
    obj('pool-deck', 'terrace', -2, 15.5, 28, 9, .25, 0),
    obj('pool', 'pool', 0, 15.5, 16, 4, 1.4, -1.15, { material: { id: 'water', color: '#348b9b', surface: 'water' } }),
    obj('entry-path', 'path', 0, -10, 2.4, 9, .12, 0),
    obj('driveway', 'path', 10, -22, 6, 16, .12, 0),
    obj('garden-west', 'landscape-zone', -36, 10, 10, 20, .15, 0),
  ] };
}

export const PARITY_FIXTURES = { cottage: expressiveCottage, villa: mediumVilla, large: largeHouse } as const;
export type ParityFixtureName = keyof typeof PARITY_FIXTURES;

const ROLE: [RegExp, MassRole][] = [[/living|main/, 'main-living'], [/bedroom|wing/, 'bedroom-wing'], [/guest/, 'guest-pavilion'], [/garage/, 'garage'], [/entry/, 'entry'], [/.*/, 'connector']];
type Facade = 'north' | 'east' | 'south' | 'west';

/** The facade of `host` a veranda abuts, and its span along it (0..1). */
function verandaFacade(host: V3SceneObject, v: V3SceneObject): { facade: Facade; start: number; end: number } | undefined {
  const h = host.architecture!, a = v.architecture!, gap = .3;
  const along = (lo: number, size: number, c: number, w: number) => ({ start: Math.max(0, (c - w / 2 - lo) / size), end: Math.min(1, (c + w / 2 - lo) / size) });
  const xs = along(h.x - h.width / 2, h.width, a.x, a.width), zs = along(h.z - h.depth / 2, h.depth, a.z, a.depth);
  const overlapX = a.x + a.width / 2 > h.x - h.width / 2 && a.x - a.width / 2 < h.x + h.width / 2, overlapZ = a.z + a.depth / 2 > h.z - h.depth / 2 && a.z - a.depth / 2 < h.z + h.depth / 2;
  if (overlapX && Math.abs(a.z - a.depth / 2 - (h.z + h.depth / 2)) < gap) return { facade: 'south', ...xs };
  if (overlapX && Math.abs(a.z + a.depth / 2 - (h.z - h.depth / 2)) < gap) return { facade: 'north', ...xs };
  if (overlapZ && Math.abs(a.x - a.width / 2 - (h.x + h.width / 2)) < gap) return { facade: 'east', ...zs };
  if (overlapZ && Math.abs(a.x + a.width / 2 - (h.x - h.width / 2)) < gap) return { facade: 'west', ...zs };
  return undefined;
}

/** V2 comparison input, derived from the same named intent. V2 has one global exterior and roof material. */
export function compileFixtureV2(scene: V3Scene) {
  const verandas = scene.objects.filter(o => o.type === 'veranda');
  const masses: MassVolume[] = scene.objects.filter(o => o.type === 'building-mass').map(o => {
    const a = o.architecture!, floors = o.levels ?? 1;
    const openings = o.composition?.openings?.map(builderOpening) ?? (['north', 'east', 'south', 'west'] as const).flatMap<MassOpening>(facade => {
      const preset = o[`facade${facade[0].toUpperCase() + facade.slice(1)}` as 'facadeNorth'] ?? o.facadePreset;
      if (preset === 'solid') return [];
      return preset === 'glass-heavy' ? [{ type: 'glazing-zone' as const, facade, start: .09, end: .91, heightRatio: .86 }] : [{ type: 'opening-rhythm' as const, facade, count: Math.max(1, Math.floor((facade === 'north' || facade === 'south' ? a.width : a.depth) / 2.4)), width: 1.2, height: 1.5, sill: .8 }];
    });
    const assemblies: NonNullable<MassVolume['assemblies']>[number][] = verandas.flatMap(v => {
      const span = verandaFacade(o, v); if (!span) return [];
      const va = v.architecture!, depth = span.facade === 'north' || span.facade === 'south' ? va.depth : va.width;
      const posts = Math.max(2, Math.ceil((span.end - span.start) * (span.facade === 'north' || span.facade === 'south' ? a.width : a.depth) / 3) + 1);
      return [{ id: v.id, intent: 'Deep covered veranda', parts: [
        { id: 'deck', type: 'slab' as const, level: 0, facade: span.facade, start: span.start, end: span.end, depth, thickness: .22 },
        { id: 'cover', type: 'slab' as const, level: 0, facade: span.facade, start: span.start, end: span.end, depth, thickness: .2, elevation: va.height - .2 },
        ...Array.from({ length: posts }, (_, i) => ({ id: 'post-' + i, type: 'post' as const, level: 0, facade: span.facade, at: span.start + (span.end - span.start) * i / (posts - 1), depth: depth - .12, height: va.height - .42, elevation: .22, size: .16 })),
        { id: 'header', type: 'beam' as const, level: 0, facade: span.facade, start: span.start, end: span.end, depth: depth - .12, height: .14, elevation: va.height - .34, thickness: .16 },
      ] }];
    });
    return { id: o.id, name: o.label, role: ROLE.find(([r]) => r.test(o.id))![1], position: { x: a.x, z: a.z }, width: a.width, depth: a.depth, height: a.height, floors, elevation: a.baseElevation, rotation: 0, openings, assemblies: assemblies.length ? assemblies : undefined };
  });
  const doc: ArchitecturalDesignDocument = { ...structuredClone(ARCHITECTURE_FIXTURES.modernTropicalCourtyardVilla), massing: { composition: 'pavilion-cluster', masses }, roofs: { recipes: masses.map(m => {
    const o = scene.objects.find(o => o.hostId === m.id && o.type === 'roof-form') ?? scene.objects.find(o => o.id === m.id)!;
    return { id: m.id + '-roof', massId: m.id, kind: o.roofForm === 'terrace' ? 'flat' : o.roofForm ?? 'flat', overhang: o.overhang ?? .75, pitch: o.pitch ?? 12, ...(o.roofForm === 'terrace' ? { parapet: { height: .6 } } : {}) };
  }) } };
  const result = compileArchitecture(doc, { materials: { ...DEFAULT_MATERIALS_CONFIG, exterior: { material: 'stone', color: stone.color }, roof: { material: 'metal', color: '#42494a' } } });
  // Controlled common site/amenity layer: deliberately excluded from V2 construction claims.
  const common = compileV3Scene({ ...scene, objects: scene.objects.filter(o => !['building-mass', 'roof-form', 'veranda'].includes(o.type)) });
  return { ...result, model: { ...result.model, primitives: [...common.primitives, ...result.model.primitives] } };
}
