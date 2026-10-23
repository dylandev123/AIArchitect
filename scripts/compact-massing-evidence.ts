/** Deterministic fixtures only. No network or provider imports/calls. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { compactMassingExample, compactMassingExampleNames } from '../src/lib/v3/evaluation/compactMassingExamples';
import { prepareCompactMassing } from '../src/lib/v3/compactMassing';
import { conceptEnvelopeSignature, prepareArchitecturalConcept } from '../src/lib/v3/architecturalConcept';
import { compileV3Scene } from '../src/lib/v3/scene';
const directory = 'docs/architecture/compact-massing-evaluation';
mkdirSync(directory, { recursive: true });
const fixtures = compactMassingExampleNames.map(name => {
  const { compact, legacy } = compactMassingExample(name);
  const result = prepareCompactMassing(compact), baseline = prepareArchitecturalConcept(legacy);
  assert(result.ok, JSON.stringify(result.findings)); assert(baseline.ok, JSON.stringify(baseline.findings));
  const model = compileV3Scene(result.scene), comparison = compileV3Scene(baseline.scene);
  assert.equal(conceptEnvelopeSignature(result.scene), conceptEnvelopeSignature(baseline.scene));
  assert.deepEqual(model.primitives, comparison.primitives);
  writeFileSync(`${directory}/${name}.json`, JSON.stringify(compact, null, 2) + '\n');
  return { name, provenance: 'deterministic-hand-authored-fixture', semanticGeometryEqual: true, compiledPrimitivesEqual: true,
    masses: result.scene.objects.length, storeys: result.scene.interior?.storeys.length, rooms: result.scene.interior?.rooms.length,
    primitives: model.primitives.length, roofs: model.primitives.filter(p => p.category === 'roof').length };
});
const report = { provenance: 'deterministic-hand-authored-fixtures', liveTerraGenerations: 0, providerCalls: 0, fixtures };
writeFileSync(`${directory}/checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
