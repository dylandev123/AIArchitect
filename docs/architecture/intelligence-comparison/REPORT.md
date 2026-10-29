# Terra architectural intelligence investigation — 29 October 2026

The strongest retained evidence points to underdeveloped accommodation selection and weak programme-to-construction coordination, rather than a downstream renderer simplifying sophisticated architecture. The original Playground combined a deliberately authored concept, coordinated components, source-code freedom and repeated visual correction. No controlled Claude-versus-Terra benchmark exists here.

**Live-test status: exactly one paid Generate call, zero retries.** After explicit approval of context transmission, the real homepage handler sent the unchanged retained brief and verified context to `gpt-5.6-terra`. OpenAI returned HTTP 200 and a complete response (`finishReason: stop`); the application returned HTTP 422 because the proposed composition violates existing assembly roof-junction restrictions. All 88 staged elements survive in a separate, unapproved diagnostic draft. **No new house was accepted or applied, and no generated geometry was repaired.** The prior offline report is preserved as `REPORT.pre-live.md`.

## 1. Information sources and request priority

The production path is `src/app/page.tsx: handleGenerate` → persisted `direct-scene` project/pending brief → `src/components/scene/OperationStudio.tsx: askTerra` → `generationSceneRequest`/`sceneRequestSchema` → `src/app/api/ai/scene/route.ts: POST` → `architecturalRequestContext` → `generateText` → `resolveSceneResult` → project version → `OperationStudio`/existing R3F renderer. The API alias `src/app/api/ai/villa/scene/route.ts` re-exports this route. No alternate engine was introduced. The investigation harness invokes this exact POST handler in process, rather than claiming a browser Generate click.

`preflight.json` preserves the full assembled system text, user messages, output schema, retrieval query, selected versions, exclusions and source fingerprint. It is private local evidence and contains no authentication headers. Its exact unchanged brief comes from `docs/architecture/distinct-houses/A/request.json`:

> Design an extraordinary $25m contemporary tropical waterfront mansion in Saint Lucia, on a flat site. Create a sophisticated luxury residence with a distinctive entrance, beautiful living spaces, private bedroom wings, purposeful upper-level architecture where appropriate, and integrated outdoor living. Choose a coherent architectural concept using relevant knowledge and construction capabilities. The result should feel like a remarkable luxury estate, not a basic bungalow. Construct fully editable direct-scene architecture.

| Source | Definition/selection | Delivery, authority, planning versus construction |
|---|---|---|
| Model pretraining | Configured model via `src/lib/ai/model.ts: getAiModelId`; default `gpt-5.6-terra`, environment override supported | Not inspectable. Repository records cannot establish training corpus, internal reasoning, or relative Claude ability. Model ID is preserved on actual wire only after submission. |
| System instructions | `src/lib/villa/scene/terra.ts: SCENE_SYSTEM_PROMPT`, `sceneSystemPrompt` | Always supplied as the system foundation. Architectural freedom, supported operations, geometry semantics, budgets, disclosure and construction relationships. The application supplies one system option; the actual Responses wire maps it to a developer-role input item through the AI SDK. There is no separately authored second developer prompt. |
| Canonical guide | `src/lib/villa/scene/designGuide.ts: ARCHITECTURAL_DESIGN_GUIDE` | Embedded once in the foundation; composition, spatial zoning, climate, construction and completeness. It is executable-request context, unlike documentation sitting on disk. |
| Approved knowledge | `src/lib/library/architecture/service.ts: knowledgeRecords/latestKnowledge/generationKnowledge`; seeds plus stored latest revisions | 310 effective architectural records plus 24 approved legacy recipes = 334 active records. Not 334 full records delivered per call. Stored same-ID revisions override seeds; superseded/nonapproved records excluded. |
| Composable recipes | `architecture/seeds.ts`, `guidance.ts`, `expanded.ts`, `fragments.ts`, `legacyRecipes.ts` | Existing library, not another brain. `retrieval.ts: retrieveArchitecturalKnowledge` ranks relevance, scale, explicit specialist use, one value band and category diversity, then bounds context. |
| Property value and cost | `architecture/propertyValue.ts: monetaryBriefContext/propertyValueContext/propertyAmbitionGuidance`; stored value-band revision | Selected $25m–50m record v2; parses bare `$` as assumed USD and amount as unspecified monetary context. Price does not set floor area or bedroom counts. Separate unconditional value/cost clarification follows concept guidance. No regional construction-cost lookup occurred. |
| Playground examples | `scene/designGuide.ts: ARCHITECTURAL_CONCEPT_GUIDANCE`; original `src/components/scene/architecture.tsx: TropicalVilla`, playground `composed-villa.tsx` | Receives a short verbal summary of primary salon, subordinate dining, upper suite, portal, roof layers, glazing and terrace relationships. Does **not** receive complete JSX, original screenshot, dimensions or whole authored project. Summary explicitly prohibits copying coordinates/layout. |
| Code capabilities | `scene/capabilityReference.ts: constructionCapabilityReference`; `scene/model.ts: elementSchema/operationSchema` | Derived from runtime schemas and appended to foundation. Model can use validated primitives, world/local transforms, attachments, place-on, wing/pool assemblies; no source-code execution. Construction schema remains authoritative. |
| Assemblies | `terra.ts: SCENE_ASSEMBLY_INSTRUCTIONS`; `scene/assemblies.ts` and runtime operation schemas | Foundation describes residential-wing and rectangular-pool parameters/expanded child IDs, support limitations and editing. Rooms, stairs and passages do not materialize automatically. `docs/architecture/construction-assemblies/` contains proof, not dynamically loaded model instructions. Relevant construction guidance is already in the guide/library. |
| Architectural programming | `scene/planning.ts: ARCHITECTURAL_PLANNING_INSTRUCTIONS`, intent/plan schemas; `scene/programme.ts` | Supplied inside foundation; requests programme before parts, stable IDs and final geometry evidence. Programme stays optional for legacy compatibility in runtime schema, so valid JSON can still omit planning commitments. This is a contract weakness, not evidence of successful planning. |
| Spatial relationships | `scene/spatial.ts` schema/checks; `planning.ts` and concept guidance | Optional explicit relationships; no layout solver. Recorded intent is checked against constructed transforms after execution. |
| Lessons | `villa/design-learning-store.ts: listDesignLessonSummaries`, `design-learning.ts: learningContext` | Zero lesson characters selected in this preflight. Prior inventory documents two mock summaries, excluded by code. Approved experience entries in the main library are a separate curated source. No evidence of an accumulating approved corpus of visually improved Terra houses. |
| External research | `architecture/research.ts: prepareArchitecturalResearch` called by context builder | Offline preparation only. Actual trace says no search; no queries/findings, no live architectural/site facts. No paid research was attempted. |

