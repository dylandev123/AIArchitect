# Terra architectural intelligence audit — October 21, 2026

Terra now receives a coherent, shared architectural design process on the compact 2D and architectural-blueprint routes. Its ability to produce extraordinary architecture remains **unproven**. A functioning schema, faithful construction, or an attractive hand-authored fixture cannot establish natural design quality.

This audit reads the working implementation, including pre-existing uncommitted work. It makes focused instruction changes and one brief-context correction. No provider requests, paid generations, additional agents, commits, pushes, deployment, saved-project edits, V2 changes or advanced-terrain changes were made.

## 1. What instructions does Terra actually receive?

The application has several conditional paths, not one universal architectural prompt.

| Path | Actual assembly and dispatch | Content and budget |
| --- | --- | --- |
| Design 2D Plan | `src/app/api/ai/plan/route.ts:POST` → `planEvaluationPrompt()` in `src/lib/v3/architecturalPlanEvaluation.ts` | Architectural process, coordinate/capability rules and the **input** JSON schema of `v3PlanAuthoringSchema`. One user brief. One call, 10,000 output tokens, `maxRetries:0`, 270-second abort, 300-second route duration. No exterior response required. |
| Build saved 2D plan | Same route, `action:elaborate` → `planExteriorPrompt()` | Original brief, current checked-out immutable plan, and user's exterior instructions. Exterior-only schema. One separate, explicitly initiated call with the same limits. No automatic repair. |
| New flat full property, architectural flag enabled | `src/app/api/ai/house/route.ts:generateV3Scene` → `generateArchitecturalBlueprintV3` → `v3ArchitecturalBlueprintPrompt()` | One response containing canonical `plan` **and** `exterior`, plus architectural process and detailed construction capability rules. 10,000 output tokens, `maxRetries:0`; at most one narrowly scoped objective repair. No aesthetic review call. |
| Older direct V3 path | `generateV3Scene` → `v3SceneArchitectPrompt()` in `src/lib/v3/schema.ts` | Scene authoring instructions plus `V3_COMPOSITION_PROMPT`, `V3_ESTATE_PLAN_PROMPT`, `V3_CREATIVE_ARCHITECTURE_PROMPT`, `V3_FUNCTIONAL_COMPLETENESS_PROMPT`, `V3_LUXURY_SCALE_PROMPT`; optional `V3_BLUEPRINT_FIRST_PROMPT`. One authoring call plus at most one objective/design follow-up. SDK transport retries are not disabled here. |
| Existing finished V3 edits | `src/app/api/ai/house/route.ts:editV3Scene` | Local semantic-operation instructions plus `V3_COMPOSITION_PROMPT`, selected scene context and estate intent; 1,800 output tokens. This is not a fresh master-plan workflow. Ordinary chat is blocked against saved 2D evaluation plans. |

The architectural flag takes precedence over the older blueprint-first flag for new flat generation. `AI_V3_PLAN_EVALUATION=1` independently enables the 2D route. The local `.env.local` contains `AI_V3_ARCHITECTURAL_BLUEPRINT=1` and `AI_HOUSE_MODEL=gpt-5.6-terra`; it contains no plan-evaluation flag. This is file evidence, not proof of a running server's or deployed environment's process overrides. No flags were changed.

`src/lib/ai/model.ts:getAiModelId/getAiModel` uses `AI_HOUSE_MODEL` or `gpt-5.6-terra`, through the installed `@ai-sdk/openai` Responses adapter. There is **no explicitly configured reasoning effort, temperature, top-p, seed or output verbosity**. Provider defaults therefore matter, but their actual reasoning allocation is not established offline. `AI_PROVIDER_OPTIONS` only sets `strictJsonSchema:false`; its comment about `json_schema` does not describe these routes. They use `Output.json`, so the serialized request uses `text.format.type:json_object`. The exact schema is text in the developer message; local Zod checks enforce it after receipt.

The production-adapter tests confirm that the SDK converts the application's `system` string to a **developer** message for this model, followed by one user message. There are no separately composed hidden application developer instructions, few-shot conversations, tools, planner agents or history messages on these initial-design paths. Provider-internal instructions are outside this audit's visibility. Repairs reuse the developer prompt and add tightly bounded user instructions; the shared design process now expressly defers to preservation rules during repair/development.

