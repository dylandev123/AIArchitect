# Focused final integration check

This is an offline check using the exact retained real Terra Stage 1 and Stage 2 responses and explicitly authored Stage 3–5 mocks. No live run or approval was created or consumed. No AI request, commit, push, deployment or production database change occurred. Previous live state, original provider evidence and the previous 91-element save were hash-checked unchanged.

## Verdict

**The complete supported automatic workflow passes offline after two focused integration corrections.** It produces a 93-element editable scene, validates it, saves it and reopens it in normal Studio. This is integration evidence, not the next real milestone: Terra has still never supplied real Stages 3–5 for this house. The next experiment must obtain all five decisions from Terra without a retained-response/mock substitution.

The old **91-element** scene was physically valid under existing checks, but was not a complete intent-preserving result. It had one real pool plus an unrelated retained `garden-pool` pad, with no explicit relation between them. Its lawn-only landscape also omitted the brief's planting. Neither issue should have been treated as proof of a complete architectural design merely because compilation succeeded.

## Pool intention and one physical construction

The unchanged Stage 2 output becomes canonical `garden-pool` after identifier normalization. Its original role, 5 × 5 m conceptual footprint, host, side and stable ID remain in `openSpaces` through all stages. Intermediate pad previews are explicitly labelled as a **pool intention reservation, not a constructed swimming pool**; there is no water before Stage 5.

Stage 5 now explicitly links its existing single pool assembly using `pool.sourceIntent`. If the assembly/deck differs from the conceptual footprint, it must supply `pool.intentResolution`. These are binding/decision metadata on the existing pool contract, not a new geometry feature. References are normalized and resolved under the same collision/reference protections. Missing, wrong-type, unresolved or multiply claimed pool intentions stop validation.

The pool compiler still uses the existing rectangular-pool assembly and its stable element IDs. The original intention ID is retained in the specification and pool assembly aliases. Once a valid binding is constructed, the old pad is not rendered again. Exactly one water surface, its basin floor and four basin walls are required. The final scene contains **one** pool assembly and **no** `open-garden-pool` pad.

A genuine placement decision is necessary: the 5 × 5 m conceptual pad cannot contain the existing assembly's minimum full-deck envelope; the mocked 5 × 3 m water choice occupies 8.2 × 7.4 m including apron/coping/decks. The mock Stage 5 explicitly places that single assembly at x=8, near-apron z=10, explaining its clearance from the house and original conceptual footprint. This change is not chosen by the compiler. The original footprint is not erased. Real Stage 5 must make and record its own decision; no rule silently shifts geometry to make it pass.

## Architectural requirement audit

The checks combine semantic room/source data with actual constructed scene components and the existing physical validators. Names or element count alone do not establish completion.

| Requirement | Old 91-element result | Corrected offline result |
| --- | --- | --- |
| Bedrooms | Three partitioned, linked rooms | Three; all retained through exterior/site stages |
| Bathrooms | Two 9 m² rooms | Two; both are en suites in this mock programme |
| Kitchen/dining/living | One of each, linked open-plan | Preserved: kitchen ≈65.7 m², dining ≈60.3 m², living 90 m² |
| Circulation | Foyer and private hall; reachable room graph | Preserved and revalidated; bedroom privacy links remain solver-valid |
| Floors/roofing | Ground slabs; three exposed-volume roofs plus veranda/canopy roofs | All required slabs and roof components present; pitched hierarchy retained |
| Covered veranda | One roofed veranda | Same accepted ID, host, side and footprint; roof and deck required |
| Pool | One water/basin assembly plus unrelated intention pad | One explicitly bound pool; no duplicate pad; basin floor/walls verified |
| Terraces | Terrace, veranda/court and pool-intention pad | Real limestone terrace and existing veranda/court hardscape preserved; conceptual pool pad no longer counted as terrace |
| Planting | Lawn only; no planted components | One existing canopy-tree assembly and one existing planting-bed component, plus lawn |

**Simplified but present:** rooms have boundaries, openings and circulation, not kitchen appliances, toilet fixtures, plumbing systems, beds or furniture. Roofs, veranda columns and materials use the existing editable components. The tree and planting bed are schematic geometry; the visible tree crown is a simple block form. This is not a furnished or photorealistic house. Both bathrooms are en suite; the mock programme has no shared guest bathroom, an architectural-quality limitation despite meeting the requested counts. Sparse planting and simple window/facade treatment limit aesthetic quality.

