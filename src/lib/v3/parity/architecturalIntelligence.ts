/** Independent OFFLINE examples. Never imported by prompts, generation or project loading. */
import { expandPlanAuthoring } from '../architecturalPlanAuthoring';
import type { V3ArchitecturalPlan } from '../architecturalPlanFirst';
import { formalArrivalEstate, articulatedWingsResidence, referenceExterior } from './expressiveEstate';

const room = (id: string, program: string, x: number, z: number, width: number, depth: number) =>
  ({id, label: id.replaceAll('-', ' '), program, footprint: {x, z, width, depth}});
const entry = (id: string, facade: string, start: number, end: number, serves: string) =>
  ({id, type: 'door', facade, start, end, serves});
const parse = (raw: unknown): V3ArchitecturalPlan => {
  const parsed = expandPlanAuthoring(raw);
  if (!parsed.success) throw Error(JSON.stringify(parsed.error.issues));
  return parsed.data;
};

export function compactGardenHome() {
  return parse({format: 'v3-architectural-plan-1',
    concept: 'OFFLINE REFERENCE — A compact garden home: a modest rectangular shell keeps construction simple. The south entry hall gives separate access to sleeping, bathing and cooking; a full-width north living room opens to the garden terrace. No luxury amenities are imposed.',
    site: {width: 36, depth: 36, access: [{id: 'compact-gate', boundary: 'south', point: [0, 0, 18]}]},
    buildings: [{id: 'compact-home', label: 'Compact garden home', location: {x: 0, z: 0}, plan: {kind: 'rectangle', width: 10, depth: 8},
      storeys: [{id: 'compact-floor', label: 'Garden floor', spaces: [
        room('compact-living', 'living dining', 0, -2, 10, 4), room('compact-hall', 'entry circulation', 0, 2, 2, 4),
        room('compact-bedroom', 'bedroom', -3, 2, 4, 4), room('compact-kitchen', 'kitchen', 3, 1, 4, 2), room('compact-bath', 'bathroom', 3, 3, 4, 2),
      ]}], accessOpenings: [entry('compact-entry', 'south', .44, .56, 'compact-hall'), {...entry('compact-garden-door', 'north', .4, .6, 'compact-living'), type: 'glazed-door', operation: 'sliding'}]}],
    features: [{id: 'compact-terrace', label: 'Living garden terrace', type: 'terrace', location: {x: 0, z: -8}, width: 10, depth: 6}],
    connections: [{id: 'compact-arrival', purpose: 'Gate to entry hall', from: {kind: 'site-access', accessId: 'compact-gate'}, to: {kind: 'entrance', entranceId: 'compact-entry'}, use: 'pedestrian', width: 1.2},
      {id: 'compact-garden-link', purpose: 'Living to terrace', from: {kind: 'entrance', entranceId: 'compact-garden-door'}, to: {kind: 'surface', objectId: 'compact-terrace', local: [0, 3]}, use: 'pedestrian', width: 1.2}],
    roomAdjacencies: ['compact-living', 'compact-bedroom', 'compact-kitchen', 'compact-bath'].map(to => ({from: 'compact-hall', to})),
  });
}

