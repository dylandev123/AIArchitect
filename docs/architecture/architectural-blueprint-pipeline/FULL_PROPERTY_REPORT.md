# Full-property blueprint construction and default-off production route

The subsequent [production reliability audit](PRODUCTION_RELIABILITY_REPORT.md) records stronger preflight/component checks, safe flag diagnostics and offline tests through real SDK parsing. Counts below describe this earlier milestone.

20 October 2026, America/St_Lucia. The normal V3 generation endpoint now has a blueprint-only branch: one independently authored design is validated and deterministically constructed into the existing editable scene. **The branch remains disabled. No Terra/OpenAI requests, paid generations, V2/terrain changes, environment changes, commits, pushes or deployment were made.** Existing uncommitted work was retained.

This expands the [original offline proof](REPORT.md); it does not turn its synthetic designs into evidence of natural-model reliability. The executable [contract](CONTRACT.md) describes the current boundary.

## 1. Blueprint feature coverage

Classification describes physical construction from the independent contract, not whether an editor can store a feature's name. **A** = fully supported within the stated boundary; **B** = existing builder needs explicit blueprint fields/mapping; **C** = new deterministic construction/capability required; **D** = additional authored creative decision required. Every supported design still needs Terra to choose its architectural intent; D identifies choices construction cannot fill in. “Before → now” records the actual integration change.

| Architectural feature | Before → now | Construction evidence and boundary |
| --- | --- | --- |
| Flat site and estate layout | A → A | Fixed site extents/datum, actual member footprints, reservations and canonical route corridors; bounds/obstacles checked. No terrain extension. |
| Main and detached secondary buildings | A → A | Nested building/storey/space geometry lowers into ordinary masses and hosted roofs, with stable identities. Independent buildings need real entrances and program entries. |
| Curved and unusual footprints | A → A | Clockwise connected line/arc outlines, complete circles, irregular polygons and articulated operations; real slabs/walls/compatible roof outlines, not placement boxes. No holes/splines/per-storey outline changes. |
| Storeys and major functional spaces | A → A | Ordered uniform-height storeys, finished-floor datums, rectangular contained room regions; building height/count derived. A room name does not produce enclosing walls or equipment. |
| Explicit interior partitions and doors | A → A | Existing shared-room-boundary construction, explicit partition/opening types and IDs. No automatic private/service topology. |
| Openings and entrances | A → A | Explicit doors/glazed doors/windows on wall/segment fractions, actual local levels; contacts derive from the chosen opening. Missing facade opening decisions now fail instead of invoking presets. |
| Compatible roofs | A → A | One hosted flat/floating-flat/terrace/mono-pitch roof on supported outlines; hip/gable/butterfly on compatible rectangles. Roof position/envelope/bearing derive from its host. No independently positioned roof copy. |
| Stairs and lifts | A → A | Existing treads, landings, floor cuts, guards and lift shaft/cab; reservations/served levels are authored. Stair orientation/type/turn must now be explicit. Physical acceptance follows planning. Both stair and lift are exercised. |
| Pool and dry outdoor deck | A → A | Existing basin/water/shell/coping and real deck cutouts; dimensions/locations/material intent authored once. Equipment and flush accessibility are not invented. |
| Courtyards | A → A | Existing perimeter ring with fixed builder finish. A courtyard label does not construct a solid paved court. |
| Covered outdoor living: canopy/pergola | B → A | Added explicit feature mapping and mandatory solid/slatted choice. Existing canopy/post/header/slat builder emits real geometry. Minimum supported sizes and builder policies are checked/documented. |
| Porticos, shade structures and colonnade rhythm on facades | B → A | Added nested slab/post/beam/railing assemblies, addressed in host-local facade/segment space. Intent labels alone are refused. Profiles, custom capitals and ornamental orders remain C. |
| Upper balconies, including curved slabs/guards | B → A | Same existing assembly builders and actual walkable-door checks. All authored parts and each requested guard edge must appear in the compiled result. |
| Arrival, paths and driveways | A → A | Explicit boundary gate, named entrances, dry-surface local contacts, authored bends/width/use; V3 derives ribbons, normals and compatibility bounds. No autonomous route search. |
| Landscape zones | A → A | Real grass groundcover and reserved/derived extents. Trees, shrubs and planting layouts are C/B depending on future explicit equipment/asset mapping; “orchard” alone constructs no trees. |
| Primary materials | A → A | Material identity resolves to current owners; wall/roof/terrace/water colours and supported PBR values. Fixed courtyard/groundcover/pool/assembly subpart policies remain explicit limitations. |
| Bespoke assembly finishes, shared roof datum groups, explicit stacked/hosted mass contracts | B → B | Some editor/builders already support these, but independent lossless construction/check-out needs additional fields, preservation mappings and tests. They remain refused rather than silently dropped. |
| Variable storey heights, curved room boundaries, roof holes/domes/vaults, general roof intersections, arbitrary site equipment | C → C | Current independent builders cannot faithfully construct these combinations. Domes are unsupported even if their name can be stored. |
| Site composition, room/privacy/service layout, doors, stair orientation, roof family, amenities, finish selection, route detours | D → D | Terra must author these once. No planner chooses them, adds a luxury checklist or substitutes a fixed house template. |