Final system order: foundation/planning/design guide → strict Generate-format note → assembly instructions → runtime-derived capability reference → selected library excerpts → eligible lessons (none) → Playground/concept-selection summary → value/cost context → explicit no-research status. `sceneMessages` supplies the JSON brief as user text, plus a reference image only if one was provided (none here). Schema is passed separately to structured output. Actual wire verification in `wire-request-audit.json` confirms developer then user roles, exact system-context equality with preflight, exact unchanged user brief, strict JSON schema, `gpt-5.6-terra`, 30,000 maximum output tokens and no tools. Stored suggestions explicitly yield to the user brief and supported construction contract; textual position is not proof of cognitive influence.

Preflight has 47,502 system characters, of which 26,273 are foundation and 21,229 appended context; lesson characters 0. Character-based token estimates are not measured provider usage. Retrieval budget is 12 entries/18,000 characters; appended concept/value/status text is outside that library-excerpt budget. Eleven entries fit; this is not evidence that only eleven records exist.

Selected IDs: `property-value-25m-50m@2`, `estate-composition@1`, `waterfront-estate@1`, `tropical-envelope@1`, `living-view@1`, `covered-threshold@1`, `roof-flat-parapet@1`, `split-level-concept@1`, `build-upper-floor-support@1`, `coastal-durability@1`, `site-entrance-address@1`. Full scores/reasons/exclusions are in preflight. Lexical matching associates “flat site” with flat-roof guidance and “upper-level/concept” with split-level guidance; that is a relevance caveat, not proven architectural harm. No speculative retrieval rewrite was applied.

## 2. Observable design process

| Stage | What is observable | Limit of the evidence |
|---|---|---|
| Brief | Exact retained request above; no explicit room count, survey, orientation or dimensional target | “$25m” is ambition/context, not a construction budget or forced area |
| Interpretation | Retrieval identifies mansion/residential/contemporary/tropical/waterfront and the value band | Regex-derived context is not hidden model interpretation |
| Knowledge | Exact selected versions, text, excluded records, budgets | Selection/delivery cannot establish causal influence |
| Programme | Explicit returned plan/programme, if present | Historical A omits programme despite naming intended spaces; observable planning failure |
| Concept | Returned hierarchy, arrival, zoning, roofs and assumptions | Cannot verify an internal search among alternatives; request to consider two concepts is not evidence of doing so |
| Spatial organization | Explicit spatialRelationships and element coordinates | Names/relationships can contradict actual walls, doors, clearances |
| Operations | Ordered validated JSON operations, expanded assembly children if used | Narrative amenities are not geometry |
| Execution | Atomic staging, geometry checks, final scene | Generate strips set-terrain for flat staging; null normalization removes absent optional fields, does not add geometry |
| Rendering | Existing R3F scene and parts, actual screenshots | Geometry acceptance is not architectural completeness or navigability |