export function caribbeanVerandaHome() {
  return parse({format: 'v3-architectural-plan-1',
    concept: 'OFFLINE REFERENCE — A Caribbean vernacular veranda house with a simple pitched metal roof. A shaded south veranda and a continuous entry gallery face the garden, while the living room separates the private bedroom/bath from kitchen and utility. The style is carried by the veranda, low roof and shaded openings, without imitating a mansion.',
    site: {width: 64, depth: 48, access: [{id: 'veranda-gate', boundary: 'south', point: [0, 0, 24]}]},
    buildings: [{id: 'veranda-home', label: 'Caribbean veranda home', location: {x: 0, z: 0}, plan: {kind: 'rectangle', width: 16, depth: 12},
      storeys: [{id: 'veranda-floor', label: 'Veranda and garden floor', spaces: [
        room('veranda-gallery', 'entry circulation gallery', 0, 5, 16, 2), room('veranda-salon', 'living dining', 0, -1, 8, 10),
        room('veranda-bedroom', 'bedroom', -6, 1, 4, 6), room('veranda-bath', 'bathroom dressing', -6, -4, 4, 4),
        room('veranda-kitchen', 'kitchen', 6, 1, 4, 6), room('veranda-utility', 'utility pantry', 6, -4, 4, 4),
      ]}], accessOpenings: [entry('veranda-entry', 'south', .45, .55, 'veranda-gallery')]}],
    features: [{id: 'veranda-deck', label: 'Shaded veranda floor', type: 'terrace', location: {x: 0, z: 8}, width: 16, depth: 4}],
    connections: [{id: 'veranda-arrival', purpose: 'Garden gate to veranda', from: {kind: 'site-access', accessId: 'veranda-gate'}, to: {kind: 'surface', objectId: 'veranda-deck', local: [0, 2]}, use: 'pedestrian', width: 1.4},
      {id: 'veranda-entry-link', purpose: 'Veranda to entry gallery', from: {kind: 'surface', objectId: 'veranda-deck', local: [0, 1]}, to: {kind: 'entrance', entranceId: 'veranda-entry'}, use: 'pedestrian', width: 1.4}],
    roomAdjacencies: [{from: 'veranda-gallery', to: 'veranda-salon'}, {from: 'veranda-gallery', to: 'veranda-bedroom'}, {from: 'veranda-gallery', to: 'veranda-kitchen'}, {from: 'veranda-bedroom', to: 'veranda-bath'}, {from: 'veranda-kitchen', to: 'veranda-utility'}],
  });
}

export function writersListeningGarden() {
  const points = [[-7, -6], [7, -6], [7, 6], [1, 6], [1, 0], [-7, 0]];
  return parse({format: 'v3-architectural-plan-1',
    concept: 'OFFLINE REFERENCE — The Listening Garden: a writer enters a quiet south gallery, turns toward a north reading studio, and discovers a planted pocket framed by an L-shaped home. The bedroom wing shelters the garden from arrival. Creative freedom produces a spatial sequence rather than an amenity list; this is an independent technical example, not Terra authorship.',
    site: {width: 64, depth: 64, access: [{id: 'writer-gate', boundary: 'south', point: [18, 0, 32]}]},
    buildings: [{id: 'writer-home', label: 'Listening garden home', location: {x: 0, z: 0},
      plan: {kind: 'outline', segments: points.map((start, i) => ({id: `writer-edge-${i}`, type: 'line', start, end: points[(i + 1) % points.length]}))},
      storeys: [{id: 'writer-floor', label: 'Garden and writing floor', spaces: [
        room('writer-studio', 'living study', -3, -3, 8, 6), room('writer-north-gallery', 'circulation gallery', 2, -3, 2, 6),
        room('writer-kitchen', 'kitchen dining', 5, -3, 4, 6), room('writer-entry-gallery', 'entry circulation', 2, 3, 2, 6),
        room('writer-bedroom', 'bedroom', 5, 1.5, 4, 3), room('writer-bath', 'bathroom dressing', 5, 4.5, 4, 3),
      ]}], accessOpenings: [{...entry('writer-entry', 'south', .7, .9666666667, 'writer-entry-gallery'), segmentId: 'writer-edge-2'},
        {...entry('writer-garden-door', 'south', .3, .7, 'writer-studio'), segmentId: 'writer-edge-4', type: 'glazed-door', operation: 'sliding'}]}],
    features: [{id: 'writer-terrace', label: 'Garden reading terrace', type: 'terrace', location: {x: -3, z: 3}, width: 6, depth: 4},
      {id: 'writer-garden', label: 'Listening garden', type: 'landscape-zone', location: {x: -3, z: 7}, width: 6, depth: 4}],
    connections: [{id: 'writer-arrival', purpose: 'Arrival to sheltered entry gallery', from: {kind: 'site-access', accessId: 'writer-gate'}, to: {kind: 'entrance', entranceId: 'writer-entry', approachDistance: 2}, use: 'pedestrian', width: 1.2},
      {id: 'writer-garden-link', purpose: 'Reading studio to pocket garden', from: {kind: 'entrance', entranceId: 'writer-garden-door'}, to: {kind: 'surface', objectId: 'writer-terrace', local: [0, -2]}, use: 'pedestrian', width: 1.2}],
    roomAdjacencies: [{from: 'writer-entry-gallery', to: 'writer-north-gallery'}, {from: 'writer-entry-gallery', to: 'writer-bedroom'}, {from: 'writer-entry-gallery', to: 'writer-bath'}, {from: 'writer-north-gallery', to: 'writer-studio'}, {from: 'writer-north-gallery', to: 'writer-kitchen'}],
  });
}

