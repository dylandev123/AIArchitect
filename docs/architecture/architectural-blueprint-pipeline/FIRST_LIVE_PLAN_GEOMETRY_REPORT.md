# First live 2D evaluation: recovery evidence and geometry fix

## Recovery result

**The exact paid response was not recovered. Its bytes and SHA-256 are unavailable.** No replacement was generated and no independent fixture is presented as Terra's missing design.

The existing database contains one correlated `v3-plan-evaluation` usage row:

- Usage ID: `ea6dc83e-6f57-4ea5-aacb-7317849eaa0d`.
- Project ID: `1fe77323-316a-4100-a53e-93fad6960361`, matching the blank evaluation project visible in Safari.
- October 21, 2026, 15:11:05 Saint Lucia time (`2026-10-21T19:11:05.668Z`).
- Model `gpt-5.6-terra`; 4,936 input tokens, 6,026 output tokens; recorded cost $0.082184; finish reason `stop`.
- `candidate`, `output_fingerprint` and `diagnostic` are all null.

Read-only database evidence is preserved in `.v3-debug/first-live-plan/usage-records.json`. The public evidence inventory is [recovery-evidence.json](first-live-plan-geometry/recovery-evidence.json). The existing browser was inspected without refreshing or retrying the failed request. Local failure artifacts, fixtures, documentation, local usage logs and temporary replay captures were searched. No matching plan output was found.

The old plan route called `withUsageLogging` without an assessment callback, did not invoke the existing general-generation failure recorder, and returned only findings on validation failure. The browser client converted those findings into an Error string. Neither the usage record nor that client error contains the plan document. A completed billing record does not establish that a valid plan was saved.

## What Terra actually designed

Only these authored identities/types are established by the reported failure:

| Identity | Reported type |
| --- | --- |
| `arrival-court` | `paved arrival court` |
| `garden-terrace` | `paved terrace` |
| `resort-pool` | `swimming pool` |
| `south-lawn` | `lawn` |

The visible UI also identifies routes `arrival-drive` and `arrival-walk` contacting `arrival-court`, and `garden-walk`, `guest-path`, and `wellness-path` contacting `garden-terrace`.

**Buildings, footprints, dimensions, orientation, storeys, room zones, courtyard boundaries, pool size, outdoor amenity boundaries, complete route geometry and complete relationships cannot be reconstructed from these errors.** The brief was “Design an extraordinary $15 million luxury estate in Saint Lucia.” It is not evidence of the resulting architecture. An exhaustive list of that plan's validation failures and its geometric coherence cannot be established without the original output.

## Exact rejection mechanism

1. The input schema allowed `features[].type` to be any label string, but `prepareV3ArchitecturalPlan` accepted only the exact strings `terrace`, `courtyard`, `pool`, `landscape-zone`, and `canopy`. The four ordinary descriptive types failed with `PLAN_FEATURE` even though the schema already carried location, rotation, width and depth.
2. Route preflight separately required the destination type to be exactly `terrace`, `courtyard`, or `landscape-zone`. Consequently the descriptive court and terrace generated `PLAN_REFERENCE` findings. The visible five route errors are consistent with that same vocabulary mismatch, not proof of missing authored surfaces.
3. Any preflight finding caused a complete rejection before semantic lowering or the estate/room audits. Thus the UI's listed errors were not an exhaustive spatial audit of the entire response.
4. The plan feature schema required a positive height despite deferring vertical construction, and had no way to express the existing V3 outline/operation footprint on site features.

## Implemented behavior

- An explicit, finite vocabulary adapter maps paved/arrival courts to `courtyard`, terraces/decks to `terrace`, swimming pools to `pool`, lawns/gardens to `landscape-zone`, and walkways/driveways to existing V3 path types. IDs, labels, roles, authored geometry and references remain intact. Raw inputs are not mutated. No fuzzy label-based architectural inference is used.
- Plan features may carry V3's existing optional `footprint` (line/arc outline or articulated operations). Shared `authoredPlan` reads that boundary for drawing and spatial checks. Invalid boundaries are rejected; the system does not silently substitute their rectangular envelopes.
- Width/depth/location/rotation remain authored. Feature height can be omitted. A 1cm runtime selection proxy satisfies existing V3 array compatibility; it is not an authored slab thickness or pool depth. Deferred identities are recorded and checkout removes that proxy height from the editable plan. No missing horizontal dimension is invented.
- Plan-only rendering projects the semantic boundary directly; it needs no material, basin assembly, planting assets, roof, facade or exterior assembly. It does not invoke the scene compiler.
- Unknown detailed amenities can remain visible under their original type as boundary reservations with `PLAN_FEATURE_CONSTRUCTION_DEFERRED`. They are not represented as certified construction or permitted as dry route destinations.
- Dry endpoints share the type adapter and require real references and contacts within the exact authored boundary, including concave cutouts. Pool, canopy, unknown-space, missing-reference and off-boundary contacts remain invalid. Existing pool-crossing/obstacle audits remain active.
- Checkout distinguishes standalone path features from connection-owned paths, so saving and editing do not confuse route envelopes with site features.
- Unsupported nonrectangular construction, unknown equipment and undecided vertical extents produce later construction-readiness diagnostics. The explicit 3D route refuses these *before* any provider call; they do not invalidate the 2D plan. Detailed 3D construction was not implemented.
- Every future response text is hashed before validation and written to a private, immutable, hash-named local artifact. A rejected response also returns its exact text, byte count and hash to the requesting client, which retains it separately and offers a download. Existing provider-response files and saved projects are not replaced. This preserves the model's UTF-8 output text, not an assertion about unavailable HTTP transport bytes.

