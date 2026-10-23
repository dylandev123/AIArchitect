import { describe, expect, it } from 'vitest';
import fixture from './__tests__/fixtures/long-character.response.json';
import latest from './__tests__/fixtures/long-summary.response.json';
import { normalizeVillaResponse, truncateCharacter, truncateDisplayText, UNSUPPORTED_COPY_FALLBACK, VILLA_TEXT_LIMITS } from './responseMetadata';
import { resolveVillaResult, villaOutputSchema, villaProviderOutputSchema, villaSystemPrompt } from './terra';
import { buildComposition, compositionFindings, compositionSchema, validateComposition } from './composition';
import { defaultVilla } from './design';

const input = { mode: 'generate' as const, prompt: 'Offline metadata regression' };
const valid = { ...fixture, changes: { ...fixture.changes, character: 'Short' } };
const fields = Object.entries(VILLA_TEXT_LIMITS) as [keyof typeof VILLA_TEXT_LIMITS, number][];
function withCopy(field: keyof typeof VILLA_TEXT_LIMITS, value: unknown) {
  if (field === 'name' || field === 'character') return { ...valid, changes: { ...valid.changes, [field]: value } };
  return { ...valid, [field]: field === 'unsupported' ? [value] : value };
}
function getCopy(result: ReturnType<typeof resolveVillaResult>, field: keyof typeof VILLA_TEXT_LIMITS) {
  if (field === 'summary') return result.summary;
  if (field === 'unsupported') return result.unsupported[0];
  return compositionSchema.parse(result.config)[field];
}