export const architecturalIntelligenceExamples = () => [
  {name: 'caribbean-estate', brief: 'Design an extraordinary $15 million luxury estate overlooking the Caribbean Sea in Saint Lucia. Choose the architecture, arrival sequence, landscape and amenities thoughtfully.', make: formalArrivalEstate},
  {name: 'multi-storey-wings', brief: 'Design a two-storey family residence with articulated wings, connected public and private zones, and an aligned stair and upper landing.', make: articulatedWingsResidence},
  {name: 'compact-home', brief: 'Design a compact, practical one-bedroom garden home. Keep the geometry simple and use space carefully.', make: compactGardenHome},
  {name: 'specific-style', brief: 'Design a Caribbean vernacular home with a deep shaded veranda and a pitched metal roof, clear circulation and private sleeping accommodation.', make: caribbeanVerandaHome},
  {name: 'creative-freedom', brief: 'Create an inspiring small home for a writer. Surprise me with a thoughtful relationship between arrival, reading and a quiet garden. Choose the design freely.', make: writersListeningGarden},
];

export function intelligenceExampleExterior(plan: V3ArchitecturalPlan, name: string) {
  const exterior = referenceExterior(plan);
  if (name === 'specific-style') {
    exterior.buildings[0].roof = {...exterior.buildings[0].roof, form: 'hip', pitchDegrees: 24, overhang: .5};
    // Host-derived veranda shade avoids a standalone canopy's solid obstacle envelope.
    exterior.buildings[0].facade.assemblies = [{id: 'veranda-shade', intent: 'Deep Caribbean veranda shade', parts: [
      {id: 'veranda-roof', type: 'slab', facade: 'south', start: 0, end: 1, depth: 4, elevation: 3, thickness: .18},
      {id: 'veranda-west-post', type: 'post', facade: 'south', at: .03, depth: 3.8, height: 3, size: .2},
      {id: 'veranda-east-post', type: 'post', facade: 'south', at: .97, depth: 3.8, height: 3, size: .2},
    ]}];
  }
  return exterior;
}

/** Exercise the advertised compact provider schema, without canonical ledgers. */
export function compactAuthoringInput(plan: V3ArchitecturalPlan) {
  const {character, entrances, program, zones, forms, considerations, ...compact} = plan;
  void character; void entrances; void program; void zones; void forms; void considerations;
  const endpoint = (e: V3ArchitecturalPlan['connections'][number]['from']) => e.kind === 'entrance'
    ? {...e, entranceId: plan.entrances.find(a => a.id === e.entranceId)!.openingId} : e;
  return {...compact,
    verticalCirculation: plan.verticalCirculation.map(c => {
      const {stairType, direction, turn, label, semanticRole, ...reservation} = c;
      void stairType; void direction; void turn; void label; void semanticRole; return reservation;
    }),
    buildings: plan.buildings.map(b => {const {roofId, spaceHeight, ...building} = b; void roofId; void spaceHeight; return building;}),
    connections: plan.connections.map(c => {const {surfaceId, ...connection} = c; void surfaceId; return {...connection, from: endpoint(c.from), to: endpoint(c.to)};}),
  };
}
