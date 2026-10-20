/** Adversarial provider-shaped designs, never runtime templates or automatic repairs. */
import { v3SceneOutputSchema, type V3GenerationOutput } from '../schema';
import { explicitlyCorrectedCloister } from '../parity/unifiedSpatial';
import { blueprintProviderFixtures, blueprintProviderOutput } from './blueprintProviderFixtures';

export interface PreGenerationFixture {
  name: string;
  output: V3GenerationOutput;
  expectedCodes: string[];
}

export function preGenerationFixtures(): PreGenerationFixture[] {
  const estate = () => v3SceneOutputSchema.parse(blueprintProviderOutput(explicitlyCorrectedCloister()));
  const curved = () => v3SceneOutputSchema.parse(blueprintProviderFixtures()[0].output);
  const cases: PreGenerationFixture[] = [];
  const add = (name: string, output: V3GenerationOutput, expectedCodes: string[] = []) => cases.push({ name, output, expectedCodes });

  add('curved two-storey mansion, articulated entrance, curved shade assembly and implicit roof', curved());
  const named = estate();
  for (const route of named.estatePlan!.circulation) {
    for (const side of ['from', 'to'] as const) {
      if (route.spatial![side].openingId || named.estatePlan!.siteAccess?.some(a => a.id === route[side])) delete route.spatial![side].point;
    }
    const owner = named.objects.find(o => o.id === route.via[0])!;
    delete owner.architecture; delete owner.transform; delete owner.dimensions;
  }
  add('multi-building estate, named doors and boundary, connected wings and dry pool deck', named);

  const redundant = estate();
  for (const route of redundant.estatePlan!.circulation) {
    const owner = redundant.objects.find(o => o.id === route.via[0])!;
    owner.architecture = { x: 60, z: 40, baseElevation: 0, width: 99, depth: 99, height: 2 };
  }
  add('contradictory route-owner envelopes cannot become a second spatial interpretation', redundant);

  const blocked = estate();
  blocked.estatePlan!.circulation.find(r => r.id === 'route-guest')!.spatial!.waypoints = [[28, 0, -23], [38, 0, -8], [38, 0, 7]];
  blocked.estatePlan!.zones.find(z => z.id === 'zone-guests')!.allocation = { x: 0, z: 0, width: 1, depth: 1 };
  add('pavilion approach follows its wall and contradicts its allocation', blocked, ['ESTATE_ROUTE_BLOCKED', 'ESTATE_ALLOCATION_CONFLICT']);

  const detail = curved();
  const mass = detail.objects.find(o => o.type === 'building-mass')!;
  detail.estatePlan!.zones.push({ id: 'invalid-reservation', purpose: 'An explicit conflicting reservation', objectIds: [mass.id], allocation: { x: 40, z: 40, width: 1, depth: 1 } });
  mass.roofForm = 'gable';
  mass.composition!.assemblies![0].parts.find(p => p.type === 'slab')!.segmentId = 'missing-shade-wall';
  add('allocation rejection cannot conceal unsupported curved roof and unresolved exterior assembly', detail,
    ['ESTATE_ALLOCATION_CONFLICT', 'ROOF_FOOTPRINT_UNSUPPORTED', 'FOOTPRINT_ASSEMBLY_UNRESOLVED']);

  const missing = estate();
  delete missing.estatePlan!.circulation.find(r => r.id === 'route-guest')!.spatial!.to.point;
  missing.estatePlan!.circulation.find(r => r.id === 'route-guest')!.spatial!.to.openingId = 'missing-door';
  add('unknown named door must not silently select another entrance', missing, ['ESTATE_ACCESS_POINT_MISSING', 'ESTATE_ROUTE_UNSUPPORTED']);

  const ambiguous = v3SceneOutputSchema.parse(blueprintProviderFixtures()[3].output);
  const articulated = ambiguous.objects.find(o => o.id === 'main-residence')!;
  const door = articulated.composition!.openings!.find(o => o.id === 'southLivingDoor')!;
  if ('start' in door) { door.start = .12; door.end = .42; }
  add('recessed door spanning multiple wall planes remains an explicit authoring conflict', ambiguous, ['FOOTPRINT_FACADE_AMBIGUOUS']);

  const conflict = estate();
  conflict.estatePlan!.blueprint!.buildings[0].objectId = 'missing-building';
  conflict.estatePlan!.relationships.find(r => r.id === 'rel-main-roof')!.to = 'guest-pavilion';
  add('blueprint identity and roof-host conflict cannot be repaired by erasing declarations', conflict, ['BLUEPRINT_REFERENCE', 'BLUEPRINT_ROOF_HOST']);

  const shared = estate();
  shared.estatePlan!.circulation.find(r => r.id === 'route-wellness')!.via = ['guest-path'];
  add('ambiguous shared surface owner cannot produce fallback boxes', shared, ['ESTATE_ROUTE_UNSUPPORTED']);

  add('three independent hip roofs with continuous bent pavilion approaches', v3SceneOutputSchema.parse(blueprintProviderFixtures()[1].output));
  const unsupported = curved();
  unsupported.objects[0].unsupportedIntent = { roofForm: 'dome' };
  add('explicit unsupported dome remains visible and rejected', unsupported, ['BLUEPRINT_ROOF_UNSUPPORTED', 'ROOF_INTENT_UNSUPPORTED']);
  return cases;
}
