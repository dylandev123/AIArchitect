/** Offline: persist the corrected, last-valid Stage 2 checkpoint of the real Terra massing. */
import {readFileSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import {directionSchema, stageSchemas} from '@/lib/villa/staged/spec';
import {applySlice, emptyDraft, measure} from '@/lib/villa/staged/pipeline';
const dir = 'docs/architecture/staged-villa/live-1';
const out = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(JSON.parse(JSON.parse(readFileSync(`${dir}/raw-response.json`, 'utf8')).text));
const d = applySlice(applySlice(emptyDraft({width: 60, depth: 48}), 1, out.direction), 2, {blocks: out.blocks}), m = measure(d, 2, 0);
writeFileSync(`${dir}/stage2.scene.json`, JSON.stringify(m.scene));
writeFileSync(`${dir}/stage2.checkpoint.json`, JSON.stringify({accepted: m.findings.length === 0, findings: m.findings, openSpaces: d.openSpaces, enclosedBlocks: d.blocks.map(b => b.id)}, null, 1));
console.log(m.findings.length, d.openSpaces.map(o => o.id), m.scene!.elements.length);