`earlier.diagnostics.json` reconstructs ordered changes and per-element world geometry for retained A with existing `generationDiagnostics`; `offline-comparison.json` proves the executor reproduces all 60 elements exactly. It does not claim historical request context from a different retained run. Historical A has no route-assigned response ID; its original request/response files are the provenance.

## 3. Documented original Playground workflow

Evidence: `docs/villa-playground/README.md`, `REVERSE_ENGINEERING.md`, `STYLE_SYSTEM.md`; original source now lives in `src/components/scene/architecture.tsx` with playground components reusing it. Documentation naming the former playground path is historical, not a second original house.

The documented concept already joins an asymmetric salon/master suite, tall glazed entrance and subordinate dining pavilion/belvedere. Source authors chose actual dimensions, levels, setbacks, negative space, roof/soffit/fascia layers, stairs, furniture and water/terrace relationships. `LivingRoom`, `DiningRoom`, `UpperSuite`, `Entrance`, `GardenStair` and `TropicalVilla` organize coordinated geometry. The source audit records the salon 14.4×11.8m, upper suite slab 13.5×9.9m, 4.6m-wide/8.8m-tall entrance portal, 9.4×13.5m dining plinth, 24 exterior and 22 interior stair treads.

Browser documentation explicitly records arrival/planting revision after visual review. The later style extension records correction of stair landing, oversized traditional windows, placeholder trees, missing facade depth and veranda/planter interference. It documents multiple views and daylight/golden-hour review before AI connection. This establishes iterative design work; it does not establish exact authoring hours, complete chat history, original external references, or a model superiority claim.

Code freedom supplies curved palm meshes, furnishings, instanced pergola slats, pool steps/channel, custom materials, planting and later extruded arch spandrels beyond today's direct-scene vocabulary. Much of the core architectural hierarchy, slabs, portals, glazing, screens and roof layering is already representable using Terra's primitives. Unavailable landscaping does not explain a blank arrival facade or blocked room connection.

## 4. Comparison under similar constraints

| Dimension | Terra homepage | Original coding workflow |
|---|---|---|
| Design freedom | Original layout within 13 element kinds and validated operations; one component-pinned curved pavilion | JSX/Three geometry and component source may be added or changed |
| Source information | Brief, selected excerpts, short example summary, schemas | Repository/components, explicit bespoke design direction and visible rendered scene; exact full original context unavailable |
| Geometry tools | Existing operations/assemblies; no arbitrary mesh, CSG or new builders | Code loops, custom mesh/instancing, component derivation and shared parameters |
| Context size | Preflight 47,502 system characters plus schema/user message | Historical full model context unknown; cannot compare token windows fairly |
| Iteration/time | One bounded response, 170-second route timeout, 30,000 output tokens, no review call | Documented repeated browser inspection/source correction; exact time unknown |
| Visual feedback | None in Generate; separate review infrastructure exists but is not invoked | Rendered views inform edits |
| Architecture changes | Can recompose within operations; cannot modify renderer/schema | May alter geometry implementation itself |
| Quality checks | Strict schema, support/attachments, audit warnings; no aesthetic acceptance gate | Human visual judgment plus code/runtime checks |

Offline matched comparison uses historical A and the **already retained** developer-authored 174-element primitive study (`docs/villa-playground/terra-basic-diagnosis/study.scene.json`) in the same workspace renderer, same camera positions/targets/FOV. That study has 70 opened walls, 72 solid detail parts, ten roofs and varied two/three-level massing; A has six opened walls, four solid parts and five roofs. Both fit under the 400-element budget. This demonstrates available primitive expressiveness, not equal model performance or complete residences. The study also lacks a recorded programme, complete internal planning and stairs; its large repeated window grid is itself aesthetically debatable. More elements are not a quality score.

Actual captures: `earlier-{arrival,aerial,entrance,poolside}.png`, `study-{arrival,aerial,entrance,poolside}.png`; browser evidence in `browser-result.json`. All API/external requests blocked, isolated storage, original files unchanged. Original Solana captures are included as `solana-{arrival,aerial,entrance,poolside}.png`, verified on `?scene=legacy` by the visible Villa Solana heading and absence of direct-scene operation IDs. Its separate `solana-browser-result.json` records the same world cameras; FOV was set to 40 and canvas to 1130×960 to match workspace captures. Original landscaping, furnishings and renderer settings remain an explicit confound. Camera names denote fixed world views: the primitive study faces the opposite Z direction, so its poolside/arrival semantic sides are reversed; use the full four-view set rather than treating one image as equal semantic exposure. The new live result is separately labelled `live-draft`: its images are rejected-draft previews, not an accepted scene or an offline-authored study.

## 5. Historical $25m A: programme and geometry

