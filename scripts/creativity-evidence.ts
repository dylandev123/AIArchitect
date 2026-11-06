/** OFFLINE Phase 1 variety study evidence: authored stage answers through the real pipeline; zero provider calls.
 * Usage: npx vite-node --config vitest.config.mts scripts/creativity-evidence.ts */
import {writeFileSync} from 'node:fs';
import {advancePromptRun, type PromptRun} from '@/lib/villa/staged/promptGeneration';
import {StudyDesigner, STUDY_BRIEFS, STUDY_SITES, type StudyKey} from '@/lib/villa/staged/creativity.fixture';
const dir = 'docs/architecture/automatic-house/creativity-1', summary: Record<string, unknown> = {};
for (const [key, flatten] of [['modest', false], ['villa', false], ['estate', false], ['villa', true], ['estate', true]] as [StudyKey, boolean][]) {
  const run: PromptRun = {input: {brief: STUDY_BRIEFS[key], site: STUDY_SITES[key]}}, designer = new StudyDesigner(key, {flatten});
  let out;
  for (let stage = 1; stage <= 5; stage++) { out = await advancePromptRun(run, designer); if (out.status === 'failed') throw Error(`${key}: stage ${stage} failed ${JSON.stringify(out.findings)}`); }
  const name = `${key}${flatten ? '-flat' : ''}`, save = JSON.parse(out!.save!);
  writeFileSync(`${dir}/${name}.save.json`, out!.save!);
  writeFileSync(`${dir}/${name}.scene.json`, JSON.stringify({...save.scene, name: `${save.scene.name}${flatten ? ' (heights removed)' : ''}`}));
  const cps = run.result!.checkpoints;
  summary[name] = {provenance: designer.label, brief: STUDY_BRIEFS[key], elements: save.scene.elements.length, vision: save.spec.direction.vision,
    heights: Object.fromEntries(save.spec.blocks.map((b: {id: string; height?: string; level: number; rank?: string}) => [b.id, `${b.height ?? 'standard'} · level ${b.level} · ${b.rank ?? '-'}`])),
    composition: cps.find(c => c.stage === 2)?.composition, budget: cps.find(c => c.stage === 5)?.budget,
    visionWarnings: cps.flatMap(c => (c.warnings ?? []).filter(w => /^vision-|composition-note|element-budget/.test(w.code)).map(w => `stage ${c.stage} ${w.code}: ${w.message}`))};
  console.log(name, save.scene.elements.length);
}
writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 1));
