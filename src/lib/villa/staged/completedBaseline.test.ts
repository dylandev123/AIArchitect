/** The first complete real-Terra house (live v3 + Stage 5 continuation, 2026-11-06) is the preserved baseline.
 * Every later generator change must rebuild it byte-identically from its original saved design. Offline only. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {loadHouse, saveHouse} from './save';
import {compileHouse} from './compile';
import {measure} from './pipeline';
import {houseSpecSchema} from './spec';
import {featureAudit} from './featureAudit';

const SAVE = 'docs/architecture/automatic-house/live-v3-final/completed.save.json';
const text = readFileSync(SAVE, 'utf8');
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Pinned when the baseline was exported (before the Phase 1 creativity changes).
const SCENE_SHA = '9d1b12d70bfd658b130cf8f50063ed65397ded878336136a54a377bfb43cfc57';

it('reopens the completed house and rebuilds every one of its 263 elements identically from the saved spec', () => {
  const h = loadHouse(text); // throws if the recompiled scene differs from the saved one
  expect(h.scene.elements).toHaveLength(263);
  expect(JSON.stringify(compileHouse(h.spec, 5).scene.elements)).toBe(JSON.stringify(JSON.parse(text).scene.elements));
  expect(sha(h.scene.elements)).toBe(SCENE_SHA);
});

it('keeps the saved design itself unchanged by the current schema (absent new fields stay absent)', () => {
  const raw = JSON.parse(text).spec, parsed = houseSpecSchema.parse(raw);
  expect(parsed).toStrictEqual(raw); // same content (parsing only reorders top-level keys to schema order)
  expect(raw.blocks.every((b: Record<string, unknown>) => !('height' in b))).toBe(true);
  expect('vision' in raw.direction).toBe(false);
});

it('remains a valid, fully audited accepted house with stable editing identities', () => {
  const h = loadHouse(text), m = measure(h.spec, 5, 3, 2);
  expect(m.findings).toEqual([]);
  expect(featureAudit(h.spec, h.scene, h.components, 5).findings).toEqual([]);
  const comps = new Set(Object.values(h.components));
  for (const c of ['block:social-main-wing', 'block:private-bedroom-wing', 'block:arrival-entry-volume', 'roof:social-main-wing', 'veranda:garden-veranda', 'entrance', 'pool', 'room:garden-living']) expect(comps.has(c), c).toBe(true);
  // Save -> reopen round trip is lossless.
  expect(loadHouse(saveHouse(h.spec, h.scene, h.history)).scene.elements).toEqual(h.scene.elements);
});
