# Unified architectural knowledge audit — 28 October 2026

The homepage direct-scene flow now has one request-context assembler: `architecturalRequestContext`. It reads the existing architectural library and legacy recipe records through `generationKnowledge`, then includes eligible reviewed lessons. Generate, Refine, Redesign and Complete Architecture use this same interface and existing executor. Storage and revision history remain intact. This demonstrates request delivery and honest evidence handling; it does not demonstrate improved model-authored architecture.

## Actual inventory

A direct `BEGIN READ ONLY` / `SELECT kind, data FROM library_docs` / `ROLLBACK` against the configured Postgres database succeeded. No store initialization, DDL, migration or write was used. `library-snapshot.json` contains the captured recipe/knowledge records used by offline tests; it is an audit fixture, not runtime storage. `inventory.json` lists every architectural entry and category.

| Inventory | Exact count |
|---|---:|
| Effective architectural knowledge entries | 310 |
| Approved active architectural entries | 310 |
| Proposed / pending architectural entries | 0 |
| Retired / disabled architectural entries | 0 |
| Separate rejected status in architectural schema | Not supported |
| Architectural entries of kind recipe | 249 |
| Architectural entries of kind principle | 46 |
| Architectural entries of kind experience | 15 |
| Property-value recipes, included in 249 | 9 |
| Expanded composable records | 240 |
| Expanded composable recipes / experience fragments | 225 / 15 |
| Architectural tradition/style category, overlapping the above | 30 |
| Construction category, overlapping the above | 32 |
| Existing legacy reusable recipes | 24 |
| Approved legacy recipes | 24 |
| Proposed / rejected / archived legacy recipes | 0 / 0 / 0 |
| Total approved records accessible by the shared reader | 334 |
| Saved feedback summaries | 2 |
| Saved real-provider feedback summaries | 0 |
| Saved mock feedback summaries, excluded | 2 |
| Verified reviewed-design source entries | 0 |
| Repository-curated failure/experience entries | 15 |
| Fragment-detail overrides, already part of existing entries | 5 |
| Normalized-title duplicates within 310 entries | 0 |
| Identical placement + principles within 310 entries | 0 |

The 301 figure is the 61 original/extended entries plus 240 expanded records. Adding nine property-value entries produces 310. Postgres stores nine architectural revision records with those same property-value IDs; they override seed records by ID and do not increase 310 to 319. The 24 legacy recipes are a different existing collection and increase the accessible record inventory to 334. Eleven categories are classification labels, not eleven additional entries. The five `fragmentDetails` records refine existing recipes; they are not additional recipes. Nine property-value entries are neither the entire recipe inventory nor nine separate services.

Overlap requires a definition. The reproducible heuristic in `inventory.json` finds 83 same-category pairs involving 81 records with at least two shared significant title words. This flags shared subject matter, not duplicate instructions; it includes related value bands and related pool/arrival details. It is not an exact semantic-duplicate count. No blanket deletion or approval change is justified. Exact duplicate selected placement/principles are removed at read time; category diversification reduces repeated subjects while retaining compatible variants.

## Source-to-consumer map

Paths below are repository relative.

