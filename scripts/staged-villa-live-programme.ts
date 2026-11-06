/**
 * ONE controlled live Terra call for stage 3 = ROOM PROGRAMME on the real Terra-designed massing.
 * Software then constructs the floor plans. Default (and `--dry`) prints the exact request, checks the wire
 * schema is strict-compatible, and spends nothing. A paid run needs `--live` and refuses a second paid call.
 * Stage 2 files in live-1/ are read, never written.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {Output} from 'ai';
import {z} from 'zod';
loadEnvConfig(process.cwd());
const live = process.argv.includes('--live'), dir = 'docs/architecture/staged-villa/live-1', out = 'docs/architecture/staged-villa/stage3-programme/live';
const {directionSchema, stageSchemas} = await import('@/lib/villa/staged/spec');
const {applySlice, emptyDraft, measure, runStagedGeneration} = await import('@/lib/villa/staged/pipeline');
const {LiveDesigner} = await import('@/lib/villa/staged/liveDesigner');
const {strictSchemaIssues} = await import('@/lib/villa/scene/strictSchema');
const first = JSON.parse(readFileSync(`${dir}/raw-response.json`, 'utf8'));
const parsed = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(JSON.parse(first.text));
const site = {width: 60, depth: 48};
const d1 = applySlice(emptyDraft(site), 1, parsed.direction), d2 = applySlice(d1, 2, {blocks: parsed.blocks}), m2 = measure(d2, 2, 0);
if (m2.findings.length) throw Error('stage 2 no longer valid');
if (JSON.stringify(m2.scene) !== readFileSync(`${dir}/stage2.scene.json`, 'utf8')) throw Error('stage 2 scene differs from the saved checkpoint; refusing to continue');
const usage = {model: first.model, inputTokens: first.usage.inputTokens, outputTokens: first.usage.outputTokens, costUsd: first.costUsd};
const cp = (stage: 1 | 2, name: string, slice: unknown, spec: typeof d1, scene?: typeof m2.scene) => ({stage, name, attempt: 0, accepted: true, slice, spec, scene, components: stage === 2 ? m2.components : undefined, findings: [], calls: [{stage, purpose: 'design' as const, usage: stage === 1 ? usage : undefined}]});
const resumeFrom = [cp(1, 'architectural designer', parsed.direction, d1), cp(2, 'building massing', {blocks: parsed.blocks}, d2, m2.scene)];
const designer = new LiveDesigner(12000), brief = first.brief;
const ctx = {brief, site, draft: d2, requiredBedrooms: 4, requiredBaths: 3, checkpoints: resumeFrom};
const wire = (await (Output.object({schema: designer.schema(3) as never}) as unknown as {responseFormat: Promise<{schema: Record<string, unknown>}>}).responseFormat).schema;
const issues = strictSchemaIssues(wire);
if (!live) {
  const r = designer.request(3, ctx);
  console.log(r.system, '\n---\n', r.prompt, '\n---');
  console.log('chars', r.system.length + r.prompt.length, '| strict-schema issues:', issues.length ? issues : 'none', '| wire schema bytes', JSON.stringify(wire).length);
  console.log('No call made. Pass --live for the single paid call.');
  process.exit(issues.length ? 1 : 0);
}
if (issues.length) throw Error(`wire schema not strict-compatible: ${issues.join('; ')}`);
mkdirSync(out, {recursive: true});
if (existsSync(`${out}/result.json`)) throw Error('stage 3 programme call already made; refusing a second paid call');
const started = Date.now();
const result = await runStagedGeneration({designer, brief, site, requiredBedrooms: 4, requiredBaths: 3, maxCorrectionsPerStage: 0, maxCalls: 1, maxCostUsd: 2, stopAfter: 3, resumeFrom});
const c3 = result.checkpoints.find(c => c.stage === 3);
// Everything the provider returned is saved first, whether or not software could build a plan from it.
writeFileSync(`${out}/result.json`, JSON.stringify({seconds: (Date.now() - started) / 1000, status: result.status, failedStage: result.failedStage, findings: result.findings, calls: c3?.calls, programme: c3?.slice, construction: c3?.construction, raw: designer.lastRaw}, null, 1));
if (c3?.scene) writeFileSync(`${out}/stage3.scene.json`, JSON.stringify(c3.scene));
console.log(result.status, 'failedStage', result.failedStage, 'calls', JSON.stringify(c3?.calls.map(c => ({usage: c.usage, finish: c.finishReason, failure: c.failure?.message}))));
for (const f of result.findings) console.log(' CONFLICT', f.code, f.subject, '-', f.message);
