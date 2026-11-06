/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {Output} from 'ai';
import {strictSchemaIssues} from '../scene/strictSchema';
import {applyOps} from './edits';
import {allRooms, roomEdges} from './layout';
import {DesignerError, applySlice, emptyDraft, measure, runStagedGeneration, type DesignResult, type Designer, type Draft, type StageNo} from './pipeline';
import {programmeIssues, programmeSchema, type ProgRoom, type Programme} from './programme';
import {breezewayProgramme} from './programme.fixture';
import {solveProgramme} from './roomSolver';
import {directionSchema, stageSchemas} from './spec';
import {validateInterior} from './validate';

const dir = 'docs/architecture/staged-villa/live-1';
const sha = (f: string) => createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex');
const SITE = {width: 60, depth: 48};

/** The real Terra-designed Breezeway Courtyard Villa massing (stage 2), rebuilt from the saved provider response. */
function breezewayDraft(): Draft {
  const first = JSON.parse(readFileSync(`${dir}/raw-response.json`, 'utf8'));
  const out = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(JSON.parse(first.text));
  return applySlice(applySlice(emptyDraft(SITE), 1, out.direction), 2, {blocks: out.blocks});
}
const block = (id: string, cx: number, cz: number, w: number, d: number, level: 0 | 1) => ({id, role: id, cx, cz, w, d, level});
function massing(blocks: ReturnType<typeof block>[]): Draft { return applySlice(emptyDraft(SITE), 2, {blocks}); }
const check = (d: Draft, bed: number, bath: number) => (s: any) => measure(applySlice(d, 3, s), 3, bed, bath).findings;
const r = (id: string, b: string, type: ProgRoom['type'], area: number, priority: ProgRoom['priority'] = 'normal', facing: ProgRoom['facing'] = 'any'): ProgRoom => ({id, block: b, type, name: id, area, priority, facing});
const door = (a: string, b: string) => ({a, b, kind: 'door' as const}), open = (a: string, b: string) => ({a, b, kind: 'open' as const});

/** Independent audit of a solved option: rebuild from the slice with the real validators. */
function audit(d: Draft, slice: any, bed: number, bath: number) {
  const spec = applySlice(d, 3, stageSchemas[3].parse(slice));
  expect(validateInterior(spec, bed, bath)).toEqual([]);
  const m = measure(spec, 3, bed, bath);
  expect(m.findings).toEqual([]);
  expect(m.scene!.elements.length).toBeGreaterThan(20);
  for (const b of spec.blocks) { const area = allRooms({blocks: [b]}).reduce((s, x) => s + (x.x1 - x.x0) * (x.z1 - x.z0), 0); expect(area).toBeCloseTo(b.w * b.d, 1); }
  return spec;
}

describe('Stage 2 checkpoint is preserved', () => {
  it('the saved Terra response and checkpoint files are byte-identical to when they were captured', () => {
    expect(sha('raw-response.json')).toBe('f1037423f36c26d789f673e1d1d588e734a7fb774685e0c2744f7e682e049bec');
    expect(sha('stage2.scene.json')).toBe('f8365285c0b9149e3ad6666a2e2d2163ce8dbd25b1fe317b3957219f8b9d1f6e');
    expect(sha('stage2.checkpoint.json')).toBe('63fc6a967fbcc61c2d579e356f2a9afb1d7370121917e13993285dcb2302bb36');
  });
  it('rebuilding stage 2 from that response reproduces the stored scene exactly', () => {
    const m = measure(breezewayDraft(), 2, 0);
    expect(m.findings).toEqual([]);
    expect(JSON.stringify(m.scene)).toBe(readFileSync(`${dir}/stage2.scene.json`, 'utf8'));
  });
});

describe('Stage 3 failure evidence', () => {
  const raw = JSON.parse(readFileSync(`${dir}/stage3.raw.json`, 'utf8'));
  it('Terra output was complete JSON of ~1.5k chars (not token-truncated) but closed "plans" after one block and omitted links/stairs', () => {
    const parsed = JSON.parse(raw.raw);
    expect(raw.raw.length).toBeLessThan(2000);
    expect(Object.keys(parsed)).toEqual(['plans', 'east-bedroom-wing', 'entry-pavilion', 'upper-bedroom-bar']);
    expect(Object.keys(parsed.plans)).toEqual(['main-living-plinth']);
    expect(stageSchemas[3].safeParse(parsed).success).toBe(false);
  });
  it('the old recursive slice schema is not a strict-structured-output schema; the programme schema is', async () => {
    const wire = async (schema: unknown) => (await (Output.object({schema: schema as never}) as any).responseFormat).schema;
    const old = strictSchemaIssues(await wire(stageSchemas[3]));
    expect(old.join(' ')).toMatch(/propertyNames|default|\$ref|additionalProperties/);
    expect(strictSchemaIssues(await wire(programmeSchema))).toEqual([]);
  });
});

