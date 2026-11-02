# Canonical consolidation and spatial-coordination audit (2026-11-02)

Source-level audit; no paid calls, database changes, migrations, commits or deployments. Historical evidence and projects were not modified. **No claim is made that the software produces premium houses; only a later live experiment can show that.**

## 1. What "V3" means

`V3` (`src/lib/v3`, `version: 3`, `generationMode: "v3-scene"`, `v3Scene`) is a **historical** blueprint/scene construction pipeline, not the newest system. The current authority is:

`architectural-plan-1` (`canonical/plan.ts`) → `compileArchitecturalPlan` (compiler `architectural-plan-1.1`) → construction kernel `compileBuilding` (`experimental/semantic-building/compiler.ts`, intent version `semantic-pilot-1`) → `ArchitecturalScene` (`architectural-scene-1`) rendered by `OperationStudio`/`VillaScene` → captured visual review (assessment only).

The "experimental"/"pilot" names on the kernel are misleading but were deliberately not renamed; files are imported by saved-project readers and evidence scripts.

## 2. Execution-path map (from source)

| Stage | Active path | Notes |
|---|---|---|
| New project (home page) | `page.tsx` → `createProject(..., "direct-scene")`; store default is also `direct-scene` | Blank root `{version:"architectural-scene-1"}` |
| Workspace routing | `WorkspaceShell`: `direct-scene` → `OperationStudio`; V2/V3 roots → legacy `ChatPanel` | Mode comes from the persisted JSON root, not a selector |
| Generate | `OperationStudio` → `POST /api/ai/scene` → `isNewGeneration` → `generateCanonical` | Exactly one provider call, zero retries, no fallback |
| Provider schema | `canonicalProposalSchema` (proposed / decision-required) via `strictSceneResponseSchema` | Wire-compatibility tests exist |
| Knowledge | `architecturalRequestContext` → retrieval + concept guidance, appended to `CANONICAL_INSTRUCTIONS` | See leakage fix below |
| Spatial/construction | `derive()` resolves relative placement; `compileBuilding` owns walls, cuts, doors, floors, stairs, collisions, access | Deterministic |
| Review | `/api/ai/scene/visual-review`; canonical scenes are assessment-only (409 for refine/compare) | |
| Manual editing | `OperationStudio` element edits on the compiled scene; scene-operation `edit` of a canonical house is refused with 409 and zero provider calls | Plan-level revision is **not implemented** |
| Save/load/Undo/Redo | `useProjectStore` (versions, undo/redo, quota-safe persistence) | Covered by existing store tests (all pass) |

## 3. Version inventory

| Implementation | Active for new houses? | Selectable? | Still needed |
|---|---|---|---|
| Canonical plan pipeline | **Yes (sole author)** | Default | – |
| Direct-scene operations author (`scene/terra.ts`, `designGeneration.ts`, `designProposal.ts`, Generate branch in `scene/route.ts`) | No: unreachable for `mode:'generate'` (dispatch returns first) | No | Edit/redesign/complete/refine of saved direct-scene projects; parsers, executors, audits |
| V2 (`/api/ai/house`, `architecture/*`) | No: `mode:generate` → 409 | No (blank V2 project can only be opened) | Loading/editing saved V2 documents |
| V3 (`/api/ai/house` v3 branch, `/api/ai/plan`, `/api/ai/concept`, `lib/v3`) | No: house 409; plan `design` 409 (also flag-gated); concept 409 unless `legacyHouseAuthoringEnabled()` which is hard-coded `false` | No | Loading/editing saved V3 scenes and saved 2D plans (`elaborate`) |
| Villa playground (`/api/ai/villa`, dev only) | No: generate 409 | Dev-only | Saved configurations, component creation |
| `/api/ai/villa/scene` | Re-export of the scene route | – | URL compatibility |
| Semantic pilot proposal author (`semantic-building/generation.ts`) | No production caller | No | Compiler kernel; offline fixtures |
| Unmounted UI: `NewProjectDialog`, `Design2DPlan` | Not imported anywhere | No | Left in place (see §6) |

