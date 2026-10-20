# Blueprint-first live mansion failure

19 October 2026. **NO-GO for another live generation.** The second mansion failed a planning acceptance gate that mixes real authored contradictions with false access requirements. It did not fail because Terra returned only two objects, because its JSON was truncated, or because the V3 compiler could not construct its rectangular buildings.

This audit made no Terra/OpenAI requests or paid generations. No provider/model setup, environment values, V2 code, terrain code, saved projects, commits, pushes or deployment were changed. Provider invocations in route tests are mocked.

## 1. Recovery and activation

Both `.v3-debug/failed-attempt-{0,1}.json` slots belong to the latest flat-site generation. Their raw strings parse completely, have `redacted:false` and `omittedForSize:false`, and match their retained SHA-256 hashes. Captures are 19 October at **16:17:49 and 16:18:50 America/St_Lucia** (20:17:49Z and 20:18:50Z). Original byte lengths are 23,007 and 23,558. Complete provider JSON is preserved in `src/lib/v3/__tests__/fixtures/blueprint-cloister-attempt-{0,1}.json`; `recovery.json` preserves capture metadata and historical diagnostics. The 17 October `revision-latest.json` is unrelated and was not substituted for either response.

The exact original user message and transmitted system prompt were not captured. The responses retain user-attributed requirements for a US$15M Saint Lucia luxury estate with creative freedom. The reported approximately 2.3-minute total request duration cannot independently be reconstructed from these two completion timestamps; the repair completion is 61 seconds after the initial capture. There is no retained token usage or actual dollar charge in these artifacts.

**Blueprint authoring and validation were active.** Both responses include a complete version-1 blueprint reference index, and historical `BLUEPRINT_SITE_BOUNDS` / `BLUEPRINT_ENTRY_UNDECIDED` diagnostics prove execution of that gate. Current `.env.local` has `AI_V3_BLUEPRINT_FIRST=1`, which enables the prompt for flat V3 generation. The historical environment flag itself is not recorded in the artifact; a blueprint-bearing response triggers the gate even when the prompt flag is off. Thus gate activation is certain; historical prompt activation is strongly supported but not independently logged.

The blueprint indexes all **5 buildings, 3 designated entrances, 3 stairs, 5 explicit roofs, 8 chosen outdoor objects, 5 estate routes and 2 requirement allocations**. All referenced identities exist after normalization. Its omission of wing entrance designations is advisory. This is a complete index, **not a coherent, separately validated geometric blueprint**.

## 2. Exact rejection and repair quality

The original code reproduces **25 initial errors, then 13 repair errors**, with four advisory warnings on each attempt. The final route returns HTTP 422 after exhausting its existing single follow-up. The final 13 errors are:

- Eight `ESTATE_ACCESS_MISSING` findings: `eastResidenceWing`, `westResidenceWing`, `mainRoof`, `eastWingRoof`, `westWingRoof`, `guestRoof`, `wellnessRoof`, `pool`.
- Five `ESTATE_ROUTE_UNSUPPORTED` findings: `route-driveway`, `route-entry`, `route-pool`, `route-guest`, `route-wellness`.

The first displayed error mentions `program-residence`, but the first missing target is **eastResidenceWing**, not mainResidence. MainResidence does have `route-entry`. The UI text loses this distinction because it shows the message without the diagnostic target IDs. `baseline.json` preserves this pre-fix replay.

The repair improved the measured plan in limited ways: it shrank palmGarden depth from 28 to 24 m, enlarged four zone allocations, and appended the four missing scene relationship edges. Those changes clear the initial bounds/allocation/declaration findings. It kept all building geometry, roofs, doors, stairs, blueprint entries and estate route points unchanged.

It also widened guestPath and wellnessPath **from 2 to 23 m**, moving their box centers toward the arrival court. This is a poor response to two competing representations: those boxes now enclose the intended route region, but the spatial routes still specify 2 m widths and different bent geometry. Once route ribbons construct, those widened boxes do not control the rendered paths. The repair additionally rewrote an unrelated relationship intent sentence. See `authored-repair-diff.json` for every changed field.