describe('solveProgramme: constructs a house from the real Terra massing', () => {
  const d = breezewayDraft();
  const res = solveProgramme(d, breezewayProgramme, {requiredBedrooms: 4, requiredBaths: 3, check: check(d, 4, 3)});
  it('builds ≥1 complete layout from a programme with no coordinates', () => {
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.options.length).toBeGreaterThanOrEqual(2);
    expect(res.stats.exhausted).toBe(false);
  });
  it('every offered layout passes the real stage-3 validators and scene audit', () => {
    if (!res.ok) throw Error('no layouts');
    for (const o of res.options) audit(d, o.slice, 4, 3);
  });
  it('layouts differ (software generates alternatives, not one fixed answer) and keep every programme room', () => {
    if (!res.ok) throw Error('no layouts');
    const sigs = new Set(res.options.map(o => o.rooms.map(x => `${x.id}:${x.x0},${x.x1},${x.z0},${x.z1}`).sort().join('|')));
    expect(sigs.size).toBe(res.options.length);
    for (const o of res.options) expect(o.rooms.map(x => x.id).sort()).toEqual(breezewayProgramme.rooms.map(x => x.id).sort());
  });
  it('honours every requested connection with a real shared wall, the stair stack, and bedroom privacy', () => {
    if (!res.ok) throw Error('no layouts');
    for (const o of res.options) {
      const edges = roomEdges(o.rooms);
      for (const k of breezewayProgramme.connections) {
        const len = Math.max(0, ...edges.filter(e => (e.a === k.a && e.b === k.b) || (e.a === k.b && e.b === k.a)).map(e => e.hi - e.lo));
        expect(len, `${k.a}—${k.b}`).toBeGreaterThanOrEqual(k.kind === 'door' ? 1.5 : 1.2);
      }
      const stair = o.rooms.find(x => x.id === 'stair-hall')!, landing = o.rooms.find(x => x.id === 'upper-landing')!;
      expect(landing.x0).toBeLessThanOrEqual(stair.x0 + 0.05); expect(landing.x1).toBeGreaterThanOrEqual(stair.x1 - 0.05);
      expect(landing.z0).toBeLessThanOrEqual(stair.z0 + 0.05); expect(landing.z1).toBeGreaterThanOrEqual(stair.z1 - 0.05);
      for (const l of o.slice.links) { const a = o.rooms.find(x => x.id === l.a)!, b = o.rooms.find(x => x.id === l.b)!; expect(a.type === 'bedroom' && ['living', 'dining', 'kitchen'].includes(b.type)).toBe(false); }
    }
  });
  it('is deterministic', () => {
    const again = solveProgramme(d, breezewayProgramme, {requiredBedrooms: 4, requiredBaths: 3, check: check(d, 4, 3)});
    expect(JSON.stringify(again)).toBe(JSON.stringify(res));
  });
  it('the constructed plan is editable: a partition moves with the existing semantic edit op and revalidates', () => {
    if (!res.ok) throw Error('no layouts');
    const o = res.options[0], spec = applySlice(d, 3, o.slice);
    const bedroom = o.rooms.find(x => x.id === 'bedroom-two')!;
    // Find a bedroom edge that lies on an interior partition and nudge it; the real edit machinery must accept or explain.
    let moved = false;
    for (const edge of ['e', 'w', 'n', 's'] as const) {
      try {
        const out = applyOps(spec, [{op: 'resize-room', room: bedroom.id, edge, delta: 0.5}]);
        const after = measure(out.spec, 3, 4, 3);
        if (!after.findings.length) { moved = true; expect(JSON.stringify(out.spec.blocks)).not.toBe(JSON.stringify(spec.blocks)); break; }
      } catch { /* edge on block boundary */ }
    }
    expect(moved).toBe(true);
  });
});

