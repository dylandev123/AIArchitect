# V3 pre-generation reliability and architectural intelligence audit

20 October 2026, America/St_Lucia. **NO-GO for another paid generation.** V3 can deterministically build a coherent supported design, but the present contract still asks Terra to reconcile independent design constraints and repeated measurements. Neither recovered estate, including either historical repair, passes current generation acceptance. A new adversarial case also proves that ingestion success does not guarantee usable vertical circulation.

No Terra/OpenAI requests, paid generations, commits, pushes, deployment, environment edits, V2 changes, terrain changes or saved-project writes were made. API tests mock `generateText`. All pre-existing uncommitted work was retained. The previous reports' recommendations for a live evaluation are historical recommendations; this audit does **not** adopt them merely because tests pass.

## 1. Evidence and method

Read the requested [blueprint live-failure report](../blueprint-live-failure/REPORT.md), [design-consistency report](../mansion-failure/DESIGN-CONSISTENCY.md), and [blueprint-first contract](../v3-blueprint-first-generation-v1.md), together with the recovery addendum and [latest unified-spatial implementation report](../unified-spatial/REPORT.md). Code and fresh offline replay take precedence over historical counts and claims.

Both generations means **four provider responses**, not two fixtures:

| Estate | Initial / repair capture on 19 October, local time | Original compact response bytes | Authored objects |
| --- | --- | --- | --- |
| Canopy Meridian | 08:21:17 / 08:21:56 | 20,454 / 20,433 | 19 / 19 |
| Caribbean Cloister | 16:17:49 / 16:18:50 | 23,007 / 23,558 | 23 / 23 |

The untouched `canopy-meridian-attempt-{0,1}.json` and `blueprint-cloister-attempt-{0,1}.json` fixtures are complete provider responses. Recovery metadata records matching SHA-256 hashes, `redacted:false`, and `omittedForSize:false`. Neither is evidence of JSON truncation. The exact transmitted historical prompts, original user briefs, token usage and charges are unavailable. Requirements attributed to the user in the recovered output are the retained evidence; they are not an independent transcript of the brief.

[replay.json](replay.json) records production ingestion, every validation/consistency finding, repair feedback, normalization notes and separately labeled investigative compilation, completeness and architectural review. Canopy is replayed under its original non-blueprint contract with current consistency enabled; no missing-index failure is manufactured for it. Cloister uses required blueprint plus consistency. [before.json](before.json) summarizes the fresh pre-edit replay. [failure-catalog.json](failure-catalog.json) classifies findings, including duplicate evidence and observations that are not acceptance blockers.

## 2. Biggest causes of repeated failures

1. **Repeated spatial measurements remain authored constraints.** Both responses place objects and then independently supply allocation rectangles. The Canopy responses each have ten membership/allocation conflicts. Cloister initially has seven; its repair still has two when the *whole* route ribbon is measured. These are contradictions in the authored output, not normalization relocating buildings.
2. **Endpoint selection is semantic; approach geometry is still a design decision.** Canopy's walks stop 1.4–3.5 m short of their destinations. Cloister names the correct pavilion doors but approaches along their walls, putting half the 2 m ribbon inside them. Deriving a door centre cannot choose a valid external detour.
3. **Addressing an articulated facade is harder than naming its compass side.** Three Canopy doors span different planes across recess returns. A single planar door needs an explicit single-plane address or another supported authored composition. The historical repair fixes those spans but leaves the access and allocation contradictions.
4. **The old repair received inconsistent or incomplete evidence.** The Cloister repair widened independent path boxes from 2 to 23 m while preserving the invalid 2 m routed corridor. Unified spatial geometry already fixes that split authority. Before this audit, a blueprint rejection also returned before independent detailed diagnostics, consuming the single follow-up before exposing some construction failures.
5. **Acceptance is narrower than the product promise.** Supported meshes, references and preliminary reservations do not certify functional completeness, a luxury program or extraordinary architecture. A 0.4 × 0.5 m stair reservation fits its host and passes preliminary planning but constructs no usable stair; ingestion still succeeds. Architectural review requests a revision, but its failure can retain that initial scene. The actual API returns HTTP 200 after two mocked responses in this case, with the stair still unusable and `designReview.revised:false`. This is a demonstrated acceptance gap, not an inferred production success rate.

