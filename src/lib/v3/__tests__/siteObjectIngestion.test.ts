import { describe, expect, it } from 'vitest';
import { ingestV3GenerationOutput } from '../ingestion';
import { normalizeV3GenerationOutput } from '../generation';
import { recoverV3FailedPreview } from '../failedPreview';
import { buildV3TerrainSurface, compileV3Scene } from '../scene';
import { validateV3Scene } from '../validation';
import { malformedCliffsideDrive } from './cliffsideIngestionFixture';

describe('cliffside connection geometry ingestion', () => {
  it.each([
    ['zero dimensions', {}],
    ['missing dimensions', { dimensions: undefined }],
    ['malformed position', { transform: { position: ['bad', 0], scale: [0, 1, 1] } }],
    ['absent box', { transform: undefined, dimensions: undefined }],
    ['driveway type', { type: 'driveway', transform: undefined, dimensions: undefined }],
  ])('%s survives, grades and matches failed-preview normalization', (_, overrides) => {
    const raw = malformedCliffsideDrive(overrides);
    const baseline = ingestV3GenerationOutput({ ...raw, objects: raw.objects.slice(0, -1) });
    const result = ingestV3GenerationOutput(raw);
    expect(result.validation.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.scene.objects.slice(0, -1)).toEqual(baseline.scene.objects);
    const drive = result.scene.objects.at(-1)!;
    expect(drive.id).toBe('upper-road-drive');
    expect(drive.dimensions.every(n => Number.isFinite(n) && n > 0)).toBe(true);
    expect(result.scene.siteHierarchy).toEqual(raw.siteHierarchy);
    expect(buildV3TerrainSurface(result.scene).grading!.connections.find(c => c.id === 'drive')?.graded).toBe(true);
    expect(compileV3Scene(result.scene).primitives.some(p => p.sourceObjectId === drive.id)).toBe(true);
    expect(recoverV3FailedPreview(raw)?.scene.objects.find(o => o.id === drive.id)).toMatchObject({ transform: drive.transform, dimensions: drive.dimensions });
    expect(normalizeV3GenerationOutput(result.scene).scene).toEqual(result.scene);
  });
  it('omits unusable optional site objects with a warning, but retains fatal building validation', () => {
    const raw = malformedCliffsideDrive();
    delete raw.siteHierarchy!.connections[0].surfaceObjectId;
    const result = ingestV3GenerationOutput(raw);
    expect(result.ok).toBe(true);
    expect(result.notes).toContainEqual(expect.objectContaining({ code: 'SITE_OBJECT_OMITTED', targetId: 'upper-road-drive' }));
    const broken = malformedCliffsideDrive({ type: 'building-mass' });
    expect(ingestV3GenerationOutput(broken).validation.issues).toContainEqual(expect.objectContaining({ code: 'INVALID_TRANSFORM', severity: 'fatal' }));
  });
  it.each(['terrace', 'landscape-zone', 'retaining-wall', 'pool', 'deck', 'pool-deck', 'terrain-region'])('contains an unusable %s without inventing geometry', type => {
    const result = ingestV3GenerationOutput(malformedCliffsideDrive({ type, transform: undefined, dimensions: undefined }));
    expect(result.ok).toBe(true);
    expect(result.scene.objects.some(o => o.id === 'upper-road-drive')).toBe(false);
    expect(result.notes.some(n => n.code === 'SITE_OBJECT_OMITTED')).toBe(true);
  });
  it('does not remove structural site hosts or derive bounds from malformed routes', () => {
    const raw = malformedCliffsideDrive({ type: 'terrace' });
    Object.assign(raw.objects[0], { hostId: 'upper-road-drive' });
    expect(ingestV3GenerationOutput(raw).ok).toBe(false);
    const badRoute = malformedCliffsideDrive();
    badRoute.siteHierarchy!.connections[0].route = [[0, 0, 0], [0, 0, 0]];
    expect(ingestV3GenerationOutput(badRoute).notes.some(n => n.code === 'SITE_GEOMETRY_DERIVED')).toBe(false);
  });
  it('reports the exact invalid field for unrepairable geometry', () => {
    const raw = malformedCliffsideDrive({ type: 'building-mass' });
    expect(validateV3Scene(raw).errors).toContain('upper-road-drive has invalid transform or dimensions. Invalid fields: dimensions.');
  });
});
