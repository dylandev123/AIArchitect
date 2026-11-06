# Stage 5 — offline environment construction and Terra approval packet

**The offline workflow is ready; no Terra Stage 5 call has been made.** The final rehearsal is `offline-preview-4`: the actual Terra-designed Breezeway Courtyard Villa, with the accepted Stage 4 corrections, surrounded by a clearly labelled **software-authored landscape test input**. This is construction/presentation evidence, not an AI-authored landscape checkpoint or a completed Stage 5 claim.

The rehearsal adds a connected pool garden and arrival setting without changing any accepted house element. The property feels more coherent and inhabited, but planting remains formal and repetitive, the lawn is stylized, and the house's broad empty upper terraces remain. Terra still needs to choose the landscape composition through the prepared focused request.

## Actual house and preservation

The source is `../stage4-corrections/corrected-v5.checkpoint.json` and its scene, not the old mock `stage5.*` files. No previous generation stage was rerun. All **314 accepted elements** are serialized identically within the new scene, including their IDs, materials, openings, parents and transforms. All blocks, 23 room plans, links, stairs, roof decisions and existing veranda/entrance architecture remain unchanged. Ground stays flat; `scene.terrain` is absent.

[Verification](verification.json) checks **155 original evidence files** against their pre-task hashes: none changed. The earlier Stage 3 room-area/circulation warnings remain in the final rehearsal checkpoint and the prepared request, including the 63% north-bedroom and 73% media-lounge area findings. The retained plan has four bedrooms and five bathroom rooms.

Original checkpoints, screenshots, prior uncommitted changes and historical mock evidence were preserved. New rehearsal/approval files use separate names and exclusive-create writes. Re-running the final rehearsal tag was deliberately refused, with its existing hashes unchanged.

## Measured requirements and the 400-element budget

The south veranda ends at z=12.5 m; the property ends at z=24 m, leaving **11.5 m** for pool/deck placement. The existing pool assembly costs 14 scene elements and reserves `width + 3.2 m` by `depth + 4.4 m`. Garden/arrival doors and their outward circulation strips are measured from the accepted house, rather than guessed from a plot centre.

| Item | Final rehearsal | Scene elements |
|---|---|---:|
| Accepted Terra house | Unchanged corrected Stage 4 | 314 |
| Pool assembly | 12×4.5 m water, 1.4 m basin depth, coping and dry deck ring | 14 |
| Terraces, drive and connecting walks | Non-overlapping rectangular patches, connected at real edges | 10 |
| Tropical planting beds | Mixed flowering shrubs and curved broad-leaf rosettes | 7 |
| Arrival screen planting | Instanced low hedge grouping | 1 |
| Palms | Eight individually editable feathered palms | 8 |
| Lawn regions | Four editable masked regions, internally instanced patches | 4 |
| Furniture and lighting | Table, four chairs, four loungers, sofa, coffee table, six bollards | 17 |
| **Total** | **61 site elements added** | **375** |
| **Capacity remaining** | **400 limit unchanged** | **25** |

The initial naive lawn partition had 52 rectangular fragments; exact adjacent coalescing reduced it to 29. Rendering those fragments as four semantic lawn fields saves 25 scene entries without painting grass over the pool or paving. Each field persists its normalized patch mask and remains a normal selectable/transformed component. Individual botanical leaves and grass fragments are not separate architectural identities.

Each palm now uses one semantic tree element with shared detailed trunk/frond meshes, instead of four crude box/frond scene elements. Beds use instanced botanical meshes. Chairs, loungers, tables, lights and palms each retain independent source IDs. No house components were deleted to obtain this budget. The legacy path-array allowance was expanded from eight to sixteen because this measured connected hardscape needs ten patches; the overall scene cap remains 400 and is enforced during compilation.

## What software constructs

`siteContract.ts` defines a small strict design-intent contract. `siteDesigner.ts` prepares measured facts and rules. `site.ts` derives pool placement, non-overlapping level terrace pieces, a north/west boundary drive, a west garden walk, deliberate planting bands, crown-safe palm slots, masked lawns and supported furniture.

Terra will choose pool proportion/alignment/separation/water character, paving, arrival approach/character, palm count/stature, planting/lawn character, seating and lighting. Software derives every coordinate, dimension, interval and count-dependent placement. The old coordinate-bearing Stage 5 schema and historical mock compiler path remain readable; the new request does not permit changes to house finishes.

