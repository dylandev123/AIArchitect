# Final consolidation audit — 26 October 2026

This report supersedes the integration-status statements in [the earlier audit](../REPORT.md). That report retains the full legacy inventory, root-format/persistence analysis, original V3 frame failure evidence, and historical production-build results. Existing uncommitted work, saved designs, component records and response artifacts were preserved. No migration, commit, deployment or live OpenAI request was performed.

## Architecture before and after

| Entry point | Audited starting behavior | Current behavior |
|---|---|---|
| Main Generate / AI Edit | Already routed direct projects to the shared studio in the existing working tree | Same canonical scene endpoint, validator, executor, renderer and project history; reference images and approved learning are now available there |
| Normal Playground | Legacy viewer first; New Design switched into direct studio; Refine in legacy viewer edited a composition | Direct studio opens by default. New Design / Refine use the same endpoint and scene contract as main. Legacy viewer requires an explicit compatibility URL |
| Casa Ladera | Existing direct operations example and scene import | Same scene representation; lossless import into ordinary projects; no conversion through footprint/wing/stack builders |
| Image-first | Default page constructed an offline wing composition | Default page loads the shared studio with the saved reference image. Generate sends pixels directly to Terra and receives scene operations. Retained run/fidelity and `?compatibility=1` replays preserve older interpretation artifacts |
| Visual review | Accepted villa configurations/compositions only | Accepts and validates primary scenes too; shared renderer captures three views, reference-aware review proposes one scoped edit, canonical scene endpoint stages it, exact scope validation precedes approval |
| Curved component | Approved pavilion only in legacy compositions | Direct `pavilion` elements instantiate the same version-pinned builder, renderer and dimensional validator; scene graph owns placement/elevation/yaw |
| Reviewed learning | Retrieved by legacy villa generation only | Canonical scene endpoint also retrieves relevant human-reviewed, non-mock summaries; no geometry copied from old configurations |

```text
Main Generate → direct Project → workspace OperationStudio ─┐
Normal Playground → OperationStudio ───────────────────────┤
Image-first → reference image + OperationStudio ────────────┤
                                                         ↓
/api/ai/scene → shared scene prompt + reviewed principles + optional image input
  → sceneResultSchema → resolveSceneResult → applySceneOperations → validateScene
  → OperationScene → shared architectural parts / roof builders / curved pavilion
  → ordinary project versions OR explicit standalone Playground storage adapter

Review → same scene renderer → three PNGs + optional reference
  → /api/ai/villa/visual-review → proposed improvement + exact leaf scope
  → /api/ai/scene edit → stageSceneReviewEdit → unchanged original until approval
  → same commit/version path + immutable reviewed feedback record
```

## Authoritative modules

- `src/lib/villa/scene/model.ts`: element/operation schemas, atomic executor, IDs, attachments, openings and final validation; approved pavilion delegates to existing `pavilionPlacementSchema`.
- `src/lib/villa/scene/terra.ts`: one direct authoring prompt, request/result contract, result resolver, multimodal message assembly. Generation starts empty; editing uses current scene.
- `src/app/api/ai/scene/route.ts`: one provider dispatch, no retries, same validator and executor; retained accepted/rejected/incomplete development response artifacts. `/api/ai/villa/scene` is an exact compatibility re-export.
- `src/components/scene/OperationStudio.tsx`, `OperationScene.tsx`: primary editor and renderer for all new default workflows.
- `src/components/scene/{architecture,grounds,tropical-palm,curved-pavilion,LaderaGrounds}.tsx`: shared architectural finishes, villa detailing, approved curved construction and garden staging. Old pavilion import is a re-export, not a copy.
- `src/lib/villa/scene/roofs.ts`: adapters to the existing gable/hip builders, rendered through the existing `PrimitiveMesh`.
- `src/lib/villa/visual-review.ts`, `src/components/scene/SceneReview.tsx`, existing `review-preview.tsx`: shared capture verification, primary-scene review, atomic proposal staging and scope validation. Review cannot delete, reorder or replace component identities.
- `src/lib/villa/design-learning{,-store}.ts`: shared immutable feedback contract, capture/camera comparison and relevance retrieval. Mock feedback is excluded from generation context.
- `src/store/useProjectStore.ts`, existing project storage: main-project versions, undo/redo, save/reopen and format authority. Original V2/V3 data keeps its original format and renderer.

## Active routes and compatibility boundaries

| Route | Responsibility / boundary |
|---|---|
| `/api/ai/scene` | All default new text/image construction and conversational scene edits |
| `/api/ai/villa/scene` | Same function, retained URL compatibility |
| `/api/ai/villa/visual-review` | Optional development review, now accepts direct scenes as well as legacy snapshots; no automatic approval |
| `/api/dev/villa-design-lessons` | Existing development-only, same-origin immutable feedback storage; now supports direct snapshots |
| `/api/ai/villa` | Existing saved composition/configuration editing, request recovery, specialized legacy tools; normal New Design must not reach it |
| `/api/ai/house`, `/api/ai/house/replay` | Existing V2/V3 projects, explicit experimental V3 opt-in and retained replay; direct projects bypass these builders |
| `/api/ai/plan` | Explicit plan evaluation/authoring; separate output responsibility |
| `/api/ai/concept`, `/api/ai/concept/compact` | Separate concept analysis/image responsibilities; no automatic concept-image call added |
| `/api/ai/villa/create-component` | Existing experimental component lifecycle; never executes arbitrary model code in primary scenes |

