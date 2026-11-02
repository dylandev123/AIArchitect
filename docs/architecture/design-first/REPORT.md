# Architectural planning before construction

**Generate now selects a spatial proposal in one provider response, then constructs it in a second response through the existing operations engine. Independent architectural improvement is unverified. No paid calls were made.** The original 776 m² mansion and earlier houses remain unchanged. This is a design-contract and workflow improvement, not evidence of an exceptional new house.

1. **Why the retained mansions are simplistic: observations and limits**

   Reviewed the [original report](../complete-mansion-2026-10-30/REPORT.md), exact provider request and response, retained preflight instructions/schema/retrieval, programme, all 23 authored operations and their expansion, geometry and all four original images. Compared the [510 m² rejected estate](../physical-programme/REPORT.md) and [952 m² Water Court](../architectural-bottleneck/REPORT.md), including their aerial captures. The original evidence remains the authority; this investigation does not rewrite its verdicts.

   | Retained response | Actual composition | Programme/design limitation |
   |---|---|---|
   | 510 m² Tidal Court | 18 × 11 m salon, six 8 × 6.5 m suite shells, separate curved lounge | More individual suite envelopes, but defective roofs/circulation and unfinished accommodation. Rejected construction remains rejected. |
   | 952 m² Water Court | 28 × 14 m central hall plus matching 14 × 20 m wings | One storey, broad roofs, lightly developed elevations; area supplies much of the perceived ambition. |
   | 776 m² Azure Courtyard | Same 28 × 14 m hall, two matching 12 × 16 m wings | Two three-suite capacity reservations, 3 m slab gaps without constructed links, shallow rear terrace, weak waterfront elevation and planting beds without planted volumes. |

   These are gross slab figures, not certified usable/net room areas. The different briefs/settings prevent a controlled causal comparison. Similarity does not prove memory reuse.

   **Proven:** ambition is already limited in the returned plan. Azure chooses a low campus, symmetric private envelopes and grouped accommodation. Its circulation prose explicitly avoids an upper occupied level to avoid unresolved stairs. Its six-suite capacity reservations and 791 m² demand versus 776 m² construction already appear upstream. The first three operations construct those selected wings. No richer selected mansion was subsequently flattened by execution or rendering. The actual arrival and garden images agree with the geometry: simple frontage, a small canopy and broad opaque rear wall, separated pavilions and undeveloped landscaping.

   **Proven instructional pressures:** exterior guidance explicitly said not to construct individual bedrooms and to defer subdivision; its schema asked for names and grouped floor/enclosure/access references rather than dimensioned individual zones. Generate also prioritized “safe retained construction over planning prose.” Those are real contract choices that permit capacity-only results and emphasize construction success. They are not a numerical reward function, and the instructions also requested sophisticated proportions, developed elevations and a memorable entrance. It would be inaccurate to say the prompt demanded three boxes.

   **Proven capability mismatch:** old design guidance said there was no editable planting/tree kind. The semantic capability reference already permits plant/tree representations through editable volumes. This conflicted with the model's unsupported planting claim. Distinguishing editable plant masses from species simulation is now explicit.

   Retrieval was not missing the brief: its eight selected records include the US$25m–50m qualitative ambition reference, waterfront estate, infinity pool, tropical envelope, estate composition, living view and two roof/arrival recipes. The ambition record explicitly encourages bespoke arrival, deep facades, spatial complexity and private suites without prescribing size or storeys. Site survey, shore geometry, sun/wind measurements and flood levels were absent and remain assumptions. Their absence does not require matching pavilions or blank elevations. Available profiles, arbitrary yaw/elevations, independent roofs, facade bays, stairs and editable solids were enough for a more developed proposal. The response used 8,467 of 30,000 output tokens and stopped normally; truncation did not force this result.

   **Hypotheses:** one-shot coordinate/construction burden, cheaper helper authoring and caution about validation may favor ordinary compositions. Repeated wing-helper selection demonstrably supplies repetitive shell defaults; its influence on the model's initial concept is not directly observable. Hidden reasoning and the precise cause of choosing three pavilions cannot be recovered from JSON field order. Historical example uptake was documented in the earlier audit; it is not claimed as a newly discovered current cause.

