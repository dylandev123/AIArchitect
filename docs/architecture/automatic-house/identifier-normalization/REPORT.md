# Identifier resilience and actual Terra massing replay

This is an offline implementation and evidence replay. The stopped Mediterranean live run, original single-use approval, usage and raw provider evidence remain unchanged. No paid request, live retry, new real approval, commit, push, deployment or production database change was made.

## Actual Stage 2 findings

The original response contains six underscore identifiers. Its original schema diagnostics reject `blocks[0].id` through `blocks[5].id`. This was not the only construction blocker. A replay changing only those identifier spellings reached the real compiler, which rejected the private-wing role copied into `elements[1].aliases[0]`: the actual private-wing role is 95 characters and is permitted to contain up to 200 characters, while a scene alias is limited to 80.

The adapter now bounds the short **scene alias** to 80 characters, as it already did for open-space aliases. The complete architectural role remains unchanged in the authoritative specification and original response. Component IDs, geometry, room decisions, coordinates, support rules and physical constraints are unchanged. This is a compiler metadata mismatch, not a different house or relaxed geometry validation.

With both corrections, the unmodified retained real Stage 1 response and real Stage 2 response pass the existing pipeline. Stage 2 creates **six editable elements: three enclosed massing volumes and three open-space pads**, with stable component identities. All coordinates and sizes match the original response; all massing findings are empty. No additional overlap, boundary, connectivity, support or open-space attachment failure was found for this actual massing.

A semantic limitation remains: Terra labelled one `open:true` mass `garden_pool`. Stage 2's contract only constructs open-space footprint pads, not pool water, basins or decks. This intent is now reported as a non-blocking reservation warning. It is not proof of a completed pool or a resolved Stage 5 design. No pool was silently invented or moved by normalization.

## Every change to the real response

| Original | Canonical |
| --- | --- |
| social_main | social-main |
| private_wing | private-wing |
| arrival_entry | arrival-entry |
| garden_veranda | garden-veranda |
| limestone_terrace | limestone-terrace |
| garden_pool | garden-pool |

These six identifier replacements are the only model-payload normalizations in the real Stage 2 replay. Stage 1 needs no formatting change. Its full original response, the Stage 2 raw string and provider envelope remain byte-for-byte retained. The separate short-alias adaptation affects compiler display/search metadata only.

## Normalization boundary and safety

A shared normalizer works on a clone of each stage payload. It changes only underscores to hyphens in declared identifier fields and their typed references/keyed maps. It does not change descriptive text, enum choices, dimensions, number types, units, facing choices, materials or architecture. The existing documented Stage 1 `roofColor:null` sentinel is omitted and explicitly logged; no other null coercion is added.

Declarations are checked before references. Duplicate declarations, underscore/hyphen collisions, normalized record-key collisions, duplicate/contradictory programme connections and unresolved references reject the stage. Duplicate raw JSON keys—including escaped equivalent keys—are rejected so parsing cannot overwrite a design decision. Landscape collection IDs are typed by collection, matching existing scene element prefixes; identical canonical names in different collections remain compatible, while duplicates within a collection reject. Accepted stage identities are canonical and references in later stages resolve to those same IDs.

Each change records path, original value, canonical value and reason. Live execution saves those changes in the durable call ledger and checkpoint; exceptions retain attempted changes. Raw provider text and response bodies are never replaced. The complete original stage schema, programme solver, whole-spec validation, compiler and physical validators still run after normalization. Invalid numbers, out-of-range geometry, unknown references and genuine conflicts still stop. There are no correction calls or extra requests.

The live provider uses transport schemas that admit the narrow underscore spelling variant before canonical validation. SDK parsing therefore does not reject the underscore variant before normalization gets a chance to run. Strict internal schemas still require canonical IDs. Offline custom designers pass through the same normalization in the pipeline; reapplying it to an already canonical payload is idempotent.

## Five-contract review

| Stage | Review and resulting boundary |
| --- | --- |
| 1 — direction | Strict provider object. Exact material enums and descriptive length limits remain. Nullable optional roof color is the sole documented sentinel conversion; arbitrary color names, long descriptions and invalid enums are not guessed or truncated. |
| 2 — massing | Now strict provider object, with explicit boolean `open` for every block. Transport IDs admit underscores; canonical IDs and all ranges remain unchanged. Descriptive roles are preserved; short scene aliases are bounded separately. |
| 3 — programme/interior | Strict flat programme schema. Room/block/stair declarations, connection/landing references and legacy plan-map keys are normalized consistently. Counts, areas, room sizes, aspect ratios, adjacency, privacy and stairs remain solver/validator requirements. |
| 4 — exterior | Dynamic roof/facade records remain non-strict provider output; closed nested objects and exact enums still validate locally. Roof keys, facade block prefixes, door IDs/room references, entrance door references and veranda IDs/block references are normalized and checked. Missing/unknown component coverage remains a rejection. |
| 5 — site/finishes | Dynamic finish records remain non-strict provider output. Finish block keys and typed landscape IDs are normalized; footprint, site, basin/deck, collision and scene-element limits remain unchanged. |