Solana, legacy footprint/wing/stack/levels, retained image interpretations, assets and created components remain accessible through explicit compatibility pages. Useful geometry was not deleted. No additional V3 implementation change was made during this audit; pre-existing working-tree compatibility fixes are described in the earlier report.

## Integration status and material limits

**Integrated:** default main/Playground generation and refinement; shared scene construction/validation/rendering; Casa import; direct reference-image input; shared Solana-derived architectural detailing; existing gable/hip geometry; approved curved pavilion; development review of direct scenes; approved/rejected human feedback storage and non-mock principle retrieval; normal-project save/reopen/undo/redo.

**Partial adapters:** pavilion is one editable scene element with stable parent identity, not editable curved subparts. Its published width/depth/height/material bounds remain; old site-placement limits do not apply to its scene transform. Full component-library search/instantiation is not exposed in the direct schema: only the pinned approved pavilion is adapted. Legacy image interpretation artifacts are replayed through their original builder to preserve their meaning; new image-first generation uses the direct endpoint. Main projects use durable project histories; the standalone Playground retains its old scene key and in-memory undo adapter. Its undo history does not survive reload and redo is only available in normal projects. References are request/editor context and are not embedded in exported scene JSON or restored after reload.

**Unsupported:** arbitrary curved/polygonal solids, holes/CSG, arbitrary meshes, arbitrary curved roofs, automated stairs/interiors, structural/code verification. Existing shed/mansard/butterfly/sawtooth builders remain in compatibility systems: unlike gable/hip, they do not share the adapter's authored-rise/overhang semantics and require explicit tested parameter adapters. Five named direct materials remain. Full Solana is preserved rather than lossy-converted into rectangular operations. Visual review/feedback UI and storage remain development-only. No live architecture quality or image-fidelity claim is made from deterministic mocked responses. Response recovery artifacts are retained, but direct-scene response-ID replay is not a user-facing recovery tool; project history/import remain the primary recovery mechanisms.

These boundaries mean default new construction has one authority, while universal legacy feature parity and one persistence UI across all tools are not claimed.

## Verification and evidence

See `validation.json`, [primary browser evidence](browser-checks.json), and [main-site browser evidence](../browser-checks.json).

- `scripts/final-consolidation-check.mjs` intercepts every AI route and mocks feedback storage. It fails on a legacy API request, compares unrelated scene elements and IDs, verifies reference pixels reach generation/review, captures actual WebGL renders, checks undo/reload and requires explicit proposal approval. It also supplies an invalid legacy-shaped New Design response and asserts the original scene survives without fallback.
- `scripts/normal-direct-scene-check.mjs` delegates to that canonical regression, replacing the obsolete assumptions about the old initial viewer.
- `scripts/consolidation-capture.mjs` exercises home Generate, targeted edits, persisted undo/redo, reload/reopen, Casa import, shared roof geometry, legacy saved-house rendering and Solana/image replay boundaries.
- Scene integration tests cover provider multimodal input, reviewed-principle retrieval, pavilion validator reuse, out-of-range rejection, scoped review staging, preserved unrelated elements and direct feedback snapshots. Existing broad tests cover all saved-project formats and compatibility engines.
- Browser testing exposed a direct scene being passed to `DesignGrounds` during review. Fixed by keeping the legacy config prop absent for direct scenes and reusing the studio's shared garden staging. The final browser regression exercises this boundary.

Screenshots use deterministic mock Terra responses. They prove UI routing, geometry rendering and state behavior, not the quality of live model architecture. Mocked feedback is never written as an approved live lesson.

Screenshots: [Playground image generation and reused curved pavilion](01-playground-image-curved.png), [scoped reference review proposal](02-reference-review-proposal.png), [primary image-first entry](03-image-first-primary.png), [main generation](../01-home-generation.png), [Casa Ladera import](../03-casa-ladera.png), [shared pitched roof](../06-reused-gable-roof.png), [legacy saved house](../07-legacy-saved-house.png).

Final validation: **2,900 tests passed, three skipped** across 254 passing test files and two skipped files; **38 focused final tests passed**. TypeScript passes. Lint has zero errors and three existing capture-script warnings. Whitespace checks pass. Both final browser regressions report zero page errors and zero unexpected requests. Parallel development runs encountered hot-reload/chunk interference and one capture timeout; the final standalone primary regression and refreshed main-site regression passed. No production build was rerun during this final audit; prior production evidence is historical.