The repair was therefore **better on allocation metadata, ineffective on the rejection causes, and worse in the consistency of redundant path geometry**. It is not a successful architectural repair. A separate offline call to the existing objective-preservation assessor rejects it for protected plan/relationship changes and unrelated path geometry changes. Production did not reach that assessment because ingestion had already failed; this is a counterfactual additional barrier, not the historical cause of the 422. The present objective repair scope also does not authorize all relationship additions the planning gate requests. No repair permissions were broadened in this audit.

## 3. Diagnostic classification

All coordinates below are world-space metres. The site is x=[−75,75], z=[−60,60]. Rows grouping multiple IDs give the same classification for every listed target.

| Finding and target | Authored geometry / intended relationship | Assessment |
| --- | --- | --- |
| `BLUEPRINT_SITE_BOUNDS`, palmGarden | Initial x=[−23,23], z=[34,62]; intended in-site water garden. Repair z=[36,60]. | **Correct authoring conflict**, repaired. Not a missing construction object. |
| `ESTATE_ALLOCATION_CONFLICT`, zone-arrival / driveway | Driveway z=[−60,−30], allocation z=[−58,−16]. | **Correct allocation contradiction**; repair expands to [−60,−10]. |
| Same, zone-arrival / entryWalk | Walk z=[−16,−10] leaves that initial allocation. | **Correct allocation contradiction**, repaired. |
| Same, zone-water-garden / palmGarden | Garden ends at z=62, allocation ends at 47. Repair garden ends at 60, allocation ends at 60. | **Correct allocation contradiction**, repaired. |
| Same, zone-guests / eastGarden | Garden z=[11,39], initial allocation z=[−10,24]. | **Correct allocation contradiction**, repaired to z=[−23,39]. |
| Same, zone-guests / guestPath | Initial box x=[30,32], z=[−23,7] leaves allocation; the actual bent route also leaves it, reaching x=15. | **Correct conflict, incomplete geometric evidence**: allocation audit uses the box while compilation uses the route. Enlarged repair allocation covers both; widening the box was unnecessary. |
| Same, zone-wellness / westGarden | Garden z=[13,41], initial allocation z=[−8,26]. | **Correct allocation contradiction**, repaired to z=[−23,41]. |
| Same, zone-wellness / wellnessPath | Box z=[−23,9] and bent route from x=−15 leave initial allocation. | Same representation mismatch as guestPath. Repair allocation covers them. |
| `ESTATE_RELATIONSHIP_MISSING`, rel-court-entry | Plan asks arrivalCourt→mainResidence; scene instead has entryWalk→mainResidence. Geometry supplies court→walk→door at z=−10. | **Correct missing declaration, overstrong evidence of physical absence**. A direct edge duplicates an existing physical approach. Repair adds it. |
| Same, rel-main-roof, rel-east-roof, rel-west-roof | Scene lacks the exact roof→mass `hosts` edges; all three roof objects already have hostId and explicit rests-on support at y=7.2. | **Correct missing mirrored declarations; roofs are present and constructible**. Repair adds edges. |
| `ESTATE_ACCESS_MISSING`, mainRoof, eastWingRoof, westWingRoof, guestRoof, wellnessRoof | Roof components grouped into residence/pavilion programs; no external path terminates on roof objects. | **False destination requirements**, fixed by excluding roof-form components. Actual usable rooftop terraces remain subject to their access checks. |
| Same, eastResidenceWing, westResidenceWing | Wings touch mainResidence at z=2. Compiled access graph proves ground and upper junction passages, and all three masses have usable stairs. | **Overstrict direct-route requirement**. Access through a connected residence is fulfilled; a separate estate route to each wing is not necessary. Still reported by the current gate. A physical access graph should replace this ID-membership test; this audit does not add a graph-only shortcut that could certify sealed walls. |
| Same, pool / program-watercourt | Pool x=[−9,9], z=[26.25,31.75], contained in poolDeck x=[−15,15], z=[20,38]. Route-pool reaches poolDeck; the court and deck connect. | **Overstrict requirement for an estate route directly into water**. Deck approach exists; swimmer entry equipment is not authored or certified. Treat wet access as a separate capability/decision, not a missing garden route. Left explicit. |
| `ESTATE_ROUTE_UNSUPPORTED`, all five routes | Every route repeats its final endpoint in waypoints; entry and pool also repeat their start. All have one exclusive path/driveway owner, flat y=0, and nonzero total length. | **Overstrict handling of redundant coordinates**, fixed. Exact adjacent duplicates are ignored in a shared read-only projection. Collapsed routes, short nonzero segments, ambiguous owners, grade and hierarchy restrictions remain rejected. |
| Newly exposed `ESTATE_ACCESS_POINT_MISSING`, route-driveway / siteNorth | From=[0,0,−60], exactly on north boundary, but `from:"siteNorth"` references no object. | **Correct unresolved reference under the existing contract; intended site-boundary access is clear**. A missing endpoint representation/capability, not absent driveway geometry. No fake anchor object was invented. |
| Newly exposed `ESTATE_ROUTE_BLOCKED`, route-guest / guestPath, guestPavilion | Last segment runs along x=38 from z=−8 to 7; pavilion starts at x=38 and z=2. The 2 m ribbon penetrates the wall footprint for about 5 m². Door itself is correctly centered at [38,0,7]. | **Correct route authoring conflict**. Need an explicit external approach to the door, not a line running along its wall. No automatic detour chosen. |
| Same, route-wellness / wellnessPath, wellnessPavilion | Last segment runs along x=−38 from z=−8 to 9; pavilion ends at x=−38 and begins at z=3. Width penetrates about 6 m². Door is correctly centered at [−38,0,9]. | **Correct route authoring conflict**, unchanged by repair. |
| Downstream `AUTHORED_ACCESS_DISCONNECTED`, guestPavilion/guestPath and wellnessPavilion/wellnessPath, initial only | Initial compatibility boxes stop 6 m short of their pavilion walls, while routed centerlines do reach the doors. Widened repair boxes reach them. | **False door-contact evidence once route geometry is authoritative**. Completeness inspects the box instead of the compiled ribbon. Separate real ribbon/wall conflicts above remain. The representation mismatch needs a shared route-geometry view. |
| `AUTHORED_OPENING_REMOVED`, eastWingLink and westWingLink | Openings lie on shared walls removed for the joined masses. Compiled junctions have actual clear passages at both levels. | **Advisory construction observation**, not loss of wing access. Do not require new exterior doors to silence it. |
| `AUTHORED_ACCESS_THRESHOLD`, main entry/court, wing pool doors, pavilion paths | Mass floor datum is 0.26; surfaces are about 0.06–0.12. | **Correct advisory threshold differences**, not proof the building is inaccessible or grounds for automatic step-free requirements. A step/landing design remains unverified. |
| `ESTATE_REQUIREMENT_UNVERIFIED`, req-budget and arch-cloister | Budget is semantic intent; three joined masses do not certify all aspects of a U/cloister silhouette or roof intersections. | **Correct advisory limitations**, not fatal. |
| `BLUEPRINT_ENTRY_UNDECIDED`, both wings | Blueprint designates main and pavilion entrances, not the shared wing entries. | **Advisory decision/index coverage**, not missing authored doors. |
| `INCONSISTENT_MATERIAL_ZONING`, building group | Different material IDs are authored on related masses. | **Advisory stylistic heuristic**, not a geometry failure. |
| `UNRESOLVED_SUPPORT`, 20 objects; 3 `INTENT_RELOCATED`; `FLAT_SITE_NORMALIZED` | Provider omits support on many objects; roof datum groups relocate to composition; flat policy is applied. | **Normalization notes, not 24 additional fatal errors**. Downstream deterministic support inference works; buildings and roofs are retained. |

