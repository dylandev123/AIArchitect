/** Offline end-to-end run with the labelled mock designer. Writes checkpoint files; no model calls. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {villaSpec} from '@/lib/villa/staged/villa.fixture';
import {MockDesigner} from '@/lib/villa/staged/mockDesigner';
import {runStagedGeneration} from '@/lib/villa/staged/pipeline';
const dir = 'docs/architecture/staged-villa';
mkdirSync(dir, {recursive: true});
const result = await runStagedGeneration({
  designer: new MockDesigner(villaSpec), brief: 'Contemporary Caribbean luxury villa, flat site, 2 storeys, 4 bedrooms, pool, veranda.',
  site: villaSpec.site, requiredBedrooms: 4,
  onCheckpoint: c => {
    writeFileSync(`${dir}/stage${c.stage}.checkpoint.json`, JSON.stringify({stage: c.stage, name: c.name, accepted: c.accepted, findings: c.findings, calls: c.calls, slice: c.slice}, null, 1));
    if (c.scene) writeFileSync(`${dir}/stage${c.stage}.scene.json`, JSON.stringify(c.scene));
  },
});
console.log(result.status, result.failedStage ?? '', 'calls', result.calls.length, 'cost', result.totalCostUsd);
for (const c of result.checkpoints) console.log(` stage ${c.stage} ${c.name}: accepted=${c.accepted} elements=${c.scene?.elements.length ?? '-'} findings=${c.findings.length}`);
for (const f of result.findings.slice(0, 20)) console.log('  FINDING', f.code, f.subject, f.message);
if (result.spec) writeFileSync(`${dir}/spec.json`, JSON.stringify(result.spec, null, 1));
