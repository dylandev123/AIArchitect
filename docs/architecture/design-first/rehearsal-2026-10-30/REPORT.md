# Design-first harness correction and complete offline rehearsal

**The harness now completes both mocked provider stages, saves an editable scene and renders all four views. Zero paid AI calls, commits, deployments or production database writes occurred.** The architectural experiment remains pending separate authorization. The [original failed attempt](../live-2026-10-30/REPORT.md) is preserved unchanged.

## Correction

In `scripts/design-first-experiment.ts`, the SQL interception around the real `SELECT kind, data FROM library_docs` called `.catch()` on the return value of both `Pool.query` and `Client.query`. pg-pool delegates to `Client.query` with a callback; that overload returns `undefined`.

The guard now detects the callback overload, wraps its callback to record completion/errors, and returns the client's original return value. Promise calls use Promise completion/error handlers. Suppressed initializer DDL and locally redirected usage INSERTs also complete through the caller's appropriate callback or Promise API. The same execution path was inspected in library initialization/read, knowledge retrieval, design generation, construction and usage logging; no further callback-return-as-Promise assumptions were found there. No database client or application database code was refactored.

Rehearsal is an explicit mode of the same experiment script. It replaces only Responses API transport with fixtures. Actual library retrieval, programme/context preparation, model selection, strict provider request construction, response parsing, proposal validation, proposal hashing, checkpoint evaluation, construction preparation, scene execution, geometry checks, route retention and cleanup use the existing path. The harness also verifies `SELECT current_setting('transaction_read_only')` returns `on` before the first provider request. DDL is suppressed and usage writes go to evidence files.

## Executed cases

The final cases are in `*-final-network/`. Each retrieved 128 real library rows through both the Pool Promise and Client callback layers, with server read-only mode verified.

| Case | Mock provider requests | Result |
|---|---:|---|
| [Success](pass-final-network/result.json) | 2 | HTTP 200; 23 editable operations expand to 78 scene elements; proposal fidelity `matched-anchors` |
| [Checkpoint rejection](reject-final-network/result.json) | 1 | HTTP 422; exact proposal retained; seven failed criteria block construction |
| [Planning provider HTTP 500](provider-failure-final-network/result.json) | 1 | Stops without retry or construction |
| [Construction provider HTTP 500](construction-failure-final-network/result.json) | 2 | Stops without retry or accepted scene |

The success proposal is a deterministic contract fixture derived from the retained complete-mansion scene. Its seven-criterion review is explicitly synthetic. It demonstrates gate mechanics, **not** an architectural pass or an improvement in mansion design. Both request bodies and mock responses, the exact proposal/hash/review, retrieved knowledge, programme/context, normalized output, operations, scene and geometry audit are preserved. The checkpoint rejection uses a schema-valid proposal, so it exercises the architectural gate rather than merely failing schema parsing.

[Verification](verification.json) checks all four cases, original normalized brief equality, read-only SQL evidence, restoration of fetch/query methods, pool closure, historical preservation and unchanged pre-existing application source hashes against the failed attempt. The original request file retains its trailing newline; the existing request schema trims it, exactly as in the failed attempt. The prepared payload file was not changed. Each case includes `preservation.json` confirming all 237 historical evidence files checked remain byte-identical.

## Rendering and validation

The success scene was read back from disk, validated and rendered unchanged through normal `OperationScene`/`VillaScene` presentation on a development-only rehearsal page. [Browser verification](pass-final-network/browser-result.json) confirms exact IDs, local positions and yaw for all 78 elements in every view, no page errors and no lost WebGL contexts. Browser APIs and all non-local requests were blocked. Browser cleanup completed successfully.

[Arrival](pass-final-network/arrival.png) · [Aerial](pass-final-network/aerial.png) · [Garden](pass-final-network/garden.png) · [Poolside](pass-final-network/poolside.png)

The fixture's existing architectural limitations and findings remain in the route response. Geometry acceptance and matched proposal anchors do not establish six completed suites or premium architectural quality.

16 focused tests pass across the design-first route, proposal and checkpoint suites. Focused ESLint passes. Current code typechecks when the historical `live-2026-10-30/experiment-script.as-run.ts` evidence copy is excluded using a temporary configuration. Full repository typecheck remains blocked solely by that archived source copy's unresolved relative imports and associated type errors; the historical evidence was not edited to hide them. A harness cost-summary inference error discovered during checking was corrected by retaining consistent fallback pricing fields; this affects bookkeeping only, after the provider stages.

An earlier sandbox-only run failed DNS before provider submission and remains in `pass/`; it did not reproduce the callback defect. Network-enabled rehearsals used the real database successfully. An initial Chrome launch was blocked by the sandbox; local Chrome rendering subsequently succeeded with the required execution permission. Earlier rehearsal directories are retained rather than overwritten. Their initial mock counters may be labelled `paidCalls`; all provider responses there were mocked. Final result/usage files explicitly record zero paid calls separately from mock request counts.

## Reproduction and live boundary

The script refuses existing evidence directories. Rehearsal commands below show the executed final cases; rerunning them intentionally refuses to overwrite evidence. A new isolated evidence directory must be chosen for another rehearsal.

```sh
npx vite-node --config vitest.config.mts scripts/design-first-experiment.ts --rehearsal=pass --network-enabled --final-check
npx vite-node --config vitest.config.mts scripts/design-first-experiment.ts --rehearsal=reject --network-enabled --final-check
npx vite-node --config vitest.config.mts scripts/design-first-experiment.ts --rehearsal=provider-failure --network-enabled --final-check
npx vite-node --config vitest.config.mts scripts/design-first-experiment.ts --rehearsal=construction-failure --network-enabled --final-check
node scripts/design-first-rehearsal-capture.mjs
node scripts/design-first-rehearsal-verify.mjs
```

Rendering uses the existing development server on port 3015 and local Chrome/playwright-core. The verify command is offline and repeatable.

No Terra guidance, planning contracts, checkpoint criteria, geometry, knowledge, model configuration or operation limits changed. The original Saint Lucia US$25 million estate brief and prepared provider payload remain intact. A future authorized live execution uses the same corrected script without a rehearsal flag, a fresh `live-after-rehearsal-2026-10-30` evidence directory, `gpt-5.6-terra`, provider-default reasoning, 30,000 output tokens per stage, maximum two calls and zero retries. Call 2 remains conditional on a separately persisted, exact-hash review passing all seven unchanged architectural criteria. No live authorization is inferred from these mock reviews.
