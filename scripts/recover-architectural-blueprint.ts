/** Offline replay only. Imports planning/construction, never an AI author or API route. */
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint, v3ArchitecturalBlueprintSchema } from '../src/lib/v3/architecturalBlueprint';
import { architecturalIdentityDeclarations, normalizeArchitecturalBlueprintIdentities } from '../src/lib/v3/architecturalBlueprintIdentity';

const args = process.argv.slice(2);
const argument = (key: string) => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1]; };
const source = argument('--source');
if (!source) throw new Error('Usage: npm run recover:blueprint -- --source <saved-capture-or-blueprint.json> [--output <private-directory>]');
// Defense against accidentally adding a network dependency to this replay path.
globalThis.fetch = async () => { throw new Error('Network is forbidden during offline blueprint recovery.'); };
const sourceText = readFileSync(resolve(source), 'utf8'), saved = JSON.parse(sourceText);
const isCapture = typeof saved.rawResponse === 'string';
if (saved.omittedForSize || saved.rawResponse === null) throw new Error('The capture omitted its response. Exact recovery is unavailable.');
if (isCapture && saved.redacted) throw new Error('The response was redacted. It cannot be asserted to be the exact original blueprint.');
const raw = isCapture ? saved.rawResponse as string : sourceText.trimEnd();
const sha256 = createHash('sha256').update(raw).digest('hex');
if (isCapture && saved.sha256 && saved.sha256 !== sha256) throw new Error('Capture hash mismatch. Original evidence must be recovered before replay.');
const parsed = v3ArchitecturalBlueprintSchema.parse(JSON.parse(raw));
const normalized = normalizeArchitecturalBlueprintIdentities(parsed);
const plan = planV3ArchitecturalBlueprint(parsed, { buildFirst: true });
const built = plan.approval ? constructV3ArchitecturalBlueprint(plan.approval) : undefined;
const findings = built?.findings ?? plan.findings;
const declarations = architecturalIdentityDeclarations(parsed), collisions = [...new Set(declarations.map(d => d.id))]
  .map(id => ({ id, declarations: declarations.filter(d => d.id === id) })).filter(c => c.declarations.length > 1);
const report = {
  offline: true, providerCalls: 0, paidGenerations: 0, source: resolve(source), sourceSha256: sha256,
  capturedAt: isCapture ? saved.capturedAt : undefined, originalDiagnostics: isCapture ? saved.diagnostics : undefined,
  counts: { buildings: parsed.buildings.length, roofs: parsed.buildings.length,
    storeys: parsed.buildings.reduce((sum, b) => sum + b.storeys.length, 0),
    rooms: parsed.buildings.reduce((sum, b) => sum + b.storeys.reduce((n, s) => n + s.spaces.length, 0), 0),
    outdoorFeatures: parsed.features.length, connections: parsed.connections.length, entrances: parsed.entrances.length,
    facadeOpenings: parsed.buildings.reduce((sum, b) => sum + (b.facade.openings?.length ?? 0), 0),
    verticalCirculation: parsed.verticalCirculation.length, partitions: parsed.partitions.length, doors: parsed.doors.length,
  }, collisions, identityChanges: normalized.changes,
  outcome: built?.ok ? built.outcome ?? 'complete' : 'cannot-construct',
  diagnostics: built && 'diagnostics' in built ? built.diagnostics : undefined,
  findings, sceneRecovered: !!built?.scene, compiledPrimitives: built?.model?.primitives.length,
  blockingCodes: built && 'diagnostics' in built ? (built.diagnostics as {classification:string;code:string}[]).filter(f=>f.classification==='core-blocking').map(f=>f.code) : findings.filter(f=>f.severity==='fatal').map(f=>f.code),
};
const output = resolve(argument('--output') ?? `.v3-debug/recovered-${sha256.slice(0, 12)}`);
mkdirSync(output, { recursive: true, mode: 0o700 }); chmodSync(output, 0o700);
const write = (name: string, text: string) => {
  const file = `${output}/${name}`;
  // Preserve evidence across reruns. Never silently replace a different input/result.
  if (existsSync(file)) { if (readFileSync(file, 'utf8') !== text) throw new Error(`Recovery output already exists with different contents: ${name}. Choose another --output directory.`); return; }
  writeFileSync(file, text, { mode: 0o600, flag: 'wx' });
};
write('original-input.json', sourceText); write('original-blueprint.json', raw);
write('normalized-blueprint.json', JSON.stringify(normalized.blueprint, null, 2)+'\n');
write('recovery-report.json', JSON.stringify(report, null, 2)+'\n');
if (built?.ok && built.scene) write('recovered-scene.json', JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:built.scene}, null, 2)+'\n');
console.log(JSON.stringify({ output, sourceSha256: sha256, counts: report.counts, identityChanges: normalized.changes.length, outcome: report.outcome, providerCalls: 0, blockingCodes:report.blockingCodes, remainingFatalCodes: findings.filter(f => f.severity === 'fatal').map(f => f.code) }, null, 2));
