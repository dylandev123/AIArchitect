# Authorized semantic-generation live attempt

31 October 2026. **The request was viable at the experimental feature boundary, but transport failed without an HTTP response. No actual model-produced design was received.** One submission attempt was made; no retry, fallback or refinement followed. Whether the provider received or billed the attempt is unknown. Do not report zero cost or a completed paid generation.

## Scope and preserved evidence

The original prepared mansion brief, model (`gpt-5.6-terra`), provider-default reasoning, 30,000 output-token ceiling and semantic JSON schema were retained. The prepared system instruction would otherwise force a decision response for requested unsupported features. In accordance with the user's explicit direction, only that experimental instruction was replaced: pool, landscaping, terrain, advanced roofs, guards, facade details and fit-out must be disclosed limitations of a supported building study. Approximately six suite allocations, mansion scale, circulation and architectural ambition remain requested. No output was manually corrected.

- [Exact submitted request](request.exact.json)
- [Viability, hashes, authorization and pricing basis](preflight.json)
- [Exclusive submission marker](call-started.json)
- [Transport failure](transport-error.json)
- Runner: `scripts/semantic-generation-live.mjs`

The fetch operation threw a TypeError. No HTTP status, provider request ID, response bytes, token usage or invoice information was returned. The retained transport record does not contain the underlying network cause; it would be unjustified to attribute this conclusively to DNS, sandbox networking or the provider. The runner uses exclusive artifact writes, so rerunning it at the same destination cannot silently submit again. Do not rerun this experiment without fresh authorization.

Current published rates checked for the estimate basis: $2 input, $0.20 cached input and $12 output per million tokens, with $2.50 cache-write pricing where applicable. Source: https://developers.openai.com/api/docs/pricing . These rates do not establish actual cost for this failed transport attempt. Usage and cost remain unknown.

## Evaluation and historical comparison

No semantic proposal exists to validate or compile. No model geometry, physical findings, rendered result or editability result exists. Existing offline mock scenes were not substituted for the absent live output.

The earlier Terra planning failure omitted real stair/landing/void decisions, suite boundaries and access, and selected disconnected outdoor surfaces. The earlier Sol proposal developed more components but retained doors displaced from their wall cuts, incomplete suite enclosures, an obstructive solid stair reservation, dry-route gaps and roof-junction conflicts. See the [Terra diagnosis](../../design-first/planning-failure-audit/REPORT.md) and [Sol comparison](../../design-first/sol-planning-comparison-2026-10-30/REPORT.md).

The semantic compiler is intended to coordinate hosted door cuts/panels, shared boundaries, floor datums and explicit stair intent. Offline mock evidence demonstrates supported coordination, with separate physical checks still required. This failed transport provides **no new evidence** that Terra can select valid semantic architecture or improve architectural quality. Further development remains a hypothesis supported by offline feasibility, not a demonstrated live success. No comparative architectural verdict is possible from this attempt.

Production Generate and compiler source were unchanged. No database access, commits or deployments occurred. New work is limited to the standalone experimental transport and this evidence directory. No tests were run because no model result or production implementation changed.