The new contract supports this house's north entrance and south veranda. Other orientations are explicitly rejected. It offers bounded composition choices, not arbitrary free-form landscape topology or curved beds. The offline fixture is never supplied as an example answer in the Terra request.

The existing compiler, pool assembly, `OperationScene`, `WaterSurface`, feathered `TropicalPalm` and botanical geometry builders are reused. `SiteAsset` adds optional detail beneath ordinary persisted scene components. Site-only large-format stone uses reduced texture contrast and shallow relief; existing material/texture defaults remain unchanged when the new opt-ins are absent. No lighting, camera, material or terrain default of saved projects was replaced.

Furniture stands at the fixed terrace's 0.3 m surface datum; pool water is below the coping. Lawn surfaces are uniformly flat. The driveway reaches the property boundary and existing court. The west walk connects the court to the veranda/pool terrace. The independent dry-surface graph requires real shared edges at least 1 m wide; a corner touch cannot establish a route.

A stronger circulation check caught a corner-only arrival/walk join in early rehearsals. Preview 4 extends the walk to create the full-width shoulder, fits the nearby palm crown accordingly, and passes a regression that rejects the earlier connection. Early previews 1–3 remain as superseded software evidence, not final accepted layouts.

## Semantic editing and safety checks

The spec stores the site design, fixtures, source IDs and lawn masks. Scene elements retain normal semantic types such as tree, terrace, driveway, outdoor furniture, planting bed and lighting. A constrained `move-site-item` operation updates the source spec, and `set-site-design` reruns the measured site derivation. Both go through existing atomic validation.

An offline explicit-operation test moves one palm: exactly its tree element changes; no other element is added, removed or altered. An out-of-property move is rejected and returns the original spec and scene. Full save/load reconstructs identical serialized scene elements and component ownership. This is an editing-capability check, **not a live natural-language AI edit or Stage 6 implementation**.

Checks cover property containment, full conservative palm-crown envelopes, actual mesh bounds, pool/building separation, planting/paving separation, supported furniture, pairwise fixture collisions, protected door routes, lawn masks and dry connectivity. Stage 5 also retains massing/interior/exterior validation and the existing hard scene-relationship audit. Arbitrary pedestrian navigation, accessibility, pool safety/engineering and electrical design are not certified.

## Four-view comparison

Both columns use the same camera positions and targets, verified within 1e-8 m. The before scene contains the unchanged 314-element house; its cameras are matched to the final property framing so the comparison does not exaggerate the landscape's contribution. Full-canvas `-full.png` versions also exist.

| View | Accepted house without Stage 5 | Offline software landscape rehearsal |
|---|---|---|
| Arrival | [Before](offline-preview-4-baseline-arrival.png) | [After](offline-preview-4-arrival.png) |
| Aerial | [Before](offline-preview-4-baseline-aerial.png) | [After](offline-preview-4-aerial.png) |
| Garden | [Before](offline-preview-4-baseline-garden.png) | [After](offline-preview-4-garden.png) |
| Poolside | [Before](offline-preview-4-baseline-poolside.png) | [After](offline-preview-4-poolside.png) |

![Real Terra house with offline software landscape rehearsal — Terra Stage 5 pending](offline-preview-4-poolside.png)

Arrival now has a legible approach, palms and a connection around the house. Garden/poolside show the pool as part of the veranda/terrace arrangement, with separate dining and lounging areas. The aerial view shows deliberate boundary planting and connected hardscape instead of unrelated objects scattered over grass.

The existing house's generic massing, unoccupied upper terraces and several blank facade decisions remain. Site planting is still a repeated formal composition; finer species variety and more natural layered transitions would improve it. Lawns lack blade detail; large-format paving and pool water are stylized. Lighting is daytime emissive bollard detail, with no night-scene illumination claim. Background ground texture aliasing outside the authored property remains. The ground renderer does not model a full earth excavation around the below-ground basin, so the opaque stylized water surface carries most of the visual depth cue.

## Browser and performance evidence

[Final landscape browser evidence](offline-preview-4-browser.json) and [matched unchanged-house baseline](offline-preview-4-baseline-browser.json) record zero console/page errors, zero failed requests, zero HTTP error responses, finite mesh vertices and no WebGL context loss. Each view checks every scene element ID, local position and yaw against the saved scene. The global asset-library GET receives an explicit empty local response; other APIs and external requests remain blocked. No database is contacted by capture.

