# V3 blueprint-first generation v1

19 October 2026. Offline implementation and evaluation. No Terra/OpenAI requests, paid generations, commits, pushes or deployment. Existing uncommitted work is retained. V3 remains the sole scene authority; no V2, renderer, terrain or database implementation is added.

## 1. Generation contract and control

New server flag: **`AI_V3_BLUEPRINT_FIRST=1`**. It is unset/off by default, accepts only the exact value `1`, and applies only to **new flat-site V3 generation**. It is evaluated per request; clients cannot enable it through their payload. Advanced generation, saved-scene loading, persistence and editing keep their existing policies. No environment file has been enabled by this implementation.

`v3SceneArchitectPrompt('flat', {blueprintFirst:true})` appends `V3_BLUEPRINT_FIRST_PROMPT` from `src/lib/v3/blueprintGeneration.ts`. It tells Terra to resolve its concept, footprints/positioning, composition, storeys, vertical connections, entrances/approaches, compatible roofs, outdoor access, landscape organization, allocations and important relationships before elaborating construction detail. Conditional circular/recessed-entry/pavilion examples express obligations only when those designs are chosen. No building count, mansion template, amenity list or style is prescribed.

Terra returns `estatePlan` with its version-1 `blueprint` before `objects` in the **same JSON response**. The existing blueprint schema is reused unchanged. Buildings and entrances index the same V3 object/opening ids; roofs, outdoor objects, estate routes and stairs/lifts retain their existing identities. The contract explains local entrance levels, world-space circulation reservations and existing roof/host semantics. Feature/bedroom requirements allocate existing objects, or rooms only when explicitly authored. It does not request a full room program or invent room ids.

The blueprint contains references, not copies of coordinates, footprints, roofs or another scene graph. Spatial decisions live in existing `architecture`, `composition.footprint`, openings, object levels/roof intent, top-level circulation, estate requirements/zones/relationships and site data. The deterministic V3 compiler continues to construct those same objects. The optional output schema remains compatible with legacy scenes; active ingestion enforces `requireBlueprint:true`. Production still uses JSON mode with **no exact provider schema transmitted**.

This is blueprint-first reasoning and a local acceptance boundary in a single response. The application cannot observe or approve the model's private design process, guarantee JSON property order, or literally pause before the model emits details. Local approval occurs after the complete JSON response and before reference repair and construction validation. A separately approved provider planning stage would require different orchestration; no such call is introduced here.

## 2. Fidelity and stable identities

The existing blueprint gate checks real V3 footprints, building coverage, site bounds, entrance wall/segment/level addresses, actual route contact, roof families/hosts/envelopes, storeys and stair reservations, program allocations, clear space and spatial relationships. It then runs the normal semantic validation, generation consistency audit and compiled-geometry audit. A blueprint index cannot make a rectangular object fulfill a circular commitment. Advisory style, budget, views and privacy claims remain advisory.

Additional main-entry fidelity checks require a composed `mainEntry` to appear among the blueprint's designated entrances. Approval comparison now also protects main-entry identity, mass hierarchy, facade roles, roof datum grouping, terrace open edges and connector endpoints, alongside the existing site, plan, building/roof/outdoor geometry, levels, openings, rooms, routes and relationships.

Ingestion returns immutable, ephemeral `blueprintApproval` evidence when preliminary approval succeeds, including when subsequent detailed validation fails. The route carries it into its one possible follow-up. Both objective and design repair assessments independently enforce the same approval comparison. Nothing persists the approval snapshot or generated meshes. Removing the blueprint, changing approved geometry or commitments, or renaming/removing a planned object fails with coded diagnostics. Compilation with and without blueprint metadata is exactly equal in all five provider-shaped fixtures.

## 3. Safe repair

The existing budget is unchanged: **one initial response and at most one follow-up**, either objective repair or optional design revision. `V3_INITIAL_MAX_OUTPUT_TOKENS` stays 10,000 on both attempts. There is no extra planning, elaboration or paid repair stage.

