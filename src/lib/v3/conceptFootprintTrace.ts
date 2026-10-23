import type { Point } from '@/lib/architecture/geometry/footprint';
import type { V3SceneObject } from './scene';
import { footprintFrame, resolveFootprint } from './footprint';
import { v3FootprintSchema } from './footprintSchema';
import { v3MassLevelCount } from './stacking';

/** Evidence only: uses the runtime resolver's actual failure branch, with no repair. */
export function conceptFootprintTrace(o: V3SceneObject) {
  const authoredGeometry = o.composition?.footprint;
  const frame = authoredGeometry && v3FootprintSchema.safeParse(authoredGeometry).success ? footprintFrame(o) : undefined;
  return {
    targetId: o.id, kind: authoredGeometry?.kind ?? 'rectangle', authoredGeometry,
    coordinates: 'metres; centred host-local X east, Z south; world x=x0+lx*cos(yaw)+lz*sin(yaw), z=z0-lx*sin(yaw)+lz*cos(yaw); facade intervals west-to-east / north-to-south',
    architecture: o.architecture, dimensions: o.dimensions, transform: o.transform, frame,
    declaredEnvelope: { min: [-o.dimensions[0] / 2, -o.dimensions[2] / 2], max: [o.dimensions[0] / 2, o.dimensions[2] / 2] },
    floors: Array.from({ length: v3MassLevelCount(o) }, (_, floor) => {
      let failure: string | undefined, polygon: readonly Point[] | undefined;
      const resolved = resolveFootprint(o, floor, (reason, candidate) => { failure = reason; polygon = candidate; });
      polygon = resolved?.polygon ?? polygon;
      const placed = polygon?.map(([x, z]) => [x + (frame?.x ?? 0), z + (frame?.z ?? 0)]);
      const bounds = placed?.length ? { min: [Math.min(...placed.map(p => p[0])), Math.min(...placed.map(p => p[1]))], max: [Math.max(...placed.map(p => p[0])), Math.max(...placed.map(p => p[1]))] } : undefined;
      return { floor, polygon, bounds, failure, resolved: !!resolved || !authoredGeometry };
    }),
  };
}