| Source and reader | Actual consumer and disposition |
|---|---|
| `src/lib/villa/scene/designGuide.ts`: `ARCHITECTURAL_DESIGN_GUIDE` | Concise permanent foundation embedded once by `scene/terra.ts: SCENE_SYSTEM_PROMPT`; all direct-scene modes. Includes spatial, climate, support and assembly fundamentals. |
| `src/lib/library/architecture/seeds.ts`: `ARCHITECTURAL_KNOWLEDGE_SEEDS` | `service.ts: knowledgeRecords` / `latestKnowledge` merge stored revisions by ID; then `generationKnowledge` → shared retrieval. Already connected to Generate before this change. |
| `architecture/guidance.ts`: `EXTENDED_ARCHITECTURAL_GUIDANCE` | Included by seeds; principles, planning, envelope, arrival and climate guidance. |
| `architecture/expanded.ts`: `EXPANDED_ARCHITECTURAL_GUIDANCE` | Included by seeds; 240 composable records across the same library. No separate composable database. |
| `architecture/fragments.ts`: `fragmentDetails` | Refines five expanded pool entries and relevance terms. Their construction details are included only when the entry is selected. |
| `architecture/propertyValue.ts`: `PROPERTY_VALUE_GUIDANCE`, `propertyValueContext` | Nine seed/stored entries; explicit currency chooses one reference, not a floor-area or amenity formula. Already connected to Generate. |
| `src/lib/library/store.ts`: `readLibrary` | Existing Postgres/file library backend; preserves approvals/history. Runtime uses the existing backend unchanged. |
| Existing `recipes` records; `architecture/legacyRecipes.ts: legacyRecipeKnowledge` | Previously reachable through legacy space lookup but absent from direct-scene generation. Now adapted in memory into `generationKnowledge`; original IDs remain visible under `legacy-recipe-` namespace. Existing approval, version, compatible scales, guidance, parameters and relationships retained. No import or reapproval. |
| `architecture/retrieval.ts`: `retrieveArchitecturalKnowledge` | Single ranking/selection path for all 334 records; approved/current, relevant scale, requested specialist, property-band and task filtering; category coverage and bounded context. |
| `architecture/constructibility.ts`: `constructionFor`, `knowledgeCategory` | Existing construction metadata/defaults included in each selected context record; not an alternate retrieval service. Defaults are approximate and do not certify an assembly. |
| `src/lib/villa/design-learning-store.ts`: `listDesignLessonSummaries`; `design-learning.ts: learningContext` | Existing small summary reader and lesson relevance filter now called inside the shared context assembler. Real feedback may provide guidance; mock feedback never enters the prompt. Both current summaries are mocks. |
| `src/lib/villa/scene/planning.ts`: `ARCHITECTURAL_PLANNING_INSTRUCTIONS`, `reviewSceneArchitecture` | One direct-scene planning/construction intent contract and post-execution knowledge-use audit; not a knowledge database. |
| `scene/terra.ts`: `prepareArchitectureCompletion`, `sceneSystemPrompt`; `scene/twoStage.ts`: `developmentRequest` | Prepare requests for the same `/api/ai/scene` handler. Refine stays scoped; Redesign/Complete retrieve using retained intent and the requested development task. |
| `scene/knowledgeContext.ts`: `architecturalRequestContext` | Sole direct-scene context assembler: foundation + selected library context + eligible lessons. Exact context, query, selected IDs, exclusions and character counts are retained with responses. |
| `src/app/api/ai/scene/route.ts`: `POST` | Calls the shared assembler once, supplies `system` and `sceneMessages(input)` to Terra, then `resolveSceneResult`. `api/ai/villa/scene/route.ts` re-exports this handler. |
| `scene/terra.ts: resolveSceneResult` → `scene/model.ts: applySceneOperations`, `validateScene` | Existing atomic executor, transformed support/attachment checks and editable elements. Evidence retained across edits and reload. No scene-engine change. |
| `docs/architecture/construction-assemblies/README.md`, `scene/focusedConstruction.ts: focusedConstructionFindings` | Developer proof/documentation and deterministic post-construction findings. Not dynamically dumped into model context. Relevant stair/pool assembly relationships already live in guide and library. |
| `src/lib/library/knowledge/catalog.ts`: `KNOWLEDGE_CATALOG`, `pickKnowledgeForSpace`, `matchKnowledge`; `knowledge/knowledge.ts` | Legacy needs/coverage taxonomy and gap tracking, not 310 approved architectural entries. `spaceRecipes.ts: retrieveRecipesWithDiagnostics` uses it for old procedural/outdoor paths. Not appended as another competing direct-scene brain. |
| `src/lib/ai/systemPrompt.ts: buildScopedSystemPrompt`, `ai/designGuidance.ts` | Legacy house/procedural geometry contract, scale/tier defaults and resort planning. Used by old house paths; absent from the captured homepage request. Automatic wings/family defaults are incompatible with direct operations and are intentionally not imported. |
| `src/lib/villa/terra.ts: villaSystemPrompt`, `compositionSystemPrompt`; `api/ai/villa/route.ts` | Retained legacy villa/composition playground and separate configuration engine. Not called by homepage direct-scene Generate. Left intact for existing projects. |
| `src/app/api/ai/plan/route.ts`, `api/ai/house/route.ts` | Other retained plan/blueprint/V2/V3 contracts for historical project modes. Not invoked by the current homepage flow and not injected into its context. |

The actual homepage route is `src/app/page.tsx: handleGenerate` → persisted `direct-scene` project + pending brief → workspace `src/components/scene/OperationStudio.tsx` → `/api/ai/scene: POST` → `architecturalRequestContext` → Terra → `resolveSceneResult` → editable scene. The offline tests invoke that production POST handler. They do not simulate browser clicks; existing homepage/executor/persistence regressions cover the routing and saved scene behavior.

## Consolidation and demonstrated instruction conflicts

The handler previously assembled library context and lessons separately. That assembly now lives in one small function. The existing library reader also includes the 24 formerly disconnected approved recipes via an in-memory adapter. There is no new database, AI agent, category service or executor.

Previously every edit used the small edit retrieval budget and only the new prompt. This made broad Redesign/Complete requests miss retained design intent and supplied the retrieval header's “Scoped edit” framing. These modes now use development retrieval with retained intent, while their explicit construction permissions remain in the existing mode contract. Refine retains its narrow window-edit filtering and preservation instructions.

