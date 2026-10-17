import { cliffside } from '../parity/terrain';

/** Reconstruction, NOT a captured Terra response. The original payload was not retained.
 * Known live evidence: upper-road-drive failed INVALID_TRANSFORM; 15 other objects recovered.
 * Uses existing offline cliff terrain/architecture plus the reported semantic id.
 */
export function malformedCliffsideDrive(overrides: Record<string, unknown> = {}) {
  const scene = cliffside();
  scene.siteHierarchy!.connections[0].surfaceObjectId = 'upper-road-drive';
  return { ...scene, objects: [...scene.objects, {
    id: 'upper-road-drive', type: 'path', semanticRole: 'upper road driveway', label: 'Upper road driveway',
    material: { id: 'paving', color: '#8f8a80', surface: 'paving' },
    transform: { position: [25, 3, -60], rotation: [0, 0, 0], scale: [1, 1, 1] },
    dimensions: [55, 0, 53], ...overrides,
  }] };
}
