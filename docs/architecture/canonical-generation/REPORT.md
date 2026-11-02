# Generation authority audit and canonical migration

This report records the initial migration. The subsequent [canonical expressiveness extension](../canonical-expressiveness/REPORT.md) documents the current compiler scope and offline evidence; the original migration findings below are retained.

The canonical authority for **new houses** is now `POST /api/ai/scene` → `src/lib/villa/canonical/generate.ts` → `architectural-plan-1` → `compileArchitecturalPlan` → the existing `OperationScene` within `VillaScene` → captured visual review. No new application was created. This is an initial migration with a bounded envelope compiler, **not a complete-house or premium-quality claim**.

## Authority inventory and disposition

| Workflow / code | Authority before migration | Disposition |
|---|---|---|
| Home → direct-scene workspace (`src/app/page.tsx`, `WorkspaceShell.tsx`, `OperationStudio.tsx`) | `/api/ai/scene`, most recently design proposal then a second AI-authored operations response | Retain entry point, workspace, project history and renderer. New Generate now requests one canonical plan and compiles locally. The UI consumes the compiler scene directly rather than passing it through the old provider operations interpreter. |
| Direct-scene Generate (`scene/terra.ts`, `designGeneration.ts`, `designProposal.ts`) | Narrative/programme evidence and provider-authored component transforms/operations | Deprecate as a new-house author. The old Generate block is retained behind the canonical dispatch guard for migration review, never a fallback. Keep parsers, operations execution, audits and scoped editing for saved scenes. Remove obsolete Generate prompts/provider branches and two-stage construction author after contract migration. |
| Semantic pilot (`experimental/semantic-building/compiler.ts`, `generation.ts`) | Offline dependency-injected proposal → deterministic compiler, isolated from production | Retain compiler as the canonical compiler's construction kernel. It already owns shared boundaries, opening cuts, matched doors, floor profiles, stair treads/voids and access graphs. Keep pilot session readers and offline fixtures. Deprecate the separate pilot proposal as a production authoring contract; later relocate the kernel without deleting historical imports abruptly. |
| V2 document pipeline (`architecture/document.ts`, `architecture/compiler.ts`, `architecture/stages/pipeline.ts`, `ai/generation.ts`, `ai/finalAssembly.ts`) | `/api/ai/house`: legacy operations, staged architecture documents, compiler and final assembly | Retain saved-document parsing/validation/rendering and existing edit behavior. `mode:generate` now returns 409 with zero provider calls before mode selection. Remove paid initial generation/stage/final-assembly authors after callers and tests migrate. Do not remove shared compilers or capability builders solely because a generator is retired. |
| V3 (`v3/architecturalBlueprintGeneration.ts`, `v3/generation.ts`, `v3/architecturalConcept.ts`, `v3/compactMassing.ts`) | `/api/ai/house` selected provider scene/blueprint and normalization paths; `/api/ai/concept` offered another live author | Retain V3 readers, validators, compiled geometry, normalizers needed by saved data, and edits. House Generate and live concept POST are blocked. Offline compact/concept conversion remains evidence tooling. Remove live authoring flags/branches after migration; no environment flag restores a competing live concept author. |
| V3 plan-first evaluation (`/api/ai/plan`) | AI 2D design, then separate AI exterior elaboration | New `action:design` is blocked. Existing saved-plan `elaborate` remains a compatibility workflow, requiring a retained evaluation plan. Deprecate its authoring format; do not silently convert saved plans or use elaboration as a new-generation fallback. |
| Villa playground (`/api/ai/villa`, `villa/composition.ts`) | Provider-authored villa configuration/components | New Generate is blocked. Retain saved configuration/composition replay, edits and component creation. Remove house-generation author after migration, preserve component and asset systems. |
| `/api/ai/villa/scene` | Compatibility URL re-exporting scene POST | Retain: it delegates to the same canonical authority, not a separate engine. |
| `/api/ai/house/replay` | Paid development stage replay | Provider replay is blocked. Retained response/artifact readers and offline deterministic replay remain available. |
| Existing visual review (`scene/generationReview.ts`, `/api/ai/scene/visual-review`) | Four rendered views, bounded AI operation refinement and comparison | Retain legacy review for old scenes. Canonical candidates receive assessment only; the endpoint rejects refine/compare before spending. Findings or capture failure reject the candidate; a clean assessment records `reviewed-envelope`, never complete-house certification. |
| Legacy viewport and renderers (`workspace/viewport`, `house/generateHouse.ts`) | Rendering saved V2/V3/config projects | Retain for compatibility. New generation uses only `OperationScene` and normal `VillaScene` presentation. Remove old renderers only after explicit lossless adapters and saved-project coverage exist. |
| Knowledge, assets, design lessons, recovery artifacts | Inputs and supporting services | Retain as inputs/tools, not alternate house authors. Canonical generation uses approved architectural knowledge and reference images through existing input assembly. No new asset generator or renderer was introduced. |

