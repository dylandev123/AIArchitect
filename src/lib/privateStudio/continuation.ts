/**
 * Stage 5-only continuation of a stopped run. The source run, its calls and its approval are only ever READ:
 * the continuation is a new run, in its own project, with its own single-use approval and spending policy.
 */
import {createHash} from 'node:crypto';
import type {Checkpoint, PipelineResult} from '@/lib/villa/staged/pipeline';
import type {PromptRun} from '@/lib/villa/staged/promptGeneration';
import {StudioError, briefHash} from './policy';
import type {Continuation, State, StudioStore} from './store';

const accepted = (r: PipelineResult | undefined) => (r?.checkpoints ?? []).filter(c => c.accepted);
export const checkpointsSha256 = (cps: Checkpoint[]) => createHash('sha256').update(JSON.stringify(cps)).digest('hex');

/** Verifies the source run is a stopped, fully accounted run whose Stages 1-4 (exactly) were accepted. */
function verifiedSource(s: State, owner: string, runId: string) {
  const run = s.runs[runId];
  if (!run || run.owner !== owner || s.projects[run.projectId]?.owner !== owner) throw new StudioError(404, 'Source run not found');
  if (run.state !== 'failed') throw new StudioError(409, `Only a stopped (failed) run can be continued; this run is ${run.state}.`);
  if (run.callIds.some(id => s.calls[id]?.status !== 'settled')) throw new StudioError(409, 'Source run has an unsettled or uncertain call; it cannot be continued.');
  const cps = accepted(run.source.result);
  if (cps.map(c => c.stage).join(',') !== '1,2,3,4' || run.source.result?.failedStage !== 5) throw new StudioError(409, 'Continuation requires accepted Stages 1-4 and a stopped Stage 5.');
  return {run, cps};
}

/** Administrator operation (never HTTP): one new owned project linked to the source run. Grants no approval. */
export async function prepareStage5Continuation(store: StudioStore, sourceRunId: string, name: string, projectId: string) {
  return store.transaction(s => {
    if (!s.account) throw new StudioError(409, 'Set up private Studio sign-in first');
    const {cps} = verifiedSource(s, s.account.owner, sourceRunId);
    if (Object.values(s.projects).some(p => p.continuesFrom?.runId === sourceRunId && !p.runId)) throw new StudioError(409, 'An unstarted continuation of this run already exists');
    if (s.projects[projectId]) throw new StudioError(409, 'Project id in use');
    const link: Continuation = {runId: sourceRunId, stage: 5, checkpointsSha256: checkpointsSha256(cps)};
    s.projects[projectId] = {owner: s.account.owner, name, continuesFrom: link};
    return link;
  });
}

/** New run source: verbatim copies of the accepted Stage 1-4 checkpoints, verified against the recorded hash. */
export function continuationSource(s: State, owner: string, link: Continuation, brief: string): PromptRun {
  const {run, cps} = verifiedSource(s, owner, link.runId);
  if (checkpointsSha256(cps) !== link.checkpointsSha256) throw new StudioError(409, 'Source checkpoints changed since the continuation was prepared; zero calls made.');
  if (briefHash(run.source.input.brief) !== briefHash(brief)) throw new StudioError(403, 'Continuation must use the source run\'s exact description. Zero calls made.');
  const copy = structuredClone(cps), last = copy.at(-1)!;
  return {input: structuredClone(run.source.input), result: {status: 'paused', findings: [], checkpoints: copy, lastGood: last, spec: last.spec, scene: last.scene, components: last.components, calls: [], totalCostUsd: 0}};
}