The installed SDK sources supporting this trace are `node_modules/@ai-sdk/openai/src/openai-provider.ts`, `responses/openai-responses-language-model.ts`, `openai-language-model-capabilities.ts`, and `node_modules/ai/src/util/prepare-retries.ts` (default transport retries: two when unspecified). No assumption about current public model documentation or billing is needed for these local observations.

`src/lib/ai/generation.ts`, `designGuidance.ts`, `systemPrompt.ts` and `src/lib/house/scale.ts` contain older procedural/V2 guidance, including automatic wings and amenity counts. They are **not concatenated into either audited architectural-blueprint prompt**. Parity examples in `src/lib/v3/parity/` and recovered fixture JSON are not sent as generation examples. Existing reports and prompt snapshots in `docs/` are evidence, not active prompts.

Exact revised prompt snapshots and byte counts: [plan](terra-intelligence/plan-prompt.txt), [full property](terra-intelligence/fullProperty-prompt.txt), [exterior](terra-intelligence/exterior-prompt.txt), [machine evidence](terra-intelligence/evidence.json).

## 2. Does Terra follow a real architectural design process?

There is a real **data and construction sequence**, with a partially expressed creative process before this change. Do not confuse the two.

| Requested stage | Before this audit | Actual executable/preserved boundary |
| --- | --- | --- |
| Understand brief | Full-property prompt mentioned concept/style and requirements; compact 2D prompt had almost no interpretation guidance. | One raw brief; no independent brief-understanding artifact or call. The 2D route retains the original in scene metadata. |
| Imagine property | Explicit in full-property wording; compact 2D asked for a coherent estate and named components. | No separately executed concept stage. Concept and geometry arrive together in one response. |
| Draw estate layout | Present in both. | `preparePlanEvaluation`/`prepareV3ArchitecturalPlan` validate, lower and preserve site, building, outdoor and route semantics. |
| Plan conceptual rooms | Present in both schemas and coordinate guidance. | Host-local room rectangles, storeys and circulation reservations persist in `scene.interior`. No separate floor-planning call. |
| Assess architectural quality | Full prompt requested a self-check; compact prompt mostly requested valid geometry. | No independent aesthetic assessment or model self-correction loop in the 2D route. Geometry findings are returned. `reviewV3Architecture` is heuristic, not an architectural juror. |
| Preserve and develop | Substantially implemented. | Current-plan checkout, deterministic massing, exterior merge and `sameArchitecturalPlan` checks. Full-property generation executes plan → massing → exterior **after one response already contains both design sections**. |

`src/lib/v3/architecturalPlanning.ts:deriveArchitecturalPlan` is a read-only drawing projection. Its name does not mean another agent plans architecture. Likewise `designPipeline.sequence` describes processing boundaries, not three creative calls.

The new imagine → draw → review → preserve instructions remain **one-response guidance**. No code can prove that the model actually performed the mental review. Separate concept, floor-plan and critique artifacts are not saved, and this report does not claim otherwise.

## 3. What was missing from the architectural guidance?

The compact prompt lacked a useful order of design decisions: interpret location/budget/experience, choose a spatial idea, establish estate hierarchy, fit room relationships, and judge the resulting composition before finalizing. It named wings, pools and gardens without much guidance about why their relationships should make a good house.

Style/character, hierarchy, proportions, courtyards and arrival were encouraged in the full prompt, but were less developed in the 2D entry point. Privacy and views appeared as optional considerations, not a strong review of the drawing. Tropical shade, breeze paths, exposure and sheltered living were not concretely connected to conceptual room placement. Outdoor entertainment and landscaping were selectable features, with no guarantee of meaningful spatial integration. Exterior potential was considered more strongly in the full-property path than in the 2D path.

These areas now have a concise shared process. It encourages meaningful architectural judgment without requiring a pool, courtyard, number of wings, style family or luxury feature list. Unknown orientation, budget and climate data remain assumptions, not verified site facts. There is still no measured climate model, cost estimator, view analysis, room-by-room daylight assessment or architectural quality benchmark.