**Missing before this correction:** an explicit preserved pool identity/resolution and actual planting. Those were design/integration omissions, not a renderer-fidelity limitation. No new renderer, vegetation asset, kitchen feature or generation engine was added; the mock uses existing supported tree/bed components.

## Preventing silent feature loss

The existing production pipeline now runs a focused completion audit alongside its existing schema, room, massing, roof, site and relationship validators:

- Retained covered-veranda intentions require a built veranda with the same ID, host, side and accepted footprint. A later role mention such as “terrace adjoining the veranda” remains a terrace; the first architectural noun identifies these existing outdoor types.
- Retained terraces must still have constructed terrace geometry.
- Retained pool intentions must resolve to the one actual Stage 5 pool, with explicit explanation of a changed conceptual footprint. A resolved pool cannot also retain the old rendered pad or lose its identity alias.
- Explicitly requested kitchen/dining/living rooms must exist; constructed room boundaries, ground slabs, exposed-volume roofs, veranda roofs/decks, actual water/basin and declared planting/site components must be present in the scene.
- A brief requiring planting cannot be satisfied by a bare lawn alone.

Negative tests remove a veranda, omit pool binding, omit the measured pool-resolution explanation, relabel away the kitchen, or remove a roof, slab, terrace, pool water/basin wall, planting bed or tree from an otherwise valid scene. These fail the completion audit. Stage rejection preserves the last accepted checkpoint and does not dispatch a correction. Geometry syntax remaining valid does not override a missing architectural feature.

This is a bounded audit of supported rooms/components and explicit intentions. It is not a general natural-language style judge or a promise that every sentence of design prose can be mechanically proved. Aesthetics and unrepresented requirements still need visual/model evaluation. Existing physical tolerances, security, ownership, reservations, five-call cap, zero retries and US$1.40 policy are unchanged.

## Stage handoff sufficiency

Real LiveDesigner request builders are inspected and tested, not a separate test-only prompt flow:

- **Stage 3:** original brief and accepted concept/massing, canonical component IDs, complete roles/intentions, fixed enclosed dimensions/coordinates/areas, same-level adjacency, stacking, bedroom/bathroom requirements and typed outdoor intentions with construction responsibility.
- **Stage 4:** all of the above plus actual solved rooms and free exterior wall runs; accepted programme connections/stairs remain in prior slices. Retained veranda/terrace identities are explicit and cannot be dropped.
- **Stage 5:** accepted roofs/exterior, solved room geometry and walls, constructed building/veranda/entrance obstacles and typed pool/terrace intentions. Pool concepts are separated from hard obstacles; they are not mistaken for already constructed pool decks. A datum example explains near-apron z and the complete assembly envelope. The schema/instructions require sourceIntent and an explicit resolution of any changed conceptual footprint.

Tests assert that the real downstream requests contain `garden-pool`, its original full architectural role, `social-main`, measured 24 × 9 m geometry, adjacency, constructed room IDs and Stage 5 pool-binding/datum instructions. Actual SDK transport tests run all five provider contracts offline and preserve full requests/responses/checkpoints. The worker drives the same server service used by live execution.

## Proof, preservation and next experiment

[feature-audit.json](feature-audit.json) records old/new inventories, room dimensions, intentions, physical findings and explicit simplifications. [completed-mock-downstream.save.json](completed-mock-downstream.save.json) is the reopenable new 93-element artifact. Stages and normalization logs are separate files here; prior evidence was not overwritten. The isolated browser workflow uses normal Studio progress, automatic completion, final editable import, refresh, save/reopen, failure recovery and cancellation. External browser traffic is blocked and provider outputs are mocked/replayed.

[next-live-requirements.json](next-live-requirements.json) prepares the exact requirements only, with the full known Mediterranean brief and current policy hash. It creates no project, job or approval. A future experiment requires explicit approval of that exact brief and a US$1.40 maximum, five Terra calls maximum, zero retries/corrections, one new owned project and one single-use project-bound authorization. Cold-start the updated development server and verify worker health. All five stages must be new real Terra responses; no replay, mock-assisted acceptance or reuse of a historical approval. Stop at the first failure/uncertain outcome, preserve all evidence, and require final feature/physical validation plus save/reopen before calling it complete.

Final checks: **23 suites / 208 tests passed**, typecheck, targeted ESLint and production build passed. Normal Studio browser verification passed automatic progression, editable completion, save/reopen, failure preservation and cancellation, with zero page errors or paid calls. See [verification.json](verification.json), [tests.txt](tests.txt), [build.txt](build.txt) and [browser.json](browser.json). All protected state/evidence hashes remain unchanged.