Source: `docs/architecture/distinct-houses/A/{request,result,scene.UNAPPROVED}.json`. The original response names **Luminous Reef Estate**. It describes a broad public hall, subordinate west guest wing, offset upper east suite, covered waterfront loggia, pool and detached curved lounge pavilion. Assumes sea +Z and arrival -Z; proposes public/private/service zoning and an internal stair. Limestone/ivory, bronze glazing/door and timber shading; differentiated flat roofs. It selects two guest bedrooms and an upper primary suite, but no distinct baths, closets, kitchen equipment or service accommodation. This is a modest accommodation selection for the requested exceptional estate, even before geometry defects. Neither property value nor the user's brief mandates a particular bedroom/area count.

**Programme omitted:** `reviewProgramme` reports `unrecorded`. Intended-space narrative cannot be counted as a constructed room programme. The largest early loss is inadequate accommodation/commitment development; additional clear loss occurs translating intended access and enclosure into geometry.

The following are investigator correlations of narrative to explicit IDs, not invented programme entries. Exact dimensions, local/world coordinates and operation indexes for **every component** are retained in `earlier.diagnostics.json` and `offline-comparison.json`.

| Intended feature | Constructed IDs / measurements | Status and evidence gap |
|---|---|---|
| Public living/dining | `main-living-floor`, 16×13m = 208m²; main/view walls and `main-roof` | Constructed open hall envelope; separate dining/accommodation allocation unrecorded. No programme entry. |
| Two guest bedrooms | `west-wing-floor`, 8×10m = 80m²; guest perimeter and divider | Partial; one slab does not prove two complete bedrooms, and closed boundaries leave connections unresolved. |
| Kitchen/service | Narrative arrival-side east zone | No separately allocated kitchen floor/enclosure/equipment evidence. Missing as functional accommodation. |
| Upper suite/lounge | `upper-suite-floor`, 10×8m = 80m²; upper enclosure/roof, sofa | Partial; intended lounge and suite share an unallocated floor. Bathrooms/closets absent. |
| Internal stair/landing | `stair-tread-01`…`08`, each 1.35m²; upper floor | Eight ~0.4m rises and uncut host roof/floor; blocked clearance. Geometry is present, usable vertical access is not. |
| Arrival | `arrival-walk` 38.64m², `entry-threshold` 5.6m², `entry-door`, canopy/posts | Basic constructed approach and door; weak monumental hierarchy compared with requested distinctive entrance. |
| Upper terrace | `upper-terrace-floor`, 26m²; three railing elements | Supported slab/guards present; upper view glazing is not a terrace door. |
| Waterfront loggia | `waterside-loggia-floor`, 80m², roof/posts | Constructed shaded outdoor area; intended living connection is glazing, and dry route has a 0.8m break before coping. |
| Pool | `pool-basin-bottom` 72m², perimeter/copings, `pool-water` | Water centre Y=-0.45 below flat ground; no excavation occurs. Renders show ground where water should be. Basin/water edge alignment also incomplete. |
| Waterfront pavilion | `waterfront-pavilion`, `pavilion-approach` 16m² | Built pinned curved component; bespoke curved design not established, declared setback not substantiated. |
| Roof/facade | five roofs, six openings, one screen | Real roof hierarchy and glazing, but blank arrival/side walls, sparse bays and material depth. |

The three principal room-floor surfaces sum to 368m² before envelope/interior deductions; this is **not** verified net internal area and excludes outdoor plates, stairs and pool. The report does not claim the monetary value determines an appropriate area. It shows a mismatch between “substantial exceptional mansion” narrative and weakly developed accommodation/geometry.

Historical A used 60 add operations/60 elements, one parent attachment, no assemble/place-on/scale-assembly. Retained provider finish `stop`; 7,264 output tokens including 1,498 reasoning tokens, versus 30,000 cap. Thus output/operation limits did not force this particular modest scene. Internal reasoning-token counts reveal no private reasoning content. The executor reproduces supplied geometry exactly; no hidden simplification is observed. The unchanged renderer's lack of excavation exposes the below-ground pool error rather than causing a sophisticated pool to disappear arbitrarily.

## 6. Visual assessment and causes

Matched views show A's arrival as a small, largely opaque composition with a thin canopy; its poolside has a large repeated curved pavilion in the foreground and little developed main-residence detail. The primitive study shows markedly larger/differentiated residential volumes, articulated openings, colonnade, portal and belvedere under identical rendering. Its repetitive glazing and missing internal access prevent treating it as a complete luxury home. Original Solana adds a more individual tall entrance, layered roofs, recessed upper volume, fitted glazing, furnishing and coordinated foreground. These are subjective architectural judgments; blocked stairs, unavailable programme, closed interfaces and buried water are separately confirmed geometric/evidence defects.

Direct answers to the ten causal questions:

