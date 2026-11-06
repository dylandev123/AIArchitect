/** ONE live Terra call: concept + massing. Raw response saved before parsing. Refuses to overwrite. No retries. */
import {existsSync, writeFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {z} from 'zod';
loadEnvConfig(process.cwd());
const dir = 'docs/architecture/staged-villa/live-1';
if (existsSync(`${dir}/raw-response.json`)) throw Error('live-1 already exists; refusing a second paid call');
const {generateText, Output} = await import('ai');
const {getAiModel, getAiModelId} = await import('@/lib/ai/model');
const {DEFAULT_PRICING} = await import('@/lib/ai/pricing');
const {directionSchema, stageSchemas} = await import('@/lib/villa/staged/spec');
const {applySlice, emptyDraft, measure} = await import('@/lib/villa/staged/pipeline');

const schema = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict();
const site = {width: 60, depth: 48};
const brief = 'A beautiful, contemporary Caribbean luxury villa on completely flat land (60 x 48 m site). Two storeys, four bedrooms, distinctive massing, beautiful roofs and glazing, a beautiful main entrance, covered outdoor veranda living, an integrated swimming pool, attractive landscaped grounds. Avoid generic rectangular blocks and repetitive identical wings; it must look good from every camera angle.';
const system = `You are the architect in a staged house generator. Return the design direction and the building MASSING only; later stages (room plans, openings, roofs, site) are done separately and by software.
Coordinates: metres, x east, z south (north = -z), origin at site centre, site x in [-30,30], z in [-24,24]. Ground is perfectly flat at elevation 0.
The building is a set of axis-aligned rectangular BLOCKS: id (lowercase-hyphen), role, cx,cz (centre), w (x extent), d (z extent), level 0 (ground) or 1 (upper). Two storeys = a level-1 block stacked over level-0 blocks.
Hard rules measured by software: every block >=1 m inside the site; same-level blocks may touch but must not overlap; a level-1 block must be >=60% supported by level-0 blocks (cantilever <=3 m); every block must touch or stack with another; block sides 3-40 m.
Leave room for later stages: a covered veranda ~4.5 m deep on a garden side, a swimming pool about 9 m deep beyond it, a forecourt at the arrival side, lawns and palms. Total gross floor area should plausibly hold 4 bedrooms plus living, dining, kitchen, entry and stair (about 400-700 m2 over both levels).
Make the composition distinctive and hierarchical: a clear primary mass, a memorable entry, varied heights and offsets.
direction: concept, hierarchy of masses, roofLanguage, entrance, outdoorLiving, landscape, palette (materials from ivory, limestone, timber, bronze, sage; roofColor optional hex).`;
const model = getAiModelId();
const started = Date.now();
let text = '', usage: unknown, error: string | undefined, output: unknown;
try {
  const r = await generateText({model: getAiModel(undefined, model), maxRetries: 0, maxOutputTokens: 8000, abortSignal: AbortSignal.timeout(170000), providerOptions: {openai: {strictJsonSchema: false}}, system, prompt: `BRIEF: ${brief}`, output: Output.object({schema})});
  text = r.text; usage = r.usage; output = r.output;
} catch (e) { error = String((e as Error).message).slice(0, 600); text = (e as {text?: string}).text ?? ''; usage = (e as {usage?: unknown}).usage; }
const u = usage as {inputTokens?: number; outputTokens?: number} | undefined, p = DEFAULT_PRICING[model];
const cost = p && u ? ((u.inputTokens ?? 0) * p.input + (u.outputTokens ?? 0) * p.output) / 1e6 : null;
writeFileSync(`${dir}/raw-response.json`, JSON.stringify({model, brief, system, text, output, usage, costUsd: cost, seconds: (Date.now() - started) / 1000, error}, null, 1));
console.log({model, usage, costUsd: cost, seconds: (Date.now() - started) / 1000, error});
if (error || !output) process.exit(1);
const parsed = schema.parse(output);
let draft = applySlice(emptyDraft(site), 1, parsed.direction);
draft = applySlice(draft, 2, {blocks: parsed.blocks});
const m = measure(draft, 2, 0);
writeFileSync(`${dir}/stage2.scene.json`, JSON.stringify(m.scene));
writeFileSync(`${dir}/findings.json`, JSON.stringify(m.findings, null, 1));
console.log('blocks', parsed.blocks.map(b => `${b.id} L${b.level} ${b.w}x${b.d}@(${b.cx},${b.cz})`).join(' | '));
console.log('findings', m.findings);
