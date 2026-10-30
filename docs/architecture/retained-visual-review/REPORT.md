# Retained family house visual experiment — awaiting paid authorization

Prepared the exact original `../generation-quality/final-family/scene.json` (47 editable elements). Original byte SHA-256: `b76ed99bad6f6bda1c1e6f233ef9d65e9b01b0c1c0687f97e488dc44feadf983`. `original.scene.json` is a byte-identical separate copy. No house was generated or manually improved. No paid call has been made.

## Proposed paid experiment

| Stage | Configured model | Inputs | Output ceiling |
| --- | --- | --- | ---: |
| Visual review | `gpt-5.6-terra` | Four actual 640×360 PNGs, retained brief, constructed scene evidence and existing architectural intent/knowledge evidence | 5,000 tokens |
| Refinement | `gpt-5.6-terra` | Model-selected finding and target IDs, existing editable scene and normal scoped edit instructions; no images in this stage | 12,000 tokens |
| Comparison | `gpt-5.6-terra` | Four previous and four proposed PNGs at matching camera positions/targets, scene evidence | 5,000 tokens |

Exactly one pass maximum, at most three provider requests. Review can stop without an edit; failed refinement prevents the comparison call. No retries, alternate models, Generate requests or second pass. Provider-default reasoning and production model defaults remain unchanged.

Official published standard pricing is $2/M uncached input, $0.20/M cached input and $12/M output: [OpenAI Terra model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra). Planning estimate: approximately **$0.15–$0.50** for a completed pass, depending on generated tokens, image accounting and cache reuse. The aggregate output ceiling is 22,000 tokens, or $0.264 in output charges at the published rate; input charges are additional. This estimate is not a hard dollar cap. Actual provider usage and local usage cost records will be retained.

The payload includes the house's actual screenshots, retained brief, editable geometry, intent/knowledge evidence and existing schema/system instructions. No new knowledge retrieval or database connection is required. The local runner removes database URLs from its own process and redirects usage to this directory. Credentials remain in existing configuration and are never recorded.

## Workflow inspected and preflight completed

The development-only `/dev/retained-visual-review` page exposes capture automation using the same `ReviewPreview`, `OperationScene`, `VillaScene`, transforms check and nonblank PNG checks as the Generate review loop. It has no provider transport or project save behavior. Browser routing blocks all APIs and non-local resources.

`scripts/retained-visual-review.ts` defaults to capture-only preparation. The separately authorized `--live` mode invokes the existing `/api/ai/scene/visual-review` POST function and `runGenerationReview`, with the new optional `maxPasses:1` bound. Existing callers retain their two-pass default. It retains exact provider request/response bodies without auth headers, parsed outputs, operations, records, proposed editable scene and accepted/retained scene separately. A consumed `started.json` prevents resubmission. Construction, preservation, warning and camera checks remain enforced. Scope now permits explicitly declared structural edits under the bounded policy below. Raw candidates that fail acceptance are separately staged for diagnosis using the existing operation stager where possible; they are never committed. Invalid operations retain their provider bytes and diagnostic instead of being repaired.

Before/after captures reuse recorded position and target within the existing 1e-7 numeric tolerance. If the proposed scene cannot pass validation/capture, comparison stops; diagnostic renders can subsequently be produced offline where renderable, clearly labelled rejected. The original is never overwritten.

| Baseline view | Actual review input |
| --- | --- |
| Aerial | [PNG](prepared-aerial.png) |
| Entrance (Arrival) | [PNG](prepared-arrival.png) |
| Garden | [PNG](prepared-garden.png) |
| Poolside | [PNG](prepared-poolside.png) |

[Preflight](preflight.json) records zero provider calls, no page errors, exact scene hash and four cameras. Full capture metadata/data URLs are in `prepared-captures.json`.

## Material limits of this experiment

The former twelve-ID restriction came from `generationReviewSchema`, the review/refinement prompts and the `stageSceneReviewEdit` refine-only prohibition. The normal construction engine already supported architectural additions, removals and replacements. The Generate visual-refinement path now uses its existing `resolveSceneResult` scoped-edit transaction directly, with an exact creation-ID allowlist added to the existing preservation validator. No new mutation engine or whole-house Redesign permission was introduced.

Exact limits for one refinement:

| Constraint | Enforced bound |
| --- | --- |
| Existing target IDs | At most 24, and strictly fewer than half of original elements: **23 for this 47-element house** |
| Additions | At most **32** primitive elements, each using an explicitly declared unique unused new ID |
| Removals | At most **8**, also at most floor(20% of original element count): **8 for this house** |
| Total authored/executed operations | At most **80**; assemblies are prohibited so expansion cannot evade the limit |
| Construction extent | Final scoped elements must fit the original targets’ world bounding box expanded **6 metres in every direction**, including rotated extents and roof overhangs |
| Findings acted on | One coordinated finding, one proposed transaction |
| Experiment passes / paid requests | **One pass / at most three requests**, zero retries |