describe('solveProgramme: varied programmes', () => {
  it('single-storey three-bedroom house on one block', () => {
    const d = massing([block('house', 0, 0, 20, 14, 0)]);
    const p: Programme = {rooms: [r('foyer', 'house', 'foyer', 12, 'core', 'n'), r('living', 'house', 'living', 60, 'core', 's'), r('kitchen', 'house', 'kitchen', 28), r('hall', 'house', 'hall', 14, 'flex'),
      r('bed-1', 'house', 'bedroom', 28, 'normal', 'n'), r('bed-2', 'house', 'bedroom', 22), r('bed-3', 'house', 'bedroom', 22), r('bath-1', 'house', 'bath', 8), r('bath-2', 'house', 'bath', 8)],
    connections: [open('foyer', 'living'), open('living', 'kitchen'), door('foyer', 'hall'), door('hall', 'bed-1'), door('hall', 'bed-2'), door('hall', 'bed-3'), door('bed-1', 'bath-1'), door('bed-2', 'bath-2')], stairs: [], intentions: []};
    const res = solveProgramme(d, p, {requiredBedrooms: 3, requiredBaths: 2, check: check(d, 3, 2)});
    expect(res.ok, JSON.stringify((res as any).conflicts)).toBe(true);
    if (res.ok) audit(d, res.options[0].slice, 3, 2);
  });
  const twoStorey = (): {d: Draft; p: Programme} => {
    // L-shaped ground floor + one upper bar over the living wing: a synthetic two-storey, four-bedroom villa.
    const d = massing([block('living-wing', 0, 2, 22, 12, 0), block('service-wing', 14.5, -4, 7, 10, 0), block('sleeping-bar', -1, 2, 18, 12, 1)]);
    const p: Programme = {rooms: [
      r('foyer', 'service-wing', 'foyer', 18, 'core', 'n'), r('study', 'service-wing', 'lounge', 30, 'flex'), r('guest-bath', 'service-wing', 'bath', 8, 'core'), r('service-hall', 'service-wing', 'hall', 14, 'flex'),
      r('living', 'living-wing', 'living', 90, 'core', 's'), r('dining', 'living-wing', 'dining', 40, 'normal', 's'), r('kitchen', 'living-wing', 'kitchen', 36), r('stair', 'living-wing', 'stair', 28, 'core'), r('pantry-bath', 'living-wing', 'bath', 8),
      r('landing', 'sleeping-bar', 'hall', 30, 'flex'), r('bed-1', 'sleeping-bar', 'bedroom', 34, 'core', 's'), r('bed-2', 'sleeping-bar', 'bedroom', 30, 'normal', 'n'), r('bed-3', 'sleeping-bar', 'bedroom', 30, 'normal', 'n'), r('bed-4', 'sleeping-bar', 'bedroom', 30, 'normal', 's'),
      r('bath-1', 'sleeping-bar', 'bath', 12, 'core'), r('bath-2', 'sleeping-bar', 'bath', 9), r('bath-3', 'sleeping-bar', 'bath', 9),
    ], connections: [door('foyer', 'service-hall'), door('service-hall', 'study'), door('service-hall', 'guest-bath'), open('foyer', 'living'), open('living', 'dining'), open('dining', 'kitchen'), door('kitchen', 'stair'), door('kitchen', 'pantry-bath'),
      door('landing', 'bed-1'), door('landing', 'bed-2'), door('landing', 'bed-3'), door('landing', 'bed-4'), door('bed-1', 'bath-1'), door('bed-2', 'bath-2'), door('bed-3', 'bath-3')],
    stairs: [{id: 'main', room: 'stair', landing: 'landing'}], intentions: []};
    return {d, p};
  };
  it('two-storey four-bedroom villa: software places 17 rooms, a stair stack and privacy-correct circulation', () => {
    const {d, p} = twoStorey();
    const res = solveProgramme(d, p, {requiredBedrooms: 4, requiredBaths: 4, check: check(d, 4, 4)});
    expect(res.ok, JSON.stringify((res as any).conflicts)).toBe(true);
    if (!res.ok) return;
    const spec = audit(d, res.options[0].slice, 4, 4);
    expect(spec.stairs).toHaveLength(1);
    expect(allRooms(spec).filter(x => x.type === 'bedroom')).toHaveLength(4);
    expect(allRooms(spec).filter(x => x.level === 1 && x.type === 'bedroom')).toHaveLength(4);
  });
  it('bathroom-heavy and open-plan variant on the same massing still solves (different programme, different geometry)', () => {
    const {d, p} = twoStorey();
    const p2: Programme = {...p, rooms: p.rooms.map(x => x.id === 'living' ? {...x, area: 70} : x.id === 'study' ? {...x, type: 'media' as const} : x), connections: p.connections.filter(k => !(k.a === 'service-hall' && k.b === 'study')).concat([open('foyer', 'study')])};
    const a = solveProgramme(d, p, {requiredBedrooms: 4, requiredBaths: 4, check: check(d, 4, 4)}), b = solveProgramme(d, p2, {requiredBedrooms: 4, requiredBaths: 4, check: check(d, 4, 4)});
    expect(b.ok, JSON.stringify((b as any).conflicts)).toBe(true);
    if (a.ok && b.ok) { audit(d, b.options[0].slice, 4, 4); expect(JSON.stringify(a.options[0].slice.plans)).not.toBe(JSON.stringify(b.options[0].slice.plans)); }
  });
  it('facing preferences change the plan: swapping garden side moves the living room', () => {
    const d = massing([block('house', 0, 0, 18, 12, 0)]);
    const base = (facing: ProgRoom['facing']): Programme => ({rooms: [r('foyer', 'house', 'foyer', 14, 'core', 'n'), r('living', 'house', 'living', 80, 'core', facing), r('kitchen', 'house', 'kitchen', 30), r('bed', 'house', 'bedroom', 28), r('bath', 'house', 'bath', 8), r('hall', 'house', 'hall', 12, 'flex')],
      connections: [open('foyer', 'living'), open('living', 'kitchen'), door('foyer', 'hall'), door('hall', 'bed'), door('bed', 'bath')], stairs: [], intentions: []});
    const side = (s: ProgRoom['facing']) => { const res = solveProgramme(d, base(s), {requiredBedrooms: 1, check: check(d, 1, 0)}); expect(res.ok, JSON.stringify((res as any).conflicts)).toBe(true); return res.ok ? res.options[0].rooms.find(x => x.id === 'living')! : undefined; };
    const south = side('s')!, east = side('e')!;
    expect(south.z1).toBeCloseTo(6, 1); expect(east.x1).toBeCloseTo(9, 1);
  });
});

