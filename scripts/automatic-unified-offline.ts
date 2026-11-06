/** OFFLINE: builds the three labelled sample houses through the real staged pipeline (developer-authored
 * provider doubles, zero provider calls) and writes scene/save/summary evidence under a NEW tag. */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {runStagedGeneration} from '@/lib/villa/staged/pipeline';
import {PromptMockDesigner, MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import {promptRequirements} from '@/lib/villa/staged/requirements';
import {featureAudit} from '@/lib/villa/staged/featureAudit';
import {saveHouse, loadHouse} from '@/lib/villa/staged/save';
import {allRooms} from '@/lib/villa/staged/layout';
const tag = process.argv[2] ?? 'unified-offline';
assert(/^[a-z0-9-]+$/.test(tag));
const dir = `docs/architecture/automatic-house/${tag}`;
assert(!existsSync(dir), 'Choose a new tag; evidence exists.');
mkdirSync(dir, {recursive: true});
const names = ['a-caribbean', 'b-courtyard', 'c-estate'];
const summary = [];
for (const [i, brief] of MOCK_BRIEFS.entries()) {
  const req = promptRequirements(brief);
  const r = await runStagedGeneration({designer: new PromptMockDesigner(brief), brief, site: {width: 60, depth: 48}, requiredBedrooms: req.bedrooms, requiredBaths: req.bathrooms, requiredStoreys: req.storeys, exactBedrooms: true, maxCorrectionsPerStage: 0});
  assert.equal(r.status, 'complete', `${names[i]}: ${JSON.stringify(r.findings)}`);
  const save = saveHouse(r.spec!, r.scene!), reopened = loadHouse(save);
  assert.equal(JSON.stringify(reopened.scene), JSON.stringify(r.scene), 'authoritative reload must reproduce the scene');
  const audit = featureAudit(r.spec!, r.scene!, r.components!, 5, brief);
  writeFileSync(`${dir}/${names[i]}.scene.json`, JSON.stringify(r.scene));
  writeFileSync(`${dir}/${names[i]}.save.json`, save);
  summary.push({house: names[i], provenance: 'OFFLINE developer-authored provider doubles through the real pipeline; not Terra output', brief, elements: r.scene!.elements.length, inventory: audit.inventory, findings: audit.findings,
    rooms: allRooms(r.spec!).map(x => ({id: x.id, type: x.type, level: x.level, w: +(x.x1 - x.x0).toFixed(2), d: +(x.z1 - x.z0).toFixed(2)})), warnings: r.checkpoints.flatMap(c => c.warnings ?? []),
    adjustments: r.checkpoints.flatMap(c => c.construction?.adjustments ?? []), pool: r.spec!.siteWork.pool, verandas: r.spec!.exterior.verandas, trim: r.spec!.trim});
}
writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 1));
console.log(summary.map(s => `${s.house}: ${s.elements} elements, findings ${s.findings.length}`).join('\n'));
