# Single authorized Terra semantic mansion attempt

One fresh paid request completed with HTTP 200 and provider status `completed`. Semantic validation then failed. No geometry was constructed and no renders were made. No repairs, refinements, retries or fallback calls were performed.

The effective credential loaded from `.env.local` privately matches the user-confirmed masked identifier `sk-...pgA`; no inherited credential overrides it. Only the match result was exposed, never the full credential. This verifies the available masked identifier, rather than claiming access to Platform's hidden full-key metadata. The user confirmed that entry is Active with All permissions. Successful response creation now directly verifies that this configured credential can create a Terra response.

The same Node process (PID 20603, Node v26.12.1) ran [outside-sandbox preflight](transport-preflight-1793490667620-20603.json) immediately before POST: DNS succeeded, IPv4 certificate-validated TLS 1.3 succeeded, and exact-model authenticated GET returned 200. IPv6 EHOSTUNREACH did not block native fetch. Responses GET retained its known read-scope restriction; the subsequent POST succeeded.

Automatic approval review initially rejected launching the old runner because it rebuilt the request by replacing an instruction in the original source. No process or paid call started in that rejected action. The runner was corrected to read the previously approved retained `request.exact.json` verbatim and assert its SHA-256. The corrected launch was approved and made the sole fresh POST. Its payload is exactly the previous retained experimental request, including the previously approved experimental-limitations instruction; no new instruction or generation setting was introduced.

[Exact request](request.exact.json) SHA-256: `3c99dee2f4a3becda07e405d27e018d976fbc1d82d52cc8a34ff36d3d6e8b8ed`, 18512 bytes. Model `gpt-5.6-terra`, provider-default reasoning, max output tokens 30000. The original failed attempt, lock and unknown billing status remain unchanged in the separate historical directory.

[HTTP metadata](http.json): request ID `req_7d71e0096b944ce193674a5b08921a44`. Response ID `resp_012d2cbd0cecbd00006ae67eebcbb087d2865927e288f6c7ab`. [Complete provider response](response.exact.json), [exact extracted output](proposal.exact.txt), [parsed output envelope](proposal.json), [unchanged semantic proposal](semantic-proposal.json), [usage and cost estimate](result.json).

Provider-reported usage: 1238 input tokens (1235 cache-write tokens, zero cached-read tokens), 5719 output tokens (3385 reasoning tokens), 6957 total tokens. Estimated cost at the recorded rates: $0.0717215, not an invoice.

## Exact validation failure

The model returned `status: proposed` with 14 spaces and level IDs **`L0` and `L1`**. Those uppercase identifiers and every corresponding `spaces[*].level` reference violate the unchanged semantic identifier regex `^[a-z][a-z0-9-]{0,39}$`. [Validation](validation.json) retains all 16 findings: two level IDs and fourteen space references. [Construction outcome](construction-outcome.json) retains the unchanged rejected response. This is a schema validation failure before geometry compilation, not a network, TLS or API-permission failure.

The initial offline postflight mistakenly passed the provider's top-level envelope to `constructSemantic`; the actual wire schema requires the nested `proposal`. That harness error was corrected without modifying provider data. Its initial diagnostics remain under `postflight-envelope-mistake.*`; they are not attributed to the model. The correctly extracted proposal produced the identifier findings above. No identifier normalization, compiler exception or scene repair was attempted.

No geometry, physical-check result or render exists because validation stopped before compilation. The returned architectural intent remains preserved in full. Existing house, architectural model, semantic compiler, construction engine, database and production configuration were untouched. No commits or deployments.

Native runner syntax check and focused ESLint passed; the seven existing transport preflight tests passed. Those tests are transport evidence, not a quality score for this proposal.