## 3. Does blueprint geometry drive construction?

**The version-1 `estatePlan.blueprint` index supplies no geometry.** Removing the index does not change compiled output in existing provider-fixture parity tests. It indexes buildings, entrances, roofs, routes, outdoor objects, circulation and program allocations; it checks coverage and captures preservation evidence after a complete provider response arrives. It cannot make that response obey a separately approved prior geometric plan.

**The existing V3 semantic geometry does drive supported construction.** `architecture`, `composition.footprint`, openings, roof intent and circulation reservations are consumed by the compiler. The latest unified-spatial work makes `estatePlan.circulation[].spatial` drive route triangles, owner bounds, occupied strips, allocation evidence and door contact. Calling the index itself a geometric blueprint overstates its role; calling all V3 geometry post-hoc validation understates the compiler.

Current pipeline: one response → normalization/materialization → blueprint audit/optional approval → reference repair → structural validation → generation consistency → compilation/geometry audit → architectural review → bounded preservation-checked repair/revision. This audit permits read-only detailed diagnostics on a rejected, structurally inspectable plan; it grants no approval and runs no reference repair on that rejection path.

| Decision / repeated representations | Authority and deterministic derivation available today | What remains an authored decision |
| --- | --- | --- |
| Building position and dimensions: `architecture` versus runtime arrays | Named architecture wins; runtime arrays are derived with a note. Blueprint building entries contain identities only. | World position, orientation, envelope and base elevation. |
| Envelope versus line/arc or articulated outline | Compiler builds the actual outline inside its placement envelope. These have different meanings; automatically shrinking an envelope would change facade addressing. | Outline, topology, local coordinates, operation/segment identities and intentional setbacks. No arbitrary curved Boolean unions or outline holes. |
| Storeys: mass height, `levels`, explicit interior datums, stair level range | V3 derives ordinary floor/slab geometry and circulation datums; validation checks contradictions. | Storey count/height intent, stacked landing choice, vertical-connection host and reservation. A fitting reservation alone is insufficient. |
| Entrances: opening wall address, `mainEntry`, blueprint entrance index, `serves`, route `openingId`, optional endpoint coordinates | A named ground door resolves to its exact world-space span centre, including rotation, recesses and curves. Main-entry canopy and door-contact probes derive from that address. | Which door serves which destination, facade/segment, level, span and any deliberately off-centre arrival. The index must still name existing entrances. |
| Walkways: endpoint points, repeated endpoint waypoints, separate path-box dimensions | Spatial route endpoints may derive from named doors/site access; adjacent repeated coordinates are ignored. Route width and authored bends are canonical; owner box is derived and does not occupy the empty area inside a bend. | Route graph, exclusive surface owner, width/use, surface endpoint coordinates and intervening bends. No automatic obstacle routing. Legacy standalone rectangles remain independent authored surfaces. |
| Roofs: building roof intent, separate roof dimensions/origin/yaw, host aliases, mirrored host edges, index | An implicit roof derives from its building footprint. An explicit hosted footprint roof reuses that outline, checking its authored envelope/eaves and host. Explicit roof objects override implicit construction. Conflicting host aliases are rejected. | Roof family, pitch, overhang, finish and whether a separate editable roof is intentional. Separate roofs still require matching placement/envelope fields; V3 does not infer a missing independent design. |
| Roof datum versus building top and support metadata | Existing datum/support/bearing systems derive ordinary placement/support relationships and diagnose unsupported adjustments. | Intentional roof separation, groups, cantilevers and unusual support. No general intersecting-roof solver. |
| Pool, deck and terrace footprints versus `contains` / `connects` claims | V3 checks actual footprints and derives a dry pool approach through a reached containing deck at rim level. | Pool/deck shape and levels, containment versus edge contact, outdoor sequence, swimmer entry and transitions. V3 cannot resize a deck around a pool merely to satisfy a claim. |
| Estate zones: member geometry, independent `allocation` rectangles, optional `clearSpace` | Full occupied geometry is measurable today through `spatialPlanPoints`, including ribbon widths. **Allocation rectangles are still mandatory authored constraints, not computed output.** Blueprint requirement allocations only repeat references, not rectangles. | Territory/reservation boundaries and genuinely clear volumes. Measured member envelopes could be derived when no separate reservation is intended, but that contract does not exist yet. |
| Requirements and minimum dimensions versus measured geometry | Floor area, dimensions and some occupancy are measured; user limits remain constraints. | User requirements and chosen design commitments. Do not derive a user's requested size from whatever was built. |
| Access relationships: planned edges, scene edges, route chains, openings and compiled passages | Unified access uses actual doors, dry surfaces, stairs and proven shared-wing passages. Explicit roof hosts/proven physical connections no longer need redundant mirrors; visual axes are advisory. | Intended destinations and functional relationships. Legacy non-spatial chains still need their declared edges. A label, touching mass or generic exterior graph node cannot prove passage. |
| Site boundary: route coordinate, endpoint ID, site-access point | Omitted endpoint coordinates derive from an explicit site-access record; the declared point is checked against the chosen site side. | Gate/road identity and location. `siteNorth` without a declared identity is not a road or an automatically invented site object. |