The historical final 13 findings thus comprise five false roof destination requirements, two overstrict wing destination requirements, one overstrict direct pool-route requirement, and five redundant-coordinate route rejections. Removing that noise does **not** validate the plan: previously masked boundary-reference and wall-intersection problems remain. The three narrowly scoped fixes leave **18 initial / 6 repair planning errors**, including the three unresolved program-access classification problems described above.

The gate maps every non-advisory estate finding to fatal, whereas ordinary lenient validation treats some estate metadata findings as advisory. This policy magnifies index/representation mistakes. It should not be fixed by making all findings warnings: real corridor collisions and geometric contradictions must remain blockers.

## 4. Where information and authority diverge

| Pipeline stage | What actually happens |
| --- | --- |
| User prompt → concept | Terra creates the Caribbean cloister narrative and program. Exact user prompt is unavailable; retained statements are the evidence. No independent brief-completeness proof exists. |
| Concept → estate blueprint | Same response emits program, allocation rectangles, relationships and an ID index. Blueprint entries contain no coordinates or footprints. |
| Blueprint → detailed scene | Terra independently authors architecture, openings, roof hosts, path boxes, route coordinates and stairs. There is no earlier approved geometric plan feeding these fields. The initial garden/zone contradictions and box/ribbon mismatch arise here. |
| Normalization | All 23 objects, the entire estatePlan including blueprint, all building openings and all 3 stairs survive. No `*_OMITTED` notes occur. Roof datum relocation is semantic preservation. No normalization loss explains this rejection. |
| Blueprint validation | Runs before reference repair, detailed validation, consistency and compiled geometry. Neither response earns blueprintApproval. It can only compare co-emitted claims and geometry; it cannot prove chronology or make geometry follow those claims. |
| Repair | Receives Terra's original raw authored output and coded IDs. Fixes allocations and declarations, leaves duplicate route points and wall-following approaches, and edits irrelevant box widths. One follow-up only. |
| Compilation | Production never reaches final compiled acceptance for either attempt. Forced investigative compilation constructs shells, roofs, stairs and, after the duplicate-point fix, all five route ribbons. This is not an acceptance override. |