## 4. Which instructions are unnecessary or harmful?

| Finding | Why it matters | Disposition |
| --- | --- | --- |
| Compact 2D prompt led with a component list and technical rules | It encouraged field completion more strongly than a reasoned composition and review. | Replaced that opening with the shared process, keeping necessary coordinate/capability rules. |
| Full prompt's sequence moved from plan directly into exterior, with review as an afterthought | The model could commit exterior detail before testing whether arrival, rooms and outdoor spaces work together. | Composition review now explicitly precedes final plan preservation and exterior development. |
| Full prompt invited partitions when private separation seemed to need them | This competed with the stated conceptual-room task and consumed output on detailed boundary bookkeeping. | Detailed partitions/doors now deferred unless requested; requested detail remains supported. |
| Later exterior request omitted the original brief | A saved concept/requirement ledger may omit climate, experiential or style nuance. | Original brief is now transmitted alongside the current plan; plan-preservation instructions govern conflicts. |
| Full-property contract requires detailed construction decisions in the initial response | Roof IDs, program/entrance ledgers, precise flight choices, material rules, facade/assembly fields and fixed courtyard/grass policies compete for attention with architecture. | Kept for compatibility and faithful construction. Prefer compact 2D authoring for the first design assessment. These rules are not required on that path. |
| Older direct V3 path includes a US$5–10M conceptual mansion reference, scene bookkeeping and heuristic repair | It is a different behavioral regime if rollout flags change; unspecified SDK retries also differ. | Identified, not rewritten. V2 and advanced terrain are outside this task. The architectural routes do not inherit those defaults. |
| Schema contains options whose complete construction is unavailable | Naming an infinity pool, unsupported amenity or nonrectangular site feature can promise more than the renderer builds. | Existing honest diagnostics preserved. A name or outline reservation is not proof of constructed luxury detail. |

No active instruction requiring simple rectangular houses was found on the architectural routes. Rectangles are expressly legitimate, as are supported articulated and line/arc footprints. Forcing wings, curves or asymmetry would merely replace one template bias with another.

There is no active few-shot house template to remove. The technical burden comes mainly from schemas and capability restrictions, rather than repeated examples. Plan/exterior do not duplicate footprint ownership, but the full-property canonical plan still repeats labels, roles and ledger identities. Compact authoring derives that bookkeeping once.

## 5. Which active instructions were improved?

- **`src/lib/v3/architecturalDesignGuidance.ts:ARCHITECTURAL_DESIGN_PROCESS`**: new shared, short process: interpret the brief and imagine the property; compose estate and conceptual rooms; walk through and review the geometry; preserve it for 3D. Explicit freedom, tropical context and repair-preservation precedence.
- **`src/lib/v3/architecturalBlueprintGeneration.ts:ARCHITECTURAL_DESIGN_SEQUENCE/v3ArchitecturalBlueprintPrompt`**: uses the shared process; clarifies that interior detail is deferred unless requested. Existing public sequence export retained for compatibility.
- **`src/lib/v3/architecturalPlanEvaluation.ts:planEvaluationPrompt`**: transmits that same creative guidance and clarifies that courts can be framed by wings/buildings rather than unsupported outline holes.
- **`planExteriorPrompt`**: connects deferred roofs, shade, glazing and materials to the original spatial concept and tells Terra to report conflicts with approved geometry.
- **`src/app/api/ai/plan/route.ts:POST`**: exterior user message now includes the retained original brief, with a fallback for older plans lacking it. It still checks out the current saved geometry rather than a stale input copy.

No schemas, model settings, generation budgets, validators, construction policies or rollout flags changed. The shared guidance is roughly a page of prose, not hundreds of lines or a new luxury ruleset.

## 6. Is the blueprint contract genuinely simple enough?

**The compact initial 2D contract is reasonably small for an architectural authoring interface; the full-property initial contract is not comparably simple.** It is not a freehand sketch format: exact coordinates, valid wall addresses and routes remain real work for the model.