This is the complete geometry-authority inventory found in the present flat V3 generation path. Some repetitions are necessary **constraints or references**, rather than competing geometry. Removing all of them would lose design intent.

## 4. Terra-facing contract realism

The real route calls `generateText` with `Output.json({name:'v3_scene'})`, **not** `Output.object` with `v3SceneOutputSchema`. Its exact provider schema is therefore JSON mode without a transmitted application schema. The local Zod schema is 20,336 serialized characters and is useful for offline conformance, but contributes **zero transmitted schema characters**. All four recovered responses fail that strict local provider schema while the tolerant runtime retains their architectural identities; switching on exact schema enforcement would be a separate compatibility change, not a free fix.

The enabled flat blueprint-first system prompt is 28,690 characters, approximately 7,173 tokens at characters/4. Before this audit it was 27,868 characters. These are character estimates, **not tokenization, measured billing or headroom guarantees**. The initial and repair output cap is 10,000 tokens each. Recovered compact outputs are about 20–24 KB, roughly 5.1–5.9k tokens by the same crude estimate. Complete captures establish that these particular responses were retained; they do not establish ample headroom for a more detailed curved estate. One full-scene repair repeats the system contract, original brief, authored response and diagnostics, then emits another full response.

Terra simultaneously has to reason about site composition, absolute and host-local coordinates, rotated footprints, arc closure, normalized wall spans, recess planes, roof compatibility, vertical run/width, deck elevations, route corridor clearance, site bounds, allocation containment, semantic identities and mirrored commitments. Many clauses are individually sensible. Their conjunction is demanding even on rectangular estates, as the actual wall-following paths and wrong allocation bounds demonstrate.

Confirmed contract problems and current disposition:

