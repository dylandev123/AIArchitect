# First actual live Terra natural-language house edit

**Yes: one live Terra response correctly interpreted the approved pool instruction, and the existing software turned that response into a validated, saved and visibly changed 3D candidate.** This is a bounded developer-workflow demonstration on an actual generated house, not a generally available website feature.

The accepted original Terra Stage 5 Breezeway Courtyard Villa remains unchanged. The edited house is a separate candidate. The rejected roof candidate was not used or modified.

[Interactive matched comparison](live-edit-1/comparison.html) · [editable live candidate save](live-edit-1/candidate.save.json) · [candidate scene](live-edit-1/candidate.scene.json) · [source checkpoint](live-edit-1/candidate.checkpoint.json).

## The actual model decision

Exact user instruction:

> Move the swimming pool two metres closer to the veranda without changing the building.

The model received the exact prepared `live-prepared-1` text/context/strict-schema body, compact SHA-256 `c5ef1b7615f09e96f08c3c32d4bed066b8dd4685cf6325c66a0ba073aea12132`. Every pinned construction/source and accepted-save hash matched before transmission. The schema and model/output/budget controls were rechecked. The conservative bound was **US$0.044835**, below the approved **US$0.06** ceiling. Standard model pricing was rechecked against [official documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

Terra's unchanged returned proposal is:

```json
{
  "summary": "Move the existing swimming pool 2 metres towards the south veranda.",
  "ops": [
    {
      "op": "move-pool-relative",
      "pool": "pool",
      "veranda": "veranda:south-veranda",
      "direction": "towards",
      "distance": 2
    }
  ]
}
```

This proposal was parsed from the actual raw provider output. The runner did not read the developer mock proposal to apply it, did not rewrite any model field and did not ask for a repair. The exact target/reference/direction/distance were checked before calling the existing `editAcceptedStagedSave` service. A mismatch would have stopped the experiment.

The operation schema already restricted this first test to a single pool-relative edit and the pool identity `pool`; measured context supplied the existing veranda ID and spatial datums. Terra selected the correct reference, direction and distance within that constrained vocabulary. This is not a test of ambiguous selection among multiple pools or arbitrary architectural-edit intents. No vision input was needed or sent for this semantic language-planning request.

[Raw provider response](live-edit-1/raw-response.json), [raw output text](live-edit-1/output-text.txt), [unmodified proposal](live-edit-1/proposal.json), [schema validation](live-edit-1/schema-validation.json), [instruction interpretation validation](live-edit-1/interpretation-validation.json).

## One call, usage, cost and finish

| Item | Actual result |
|---|---:|
| Requested/returned model | `gpt-5.6-terra` |
| Paid requests / retries | **1 / 0** |
| Maximum output | 2,000 tokens |
| HTTP / response status | **200 / completed** |
| Finish reason | **stop**, derived from completed Responses status |
| Input tokens | **814** |
| Output tokens | **61** |
| Reasoning tokens | **0** |
| Cache-read / cache-write tokens | **0 / 0** |
| Total tokens | **875** |
| Exact usage-based calculated cost | **US$0.00236** |
| Approved cap | **US$0.06** |

Cost is `(814 × US$2 + 61 × US$12) / 1,000,000 = US$0.00236` at the rechecked published standard rates. Raw usage is retained; an independent invoice was not checked. The existing US$5 experiment ceiling was not increased; historical missing usage remains missing.

The standalone runner uses one direct POST, no retry library, no redirects, no fallback and no follow-up model request. Exclusive sticky attempt/network evidence prevents a second run, including after failure. A later invocation **without `--live`** confirmed reuse refusal before credentials/network. Raw response and usage/finish/cost were written before semantic interpretation. The existing configured credential was reused silently and never printed, changed or saved in evidence.

[Authorization/attempt](live-edit-1/attempt.json), [preflight](live-edit-1/preflight.json), [network marker](live-edit-1/network-sent.json), [HTTP evidence](live-edit-1/http.json), [usage/cost/finish](live-edit-1/result.json).

## Source, complete assembly and geometry verification

The model's operation was applied by the existing accepted-save editing service, semantic operation, compiler and validation infrastructure. The live runner did not implement an alternate pool construction or repair path. The service reports zero provider calls because it is a deterministic editing service; the separate live result records the one upstream provider request.

| Spatial fact | Baseline | Live candidate |
|---|---:|---:|
| Veranda outer edge z | 12.5 m | 12.5 m |
| Pool water near edge z | 15.3 m | 13.3 m |
| Water-to-veranda clearance | 2.8 m | 0.8 m |
| Pool width × depth × basin depth | 12 × 4.5 × 1.4 m | unchanged |
| Near dry apron depth | 1.5 m | 0.1 m |
| Elements | 377 | **379**, below 400 |

The full assembly is coherent, not merely a shifted water surface:

- All **14 pool component IDs** remain.
- The **13 basin/floor/water/wall/coping/side-deck/far-deck components** translate exactly **2 m** toward the veranda in world Z, with unchanged X/Y and dimensions.
- The near apron is recomputed rather than rigidly pushed through the veranda. Its root frame moves by a different amount because its depth is shortened. Child local offsets change accordingly; their final world-space movement is exactly two metres.
- One directly affected terrace strip is clipped/split and the vacated reservation is filled with dry paving. No unrelated plant/furniture relocation or legacy silent deletion reconciliation occurs.

The full source/site/bounds/physical-relationship/route validation returns **zero findings**. Save/reload recompiles to the same candidate scene and retains semantic ownership. All 23 rooms, four bedrooms and five bathroom rooms remain. Prior room-area/circulation warnings remain attached to the candidate; no engineering, regulatory or complete-navigation certification is claimed.

[Existing editor result/source/diff](live-edit-1/edit-result.json), [complete assembly world-space verification](live-edit-1/assembly-verification.json), [construction and preservation verdict](live-edit-1/verification.json).

## Exact changed IDs and preserved work

**Existing changed IDs (15):**

`pool`, `pool-floor`, `pool-water`, `pool-wall-z-minus`, `pool-wall-x-minus`, `pool-coping-z-minus`, `pool-coping-x-minus`, `pool-deck-x-minus`, `pool-wall-z-plus`, `pool-wall-x-plus`, `pool-coping-z-plus`, `pool-coping-x-plus`, `pool-deck-x-plus`, `pool-deck-far`, `path-terrace-1`.

**New dependent paving IDs (2):** `path-terrace-1-pool-1`, `path-pool-edit-infill-1`.

**Removed IDs: zero. Existing unchanged elements: 362.** All **314 original house elements are byte-identical**, including room/wall geometry, roofs, stairs, doors, windows, materials and finishes. Unrelated palms, beds, hedges, lawn masks, furniture and paths remain fixed. The upper hip source rise is still **2.45 m**; the rejected roof edit is absent.

The accepted Stage 5 source, scenes, checkpoints, responses and all prior evidence remain untouched. Of 560 pre-existing dirty/untracked files pinned before work, the only intentional existing-file change after application was the development viewer's exact live-candidate mapping/provenance label. New runner/capture/report files are separate; no production editing logic was altered for this call.

## Actual 3D render proof

Eight new captures render the original and actual-live candidate through the normal **OperationScene/VillaScene** renderer at the same original arrival/aerial/garden/poolside cameras. The candidate inputs come from `live-edit-1/candidate.scene.json`, not the earlier mocked candidate. Camera/target differences are below 0.00000001 m. Viewport, crop, assets, materials, daylight, seeded randomness and fixed water phase match.

The browser evidence additionally records each actual rendered operation's world transform and the rendered pool meshes' world bounding boxes. All 13 translated pool parts' actual mesh bounds move by exactly two metres within floating-point tolerance, while X/Y bounds stay unchanged. The apron bounding geometry changes as intended. This checks rendered geometry, not just source JSON.

| View | Baseline | Actual live result | Side-by-side |
|---|---|---|---|
| Arrival | [Before](live-edit-1/before-arrival.png) | [After](live-edit-1/after-arrival.png) | [Compare](live-edit-1/comparison-arrival.png) |
| Aerial | [Before](live-edit-1/before-aerial.png) | [After](live-edit-1/after-aerial.png) | [Compare](live-edit-1/comparison-aerial.png) |
| Garden | [Before](live-edit-1/before-garden.png) | [After](live-edit-1/after-garden.png) | [Compare](live-edit-1/comparison-garden.png) |
| Poolside | [Before](live-edit-1/before-poolside.png) | [After](live-edit-1/after-poolside.png) | [Compare](live-edit-1/comparison-poolside.png) |

The garden/poolside and aerial pairs visibly show the water/coping nearer the unchanged veranda, and dry paving in the former far-side pool area. Furniture remains stationary. The requested spatial change is visible and correct. This test does not claim an independent beauty improvement; it tests whether the language instruction is correctly executed.

All eight captures pass exact element IDs/positions/yaw, finite geometry, and no WebGL context loss. Browser errors, failed requests and HTTP errors are zero. The unrelated asset-catalog GET is served an empty local catalog; other APIs/external resources are blocked. Existing THREE deprecation warnings remain. Four labelled comparison images and all eight interactive toggle checks pass.

[Actual renderer geometry verification](live-edit-1/renderer-geometry-verification.json), [before browser evidence](live-edit-1/before-browser.json), [after browser evidence](live-edit-1/after-browser.json), [comparison/toggle checks](live-edit-1/comparison-checks.json).

## Reload, subsequent editability and checks

The actual live candidate reloads with its authoritative source and compiled scene intact. A clearly labelled **in-memory deterministic verification** then moves the reloaded pool 0.2 m away using the same service and reloads that test result. It passes, makes no model request and is not persisted; the actual live candidate file remains unchanged. This is editability verification, not a second live experiment or a developer correction of Terra's response. [Editability evidence](live-edit-1/editability-verification.json).

Six focused accepted-house tests pass in this task, as do typecheck and focused ESLint. The previous task's broader 1,142-test result is historical and was not rerun here because editing/compiler code was unchanged. Exact wire/source/schema/budget checks, one-call reuse refusal, construction/preservation, save/reload and rendered geometry checks all passed. [Tests](live-edit-1/tests.json), [final checks](live-edit-1/final-checks.json).

The isolated capture server was stopped. No further AI calls, commits, pushes, deployments, database changes, credential changes or hidden developer corrections occurred. No accepted baseline replacement was performed.

## What still prevents general website availability

This demonstrates the first **bounded live natural-language edit on an actual AI-generated house** in the developer workflow. General availability still needs:

1. **Production orchestration and UI:** the current accepted-save HTTP proof is development-only and accepts an injected proposal. The website does not yet connect a user's edit text to authenticated model planning, this executor, candidate preview, approval/undo and project history. This experiment called the same core service from a one-shot runner; it did not turn on a public paid endpoint.
2. **Authoritative project persistence and permissions:** hosted projects must retain and version the editable specification alongside the scene, enforce ownership and stale-version protection, and atomically save accepted edits. Existing scene-only/other-generation projects cannot be assumed to contain that source. No database integration or migration was performed here.
3. **Broader validated capabilities:** this planner schema supports one pool-relative operation, one semantic pool and a south-facing veranda in rich-site staged saves. Other orientations, multiple candidate objects, ambiguous requests and other architectural changes need their own measured contracts, dependency rules and preservation/geometry tests. A single successful villa edit does not prove arbitrary styles or buildings.
4. **Production spending/error controls:** user authorization, durable one-call/idempotency guards, per-user billing, cancellation, refusal/error UX and audit records must be integrated safely. This experiment uses local evidence and explicit per-call approval, not production bookkeeping.
5. **Broader product evidence:** tests across more actual generated houses, browser/devices, concurrent edits and longer sessions are still needed. Generation aesthetics, facade-operation effect limitations, existing rendering weaknesses and roof precision risks remain separate unresolved work.

The next capability work should build on the authoritative-spec/semantic-edit/compiler/preservation/save/render path proven here. It should not assume every future natural-language request is executable or replace unrelated architecture to force acceptance.

**Stopping point:** exactly one approved paid call completed; its unmodified output produced a correct, visible, separately saved candidate. The accepted original villa remains Stage 5. No additional paid call or broader feature work was performed.