`src/lib/v3/architecturalPlanAuthoring.ts:v3PlanAuthoringSchema` requires only `format`, `concept`, `site`, `buildings` at root. Each building requires `id`, `label`, `location`, `plan`, `storeys`, `accessOpenings`; each space still needs its label, program and rectangle. There are no materials, exterior assemblies, meshes, partitions, door tables, explicit entrance/program ledgers or roof IDs in the advertised compact schema. Defaults derive heights, ordinary datums, roles, identities and route owners. `expandPlanAuthoring` first accepts a complete existing canonical plan unchanged; explicit legacy intent takes precedence over derived defaults.

| Prompt | Before, bytes | Revised, bytes | Schema bytes, unchanged |
| --- | ---: | ---: | ---: |
| Compact 2D | 15,570 | 17,769 | 13,139 |
| Full property | 37,580 | 38,430 | 31,271 |
| Later exterior | 10,939 | 11,226 | 9,989 |

The change deliberately spends about 550 extra character/4 token estimates on initial 2D architectural guidance. It does **not** claim prompt-size reduction. The schema dominates the remaining context. Character/4 is a rough size comparison, not actual tokenizer output or predicted reasoning usage.

Validation chain: `expandPlanAuthoring` → `prepareV3ArchitecturalPlan` → identity/reference/outline checks → `auditV3Blueprint` with `constructionEvidence:false,circulationReservations:true` → limited room-adjacency findings → normalization. `architecturalDraftFinding` allows identifiable local room defects to remain editable; accepted does not mean fully resolved or beautiful. No `compileV3Scene` runs on plan-only acceptance.

The single geometry authority is the saved V3 scene's named semantics. `checkoutPlanEvaluation` reconstructs a document from the **current** scene and checks losslessness; `elaborateV3ArchitecturalPlan` permits only exterior/deferred fields; `sameArchitecturalPlan` checks plan geometry after construction. Temporary input documents, neutral plan materials and rendering projections are not competing editable blueprints.

There is a material workflow gap: omitted outdoor feature heights are valid in 2D, but `deferredPlanConstructionFindings` blocks the later call until heights are authored locally. Nonrectangular site-feature boundaries and unsupported feature types can also be valid reservations without a faithful 3D implementation. Conceptual stairs can be accepted yet fail later flight fit. These limitations mean **saved-plan compatibility is proven for supported, construction-ready plans, not automatic completion of every accepted 2D plan**. Closing this gap would be a separate contract/construction change, not solved by prettier prompt wording.

## 7. What design-quality limitations remain?

Both recovered provider designs were inspected and replayed directly, without replacing them with attractive fixtures. Their main houses are 24×18m rectangles with two storeys; their guest buildings are rectangles as well. Neither recovered design authored exterior assemblies, despite concept/character text describing deep shade and developed tropical architecture. Those facts do not make rectangles bad architecture; they show that ambitious prose did not reliably become spatial/exterior development. Replay retains room-overlap/outside-host and adjacency diagnostics. Their byte hashes and exact geometry are recorded in [evidence.json](terra-intelligence/evidence.json).

The four distinct offline designs demonstrate support for crescent/line-arc, circular, articulated courtyard and classical rectangular plans. They are hand-authored fixtures, **not** evidence that Terra naturally invents them. Recovered designs predate these revisions, so they cannot measure the effect of the new instructions.

`src/lib/v3/designReview.ts:reviewV3ArchitecturalComposition/reviewV3Architecture` checks things such as conflicting amenities, entry relationships, requested features, estate commitments and access completeness. Symmetry, similar mass sizes and aligned joints are advisory observations, not reasons to redesign. In the architectural-blueprint generator, the final heuristic review only promotes missing requested features/unsupported intent into rejection; it does not perform a new aesthetic revision. The compact route has no equivalent independent creative reviewer.

A conceptual room rectangle does not prove good room proportions, convenient travel, private circulation or operable cross-ventilation. Adjacency declarations do not build passages; room allocations do not compel facade openings to serve the right rooms. Paving/grass zones are not detailed gardens; a pool named infinity has no verified infinity-edge design. No evidence here supports a claim of exceptional natural architectural taste, construction-cost accuracy or professional build readiness.

## 8. Can one Terra agent reasonably perform the whole workflow?