Blueprint findings enter the existing objective feedback with codes and all target ids. Both repair kinds receive explicit blueprint-preservation guidance. The candidate passes the same ingestion and compilation boundary again before the existing preservation assessment can accept it.

| Situation | Result |
| --- | --- |
| Missing blueprint index, existing plan and identities intact | May add only the missing index; all other plan fields and object geometry remain protected. |
| Unapproved plan with a diagnosed path gap | May correct that path's existing geometry to reach its existing entrance; buildings/index remain intact. |
| Unapproved circular building with an incompatible roof choice | Existing roof-only permissions may correct the roof when commitments permit; outline and segment ids stay intact. Explicit unsupported user intent still blocks acceptance. |
| Approved layout with malformed facade assembly detail | A targeted technical detail correction can succeed without changing the approved decisions. |
| Candidate moves a building, flattens a curve, erases blueprint/amenities or changes character | Rejected. Approval comparison also defeats broader technical allowlists such as `INVALID_ARCHITECTURE`. |
| Correction needs a protected architectural replan | Declined; no second retry or silent fallback redesign. |

Malformed or dangling blueprint entries are reported precisely and retained. This v1 does not broadly authorize rewriting a partially invalid index, estate concept or other commitments; many such repairs will be declined even if the replacement is independently valid. A wholly missing estate plan on a response with existing object authority also requires more authorship than merely adding an index. These are conservative repair limits, not automatic architectural fixes.

An invalid optional design revision keeps the initial valid scene. An invalid objective repair yields no saveable project. Deterministic normalization never invents a missing blueprint or makes architectural choices to satisfy it.

## 4. Offline provider-shaped proofs

`blueprintProviderFixtures.ts` reuses explicit test-author designs from the foundation, converting them to the generation contract's named architectural geometry, top-level world-space circulation and flat support fields. The recovered compound variant explicitly converts camelCase object ids to kebab ids and rewrites every exact reference. These helpers are test-only and never appear in production prompts.

All five fixtures pass `v3SceneOutputSchema`, actual normalization/ingestion, preliminary fidelity checking, generation consistency, compilation and compiled-geometry checking. The same five pass through the actual API route with `generateText` mocked, preserving their blueprint identities and using at most two mocked responses. These are synthetic acceptance proofs, not recordings of Terra success.

| Synthetic response | Result | Blueprint JSON characters | Estimated blueprint tokens* |
| --- | --- | ---: | ---: |
| Sculptural contemporary mansion | Accepted; mixed line/arc outline and stair retained | 417 | 105 |
| Mediterranean luxury estate | Accepted; three independent hip-roof buildings and bent access retained | 775 | 194 |
| Circular residence | Accepted; full arc, segment-addressed door and compatible flat roof retained | 301 | 76 |
| Multi-building compound | Accepted; corrected articulated main residence, detached pavilions, roofs and outdoor program retained | 1,973 | 494 |
| Conventional residence | Accepted; compact three-storey building and vertical reservation retained | 409 | 103 |

Valid-fixture failure rate is **0/5**. Six contradictory variants are rejected with target ids and specific codes: dangling building (`BLUEPRINT_REFERENCE`), nonexistent entrance wall (`BLUEPRINT_ENTRANCE_WALL`), incompatible circular gable (`ROOF_FOOTPRINT_UNSUPPORTED`), erased circular footprint (`ESTATE_FORM_UNBUILT`), unindexed main entrance (`BLUEPRINT_MAIN_ENTRY`) and nonexistent route (`BLUEPRINT_REFERENCE`). Four malformed blueprint shapes are rejected as `BLUEPRINT_INVALID_INPUT` without stripping their data. Thus **10/10 deliberately invalid variants are rejected**; this is not an estimate of production failure rate.

Repair proofs exercise missing-index addition, route contact correction, roof-only correction, permitted detail correction, and rejection of approved relocation, style changes, removed amenities, redirected main entrance, erased blueprint and curve-to-box substitution. Existing foundation/persistence tests continue to cover project storage and additional geometry contradictions. See `blueprint-generation-replay.json` for machine-readable evidence, diagnostics and overhead.