**The blueprint is principally checked afterward, not used as construction input.** The compiler already deterministically constructs architecture fields, footprints, roof intent, openings, stairs and route ribbons. What is missing is a single canonical geometric planning artifact that constrains elaboration and is also consumed consistently by allocation, access, preview and construction checks.

The initial response already fulfills the five-building hierarchy, joined main residence, correct north main approach, three real entrance wall addresses, five hosted roof families, three usable vertical connections, contained pool and indexed outdoor program. Seven of eleven exact planned scene relationship edges exist initially; all eleven exist after repair. The buildings/roofs are not missing. The guest/wellness approach geometry is invalid, siteNorth is unauthored, and precise equipment/landscaping/luxury-quality claims are not certified. The named eastLinkDoor/westLinkDoor `serves` references also point toward the opposite wing from their actual south-facade spans; geometric junction construction happens to preserve passages. This is another example of labels/references disagreeing with geometry, not a reason to move buildings.

## 5. Failed preview and comparison with earlier mansion

Only **driveway and pool** have IDs matching the failed preview's former lowercase-only rule. The other 21 IDs contain capitals. Runtime validation accepts stable nonempty IDs; the model-facing schema prefers kebab IDs but is not transmitted as an exact schema. Preview silently enforced a stricter spelling policy and discarded the mansion. The fix preserves runtime-compatible identities and references without renaming them.

