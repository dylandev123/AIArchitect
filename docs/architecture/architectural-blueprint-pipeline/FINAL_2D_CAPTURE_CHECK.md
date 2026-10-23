# Final 2D evaluation capture check — 2026-10-21

**PASS. One paid 2D evaluation is safe to proceed on the checked working-tree code with `AI_V3_PLAN_EVALUATION=1`.** This verifies capture and evaluation controls, not the architectural quality of a future response. No deployed endpoint was changed or tested against a live provider.

The browser check ran the real `/api/ai/plan` production handler under an optimized `next build --webpack` / `next start`, including the production Terra adapter and AI SDK. An isolated source copy, fresh browser storage, dummy credential and offline provider transport prevented changes to real projects and prevented external provider access. Four independent scenarios each used exactly one mocked initial response; there were zero real Terra/OpenAI calls.

| Requirement | Result | Evidence |
| --- | --- | --- |
| Actual production request path, offline Terra response | PASS | Landing Design 2D Plan → client → HTTP route → actual SDK/model adapter → mocked transport |
| Capture before parsing, normalization, validation or rejection | PASS | SDK `onStepFinish` retains text before structured-output parsing; route tests check the file exists when normalization starts; malformed JSON also survives SDK rejection |
| Exact original text and matching SHA-256 | PASS | Whitespace, line endings and UTF-8 preserved byte for byte for nonsecret responses; server files, returned captures, browser storage and downloads independently compared |
| Rejected blueprint downloadable in normal UI | PASS | Geometry rejection (422) and malformed output (502) downloaded through the landing page link |
| Successful blueprint retained for later inspection | PASS | Immutable server response and capture metadata, browser capture keyed by SHA-256, workspace download still identical after local edits and reload |
| One initial call; no automatic retry, repair or 3D elaboration | PASS | One transport log entry per evaluation, 10,000 output-token budget, `maxRetries:0`; retryable provider-error unit check also makes one attempt; no 3D canvas during browser evaluation |
| Inspect, edit and reload the saved 2D plan | PASS | Actual 2D Floor Plan; footprint edited from 12 m to 13 m, saved, undone, redone and reloaded with identical saved JSON |
| Secret redaction and existing-project preservation | PASS | Secret-bearing response redacted in disk/client/download captures; existing projects compared in full after every evaluation; immutable `wx` response writes; stale client response cannot overwrite a concurrent edit |

Only essential capture corrections were made:

- Moved capture to the SDK completed-step callback. Previously, malformed JSON could throw before the route saved its response.
- Reused the existing secret redactor before persistence or client delivery. `sha256` and `bytes` describe the captured content; `originalSha256` and `originalBytes` describe the original provider text. `redacted:true` explicitly identifies the exception to byte-exact retention. Original secret values are never retained by this capture mechanism.
- Returned successful captures and retained them in browser storage before project application, including when a concurrent edit blocks application. Added the workspace download link and immutable private capture metadata files.
- Included recovery evidence on the remaining exterior-rejection branches, without adding calls or changing the evaluation workflow.

Validation:

- **130 tests passed across 10 focused/relevant suites**, including production plan routing, malformed output, pre-normalization capture, artifact privacy/immutability, concurrent client edits, full browser storage, existing redaction, plan geometry, planning, workspace persistence and house-route guards.
- **TypeScript `tsc --noEmit`: PASS.**
- **Focused ESLint: PASS.**
- **Optimized production build: PASS**, using offline cached fonts and blocked external network.
- **Production browser integration: PASS**, four mocked responses, one per evaluation; zero retries, repairs, elaborations, external requests or browser errors.
- **`git diff --check`: PASS.**

Machine evidence: [final-2d-capture/proof.json](final-2d-capture/proof.json). Transport log: [final-2d-capture/provider.jsonl](final-2d-capture/provider.jsonl). Browser runner: [plan-capture-integration.mjs](../../../scripts/plan-capture-integration.mjs). Screenshots include [rejection](final-2d-capture/1-rejected.jpg) and [edited/reloaded plan](final-2d-capture/5-edited-reloaded.jpg).

Production Postgres usage logging was intentionally disconnected during the offline browser check; the resulting expected usage-storage warnings did not affect response capture. Server filesystem retention is best effort; the requesting browser also receives and stores captures. Browser storage remains local to that browser, so download the response for an independent copy.

No real Terra/OpenAI calls, commits, pushes or deployments were performed. Existing unrelated working-tree changes were retained.