1. The original process documented a stronger resolved concept and coordinated dimensions before final delivery. Hidden model concept development cannot be compared.
2. Some original/custom code geometry remains inaccessible, especially arches, vegetation, detailed furnishing and pool extras. Most missing massing/entrance/roof-depth quality is already expressible.
3. Yes: original roof/soffit/fascia, portal, windows, stair and pool components coordinate more detailed parts. A barely uses available assemblies/details.
4. Visual inspection demonstrably produced corrections; its exact causal share in overall beauty is unmeasured.
5. The request is long and instruction-heavy, but it includes a coherent design task. Instruction overload is a hypothesis, not demonstrated cause; no broad prompt rewrite justified.
6. A chose restrained accommodation despite explicitly describing mansion ambition. Price guidance permits restraint and avoids a false area formula. It may contribute, but causality is unproven.
7. There is enough supplied information to propose a coherent conceptual residence with disclosed assumptions. Survey/household/site data remain missing; they do not explain a blocked stair.
8. Yes, concrete retained evidence shows ideas such as upper access, private suites and connected pool terrace fail in geometry. Planning is also underdeveloped; this is not exclusively a translator problem.
9. Not in A: 60/400 elements, 60/800 operations, stop at 7,264/30,000 output tokens. Larger future programmes could encounter limits, but that is not this observed failure.
10. Visual feedback has documented correction value; examples may help but are untested here. The strongest first-pass direction is programme-to-geometry coordination using existing capabilities, with honest unsupported disclosures and deterministic checks. A paid second visual pass is a different workflow budget and was not added.

## 7. Implemented changes and limits

A concrete integration defect was corrected: Generate previously bypassed the existing strict-nullable construction-schema adapter and used `strictJsonSchema:false`, while Redesign/Complete used strict output. `src/lib/villa/scene/terra.ts: sceneResponseFormatSchema` now applies the same adapter to Generate; `src/app/api/ai/scene/route.ts` enables strict formatting for Generate. A concise Generate note explains null for unused optional fields and programme commitments. Refine retains its existing schema behavior. No new schema/engine/store, geometry repair or automatic completion call was introduced.

The adapter requires every wire property and uses null only for formerly optional properties; validation removes those nulls before applying the existing runtime schema. It never invents dimensions, operations or programme. Legacy compatibility remains intact: programme omission/null can still be observed and reported as planning failure. A stricter new programme contract is a candidate improvement, but changing compatibility and accommodation requirements without a tested current response would exceed the demonstrated integration fix.

`generateStrict.test.ts` checks recursive strict compatibility and exact element preservation through nullable normalization. Existing generation/programme/diagnostic tests passed (12 tests across four files). Additional homepage/context/schema regression run passed eight tests across three files (one schema test overlaps the first run); `npm run typecheck` passed. These checks establish contract safety, **not architectural quality**.

Before the first preflight, normal `readLibrary` ran its existing idempotent schema initializer against the configured database. No new migration or schema change was authored; nevertheless invoking initialization was avoidable. The harness now suppresses initializer DDL for subsequent reads of the existing schema. No architectural/library approvals or project versions were intentionally written; only normal application audit/usage storage would run on an actual handler call.

The live script has a durable exclusive attempt marker, one-transport guard, zero SDK retries, exact request/response retention and separate unapproved output. After initial reviewer rejection, execution waited for the user’s explicit context-transmission approval. It then made exactly one transport call; no indirect bypass, retry, redesign, completion, visual-model review, research or image generation followed. The original retained sources were read only; no commits or deployment.

## 8. Single live test: actual request, response and programme

**Route response ID:** `66c57386-4c5c-4f50-a97e-8ec0ec80588b`.
**OpenAI response ID:** `resp_0e0a96b438ed878c006ae338a602b887d2bfbd5c9a988ebadd`.
**Provider request ID:** `req_9584d222194b4a27a8a73ca2630ac520` (`provider-http.json`).

Exact unmodified wire bodies: [request](provider-request.exact.json), [response](provider-response.exact.json). The normal application retains the same response under `.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.{json,wire.json,diagnostics.json,provider.txt}`; local report copies are `retained.*`. `call-started.json`, `call-result.json`, `wire-request-audit.json` and `live-audit.json` establish one transport, exact unchanged brief/context, strict schema, no tools, no retries and unchanged retained source. Actual system text was 47,502 characters. All eleven selected records and their versions match preflight, including `property-value-25m-50m@2`. No lesson or external research was delivered. App-level `system` became a developer-role wire item, followed by the user JSON brief.

Provider usage: **11,908 input tokens, 8,311 output tokens including 2,699 reasoning tokens, 20,219 total**; cached read 0, reported cache write 11,905. Output allowance 30,000. No cost estimate or invoice claim is needed to establish the call limit. The complete response was rejected by geometry validation, not truncated by output budget.

### Observable choices