Allowed normal operations are `add`, `remove`, `replace`, `move`, `resize`, `rotate`, `attach`, `place-on`, `finish` and `scale-assembly`. Retained elements keep their stable IDs; deleted IDs cannot be recycled. Target scope includes affected descendants; changing an ancestor cannot silently move unrelated children. Majority-outside-scope preservation, exact new IDs, removal budgets and local extent bounds prevent unrestricted scene replacement. Terrain, name, retained brief, knowledge evidence and architectural-plan metadata remain unchanged. Primitive roof sections, facade walls and fitted openings, shading layers, supported entrance portals, balconies/decks/guards, coordinated access and architectural details are permitted. These capabilities do not waive support, opening, access or other construction checks. Unrelated site features remain protected. Parent/attachment validation, geometry and replacement gates, no-new-construction-warning acceptance, atomic staging, stale-revision checks, camera equality and comparison rejection remain in force.

Architectural-plan metadata preservation is deliberately conservative: removing an element still referenced by programme/relationship evidence may fail the unchanged gates. A permitted transformation is not guaranteed to pass; the experiment retains failures without repair or retry.

The review endpoint has no reference-image field. Villa Solana's retained aerial has been independently inspected as a benchmark: its staggered vertical hierarchy, substantial entrance portal, glazing depth and layered roofs are visibly more developed. Solana images will not be sent through an invented reference channel. The review brief explicitly discloses that reference images are absent. The final assessment will compare the actual result against that benchmark, while acknowledging different scale, landscape and presentation. This cannot establish the model's image-to-image Solana fidelity.

The inspected family baseline has a low, almost continuous pale roofline, shallow window recesses, broad opaque arrival surfaces, a small portal and little material hierarchy. The garden canopy adds depth locally but does not give the whole composition a strong hierarchy. These are independent observations, not developer edit instructions. No geometric correction has been supplied to the model.

The model's comparison is an acceptance input, not the final quality verdict. After the authorized pass, independently inspect all four before/after views, changed IDs and audits, and answer the user's nine questions. No aesthetic success claim is possible yet.

## Verification

**235 tests pass across 44 files**, including scene construction, preservation, replacement, geometry, architecture-library, visual-review and route suites. Typecheck and focused ESLint pass. New tests exercise structural add/remove/replace through the real mocked route, thirteen existing targets, undeclared creations, ID recycling, operation/removal limits, remote/oversized geometry, preservation of unrelated elements, and actual project-store Undo/Redo. Existing tests cover stale revisions, invalid geometry, no retries, rejected comparisons and the single-pass experiment bound.

The [offline structural example](structural-offline/evidence.json) is explicitly developer-authored mocked output, not a Terra result. It changes a basic 21-element exterior using seven normal operations: one canopy removal, one retained-ID gable-to-hip roof replacement and five additions (a deeper entrance roof, two supporting piers and paired timber facade screens). All nineteen unrelated existing elements remain exactly equal. No hard or architectural findings are introduced. A separate thirteen-target mocked edit verifies the old twelve-ID cap is gone.

Eight actual 640×360 captures use normal ReviewPreview / OperationScene / VillaScene rendering with all APIs and external resources blocked. Before/after cameras match within 1e-7 and there are no page errors. The fixture's entrance faces the view labelled Garden by the existing first-entrance heuristic; it has doors on both sides. The filenames retain the renderer's labels. Visual inspection confirms the deeper supported portal, screens and hip silhouette. This verifies supported structural transformation, not premium architectural quality or Terra's ability to produce it.

| Offline mock | Before | After |
| --- | --- | --- |
| Entrance-facing view (Garden preset) | [PNG](structural-offline/before-garden.png) | [PNG](structural-offline/after-garden.png) |
| Aerial | [PNG](structural-offline/before-aerial.png) | [PNG](structural-offline/after-aerial.png) |
| Opposite view (Arrival preset) | [PNG](structural-offline/before-arrival.png) | [PNG](structural-offline/after-arrival.png) |
| Poolside preset | [PNG](structural-offline/before-poolside.png) | [PNG](structural-offline/after-poolside.png) |

[Baseline preservation](structural-offline/baseline-preservation.json) verifies that the retained family source and separate original copy remain byte-identical at the original SHA-256, and all four prepared baseline PNGs match their original retained capture data. New mock evidence is stored only in `structural-offline/`. Chrome capture required execution outside the filesystem sandbox; no provider request occurred. No paid experiment has been run.

Preparation reproduction (refuses to overwrite evidence):

```sh
npx vite-node --config vitest.config.mts scripts/retained-visual-review.ts
```

Offline structural verification reproduction:

```sh
npx vite-node --config vitest.config.mts scripts/structural-refinement-offline.ts
node scripts/structural-refinement-capture.mjs
```

These commands write only the clearly labelled mock subdirectory and make zero provider requests. The capture command uses the existing local development server on port 3015.

Paid execution is deliberately pending explicit user approval. No database changes, migrations, deployments, commits or changes to historical houses/provider responses were made.
