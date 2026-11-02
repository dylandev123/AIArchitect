import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { DesignProposal } from './designProposal';

export const mansionDesignCriteria = [
    'distinctive-massing', 'volume-hierarchy', 'six-individual-suites',
    'circulation-and-arrival', 'waterfront-and-outdoor-relationships',
    'construction-precision', 'estate-ambition',
] as const;
export type DesignCheckpointReview = {
    proposalHash: string;
    criteria: Record<typeof mansionDesignCriteria[number], {
        verdict: 'pass' | 'fail' | 'unresolved';
        evidence: string;
    }>;
    conclusion: string;
};
const checkpoint = new AsyncLocalStorage<(proposal: DesignProposal) => Promise<DesignCheckpointReview>>();
export const designProposalHash = (proposal: DesignProposal) =>
    createHash('sha256').update(JSON.stringify(proposal)).digest('hex');

/** Local experiment boundary. The reviewer must persist the proposal and its
 * review before returning. No provider, scoring heuristic or geometry repair. */
export function withDesignCheckpoint<T>(
    review: (proposal: DesignProposal) => Promise<DesignCheckpointReview>,
    run: () => Promise<T>,
): Promise<T> {
    return checkpoint.run(review, run);
}

export async function evaluateDesignCheckpoint(proposal: DesignProposal, retain?: (decision: DesignCheckpointReview) => void) {
    const review = checkpoint.getStore();
    if (!review) return; // Ordinary product generation is unchanged.
    const decision = await review(structuredClone(proposal));
    retain?.(decision);
    if (decision.proposalHash !== designProposalHash(proposal))
        throw Error('Design checkpoint: review does not identify the exact proposal; construction blocked.');
    const failed = mansionDesignCriteria.filter(key =>
        decision.criteria?.[key]?.verdict !== 'pass' || !decision.criteria[key].evidence?.trim());
    if (failed.length || !decision.conclusion?.trim())
        throw Error(`Design-first stage failed the architectural checkpoint; construction was not requested. Review: ${failed.join(', ') || 'missing conclusion'}`);
}
