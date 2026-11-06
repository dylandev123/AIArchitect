/** Offline only. No env loading, provider imports, database or network calls. Never overwrites an artifact. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {loadTerraStage3, STAGED_DIR, STAGE3_SCENE} from '@/lib/villa/staged/stage3Checkpoint';
import {deriveStage4, exteriorDesignSchema, measureExterior, roomPlanWarnings} from '@/lib/villa/staged/exterior';
import {measure} from '@/lib/villa/staged/pipeline';
import {allRooms} from '@/lib/villa/staged/layout';
import {compileHouse} from '@/lib/villa/staged/compile';

const tag = process.argv[2] ?? 'corrected-v1';
assert(/^[a-z0-9-]+$/.test(tag), 'Use a new lowercase artifact tag.');
const dir = `${STAGED_DIR}/stage4-corrections`, base = `${dir}/${tag}`;
const paths = ['scene', 'checkpoint', 'verification'].map(s => `${base}.${s}.json`);
assert(paths.every(p => !existsSync(p)), 'Refusing to overwrite correction evidence; choose a new tag.');
const source = `${STAGED_DIR}/stage4-exterior/live/result.json`;
const original = `${STAGED_DIR}/stage4-exterior/terra-stage4.checkpoint.json`;
const originalScene = `${STAGED_DIR}/stage4-exterior/terra-stage4.scene.json`;
const watched = [source, original, originalScene, STAGE3_SCENE, `${STAGED_DIR}/live-1/raw-response.json`];
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const hashes = Object.fromEntries(watched.map(p => [p, hash(p)]));
const s3 = loadTerraStage3();
assert.equal(JSON.stringify(s3.scene), readFileSync(STAGE3_SCENE, 'utf8'));
const response = JSON.parse(readFileSync(source, 'utf8'));
const design = exteriorDesignSchema.parse(response.design);
assert.deepEqual(design, exteriorDesignSchema.parse(JSON.parse(response.raw)));
const saved = JSON.parse(readFileSync(original, 'utf8'));
assert.deepEqual(design, saved.design);
const derived = deriveStage4(s3.spec, design);
assert.deepEqual(derived.findings, []);
// Only the compiler presentation revision changes. Terra's authored decisions stay fixed.
const spec = {...derived.spec, trim: {...derived.spec.trim!, visualRevision: 'stage4-v2' as const}};
// Use the retained Stage 4 acceptance contract (4 bedrooms, at least 3 baths).
const built = measure(spec, 4, 4, 3);
assert.deepEqual(built.findings, []);
assert(built.scene && built.components);
assert.equal(allRooms(spec).length, 23);
for (const field of ['links', 'stairs', 'openSpaces', 'site', 'direction', 'exterior'] as const) assert.deepEqual(spec[field], saved.spec[field]);
assert.deepEqual(spec.blocks, saved.spec.blocks);
assert.equal(built.scene.terrain, undefined);
const before = JSON.parse(readFileSync(originalScene, 'utf8'));
const legacy = compileHouse(saved.spec, 4);
assert.equal(JSON.stringify(legacy.scene), JSON.stringify(before), 'Saved specs without visualRevision must render the same scene data.');
const after = new Map(built.scene.elements.map(e => [e.id, e]));
const unchanged: string[] = [], changed: string[] = [], removed: string[] = [];
for (const e of legacy.scene.elements) {
  const next = after.get(e.id);
  if (!next) removed.push(e.id);
  else {
    assert.equal(built.components[e.id], legacy.components[e.id], `Component changed: ${e.id}`);
    (JSON.stringify(next) === JSON.stringify(e) ? unchanged : changed).push(e.id);
  }
}
const protectedElements = legacy.scene.elements.filter(e => /^(p-|slab-|stair-|guard-|rail-)/.test(e.id));
for (const e of protectedElements) assert.deepEqual(after.get(e.id), e, `Unrelated geometry changed: ${e.id}`);
const requested = Object.fromEntries(s3.programme.rooms.map((r: {id: string; area: number}) => [r.id, r.area]));
const metrics = measureExterior(spec, built.scene, roomPlanWarnings(s3.spec, requested));
const verification = {source, originalHashes: hashes, paidCalls: 0, rooms: 23, roomTypes: allRooms(spec).map(r => ({id: r.id, type: r.type})), hardFindings: built.findings,
  beforeElements: before.elements.length, afterElements: built.scene.elements.length, stage5Capacity: 400 - built.scene.elements.length,
  protectedElementsUnchanged: protectedElements.length, unchanged, changed, removed,
  added: built.scene.elements.filter(e => !legacy.components[e.id]).map(e => e.id),
  components: built.components, beforeMetrics: saved.metrics, afterMetrics: metrics};
for (const p of watched) assert.equal(hash(p), hashes[p], `Source changed: ${p}`);
mkdirSync(dir, {recursive: true});
writeFileSync(paths[0], JSON.stringify(built.scene), {flag: 'wx'});
writeFileSync(paths[1], JSON.stringify({stage: 4, accepted: true, source, design, spec, derivation: derived.derivation, findings: built.findings, metrics}, null, 2), {flag: 'wx'});
writeFileSync(paths[2], JSON.stringify(verification, null, 2), {flag: 'wx'});
const {total, glazed, minWidth, minHeight, slits, medianHeightToWidth} = metrics.openings;
const openingSummary = {total, glazed, minWidth, minHeight, slits, medianHeightToWidth};
console.log(JSON.stringify({tag, before: before.elements.length, after: built.scene.elements.length, capacity: verification.stage5Capacity, protected: protectedElements.length, openings: openingSummary, findings: built.findings}, null, 2));
