import type {DesignResult, Designer, StageContext, StageNo} from './pipeline';
import type {Finding} from './validate';
import type {HouseSpec} from './spec';

/**
 * OFFLINE TEST DOUBLE. Replays slices of a developer-authored spec as if a model had
 * returned them. `faults` replaces a stage's FIRST answer with a flawed one; `fixes`
 * supplies the correction (default: the authored slice). Not evidence of model ability.
 */
export function sliceOf(spec: HouseSpec, stage: StageNo): unknown {
  switch (stage) {
    case 1: return spec.direction;
    case 2: return {blocks: spec.blocks.map(({id, role, cx, cz, w, d, level}) => ({id, role, cx, cz, w, d, level}))};
    case 3: return {plans: Object.fromEntries(spec.blocks.map(b => [b.id, b.plan])), links: spec.links, stairs: spec.stairs};
    case 4: return {roofs: Object.fromEntries(spec.blocks.map(b => [b.id, b.roof])), exterior: spec.exterior};
    case 5: return {siteWork: spec.siteWork, finishes: Object.fromEntries(spec.blocks.map(b => [b.id, {wall: b.wall, ...(b.wallColor ? {wallColor: b.wallColor} : {})}]))};
  }
}

export class MockDesigner implements Designer {
  readonly label = 'mock (developer-authored fixture, no model)';
  readonly log: string[] = [];
  constructor(private spec: HouseSpec, private faults: Partial<Record<StageNo, unknown>> = {}, private fixes: Partial<Record<StageNo, unknown>> = {}) {}
  async design(stage: StageNo, _ctx: StageContext): Promise<DesignResult> {
    this.log.push(`design ${stage}`);
    return {value: this.faults[stage] ?? sliceOf(this.spec, stage), usage: {model: 'mock', inputTokens: 0, outputTokens: 0, costUsd: 0}};
  }
  async correct(stage: StageNo, _ctx: StageContext, _previous: unknown, findings: Finding[]): Promise<DesignResult> {
    this.log.push(`correct ${stage}: ${findings.map(f => f.code).join(',')}`);
    return {value: this.fixes[stage] ?? sliceOf(this.spec, stage), usage: {model: 'mock', inputTokens: 0, outputTokens: 0, costUsd: 0}};
  }
}