Terra selected **“Water Court Promenade”**: a long shared salon, lower west family and east guest pavilions, recessed upper owner retreat, pool court, entrance canopy and pinned curved open lounge. It explicitly selected this over a dispersed bungalow concept; no private alternative search is claimed. It treated $25m as subjective ambition in assumed USD, rather than construction cost. It returned eight programme commitments and ten knowledge decisions. `split-level-concept` was retrieved but has no explicit decision; selected knowledge does not establish causal use.

Accommodation remains broad allocations: the 180m² salon includes dining/kitchen without equipment or separation; 63m² family and 48m² guest pavilions have no bedroom/bath subdivisions; the 77m² owner shell has no dressing/bath partitions. The four main floor plates total **368m²**, coincidentally the same principal plate sum as historical A. This is a shell-surface sum, not certified interior area and not a prescribed value-to-area ratio. There are no explicit bedroom counts, garage, services or estate arrival court. Pool and pavilion are the selected luxury amenities. This is a more explicit programme record, but still an underdeveloped residential programme for the brief’s exceptional ambition.

The text is internally inconsistent: arrival is on the pool-facing side; `relationshipsAndViews` calls the east pavilion dining/service, while programme and operations call it a guest bedroom pavilion. The upper suite’s “rear view wall” faces -Z, opposite the positive-Z pool/water court. These contradictions are observable choices, not hidden reasoning.

### Intention to staged geometry

All items below belong to the **rolled-back diagnostic draft**. No row is an accepted built room. Full programme evidence, limitations, every element’s dimensions/world coordinates and zero-based operation indexes are in [LIVE-PROGRAMME-MAPPING.md](LIVE-PROGRAMME-MAPPING.md) and [live-audit.json](live-audit.json).

| Programme entry | Explicit operations / staged geometry | Assessment |
|---|---|---|
| Great salon, dining and kitchen | op 0 `assemble salon`; root 18×0.2×10m at [0,0.1,0], 180m²; generated rear/sides, four front bays, real door `salon-glass-1`, roof | Shell staged; dining/kitchen only open-plan allocations, no equipment/room partitions. |
| Family bedroom pavilion | op 1 `assemble family-wing`; 7×0.2×9m at [-13,0.1,0.5], 63m²; door `family-wing-glass-1` | Shell staged, no resolved bedrooms/baths. Pool-facing screen spans across its entry bay. |
| Guest bedroom pavilion | op 2 `assemble guest-wing`; 6×0.2×8m at [13,0.1,1], 48m²; door `guest-wing-glass-1` | Shell staged, no sleeping/bath subdivisions. Screen spans the entry; conflicts with prose describing dining/service here. |
| Upper owner suite | ops 11–19; `upper-floor` 11×0.2×7m at [0,3.6,-1.8], top Y=3.7; actual door and six wall segments; roof at Y=7.02 | Shell staged, but existing salon roof crosses its occupied height. Owner floor also lies inside the top of the salon enclosure. Dressing/bath absent. |
| Pool terrace and water court | op 3 pool assembly, op 4 `water-terrace`, 18×0.2×5m at [0,0.1,7.5]; near deck root `pool-court` at [0,0.15,11]; water 14×9m at world [0,0.2,16.95] | Real basin/walls/copings/dry circuit staged; water visible above ground, improvement over historical A. Programme invents four wall IDs; actual names are `pool-court-wall-x/z-minus/plus`. Basin plate is misfiled as enclosure evidence. |
| Open pool lounge | op 32 `pool-lounge` at [11,0.2,15], shell 8×3.8×6m, yaw -0.35 | Existing pinned curved component staged; its floor/roof are internal component geometry, not separately typed plate/roof IDs. Programme checker cannot credit the component as plate/wall/roof evidence. Its side dry deck is partly within the component bounds. |
| Arrival threshold | ops 5–8; walk 4×0.2×1.5m at [0,0.1,10.25], posts at X ±2.3 and Z=5.65, canopy at [0,4.1,5.65] | The actual salon door is X=-2.25, Z=4.85; one portal post is almost on that entry line. Small walk, offset door and central stair do not form the claimed grand coherent entrance. |
| Exterior stair and upper landing | ops 20–31; landing [0,3.6,2.3], ten volume steps at X=0, Z=6.75→2.25; top Y=.37→3.70 | Ten 0.37m rises with 0.5m runs; upper treads/landing below solid salon roof. Steps exist, but neither a usable exterior stair nor verified level access is established. Programme lists volume steps as floor plates and combines four supposed IDs into one malformed string. |

A valid strict JSON response does not guarantee correct references: the last floorIds string literally contains backticks and commas (`stair-08`,`stair-09`,`stair-10`,`upper-landing` inside one JSON string). It is retained unchanged. Invalid/mismatched programme IDs must not be interpreted as repaired references. Conversely, “wrong kind” does not mean geometry is absent: stair solids and the pinned pavilion really exist. Review warnings are evidence limits; they are not all geometric defects.

