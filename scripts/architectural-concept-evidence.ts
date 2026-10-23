/** Offline evidence only. No network, model calls, project-store writes or credentials. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { prepareArchitecturalConcept, conceptEnvelopeSignature } from '../src/lib/v3/architecturalConcept';
import { conceptExample } from '../src/lib/v3/__tests__/fixtures/conceptExamples';
import { compileV3Scene } from '../src/lib/v3/scene';

const directory = 'docs/architecture/architectural-concept-evaluation';
mkdirSync(directory, { recursive: true });
const examples = ['courtyard', 'l-shaped', 'pavilions', 'connected-wings', 'modest'].map(name => {
  const input = conceptExample(name), result = prepareArchitecturalConcept(input);
  if (!result.ok) throw Error(JSON.stringify(result.findings));
  const model = compileV3Scene(result.scene);
  return { name, provenance: 'hand-authored offline fixture', input, scene: result.scene,
    primitiveCount: model.primitives.length, roofPrimitiveCount: model.primitives.filter(p => p.category === 'roof').length,
    envelopeSignature: conceptEnvelopeSignature(result.scene) };
});
writeFileSync(`${directory}/fixtures.json`, JSON.stringify(examples, null, 2) + '\n');
console.log(JSON.stringify(examples.map(({ name, primitiveCount, roofPrimitiveCount }) => ({ name, primitiveCount, roofPrimitiveCount }))));