2. **Does one combined response contribute?**

   It is a plausible contributor, not a proven causal finding. Previously a concise concept, numerical demand, programme, coordinate decisions and executable transaction all competed within the same response. There was no independently retained selected spatial design against which later simplification could be measured. Merely placing architecturalPlan first did not establish a separate planning process.

   Separation is warranted as a small, testable intervention: the normal Generate route now requests and validates the selected proposal before requesting any operations. Both stages use the same configured model/reasoning selection, retrieved context, brief and reference pixels. No alternate construction engine, template, operation type, model-default change or external research was added. Refine, Redesign and Complete retain their existing one-response paths. New Generate entails **up to two provider requests**, each capped at 30,000 output tokens with zero retries. The route duration allowance is 360 seconds to accommodate two sequential stages; deployed host/runtime limits still need verification.

3. **What changed in planning?**

   `spatial-proposal-1` requires a selected concept and brief-derived alternative tradeoffs, site assumptions/orientation/arrival, principal geometry, individual spatial allocations, route references, explicit relationships, roof/section, facade/climate and outdoor/landscape decisions. Instructions ask for each requested suite as a dimensioned zone, even when fit-out remains deferred. They ask the designer to justify architecture through spatial relationships, privacy, section, thresholds and solid/open balance. No mandatory level count, roof, symmetry, shape, wing count, palette or minimum area is imposed.

   Exterior scope now permits the selected accommodation boundaries and doorways; it still defers unrequested bathroom/kitchen fit-out and furniture. Plant/tree volume representation is correctly described. The planning stage overrides the construction-output instructions for its own response; it retains the capability vocabulary so it can choose representable forms. Whether the amount of geometric detail in this contract still burdens or constrains model creativity is a live-test question.

4. **How spatial meaning is represented**

   Principal floors, enclosure, roof sections, doors, facade/shading and outdoor components receive stable anchor IDs, world centres, dimensions, yaw, optional profile shape, materials/color, opening and roof/eave decisions. Spaces have separate bounds and floor/enclosure/roof/real-door references. Routes connect space IDs through selected walking-surface/stair/threshold anchors; relationships use the existing adjacent, clear-of, connected, covering, inside, facing and vertical contracts.

   Proposal validation rejects invalid geometry, duplicate/missing references, fixed glazing cited as access, inconsistent supported rectangular relationships, allocations outside floor bounds/datums and overlapping declared constructed spaces. Profile-surface and full route usability remain explicitly unverified. These are geometric consistency checks, not aesthetic scores. Room counts and brief coverage still depend on model planning and review; there is no heuristic bedroom counter pretending to understand the whole brief.

   Accommodation reporting distinguishes **planned accommodation**, **allocated capacity**, **constructed-space intent with unverified completeness**, and **completed usable rooms**. The latter is never automatically certified. A stage label, floor rectangle or shared envelope does not prove distinct suites, bathrooms or usable routes.

5. **Does construction preserve the proposal?**

   The second stage receives the selected proposal and normal operations contract. Server-side fidelity compares surviving geometry against selected anchors in world coordinates, including nested/rotated frames, profile shape, dimensions, openings, finishes and roof choices. It also rechecks declared relationships and space bounds. The proposal is attached from the server's retained first response; construction cannot replace it by echoing different metadata. Additional details are allowed.

   Changed or omitted anchors produce an explicit divergence and an **unapproved recoverable draft**, with no automatic simplification, repair or retry. Existing atomic construction, relationship, editing and preservation checks remain active. Unsupported decisions must be named; a disclosure does not waive a missing geometric commitment. Both stage evidence and usage are retained separately. Historical output replay remains available without requiring a retroactive proposal.

   This demonstrates preservation of **encoded geometric commitments**, not complete architectural fidelity. Design prose, absent commitments, room enclosure/independence, route clearance/headroom, engineering and complex profile surfaces are not all automatically verified. An ordinary first-stage design can still be faithfully constructed. A good proposal cannot be guaranteed by a fidelity check.