Specialist matching previously treated the substring “spa” inside “Spanish” as an amenity requirement. It now checks word boundaries. Exact-title requests previously could fail the generic-tag applicability filter; explicit title matches now qualify. The exhaustive 310-entry test demonstrates these entries reach relevance ranking for explicit subject requests, with omissions limited to documented budgets.

The retrieval header repeated foundation instructions about actual floors/roofs, circulation and construction evidence and said to cite constructed IDs even for guidance-only decisions. It is now a short context/precedence statement. The existing foundation remains authoritative about dispositions, primitives and construction. This removes repeated instructions and avoids implying every selected principle must construct an element. Stored legacy suggestions and parameter ranges explicitly yield to user scope and the scene construction contract: they do not enable unsupported terrain, shading mechanisms, lighting simulations or materials.

The final four captured Generate systems contain the design guide exactly once, one selected library block and no legacy house/villa prompt. No basic rectangular-house restriction or automatic family-scale builder is present. Flat ground for new generation, rectangular primitives, actual support, opening fit, operation/schema budgets and honest unsupported disclosures remain real implementation constraints. No conflict between these constraints and creative composition was demonstrated; none was removed speculatively. The foundation still repeats some safety/coordination concepts across planning and primitive descriptions; that reinforcement is not a competing design brain.

## Four real-handler request captures

Every case considers the same **334 approved active records**. “Relevant” means candidates surviving task applicability before the retrieval budget. Every omitted ID and reason appears in `homepage-requests.json` under `knowledge.metrics.excluded`. The exact selected text is `knowledge.text`; the complete final system is `system`, with exact user messages in `messages`. No prompt excerpt substitutes for those artifacts.

| Brief | Relevant candidates | Selected | Library/lesson chars | Estimated context tokens | Final system chars |
|---|---:|---:|---:|---:|---:|
| $250k compact family home | 12 | 4 | 6,072 | 1,518 | 25,952 |
| $1m Mediterranean courtyard villa | 12 | 8 | 10,750 | 2,688 | 30,630 |
| $5m contemporary tropical residence | 31 | 9 | 17,423 | 4,356 | 37,303 |
| $25m Caribbean waterfront mansion | 22 | 12 | 17,555 | 4,389 | 37,435 |

Tokens are `ceil(characters / 4)`, not tokenizer measurements or billed provider tokens. The common foundation is 19,880 characters. User messages, reference pixels and provider JSON Schema incur additional input overhead; exact isolated token billing cannot be measured offline. Full system character counts above exclude messages and schema. Lessons add zero characters for these briefs because both saved summaries are mocks. A higher-value task receives a larger knowledge budget for architectural ambition without inferring its floor area or requiring a mansion scale.

**$250k compact family home**

Selected IDs: `property-value-250k-500k`, `compact-family`, `compact-core-order`, `covered-threshold`.

Categories: property-value, programme, composition, arrival.

Exclusions: 8 different or unspecified property value, 34 incompatible scale, 226 no task relevance, 4 required qualifier absent, 8 retrieval budget, 50 specialist use absent or excluded.

**$1m Mediterranean courtyard villa**

Selected IDs: `property-value-1m-3m`, `mediterranean-courtyard`, `deep-reveals`, `covered-threshold`, `private-bedroom-wing`, `base-middle-top`, `facade-materials`, `courtyard-proportion`.

Categories: property-value, roof-outdoor, envelope, arrival, programme, composition, materials.

Exclusions: 8 different or unspecified property value, 12 incompatible scale, 245 no task relevance, 4 required qualifier absent, 4 retrieval budget, 53 specialist use absent or excluded.

**$5m contemporary tropical residence**

Selected IDs: `property-value-5m-10m`, `tropical-envelope`, `legacy-recipe-15dd352f-73be-4803-a630-d590ba125c97`, `legacy-recipe-3b2b038a-d096-4f7d-a405-001fb1493795`, `legacy-recipe-5ef674af-406c-465c-8608-4f8cbe8e46fc`, `asymmetric-balance`, `private-bedroom-wing`, `contemporary-rustic`, `deep-overhang`.

Categories: property-value, envelope, arrival, roof-outdoor, climate-site, composition, programme, tradition.

Exclusions: 8 different or unspecified property value, 12 incompatible scale, 226 no task relevance, 4 required qualifier absent, 22 retrieval budget, 53 specialist use absent or excluded.

**$25m Caribbean waterfront mansion**

Selected IDs: `property-value-25m-50m`, `estate-composition`, `tropical-envelope`, `waterfront-estate`, `outdoor-entertaining`, `legacy-recipe-65a14c7e-0559-45f0-adfe-589551ca499c`, `covered-threshold`, `facade-materials`, `site-waterfront-setback-limit`, `coastal-durability`, `hip-shelter`, `living-view`.

