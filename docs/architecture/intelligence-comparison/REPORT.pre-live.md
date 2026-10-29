# Terra architectural intelligence investigation — 29 October 2026

The strongest retained evidence points to underdeveloped accommodation selection and weak programme-to-construction coordination, rather than a downstream renderer simplifying sophisticated architecture. The original Playground combined a deliberately authored concept, coordinated components, source-code freedom and repeated visual correction. No controlled Claude-versus-Terra benchmark exists here.

**Live-test status: blocked before submission by automatic approval review. Zero paid calls made in this investigation.** The review requested explicit approval to send the brief plus architectural-library/system context to OpenAI. The preflight is actual application-supplied context, not evidence of provider receipt. No response ID or new live architecture is claimed. Historical findings below are clearly labelled. The single-call allowance remains unused.

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

Actual captures: `earlier-{arrival,aerial,entrance,poolside}.png`, `study-{arrival,aerial,entrance,poolside}.png`; browser evidence in `browser-result.json`. All API/external requests blocked, isolated storage, original files unchanged. Original Solana captures are included as `solana-{arrival,aerial,entrance,poolside}.png`, verified on `?scene=legacy` by the visible Villa Solana heading and absence of direct-scene operation IDs. Its separate `solana-browser-result.json` records the same world cameras; FOV was set to 40 and canvas to 1130×960 to match workspace captures. Original landscaping, furnishings and renderer settings remain an explicit confound. Camera names denote fixed world views: the primitive study faces the opposite Z direction, so its poolside/arrival semantic sides are reversed; use the full four-view set rather than treating one image as equal semantic exposure. No new live result is disguised as an offline study.

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

The live script has a durable exclusive attempt marker, one-transport guard, zero SDK retries, exact request/response retention and separate unapproved output. After reviewer rejection it was not executed through an indirect alternative. The original retained sources were read only; no commits or deployment.

## 8. Twelve requested conclusions

1. Terra gets application architectural information from the foundation/design guide, selected existing approved library/recipes, runtime-derived contracts, assembly guidance, programme instructions and a short Playground summary; model pretraining cannot be inspected.
2. Current exact preflight is retained; **no current provider receipt** is claimed while submission remains blocked.
3. Observable stages are brief/regex context/retrieval/explicit plan/references/operations/atomic execution/rendering; no hidden thought trace.
4. Playground had source-code modification, coordinated components, bespoke geometry and documented render-review iterations.
5. Its visual advantage comes from resolved hierarchy, negative space, layered detail, complete foreground and iterative correction; comparative model superiority is unproven.
6. No new live programme exists yet. Historical A proposed public hall, guest wing, upper suite, loggia, pool and pavilion, but omitted programme commitments.
7. Historical A actually constructed 60 parts with 368m² of principal room-floor surfaces and serious access/pool omissions; exact evidence is retained.
8. Quality is lost in accommodation/commitment selection and construction coordination before rendering; downstream simplification is disproved for A.
9. Hundreds of eligible/unselected records, actual wing/pool assemblies, detailed openings/portals, coordinated supports, stairs/voids and richer parts are available but largely unused. Not every unselected entry is relevant or desirable.
10. Generate now uses the existing strict construction-format adapter and strict provider setting; diagnostics, offline analysis and matched capture harness were added.
11. The strongest first-pass improvement direction is a coherent selected programme whose room/access/level commitments are translated and checked against actual geometry in the same response. It addresses observed failures more directly than adding disconnected knowledge. No new model quality gain is claimed before a live test.
12. Terra is closer in request-contract consistency and diagnostic clarity; evidence does **not yet establish** that it produces the requested beautiful estate on the first prompt. The requested live test remains unfinished pending explicit context-transmission approval.