| Offline result | Earlier Canopy initial | Earlier Canopy repair | Latest initial | Latest repair |
| --- | ---: | ---: | ---: | ---: |
| Retained scene objects | 19 | 19 | 23 | 23 |
| Baseline production-ingestion errors, current consistency policy | 25 | 22 | 25 | 13 |
| Current production-ingestion errors | 25 | 22 | 18 | 6 |
| Forced full-scene compiled primitives | 484 | 500 | 660 | 660 |
| Compiled geometry errors | 3 | 0 | 0 | 0 |
| Preview objects before ID fix | 0 | 0 | 2 | 2 |
| Preview objects after ID fix | 19 | 19 | 23 | 23 |
| Accepted | No | No | No | No |

These earlier error totals include the present new-generation consistency policy, rather than only the older lenient-validation error list reported during the previous investigation. Earlier Canopy failures included multi-plane footprint/facade ambiguities, disconnected walks and an unfulfilled joined water-garden claim. Its repair resolved compiled geometry but retained planning contradictions. The latest scene uses constructible rectangular masses and better main-entry/vertical connections; it still fails coherent route planning and consistency between representations. These four responses do not estimate a production success rate.

The recovered preview is diagnostic: its current contract still omits estatePlan and interior circulation. Recovering 23 objects does **not** mean the preview now certifies all routes, stairs or estate function. Full investigative replay compiles the canonical full scene separately. This audit did not conduct new visual/WebGL quality review, claim a photorealistic result, or save any failed draft into a project.

## 6. Small fixes implemented

1. `failedPreview.ts`: accept the same nonempty stable identifiers as runtime validation; preserve camelCase object and relationship identities.
2. `estateSpatial.ts`: ignore exact adjacent duplicate route points in the shared derived route view; leave authored data untouched. Validate, collision-test and compile the same nondegenerate polyline. Entirely collapsed routes and ambiguous ownership still fail.
3. `estateSpatial.ts`: do not demand estate paths to roof-form construction components merely because they share a program entry.

No layout templates, mandatory amenities, new provider calls, automatic routing, widened repair permissions, provider-schema migration or acceptance bypass were added. Remaining wing/pool access false positives, site-boundary anchors and the compatibility-box/ribbon mismatch are documented for the systemic milestone rather than patched with broad shortcuts. Existing saved-project data is untouched. A saved route with redundant adjacent points can now compile its actual ribbon where it previously fell back to box geometry; this is an intentional correction to representation, not a persisted edit.

Regression coverage preserves all recovered inputs, reproduces all four ingestion outcomes, checks route ribbons and blocked corridors, confirms stairs/junction passages, and exercises the actual POST route with exactly two mocked responses, a 422 and all 23 preview objects. Original debug artifacts and baseline evidence remain unchanged.

## 7. Workflow recommendation and smallest milestone

**Single-call authoring remains viable as an input strategy, but its current reliability is unproven and this ID-index design does not supply the claimed plan-to-construction guarantee.** More instructions cannot ensure that the model keeps independently authored allocations, route boxes, routes and relationships mutually coherent. Deterministic construction can reliably preserve supported decisions after a coherent geometric plan exists; it cannot invent missing architectural decisions or certify subjective luxury.

The smallest systemic direction is **one provider-authored canonical geometric plan, locally validated, followed by deterministic V3 construction**. Keep creative choices in existing V3 planning primitives: arbitrary supported line/arc footprints, placements, levels, door wall addresses, roof hosts/forms, outdoor surfaces, explicit route polylines/widths and stair reservations. Do not create a mandatory luxury template or another independent full scene graph. The blueprint index can remain a stable reference map, but approved geometry must live in this canonical planning representation. Derive runtime arrays, route compatibility bounds and redundant relationship views from it, and make all audits consume the same occupied geometry.