## Canonical contract and ownership

`src/lib/villa/canonical/plan.ts` defines a strict versioned JSON contract:

- `site`: dimensions, elevation and terrain intent.
- `masses`: stable identity, architectural role and selected relationships.
- `levels`: floor-to-floor rises and above-level references.
- `spaces`: room/outdoor use, mass/level references, selected width/depth, envelope heights and relative placement references.
- `portals`: hosted openings and door/window/open passage intent.
- `stairs`: lower/upper room references, width/run, landings and headroom; software selects the supported centred flight location.
- `roofs`: roof-to-space allocations; no duplicated roof flags on rooms.
- `terraces`: explicit outdoor-space references.
- `pools`: relative placement and basin dimensions; compiler produces water, bottom and enclosing walls.
- `landscape`: relative placement and dimensions for lawn/bed surfaces.
- `materials`: floor, wall and roof finishes, using the existing material vocabulary.
- `cameraViews`: Aerial, Arrival, Garden and Poolside, each once; existing presentation code owns the actual camera poses.

The model selects architecture: composition, room dimensions, relative placement and alignment, level rises, hosts and circulation intent. It supplies no point coordinates or polygon arrays. Software resolves the acyclic placement graph, centres the building on the site, derives level datums, room polygons and the stair origin. Coordinates for generated components, world transforms, wall sharing, floor thickness, opening cuts, door transforms, riser counts, treads, stair voids, roof geometry, access targets/graph, bounds, collision checks and provenance belong to software. The provider schema has no scene operations, wall/slab arrays, generated evidence, access-target array, room polygon arrays, component transforms or riser count.

The canonical plan is saved in `scene.architecturalPlan` inside the existing `architectural-scene-1` project container. Rendering consumes the compiled scene. Reload validates and preserves saved geometry; it does not regenerate an old project using a newer compiler. Optional review status is backward compatible with existing scenes. Canonical scene operation editing is blocked rather than allowing edits to drift away from retained plan authority; plan revision UI is a subsequent migration step.

## Actual gates and supported scope

Compilation rejects schema violations, duplicate identifiers, invalid references, occupied-volume overlap, unsupported partial boundaries, disconnected interior allocations, unmatched opening hosts, insufficient stair/landing dimensions, missing enclosure, out-of-site geometry and site-allocation collisions. Site collision checks use conservative projected bounds and can reject valid close arrangements; they do not certify arbitrary intersections. Every emitted element receives source provenance. No alternate author is invoked after rejection.

Supported now through the canonical contract: rectangular room cells, exact complete shared edges, one portal per edge, sill-zero openings, flat roofs, straight ascending flights with the pilot's explicit right bypass, flat sites, rectangular pools and lawn/bed ground surfaces. Ground-level walking, headroom and structural checks remain bounded proofs. The compiler is not a packing solver, code checker, foundation designer or complete navigation solver.

The schema represents every requested category, but its vocabulary is deliberately bounded. It does **not yet** support a general production architectural language: pitched/overhanging roofs, conventional elevated-sill windows, partial shared edges, arbitrary stairs, planting/trees, grading, engineering, services, guards and full interiors still require extension. The model is instructed to return `decision-required` for an unrepresentable brief; compiler/schema failure cannot fall back to a simpler operations-generated house. Brief completeness still depends partly on the planner and rendered assessment: automated tests do not prove that every requested programme item was included.