- Universal instructions to mirror relationships contradicted newer physically derived access/roof evidence. This audit scopes scene edges to cases that still need them; spatial routes do not need a second box or parallel graph declaration.
- Named-door and site-access endpoint derivation was available but phrased as an optional possibility among manual coordinates. Guidance now prefers it, preserving deliberate off-centre approaches and explicit surface destinations.
- Separately editable roof objects are offered even when a roof has no independent design. Guidance now points Terra toward the already-supported implicit host roof in that case. It does not choose a roof family or alter existing roof objects.
- Zone rectangles remain a repeated calculation. No prompt change makes them computed geometry; no automatic resizing was added.
- Blueprint-first property order is a reasoning request, not an observable approval boundary. The index's coverage and preservation role is useful, but its timing cannot guarantee coherent authorship.
- Supported roof families are conditional: articulated/outline hosts support flat, floating-flat, terrace and mono-pitch plates; rectangular hosts have broader pitched options. Domes, arbitrary intersections, curved mass unions and terrain estate routes are not silently substituted. The new dome and curved-gable adversarial cases remain rejected.
- Objective repair was too vague about standalone path extents versus canonical route edits and missing boundary identities. Wording now matches existing guards: local coordinates/bends only, protected width/use/destination IDs, and a missing site-access record only at its already-authored point. The guard itself was not broadened.
- Repair still returns a full scene with the expansive initial design instructions repeated. Scope guards prevent many redesigns afterward, but do not make the model's calculation task small or guarantee that one repair suffices. Approved plan geometry is immutable; preliminary approval can also be too optimistic about a stair's usability.

## 5. Replay and classification of all remaining failures

Classes: **A** deterministically preventable/resolved from an existing unambiguous source; **B** needs an explicit local authoring decision; **C** unsupported construction; **D** missing architectural design information; **E** validator false positive. Classification describes the present information and capability, not permission to auto-correct geometry. In particular, an explicitly authored reservation is a constraint: resizing it without a decision is not deterministic repair.

| Response | Accepted | Production blocking diagnostic entries before → after this audit | Independent blocking relationships/decisions* | Investigative compiled errors |
| --- | --- | --- | --- | --- |
| Canopy initial | No | 25 → 25 | 20 | 3 ambiguous doors |
| Canopy repair | No | 22 → 22 | 17 | 0 |
| Cloister initial | No | 11 → 12 | 11 | 0 |
| Cloister repair | No | 5 → 5 | 5 | 0 |

*Canopy's five physical gaps each produce both route and door-contact evidence. Cloister initial now exposes `AUTHORED_SITE_OVERRUN` as well as `BLUEPRINT_SITE_BOUNDS` for the same garden. The extra entry is fuller diagnostics, not an additional design defect or changed construction. The table does not count every advisory as a fatal defect. Full messages and exact IDs are in the catalog/replay.

**Canopy, both attempts unless stated otherwise:**

| Independent failure | Exact targets and evidence | Class / status |
| --- | --- | --- |
| Three doors cross recess planes, initial only | `mainResidence/southLivingDoor` .12–.42, `southDiningDoor` .58–.88, `southUpperDoor` .38–.62; recess boundaries .39/.61 | B. Historical repair chooses single-plane spans and clears these three. Explicitly required multi-plane operable hardware would instead be C; that requirement is not established here. |
| Five access gaps | `entryWalk→mainResidence` 1.4 m; `mainResidence→guestWalk` 3.5 m; `guestWalk→guestPavilion` 3.5 m; `mainResidence→wellnessWalk` 3.5 m; `wellnessWalk→wellnessPavilion` 2.5 m | B. Actual rectangle geometry lacks the connecting runs. No missing bend can be inferred uniquely. Both route and addressed-door diagnostics are evidence of each same gap. |
| Ten allocation/member conflicts | `zone-arrival`: arrivalDrive, entryWalk, arrivalGarden; `zone-residence`: poolTerrace; `zone-water`: poolTerrace, sunsetLawn, southGarden; `zone-guests`: westGarden, guestWalk; `zone-wellness`: eastGarden | B under the current explicit-reservation contract. A future opt-in measured-envelope contract could prevent the redundant measurement conflicts without changing architecture; do not automatically erase real reservations. |
| Joined water-garden claim has a gap | `arch-water-garden`: poolTerrace, reflectionPool, sunsetLawn; pool ends z=36.5, lawn starts z=37, joined tolerance .05 m | B. Choose whether this is thematic alignment or connected construction and author the appropriate geometry/claim. |
| Garden outside fixed site | `southGarden` reaches z=67; site ends z=60 | B. Needs an authored in-site extent, not clipping or a larger site. |

