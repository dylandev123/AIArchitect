/**
 * OFFLINE (no model, no network): builds stage 3 from a HIGH-LEVEL room programme on the real
 * Terra-designed Breezeway massing, writes the plans/scene/option metrics for review.
 * The programme is the developer-authored stand-in in programme.fixture.ts.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import {directionSchema, stageSchemas} from '@/lib/villa/staged/spec';
import {applySlice, emptyDraft, measure} from '@/lib/villa/staged/pipeline';
import {solveProgramme, type LayoutOption} from '@/lib/villa/staged/roomSolver';
import {breezewayProgramme} from '@/lib/villa/staged/programme.fixture';
import {roomEdges, type Room} from '@/lib/villa/staged/layout';

const live = 'docs/architecture/staged-villa/live-1', out = 'docs/architecture/staged-villa/stage3-programme';
mkdirSync(out, {recursive: true});
const first = JSON.parse(readFileSync(`${live}/raw-response.json`, 'utf8'));
const parsed = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(JSON.parse(first.text));
const d2 = applySlice(applySlice(emptyDraft({width: 60, depth: 48}), 1, parsed.direction), 2, {blocks: parsed.blocks});
const check = (s: Parameters<NonNullable<Parameters<typeof solveProgramme>[2]>['check'] & object>[0]) => measure(applySlice(d2, 3, s), 3, 4, 3).findings;
const t0 = Date.now();
const res = solveProgramme(d2, breezewayProgramme, {requiredBedrooms: 4, requiredBaths: 3, check});
const ms = Date.now() - t0;
if (!res.ok) { console.log('NO LAYOUT', JSON.stringify(res.conflicts, null, 1)); process.exit(1); }

const FILL: Record<string, string> = {foyer: '#e8d9b5', living: '#f3e3c3', dining: '#f0dcb0', kitchen: '#d9e6c6', bedroom: '#cfe0ee', bath: '#bfe3e0', hall: '#eee', stair: '#d8b99a', gallery: '#e7e7e7', lounge: '#e9d5ee', media: '#e0cfe6'};
function svg(o: LayoutOption, level: number, spec: ReturnType<typeof applySlice>) {
  const rooms = o.rooms.filter(r => r.level === level), S = 24, x0 = Math.min(...rooms.map(r => r.x0)) - 1, z0 = Math.min(...rooms.map(r => r.z0)) - 1, x1 = Math.max(...rooms.map(r => r.x1)) + 1, z1 = Math.max(...rooms.map(r => r.z1)) + 1;
  const X = (v: number) => ((v - x0) * S).toFixed(1), Z = (v: number) => ((v - z0) * S).toFixed(1);
  const edges = roomEdges(o.rooms), byId = new Map(o.rooms.map(r => [r.id, r] as [string, Room]));
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${(x1 - x0) * S}" height="${(z1 - z0) * S + 28}" font-family="sans-serif">\n<text x="6" y="16" font-size="13">${spec.direction.name} · stage 3 · ${level === 0 ? 'ground' : 'upper'} floor · ${o.id} (north up)</text>\n<g transform="translate(0,24)">\n`;
  for (const r of rooms) g += `<rect x="${X(r.x0)}" y="${Z(r.z0)}" width="${((r.x1 - r.x0) * S).toFixed(1)}" height="${((r.z1 - r.z0) * S).toFixed(1)}" fill="${FILL[r.type] ?? '#fff'}" stroke="#333" stroke-width="2"/>\n<text x="${X((r.x0 + r.x1) / 2)}" y="${Z((r.z0 + r.z1) / 2)}" font-size="9" text-anchor="middle">${r.id}</text>\n<text x="${X((r.x0 + r.x1) / 2)}" y="${(Number(Z((r.z0 + r.z1) / 2)) + 10).toFixed(1)}" font-size="8" fill="#555" text-anchor="middle">${((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(0)} m²</text>\n`;
  for (const l of o.slice.links) {
    const a = byId.get(l.a)!, b = byId.get(l.b)!; if (a.level !== level || b.level !== level) continue;
    const e = edges.filter(x => (x.a === l.a && x.b === l.b) || (x.a === l.b && x.b === l.a)).sort((p, q) => (q.hi - q.lo) - (p.hi - p.lo))[0]; if (!e) continue;
    const c = e.lo + l.t * (e.hi - e.lo), w = 0.9, col = l.kind === 'door' ? '#c0392b' : '#27ae60';
    g += e.axis === 'x' ? `<line x1="${X(e.line)}" y1="${Z(c - w / 2)}" x2="${X(e.line)}" y2="${Z(c + w / 2)}" stroke="${col}" stroke-width="5"/>\n` : `<line x1="${X(c - w / 2)}" y1="${Z(e.line)}" x2="${X(c + w / 2)}" y2="${Z(e.line)}" stroke="${col}" stroke-width="5"/>\n`;
  }
  for (const s of o.slice.stairs) { const r = byId.get(s.room)!; if (r.level === level) g += `<text x="${X(r.x0 + 0.3)}" y="${Z(r.z0 + 1)}" font-size="9" fill="#7a3">stair start ${s.start}, hugs ${s.hug}</text>\n`; }
  return g + '</g></svg>\n';
}

writeFileSync(`${out}/programme.json`, JSON.stringify(breezewayProgramme, null, 1));
const summary = res.options.map(o => ({id: o.id, score: +o.score.toFixed(2), metrics: o.metrics, rooms: o.rooms.map(r => ({id: r.id, block: r.block, type: r.type, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, m2: +((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1)})), links: o.slice.links, addedLinks: o.addedLinks, stairs: o.slice.stairs}));
writeFileSync(`${out}/options.json`, JSON.stringify({solverMs: ms, stats: res.stats, options: summary}, null, 1));
res.options.forEach((o, i) => {
  const spec = applySlice(d2, 3, o.slice);
  writeFileSync(`${out}/option-${i + 1}-ground.svg`, svg(o, 0, spec)); writeFileSync(`${out}/option-${i + 1}-upper.svg`, svg(o, 1, spec));
  const m = measure(spec, 3, 4, 3);
  writeFileSync(`${out}/option-${i + 1}.scene.json`, JSON.stringify(m.scene));
  console.log(o.id, 'score', o.score.toFixed(2), 'findings', m.findings.length, 'elements', m.scene!.elements.length, JSON.stringify(o.metrics));
});
writeFileSync('docs/architecture/staged-villa/stage3-programme-offline.scene.json', readFileSync(`${out}/option-1.scene.json`));
console.log('solver ms', ms, JSON.stringify(res.stats));
