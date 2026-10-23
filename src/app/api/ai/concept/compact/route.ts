/** Offline evaluation only. No provider, project storage, or evidence writes. */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compactMassingEnabled, prepareCompactMassing } from '@/lib/v3/compactMassing';
import { prepareArchitecturalConcept } from '@/lib/v3/architecturalConcept';
import { compactMassingExample, compactMassingExampleNames } from '@/lib/v3/evaluation/compactMassingExamples';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  if (!compactMassingEnabled()) return json({ error: 'Compact massing evaluation is disabled.' }, 403);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const fixture = z.object({ fixture: z.enum(compactMassingExampleNames) }).strict().safeParse(raw);
  if (fixture.success) {
    const { compact, legacy } = compactMassingExample(fixture.data.fixture);
    const result = prepareCompactMassing(compact), comparison = prepareArchitecturalConcept(legacy);
    return json({ ...result, comparison, input: compact, provenance: 'deterministic-hand-authored-fixture', providerCalls: 0 }, result.ok && comparison.ok ? 200 : 422);
  }
  const input = z.object({ input: z.unknown() }).strict().safeParse(raw);
  if (!input.success) return json({ error: 'Supply {fixture:name} or {input:compactContract}.' }, 400);
  const result = prepareCompactMassing(input.data.input);
  return json({ ...result, provenance: 'submitted-offline-contract', providerCalls: 0 }, result.ok ? 200 : 422);
}