### Exact point of rejection and additional physical defects

The 33 requested operations are **four assemblies + 29 adds**, expanded to **88 elements**, with 56 child attachments. This uses more coordinated components than historical A, but its main assembly is only one storey and is composed incompatibly with the upper floor/roof. No place-on, scale-assembly, remove or roof replacement was requested. 88/400 elements and 33/800 operations leave ample budget.

The existing `relationships.ts` rule compares assembly roof **XZ projections without testing vertical separation**. It rejects salon-roof against the family/guest roofs, entry canopy and upper roof (six reported directed findings, four unique pairs). This is a deliberate unsupported assembly-junction restriction, covered by existing tests. It is **not** proof that every pair’s 3D roof solids collide. Family/guest roof cores occupy Y=3.5–3.75 while salon roof occupies Y=4–4.25; upper roof Y=6.9–7.14 is likewise vertically separate. Nevertheless they violate this current assembly contract. That restriction was not relaxed merely to accept the test.

There are also physical conflicts independent of that conservative rule:

- `entry-canopy` core Y=3.975–4.225 intersects the salon roof core Y=4–4.25 where X/Z spans overlap.
- `upper-floor` walking datum is Y=3.7 while the salon roof core fills Y=4–4.25 across the owner shell. That slab passes through the proposed upper room only 0.3m above its floor. No cutout/removal/replacement operation resolves it.
- The upper stair/landing also remains under that solid roof. The stair’s 0.37m successive rises and its route into the salon footprint contradict the claimed carefully accessed exterior ascent. Source uses volumes, so the current plate-only focused stair detector does not catch the complete flight. This is a diagnostic coverage limitation, not successful access.
- The salon door is off-centre while the central stair occupies the front composition; the west canopy post is at X=-2.3, near door centre X=-2.25. Front screens also span the family/guest entry bay paths. Their route interference needs local clearance review rather than assuming an accessible passage.

`stageSceneOperations` replay reproduces all 88 draft elements exactly (`stagedExact:true` in live-audit). The executor did not shrink or “simplify” the design. It refused to apply it. The original rejection message identified add ops 8 and 19 but omitted assemble ops 0–2; a post-test diagnostic fix now reports responsible assembly roots as well. Original response/error files remain untouched.

### Actual rendered inspection

Five actual WebGL previews are retained in `live-draft-{arrival,aerial,entrance,poolside,actual-entry}.png`, with 88 rendered operation IDs, finite mesh positions and camera evidence in `live-browser-result.json`. Four use the same world camera positions/targets and FOV 40 as the earlier result/study. **These previews deliberately display a rejected diagnostic draft in isolated browser storage, not an approved or applied house.** APIs and external requests were blocked; no model visual review ran.

The live design puts the entrance on +Z. The fixed -Z “arrival/entrance” comparison views therefore expose its blank rear; `actual-entry` separately inspects the pool-facing entrance. Original Solana and earlier A also use matched world views, but their architectural orientation and foreground differ; there is no equal semantic exposure or controlled aesthetic score claim.

Subjective assessment: the draft still reads as a small symmetrical three-block residence capped by a plain upper box, with broad unarticulated side/rear walls and a generic reused elliptical lounge. It has a visible pool, separate private shells, screens and layered levels, but lacks the original’s entrance hierarchy, furnishing, facade depth and coordinated spatial sequence. It does not convincingly meet the requested remarkable $25m estate ambition. More library delivery and more parts alone did not close the gap.

Confirmed progress relative to retained A: explicit programme (previously absent), four construction assemblies, many parented components, real multiple shell entries and above-ground visible pool water. Confirmed regression/limit: no accepted scene in this test; upper access and room/roof composition are still unresolved. This is not a controlled before/after quality attribution to the strict-format fix.

## 9. Post-call fixes, validation and strongest improvement

The pre-call fix made Generate use the existing strict construction adapter/provider option. The live response passed SDK/runtime schema and produced a complete plan/operations object, demonstrating format integration worked for this request; it did not demonstrate architectural success.

The live evidence justified three additional narrow changes to `src/lib/villa/scene/terra.ts`, **after** the single call:

1. Pool assembly instructions now expose actual child ID/kind suffixes, so programme references can cite generated basin/wall/deck parts rather than inventing names. The live response had not received this new text.
2. Assembly instructions now explicitly state that roof-junction checks use X/Z footprints regardless of elevation and also compare primitive roofs over an assembly. For a multilevel main residence/overlapping canopy, they direct the model to the already-supported primitive enclosure/slab/roof route rather than stacking roofs over a one-storey assembly. No validator gate was weakened and no geometry builder was added.
3. Rejection provenance now recognizes `assemble.assembly.parameters.id`, so responsible operation indexes include assembled roots as well as primitive adds. This is a diagnostics-only correction; it does not accept or change the rejected house.