6. **What offline evidence demonstrates**

   [Offline evidence](offline-evidence.json) retains unfiltered existing findings and hashes of the original mansion request, response, operations, programme, scene and four images. Original mansion operations replay to equal persisted element values; property-key order and absent versus undefined optional keys are not geometry changes.

   | Contract case | Source | Elements | Demonstrated result |
   |---|---|---:|---|
   | Compact family | Existing final family response | 47 | Compact geometry retained; changed geometry and omitted entrances detected. |
   | Waterfront composition | Existing developer study | 193 | Multiple heights, recessed upper enclosure, rotated subordinate volume, separate portal, roof layers and outdoor components preserved. |
   | Constrained multilevel | Existing narrow-lot response | 57 | Different IDs/dimensions, upper level and profiled stair void retained; actual-surface/headroom findings remain. |

   The proposals in these cases are deliberately derived from existing scenes. They test transport and fidelity; they are not independently designed new houses, provider examples or production templates. No retained mansion was manually redesigned. The developer study proves the contract can retain greater spatial articulation without requiring a compact brief to expand; it does not prove a mansion will independently acquire that ambition.

   SDK tests mock transport and exercise both real route stages, strict planning/operations wire schemas, shared reference pixels, retention, cancellation, invalid planning and construction divergence. Additional tests cover profile-to-box substitution, nested transforms, oversized/overlapping allocations and contradictory relationships. Legacy route tests explicitly isolate planning to preserve their existing construction/edit regression coverage; the new two-stage suite tests actual orchestration.

   Reproduce without paid calls:

   ```sh
   npx vite-node --config vitest.config.mts scripts/design-first-offline.ts
   npx vitest run src/lib/villa/scene src/lib/library/architecture src/app/api/ai/scene/route.test.ts src/app/api/ai/scene/route.providerSchema.test.ts src/app/api/ai/scene/route.designFirst.test.ts
   npm run typecheck
   ```

   **381 tests pass across 54 files** in the [regression results](tests.json); typecheck and focused ESLint pass. Final prompt changes are also covered by the [final focused regression](final-focused-tests.json). No fresh renders are presented as improved model output. Existing scene/history/Undo-Redo/edit preservation tests are included in the regression set. Existing unrelated uncommitted work was preserved.

7. **What fresh output must establish**

   Unverified: whether Terra selects a more coherent or ambitious proposal, individuates the six suites rather than returning capacity, resolves circulation, entrances, exposed elevations and landscape, and translates the proposal without divergence under the response budget. Two stages may increase latency/cost, freeze imperfect early choices, or duplicate coordinate effort. Exact anchor commitments may expose unsupported design choices rather than solve them. The present contract does not certify complete navigation or usable rooms. There is no basis yet for claiming improved beauty, exceptional architecture, reliability or completion.

8. **Controlled experiment readiness**

   The offline workflow is ready for **one separately authorized Generate experiment**, consisting of at most two paid provider requests. [Preparation](PREPARATION.md), [exact brief/request](experiment.request.json) and [offline schemas/context snapshot](experiment.preparation.json) are prepared. Nothing was submitted or scheduled. The preparation snapshot reuses retained retrieval text solely for comparison; actual normal retrieval and both exact provider payloads must be retained if the experiment is authorized.

   Compare the returned proposal first, then construction fidelity and the unchanged arrival/aerial/garden/poolside renders against the 776 m² reference. Report failures even when construction validates. Do not rank by area, operation count or finding count. One result can reveal a specific improvement or failure; it cannot establish reliability or isolate the causal benefit of staging.

   **This task made zero paid calls, database changes, credential changes, commits or deployments. Architectural quality remains unproved.**