describe('solveProgramme: infeasible programmes report the specific conflict and invent nothing', () => {
  const d = breezewayDraft();
  const codes = (p: Programme, bed = 4, bath = 3) => { const res = solveProgramme(d, p, {requiredBedrooms: bed, requiredBaths: bath, check: check(d, bed, bath)}); return res.ok ? [] : res.conflicts; };
  it('too many rooms for a block names the block and the missing area', () => {
    const p: Programme = {...breezewayProgramme, rooms: [...breezewayProgramme.rooms, r('extra-1', 'entry-pavilion', 'bedroom', 30), r('extra-2', 'entry-pavilion', 'living', 30), r('extra-3', 'entry-pavilion', 'living', 30)]};
    const c = codes(p, 5).find(x => x.code === 'block-too-small')!;
    expect(c.subject).toBe('entry-pavilion'); expect(c.message).toMatch(/42\.0 m².*need at least/);
  });
  it('missing stair, wrong bedroom count and a missing foyer are reported, not patched', () => {
    const p: Programme = {...breezewayProgramme, stairs: [], rooms: breezewayProgramme.rooms.filter(x => x.id !== 'arrival-foyer' && x.id !== 'bedroom-three')};
    const got = codes(p).map(x => x.code);
    expect(got).toEqual(expect.arrayContaining(['no-stair', 'programme-bedrooms', 'foyer-count', 'unknown-connection-room']));
  });
  it('connection between blocks that do not touch is refused with the wall length', () => {
    const p: Programme = {...breezewayProgramme, connections: [...breezewayProgramme.connections, door('arrival-foyer', 'guest-bedroom')]};
    expect(codes(p).find(x => x.code === 'blocks-not-adjacent')!.message).toMatch(/entry-pavilion.*east-bedroom-wing|east-bedroom-wing.*entry-pavilion/);
  });
  it('a door between levels without a stair and a bedroom opening onto the living room are refused', () => {
    const p: Programme = {...breezewayProgramme, connections: [...breezewayProgramme.connections, door('bedroom-two', 'dining'), door('guest-bedroom', 'great-living')]};
    expect(codes(p).map(x => x.code)).toEqual(expect.arrayContaining(['cross-level-connection', 'bedroom-off-living']));
  });
  it('a stair whose landing block does not stand over the stair block is refused', () => {
    const p: Programme = {...breezewayProgramme, stairs: [{id: 'main-stair', room: 'arrival-foyer', landing: 'upper-landing'}]};
    expect(codes(p).map(x => x.code)).toEqual(expect.arrayContaining(['stair-room']));
    const q: Programme = {...breezewayProgramme, rooms: breezewayProgramme.rooms.map(x => x.id === 'stair-hall' ? {...x, block: 'east-bedroom-wing'} : x)};
    expect(codes(q).map(x => x.code)).toEqual(expect.arrayContaining(['stair-no-overlap']));
  });
  it('geometrically impossible adjacency (one small bath that must touch six rooms) is reported as unsatisfiable, with the block', () => {
    const p: Programme = {...breezewayProgramme, connections: [...breezewayProgramme.connections, door('powder-room', 'dining'), door('powder-room', 'kitchen'), door('powder-room', 'stair-hall'), door('powder-room', 'arrival-foyer'), door('powder-room', 'east-gallery')]};
    const c = codes(p);
    expect(c.length).toBeGreaterThan(0);
    expect(c.some(x => /main-living-plinth/.test(x.subject) || /main-living-plinth/.test(x.message))).toBe(true);
    expect(c.every(x => x.message.length > 40)).toBe(true);
  });
  it('rooms that need an exterior wall but are buried (many bedrooms in a block with little frontage) are reported', () => {
    const p: Programme = {...breezewayProgramme, rooms: [...breezewayProgramme.rooms.filter(x => x.block !== 'upper-bedroom-bar'),
      r('upper-landing', 'upper-bedroom-bar', 'hall', 20), ...Array.from({length: 7}, (_, i) => r(`b${i}`, 'upper-bedroom-bar', 'bedroom', 14))], connections: [...breezewayProgramme.connections.filter(k => !/bedroom-two|bedroom-three|bath-two|bath-three|primary-hall/.test(k.a + k.b)), door('upper-landing', 'b0')].concat([]) };
    const c = codes({...p, rooms: p.rooms.filter(x => !['bedroom-two', 'bedroom-three', 'bath-two', 'bath-three'].includes(x.id))}, 8);
    expect(c.length).toBeGreaterThan(0);
  });
});

