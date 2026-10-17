import { describe, expect, it } from 'vitest';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileV3Scene, validateV3CompiledGeometry } from '../scene';
import { resolveV3Renderable } from '../renderability';
import { resolveActiveV3RenderSource } from '../activeRenderSource';
import { getV3PresentationBounds } from '../presentation';
import { runtimeGeometryMatchesArchitecture } from '../architecture';
import { executeV3SceneOperations } from '../operations';
import { regressionLadder } from './regressionLadder';

describe('offline production regression ladder', () => {
  for (const { name, raw } of regressionLadder) it(name, () => {
    const result = ingestV3GenerationOutput(raw);
    expect(result.validation.errors).toEqual([]);
    expect(result.ok).toBe(true);
    const json = JSON.stringify({ version: 3, generationMode: 'v3-scene', v3Scene: result.scene });
    const active = resolveActiveV3RenderSource({ projectId: 'ladder', persistedJson: json, rendererJson: json, failedPreviewActive: false });
    const scene = active.scene!;
    expect(scene.objects.map(o => o.id)).toEqual(raw.objects.map(o => o.id));
    const model = compileV3Scene(scene);
    const omissions = scene.objects.filter(o => !model.primitives.some(p => p.sourceObjectId === o.id || p.sourceObjectIds?.includes(o.id)));
    expect(omissions.map(o => o.id)).toEqual([]);
    expect(validateV3CompiledGeometry(scene, model, { lenient: true }).errors).toEqual([]);
    const anomalies = scene.objects.filter(o => !runtimeGeometryMatchesArchitecture(o));
    expect(anomalies).toEqual([]);
    const fallbackCounts = scene.objects.reduce((counts, o) => { const strategy = resolveV3Renderable(o).strategy; counts[strategy] = (counts[strategy] ?? 0) + 1; return counts; }, {} as Record<string, number>);
    console.info('V3_LADDER', JSON.stringify({ name, authored: raw.objects.length, canonical: scene.objects.length, primitives: model.primitives.length, fallbackCounts, unresolvedSupport: result.validation.issues.filter(i => i.code === 'UNRESOLVED_SUPPORT').length, bounds: getV3PresentationBounds(scene, model), maxBuildingHeight: Math.max(...scene.objects.filter(o => o.type === 'building-mass').map(o => o.architecture!.height)), omissions: omissions.length, coordinateAnomalies: anomalies.length }));
    const building = scene.objects.find(o => o.type === 'building-mass')!;
    const edited = executeV3SceneOperations(scene, { intent: 'Widen the authored pavilion', operations: [{ op: 'editArchitecture', target: building.id, architecture: { width: building.architecture!.width + 2 } }] });
    expect(edited.errors).toEqual([]);
    expect(edited.scene.objects).toHaveLength(scene.objects.length);
    expect(edited.scene.objects.find(o => o.id === building.id)?.architecture?.width).toBe(building.architecture!.width + 2);
    expect(compileV3Scene(edited.scene).primitives).not.toEqual(model.primitives);
  });
});
