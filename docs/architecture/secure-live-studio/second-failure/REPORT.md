# Second controlled Studio run: accepted concept, interrupted massing

The exact saved run is `c5bb95c7-ff3d-486f-9b93-24810812ebdd`. Stage 1 (architectural direction) was accepted. Stage 2 (building massing) was attempted next; the provider finished normally and usage was settled, but execution threw before the updated pipeline result was assigned to the run. No Stage 2 checkpoint or response survived that exception. The run is stopped, not uncertain about billing.

| Call | Input | Output | Reported reasoning | Finish | Cost |
| --- | ---: | ---: | ---: | --- | ---: |
| Stage 1 | 674 | 520 | 0 | stop | $0.007588 |
| Stage 2 | 1048 | 1339 | 963 | stop | $0.018164 |
| Run total | | | | | $0.025752 |

Stage 2 reports zero cache-read tokens and 1045 cache-write tokens. All calls are settled, with no token-limit violation. The earlier run's $0.007894 is separate. Original accepted concept, raw Stage 1 response, request, usage and both call records are preserved in [evidence](evidence.json), without authentication records.

## What can and cannot be concluded

The Stage 1 concept is the actual Terra response, accepted with hex color `#B65A36`. It is design direction only; there is no accepted building massing or constructed house geometry in this run. The unchanged architectural prompt is stored in the run. Stage 2's builder uses that prompt and the accepted Stage 1 slice as context.

The generic persisted Stage 2 error was `Stage execution interrupted; inspect the last checkpoint and call ledger.` The prior pipeline result still says `paused` after Stage 1, while authoritative run state says `failed`. This proves that the pipeline advance threw before committing its result; it does not establish the original exception's message or particular geometry constraint. There is no stored Stage 2 raw response, validation error or exact request snapshot, and no matching local capture or relevant server log. Provider usage/finish metadata alone cannot reconstruct them. No provider retrieval or new paid request was attempted.

One concrete unhandled path is open-space normalization, which throws when an open block overlaps a house or does not touch a valid host. Applying/measuring a slice was outside the pipeline's provider-error handler. An explicitly synthetic detached-veranda test reproduces that evidence-loss path. It is **not** the missing live Terra response and does not establish that this particular run contained a detached veranda.

The older combined staged request also used non-strict output for massing and the same block vocabulary, but explicitly described attachment/stacking and later outdoor reserves. The Studio adapter has its own stage-specific guide and preserves accepted concept decisions. Earlier retained geometry passing these checks does not prove every future model output will satisfy them. Without this Stage 2 payload, attributing the failure to that instruction difference, a schema field or model geometry would be speculation. No geometry constraints or massing instructions were relaxed or rewritten in this fix.

## Narrow correction

- Persist raw provider text and request system/prompt alongside usage in the durable per-call ledger, before structured-output access or geometry construction can throw.
- Convert exceptions while interpreting/applying/measuring stage output into explicit `construction-error` findings and a rejected checkpoint. Keep the last accepted checkpoint and never dispatch a correction under the zero-retry Studio policy.
- Expose failed stage separately from last accepted stage, including for this existing interrupted run by reading its last ledger call. Surface the stored error instead of showing only `Stage 1 · failed`.

Offline tests use the exact saved run for status interpretation, the actual accepted concept, and a clearly labelled developer massing fixture for exception handling. A real-SDK offline transport test verifies that raw response/request evidence reaches the durable ledger. Historical failed runs, approvals, project data and spending records are hash-checked unchanged.

No automatic recovery, approval, live call, commit, push, deployment or database change was made. The original stopped run remains stopped, and its accepted concept remains inspectable. Recovering this particular missing Stage 2 output is not possible from retained local evidence. A paid retry or restarting from Stage 1 is not authorized by this task; neither was done. Future offline recovery from a retained response is now possible to investigate without repeating its paid call, but a recovery action was not added or exercised here.
