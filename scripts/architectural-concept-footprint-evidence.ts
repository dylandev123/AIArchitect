/** Offline replay of the ONE captured live reproduction; makes no provider calls. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { prepareArchitecturalConcept } from '../src/lib/v3/architecturalConcept';
import { compileV3Scene, validateV3CompiledGeometry } from '../src/lib/v3/scene';

const directory = 'docs/architecture/architectural-concept-evaluation/footprint-investigation';
const raw = readFileSync('src/lib/v3/__tests__/fixtures/concept-estate-reproduction-2026-10-22.json', 'utf8');
const result = prepareArchitecturalConcept(JSON.parse(raw));
if (!result.ok) throw new Error(JSON.stringify(result.findings));
const model = compileV3Scene(result.scene), audit = validateV3CompiledGeometry(result.scene, model);
if (!audit.ok) throw new Error(JSON.stringify(audit));
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/replay.json`, JSON.stringify({
  provenance: 'Offline replay of a real Terra response to the reported brief. The reproduction succeeded; this is NOT the lost main-estate failure.',
  providerCallsDuringReplay: 0, rawResponseSha256: createHash('sha256').update(raw).digest('hex'),
  findings: result.findings, footprintTrace: result.footprintTrace, compiledGeometryAudit: audit,
  primitiveCount: model.primitives.length, roofCount: model.primitives.filter(p => p.category === 'roof').length,
}, null, 2) + '\n');
const generation = JSON.parse(readFileSync(`${directory}/generation.json`, 'utf8'));
// Preserve real model/usage provenance from the original HTTP 200, use the replayed scene.
result.scene.metadata = { ...result.scene.metadata, ...generation.metadata };
writeFileSync(`${directory}/render-response.json`, JSON.stringify({ scene: result.scene, findings: result.findings, footprintTrace: result.footprintTrace, providerCalls: 0 }, null, 2) + '\n');
console.log(JSON.stringify({ ok: result.ok, primitiveCount: model.primitives.length, audit, footprintTrace: result.footprintTrace }));
