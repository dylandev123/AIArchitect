# Automatic five-stage Studio generation — offline proof

Implemented and verified on 5 November 2026. No paid calls, real approvals, credentials, historical runs, production infrastructure, commits, pushes or deployments were changed. Offline tests create approvals only inside disposable temporary stores. All new response fixtures are explicitly developer-authored provider doubles; they are not Terra design evidence.

## Outcome and supported boundary

Private Studio now has one **Generate House** action. Its authenticated POST consumes the existing exact-brief, owned-project, single-use authorization and persists an automatic job. A Next.js Node instrumentation worker advances the real PrivateStudioService, LiveDesigner, stage schemas, room solver and compiler without browser advancement requests. The browser polls owned status, displays five stages and recorded spending, previews accepted checkpoints, opens completed geometry and imports its authoritative editable source into project history when the local baseline is unchanged. If local edits changed the baseline, automatic import is refused; the completed server save remains available.

This is the existing single-machine **development-only** private Studio. It does not enable a production endpoint, serverless worker, public generation service or alternate house generator. Start the development server on the existing required origin, `http://localhost:3015`; instrumentation starts the worker there. No separate worker command or manual stage clicks are necessary for newly authorized automatic runs.

The complete offline supported workflow passes. It is not proof that an arbitrary Terra output will construct successfully, or that all generated designs will be attractive. Unsupported or physically contradictory decisions stop with retained evidence and accepted geometry. No architectural intent is silently redesigned to force success.

## Historical failure and evidence preservation

Read the second-failure report and its retained run before implementing. Its live Stage 2 raw response and original exception remain missing. The detached-veranda reproduction is synthetic and **does not identify the missing live error**.

The full service path uses LiveDesigner observation to save exact request text **before dispatch**, then raw response, provider metadata and usage **before structured-output access and construction**. The real SDK transport tests assert the request already exists in the durable reservation when the outgoing transport runs. Construction exceptions become rejected checkpoints with the prior accepted result retained. The existing exact-recorded-run regression and real SDK wire regression pass.

The real `.data/private-studio/state.json` and second-failure `evidence.json` were hash-checked unchanged across this task's implementation and browser verification. Historical/manual runs do not acquire the automatic flag and cannot be picked up by the worker. Both original stopped runs remain untouched.

## Significant demonstrated defects and corrections

| Boundary | Observed issue | Correction and proof |
| --- | --- | --- |
| Orchestration | The UI issued one advance request per click; no server loop existed. | Persisted opt-in automatic jobs; instrumentation worker uses the existing admission, reservation and stage execution path. One-click browser completion survives refresh. |
| Stage 3 → Stage 4 | Requests contained the requested programme, but omitted the solver's actual room rectangles and measured free exterior wall runs. | Pass authoritative solved rooms and measured exterior walls, preserving accepted blocks. SDK transport tests inspect these inputs. |
| Stage 4 → Stage 5 | No explicit measured entrance/veranda reservation list accompanied the site request. | Pass fixed site obstacle rectangles, excluding the placeholder pool. No relocation or rewriting of accepted architecture. |
| Incomplete stage slices | A syntactically valid empty roof map retained flat massing placeholders and could pass as accepted exterior design. | Require exact block coverage for room plans, roof designs and finishes; reject unknown references. Regression retains Stage 3 and stops before landscaping. |
| Entrance relationships | The exterior validator did not require its entrance reference to identify the one main door on the ground-floor foyer; invalid facade sides also passed identity checking. | Explicit entrance, facade-key and exterior-ID checks. Missing-entrance test stops Stage 4 and preserves rooms. |
| Final contract | `stopAfter:5` returned before the pipeline's final whole-spec parse. | Validate the complete specification before accepting Stage 5 in the actual one-stage-at-a-time Studio path. Save/reload recompilation verifies the authoritative spec matches scene geometry. |
| Evidence | Requests were previously stored only once a provider response or error arrived; compiler stack and complete local schema results were absent. | Persist requests before dispatch; retain full stage input, raw/slice, schema issues, measured findings and construction/compiler error stacks. Synthetic detached veranda proves construction exception retention. |
| Room quality | Search metrics alone did not report deviations from original model-requested areas. | Separate non-blocking observations show each room beyond 30% requested-area deviation or 2.5 aspect ratio. Existing hard physical validation remains intact. |
| Progress and failures | Manual controls did not recover automatically after refresh; accepted stage count could obscure the failing stage. | Owned polling, five explicit states, completed count, activity indicator, actual/held spending, saved previews, error category and diagnostics. Browser verifies Stage 4 failed while only stages 1–3 are completed. |

Failure categories distinguish formatting, schema, architectural contradiction, room solver, geometry construction, site conflict and provider timeout/execution. Persistence/admission errors stop the job with an execution error. Each rejected checkpoint also retains a diagnostic correction prompt with `authorized:false` and `maxCalls:0`. It is an artifact for later review; nothing dispatches it.

## Recovery, cancellation and spending

