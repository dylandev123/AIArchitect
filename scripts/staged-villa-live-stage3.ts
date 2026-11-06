/** SUPERSEDED: this asked Terra for recursive guillotine plans and failed (see stage3-programme/README.md). Use staged-villa-live-programme.ts. */
/** ONE live Terra call for stage 3 on the real Terra-designed massing. `--dry` prints the request and spends nothing. */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {z} from 'zod';
loadEnvConfig(process.cwd());
const dry = process.argv.includes('--dry'), dir = 'docs/architecture/staged-villa/live-1';
const {directionSchema, stageSchemas} = await import('@/lib/villa/staged/spec');
const {applySlice, emptyDraft, measure, runStagedGeneration} = await import('@/lib/villa/staged/pipeline');
const {LiveDesigner} = await import('@/lib/villa/staged/liveDesigner');
const first = JSON.parse(readFileSync(`${dir}/raw-response.json`, 'utf8'));
const out = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(JSON.parse(first.text));
const site = {width: 60, depth: 48};
const d1 = applySlice(emptyDraft(site), 1, out.direction), d2 = applySlice(d1, 2, {blocks: out.blocks}), m2 = measure(d2, 2, 0);
if (m2.findings.length) throw Error('stage 2 no longer valid');
const usage = {model: first.model, inputTokens: first.usage.inputTokens, outputTokens: first.usage.outputTokens, costUsd: first.costUsd};
const cp = (stage: 1 | 2, name: string, slice: unknown, spec: typeof d1, scene?: typeof m2.scene) => ({stage, name, attempt: 0, accepted: true, slice, spec, scene, components: stage === 2 ? m2.components : undefined, findings: [], calls: [{stage, purpose: 'design' as const, usage: stage === 1 ? usage : undefined}]});
const resumeFrom = [cp(1, 'architectural designer', out.direction, d1), cp(2, 'building massing', {blocks: out.blocks}, d2, m2.scene)];
const designer = new LiveDesigner(12000);
const brief = first.brief, opts = {designer, brief, site, requiredBedrooms: 4, requiredBaths: 3, maxCorrectionsPerStage: 0, maxCalls: 1, maxCostUsd: 5, stopAfter: 3 as const, resumeFrom};
if (dry) {
  const r = designer.request(3, {brief, site, draft: d2, requiredBedrooms: 4, requiredBaths: 3, checkpoints: resumeFrom});
  console.log(r.system, '\n---\n', r.prompt); console.log('chars', r.system.length + r.prompt.length); process.exit(0);
}
if (existsSync(`${dir}/stage3.raw.json`)) throw Error('stage 3 live call already made; refusing a second paid call');
const started = Date.now();
const result = await runStagedGeneration({...opts, onCheckpoint: c => { if (c.stage === 3) writeFileSync(`${dir}/stage3.checkpoint.json`, JSON.stringify({accepted: c.accepted, findings: c.findings, calls: c.calls, slice: c.slice}, null, 1)); }});
const c3 = result.checkpoints.find(c => c.stage === 3);
writeFileSync(`${dir}/stage3.raw.json`, JSON.stringify({raw: designer.lastRaw, calls: c3?.calls, seconds: (Date.now() - started) / 1000, status: result.status, findings: result.findings}, null, 1));
if (c3?.scene) writeFileSync(`${dir}/stage3.scene.json`, JSON.stringify(c3.scene));
console.log(result.status, 'failedStage', result.failedStage, 'calls', c3?.calls, 'seconds', (Date.now() - started) / 1000);
for (const f of result.findings) console.log(' FINDING', f.code, f.subject, '-', f.message);