Categories: property-value, composition, envelope, climate-site, programme, roof-outdoor, arrival, materials.

Exclusions: 8 different or unspecified property value, 24 incompatible scale, 223 no task relevance, 4 required qualifier absent, 10 retrieval budget, 53 specialist use absent or excluded.

All selected records carry `construction` including allowed operations, required primitive kinds, support/datums, materials and unsupported limits. The compact brief receives enclosure/arrival fundamentals; the villa receives courtyard/envelope/threshold guidance; the tropical residence receives shade/roof/arrival/indoor-outdoor guidance and actual stored recipes; the mansion receives hierarchy/privacy/coastal envelope and outdoor connections. These four minimal briefs do not explicitly request pools, gyms or docks; specialist amenity recipes are not forced in because of price or waterfront alone. Existing focused tests additionally cover pool fragments, rooftop access, gym/garage requests and user exclusions.

## Evidence from retrieval to actual construction

The trace is: selected stable knowledge ID/version → `architecturalPlan.designDecisions` with disposition and optional actual element IDs → planned circulation, massing, views and datums → atomic operations → editable elements → `reviewSceneArchitecture` / relationship and focused construction findings. This existing evidence path is preserved. Constructed decisions require real referenced elements and necessary primitive kinds; transformed proximity/support checks add limited relationship evidence. Guidance and considered entries need no invented element. Unsupported and selected-but-unconstructed entries remain distinguishable. A complete set of kinds is never proof of a complete architectural feature; `verifiedComplete` remains false.

The four provider calls were mocked with the same unchanged retained accepted response (78 operations), copied into `retained-response.json` with original source and SHA-256 provenance. They did not construct four new demonstration houses or modify any saved project. The resulting knowledge-use audit remains in each capture. Uncited retrieved records remain `selected-missing`; the replay never invents causal links to the old geometry. Existing construction tests separately verify partial/missing/guidance/considered/unsupported statuses, invalid transactions, scene persistence and undo/history integrity. This proves request delivery and honest construction auditing, not model influence on the retained output.

## Validation and remaining gaps

Focused run: 96 tests passed across twelve files, including exhaustive relevance-path checks for all 310 architectural entries, selection checks for all 24 stored recipes, four production-handler captures, all edit intents and exact-guidance deduplication. `npm run typecheck` passed. Changed-file ESLint passed. Full `npm run lint` ran and failed with 20 pre-existing explicit-any errors and five warnings in unrelated scripts (`coordinate-25m-mansion.ts`, `recover-25m-mansion.ts`, `redesign-controlled-once.ts`, `terra-basic-diagnosis.ts` and capture scripts). Those unrelated files were not modified for this task.

Reproduce inventory without network using `KNOWLEDGE_AUDIT_SNAPSHOT=1 npx vite-node --config vitest.config.mts scripts/knowledge-inventory.ts`. Without that flag it reads configured Postgres in a read-only transaction; it does not initialize schema. Reproduce the four captures with `npx vitest run src/app/api/ai/scene/route.knowledge.test.ts`.

Remaining limitations: retrieval uses deterministic terms/aliases and task/category coverage, not semantic embeddings; arbitrary paraphrases can miss relevant entries. Broad development uses retained intent, which may omit the original brief or contain stale claims; geometry remains authoritative. Legacy scale labels are translated to the existing knowledge vocabulary (cottage→compact, luxury→estate), without generating geometry. Legacy capabilities/required-kind defaults need model judgment and do not prove that a stored suggestion can be constructed. Exact text deduplication and category balancing reduce repetition; they do not settle every semantic overlap. The 32 construction-category records plus assembly foundation are accessible, but the reader does not automatically invent a second retrieval pass for every feature Terra might later choose. Model-selected stairs/pools still need explicit operations and review. Headroom, enclosure, route and pool checks remain limited and cannot certify functionality, engineering, code or safety. The full foundation remains about 5k estimated tokens before retrieved context and schema; this is a material input cost, not a free retrieval feature. Existing lessons are local-file summaries rather than shared Postgres records; the current store only reads its latest 200 summaries. No actual approved real-provider lessons exist in this environment.

**One future paid Generate is justified as the next behavioral evaluation**, preferably the $25m Caribbean brief with explicit programme/site assumptions and captured decision/element evidence. The offline evidence resolves delivery and duplication questions but cannot establish whether Terra composes and constructs better architecture. Success would require inspection of actual editable geometry and honest selected/constructed/guidance/unsupported accounting, not a passing request or attractive summary. No paid call was run or scheduled. No migration, commit, deployment, mansion repair or new knowledge recipe was performed.
