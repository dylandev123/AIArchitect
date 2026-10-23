/** Hand-authored geometry evidence; none of these fixtures represent live Terra output. */
import type { z } from 'zod';
import type { architecturalConceptSchema } from '../../architecturalConcept';

type Concept = z.input<typeof architecturalConceptSchema>;
export function conceptExample(name = 'courtyard'): Concept {
  const building: Concept['buildings'][number] = {
    id: 'home', label: 'Garden home', role: 'residence', x: 0, z: 0, width: 24, depth: 18,
    storeyHeights: [3.4], roof: { form: 'flat', overhang: .3 },
  };
  const c: Concept = {
    format: 'v3-architectural-concept-1', title: `OFFLINE ${name}`, concept: 'A quiet garden shapes the composition.',
    character: 'Neutral architectural massing', decisions: ['Arrival faces a sheltered outdoor space.'], assumptions: ['Flat site.'],
    site: { width: 70, depth: 60 }, buildings: [building], outdoorSpaces: [], connections: [],
  };
  if (name === 'courtyard') {
    building.storeyHeights = [3.8, 3.1]; building.roof.form = 'floating-flat';
    building.footprint = { kind: 'articulated', operations: [{ type: 'recess', facade: 'south', start: .3, end: .7, depth: 10 }] };
    c.outdoorSpaces = [{ id: 'court', label: 'Quiet court', purpose: 'Sheltered garden gathering', kind: 'courtyard', x: 0, z: 4, width: 8, depth: 8 }];
  } else if (name === 'l-shaped') {
    building.footprint = { kind: 'articulated', operations: [{ type: 'notch', corner: 'se', width: 10, depth: 9 }] };
    building.roof = { form: 'mono-pitch', pitchDegrees: 8, overhang: .2 };
  } else if (name === 'pavilions') {
    building.width = 12; building.depth = 10; building.x = -12; building.rotationDegrees = 25; building.roof.form = 'hip';
    c.buildings.push({ ...building, id: 'studio', label: 'Round studio', role: 'studio', x: 12, z: 0, width: 10, depth: 10, rotationDegrees: 0,
      roof: { form: 'floating-flat', overhang: .2 }, footprint: { kind: 'outline', operations: [], segments: [
        { id: 'circle', type: 'arc', center: [0, 0], radius: 5, startAngle: 0, sweep: 360 },
      ] } });
  } else if (name === 'connected-wings') {
    building.width = 16; building.depth = 10; building.storeyHeights = [3.8, 3.1]; building.roof.form = 'gable';
    c.buildings.push({ ...building, id: 'wing', label: 'Low wing', role: 'wing', x: 12, z: 2, width: 8, depth: 6, storeyHeights: [3.4], roof: { form: 'mono-pitch', pitchDegrees: 12, overhang: .3 } });
    c.connections = [{ from: 'home', to: 'wing' }];
  } else if (name === 'modest') {
    building.width = 8; building.depth = 6; building.roof = { form: 'gable', pitchDegrees: 25, overhang: .5 }; c.site = { width: 24, depth: 24 };
  }
  return c;
}