**Cloister:**

| Independent failure | Exact targets and evidence | Class / status |
| --- | --- | --- |
| Missing boundary identity, both | `siteNorth/driveway`; coordinate [0,0,-60] is authored but no `siteAccess` declaration | B. A record at that known coordinate is locally repairable under current guards; no road location should be invented. |
| Two blocked pavilion approaches, both | `guestPath/guestPavilion` at x=38 and `wellnessPath/wellnessPavilion` at x=-38. Their 2 m corridors follow walls, penetrating about 5 / 6 m² | B. Correct external approach bends explicitly, retaining doors and buildings. Named endpoints alone cannot solve these. |
| Garden outside site, initial only | `palmGarden` ends z=62 against z=60 | B. Historical repair shortens it to z=60. |
| Seven allocation/member conflicts, initial | arrival: driveway, entryWalk; water-garden: palmGarden; guests: eastGarden, guestPath; wellness: westGarden, wellnessPath | B. Repair clears five, leaving the two actual ribbon overruns below. |
| Two allocation/member conflicts, repair | `zone-guests/guestPath`, `zone-wellness/wellnessPath`: allocations end north at z=-23; full corridors reach z=-24 | B. These are real full-width conflicts newly exposed by unified geometry, not residual owner-box false positives. |

Additional spatial information must remain visible:

- **B, unflagged semantic inconsistency:** both Cloister responses put `eastLinkDoor` at x≈[-16.2,-10.08], beside the west wing, but `serves:eastResidenceWing`; `westLinkDoor` at x≈[10.08,16.2] names the west wing beside the east. Actual compiled junction passages preserve wing access. This is two mislabeled access relationships per response, not two missing physical passages. Correcting references would still be an explicit decision; this audit does not silently swap them.
- **D, advisory:** Canopy's meditation court has no authored south door or connecting surface; initial Canopy also loses direct terrace access where its ambiguous doors are not constructed. Cloister/Canopy have 0.12–0.26 m threshold differences depending on the surface. A step, ramp, landing or intended change of route needs authorship; small height differences do not justify a universal fatal accessibility demand.
- **D/C, uncaptured design/detail:** pool stair/ladder decisions, room program, spa/service equipment and planted landscape detail are not supplied by their labels. Some equipment needs future specialized construction. Budget, exact style, privacy/views and a joined group's precise L/U silhouette are not certified by geometry. These are not additional fatal requirements or mandatory amenities.

**Failures already eliminated by the latest implementation or prior recovered construction work:**

| Historical issue | Class and present evidence |
| --- | --- |
| Dropped camelCase stair and failed-preview objects | A. Stable identities survive normalization/preview. All 19/23 scene objects and authored stairs remain; raw fixture hashes are unchanged. |
| Derived entry canopy overran a valid recess | A. Padding is bounded by its actual supporting wall. No valid door is narrowed. |
| Supported Canopy roof eaves, bridging recess assemblies, multi-plane fixed glazing and floating-roof bearings were lost | A. Existing recovery reuses explicit envelope/overhang, shoulders and host geometry. The three ambiguous operable-door spans are deliberately still B. These are previous fixes, not new audit work. |
| Redundant route endpoints were rejected | E. Canonical deduplication preserves all nonzero supported route segments. |
| Roofs, connected wings and deck-accessed pool required separate estate paths | E. Components are excluded; proven internal passages and dry deck approach supply the right evidence. Isolated/blocked destinations still fail. |
| Path allocation/contact inspected independent boxes | A/E. Canonical strips now drive construction and audit; contradictory owner boxes are neutralized with derivation notes, not allowed to widen a path. |
| Missing mirrored roof/physical-access scene edges | E when geometry already proves the relationship. Dangling references and roof-host disagreement still block. |
| Compiled audit looked for routed owner IDs instead of actual ribbon IDs | E, newly fixed here. Four false path warnings per Cloister response disappear; missing or altered canonical meshes now produce errors. |