## 2. Construction integrations completed

[`architecturalBlueprint.ts`](../../../src/lib/v3/architecturalBlueprint.ts) now maps facade assemblies and covered outdoor features into the established V3 semantics/builders. No alternate mesh engine, detailed-scene contract, persisted sidecar or duplicated author coordinates was added. Host movement/curvature drives assembly placement. Optional terrace railing/open edges also survive construction/check-out.

Planning rejects empty assemblies, empty guard edges, broken rail/slab references, nonexistent storeys/segments and undecided canopy/stair/facade choices. Articulated attachments reuse the plan-only `assemblyWallOffset` extracted from the existing footprint builder: the same actual wall-plane/recess-shoulder rules govern planning and construction. No arbitrary relocation is introduced. Full construction additionally verifies each assembly part/guard edge by its exact emitted identity, as well as the pre-existing object/roof/entrance/semantic-preservation gates.

A real integration defect was found in `completeness.ts`: explicit `serves` checked only the first tangent strip of a curved balcony. It now checks all strips belonging to the named surface. This corrects access evidence without changing geometry. A regression fixture places the door away from the first strip and proves it remains connected; erasing one actual guard edge still rejects the scene.

## 3. Production route and real design authority

The server-owned flag is **`AI_V3_ARCHITECTURAL_BLUEPRINT=1`**, requiring flat terrain mode and a new V3 generation request. It is unset/off in normal operation. If both blueprint flags are selected, the independent branch takes precedence for that request. Advanced generation, V3 edits, legacy scene generation and scene loading retain their previous paths.

The branch in [`route.ts`](../../../src/app/api/ai/house/route.ts), orchestrated by [`architecturalBlueprintGeneration.ts`](../../../src/lib/v3/architecturalBlueprintGeneration.ts), runs:

`user brief → one Terra blueprint-only response → strict input/decision/spatial planning → in-memory approval → existing deterministic V3 elaboration → full construction/consistency validation → ordinary editable project JSON`

The JSON-mode prompt transmits the blueprint JSON schema and the supported construction policies. Zod refinements still run locally. It explicitly prohibits `objects`, runtime transforms, independently positioned roofs, duplicated path boxes and a second complete scene. Unknown top-level scene fields are rejected. Building height, outlines' envelopes, roof placement, route contacts and derived compatibility bounds remain projections of the one input. The successful provider budget remains **one call**, with the same **10,000 output-token cap**.

The existing maximum one objective follow-up may repair only diagnosed stair reservation/type/direction/turn or route waypoints. A local preservation comparison protects all other fields, IDs, hosts, served levels, endpoints, widths/use, materials and requirement commitments. A consequent unreachable-storey finding is repairable only for a specifically diagnosed stair in that same host. Reordering/restructuring protected data is conservatively refused. No missing entrance, room, roof, amenity, material choice or style is supplied by repair. There is no third call, separate elaboration request, aesthetic revision or fallback scene generation.