`assemblyEvidence.test.ts` verifies responsible assembly operations and correspondence of documented pool IDs to the actual builder. The final focused assembly/schema/diagnostics run passed **12 tests across four files**, including existing collision, transform, budget and persistence coverage. Earlier homepage/context regressions passed; `npm run typecheck` passed after these edits. No additional Generate or repair call validated the post-call guidance, so first-pass quality benefit remains unmeasured.

**The strongest evidence-backed first-pass improvement is coherent programme-to-geometry coordination for the main residence, especially levels/access/roof ownership, using the existing primitives and exact assembly contracts.** The current model has enough contextual information and plenty of output budget; it selects a modest set of shells, claims accommodation inside them, and mixes a one-storey assembly roof with upper-level primitives without resolving the junction. Missing local site data or unavailable arches cannot explain that conflict. Better examples of complete, editable, functionally connected primitive residences and deterministic commitment checks would directly target it. A future visual correction pass has documented value from Playground work, but is a separate paid iteration and was not added here.

## 10. Twelve requested conclusions

1. **Where information comes from:** foundation/design guide, selected approved library/recipes, derived construction contracts, assemblies, programming/spatial guidance and a short Playground summary. Pretraining remains uninspectable.
2. **What this live test received:** exact 47,502-character context, unchanged brief, eleven identified records, no lessons/images/research, strict schema and existing configured model; wire audit proves equality, not merely preflight intention.
3. **Observable stages:** exact brief → mansion/value interpretation → ranked retrieval → Water Court Promenade concept/eight-entry programme → relationships → 33 operations → 88 staged parts → atomic rejection → diagnostic rendering. No hidden reasoning claimed.
4. **How Playground differed:** source-code freedom, deliberately coordinated components and documented visual inspection/correction over multiple development steps.
5. **Why it looked better:** resolved hierarchy/entrance, layered details, useful negative space, meaningful glazing, furnishings/foreground and iterative correction. Relative Claude model ability is not established.
6. **What Terra planned:** shared salon/dining/kitchen, family/guest private shells, upper owner suite, pool court, pinned open lounge, arrival and exterior stair. No complete bedroom/bath/service programme or explicit counts.
7. **What it constructed:** no accepted house. It staged an unapproved 88-element draft, including 368m² of principal shell-floor surfaces, three wing assemblies, pool assembly and primitive upper shell/stair.
8. **Where quality was lost:** underdeveloped accommodation and contradictory zoning, then incompatible assembly/upper-level geometry and access. The executor rejects faithfully rather than rendering a secretly simplified mansion.
9. **What went unused:** full room partitions, kitchen/bath/service planning, primitive multi-level/roof junction coordination, safe manual stairs/voids, richer portals/facades and follow-up visual feedback. Most unselected records were irrelevant or budget-limited, not missing infrastructure.
10. **Implemented changes:** strict Generate formatting before the call; exact pool child-reference guidance, explicit existing roof-envelope restriction and assembly rejection provenance after it. Same engine/store/executor; no generated-house repair.
11. **Strongest improvement:** enforce coherent selected room/access/level/roof commitments against actual geometry in the existing workflow; use complete coordinated examples/capability semantics, rather than adding more disconnected knowledge. Do not confuse prettier shells with functional accommodation.
12. **Closer to the requested house:** programme observability, assembly use and visible pool construction improved, but **this test did not deliver an accepted or convincing exceptional estate**. Post-call integration clarifications are untested by another generation. Exactly one paid call is complete; no retries or further paid work occurred.

### Evidence links

| View | Earlier Terra A | Current live rejected draft | Original Solana | Same-vocabulary developer study |
|---|---|---|---|---|
| Arrival world view | [image](earlier-arrival.png) | [image](live-draft-arrival.png) | [image](solana-arrival.png) | [image](study-arrival.png) |
| Aerial | [image](earlier-aerial.png) | [image](live-draft-aerial.png) | [image](solana-aerial.png) | [image](study-aerial.png) |
| Entrance world view | [image](earlier-entrance.png) | [image](live-draft-entrance.png) | [image](solana-entrance.png) | [image](study-entrance.png) |
| Poolside world view | [image](earlier-poolside.png) | [image](live-draft-poolside.png) | [image](solana-poolside.png) | [image](study-poolside.png) |

Additional [actual pool-facing entry](live-draft-actual-entry.png). [Exact provider request](provider-request.exact.json), [exact provider response](provider-response.exact.json), [retained handler response](retained.json), [live programme-to-element mappings](LIVE-PROGRAMME-MAPPING.md), [live measurements/audit](live-audit.json), [retained execution diagnostics](retained.diagnostics.json), [wire equality checks](wire-request-audit.json).