No remaining blocker in these four recovered responses requires a new construction engine. All require supported local design reconciliation. That does **not** mean V3 may invent those choices or that the existing preservation guard permits every possible replan. The historical full-scene repairs also change protected unrelated declarations/details and cannot be relabeled successful repairs.

## 6. Small changes implemented in this audit

1. **Complete safe failure feedback:** on a well-formed failed blueprint, ingestion gathers independent structural/consistency diagnostics without reference repair, approval or acceptance. Matching findings merge with their full target IDs and strongest severity. Malformed, duplicate or invalid-footprint prerequisites still stop unsafe inspection; an approved-plan drift rejection retains its early-stop policy. A fixture combines allocation rejection, an unsupported curved gable and an unresolved exterior assembly; the actual API sends all three to its one mocked repair.
2. **Canonical mesh audit:** `validateV3CompiledGeometry` recognizes estate-route ownership and checks the constructed canonical ribbon rather than searching for a legacy owner-ID primitive. Deliberately missing/altered ribbons fail. Compiler output itself is unchanged.
3. **Contract alignment:** prefer existing named endpoint and implicit-roof derivation, remove obsolete universal graph mirroring, clarify full-width allocation measurement, and describe existing local route/site-access repair limits accurately. No geometric decision, repair permission, provider schema migration or extra provider stage was added.
4. **Offline adversarial coverage and replay evidence:** eleven provider-shaped fixtures include four valid designs and seven invalid variants; all expected outcomes pass. The separate unusable-stair characterization intentionally records a present acceptance gap. Tests also preserve rejected-plan references and reject attempts to hide blueprint conflicts by deleting commitments.

No automatic zone resizing, roof redesign, door choice, route detour or code for Options B/C was implemented.

## 7. Architectural intelligence

The prompt already encourages a distinctive concept, scale/program, mass composition, roof character, arrival, outdoor living, recreation, landscape, privacy and functional connections. `concept`, `character`, `program`, architecture commitments and considerations give Terra places to express that thinking. Both recovered estates have coherent intentions: a long shaded residence between arrival and water garden, and a protected cloister sequence with detached retreats. Their failures are not proof that the model lacks creative ideas.

However, neither the index nor the validators establish whether massing realizes those intentions beautifully. Large courts, several pavilion labels, a pool and multiple roofs do not establish extraordinary luxury. The Canopy repair reduces north glazing and eaves/assemblies; mechanical repair can dilute the initial concept even while improving constructibility. The Cloister repair's oversized boxes show numerical compliance consuming attention without improving the arrival experience. Gardens remain largely zones; spa/fitness labels do not construct their programs; no full spatial room program establishes service privacy or an exceptional guest experience.

Design review should trace a **few brief-specific reasons** through the actual design: what makes the concept distinctive, how arrival unfolds, why these masses/voids belong together, where household/guest/service movement occurs, and how outdoor living uses light, privacy and views. These questions should guide Terra's choices and human review; they should not become fixed amenity requirements, aesthetic scores or incentives for extra curves. A restrained rectangular composition can be more successful than an intricate incoherent one. The next contract should reduce arithmetic duplication so this design work has room to matter.

## 8. Options A, B and C