The first repair policy is an explicit **zero automatic repair budget**, followed by rejection. Canonical candidates are saved as `pending-visual-review`; the existing normal render capture supplies all four views. Findings produce `rejected`. Clean review produces only `reviewed-envelope`. Capture/provider/schema failure also rejects without a retry; concurrent user revisions are preserved. Rejected geometry remains a labelled candidate in version history, not an approved replacement. The server Generate response itself is only a compiled candidate; external callers must execute rendered review before treating it as reviewed. Review status is workflow metadata, not a security attestation.

## Remaining migration sequence

1. Establish the authority boundary (implemented here). Existing home creation already chooses direct-scene projects. Old Generate URLs explicitly refuse incompatible clients instead of returning a differently shaped response that might corrupt a V2/V3 project. Migrate any old client wishing to create a house to a new direct-scene project; never change the generation mode of an existing saved project automatically.
2. Extend this same plan/compiler for full room programmes, segmented walls/multiple elevated openings, richer roof sections, graded foundations, general circulation/guards, editable planting and interior construction. Add deterministic completeness and negative geometry tests for each feature before offering it to the planner. Remove remaining model-authored duplicated choices as derivation rules become available.
3. Add plan revision transactions. Compare canonical plan identities, compile a candidate, refuse conflicts with manually detached geometry, and preserve unrelated project history. Reuse the pilot's revision-conflict mechanisms rather than introducing a second executor. Legacy scene edits remain compatibility-only; canonical edits currently fail explicitly.
4. Add bounded **plan-level** repair using rendered findings plus source bindings. At most two revisions, explicit changed plan entities, fresh compile/physical checks, identical cameras and rendered comparison. Reject on regression, missing evidence, unchanged failure or exhausted budget. Never request hand-authored repair walls/slabs/operations.
5. Version compiler output and retained evidence, add richer rendered regression fixtures, and migrate old Generate API contract tests to canonical dispatch/retirement assertions. The old test suites asserting successful V2/V3/direct-operation generation describe retired API behavior; they are not silently deleted or advertised as passing here.
6. Offer explicit adapters for old saved formats only after representative round-trip/replay tests prove identity, geometry, materials and metadata preservation. Maintain old readers indefinitely where lossless adaptation is unavailable. Once no caller uses an old author, remove its paid generation branches and prompts; preserve shared geometry libraries and readers still referenced by saved projects.

## Verification

Focused verification: **92 tests pass across 12 files**: canonical authoring/authority/compiler/review, existing semantic kernel/generation proofs, existing generation review, V3 project modes, project storage/persistence, semantic rendering and the retained V2 architecture compiler. Provider calls are mocked. Compiler tests cover two levels with an actual stair void and derived flight, reachable interiors, every selected floor/roof/opening, pool shell/water, landscape surface, deterministic replay, malformed authoring and collision/enclosure/access rejection. Transport review fixtures are synthetic PNG headers, not actual rendered quality evidence. No live provider request or visual-quality claim was made.

Focused ESLint passes. Repository-wide typecheck remains blocked by pre-existing errors in `docs/architecture/design-first/live-2026-10-30/experiment-script.as-run.ts` (broken relative imports and consequent type errors) and `scripts/sol-planning-comparison-review.ts` (duplicate property). Those unrelated files were left unchanged. Source-only TypeScript checking passes using the existing compiler settings, excluding the unrelated docs/scripts evidence files.

No application replacement, format deletion, automatic saved-project conversion, paid generation, commit or deployment was performed. Existing uncommitted changes were preserved.

Reproduction (offline; no provider credentials required):

```sh
npx vitest run src/lib/villa/canonical src/lib/villa/experimental/semantic-building/compiler.test.ts src/lib/villa/experimental/semantic-building/generation.test.ts src/lib/villa/scene/generationReview.test.ts src/lib/v3/__tests__/projectMode.test.ts src/lib/storage/__tests__/projectStorage.test.ts src/lib/storage/__tests__/persistence.test.ts src/components/scene/semanticRendering.test.ts src/lib/architecture/compiler.test.ts
```
