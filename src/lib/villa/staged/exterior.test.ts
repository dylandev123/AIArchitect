import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Output} from 'ai';
import {MockLanguageModelV3} from 'ai/test';
import {describe, expect, it} from 'vitest';
import {strictSchemaIssues} from '../scene/strictSchema';
import {deriveStage4, exteriorDesignSchema, exteriorIssues, measureExterior, roomPlanWarnings, roofableBlocks, type ExteriorDesign} from './exterior';
import {LiveExteriorDesigner, exteriorRequest} from './exteriorDesigner';
import {mockExteriorDesign} from './exterior.fixture';
import {measure} from './pipeline';
import {loadTerraStage3, STAGE3_SCENE} from './stage3Checkpoint';

const s3 = loadTerraStage3();
const build = (d: ExteriorDesign = mockExteriorDesign()) => { const r = deriveStage4(s3.spec, d); const m = measure(r.spec, 4, 4, 3); return {r, m}; };

describe('Stage 4 exterior design (offline, mocked provider)', () => {
  it('rebuilds the real Terra Stage 3 checkpoint byte for byte and it is untouched', () => {
    expect(createHash('sha256').update(readFileSync(STAGE3_SCENE)).digest('hex')).toBe('83db6541935d8a8b727111840264d31ff79ceb2573389d8104096ea226339216');
    expect(JSON.stringify(s3.scene)).toBe(readFileSync(STAGE3_SCENE, 'utf8'));
    expect(s3.findings).toEqual([]);
  });
  it('wire schema is flat, strict-compatible and coordinate-free', async () => {
    const wire = (await (Output.object({schema: exteriorDesignSchema as never}) as unknown as {responseFormat: Promise<{schema: Record<string, unknown>}>}).responseFormat).schema;
    expect(strictSchemaIssues(wire)).toEqual([]);
    expect(JSON.stringify(wire)).not.toMatch(/"(cx|cz|x|y|z|at|size|from|to|width|depth)"/);
  });
  it('request carries only measured facts and states the rules', () => {
    const {system, prompt} = exteriorRequest(s3.brief, s3.spec);
    expect(prompt).toContain('EXTERIOR WALLS (measured)');
    expect(prompt).toContain('arrival-foyer');
    expect(prompt).toMatch(/roof terrace on main-living-plinth/);
    expect(prompt).toMatch(/KNOWN STAGE 3 PLAN WARNINGS/);
    expect(system).toMatch(/never give coordinates/);
  });
  it('a mocked provider makes exactly one call and its answer is parsed and priced', async () => {
    const provider = new MockLanguageModelV3({doGenerate: {content: [{type: 'text', text: JSON.stringify(mockExteriorDesign())}], finishReason: {unified: 'stop', raw: 'stop'}, warnings: [], usage: {inputTokens: {total: 6000, noCache: 6000, cacheRead: 0, cacheWrite: 0}, outputTokens: {total: 1500, text: 1500, reasoning: 0}}}});
    const r = await new LiveExteriorDesigner({model: provider, modelId: 'gpt-5.6-terra'}).design(s3.brief, s3.spec);
    expect(provider.doGenerateCalls).toHaveLength(1);
    expect(r.value.roofs).toHaveLength(3);
    expect(r.usage.costUsd).toBeCloseTo((6000 * 2 + 1500 * 12) / 1e6, 6);
  });
  it('constructs a valid, connected house: zero findings, zero hard relationship conflicts, under the element cap', () => {
    const {r, m} = build();
    expect(r.findings).toEqual([]);
    expect(m.findings).toEqual([]);
    expect(m.scene!.elements.length).toBeLessThanOrEqual(400);
  });
  it('preserves component identity, interior walls, slabs and stairs exactly', () => {
    const {m} = build();
    const before = new Map(s3.scene.elements.map(e => [e.id, e])), after = new Map(m.scene!.elements.map(e => [e.id, e]));
    for (const [id, e] of before) {
      if (/^w-/.test(id) || id.startsWith('open-')) continue; // exterior wall runs are re-cut around openings; the open space becomes the veranda
      const a = after.get(id);
      expect(a, id).toBeDefined();
      if (!id.startsWith('rail-')) expect([a!.at, a!.size, a!.rotation]).toEqual([e.at, e.size, e.rotation]); // parapet railing deliberately replaces the glass rail's geometry
    }
    const glass = build({...mockExteriorDesign(), railing: 'glass'}).m.scene!;
    for (const e of s3.scene.elements.filter(x => x.id.startsWith('rail-'))) expect(glass.elements.find(x => x.id === e.id)).toEqual(e);
    const comps = new Set(Object.values(m.components!));
    for (const c of new Set(Object.values(s3.components))) if (!c.startsWith('open:')) expect(comps.has(c), c).toBe(true);
    expect(comps.has('veranda:south-veranda')).toBe(true);
    // Exterior wall length per room side is conserved except where doors are cut.
    const run = (els: typeof s3.scene.elements) => { const o: Record<string, number> = {}; for (const e of els) if (/^w-/.test(e.id) && e.kind === 'wall') { const k = e.id.replace(/-\d+$/, ''); o[k] = (o[k] ?? 0) + Math.max(e.size[0], e.size[2]); } return o; };
    const a = run(s3.scene.elements), b = run(m.scene!.elements);
    for (const k of Object.keys(a)) expect(b[k]).toBeCloseTo(a[k], 1);
  });
  it('keeps the exterior doors and every room reachable from the entrance', () => {
    const {r} = build();
    expect(r.spec.exterior.doors.find(d => d.id === 'main-entrance')!.room).toBe('arrival-foyer');
    expect(measure(r.spec, 4, 4, 3).findings.filter(f => f.code === 'unreachable-room')).toEqual([]);
  });
  it('keeps the Stage 3 plan warnings visible (north bedroom, media lounge, narrow baths, long vestibule)', () => {
    const w = roomPlanWarnings(s3.spec, Object.fromEntries((s3.programme.rooms as {id: string; area: number}[]).map(x => [x.id, x.area]))).map(x => x.subject + ': ' + x.message);
    for (const id of ['north-bedroom', 'media-lounge', 'north-bedroom-bath', 'south-bedroom-bath', 'ground-gallery']) expect(w.some(x => x.startsWith(id)), id).toBe(true);
    const {r, m} = build();
    expect(measureExterior(r.spec, m.scene!, w.map(x => ({area: 'room-plan' as const, severity: 'warning' as const, subject: x.split(':')[0], message: x}))).warnings.filter(x => x.area === 'room-plan').length).toBeGreaterThan(5);
  });
  it('measures roofs and facades instead of assuming quality', () => {
    const {r, m} = build(), x = measureExterior(r.spec, m.scene!);
    expect(x.roofs.map(q => q.block).sort()).toEqual(roofableBlocks(r.spec).map(b => b.id).sort());
    for (const q of x.roofs) { expect(q.nominalPitchDeg).toBeGreaterThan(15); expect(q.maxEave).toBeGreaterThan(0.5); }
    expect(x.openings.total).toBeGreaterThan(10);
    expect(x.massing.distinctRidgeHeights).toBeGreaterThan(1);
  });
  it('reports (never silently fixes) invalid decisions', () => {
    const d = mockExteriorDesign();
    expect(exteriorIssues(s3.spec, {...d, roofs: d.roofs.slice(1)}).map(f => f.code)).toContain('roof-missing');
    expect(exteriorIssues(s3.spec, {...d, doors: [{room: 'great-room', side: 's', kind: 'terrace'}]}).map(f => f.code)).toContain('terrace-door-no-terrace');
    expect(exteriorIssues(s3.spec, {...d, doors: [{room: 'south-bedroom', side: 's', kind: 'garden'}]}).map(f => f.code)).toContain('garden-door-upstairs');
    expect(exteriorIssues(s3.spec, {...d, entrance: {...d.entrance, room: 'great-room'}}).map(f => f.code)).toContain('entrance-not-foyer');
    expect(exteriorIssues(s3.spec, {...d, roofs: [...d.roofs, {block: 'entry-pavilion', form: 'hip', pitchDeg: 5, eaves: 'deep'}]}).map(f => f.code)).toEqual(expect.arrayContaining(['roof-duplicate', 'roof-pitch']));
    const bad = deriveStage4(s3.spec, {...d, roofs: d.roofs.slice(1)});
    expect(bad.spec).toBe(s3.spec); // Stage 3 spec is returned untouched when Stage 4 is rejected
  });
  it('clamps eaves to what is physically valid and records it', () => {
    const d = mockExteriorDesign(); d.roofs = d.roofs.map(r => ({...r, eaves: 'very-deep' as const}));
    const {r, m} = build(d);
    expect(m.findings).toEqual([]);
    for (const q of r.derivation.roofs) expect(q.eave).toBeLessThanOrEqual(q.requestedEave);
  });
});