| Dimension | A: current single response, blueprint index plus detailed semantic scene | B: one geometric-plan call, deterministic supported construction | C: blueprint AI call, then detailed-construction AI call |
| --- | --- | --- | --- |
| Expected reliability | Supported compiler is deterministic; natural provider consistency remains unproven. Both recovered initial/repair pairs fail. More instructions do not remove redundant constraints. | Fewer opportunities for geometry drift **if** the plan is the sole source and contains every required design choice. Still cannot solve conflicting/missing decisions. Must validate constructed usability, not just reservations. | Can isolate planning and permit creative detail later; second model can introduce drift, omissions or conflicting detail. Needs immutable geometry and strict elaboration validation. No measured reliability advantage. |
| Provider-call count | 1 initial, at most 1 objective repair **or** optional design revision | 1 authoring call; local validation/construction adds 0. Invalid plans may still need the bounded repair if retained by product policy. | At least 2 for success before any repair; invalid Stage A should stop before paying for Stage B. Existing one-follow-up policy cannot simply be assumed unchanged. |
| Token cost | Current prompt ≈7.2k estimated input tokens; full semantic response and possible full-scene repair. Cap 10k output per attempt. | Potential output/context reduction by omitting runtime arrays, independent roof envelopes, route boxes and repeated measurements. Savings are unmeasured and depend on how much creative facade/assembly intent remains. No claim of free invalid-plan repair. | Repeated approved-plan context plus a second output and additional instructions. Shorter stages can improve headroom, but total savings versus A/B are unknown. |
| Creative freedom | Broad supported authorship, with geometry bookkeeping competing for attention | Keeps arbitrary supported footprints, placements, massing, openings, roof families, routes and chosen amenities. Defaults alone cannot reproduce every bespoke facade/assembly/finish. A plan limited to boxes and names would reduce design information. | Can add deliberate facade, shading and detail authorship after planning. Benefit depends on constrained elaboration; more calls do not inherently produce better architecture. |
| Implementation | Existing production path; relatively small contract/gate fixes possible | Reuses V3 materialization, footprints, roofs, access, circulation, routes and approval. Needs a real geometric-plan contract, derived views and sufficient detail/finish/transition choices. Moderate contract/orchestration work; no new general geometry engine needed. | More orchestration, schemas, intermediate evidence, token management and scope/preservation logic. Largest implementation and evaluation burden. |
| Missing information/capability | Usability versus advisory acceptance, explicit zone reservations, unsupported roof/union/equipment detail, under-specified functional design | V1 blueprint index alone is insufficient. Named doors, roof choices, dimensions, route bends, stairs, supported assemblies and any intentional transitions must be in the plan or explicitly delegated to known deterministic rules. | Stage B cannot legitimately invent or alter protected plan decisions unless an explicit decision boundary allows it. Unsupported geometry remains unsupported. |

**B is feasible today for a defined supported semantic subset, not as a drop-in use of the current index.** The four valid adversarial designs and existing diverse blueprint fixtures already compile without a construction AI call. In fact A already uses deterministic construction after detailed semantic authorship. B's useful change would be reducing and canonicalizing what Terra must author, not adding a second compiler or merely renaming A's output “blueprint.”

A sufficiently rich plan can preserve custom creative geometry, but then it includes some fields presently called detail. Conversely, a minimal index or footprint-only plan lacks design information for doors, facades, roof selection, route clearance, stairs and bespoke exterior assemblies. No current deterministic system can recreate that unspecified architecture without defaults or invention. B is therefore a credible next contract direction, **not an implemented or demonstrated extraordinary-estate generator**. C is premature while A's source-of-truth and functional acceptance gaps remain.

## 9. Recommended next development milestone and decision

The smallest architectural contract change likely to reduce the repeated errors materially is to **distinguish a derived zone measurement envelope from an explicitly reserved zone boundary**. For a descriptive group, derive its envelope from existing member footprints and full canonical route strips; retain explicit reservations/clear space as authored constraints. This reuses the current spatial projection, chooses no building placement or style, and attacks the ten Canopy / seven initial Cloister allocation conflicts. Do not simply expand all existing allocations: some may represent intentional territorial limits.

Develop that change offline as part of a narrow **canonical-plan acceptance milestone**, without implementing a second AI stage:

