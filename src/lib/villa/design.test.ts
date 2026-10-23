import { describe, expect, it } from 'vitest';
import { composeVilla, defaultVilla, executeVillaPatch, STYLES, STYLE_RULES, villaSchema, type VillaBay, type VillaConfig } from './design';

function connected(a: VillaBay, b: VillaBay) {
  const overlapX = (a.width + b.width) / 2 - Math.abs(a.x - b.x);
  const overlapZ = (a.depth + b.depth) / 2 - Math.abs(a.z - b.z);
  return overlapX >= -1e-6 && overlapZ >= -1e-6 && (overlapX > 1e-6 || overlapZ > 1e-6);
}
describe('bounded villa assembly', () => {
  it.each(STYLES)('%s keeps all bays connected and all terraces clear of the largest pool across supported extrema', style => {
    for (const composition of STYLE_RULES[style].compositions) for (const scale of [.85, 1.05]) for (const wingRatio of [.85, 1.1]) for (const levels of [1, 2] as const) {
      const c = villaSchema.parse({ ...defaultVilla(style), composition, scale, wingRatio, levels, verandaDepth: 2.8, terraceDepth: 2.8 });
      const bays = composeVilla(c), reached = new Set([bays[0].id]);
      for (let i = 0; i < bays.length; i++) for (const a of bays) if (reached.has(a.id)) for (const b of bays) if (connected(a, b)) reached.add(b.id);
      expect(reached.size).toBe(bays.length);
      for (const b of bays) {
        expect(b.z + b.depth / 2 + c.verandaDepth + .4).toBeLessThan(12.4 - 6.4 / 2 - .34);
        expect(Math.abs(b.x) + b.width / 2).toBeLessThan(15.5);
        expect(b.width).toBeGreaterThan(4);
      }
    }
  });
  it('has meaningful silhouette and footprint differences across defaults', () => {
    const signatures = STYLES.map(s => JSON.stringify([composeVilla(defaultVilla(s)), defaultVilla(s).roof]));
    expect(new Set(signatures).size).toBe(4);
  });
  it('deep merges targeted changes without resetting unrelated design choices', () => {
    const original = { ...defaultVilla('spanish'), scale: .92, verandaDepth: 2.6 };
    const next = executeVillaPatch(original, { pool: { width: 12 }, exterior: 'limestone' });
    expect(next).toEqual({ ...original, pool: { ...original.pool, width: 12 }, exterior: 'limestone' });
    expect(next.pool.depth).toBe(original.pool.depth);
    expect(original.pool.width).toBe(17);
  });
  it('style edits only adapt incompatible composition and roof choices', () => {
    const original = defaultVilla('modern');
    const next = executeVillaPatch(original, { style: 'spanish' });
    expect(next.composition).toBe('courtyard'); expect(next.roof).toBe('hip');
    expect(next.pool).toEqual(original.pool); expect(next.exterior).toBe(original.exterior);
    expect(next.scale).toBe(original.scale);
  });
  it.each([
    { roof: 'dome' }, { rawMeshes: [] }, { pool: { width: 100 } }, { scale: NaN },
    { style: 'modern', roof: 'hip' }, { style: 'spanish', composition: 'pavilions' },
  ])('rejects unsupported input %j', patch => {
    expect(() => executeVillaPatch(defaultVilla('modern'), patch)).toThrow();
  });
  it('validates full configurations at the same boundary', () => {
    expect(villaSchema.safeParse({ ...defaultVilla('tuscan'), unimplementedTower: true }).success).toBe(false);
    const c: VillaConfig = executeVillaPatch(defaultVilla('caribbean'), { composition: 'courtyard', levels: 1 });
    expect(composeVilla(c).every(b => b.floors === 1)).toBe(true);
  });
});