## Replay and screenshots: evidence boundary

The exact paid plan cannot be replayed or photographed because its output is missing. The offline regression is explicitly independent: `planned-site-regression.plan.json` is the pre-existing `plan-first-estate.plan.json` design with only its feature vocabulary changed to the reported terms. It is not a reconstruction of the paid estate.

The regression contains a two-storey curved residence, a one-storey orchard atelier, conceptual room zones, an arrival court, pool belvedere, water garden/pool, garden reservations, two canopy reservations, five named site connections and their original authored dimensions. Separate tests cover unrelated estates, concave terraces/gardens, curved pools, decks, driveways and paths.

Production UI proof and screenshots are recorded in `first-live-plan-geometry/proof.json`. They exercise the ordinary `/api/ai/plan` route and real SDK parsing with fixture text supplied solely by the test-process offline provider transport. The transport uses dummy credentials, clears database connections, rejects external fetch/socket attempts, and fails on an unexpected second authoring response. Browser storage is isolated from the user's saved projects.

Screenshots in that directory show the independent estate master plan and each building's individual floors. They must not be described as screenshots of the recovered paid plan.

## Remaining genuine planning problems

For the missing paid response: unknown. Fixing the reported vocabulary mismatch is not evidence that every room, entrance, route or allocation in that response was coherent.

For accepted plans: localized room allocation/adjacency diagnostics remain visible and editable; no auto-repair moves them. Unsupported equipment, site-feature construction and omitted heights require later explicit decisions. Invalid references, malformed boundaries, invalid surface contacts, unsafe water crossings and core out-of-site geometry continue to block acceptance.

## Validation

- Focused plan/site/production-route regressions: **42 passed** in 3 files.
- Full suite: **2389 passed, 3 skipped, 0 failed** (195 test files passed; 2 skipped). Live provider/database tests remain skipped.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npm run lint` passed.
- Optimized production build: `next build --webpack` passed in an isolated source copy, with cached fonts and external network blocked.
- Production browser regression: accepted the independent fixture; rendered the estate and all 3 building/storey views; localized room error remained visible/editable; edit/save/undo/redo/reload passed; unrelated sentinel project unchanged; no 3D canvas; one offline plan response; zero exterior/repair responses; zero external calls; no browser errors.
- Exact offline response bytes and SHA-256 matched the immutable production capture (this assertion concerns the independent fixture, not the missing paid output).
- Whitespace: `git diff --check` and an explicit scan of new source/evidence files passed.

[Machine-readable validation results](first-live-plan-geometry/validation-results.json), [production UI proof](first-live-plan-geometry/proof.json), [build log](first-live-plan-geometry/production-build.log), [focused test log](first-live-plan-geometry/focused-tests.log). The initial sandbox listener restriction was resolved by running the same isolated localhost test with the required execution permission; it is preserved separately in `initial-sandbox-listener-failure.json`. The test server intentionally had no shared database or real credentials; its usage-log warning did not affect response capture or UI persistence.

Offline example screenshots:

- [Estate master plan](first-live-plan-geometry/01-offline-estate-plan.jpg)
- [Residence ground floor](first-live-plan-geometry/02-offline-crescent-house-floor-0.jpg)
- [Residence upper floor](first-live-plan-geometry/02-offline-crescent-house-floor-1.jpg)
- [Atelier ground floor](first-live-plan-geometry/02-offline-orchard-atelier-floor-0.jpg)
- [Editable local diagnostics](first-live-plan-geometry/03-local-diagnostics.jpg)

## Additional calls and restrictions

No additional Terra/OpenAI call was made. None is needed to fix or verify this geometry boundary. Recovering the exact missing design requires an existing response capture; a new generation would be a different design and would not close the evidence gap. No V2 or terrain implementation changes, commits, pushes or deployment were performed.
