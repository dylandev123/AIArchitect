# Latest failed 2D evaluation — October 21, 2026

The latest attempt failed at the provider boundary with **HTTP 429**, before a completed design response existed. No architectural output from this attempt was recovered. The application also had an error-reporting defect: its catch block discarded the error and returned the same generic message for unrelated failures. That reporting defect is corrected; no architectural geometry or intent was changed.

## Correlation

| Evidence | Latest failed attempt |
| --- | --- |
| Project | `6bf8fe7c-d1d9-48e5-90a5-72fed0d0ee00` |
| Usage record | `31fef067-55a9-49a3-a0ce-0899bd786a0e` |
| Start | October 21, 2026, 16:04:08.842 Saint Lucia (`2026-10-21T20:04:08.842Z`) |
| Model/stage | `gpt-5.6-terra` / `v3-plan-evaluation` |
| Provider outcome | `provider_429`; diagnostic `AI_APICallError`; 2,758 ms |
| Retry / budget | retry 0; maximum output 10,000 tokens |
| Reported tokens | input 0, output 0, total 0; no provider usage attached to the HTTP exception |
| Recorded estimate | $0; this is not independent confirmation of an invoice or charge |
| Response evidence | no finish reason, output fingerprint, candidate or completed-step capture |

Safari's existing page showed exactly the user's generic `PlanEvaluationError`, no response-download link, and this project as the newest evaluation. It was inspected without retrying or refreshing the request. A read-only transaction against the configured Postgres database returned the correlated usage record. The local JSONL usage file has no evaluation rows because this environment uses Postgres.

The running server's working directory was verified as this repository. Its stdout/stderr point to `/dev/ttys008`. Existing development log and trace files were inspected and preserved; neither retained the provider's 429 body or a more specific error code. The old route swallowed that exception without logging its details. **The evidence cannot distinguish rate limiting from quota exhaustion.** There is no evidence of a timeout, content refusal, output truncation or architectural rejection in this latest attempt.

Private source evidence is preserved in `.v3-debug/failed-paid-2d/usage-records.json`, `server-development.log`, `server-trace.jsonl` and `response-inventory.json`. The database was not modified.

## Response and architecture

All 13 pre-existing files under `.v3-debug/plan-evaluations` were inventoried with SHA-256 and modification times, without modifying their contents. The newest response is `8665188e87ddad3ba14bef86247121b10d9bebeea137ecd542287cb41510bb4b`, 16,924 bytes, written at 15:27 Saint Lucia time. The prior [capture proof](final-2d-capture/proof.json) identifies that exact hash as the synthetic rejected response used in verification. It predates the 16:04 failure and is not its response.

An earlier, separate evaluation (`ea6dc83e-6f57-4ea5-aacb-7317849eaa0d`, project `1fe77323-316a-4100-a53e-93fad6960361`, 15:11 Saint Lucia) reported 4,936 input and 6,026 output tokens, finish `stop`, estimated $0.082184. Its missing response was already documented in [the earlier investigation](FIRST_LIVE_PLAN_GEOMETRY_REPORT.md). It must not be substituted for the latest attempt or treated as a new paid call during this investigation.

For the latest attempt:

- Exact design text / SHA-256: unavailable; no completed design response was captured.
- Parsing: never reached with provider design text.
- Schema normalization: never reached.
- Geometric plan validation: never reached.
- Estate master plan, building footprints, conceptual rooms, outdoor features: none recoverable.
- Editable workspace recovery: impossible from this attempt; existing projects remain preserved. No substitute blueprint was imported or displayed.
- Original-response offline replay: impossible because neither design text nor the original HTTP error body was retained. This is explicitly distinguished from the synthetic failure-class replay below.

## Application correction and verification

The route now returns structured, distinct failures for provider HTTP errors, SDK/transport errors, timeout, content filtering/refusal, truncation, invalid JSON, schema rejection, geometric planning rejection and application processing exceptions. HTTP 429 remains ambiguous unless an actual provider code is available. Neither rate limiting nor quota exhaustion is inferred solely from its status.

Immutable failure artifacts retain a timestamp, project/action correlation, diagnostic reference, response hash when available, HTTP status, allowlisted provider code and request ID. Raw request bodies, credentials, headers and provider error messages are excluded. Existing text capture/redaction/SHA-256 behavior remains in place, including a fallback for text carried by structured-output SDK exceptions. No retry, repair, generation budget or architectural acceptance policy was changed.

The shared client propagates each distinct message and diagnostic reference to the landing and workspace error handlers. Tests verify the UI-facing `String(PlanEvaluationError)` and typed failure details, preservation of every existing project and continued response availability. The two UI handlers already render this error string, so they no longer receive one generic message for all failure types. Existing errors already held in a browser's React state are not retroactively replaced.

- **78 tests passed across 7 relevant suites**, including real SDK route parsing, recorded 429 class, rate-limit/quota code distinction, timeout, refusal, truncation, schema/geometry/application failures, immutable captures, no retries, client preservation, plan geometry and workspace view behavior.
- **TypeScript `tsc --noEmit`: PASS.**
- **Focused ESLint, including integration scripts: PASS.**
- **`git diff --check`: PASS.**
- **Isolated optimized `next build --webpack`: PASS**, with cached fonts, dummy credentials and blocked external transport.
- **Production HTTP integration: PASS** through `next start`, the real `/api/ai/plan` route, production model adapter and SDK. Four synthetic inputs produced provider/parsing/schema/geometry diagnostics; no project JSON was returned on failure; available text remained byte-exact; immutable failure evidence was checked. [Machine proof](failed-paid-2d/integration-proof.json), [synthetic transport log](failed-paid-2d/synthetic-transport.jsonl), [server log](failed-paid-2d/server.log).

The production integration reconstructs only the recorded **HTTP 429 failure class**; its synthetic HTTP body is explicitly labeled and is not claimed as the original body. Other inputs are regression fixtures. Its isolated source copy and dummy credentials prevent access to real projects or the usage database; expected shared-persistence warnings appear in the test log. The initial sandbox listener restriction was resolved by running the same network-blocked test with localhost listener permission.

**No additional Terra/OpenAI calls, paid generations, automatic retries, commits, pushes or deployment occurred.** No further provider call is necessary for this diagnosis. This attempt cannot yield a recovered blueprint; obtaining any new blueprint would be a separate generation requiring explicit authorization.