## 4. Conflicts and defects found

1. **Contradictory text reached the canonical model request.** The retained request (`canonical-corrected-mansion-2026-11-02/provider-request.exact.json`) contained, after the canonical contract, retrieved knowledge saying "Translate selected ideas into actual supported scene operations" (plus `construction.operations` metadata) and shared concept guidance saying "Exterior scope defers interior fit-out". The canonical contract forbids operations and requires planned rooms. `GENERATE_COORDINATION_GUIDANCE` and `ARCHITECTURAL_DESIGN_GUIDE` do **not** reach the canonical request (verified by test).
2. **`GET /api/ai/house` advertised `enabledForNewFlatGenerations` from the retired `AI_V3_ARCHITECTURAL_BLUEPRINT` flag** although POST generate is blocked.
3. **A blank V2/V3 project let the user submit a brief** that was sent to a route certain to refuse it.
4. **Fail-fast occupied-volume reporting.** The compiler reported one clash ("revise outlines or levels") and hid the rest; the roof-versus-upper-occupancy check was unreachable once any volume clash existed.
5. **Stale tests (276 failing before and after this work, identical sets):** they assert pre-migration success of retired authors. Not deleted; see §8.

Not defects: no environment flag can re-enable a legacy author (`authority.ts`); `AI_ARCHITECT_LEGACY_PIPELINE` only selects a staged variant inside code already unreachable for generation; `resolveProjectGenerationMode` classifying an unrecognised/corrupt root as V2 only affects which compatibility editor opens.

## 5. Root cause of the mansion failure (case analysis)

Replay: `npx vite-node --config vitest.config.mts scripts/canonical-overlap-replay.ts` (offline, read-only). The compiler now lists **all six** clashes plus ten roof-versus-upper-occupancy conflicts in one rejection.

* Ground rooms authored with height 4.2 m (foyer, living) and 3.9 m (gallery) under a 3.6 m upper-level rise. Each clash is exactly that excess (0.6 m / 0.3 m) with an upper room stacked above. **Case 1: genuine model design error**, enabled by **case 3: a representation redundancy**: `height` and the level `rise` independently state the same vertical relationship, and the covered-room check requires equality, which the instructions never said. The compiler is correct and was not weakened.
* Roofs authored on ground rooms that have upper-storey rooms above (e.g. `guest-suite-1` under `upper-suite-5`, `arrival-court` under `upper-bath-6`): genuine design contradiction (a room is covered by its upper floor or has its own roof).
* No double-height/atrium or open-to-above void is expressible when a stacked plan is above; a taller room must have nothing above it. This is a **representation gap (case 3)**, now stated to the planner as `decision-required`.
* No case-2 interpretation defect was demonstrated in placement, shared walls, stair centring, or collision geometry for the retained mansion. The retained proposal also contains an arrival screen on an outdoor host, which the compiler would reject later (never reached under fail-fast).

## 6. Changes made

* `compiler.ts`: collect all occupied-volume and roof/upper conflicts; each volume clash states penetration depth and, for stacked rooms, the cause and valid remedies. Still throws `DesignConflict`; no tolerance added, nothing repositioned.
* `plan.ts`: `CANONICAL_INSTRUCTIONS` gains one sentence on stacking height versus rise and the inexpressible open-to-above void; new `CANONICAL_CONTEXT_PRECEDENCE` clause.
* `generate.ts`: appends the precedence clause after retrieved material. **This changes the prompt text of future requests** (demonstrated reason: item 4.1 and §5); retained historical requests are untouched.
* `house/route.ts` GET: reports `enabledForNewFlatGenerations:false`, `authority:'/api/ai/scene'`; one stale test updated.
* `projectMode.ts` + `ChatPanel.tsx`: `canStartNewDesign`; a blank legacy project shows a clear local message and makes no request. Existing legacy projects with content remain editable.
* Tests: `route.canonicalWorkflow.test.ts` (9), two stacked-volume tests in `plan.test.ts`.
* Not changed: provider models, design prompts other than the above, schemas, renderer, stored data, `NewProjectDialog`/`Design2DPlan` (unmounted; deletion is cosmetic and was not proven necessary).

