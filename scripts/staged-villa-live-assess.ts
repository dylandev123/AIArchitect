/** Offline: evaluate the preserved live response. Only over-length descriptive strings are truncated (no geometry/design fields). */
import {readFileSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import {directionSchema, stageSchemas} from '@/lib/villa/staged/spec';
import {applySlice, emptyDraft, measure} from '@/lib/villa/staged/pipeline';
const dir = 'docs/architecture/staged-villa/live-1';
const out = JSON.parse(JSON.parse(readFileSync(`${dir}/raw-response.json`, 'utf8')).text);
const cut = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const truncated: string[] = [];
const fix = (v: string, n: number, name: string) => { if (v.length > n) truncated.push(`${name}: ${v.length}>${n}`); return cut(v, n); };
out.direction.landscape = fix(out.direction.landscape, 240, 'direction.landscape');
out.blocks.forEach((b: {role: string}, i: number) => { b.role = fix(b.role, 60, `blocks.${i}.role`); });
const p = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(out);
const draft = applySlice(applySlice(emptyDraft({width: 60, depth: 48}), 1, p.direction), 2, {blocks: p.blocks});
const m = measure(draft, 2, 0);
writeFileSync(`${dir}/stage2.scene.json`, JSON.stringify(m.scene)); writeFileSync(`${dir}/findings.json`, JSON.stringify({truncated, findings: m.findings}, null, 1));
console.log('truncated', truncated, '\nfindings', m.findings, '\nelements', m.scene?.elements.length);
