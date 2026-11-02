# Experimental semantic Generate — offline integration

30 October 2026. **The semantic planning checkpoint produces editable geometry end to end offline. Actual AI architectural improvement remains untested. Production Generate is unchanged.** No paid calls, credential access, database access, commits or deployments occurred.

## Implemented boundary

`src/lib/villa/experimental/semantic-building/generation.ts` adds a versioned, runtime-checked planning contract and an injected, single-call planner entry point:

**Brief → planner response → semantic intent → existing `compileBuilding` → existing atomic scene executor → editable scene → existing renderer.**

The planner supplies architectural choices rather than finished component coordinates. `generateSemantic` calls its supplied planner once, with brief, system instructions and proposal schema. No automatic retries, repair calls, external service, provider credential handling or production route imports exist in this integration. The development page `/dev/semantic-generation` supplies mocked responses; it does not contact a model. A live transport remains intentionally uninstalled pending the separately requested authorization. The exact proposed provider request is prepared below.

The proposal can select supported architecture or return explicit `decision-required`. It cannot include free-form scene operations. Invalid contracts and compiler `DesignConflict`s return decisions without replacing the current scene. Every interior allocation must participate in access evidence; an omitted room cannot evade the reachability check.

The checkpoint retains original brief, proposal, compiler bindings and scene. Restore recomputes compiler bindings from intent and validates the independently editable scene; it does not trust serialized compiler state. `reviseSemantic` uses existing `reviseBuilding` transactions, preserving unrelated finishes and refusing dependent manual-edit overwrites. Changed space membership/order or vertex count requests identity migration. General topology identity/override migration remains unsupported. The browser uses the existing project store for scene versions and Undo/Redo, with explicit semantic checkpoint sidecars; local Save/Reload retains a checkpoint, not a new project format. Reload starts a new checkpoint history branch. There is no production project migration or unattended regeneration.

The original compiler, stair helper, profile geometry, executor, element kinds and production renderer were reused. The proof viewer gained an optional evidence-source label. Existing drawing and capture scripts gained an experimental flag; their default proof inputs remain unchanged. Captures export the entire actual WebGL canvas, avoiding viewport cropping and development-server overlays when the checkpoint editor sits above it.

## Offline proposals and actual geometry

These are **hand-authored mocked AI planning responses**, not real model outputs, architectural successes or manually assembled finished scenes. Both pass through the same contract and unmodified compiler; neither IDs nor house arrangement receive special compiler rules.

| Mock response | Selected organization | Spaces | Editable elements | Physical query groups | Failures in sampled queries |
|---|---|---:|---:|---:|---:|
| Compact family | Angled living/main bedroom, unequal study/second-bedroom wing, two storeys, shared stair and connected garden | 8 | 54 | 46 | 0 |
| Multilevel luxury | Unequal 9 m / 6 m living wings, two upper suite allocations, shared stair/gallery, taller tapered salon and terrace | 9 | 60 | 53 | 0 |

The luxury mock is a more elaborate spatial composition, **not an exceptional finished luxury property**. Suite allocations have no completed bathrooms or fit-out. The family study also lacks bathrooms/services and full domestic completion. Calling these finished homes would misrepresent the evidence.

[Raw family response](mocks/family.response.json) · [raw luxury response](mocks/luxury.response.json) · [hashes and verification](verification.json) · [family physical evidence](family.physical.json) · [luxury physical evidence](luxury.physical.json).

Physical checks use the proof's actual renderer profile meshes and recursive world transforms, not labels or the access graph alone. They sample floor support, body/head clearance, threshold crossings, convex approach paths, discrete tread centres, landings and the chosen side bypass. Door panels are assumed open. These bounded samples do not certify whole-house navigation, door swings, structural support, code compliance or continuous stair traversal.