**Yes, within supported capabilities. Separate agents are unnecessary. Separate composition/floor-plan/review calls are not technically required.** The existing schemas accept a complete conceptual 2D design in one response, and tests demonstrate its preservation through later development. One agent can do those reasoning tasks inside the same call; that is not a guarantee of design quality.

| Approach | Likely benefit and tradeoff | Cost illustration |
| --- | --- | --- |
| A: one compact 2D response, including internal composition review | Best first baseline: less construction context, all estate/room decisions considered together, easiest response to inspect. Review is not independently observable. | 5k input + 6k output ≈ **$0.082**. |
| B: same agent, sequential composition → floor planning → review against one shared plan | May improve focus and make revisions inspectable if each call sees the current drawing/plan and has bounded edit authority. Later floors may expose weaknesses in an early composition; premature freezing or regenerating the whole document can worsen drift. No evidence here proves it better. | Illustrative three-call **total** 21k input + 14k output ≈ **$0.210**, about **$0.128** above A. |
| Later exterior development | Meaningful separate boundary because the user can approve the actual 2D plan first. Current implementation already offers it; requires supported decisions and resolved deferred values. | Example 9k input + 6k output ≈ **$0.090**, additional to either planning approach. |

These are arithmetic examples from `src/lib/ai/pricing.ts:DEFAULT_PRICING`: $2/M uncached input, $0.20/M cached input, $12/M output for the configured Terra label. They are **repository-configured estimates, not independently verified current provider prices or measured new runs**. Repeated plans, reasoning/output accounting, caching and transport failures can change actual cost. Each current architectural call has a 10k output-token limit; the provider's default reasoning allocation is unknown. A three-call workflow has not been implemented.

Recommendation: use **A for initial 2D quality evaluation**, with the new shared review instruction and a concise concept tied to the drawing. Keep deterministic V3 massing on that same plan, then use the same Terra model for a later explicitly requested exterior pass. Escalate to B only if natural-plan evidence shows a specific failure that focused sequential work plausibly fixes. Adding calls is not a prerequisite for good architecture.

## 9. What evidence is needed before another paid evaluation?

Offline correctness evidence is now available:

- Actual `POST` handlers, real AI SDK and actual OpenAI adapter serialize the intended developer/user messages; a test-local transport returns provider-shaped fixture responses. It opens no provider connection. JSON mode, default model, 10k limit and absent explicit reasoning/temperature are asserted.
- Compact schema excludes construction and duplicate-ledger fields. Plan acceptance never invokes the scene compiler. Supported varied footprints remain accepted.
- Both recovered designs retain their footprints/rooms through plan-only save/reload. Existing route tests develop supported current plans into 3D and reject exterior geometry overrides, truncation and unauthorized repair drift.
- Prompt and fixture hashes, before/revised byte counts, focused regression results, TypeScript, repository ESLint and an isolated production build are retained with this report. See [checks](terra-intelligence/checks.json).

Before spending again, select a simple brief and explicit review criteria for its **drawn** composition: proportions, arrival, room relationships, privacy, views and indoor-outdoor life. These are evaluation criteria, not a mandatory house-feature list. Confirm the intended route/flag through its read-only diagnostics, retain raw response and model/token/finish metadata, and decide beforehand what constitutes an architectural improvement over the recovered plans. Missing site facts should remain identified assumptions. A provider HTTP 429 without design text cannot be scored as architectural output.

The remaining empirical evidence must come from a future authorized natural response, ideally compared blindly against the same brief and baseline with plans at matching scale. Offline adapted fixtures cannot supply that evidence. No paid evaluation was run here.

## 10. What is the single most important remaining improvement?

**Make review of Terra's actual first 2D composition observable and use its findings to refine that same plan before exterior development.** The main unknown is architectural judgment, not the ability to emit another valid construction schema. Start by evaluating the new one-response process on its real drawing; only then decide whether the same agent needs a separate focused revision call. More V3 bookkeeping, mandatory luxury features or attractive replacement fixtures would not answer that question.

The immediate product limitation to resolve before promising seamless autonomous 2D-to-3D completion is the deferred-feature-height/unsupported-boundary handoff described in section 6. It is distinct from whether the first plan is good architecture.