Planning/construction/repair failures return structured findings and **no `json`, model or failed saveable preview**. The client cannot commit a partial property through its normal success path. Truncation/invalid JSON stops without another attempt. Usage records retain stage/retry attribution, successful metadata sums both attempts, and final rejected candidates use the existing development-only failure-artifact facility. Known explicitly unsupported roof requests are rejected before spending a call; this vocabulary check is limited and may conservatively reject nuanced descriptions.

## 4. Creative decisions still required from Terra

Terra must choose the whole brief-specific program, scale, site composition, each real footprint/storey/space, private/service boundaries, doors, entrances, compatible roof family, landscape territories, outdoor amenities, material identity, circulation reservations and obstacle-avoiding path bends. Assembly spans/depths/levels and the choice between solid canopy and slats are also design input. V3 supplies deterministic construction policy, not architectural invention.

The authoring prompt states these obligations. Known missing construction decisions fail. The existing independent brief-feature review also rejects recognized omitted requested features, without paying for another creative stage. **That review is not a general natural-language constraint verifier.** Its vocabulary is limited, some existing checks use semantic labels, and it cannot prove a model captured every user-specified room/count/privacy/budget/style commitment. Natural-model requirement coverage needs independent human review during any controlled trial.

## 5. Unsupported features and honest limits

No support is claimed for arbitrary complete furnished homes, automatic private-room enclosure, engineering/code certification, full navigation/egress/privacy proof, site grading, threshold ramps/steps, planting equipment, custom pool access, spline/holed outlines, unequal per-mass storey heights, stacked-mass independent round trips, shared roof groups/intersections, domes/vaults or arbitrary site amenities. Additional existing editor capabilities do not imply blueprint support.

Assemblies use the existing builders' host paint/surface policy, dark posts/beams and glass guards; custom per-part materials are not implemented. Solid canopies keep the existing two-post policy; slatted canopies use four posts and derived slat spacing. The resulting geometry implements those declared policies, not structural engineering. Regions labelled bedrooms remain functional regions unless explicit enclosing partitions/doors were authored. The fixture deliberately retains that original open major-space design; it is not evidence of a finished private household interior.

## 6. Offline end-to-end acceptance

[`fullPropertyBlueprint`](../../../src/lib/v3/parity/fullPropertyBlueprint.ts) is an explicitly authored offline extension of Crescent Lantern, imported only by tests/dev rendering. It adds an upper curved balcony with a corresponding sliding door and guards, the detached atelier's portico, and a slatted room on the dry portion of the pool deck. The resulting property has **13 editable objects and 154 construction primitives**. No generation path imports this fixture.

The tests cover one mocked provider response through the actual production endpoint, explicit pre-compilation rejection, bounded repair and redesign rejection, malformed/truncated output, omitted brief features, detailed component failure, default/advanced legacy routing, lifts/solid canopies, actual project-store serialization with in-memory storage, material edits, host edits and reload. A blocked stair/resolved route must pass full validation again. No test makes an unmocked authoring request.

The four unchanged Canopy/Cloister initial/repair responses remain rejected by their production ingestion checks and unsupported for lossless blueprint checkout. The existing four independent circle/articulated/rectangular/curved designs remain covered. Recovered failures were not rebranded as successful full-house model responses, patched into blueprint fixtures or silently stripped of detail. They demonstrate real provider failure modes; independent fixtures demonstrate deterministic capability, not generation success rate.

[Seven inspected WebGL captures](full-property-webgl/capture.json) use production `PrimitiveMesh`, PBR/edge finishing, environment, sunlight/shadows and `PostFx`. They show the [estate](full-property-webgl/estate.jpg), [curved balcony](full-property-webgl/balcony.jpg), [portico](full-property-webgl/portico.jpg), [pool/pergola](full-property-webgl/outdoor.jpg), host movement, material edit/reload and interior section. There were zero page errors and zero attempted provider/project API calls. The renderer read existing assets. Existing Three.js clock/shadow deprecation notices remain. These images demonstrate geometry/placement and declared assemblies; they do not establish exceptional aesthetic quality or finished interiors.