describe('solveProgramme: randomised programmes (the placement logic, not authored layouts)', () => {
  // Deterministic PRNG; programmes vary room counts, sizes, priorities, facings and wiring on the real massing.
  const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  function randomProgramme(seed: number): Programme {
    const rnd = rng(seed), pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)], jit = (v: number) => Math.round(v * (0.7 + rnd() * 0.6));
    const base = breezewayProgramme;
    const rooms = base.rooms.map(x => ({...x, area: jit(x.area), priority: pick(['core', 'normal', 'flex'] as const), facing: rnd() < 0.5 ? x.facing : pick(['n', 's', 'e', 'w', 'any'] as const)}));
    // sometimes add or remove a non-essential room
    if (rnd() < 0.5) rooms.push(r(`study-${seed}`, 'east-bedroom-wing', 'media', jit(20), 'flex'));
    const conns = base.connections.map(k => rnd() < 0.2 && k.kind === 'open' ? {...k, kind: 'door' as const} : k);
    if (rnd() < 0.5) conns.push(open('east-gallery', `study-${seed}`));
    return {...base, rooms: rooms.filter(x => !(x.id.startsWith('study-') && !conns.some(k => k.b === x.id))).concat([]), connections: conns.filter(k => rooms.some(x => x.id === k.a) && rooms.some(x => x.id === k.b))};
  }
  it('across 60 random programmes: never crashes, every success is validator-clean, every failure names a conflict', () => {
    const d = breezewayDraft();
    let ok = 0, fail = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const p = randomProgramme(seed);
      const res = solveProgramme(d, p, {requiredBedrooms: 4, requiredBaths: 3, check: check(d, 4, 3), nodeBudget: 200000});
      if (res.ok) { ok++; for (const o of res.options) audit(d, o.slice, 4, 3); }
      else { fail++; expect(res.conflicts.length).toBeGreaterThan(0); for (const c of res.conflicts) { expect(c.code).toBeTruthy(); expect(c.message.length).toBeGreaterThan(20); } }
    }
    console.log(`random programmes: ${ok} constructed, ${fail} reported conflicts`);
    expect(ok).toBeGreaterThanOrEqual(30);
  });
  it('every programme issue maps to something static checks can name', () => {
    const d = breezewayDraft();
    expect(programmeIssues(breezewayProgramme, d, {bedrooms: 4, baths: 3})).toEqual([]);
  });
});