Passing these fixtures demonstrates enforceable references and spatial preservation. It does **not** demonstrate improved creative quality, subjective luxury quality, or a reduction in repeated provider spatial contradictions. Existing consistency checks already catch several of the same geometric defects; the blueprint adds explicit coverage/entrance decisions and a preserved approval boundary. Comparing repeated provider failures requires a controlled provider evaluation, which was not performed.

## 5. Overhead

*Token estimates use compact JSON characters / 4, rounded up, not a model tokenizer or measured billing.*

- Added initial instruction: **3,379 characters, approximately 845 input tokens per attempt** when enabled; zero when disabled.
- Blueprint index: **301–1,973 characters, approximately 76–494 output tokens** in these five fixtures. Including the `blueprint` JSON member syntax, response growth is **314–1,986 characters (approximately 79–497 tokens)**, or about **10.4–18.6%** over the same compact responses without that member.
- Blueprint JSON schema serialization is **1,767 characters**, already represented by the foundation's optional schema. **Added transmitted schema overhead is zero** because this generation path transmits no exact schema.
- Repair-only preservation guidance adds **749 characters, approximately 188 input tokens**. The follow-up also repeats the enabled system contract and echoes the original response's blueprint plus diagnostics through the existing repair mechanism. Total repair overhead therefore exceeds the guidance alone.
- These figures exclude new architectural choices that Terra might describe at greater length. Real tokenization, latency, truncation and billing remain unmeasured. The 10,000-token output limit is unchanged; larger estates still need live headroom evaluation.

## 6. Limitations and rollout recommendation

The foundation's geometry limits still apply: supported line/arc outlines and roof families, flat ground estate routes, preliminary vertical reservations, and explicit relationship contracts. There is no arbitrary roof intersection, dome construction, advanced terrain extension, engineering/code certification or general routing algorithm. Passing a blueprint does not certify all outdoor uses, room quality, privacy or access standards; detailed V3 validation remains necessary. Conservative approval also protects plan array order and metadata decisions that may be semantically equivalent after reordering.

The gate fails early on invalid planning prerequisites. Further detailed defects may become visible only after the first contradiction is corrected, exhausting the single repair. The curated five-design corpus cannot estimate natural omissions, over-rejection, latency or provider repair success. The optional blueprint remains an index, so it cannot independently prove omitted user requirements or compare against a separately emitted earlier geometric plan.

Keep the flag off for normal users. First enable it in an isolated development/staging environment for a small, explicitly authorized live evaluation using varied one-sentence briefs, including unusual valid designs and explicit constraints. Compare matched blueprint-off/on briefs and record first-attempt acceptance, final acceptance, failure codes/targets repeated after repair, missing-index/coverage failures, repair-scope rejection, layout/identity preservation, tokens, latency and truncation. Include human architectural review rather than treating validation success as creative-quality evidence. Do not increase the one-repair budget or silently simplify failures.

A **controlled live test is justified after validation passes**, as a limited contract/reliability evaluation. Broad activation is not justified by these synthetic fixtures. Expansion should depend on acceptable token headroom and failure/repair outcomes, no preservation regressions, review of over-rejection, and measured evidence about repeated spatial contradictions. Turning the flag off restores legacy authoring for subsequent generations; already saved blueprint metadata continues through existing V3 persistence.

## 7. Reproduction and validation

```sh
BLUEPRINT_GENERATION_REPLAY_OUTPUT=docs/architecture/blueprint-generation-replay.json npx vitest run src/lib/v3/__tests__/blueprintGeneration.test.ts src/lib/v3/__tests__/blueprint.test.ts src/store/__tests__/v3BlueprintPersistence.test.ts src/app/api/ai/house/__tests__/route.v3.test.ts --maxWorkers=2
npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
```

Final checks passed: **170 test files passed, 2 skipped; 2,030 tests passed, 3 skipped**. The focused blueprint/API/persistence run passed **110/110** tests. TypeScript, ESLint with zero warnings, `git diff --check` and explicit new-file whitespace checks passed. Machine-readable results are recorded in `blueprint-generation-checks.json`.
