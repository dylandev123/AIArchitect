/**
 * STAGE 4: ONE controlled live Terra exterior-design call on the real Stage 2/3 checkpoint.
 * Default (and --dry): prints the exact request, checks the wire schema is strict-compatible, runs the whole derive/measure path with a
 * clearly labelled MOCK answer, and spends nothing. A paid run needs --live and refuses a second paid call. No retry, no correction,
 * no visual-review call. Everything the provider returns is saved before any success is assumed. Stage 3 files are read, never written.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {Output} from 'ai';
loadEnvConfig(process.cwd());
const live = process.argv.includes('--live'), dir = 'docs/architecture/staged-villa/stage4-exterior', out = `${dir}/live`;
const {loadTerraStage3, STAGE3_SCENE} = await import('@/lib/villa/staged/stage3Checkpoint');
const {exteriorDesignSchema, deriveStage4, measureExterior, roomPlanWarnings} = await import('@/lib/villa/staged/exterior');
const {LiveExteriorDesigner, exteriorRequest} = await import('@/lib/villa/staged/exteriorDesigner');
const {mockExteriorDesign} = await import('@/lib/villa/staged/exterior.fixture');
const {measure} = await import('@/lib/villa/staged/pipeline');
const {strictSchemaIssues} = await import('@/lib/villa/scene/strictSchema');
const s3 = loadTerraStage3();
if (JSON.stringify(s3.scene) !== readFileSync(STAGE3_SCENE, 'utf8')) throw Error('Stage 3 no longer rebuilds identically; refusing to continue');
const requested = Object.fromEntries((s3.programme.rooms as {id: string; area: number}[]).map(r => [r.id, r.area]));
const req = exteriorRequest(s3.brief, s3.spec, requested);
const wire = (await (Output.object({schema: exteriorDesignSchema as never}) as unknown as {responseFormat: Promise<{schema: Record<string, unknown>}>}).responseFormat).schema;
const issues = strictSchemaIssues(wire);
const finish = (design: unknown, tag: string) => {
  const d = exteriorDesignSchema.parse(design), r = deriveStage4(s3.spec, d);
  const m = r.findings.length ? undefined : measure(r.spec, 4, 4, 3);
  const findings = [...r.findings, ...(m?.findings ?? [])];
  const metrics = m?.scene ? measureExterior(r.spec, m.scene, roomPlanWarnings(s3.spec, requested)) : undefined;
  return {r, m, findings, metrics, tag};
};
if (!live) {
  console.log(req.system, '\n---\n', req.prompt, '\n---');
  console.log('chars', req.system.length + req.prompt.length, '| strict-schema issues:', issues.length ? issues : 'none', '| wire schema bytes', JSON.stringify(wire).length);
  const x = finish(mockExteriorDesign(), 'mock');
  console.log('MOCK answer -> findings', x.findings.length, '| elements', x.m?.scene?.elements.length, '| warnings', x.metrics?.warnings.length);
  console.log('No call made. Pass --live for the single paid call.');
  process.exit(issues.length ? 1 : 0);
}
if (issues.length) throw Error(`wire schema not strict-compatible: ${issues.join('; ')}`);
mkdirSync(out, {recursive: true});
if (existsSync(`${out}/result.json`)) throw Error('stage 4 live call already made; refusing a second paid call');
const designer = new LiveExteriorDesigner({maxOutputTokens: 8000}), started = Date.now();
let called: Awaited<ReturnType<typeof designer.design>> | undefined, failure: string | undefined;
try { called = await designer.design(s3.brief, s3.spec, requested); } catch (e) { failure = (e as Error).message.slice(0, 600); (e as {detail?: unknown}).detail && writeFileSync(`${out}/failure-detail.json`, JSON.stringify((e as {detail?: unknown}).detail, null, 1)); }
// Persist everything the provider returned before interpreting it.
writeFileSync(`${out}/result.json`, JSON.stringify({seconds: (Date.now() - started) / 1000, failure, usage: called?.usage, finishReason: called?.finishReason, design: called?.value, raw: designer.lastRaw}, null, 1));
writeFileSync(`${out}/request.json`, JSON.stringify(req, null, 1));
if (!called) { console.log('Terra call failed:', failure); process.exit(2); }
const x = finish(called.value, 'terra');
writeFileSync(`${dir}/terra-stage4.checkpoint.json`, JSON.stringify({stage: 4, accepted: x.findings.length === 0, findings: x.findings, derivation: x.r.derivation, usage: called.usage, design: called.value, spec: x.r.spec, metrics: x.metrics, preservedFrom: 'stage3-programme/live/stage3.scene.json (unchanged)'}, null, 1));
if (x.m?.scene) writeFileSync(`${dir}/terra-stage4.scene.json`, JSON.stringify(x.m.scene));
console.log('cost USD', called.usage.costUsd, 'tokens', called.usage.inputTokens, '/', called.usage.outputTokens, 'finish', called.finishReason, 'seconds', (Date.now() - started) / 1000);
console.log('accepted:', x.findings.length === 0);
for (const f of x.findings) console.log(' FINDING', f.code, f.subject, '-', f.message);
for (const a of x.r.derivation.adjustments) console.log(' ADJUSTED', a.subject, a.what);
