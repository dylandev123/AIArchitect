import { describe, expect, it } from 'vitest';
import { auditHash } from '@/lib/architecture/renderAudit';
import { buildV3RenderIdentity, hasV3RenderIdentityMismatch } from '../renderIdentity';
import { ingestV3GenerationOutput } from '../ingestion';
import { buildV3TerrainSurface, compileV3Scene } from '../scene';
import { resolveObviousV3Support } from '../supportGraph';
import { getTerrainY } from '../elevation';
import { regressionLadder } from './regressionLadder';
import { primitivesBounds } from '../presentation';
const scene = () => ingestV3GenerationOutput(regressionLadder[0].raw).scene;
const rootJson = (value = scene()) => JSON.stringify({ version: 3, generationMode: 'v3-scene', v3Scene: value });
describe('remaining V3 source invariants', () => {
  const base = { projectId: 'active', persistedJson: rootJson(), rendererJson: rootJson(), failedPreviewActive: false, renderHistoryOverrideActive: false, fixtureDebugOverrideActive: false };
  it('reports every requested impossible source state', () => {
    const cases = [
      { input: { observedCompilerInputHash: 'wrong' }, code: 'RENDER_COMPILER_SOURCE_MISMATCH' },
      { input: { cameraSource: { projectId: 'active', source: 'persisted' as const, sceneHash: 'wrong' } }, code: 'CAMERA_RENDER_SOURCE_MISMATCH' },
      { input: { renderHistoryOverrideActive: true, historyProjectId: 'other' }, code: 'HISTORY_PROJECT_MISMATCH' },
      { input: { failedPreviewActive: true }, code: 'FAILED_PREVIEW_SOURCE_MISMATCH' },
      { input: { rendererJson: '{}' }, code: 'V3_RENDERING_V2_ROOT' },
    ];
    for (const { input, code } of cases) {
      const identity = buildV3RenderIdentity({ ...base, ...input });
      expect(identity.invariantWarnings).toContain(code);
      expect(hasV3RenderIdentityMismatch(identity)).toBe(true);
    }
  });
  it('does not confuse a valid explicit preview with a source mismatch', () => {
    const preview = scene(); preview.objects[0].label = 'Preview';
    const identity = buildV3RenderIdentity({ ...base, failedPreviewActive: true, failedPreviewScene: preview, rendererJson: rootJson(preview), observedCompilerInputHash: auditHash(preview), cameraSource: { projectId: 'active', source: 'failed-preview', sceneHash: auditHash(preview) } });
    expect(identity.invariantWarnings).toEqual([]);
    expect(hasV3RenderIdentityMismatch(identity)).toBe(false);
  });
});
describe('remaining V3 pool and terrain invariants', () => {
  it('filters support hosts without discarding the terrain modifiers used by rendering', () => {
    const prepared = scene();
    const mass = prepared.objects[0];
    mass.architecture!.baseElevation = 6;
    mass.transform.position[1] = 7.7;
    mass.hostId = 'attachment-intent';
    delete mass.support;
    prepared.objects = [mass, { ...structuredClone(mass), id: 'slope', type: 'terrain-region', hostId: undefined, architecture: undefined, dimensions: [80,1,80], transform: { position: [0,6,0], rotation: [0,0,0], scale: [1,1,1] }, terrain: { operation: 'slopeRegion', rise: 8, direction: 'z' } }];
    const terrain = buildV3TerrainSurface(prepared);
    const support = resolveObviousV3Support(mass, prepared, []);
    expect(terrain.heightAt(0,0)).toBeCloseTo(6);
    expect(support.supportElevation).toBeCloseTo(terrain.heightAt(0,0));
  });
  it('samples triangle interiors exactly as the renderer even across terrain shoulders', () => {
    const prepared = ingestV3GenerationOutput(regressionLadder[3].raw).scene;
    const terrain = buildV3TerrainSurface(prepared);
    // Barycentres test the actual mesh surface, not merely common grid vertices.
    for (let i = 0; i < terrain.vertices.length; i += 9 * 89) {
      const t = terrain.vertices.slice(i,i+9);
      expect(terrain.heightAt((t[0]+t[3]+t[6])/3,(t[2]+t[5]+t[8])/3)).toBeCloseTo((t[1]+t[4]+t[7])/3,7);
    }
    const model = compileV3Scene(prepared);
    const path = model.primitives.find(p => p.sourceObjectId === 'driveway')!;
    if (path.kind === 'triMesh') for (let i = 0; i < path.vertices.length; i += 3) expect(path.vertices[i+1]).toBeCloseTo(getTerrainY(path.vertices[i],path.vertices[i+2],prepared)+.055,7);
  });
  it('keeps rotated water exposed above terrain and cuts a surrounding deck regardless of object order', () => {
    const raw = regressionLadder[1].raw;
    for (const reverse of [false,true]) {
      const input = structuredClone(raw);
      input.objects = input.objects.filter(o => o.id === 'pool' || o.id === 'pool-deck');
      Object.assign(input.objects.find(o => o.id === 'pool')!.architecture, { rotationY: Math.PI/4 });
      if (reverse) input.objects.reverse();
      const prepared = ingestV3GenerationOutput(input).scene;
      const model = compileV3Scene(prepared);
      const water = model.primitives.find(p => p.componentRole === 'water surface')!;
      const bounds = primitivesBounds([water])!;
      expect(bounds.min[1]).toBe(bounds.max[1]);
      expect(getTerrainY(0,15,prepared)).toBeLessThan(bounds.min[1]);
      expect(model.primitives.find(p => p.sourceObjectId === 'pool-deck')?.kind).toBe('triMesh');
      const poolParts = model.primitives.filter(p => p.sourceObjectId === 'pool');
      expect(poolParts).toHaveLength(10);
      expect(poolParts.filter(p => p.kind === 'box').every(p => p.kind !== 'box' || p.rotation[1] === Math.PI/4)).toBe(true);
    }
  });
});
