import { compileShapedSiteFeature } from './siteFeatureConstruction';
import type { HouseModel, HousePrimitive } from '@/lib/house/types';
import type { V3BlueprintFinding } from './blueprint';
import { applyV3Circulation } from './circulation';
import { effectiveV3Scene } from './derivedSupport';
import { resolveV3Fidelity } from './fidelity';
import { v3StoreyBase } from './stacking';
import { resolveFootprint } from './footprint';
import { compileV3InteriorWalls } from './interiorWalls';
import { compileV3MassJunctions } from './junctionCompiler';
import { resolveV3JunctionDatums } from './junctionDatums';
import { deriveV3MassJunctions, junctionRoofScopes, worldPoint } from './junctions';
import { withInferredV3Surfaces } from './materialInference';
import { roofClearanceOverhangs } from './roofClearance';
import { finishRooftopTerraces, rooftopTerraces } from './rooftopFeatures';
import { v3CompileKit, validateV3CompiledGeometry, type V3Scene } from './scene';

const signature = (p: HousePrimitive) => JSON.stringify([
  p.kind, p.kind === 'box' ? [p.position, p.rotation, p.size] : p.vertices,
  p.color, p.surface, p.roughness, p.metalness, p.transparent, p.opacity,
  p.sourceObjectId, p.sourceObjectIds, p.componentRole,
]);

/**
 * Read-only acceptance receipts from the supported component builders. These are
 * not another authored scene, renderer or persisted authority. Calling builders
 * directly bypasses scene dispatch/fallback: every required slab, opening leaf,
 * guard, pool shell, roof part, etc. must survive final compilation with its
 * geometry and finish. Shared junction/circulation policies apply to receipts as
 * well, so legitimate wall joins and stair cuts are not mistaken for omissions.
 *
 * Shared builder defects remain a separate risk; the independent outline check
 * below also prevents a builder's rectangular fallback from certifying itself.
 */