## 7. Creativity and unexposed capabilities

Canonical Generate does not narrow to a single rectangle: asymmetric L/U compositions, unequal wings, multiple levels, stepped flat/gable/hip roofs, fitted openings, elevated fixed windows, slatted screens, pools and surfaces are supported (compact, waterfront and courtyard studies compile). Capabilities present in historical geometry code but **not** reachable from canonical Generate (the planner must declare them `decision-required`): curved/polygonal outlines and profiles (`profileGeometry.ts`), roof valleys/junctions (`roofIntersection.ts`), grading/cliff terrain, planting/trees, guards/railings, non-straight stairs, double-height voids, furniture/fit-out. None was added: each needs its own deterministic derivation rules and negative tests (a bounded future task). Upper-level balconies as outdoor spaces were not separately verified.

## 8. Verification (offline, mocked provider)

| Check | Result |
|---|---|
| Compact family house via real `POST /api/ai/scene` | 200, 1 provider call, canonical, individually addressable valid scene |
| Multilevel luxury residence (waterfront study) | same |
| Multi-volume mansion (courtyard study) | same |
| Operations returned by provider | 422, 1 call, no fallback, no scene |
| Retained invalid mansion | 422, six overlap findings, no geometry |
| Revise/edit canonical house with scene operations | 409, 0 provider calls (plan-level revision unimplemented) |
| Retired `/house`, `/villa`, `/plan` generate | 409, 0 provider calls |
| Saved V2, V3, direct-scene: load, persist, quota recovery, Undo/Redo | 77 store/storage/component tests pass |
| Typecheck of `src` | clean (remaining errors are in unrelated `scripts/` and `docs/` evidence files, pre-existing) |
| ESLint on changed source | clean |
| Whole suite | 3,130 pass, **276 fail, identical before and after my changes** |

The 276 failures: `house/__tests__` 155 (retired V2/V3 authors), `plan` 35, `villa` 36, `concept` 12, `scene` route tests 34 (still mock an operations author for Generate), and `proposalRevision` (1 stair-threshold physical expectation, 1 timeout) plus 2 V3 replay files. These are the "old Generate API contract tests" the canonical-generation report scheduled for migration. They should be rewritten as retirement assertions or removed in a dedicated change; they were left so the failure is visible rather than masked. A Generate regression in the old direct-scene tests cannot be told apart from known failures until that is done.

Mocked construction success proves contracts, not architectural quality.

## 9. Still requiring model involvement or a decision

Programme and room sizes; the stacking/height choice; whether a room is covered by an upper floor or roofed; double-height intent; roof selection; circulation topology; unsupported-feature disclosure. Software already owns placement from relations, shared walls, cuts, doors, stairs, floors and collisions. **Candidate future change (not made):** let a covered space derive `height` from the level rise (nullable field) and let a fully covered space omit its roof. It changes the provider wire contract and so needs its own offline wire tests first.

## 10. Remaining unsupported / open

Plan-level revision and repair transactions; the unsupported capabilities in §7; rendered-review-driven plan revision; migration of historical V2/V3 projects (none attempted; none needed to open them); the stale test migration.

## 11. Ready for another controlled live mansion experiment?

Conditionally. The transport schema is proven, the compiler now returns a complete defect list, and contradictory prompt text is removed. Before spending: (a) a human should confirm the prompt change is acceptable, because it alters the frozen request; (b) the stale scene-route tests should be migrated so the regression signal is clean; (c) accept that the previous failure mode (inconsistent heights) may recur, in which case the single rejection will now list every defect for a bounded revision. No improvement in architectural quality is claimed.
