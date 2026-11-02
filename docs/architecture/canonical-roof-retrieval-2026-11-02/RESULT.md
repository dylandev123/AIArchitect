# Result of the authorized canonical mansion call (2026-11-02)

**One paid call, HTTP 200, response completed. The compiler rejected the plan; no house was constructed, so there are no renders and no architectural-quality assessment.**

- Request: the frozen file, SHA-256 `8a61d11a…ab49`, unchanged; connectivity preflight passed; one POST, no retries, fallbacks or repairs. `call-started.json` marks the authorization consumed.
- Usage: 4,556 input, 9,879 output (4,844 reasoning), 14,435 total. Estimated cost **US$0.12766** at repository default rates ($2/M in, $12/M out); an estimate, not an invoice.
- Preserved: [raw response](provider-response.exact.json), [proposal text](proposal.exact.txt), [normalized proposal](proposal.normalized.json), [validation](validation.json), [usage](usage.json), [cost](estimated-cost.json), [offline diagnosis](offline-diagnosis.json).

## What was rejected
`waterfront-lawn-reserve: missing site anchor.` The model anchored the lawn to `waterfront-rectangular-pool`; the contract says pools and landscape are placed relative to a *space*. Model-authored contract violation, not a schema, truncation or partial-roof failure. The compiler stops at its first derivation failure, so later problems were hidden.

## Offline diagnosis (altered copy, not a Terra output)
With only the lawn reserve removed, compilation reaches the volume check and reports three genuine same-level overlaps: `kitchen/west-suite-1` (3.60 m), `pantry/west-suite-1` and `pantry/west-suite-2` (3.30 m). The saved plan therefore had at least two independent errors: a mis-anchored site item and a service block placed on top of the west suite wing. Further stages (portals, roofs, screens, site) remain unevaluated.

## What the proposal intends (not constructed, not a quality claim)
Single level (`ground` only), six masses, 21 spaces (three east and three west suites, entry hall, central gallery, living salon, dining, kitchen/pantry/laundry/store, media lounge, two terraces, arrival forecourt), all roofs flat. Because it is one storey, the new partial-roof derivation and the explicit-height risk were not exercised. Intended ambition is a ceremonial arrival and gallery with flanking suite wings; whether the geometry delivers it is unassessed. Compared with the prior mansion attempts this one did not add levels.

## Status
Authorization consumed; no resubmission. Nothing was modified in the application for this run (runner and review scripts are new copies pointing at this folder). No commits, deployments or database changes.