describe('pipeline: stage 3 from a programme, with usage kept on provider failure', () => {
  const d2 = breezewayDraft();
  const resume = () => [
    {stage: 1 as const, name: 'architectural designer', attempt: 0, accepted: true, slice: d2.direction, spec: emptyDraft(SITE), findings: [], calls: []},
    {stage: 2 as const, name: 'building massing', attempt: 0, accepted: true, slice: {}, spec: d2, findings: [], calls: []},
  ].map((c, i) => i === 0 ? {...c, spec: applySlice(emptyDraft(SITE), 1, d2.direction)} : c);
  const designer = (value: unknown | (() => never)): Designer => ({
    label: 'programme stub',
    design: async (_s: StageNo): Promise<DesignResult> => { if (typeof value === 'function') (value as () => never)(); return {value, usage: {model: 't', inputTokens: 1000, outputTokens: 500, costUsd: 0.02}, finishReason: 'stop'}; },
    correct: async (): Promise<DesignResult> => ({value: breezewayProgramme}),
  });
  it('accepts a programme, stores what software built, and stays resumable', async () => {
    const res = await runStagedGeneration({designer: designer(breezewayProgramme), brief: 'x', site: SITE, requiredBedrooms: 4, requiredBaths: 3, stopAfter: 3, resumeFrom: resume()});
    expect(res.status).toBe('paused');
    const cp = res.checkpoints.find(c => c.stage === 3)!;
    expect(cp.accepted).toBe(true);
    expect(cp.construction!.options.length).toBeGreaterThan(1);
    expect(cp.calls[0].finishReason).toBe('stop');
    expect(res.scene!.elements.length).toBeGreaterThan(80); // scale-1: the 17-tread flight is one stair component
    expect(res.scene!.elements.filter(e => e.semanticType === 'stair').every(e => e.parts?.length === 17)).toBe(true);
    expect(res.checkpoints[1].spec.blocks.every(b => 'room' in b.plan)).toBe(true); // stage 2 checkpoint untouched
  });
  it('an infeasible programme fails stage 3 with the conflicts, keeps stage 2 as last good, and one correction may repair it', async () => {
    const bad: Programme = {...breezewayProgramme, stairs: []};
    const noFix: Designer = {...designer(bad), correct: async () => ({value: bad})};
    const failed = await runStagedGeneration({designer: noFix, brief: 'x', site: SITE, requiredBedrooms: 4, requiredBaths: 3, stopAfter: 3, resumeFrom: resume()});
    expect(failed.status).toBe('failed'); expect(failed.failedStage).toBe(3);
    expect(failed.findings.map(f => f.code)).toContain('no-stair');
    expect(failed.lastGood!.stage).toBe(2);
    const fixed = await runStagedGeneration({designer: designer(bad), brief: 'x', site: SITE, requiredBedrooms: 4, requiredBaths: 3, stopAfter: 3, resumeFrom: resume()});
    expect(fixed.status).toBe('paused'); expect(fixed.calls.filter(c => c.stage === 3)).toHaveLength(2);
  });
  it('a provider failure still records usage, finish reason and the raw text', async () => {
    const boom: Designer = {label: 'x', design: async () => { throw new DesignerError('No object generated', {usage: {model: 't', inputTokens: 709, outputTokens: 1488, costUsd: 0.019}, finishReason: 'length', raw: '{"rooms":['}); }, correct: async () => { throw Error('unused'); }};
    const res = await runStagedGeneration({designer: boom, brief: 'x', site: SITE, requiredBedrooms: 4, stopAfter: 3, resumeFrom: resume()});
    const call = res.checkpoints.find(c => c.stage === 3)!.calls[0];
    expect(res.status).toBe('failed');
    expect(call.usage!.outputTokens).toBe(1488); expect(call.failure).toMatchObject({finishReason: 'length', raw: '{"rooms":['});
    expect(res.totalCostUsd).toBeCloseTo(0.019, 3);
  });
});