Final verification: **148 focused tests passed; 2,192 full-suite tests passed, 3 skipped, across 181 test files. TypeScript, ESLint with zero warnings, `git diff --check` and new-source whitespace checks passed.** [Focused tests](full-property-focused-tests.json), [full tests](full-property-full-tests.json), [checks](full-property-checks.json), [construction proof](full-property-proof.json) and [preservation hashes](full-property-preservation.json) record the evidence.

## 7. Editing and backward compatibility

The saved authority remains the ordinary `V3Scene`. The blueprint input/approval is not stored alongside it. Stable building/opening/roof/assembly/part/route/storey/room identities survive construction, host movement, material edits and JSON/project-store reload. Replanning recomputes derived host roof/routes/assemblies together and preserves unrelated local edits. Same-field concurrent edits remain atomic conflicts.

Checkout now retains supported assemblies, canopy style and terrace options; unsupported semantics still refuse lossless export. Existing legacy scenes are not migrated or rejected at load time by the new blueprint gate. The nine saved-scene construction baseline hashes and existing feature baselines pass unchanged. The pre-task file hash inventory confirms the baseline fixture JSON and original recovered responses were not altered. Existing unrelated working-tree edits were preserved. Only the new workflow imposes the additional completeness checks.

## 8. Cost and reliability risks

The compact expanded blueprint is **10,505 JSON characters**, approximately **2,627 output tokens** using characters/4. The transmitted instructions plus JSON schema are **28,644 characters**, approximately **7,161 input tokens**, before the user brief/provider overhead. These are reproducible serialization estimates, not a real tokenizer, billing, latency or model-success measurement. The original independent examples span approximately 668–2,229 estimated output tokens.

Using only the repository's configured Terra coefficients ($2/M uncached input, $12/M output), 7,161 input plus 2,627 output tokens estimates **$0.0458** for this one-call example. This is not a verified current provider price. A similar-sized repair repeats the full blueprint and diagnostics, so roughly 10k input + 2.6k output would add about **$0.0515**, for about **$0.0973** total; actual size/cache/reasoning use can differ. No cost was incurred here. A pair reaching both 10k output caps could cost materially more even though the call count is bounded.

One call is technically sufficient for the **supported explicit property subset**: every demonstrated construction decision is in the one input. It is unproven for arbitrary full-house briefs, large private-room programs, complex assembly lists or natural-model fidelity. Larger complete designs may exceed 10k output tokens; the route rejects truncation rather than silently accepting an incomplete property. Missing/unsupported decisions stop early instead of buying elaboration. Stricter validation may reduce acceptance and increase user-initiated retries/cost; the one automatic repair remains bounded, but repeated user submissions are not a session-wide cost cap.

Key reliability risks remain model omission of requirements, wrong IDs/host addresses, JSON/schema verbosity, geometric contradictions, hidden semantic inference in existing policy, conservative rejection of repair reserialization, and incomplete coverage of real construction/navigation constraints. Neither 154 primitives nor the test count estimates the chance of a real model producing an acceptable estate. Both recovered mansion pairs still fail. A second provider call would not create unsupported construction capability and is not introduced.

## 9. GO / NO-GO

**GO for the offline integration milestone and for separately authorized, capped, human-reviewed provider experiments restricted to this supported contract. NO-GO for broad flag activation or a claim of reliable arbitrary full-house generation.** The task's provider prohibition remains in force: no live or paid experiment was run or enabled.

Controlled evaluation would need independent brief/room/service/privacy review, untouched raw responses with token/finish/failure accounting, human architectural review of production renders, and reporting of first-call and after-repair acceptance separately. Missing decisions must remain visible failures. Full private interiors, bespoke assemblies/site equipment and unsupported forms remain future capability work. The default flag stays off until those evaluations justify a narrower rollout.

Reproduce offline:

```sh
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
# Local dev server only; capture blocks AI/provider and project APIs.
PLAYWRIGHT_DIR=<existing-installation> node scripts/full-property-blueprint-capture.mjs
```