describe('Terra descriptive metadata boundary', () => {
  it.each(fields)('%s preserves below/exact limits and normalizes excess before strict validation', (field, limit) => {
    for (const length of [limit - 1, limit, limit + 1]) {
      const raw = withCopy(field, 'x'.repeat(length)), snapshot = structuredClone(raw);
      const strict = villaOutputSchema(input).safeParse(raw);
      expect(strict.success).toBe(length <= limit);
      const result = resolveVillaResult(input, raw);
      expect(getCopy(result, field)).toBe('x'.repeat(Math.min(length, limit)));
      expect(villaOutputSchema(input).safeParse(normalizeVillaResponse(raw)).success).toBe(true);
      expect(normalizeVillaResponse(normalizeVillaResponse(raw))).toEqual(normalizeVillaResponse(raw));
      expect(raw).toEqual(snapshot);
    }
  });

  it.each(fields)('%s prefers whole words and handles whitespace, long tokens and Unicode safely', (_field, limit) => {
    for (const [value, expected] of [
      ['a'.repeat(limit) + ' next', 'a'.repeat(limit)],
      ['word ' + 'x'.repeat(limit), 'word'],
      ['a'.repeat(limit - 1) + '😀more', 'a'.repeat(limit - 1)],
      ['😀'.repeat(limit), '😀'.repeat(limit / 2)],
      ['a'.repeat(limit - 1) + '\nnext', 'a'.repeat(limit - 1)],
      [' '.repeat(limit + 1), ''],
    ]) expect(truncateDisplayText(value, limit)).toBe(expected);
  });

  it.each(fields)('%s handles absent, empty and malformed display copy without coercing objects into prose', (field, limit) => {
    for (const value of [undefined, null, '', '   ', 123, {}, []]) {
      const raw = withCopy(field, value), result = resolveVillaResult(input, raw);
      const text = getCopy(result, field);
      expect(text.length).toBeGreaterThan(0); expect(text.length).toBeLessThanOrEqual(limit);
      expect(text).not.toContain('[object Object]');
      if (field === 'unsupported') expect(text).toBe(UNSUPPORTED_COPY_FALLBACK);
    }
    const omitted = withCopy(field, 'placeholder');
    if (field === 'name' || field === 'character') delete (omitted.changes as Record<string, unknown>)[field];
    else delete (omitted as Record<string, unknown>)[field];
    const result = resolveVillaResult(input, omitted);
    if (field === 'unsupported') expect(result.unsupported).toEqual([]);
    else expect(getCopy(result, field).length).toBeGreaterThan(0);
  });

  it('preserves unsupported warnings, including list overflow and malformed containers', () => {
    const warnings = Array.from({ length: 10 }, (_, i) => `Missing capability ${i}`);
    expect(resolveVillaResult(input, { ...valid, unsupported: warnings }).unsupported).toEqual(warnings);
    expect(resolveVillaResult(input, { ...valid, unsupported: 'Missing dome builder' }).unsupported).toEqual(['Missing dome builder']);
    expect(resolveVillaResult(input, { ...valid, unsupported: {} }).unsupported).toEqual([UNSUPPORTED_COPY_FALLBACK]);
    for (const unsupported of [undefined, null, []]) expect(resolveVillaResult(input, { ...valid, unsupported }).unsupported).toEqual([]);
  });

  it('replays the actual latest retained failure and builds the same architecture', () => {
    const snapshot = structuredClone(latest);
    const strict = villaOutputSchema(input).safeParse(latest);
    expect(strict.success).toBe(false);
    if (!strict.success) expect(strict.error.issues.map(i => i.path.join('.'))).toEqual(['changes.character', 'summary']);
    expect(normalizeVillaResponse(latest)).toEqual({ ...latest, changes: { ...latest.changes, character: truncateCharacter(latest.changes.character) }, summary: truncateDisplayText(latest.summary, 600) });
    const result = resolveVillaResult(input, latest), c = compositionSchema.parse(result.config);
    const expected = validateComposition({ ...latest.changes, character: truncateCharacter(latest.changes.character) });
    expect(c).toEqual(expected);
    for (const key of ['id', 'wings', 'connections', 'terraces', 'pool', 'appearance', 'components', 'siteMode', 'landscapeMargin'] as const) expect(c[key]).toEqual(latest.changes[key]);
    const built = buildComposition(c);
    expect(built.wings).toHaveLength(9);
    expect(built).toEqual(buildComposition(expected));
    expect(c.components).toHaveLength(1); expect(result.summary.length).toBeLessThanOrEqual(600);
    expect(latest).toEqual(snapshot);
  });

  it('keeps the original character regression deterministic', () => {
    const result = resolveVillaResult(input, fixture), c = compositionSchema.parse(result.config);
    expect(c.character).toBe('A generous Caribbean hall opens toward the pool, with a shaded gallery connecting a quiet garden salon, deep verandas catching island breezes, and warm timber');
    expect(result.config).toEqual({ ...fixture.changes, character: truncateCharacter(fixture.changes.character) });
    expect(buildComposition(c).wings.map(w => w.id)).toEqual(['main', 'salon', 'breeze-link']);
  });

  it.each(['composable', 'legacy'])('normalizes edit summary and explanations while preserving every patch field (%s)', kind => {
    const current = kind === 'composable' ? compositionSchema.parse(valid.changes) : defaultVilla('tuscan');
    const edit = { mode: 'edit' as const, prompt: 'Only a pool adjustment', current };
    const changes = { pool: { width: 12 } }, raw = { changes, summary: 's'.repeat(601), unsupported: ['u'.repeat(201)] };
    const result = resolveVillaResult(edit, raw);
    expect(result.changes).toEqual(changes); expect(result.summary).toHaveLength(600); expect(result.unsupported[0]).toHaveLength(200);
    expect(result.config).toEqual({ ...current, pool: { ...current.pool, width: 12 } });
    expect(resolveVillaResult(edit, { changes }).changes).toEqual(changes);
    expect(() => resolveVillaResult(edit, { ...raw, changes: { ...changes, character: 'x'.repeat(200) } })).toThrow();
  });

  it('continues rejecting real construction errors, IDs, builders, types and unknown keys', () => {
    const invalid = structuredClone(fixture);
    invalid.changes.wings[1].x = -5; invalid.changes.wings[1].z = -7;
    try { resolveVillaResult(input, invalid); expect.fail('Overlapping wings must fail'); }
    catch (error) { expect(compositionFindings(error)).toEqual([expect.objectContaining({ path: 'wings', message: expect.stringContaining('Overlapping') })]); }
    for (const changes of [
      { ...valid.changes, id: 'i'.repeat(49) },
      { ...valid.changes, wings: [{ ...valid.changes.wings[0], width: '16' }] },
      { ...valid.changes, wings: [{ ...valid.changes.wings[0], orientation: 45 }] },
      { ...valid.changes, components: [{ ...latest.changes.components[0], builder: 'curved-pavilion@999' }] },
      { ...valid.changes, title: 'Unknown metadata is still an unknown key' },
    ]) {
      const raw = { ...valid, changes };
      expect((normalizeVillaResponse(raw) as typeof raw).changes).toEqual(changes);
      expect(() => resolveVillaResult(input, raw)).toThrow();
    }
    for (const changes of [undefined, null, [], 'house']) expect(() => resolveVillaResult(input, { ...valid, changes })).toThrow();
    for (const raw of [undefined, null, [], 'house']) expect(() => resolveVillaResult(input, raw)).toThrow();
  });

  it('advertises numeric text limits in both prompt variants and generation/edit wire schemas', () => {
    for (const composable of [true, false]) for (const mode of ['generate', 'edit'] as const) {
      const prompt = villaSystemPrompt(mode, composable);
      for (const limit of Object.values(VILLA_TEXT_LIMITS)) expect(prompt).toContain(String(limit));
    }
    const provider = villaProviderOutputSchema(input);
    expect(provider.shape.changes).toBeDefined();
    expect(provider.safeParse(fixture).success).toBe(false); // wire instructions remain strict
    expect(provider.safeParse(normalizeVillaResponse(fixture)).success).toBe(true);
  });
});