During mock development, initial duplicate mass/level IDs were corrected; the luxury stair/arrival alignment, salon opening width and reversed west-host offset were explicit developer architectural decisions. They were changed in semantic mock data, not repaired in finished scenes or compiler exceptions. Consequently these mocks establish that supported designs can pass, not a one-shot AI success rate.

A retained [negative stair-route case](negative-stair-route.physical.json) deliberately puts the west doorway beside the flight. Graph connectivity and compilation succeed, but physical queries detect obstructions. `ready` in this API means compiled checkpoint, **not physically reviewed or complete architecture**. The separate physical review remains necessary before accepting any live result. An [unsupported garden gap](unsupported-gap.json) returns a design decision rather than inventing a bridge.

## Plans, sections and 3D review

| Study | Ground plan | Upper plan | Stair section | Arrival | Aerial | Garden | Fourth view |
|---|---|---|---|---|---|---|---|
| Family | [View](family.plan-ground.png) | [View](family.plan-upper.png) | [View](family.section.png) | [View](family.arrival.png) | [View](family.aerial.png) | [View](family.garden.png) | [View](family.poolside.png) |
| Luxury | [View](luxury.plan-ground.png) | [View](luxury.plan-upper.png) | [View](luxury.section.png) | [View](luxury.arrival.png) | [View](luxury.aerial.png) | [View](luxury.garden.png) | [View](luxury.poolside.png) |

Plans/sections intersect actual constructed triangle meshes. They are inspection drawings, not complete architectural documents. The fourth perspective uses the existing Poolside preset; neither mock contains a pool. No scenery, vegetation, openings or other corrective geometry was added for capture.

The family retains its angled outline, unequal wing widths, material split and two levels. The luxury retains unequal wings, two-storey private accommodation, taller tapered social pavilion and terrace sequence. Stair sections show selected endpoints, the actual floor void and retained landing surfaces. This verifies preservation of explicit choices, not the quality of those choices.

Visual review: the family remains a broad, mostly blank upper block with a basic garden door. The luxury has readable differences in wing width, height and salon geometry, but the arrival is weak, long walls lack facade articulation, roof edges are rudimentary, and the terrace lacks shade and landscape definition. Neither is premium architecture. Interesting polygons and coordinated openings alone do not establish sophistication. The model must still develop entrance hierarchy, daylight/privacy, climate response, material transitions, facade depth, spatial experience and visual composition, with rendered iteration. The current semantic contract cannot express many of those details.

## Verification and revisions

Tests cover both mock planner responses, actual compiler/physical execution, exact serialized replay, ordinary component finish editing, existing project Save/Undo/Redo, single planner call/no retry, malformed/nonfinite response data, unsupported requests, missing access evidence, gap conflicts, dependent manual edits and unrelated finish preservation. A luxury level revision updates floor-dependent walls, covers, void and stair endpoint while keeping chosen polygons and component IDs. Existing proof tests additionally cover host rotations and boundary/opening geometry.

**29 tests pass across six files; focused ESLint passes.**

[Tests](tests.json) · [ESLint](eslint.txt) · [full typecheck diagnostics](typecheck.txt) · [browser verification](browser-result.json).

Full typecheck is blocked by the same historical errors documented in the proof report: archived `experiment-script.as-run.ts` imports/types and the duplicate property in `sol-planning-comparison-review.ts`. No diagnostic points to this integration. Historical files were preserved.

Browser verification blocks every API and non-local resource. Eight exterior captures compare exact rendered IDs, local positions and yaw to generated scenes and check for page errors and lost WebGL contexts. It also exercises revision, existing project Undo/Redo, local Save, a complete page reload, and unsupported-decision preservation. SVG plans/sections are rendered separately. Browser screenshots are mock evidence, never AI evidence.

## One controlled live request — prepared, NOT submitted

[Exact request](mansion.request.NOT-SUBMITTED.json) · [preflight and request hash](preflight.json).