1. Define source/constraint precedence for zones, explicit roofs and endpoint references. Prove unambiguous derived fields come from the same semantic geometry; reject contradictory authored constraints instead of silently dropping them.
2. Use already-supported named-door/site endpoints and implicit roofs in varied provider-shaped fixtures where those semantics fit. Preserve intentionally separate roofs, unusual forms and explicit off-centre approaches.
3. Close the demonstrated functional acceptance gap: preliminary approval and final acceptance must agree about actual usable authored stairs/required circulation. Decide a narrow repair scope before freezing reservations; do not promote every outdoor-access heuristic to fatal.
4. Require one feedback package to include every safe independent blocker. Malformed prerequisites should identify the checks that cannot safely run, not pretend there are no downstream concerns.
5. Preserve saved-project construction baselines and manually review concept-to-space realization across varied designs. Keep missing design decisions and unsupported construction explicit.

This milestone does not require another paid call. It should end with a reviewable provider contract and offline proofs showing reduced independently authored measurements, not merely a larger test count. Fixing it would justify reconsidering a separately authorized evaluation; it would still not establish natural-provider reliability or extraordinary luxury quality.

**Current decision: NO-GO for another paid generation.** Passing tests prove the stated offline behavior. They do not resolve the two failed estates, quantify the probability of success, repair the demonstrated unusable-stair acceptance gap, or certify architectural quality.

## 10. Offline acceptance and reproduction

New fixture coverage: curved two-storey mansion and curved exterior shade; named doors/site-boundary access and multiple buildings; connected wings and dry pool approach; independent hip roofs; contradictory owner boxes; wall-following approaches and allocations; unsupported curved roofs; unresolved exterior assemblies; ambiguous recessed doors; dangling doors/building/host references; ambiguous route ownership; and explicit unsupported dome intent. Valid canonical designs retain all objects; invalid references do not select another door or render a fallback box. Reference deletion cannot hide blueprint conflicts. The tiny-stair characterization is explicitly recorded as a known acceptance gap, outside the four valid / seven invalid geometric fixture results.

Run from the repository root, without loading credentials:

```sh
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= PRE_GENERATION_AUDIT_OUTPUT=docs/architecture/pre-generation-reliability/replay.json npx vitest run src/lib/v3/__tests__/preGenerationReliability.test.ts src/lib/v3/__tests__/blueprintGeneration.test.ts src/lib/v3/__tests__/blueprintLiveFailure.test.ts src/lib/v3/__tests__/unifiedSpatial.test.ts src/lib/v3/__tests__/designConsistency.test.ts src/lib/v3/__tests__/scene.test.ts src/app/api/ai/house/__tests__/route.v3.test.ts --maxWorkers=2
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
```

Final verification: **139 focused tests passed; 173 full-suite files passed, 2 skipped; 2,082 tests passed, 3 skipped.** TypeScript, ESLint with zero warnings, `git diff --check` and new-file whitespace checks passed. Counts and commands are recorded in [checks.json](checks.json), with detailed [focused](focused-tests.json) and [full-suite](full-tests.json) reports. Existing footprint and feature SHA-256 construction baselines pass; recovered and saved fixture bytes remain unchanged. No new browser capture or live architectural-quality measurement was claimed; runtime compilation is unchanged by this audit.

Source entry points: [production provider call and bounded repair](../../../src/app/api/ai/house/route.ts), [local provider schema and prompt assembly](../../../src/lib/v3/schema.ts), [estate contract](../../../src/lib/v3/estatePlan.ts), [blueprint audit](../../../src/lib/v3/blueprint.ts), [ingestion/approval boundary](../../../src/lib/v3/ingestion.ts), [canonical route geometry](../../../src/lib/v3/routeGeometry.ts), [access evidence](../../../src/lib/v3/estateAccess.ts), [roof planning](../../../src/lib/v3/roofPlanning.ts), [circulation construction](../../../src/lib/v3/circulation.ts), [repair preservation](../../../src/lib/v3/safeRevision.ts), [new adversarial tests](../../../src/lib/v3/__tests__/preGenerationReliability.test.ts), and [mocked API proofs](../../../src/app/api/ai/house/__tests__/route.v3.test.ts).
