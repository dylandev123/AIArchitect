import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {applySlice, legacyDraft, measure, type Draft} from './pipeline';
import {directionSchema, stageSchemas} from './spec';

/**
 * Rebuilds the real Terra-generated Stage 2 + Stage 3 checkpoint of the Breezeway Courtyard Villa from the saved
 * provider responses (no model call). Stage 3 is the software-constructed plan Terra's programme produced.
 */
export const STAGED_DIR = 'docs/architecture/staged-villa';
export const STAGE3_SCENE = `${STAGED_DIR}/stage3-programme/live/stage3.scene.json`;
export function loadTerraStage3(root = process.cwd()) {
  const rd = (p: string) => readFileSync(`${root}/${STAGED_DIR}/${p}`, 'utf8');
  const first = JSON.parse(rd('live-1/raw-response.json'));
  const parsed = z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(JSON.parse(first.text));
  const live = JSON.parse(rd('stage3-programme/live/result.json'));
  const site = {width: 60, depth: 48};
  const d1 = applySlice(legacyDraft(site), 1, parsed.direction), d2 = applySlice(d1, 2, {blocks: parsed.blocks});
  const slice3 = stageSchemas[3].parse(live.construction.slice);
  const spec: Draft = applySlice(d2, 3, slice3);
  const m3 = measure(spec, 3, 4, 3);
  return {brief: first.brief as string, site, spec, scene: m3.scene!, components: m3.components!, findings: m3.findings, programme: live.programme, stage3Calls: live.calls as unknown[], stage12Usage: first.usage as unknown, stage12Cost: first.costUsd as number, stage3Cost: (live.calls[0].usage.costUsd) as number};
}