1. **AI design responsibility.** Select concept, massing hierarchy, spatial organization, chosen convex footprints, proportions, levels, circulation and privacy, entrance/terrace sequence, roof membership, materials, hosted opening choices and explicit stair location/dimensions. Software does not choose these architectural decisions or optimize beauty.
2. **Automatic coordination.** From that intent, derive shared boundaries/walls, profile floors and their top datums, consistent frame transforms, hosted wall cuts and matching panels, thresholds/access evidence, straight-stair treads, upper void/landings, construction provenance and ordinary editable elements. Revisions update supported dependencies atomically.
3. **Unsupported features.** Concave/curved cells, partial-edge segmentation, multiple openings per edge, ordinary raised-sill external windows, pitched/eaved roofs, arbitrary stairs, guards, pools, planting, terrain grading, roof-junction engineering and full fit-out. Independent mass orientations must be represented as polygons in the shared frame. These are representation limits, not invalid architectural ideas. The original mansion brief explicitly requests unsupported pool, landscape and sloping-site features. The prepared instructions require a decision response rather than silently dropping them. This request may therefore produce no geometry. That is an honest limitation result, not task success or a failed premium design claim.
4. **Editable end to end?** Yes for supported offline proposals, including revision, reload and history. No live-model success is established. There is no production Generate replacement and no live transport yet.
5. **Exact proposed model and cost.** `gpt-5.6-terra`, provider-default reasoning, one paid planning call maximum, 30,000 output-token cap, zero retries and zero construction-model calls. Calls made so far: **zero**. Conditional cost at repository static defaults ($2/M input, $12/M output): approximately **$0.204** for 12,000 input / 15,000 output tokens, or **$0.384** at the same input with the full output cap. These are explicit budgeting scenarios, not verified current provider prices or guaranteed bounds. The input-token count, current model access/pricing and any billed reasoning usage require verification before submission. No credentials were inspected for preparation.
6. **Comparison to retained Terra/Sol proposals.** Keep previous exact proposals unchanged. Record raw semantic response, finish reason, usage, cost, decisions/failures, scene hash, all operations and bindings; count independently authored placement values, requested spaces actually constructed, real accessible routes, floor support/obstructions, hosted cut/panel error, interventions and revision fidelity. Then inspect comparable ground/upper plans, stair sections and Arrival/Aerial/Garden/fourth views for composition, proportions, hierarchy, entry sequence, facade/roof relationships and spatial experience. Score construction completeness separately from visual preference and allow “neither succeeds.” Missing requested scope counts as missing, never a quieter success. A decision-only response cannot receive a beauty score.

The prepared request preserves the original $25 million Saint Lucia waterfront brief byte-for-byte as the user message. It contains the semantic contract and brief only, without retrieved knowledge. Historical calls used other schemas and knowledge payloads; model/brief continuity does **not** make this a controlled causal or statistical comparison. One call is a diagnostic compatibility test. Hold knowledge/settings constant in a separately designed paired experiment before attributing quality improvements to the semantic method. No automatic second call or rendered revision is authorized.

Explicit approval is required by the user's task before submitting this exact request. No request was submitted. Given the known brief/contract mismatch, authorization should acknowledge that the possible result is an unsupported-feature decision, not a complete mansion.

## Reproduction

```sh
npx vite-node --config vitest.config.mts scripts/semantic-generation-offline.ts
npx vite-node --config vitest.config.mts scripts/semantic-building-drawings.ts --semantic-generation
npx vite-node --config vitest.config.mts scripts/semantic-generation-prepare.ts
npx vitest run src/lib/villa/experimental/semantic-building src/lib/villa/scene/model.test.ts src/lib/villa/scene/assemblyEvidence.test.ts
node scripts/semantic-building-capture.mjs --semantic-generation
```

Browser commands use the existing development server on port 3015 and the proof's local Chrome/playwright installation. The offline and preparation scripts deny or contain no network access. Production routes, model defaults, databases and existing evidence were not changed.