- Restarting the service between accepted stages resumes from the server-owned checkpoint; no browser checkpoint is trusted.
- The durable reserved call and run state serialize competing worker instances. Concurrent workers cannot duplicate a stage; an already accepted next stage may legitimately start on a later tick.
- A running automatic stage older than ten minutes is stopped as failed if usage settled, or uncertain if accounting is unresolved. It is never dispatched again. Reservations remain held where appropriate; later spending for that owner remains blocked on unresolved accounting.
- Cancellation is persisted and checked atomically before reservations. An already active provider request may finish, settle usage and save its checkpoint; future stages are cancelled. A fully finished fifth stage remains a completed house.
- Every worker stage rechecks project ownership, the consumed exact-brief authorization and policy, stage revision, call count, reservation and cumulative cost. Five calls maximum, 12,000 output tokens each, $1.40 maximum, zero correction calls and zero SDK retries remain unchanged.
- The existing local file-store lock remains fail-closed. A process killed while holding its short disk transaction can leave a stale lock; automatic lock theft is deliberately not implemented. Storage corruption or a stale transaction lock requires operator recovery and does not trigger a paid retry. Tests simulate interruption after reservation and between checkpoints, not power loss during filesystem writes.

## End-to-end offline evidence

`automatic.test.ts` uses the actual SDK and intercepts only its HTTP transport. The saved responses go through the real schemas and Studio service into the existing solver/compiler. No simplified test-only pipeline replaces production execution. Complete per-test runs, exact requests, responses, schemas/errors, findings, geometry and server saves are retained under [evidence](evidence/); authentication and approval records are omitted.

| House fixture | Actual constructed specification | Result |
| --- | --- | --- |
| A — compact Caribbean | Single storey, three bedrooms, two bathrooms, pitched hip roof, covered veranda, swimming pool and flat site | Five stages, editable geometry, server save and authoritative reload pass. |
| B — Mediterranean/Spanish | Two storeys, four bedrooms, courtyard masses, multiple roof rises and covered outdoor living | Five stages, room/stair preservation, server save and authoritative reload pass. |
| C — contemporary estate | Large connected wings, six bedrooms, gallery circulation, flat roofs, landscaped pool and flat site | Five stages, stable identities, server save and authoritative reload pass. |

A separate complete test gives the **identical non-sample prompt** two different provider decisions: different widths, roof forms/colors and pool positions. Both houses complete with correspondingly different geometry. This proves the live path consumes provider specifications rather than selecting a hardcoded house by prompt. It does **not** prove the mocked provider understood natural language; actual Terra interpretation is unproven.

Controlled tests cover malformed responses at all five stages, overlapping blocks, synthetic detached veranda construction exception, unknown room host, incomplete roof map, invalid entrance, pool/building overlap, uncertain provider usage, interrupted reservations, concurrent workers, cancellation, cumulative spending, restart/reload, semantic edits and protection of historical/manual jobs. The retained-room-solver tests additionally construct 44 of 60 random programmes and give explicit conflicts for the other 16; all successful layouts pass physical checks. The existing site variation audit passes 12/12.

Final relevant suite: **20 files, 181 tests passed**. Typecheck and targeted ESLint pass. Production build passes; command results are recorded in [validation evidence](validation.json), [test output](tests.txt), [typecheck output](typecheck.txt) and [build output](build.txt). No deployment was performed.

The offline browser uses actual private authentication, HTTP handlers, durable service and the shared worker timer against a disposable store; provider decisions are injected. It blocks external browser requests. It verifies no-approval disabled state, one Generate click, active animation, refresh during generation, completion, automatic editable import, save/reopen, failure after refresh and cancellation. [Browser results](browser.json) record zero page errors and zero paid calls. Visually inspected [completed house](browser.png), [running progress](running.png) and [failed stage](failed.png).

## Architectural and visual limitations

Axis-aligned rectangular blocks, one/two storeys, flat land, guillotine room plans and the existing facade/roof/material vocabulary remain the declared capabilities. Room solving is bounded; conflicting programmes stop with measured advice. Curved architecture, terrain, basements and arbitrary structural systems remain unsupported. Prompt scope screening is still the existing limited admission check, not a comprehensive natural-language requirements interpreter.

The fixtures prove distinct masses, floor counts, roof forms, glazing, verandas, editable interiors and pools, not a universal quality score. The compact browser fixture has readable proportions and a shaded veranda but a simple facade and sparse landscaping. Existing materials, repeated window treatment, low-detail foliage and plain veranda roofs limit visual richness. Larger B/C fixtures are geometry-tested here; this task does not claim a completed browser aesthetic review of those houses. No renderer was replaced.

The real model's architectural consistency, prompt fidelity, ability to satisfy constraints in one response, live latency, provider schema behavior and billed cost remain unproven until a new approved experiment. A failed genuine architectural decision will stop rather than be repaired by inventing a different house. Original Stage 2 cannot be recovered from missing data.

## Requirements for one future explicitly approved live experiment

No experiment is requested or authorized by this report. If approved later:

1. Use one **new** server-owned project and one exact agreed flat-site, one/two-storey brief with an explicit bedroom count. Do not restart either historical failed run.
2. Review the five current LiveDesigner request/schema contracts and complete retained offline/browser evidence first.
3. Explicitly authorize that exact project/brief under the unchanged policy: `gpt-5.6-terra`, at most five calls, 12,000 output tokens per call, 170-second provider timeout, $1.40 run ceiling, zero retries and zero corrections. Create one single-use approval only after that authorization.
4. Run on the existing private local development origin with the Node worker, durable writable store, verified owner session and existing provider configuration. No production infrastructure or credential change is required by this implementation.
5. Press Generate House once. Inspect recorded spending, accepted geometry and source. On any failure or unknown provider outcome, stop and inspect retained evidence; do not create an approval or paid correction/retry automatically.
6. Review all five checkpoints and final exterior/interior/site views, reload the authoritative save and try a separately validated semantic edit. Assess aesthetics and prompt fidelity independently of physical validation.
