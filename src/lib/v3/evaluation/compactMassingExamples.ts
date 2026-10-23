/** Deterministic hand-authored fixtures, NEVER real Terra generations. */
import type { z } from 'zod';
import type { CompactMassing } from '../compactMassing';
import type { architecturalConceptSchema } from '../architecturalConcept';
type Concept = z.input<typeof architecturalConceptSchema>;
export const compactMassingExampleNames = ['asymmetric-wings', 'l-residence', 'u-courtyard', 'upper-setback', 'recessed-entrance', 'exact-outline'] as const;
export type CompactMassingExampleName = typeof compactMassingExampleNames[number];
export function compactMassingExample(name: CompactMassingExampleName): { compact: CompactMassing; legacy: Concept } {
  const compact: CompactMassing = {
    format: 'terra-massing-1', title: `OFFLINE fixture: ${name}`, concept: 'Hand-authored composition for deterministic comparison.',
    site: { width: 70, depth: 60 }, volumes: [{ name: 'home', at: [0, 0], plan: { kind: 'rectangle', width: 24, depth: 18 }, heights: [3.8, 3.1], roof: { form: 'flat', overhang: .2 } }],
  };
  // This side is authored independently; it does NOT use the compact expansion.
  const legacy: Concept = {
    format: 'v3-architectural-concept-1', title: compact.title, concept: compact.concept, character: 'Independent existing-concept fixture',
    decisions: ['Executable geometry defines this composition.'], site: compact.site,
    buildings: [{ id: 'mass-home', label: 'home', role: 'residence', x: 0, z: 0, width: 24, depth: 18, storeyHeights: [3.8, 3.1], roof: { form: 'flat', overhang: .2 } }],
  };
  const v = compact.volumes[0], b = legacy.buildings[0];
  if (name === 'asymmetric-wings') {
    v.plan = { kind: 'rectangle', width: 16, depth: 10 }; b.width = 16; b.depth = 10;
    v.roof = b.roof = { form: 'gable', pitchDegrees: 22, overhang: .2 };
    compact.volumes.push({ name: 'wing', attach: { to: 'home', side: 'east', offset: 2 }, plan: { kind: 'rectangle', width: 8, depth: 6 }, heights: [3.4], roof: { form: 'mono-pitch', pitchDegrees: 12, overhang: .2 } });
    legacy.buildings.push({ id: 'mass-wing', label: 'wing', role: 'residence', x: 12, z: 2, width: 8, depth: 6, storeyHeights: [3.4], roof: { form: 'mono-pitch', pitchDegrees: 12, overhang: .2 } });
    legacy.connections = [{ from: 'mass-home', to: 'mass-wing' }];
  } else if (name === 'l-residence') {
    v.plan = { kind: 'l', width: 24, depth: 18, cut: { corner: 'se', width: 10, depth: 9 } };
    b.footprint = { kind: 'articulated', operations: [{ id: 'cut-1', type: 'notch', corner: 'se', width: 10, depth: 9, floors: 'all' }] };
    v.roof = b.roof = { form: 'mono-pitch', pitchDegrees: 8, overhang: .2 };
  } else if (name === 'u-courtyard') {
    v.plan = { kind: 'u', width: 24, depth: 18, court: { side: 'south', width: 12, depth: 10 } };
    b.footprint = { kind: 'articulated', operations: [{ id: 'cut-1', type: 'recess', facade: 'south', start: .25, end: .75, depth: 10, floors: 'all' }] };
  } else if (name === 'upper-setback') {
    v.upperSetbacks = [{ corner: 'se', width: 10, depth: 9 }];
    b.footprint = { kind: 'articulated', operations: [{ id: 'cut-1', type: 'notch', corner: 'se', width: 10, depth: 9, floors: 'upper' }] };
  } else if (name === 'recessed-entrance') {
    v.recesses = [{ side: 'north', width: 6, depth: 2, offset: -3 }];
    b.footprint = { kind: 'articulated', operations: [{ id: 'cut-1', type: 'recess', facade: 'north', start: .25, end: .5, depth: 2, floors: 'all' }] };
  } else if (name === 'exact-outline') {
    // Asymmetric origin: preserves coordinates, derives 18x12 symmetric addressing bounds.
    const points: [number, number][] = [[-3,-4],[9,-4],[9,6],[-3,6]];
    const segments = points.map((start, i) => ({ type: 'line' as const, start, end: points[(i + 1) % points.length] }));
    v.plan = { kind: 'outline', segments };
    b.width = 18; b.depth = 12; b.footprint = { kind: 'outline', operations: [], segments: segments.map((s, i) => ({ ...s, id: `edge-${i + 1}` })) };
  }
  return { compact, legacy };
}
