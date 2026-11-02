import { expect, it } from 'vitest';
import type { DesignProposal } from './designProposal';
import { designProposalHash, evaluateDesignCheckpoint, mansionDesignCriteria, withDesignCheckpoint, type DesignCheckpointReview } from './designCheckpoint';
const proposal = { concept: 'Exact retained proposal' } as DesignProposal;
function review(): DesignCheckpointReview {
    return { proposalHash: designProposalHash(proposal), criteria: Object.fromEntries(mansionDesignCriteria.map(key => [key, { verdict: 'pass', evidence: `Reviewed selected geometry for ${key}` }])) as DesignCheckpointReview['criteria'], conclusion: 'Evidence supports proceeding.' };
}
it('blocks construction for a valid but architecturally inadequate proposal', async () => {
    let constructionCalls = 0;
    const decision = review();
    decision.criteria['six-individual-suites'] = { verdict: 'fail', evidence: 'Six labels share one undivided accommodation reservation.' };
    await expect(withDesignCheckpoint(async () => decision, async () => {
        await evaluateDesignCheckpoint(proposal);
        constructionCalls++;
    })).rejects.toThrow('six-individual-suites');
    expect(constructionCalls).toBe(0);
});
it('blocks unresolved criteria and reviews of a different proposal', async () => {
    const decision = review();
    decision.criteria['construction-precision'].verdict = 'unresolved';
    await expect(withDesignCheckpoint(async () => decision, () => evaluateDesignCheckpoint(proposal))).rejects.toThrow('construction-precision');
    decision.proposalHash = 'other';
    await expect(withDesignCheckpoint(async () => decision, () => evaluateDesignCheckpoint(proposal))).rejects.toThrow('exact proposal');
});
it('waits for review and isolates the experiment from concurrent ordinary generation', async () => {
    let release!: (value: DesignCheckpointReview) => void;
    const pending = withDesignCheckpoint(() => new Promise(resolve => { release = resolve; }), () => evaluateDesignCheckpoint(proposal));
    await expect(evaluateDesignCheckpoint(proposal)).resolves.toBeUndefined();
    release(review());
    await expect(pending).resolves.toBeUndefined();
});