| Local Chrome check | House only | With offline landscape |
|---|---:|---:|
| Scene elements | 314 | 375 |
| Active architectural/site mesh objects | 800 | 955 |
| Active unique geometry buffers | 800 | 930 |
| Triangle upper bound, including instances | 141,954 | 350,854 |
| Instanced batches | 0 | 19 |
| Median frame interval, 45 samples | 16.7 ms | 16.6 ms |
| 95th-percentile interval | 18.4 ms | 18.8 ms |

The measurements are a local desktop Chrome sample, not a mobile/GPU certification or a reason to raise the element cap. Triangle counts are scene upper bounds before culling. The renderer's raw calls/triangles counter describes the last post-processing pass, so it is not used as the architectural draw count. Its geometry-cache counter grows across view resets in both baseline and landscaped runs; long-session memory behaviour remains unverified. Active geometry counts stay stable across the four views.

## Verification

**1,104 tests across 116 files pass**, including the provider-schema route tests. [Final results](verified-tests.json). Typecheck and focused ESLint pass. Checks include the actual-house preservation, strict design wire format, source save/load, individual semantic edit, invalid-edit rollback, true palm-mesh bounds, corner-only route rejection, twelve pool/alignment/arrival combinations, twelve alternative planting/seating/lighting combinations and eight ten-palm west-arrival cases.

The first wide run exposed the shared provider schema's enum budget after adding site assets. The new site-asset vocabulary now uses a bounded anchored pattern plus exact runtime membership validation, preserving the allowed values without relaxing the existing 1,000-enum gate. Final provider-schema regressions pass. The earlier failed test report is retained as diagnostic evidence and superseded by `verified-tests.json`.

Rehearsals validate with zero current hard findings. [Final checkpoint](offline-preview-4.checkpoint.json), [scene](offline-preview-4.scene.json), [save](offline-preview-4.save.json), [component/budget record](offline-preview-4.verification.json) and [preservation/camera verification](verification.json) are local-only artifacts.

## Prepared Terra call — approval still required

Review the exact [request](prepared-2.request.json), [strict wire schema](prepared-2.schema.json) and [approval/budget packet](prepared-2.approval.json). They pin the corrected house, request, schema and construction-source hashes. The preparation script has **no paid-call branch** and rejects `--live`.

- Model: `gpt-5.6-terra`, one focused Stage 5 design call.
- Planned retries: zero; output ceiling: 4,000 tokens.
- Proposed maximum: **US$0.15**. Conservative byte-based input/output bound at configured project rates: **US$0.074398**, including a 4,096-token overhead allowance.
- Recorded prior experiment spend: **US$0.07613** of US$5. Recorded remainder: US$4.92387 before the earlier unrecorded failed Stage 3 call; exact remaining balance is unknown and was not checked.
- Paid calls made in this task: **zero**. No Stage 5 Terra response exists yet.

After approval, the live executor must verify these exact hashes and cost bound, reserve a one-call marker before network access, use `maxRetries: 0`, save raw response/usage/finish reason before interpretation, refuse a second call, then derive and validate without automatic retries or design repairs. A failed result must retain the accepted Stage 4 house. The offline landscape fixture must never be presented as Terra's answer.

No Stage 6 visual-review call, live edit planner, database write/migration, commit, push or deployment occurred. Production integration, other browsers/devices, long-session memory, night lighting, engineering and live Terra design quality remain unverified.

## Offline reproduction

Use new artifact tags; existing evidence is intentionally immutable:

```sh
npx vite-node --config vitest.config.mts scripts/staged-villa-site-offline.ts new-preview-tag
npx vite-node --config vitest.config.mts scripts/staged-villa-site-prepare.ts new-approval-tag
npx vitest run src/lib/villa/staged/site.test.ts
npx tsc --noEmit -p .
# Local server on 127.0.0.1:3016, existing local Chrome/Playwright:
node scripts/staged-villa-site-capture.mjs new-preview-tag
node scripts/staged-villa-site-capture.mjs new-preview-tag --baseline
```

Viewer: `/dev/staged-villa?file=stage5-site_offline-preview-4.scene.json`. The page explicitly labels the house as real Terra output and the landscape as an offline software rehearsal pending approval.
