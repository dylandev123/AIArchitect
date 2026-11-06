import {houseSpecSchema, type HouseSpec, type PlanNode, type RoomType} from './spec';

/**
 * DEVELOPER-AUTHORED stand-in for the model's five stage outputs. It exercises the
 * pipeline offline; it is NOT evidence that a model can design this house. The live
 * experiment replaces it with real model output for the same stage schemas.
 */
const room = (id: string, name: string, type: RoomType): PlanNode => ({room: {id, name, type}});
const split = (axis: 'x' | 'z', at: number, a: PlanNode, b: PlanNode): PlanNode => ({split: axis, at, a, b});
const rect = (x0: number, x1: number, z0: number, z1: number) => ({x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0});
const flat = (overhang: number) => ({form: 'flat' as const, overhang, material: 'bronze' as const, color: '#3a3d38'});
const hip = (rise: number, overhang: number) => ({form: 'hip' as const, rise, overhang, material: 'timber' as const, color: '#6b4a36'});

export const villaSpec: HouseSpec = houseSpecSchema.parse({
  version: 'staged-house-1',
  site: {width: 60, depth: 48},
  direction: {
    name: 'Casa Corallina · contemporary Caribbean villa',
    concept: 'A low, wide ground-floor living pavilion opens to a deep veranda and pool; a hip-roofed sleeping bar floats above it and a tall stone entry tower marks arrival. Flat site, cross-breezes, deep shade.',
    hierarchy: ['Stone entry tower (arrival landmark)', 'Glazed living pavilion + veranda + pool (heart of the house)', 'Hip-roofed primary suite bar above', 'Low guest wing and cabana wing as quiet flanks'],
    roofLanguage: 'Low hip roofs with deep timber eaves over the suite and cabana; crisp flat bronze roof on the tower; roof terrace on the guest wing.',
    entrance: 'Pivot door in a stone tower beneath a timber canopy, with a double-height glazed stair hall beside it.',
    outdoorLiving: 'Fifteen-metre covered veranda stepping out to a limestone pool terrace; cabana lounge with garden door.',
    landscape: 'Palm-lined forecourt, clipped boundary hedges, lawns and planting beds that frame but never touch the building.',
    palette: {walls: 'ivory', accent: 'timber', roof: 'timber', roofColor: '#6b4a36', deck: 'limestone'},
  },
  blocks: [
    {id: 'entry', role: 'arrival tower base', cx: 0, cz: -8.5, w: 10, d: 7, level: 0, roof: flat(1.0), wall: 'limestone',
      plan: split('x', 6, room('foyer', 'Foyer', 'foyer'), room('stair-hall', 'Stair hall', 'stair'))},
    {id: 'living', role: 'living pavilion', cx: 0, cz: 1, w: 20, d: 12, level: 0, roof: flat(0.5), wall: 'ivory',
      plan: split('x', 10, room('living-room', 'Living room', 'living'), split('x', 5, room('dining', 'Dining', 'dining'), room('kitchen', 'Kitchen', 'kitchen')))},
    {id: 'west-wing', role: 'guest wing', cx: -16, cz: 1, w: 12, d: 12, level: 0, roof: flat(0.5), wall: 'ivory',
      plan: split('x', 10, split('z', 6, room('bedroom-guest', 'Guest bedroom', 'bedroom'), room('bedroom-2', 'Bedroom 2', 'bedroom')), room('gallery', 'Gallery', 'gallery'))},
    {id: 'east-wing', role: 'cabana wing', cx: 15, cz: 1, w: 10, d: 12, level: 0, roof: hip(1.5, 1.2), wall: 'timber',
      plan: split('z', 8, room('pool-lounge', 'Pool lounge', 'lounge'), room('pool-bath', 'Pool bath', 'bath'))},
    {id: 'tower', role: 'entry tower upper floor', cx: 0, cz: -8.5, w: 10, d: 7, level: 1, roof: flat(1.0), wall: 'limestone',
      plan: split('x', 6, room('bedroom-3', 'Bedroom 3', 'bedroom'), room('landing', 'Landing', 'hall'))},
    {id: 'suite', role: 'primary suite bar', cx: -1, cz: 1, w: 22, d: 12, level: 1, roof: hip(2.0, 1.8), wall: 'ivory',
      plan: split('x', 10, split('z', 8, room('primary-bedroom', 'Primary bedroom', 'bedroom'), room('primary-bath', 'Primary bath', 'bath')),
        split('z', 3, room('upper-hall', 'Upper hall', 'hall'), room('family-lounge', 'Family lounge', 'lounge')))},
  ],
  links: [
    {a: 'foyer', b: 'living-room', kind: 'open'}, {a: 'foyer', b: 'stair-hall', kind: 'door'},
    {a: 'living-room', b: 'dining', kind: 'open'}, {a: 'dining', b: 'kitchen', kind: 'open'},
    {a: 'gallery', b: 'living-room', kind: 'door'}, {a: 'bedroom-guest', b: 'gallery', kind: 'door'}, {a: 'bedroom-2', b: 'gallery', kind: 'door'},
    {a: 'kitchen', b: 'pool-lounge', kind: 'door'}, {a: 'pool-lounge', b: 'pool-bath', kind: 'door'},
    {a: 'landing', b: 'bedroom-3', kind: 'door'}, {a: 'landing', b: 'upper-hall', kind: 'door'},
    {a: 'primary-bedroom', b: 'primary-bath', kind: 'door'}, {a: 'primary-bedroom', b: 'upper-hall', kind: 'door'}, {a: 'upper-hall', b: 'family-lounge', kind: 'open'},
  ],
  stairs: [{id: 'main', room: 'stair-hall', start: 'n', hug: 'e', width: 1.2}],
  exterior: {
    facades: {'entry:n': 'glass-wall', 'entry:e': 'glass-wall', 'living:s': 'glass-wall', 'tower:n': 'glass-wall', 'suite:s': 'glass-wall', 'suite:e': 'glass-wall', 'west-wing:n': 'large-windows'},
    doors: [
      {id: 'main-door', room: 'foyer', side: 'n', kind: 'main', width: 1.5, t: 0.5},
      {id: 'garden-living', room: 'living-room', side: 's', kind: 'garden', width: 1.8, t: 0.7},
      {id: 'garden-dining', room: 'dining', side: 's', kind: 'garden', width: 1.8, t: 0.5},
      {id: 'terrace-primary', room: 'primary-bedroom', side: 'w', kind: 'garden', width: 1.8, t: 0.5},
      {id: 'cabana-east', room: 'pool-lounge', side: 'e', kind: 'garden', width: 1.8, t: 0.5},
    ],
    entrance: {door: 'main-door', canopy: {depth: 3.2, width: 6.5, material: 'timber'}, court: {w: 8, d: 7}},
    verandas: [{id: 'south', block: 'living', side: 's', from: -10, to: 5, depth: 4.5, columns: 5, roofMaterial: 'timber', deckMaterial: 'limestone'}],
  },
  siteWork: {
    pool: {x: -2.5, z: 13.5, w: 11, d: 4, basinDepth: 1.6},
    lawns: [
      {id: 'front-west', rect: rect(-29, -6, -23.5, -12), material: 'sage'}, {id: 'front-east', rect: rect(2, 29, -23.5, -12), material: 'sage'},
      {id: 'front-mid-w', rect: rect(-6, -3.5, -23.5, -19), material: 'sage'}, {id: 'front-mid-e', rect: rect(-0.5, 2, -23.5, -19), material: 'sage'},
      {id: 'nw-yard', rect: rect(-22, -5, -12, -5), material: 'sage'}, {id: 'ne-yard', rect: rect(5, 20, -12, -5), material: 'sage'},
      {id: 'west', rect: rect(-29, -22.5, -12, 12), material: 'sage'}, {id: 'east', rect: rect(20.5, 29, -12, 12), material: 'sage'},
      {id: 'rear-west', rect: rect(-29, -10.5, 12, 23.5), material: 'sage'}, {id: 'rear-east', rect: rect(5.5, 29, 12, 23.5), material: 'sage'},
      {id: 'pool-gap', rect: rect(-9.6, 4.6, 11.5, 13.5), material: 'sage'},
    ],
    beds: [
      {id: 'entry-w', rect: rect(-9, -6.5, -19, -12.5)}, {id: 'entry-e', rect: rect(2.5, 5, -19, -12.5)},
      {id: 'pool-w', rect: rect(-14, -10.8, 13, 21)}, {id: 'pool-e', rect: rect(5.8, 9, 13, 21)},
    ],
    hedges: [
      {id: 'front-w', rect: rect(-29.8, -5, -23.9, -23.1)}, {id: 'front-e', rect: rect(1, 29.8, -23.9, -23.1)},
      {id: 'west', rect: rect(-29.8, -29, -23.1, 23.1)}, {id: 'east', rect: rect(29, 29.8, -23.1, 23.1)}, {id: 'rear', rect: rect(-29, 29, 23.1, 23.9)},
    ],
    paths: [{id: 'drive', rect: rect(-3.5, -0.5, -23.5, -19)}],
    trees: [
      {id: 'p1', x: -12, z: -16, height: 8, kind: 'palm'}, {id: 'p2', x: 7, z: -16, height: 9, kind: 'palm'},
      {id: 'p3', x: -17, z: -20, height: 10, kind: 'palm'}, {id: 'p4', x: 13, z: -20, height: 8.5, kind: 'palm'},
      {id: 'p5', x: -26, z: -8, height: 9, kind: 'palm'}, {id: 'p6', x: -26, z: 8, height: 8, kind: 'palm'},
      {id: 'p7', x: 25, z: -8, height: 9.5, kind: 'palm'}, {id: 'p8', x: 25, z: 8, height: 8.5, kind: 'palm'},
      {id: 'p9', x: -16, z: 15, height: 9, kind: 'palm'}, {id: 'p10', x: -16, z: 20, height: 10, kind: 'palm'},
      {id: 'p11', x: 12, z: 15, height: 8, kind: 'palm'}, {id: 'p12', x: 12, z: 20, height: 9.5, kind: 'palm'},
      {id: 'c1', x: -26, z: 19, height: 4, kind: 'canopy'}, {id: 'c2', x: 25, z: 19, height: 4, kind: 'canopy'},
    ],
  },
});