| Option | Cost and reliability | Creative freedom / reuse / approval |
| --- | --- | --- |
| Current one-response index + independent detail + possible repair | One initial call, currently often a second full-scene repair. Repair repeats the brief, response and diagnostics. Two captured failures and synthetic acceptance fixtures do not establish reliability. | Broad freedom, but no independent stage boundary. Existing compiler reused. Human approval cannot happen before details because they already arrived. |
| One response containing canonical geometric plan; deterministic construction/elaboration | One authoring call; local validation and construction require no provider tokens. Redundant coordinates/relationships can be derived. Fewer opportunities for contradictions, but real invalid planning still needs explicit correction. | Preserves supported creative geometry. Reuses architecture mapping, footprints, roof planner, circulation, ribbon compiler and approval snapshots. Human aesthetic review can be optional. |
| Genuine Stage A blueprint → Stage B deterministic V3 construction | Stage A returns a minimal geometric plan and stops. It must validate before Stage B starts. Stage B is local code, so **two workflow stages need not mean two paid AI calls**. Early rejection avoids spending on unusable detail. | Reuse the V3 planning subset and immutable decision approval. An optional plan review/edit screen can pause here. Human approval is not necessary for unambiguous valid supported plans. |
| Stage A provider planning → separate Stage B provider facade/detail elaboration | At least two calls, plus repeated context and any subsequent repair. A shorter A may offset some tokens, but no measured savings or dollar estimate is justified here. Bound detail changes and revalidate against approved geometry. | More room for detailed creative authorship; renewed drift/schema risk. Human approval useful for aesthetic direction or unresolved contradictions, not a universal geometric requirement. This is a future optional path, not authorized or implemented now. |

Recommended next milestone: **an offline canonical-plan-to-V3 proof for these recovered estates**, with no provider integration changes. Establish shared route geometry for allocation/contact/collision checks, explicit typed site-boundary endpoints, and access coverage based on proven compiled passages and reachable dry destinations. Derive route bounds rather than asking the model to author a second rectangle. Keep any necessary wall-approach correction explicit in separate test fixtures; never overwrite the recovered provider evidence. Prove that deterministic Stage B cannot move/resize/restyle approved geometry and that every blocker is reported before paid elaboration. Use the earlier articulated mansion and existing circular/nonrectangular fixtures to prevent solving this by restricting style.

Acceptance for that milestone: one valid manually corrected plan constructs all intended supported geometry; these untouched invalid plans still expose their real contradictions; no direct path is demanded to a roof or into a pool; every validator and compiler agrees about the same route; warnings remain warnings; drift and invalid/unsupported geometry remain rejected; actual route replay stays within its bounded invocation count. This milestone does not require human approval of every generation, another provider call, or a live generation.

**GO/NO-GO: NO-GO.** These fixes improve recovery and remove confirmed false findings, but do not turn either response into an accepted coherent estate. Complete the offline geometry-authority/access milestone and architectural review before considering a separately authorized, bounded live evaluation. Nothing here automatically spends on such an evaluation.

## 8. Reproduction and checks

`blueprintLiveFailure.test.ts` replays actual normalization, ingestion, deterministic reference repair, blueprint gate, detailed validation, consistency, compilation, compiled audit, architectural/completeness review, stairs and failed preview. Its forced downstream steps are explicitly investigative; the production result is reported separately. `baseline.json` is historical pre-fix evidence and must not be regenerated with the fixed code.

```sh
BLUEPRINT_LIVE_AUDIT_OUTPUT=docs/architecture/blueprint-live-failure/replay.json npx vitest run src/lib/v3/__tests__/blueprintLiveFailure.test.ts --maxWorkers=2
npx vitest run src/lib/v3/__tests__/blueprintLiveFailure.test.ts src/lib/v3/__tests__/estateSpatial.test.ts src/lib/v3/__tests__/failedPreview.test.ts src/lib/v3/__tests__/mansionFailure.test.ts src/lib/v3/__tests__/blueprint.test.ts src/lib/v3/__tests__/blueprintGeneration.test.ts src/app/api/ai/house/__tests__/route.v3.test.ts --maxWorkers=2 --silent
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
```

Focused coverage: **133 tests passed in 7 files**. Full offline suite: **171 files passed, 2 skipped; 2,035 tests passed, 3 skipped**. TypeScript and ESLint with zero warnings passed. Final verification and whitespace checks are recorded in `checks.json`.
