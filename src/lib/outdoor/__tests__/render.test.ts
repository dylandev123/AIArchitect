import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { buildAsset, type BuiltAsset } from '@/lib/assets/native/build';
import { exportGlb } from '@/lib/assets/native/glb';
import type { AssetSpec } from '@/lib/assets/native/spec';
import { diningTable, lantern } from '@/lib/assets/native/__tests__/fixtures';
import { encodePng, renderAsset } from '@/lib/assets/native/__tests__/render';
import { validateGlb } from '@/lib/assets/glbValidator';
import { createMemoryGlbStore, setGlbStore } from '@/lib/assets/glbStorage';
import { placementsFromOutdoor, usablePlacements } from '@/lib/assets/placement';
import { toAssetIndex } from '@/lib/library/retrieval';
import type { CuratedAsset } from '@/types/assets';
import { assembleVilla, VILLA_BRIEF } from '@/lib/library/__tests__/villaFixture';
import { analyzeGeneration } from '@/lib/library/generationLoop';
import { emptySnapshot } from '@/lib/library/store';
import { attachOutdoorAssets, type OutdoorAssetPlacement } from '../placements';
const pergola: AssetSpec = {
    ...diningTable, family: 'pergola', name: 'Dining Pergola', dimensions: { width: 4.5, depth: 3.5, height: 2.8 },
    parts: [
        { primitive: 'box', role: 'post', material: 'teak', size: [0.18, 2.8, 0.18], position: [2.16, 1.4, 1.66], mirror: 'xz' },
        { primitive: 'box', role: 'beam', material: 'teak', size: [4.5, 0.18, 0.18], position: [0, 2.65, 1.66], mirror: 'z' },
        { primitive: 'slatArray', role: 'roof-slat', material: 'teak', count: 8, slatSize: [0.1, 0.12, 3.5], gap: 0.5, axis: 'x', position: [0, 2.74, 0] },
    ],
};
const specs: Record<string, AssetSpec> = {
    'dining-table': { ...diningTable, dimensions: { width: 2.4, depth: 1, height: 0.76 } },
    'dining-chair': { ...diningTable, family: 'dining-chair', name: 'Dining Chair', dimensions: { width: 0.55, depth: 0.58, height: 0.9 }, parts: [
            { primitive: 'box', role: 'leg', material: 'teak', size: [0.05, 0.45, 0.05], position: [0.24, 0.225, 0.25], mirror: 'xz' },
            { primitive: 'box', role: 'seat', material: 'teak', size: [0.55, 0.06, 0.58], position: [0, 0.45, 0] },
            { primitive: 'box', role: 'back', material: 'teak', size: [0.55, 0.42, 0.06], position: [0, 0.69, -0.26] },
        ] },
    'sun-lounger': { ...diningTable, family: 'lounger', name: 'Sun Lounger', dimensions: { width: 0.7, depth: 2, height: 0.4 }, parts: [
            { primitive: 'box', role: 'leg', material: 'teak', size: [0.07, 0.25, 0.07], position: [0.3, 0.125, 0.8], mirror: 'xz' },
            { primitive: 'box', role: 'seat', material: 'teak', size: [0.7, 0.08, 2], position: [0, 0.25, 0] },
            { primitive: 'box', role: 'headrest', material: 'teak', size: [0.7, 0.15, 0.45], position: [0, 0.325, -0.775] },
        ] },
    pergola,
    'pendant-light': { ...lantern, family: 'pendant-light', name: 'Pendant Light', dimensions: lantern.dimensions },
};
afterEach(() => vi.unstubAllGlobals());
it('loads approved native GLBs into the placed scene, renders fixture evidence, and omits a missing file', async () => {
    const local = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => local.set(k, v), removeItem: (k: string) => local.delete(k) });
    const memory = createMemoryGlbStore();
    setGlbStore(memory);
    const catalog: CuratedAsset[] = [];
    const built = new Map<string, BuiltAsset>();
    for (const [role, spec] of Object.entries(specs)) {
        const result = buildAsset(spec);
        if (!result.ok)
            throw new Error(result.error);
        const bytes = exportGlb(result.asset), validation = validateGlb(bytes);
        expect(validation.passed).toBe(true);
        const id = `fixture-approved-${role}`;
        await memory.put(id, bytes);
        built.set(id, result.asset);
        catalog.push({ id, stableAssetId: `stable-${role}`, sourceSlug: id, source: 'generated', type: 'glb-model', name: spec.name ?? role, categories: [], tags: [role], thumbnailUrl: '', pbr: { baseColor: '#888888', roughness: 0.8, metalness: 0 }, compatibleStyles: [], styleTags: ['tropical', 'modern'], status: 'approved', importedAt: '', dimensions: spec.dimensions, validation, family: role === 'pergola' ? 'pergola' : role === 'pendant-light' ? 'light' : 'furniture' });
    }
    const { useAssetStore } = await import('@/store/useAssetStore');
    useAssetStore.setState({ catalog });
    const { glbModels, instantiateGlb, noteGlbRendered, loadPlacedAssets } = await import('@/lib/assets/glbModels');
    const root = JSON.parse(attachOutdoorAssets(assembleVilla().json, VILLA_BRIEF, toAssetIndex(catalog)));
    const placements = root.outdoorAssetPlacements as OutdoorAssetPlacement[];
    const { useGenerationStore } = await import('@/store/useGenerationStore');
    useGenerationStore.getState().record(analyzeGeneration({json:JSON.stringify(root),brief:VILLA_BRIEF,projectId:'fixture',library:toAssetIndex(catalog),retrieved:[],attached:[]},emptySnapshot()).report);
    const renderable = usablePlacements(placementsFromOutdoor(placements), catalog);
    expect(renderable.length).toBe(9);
    expect(await loadPlacedAssets('fixture',renderable,renderable)).toEqual(new Set());
    const meshes: BuiltAsset['meshes'] = [];
    const center = placements.find(p => p.role === 'dining-table')!.position;
    for (const p of renderable) {
        expect(await glbModels.load(p.assetId)).not.toBeNull();
        const instance = instantiateGlb(p.assetId)!;
        instance.position.set(p.x, p.y!, p.z);
        instance.rotation.y = p.yaw;
        instance.updateMatrixWorld(true);
        expect(instance.children.length).toBeGreaterThan(0);
        noteGlbRendered('fixture', p.featureId, p.assetId, p.trackingId);
        // Software rasterize the very same native geometry at its project transform.
        if (!p.featureId.includes('pool-lounge'))
            for (const mesh of built.get(p.assetId)!.meshes) {
                const geometry = mesh.geometry.clone().rotateY(p.yaw).translate(p.x - center[0], p.y!, p.z - center[2]);
                meshes.push({ ...mesh, geometry });
            }
    }
    expect(useGenerationStore.getState().reports[0].assets.filter(a=>a.applied).every(a=>a.status==='Rendered')).toBe(true);
    expect(Object.values(useGenerationStore.getState().outcomes).filter(o => o.status === 'Rendered')).toHaveLength(9);
    const output = '/tmp/aiarchitect-outdoor-fixture';
    mkdirSync(output, { recursive: true });
    const scene = { ...built.values().next().value!, meshes, size: { width: 6, depth: 5, height: 3 } };
    writeFileSync(`${output}/dining.png`, encodePng(renderAsset(scene, 900, 30, 28), 900, 900));
    writeFileSync(`${output}/placements.json`, JSON.stringify(placements, null, 2));
    const missing = catalog[0];
    await memory.delete(missing.id);
    glbModels.invalidate(missing.id);
    await loadPlacedAssets('fixture', renderable, renderable);
    expect(glbModels.status(missing.id)).toBe('failed');
    expect(useGenerationStore.getState().outcomes[`fixture:${renderable.find(p => p.assetId === missing.id)!.trackingId}`].status).toBe('Failed');
    expect(instantiateGlb(missing.id)).toBeNull();
    expect(useAssetStore.getState().catalog.find(a => a.id === missing.id)?.failureCount).toBe(1);
    expect(JSON.parse(attachOutdoorAssets(assembleVilla().json, VILLA_BRIEF, [])).house).toBeDefined();
});
