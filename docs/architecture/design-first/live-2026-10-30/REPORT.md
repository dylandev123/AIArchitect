# Controlled design-first mansion experiment — stopped before provider submission

**No architectural result was produced. Zero paid calls, zero provider tokens and US$0 estimated provider cost.** The authorized attempt stopped during knowledge retrieval because of a defect in the local experiment harness. This is an execution failure, not evidence of either successful or unsuccessful Terra planning. No restart, retry, fallback or construction request was attempted.

The original $25 million Saint Lucia waterfront mansion brief is retained unchanged in [request.json](request.json). The configured model was verified as `gpt-5.6-terra`. The intended limits were two conditional calls, provider-default reasoning, 30,000 output tokens per stage and zero retries. Local direct invocation used the existing Generate route and the request-local seven-criterion checkpoint. See [authorization](authorization.json) and [executed source](experiment-script.as-run.ts).

## Exact stopping point and cause

The route returned HTTP 422 with `TypeError: Cannot read properties of undefined (reading 'catch')` and `providerCalls: 0`. The harness suppressed the library initializer DDL, then forwarded a `SELECT kind, data FROM library_docs`. Its SQL guard wrapped both Pool and Client queries and assumed that the forwarded query always returned a Promise. Internally, pg-pool calls `Client.query` with a callback; that overload returns `undefined`. The harness called `.catch` on it, causing the failure before retrieval completed.

The two SELECT log entries record the Pool and Client layers of the same dispatch; they do not demonstrate two retrieval attempts. This is my harness error. It is not a provider refusal, model failure, database schema problem or architectural rejection. The SSL compatibility notice was a warning and did not cause this exception.

[Offline diagnosis](offline-harness-diagnosis.json) reproduces the exact exception using an unconnected pg Client, with connection attempts and fetch prohibited. No database or provider was contacted in that diagnosis. It also verifies that the archived execution script matches the source hash recorded before the attempt. A future harness needs callback-aware error handling and an offline Pool-to-Client delegation test. The failed run was not resumed or resubmitted.

## Evidence and missing stages

| Requested evidence | Actual status |
|---|---|
| Original brief and execution settings | Retained |
| Architectural provider payload/output and usage | Not produced: no provider request began |
| Exact design proposal/hash | Not produced |
| Seven-criterion architectural review | Not reached; every architectural criterion remains unassessed |
| Committed construction request, output or rejected draft | Not produced |
| Operations and geometry measurements | Not produced |
| Aerial, arrival, garden and poolside renders | Not produced: no new scene exists |

The generic route diagnostics label the response `contract-rejected` and describe missing programme data. That label must not be interpreted as an architectural judgment: no model response exists to validate. Similarly, `checkpointPassed: false` means the checkpoint was never reached, not that a proposal failed seven criteria.

[Result](result.json), [route response](route-response.json), [retained diagnostics](retained.diagnostics.json) and [usage/cost](usage-and-cost.json) preserve the failure. The provider request counter increments and writes a stage-start marker before any fetch; there are no such markers or provider response artifacts. No provider output or geometry has been fabricated to fill these gaps.

## Architectural conclusion and preservation

**Architectural design quality versus design-to-construction translation: neither can be determined from this attempt.** There were no recorded model decisions to investigate. Existing evidence still shows weak architectural authoring in the earlier mansions, but this failed execution does not test whether separating design from construction improves that behavior.

No manual replacement geometry, refinements, production database changes, commits or deployments occurred. Only SELECT dispatch was permitted; the initializer DDL was suppressed and no usage INSERT was reached. [Preservation](preservation.json) verifies that all 237 previously retained files checked across the complete-mansion, generation-quality and original estate-diagnosis evidence directories remain byte-identical. Source and historical hashes were recorded before execution. All new evidence is isolated here; earlier reports and scenes were preserved.

The live attempt is closed under the instruction to stop on execution failure. Any later run requires separate authorization; it must not silently reuse this attempt as a retry.