export function auditArchitecturalConstructionFidelity(input: V3Scene, model: HouseModel): V3BlueprintFinding[] {
  const findings: V3BlueprintFinding[] = [];
  const blueprint = input.estatePlan?.blueprint;
  const managedIds = new Set([
    ...(blueprint?.buildings.map(b => b.objectId) ?? []), ...(blueprint?.roofObjectIds ?? []), ...(blueprint?.outdoorObjectIds ?? []),
    ...(input.estatePlan?.circulation.flatMap(r => r.via) ?? []),
  ]);
  const fail = (code: string, ids: string[], message: string) => findings.push({ code, targetIds: ids, message, severity: 'fatal' });
  for (const message of validateV3CompiledGeometry(input, model).errors)
    fail('ARCHITECTURAL_COMPILED_GEOMETRY', ['construction'], message);
  const actual = new Map<string, HousePrimitive>();
  for (const p of model.primitives) {
    if (actual.has(p.id)) fail('ARCHITECTURAL_PRIMITIVE_ID', [p.id], 'Compiled component identity is ambiguous.');
    actual.set(p.id, p);
    if (managedIds.has(p.sourceObjectId ?? '') && /^(generic |render proxy)/.test(p.componentRole ?? ''))
      fail('ARCHITECTURAL_GEOMETRY_SUBSTITUTED', [p.sourceObjectId ?? p.id], 'Blueprint construction cannot use generic fallback geometry.');
  }

  const datum = resolveV3JunctionDatums(withInferredV3Surfaces(resolveV3Fidelity(effectiveV3Scene(input)).scene));
  const scene = datum.scene, overhangs = roofClearanceOverhangs(scene);
  const junctions = deriveV3MassJunctions(scene).junctions, scopes = junctionRoofScopes(scene, junctions);
  const expected: HousePrimitive[] = [];
  for (const o of scene.objects) {
    // Replanning may retain unrelated objects created through the ordinary V3
    // editor. Their existing validation remains responsible for their geometry.
    if (!managedIds.has(o.id)) continue;
    const shaped=compileShapedSiteFeature(o,scene);
    if(shaped){expected.push(...shaped);continue;}
    switch (o.type) {
      case 'building-mass': expected.push(...v3CompileKit.compileBuildingMass(o, false, o.overhang, o.material, v3StoreyBase(o, scene), scene)); break;
      case 'roof-form': expected.push(...v3CompileKit.compileRoofForm(o, scopes.get(o.id) ?? scene, overhangs.get(o.id))); break;
      case 'pool': expected.push(...v3CompileKit.compilePool(o)); break;
      case 'terrace': expected.push(...(v3CompileKit.compilePoolDeck(o, scene) ?? v3CompileKit.compileTerraceSurface(o))); break;
      case 'courtyard': expected.push(...v3CompileKit.compileCourtyard(o)); break;
      case 'landscape-zone': expected.push(...v3CompileKit.compileLandscapeZone(o)); break;
      case 'canopy': expected.push(...v3CompileKit.compileCanopy(o)); break;
      // Route geometry has its own independent canonical-ribbon comparison in
      // validateV3CompiledGeometry; never accept a compatibility path box here.
    }
  }
  expected.push(...datum.closures, ...compileV3InteriorWalls(scene));
  const finished = applyV3Circulation(scene, finishRooftopTerraces(scene, rooftopTerraces(input),
    compileV3MassJunctions(scene, expected, overhangs, junctions)));
  for (const p of finished) {
    const built = actual.get(p.id);
    if (!built) fail('ARCHITECTURAL_PART_UNBUILT', [p.sourceObjectId ?? p.id, p.id], 'A required construction part is missing; other parts from the same object are insufficient.');
    else if (signature(built) !== signature(p)) {
      const geometry = (part: HousePrimitive) => JSON.stringify([part.kind, part.kind === 'box' ? [part.position,part.rotation,part.size] : part.vertices,part.sourceObjectId,part.sourceObjectIds,part.componentRole]);
      fail(geometry(built) === geometry(p) ? 'ARCHITECTURAL_PART_FINISH' : 'ARCHITECTURAL_PART_DRIFT', [p.sourceObjectId ?? p.id, p.id], 'Compiled geometry, ownership or finish differs from the approved component construction.');
    }
  }
  const expectedIds = new Set(finished.map(p => p.id));
  const routeOwners = new Set(input.estatePlan?.circulation.flatMap(r => r.via));
  for (const p of model.primitives) if (p.sourceObjectId && managedIds.has(p.sourceObjectId) && !routeOwners.has(p.sourceObjectId) && !expectedIds.has(p.id))
    fail('ARCHITECTURAL_PART_UNEXPECTED', [p.sourceObjectId, p.id], 'Construction emitted an unauthorised architectural part.');

  for (const o of scene.objects.filter(o => o.type === 'building-mass' && o.composition?.footprint?.kind === 'outline')) {
    const slab = actual.get(`${o.id}-slab-1-outline`), fp = resolveFootprint(o, 0);
    if (slab?.kind !== 'triMesh' || !fp) {
      fail('ARCHITECTURAL_OUTLINE_LOST', [o.id], 'An explicit line/arc outline requires its real ground slab, never a box substitute.');
      continue;
    }
    // The lowest slab is not cut by a stair between finished floors. Verify its
    // authored outer boundary directly in world space, independently of builders.
    const points = new Set<string>();
    const key = (x: number, z: number) => `${Math.round(x * 1e6)},${Math.round(z * 1e6)}`;
    for (let i = 0; i < slab.vertices.length; i += 3) points.add(key(slab.vertices[i], slab.vertices[i + 2]));
    if (fp.polygon.some(([x, z]) => { const p = worldPoint(o, x + fp.frame.x, 0, z + fp.frame.z); return !points.has(key(p[0], p[2])); }))
      fail('ARCHITECTURAL_OUTLINE_LOST', [o.id], 'Compiled ground slab lost an authored line/arc boundary.');
  }
  return findings;
}