Model instructions now state the common 40-character lowercase/hyphen identifier grammar, reuse of accepted IDs, exact material/enum vocabulary, finite JSON numbers without unit strings, and optional-field conventions. The room-ID instruction previously said 39 while the actual maximum was 40; it is now consistent. Strict provider output is enabled for Stages 1, 2 and 3; dynamic map contracts in Stages 4–5 are not misrepresented as strict-compatible.

No evidence justified a general enum synonym mapper, numeric string conversion, description shortening, geometry repair engine or more permissive physical constraints. Those were not added.

## Downstream offline proof

The exact real Stage 1–2 outputs are replayed through the actual private Studio service, LiveDesigner, real SDK wire contracts, existing pipeline, room solver and compiler, intercepting only HTTP responses. Stages 3–5 are explicitly **developer-authored offline mocked responses**, constructed against the corrected real massing. They deliberately contain underscore declarations and references to verify consistent normalization. No fixture house replaces Stage 2's geometry.

All five stages advance automatically, checkpoints save and the completed specification reopens through authoritative scene recompilation. The mock downstream house contains **91 editable elements**, three bedrooms, two bathrooms, solved circulation, roof hierarchy, a covered veranda and a pool. Stage 3 room plans and all earlier block positions/sizes/open spaces remain unchanged through later stages. Independent tests verify collision/unresolved-reference rejection, raw preservation and rejection of a physically conflicting massing while retaining Stage 1.

The mocked downstream changes are fully enumerated in [normalizations.json](normalizations.json): Stage 1 zero, Stage 2 six, Stage 3 thirty-eight, Stage 4 eleven, Stage 5 four. The [SDK replay evidence](sdk-evidence/) includes exact requests, raw responses, normalization logs, diagnostics, accepted geometry and saves, without authentication records. [stage-2.json](stage-2.json) is the actual normalized massing proof; [completed-mock-downstream.save.json](completed-mock-downstream.save.json) is the reopenable offline artifact. Reproduce with `npx vite-node --config vitest.config.mts scripts/replay-normalized-terra.ts`.

The mock Stage 5 selects a separate clear pool location; the original Stage 2 `garden-pool` pad is retained untouched. This proves mechanical integration, not fidelity of a future real landscape decision to the model's provisional pool intent. That semantic coordination and architectural aesthetics remain subjects for a separately approved experiment. Real Terra has not produced Stages 3–5.

## User experience and remaining live limits

Formatting corrections happen internally. Uninterpretable responses show a plain-language stopped message with preserved checkpoints and no retry; raw schema/construction details remain available in an expandable diagnostics panel. Architectural warnings remain separate from normalization. The live run is not reopened or marked accepted by this replay.

The complete supported automatic workflow passes offline. A real model can still make contradictory or unsupported decisions, exceed schema limits or fail to provide an interpretable response. This work proves that the retained underscore-formatted massing can be constructed after a metadata adapter fix; it does not prove a complete beautiful model-authored house, universal prompt fidelity, or real Stage 3–5 success.

No new paid experiment is started or approved here. Any future paid correction or continuation needs explicit authorization for the exact job/stage/budget and an explicit policy decision; the original stopped run remains stopped with its original spending records. Deterministic replay is not used as permission to redispatch.

## Architectural quality and next experiment

The completed offline mock-downstream screenshot shows an L-shaped house with subordinate roofs, readable entry and veranda, and a separate pool. It remains schematic: narrow repeated glazing, simple materials and very sparse landscape detail. It is not proof of a polished final Terra design. The exact massing footprint is real Terra output; all interior/exterior/site decisions in that completed artifact are offline mocks.

Before any future live test, cold-start the development server so its startup worker loads these updated adapters; hot-updated browser/route code alone is not evidence that the running worker changed. Verify worker health and the exact request/schema/policy again. Resolve how the provisional Stage 2 pool pad should be interpreted before claiming fidelity to its pool intent. Keep the stopped live run and ledger untouched. A separately approved new experiment or explicitly approved retained-response recovery would need its own exact authorization; none is created here. Do not rerun Stages 1–2 or dispatch a correction merely because offline replay now passes.

## Final validation evidence

**22 relevant suites / 201 tests passed**, plus the actual-SDK retained-response regression, typecheck, targeted ESLint and production build. The isolated browser workflow passed automatic completion, refresh/save/reopen, failed-stage preservation and cancellation with zero page errors and zero paid calls. Its initial optional subsequent-project scenarios required the browser driver to restore the exact retained brief rather than the UI's default sample; those driver attempts stopped on disabled approval matching and made no real calls. The successful run and screenshots are retained in this directory. [verification.json](verification.json), [tests.txt](tests.txt), [build.txt](build.txt) and [browser.json](browser.json) record the checks.

Final hashes confirm that the real private Studio state and original live evidence remain byte-for-byte unchanged. The real live job is still failed with exactly its two original historical calls and no newly consumed authorization. The offline artifacts are separate from that authoritative live project.
