# Offline Stage 4 corrections — real Breezeway Courtyard Villa

The corrected house is visibly clearer and more coherent, but **the premium visual-quality goal is still not achieved**. Glazed doors, quieter window frames, readable stonework and roof surface detail improve the same retained Terra house. Broad empty terraces, simple masses and blank wall choices remain conspicuous. Work stops at Stage 4; no site generation, visual-review provider call or natural-language editing was attempted.

The final artifact is **`corrected-v5`**. All correction variants here replay the **same actual Terra response**; they are offline compiler/presentation iterations, not new AI designs or mock answers. `corrected-v1` was an over-budget-for-detail trial (350 elements, no captures); v2 tested the bundled metal photograph and recorded the asset-request failure; v3 tested stronger seam detail; v4 tuned it; v5 finishes the entrance's outside panels and handle. Earlier variants remain as diagnostic evidence.

## Source, preservation and replay

The replay reads `../stage4-exterior/live/result.json`, verifies its parsed `raw` answer equals `design` and the original Stage 4 checkpoint design, and rebuilds Stage 3 from its saved Terra responses. It refuses to proceed if Stage 3 does not serialize identically to its retained scene. It has no provider imports, environment loading or database operations.

`scripts/staged-villa-stage4-replay.ts` writes exclusively named new artifacts under this directory using exclusive-create writes. Existing output names are refused. The overwrite guard was exercised against `corrected-v5`; every final artifact hash remained identical after refusal. [Preservation evidence](preservation-after.json) verifies **all 74 original staged-villa evidence files are byte-identical** to the pre-task snapshot, including the original responses, checkpoints and screenshots. Existing unrelated working-tree changes were retained.

The corrected spec differs from the saved derived spec only by the explicit `trim.visualRevision: stage4-v2` presentation opt-in. Terra's design, all blocks and plans, links, stairs, open spaces, entrance/veranda decisions and site remain unchanged. **23 rooms, four bedrooms, five bathroom rooms** are retained. The handoff's seven-bathroom statement does not match the saved programme's room types. Validation uses the original Stage 4 minimum requirement of four bedrooms and three baths; this task adds no bathroom or interior redesign.

The [verification record](corrected-v5.verification.json) checks semantic component ownership, exact preservation of 87 interior-wall/door, slab, stair and guard elements, and records every added, removed and changed element. Regression tests additionally compare every roof's position, size, rotation, roof form and eaves. All existing component IDs remain represented; all seven actual exterior door element IDs remain stable. Trim keeps its historical wall-associated ordinal IDs rather than shifting selections to a different block when windows change. Removed elements are small shutter leaves whose openings no longer warrant them; they remain owned by the same block components.

Flat land is preserved: no terrain is authored. No original source file or checkpoint is rewritten by replay. Old saved specs without the opt-in reproduce their original serialized scene data exactly. The normal product generation flow is unchanged.

## Corrections and observed results

| Priority | Implementation | Visible result and remaining limit |
|---|---|---|
| Garden/terrace doors | Six existing `entrance` elements use two glazed leaves through existing `Glazing`; semantic type, parent, transform and size are retained. Their host wall opening stays a real sill-zero, unglazed passage. | All six previously dark opaque exterior panels now read as glass doors. They remain closed representations; no opening animation was added. |
| Window proportions | Fit glazing to the actual exposed room-side run, retaining a solid pier allowance. Bathrooms use 1.45 m privacy sills and 0.95 m high glazing; circulation gets taller daylight windows; habitable rooms get tall punched/large bays. Narrow glazing uses one pane, wider glazing two, instead of four bars everywhere. | The prison-bar effect is substantially reduced. Hall windows are taller; several bedroom windows become better proportioned. Bathroom privacy windows remain deliberately short. Two 0.8 m terrace-door sidelights remain on 1.45 m wall pieces; widening them would consume the door piers. |
| Limestone/stucco | Explicit component appearance selects the bundled stone PBR set, warm limestone tint, roughness 0.9 and zero metalness. Painted stucco selects plaster PBR with roughness 0.86. | The ground base and entrance pavilion now read as coursed masonry against plaster above. Existing stone was silently mapped to the concrete texture by `FinishBox`; the opt-in bypasses that mapping. Texture repetition and inconsistent course alignment between separate parts remain visible close up. |
| Roofs | Bronze uses the existing procedural standing-seam surface, measured 0.5 m panel spacing, 0.02 m bump scale, warmer tint, roughness 0.58 and metalness 0.38. The veranda receives the same finish. Gable-end infill receives the supporting wall's masonry finish. Clay maps to the existing terracotta PBR set rather than timber. | Bronze roofs have legible seams and coordinated values, replacing plain brown planes and the unrelated dark veranda slab. They still read as stylized warm grey/bronze and can look washed out. Actual seam folds, ridge/hip caps and flashing are absent. The retained Terra design chooses bronze, so terracotta routing is tested in code but has no real-house visual claim. |
| Facade depth | Continue existing cornice components along exposed heads of terrace-bearing lower walls and upper blocks. Remove paired shutters from small privacy/circulation openings, keeping them on suitable larger windows. | The long south base gains a continuous wall-head shadow line, and upper walls gain a clearer termination. This is modest articulation, not a redesigned facade. The upper-east-suite west warning remains; its exposed wall fragments total only 0.6 m², although the metric names the full 8 m block side. No ornament was added to that sliver. |

Roof diagnosis preceded finish selection: pitched roof primitives previously received no texture surface; the flat veranda used default dark bronze without the pitched roofs' tint; gable infill reused roof material. The first bundled metal-photo trial looked like grey slate in the actual renders, so it was replaced with the existing seam pattern at restrained physical scale. Roof geometry, daylight, exposure, sky, post-processing and global material defaults were left unchanged. Remaining broad roof planes and plain junctions are geometric/design constraints that tint alone cannot cure.

The renderer changes are optional per-component fields (`appearance`, `roofWallFinish`) and an optional procedural-detail setting on existing `PrimitiveMesh`. Existing scenes omit these fields and retain the same path. No new scene kind, alternate renderer, custom decoration in captures or generation engine was introduced. Timber entrance panels and handles are derived render parts under the existing door identity; the closer [entrance capture](corrected-v5-detail-entry-full.png) confirms they are visible from outside.

## Element budget and measurements

| Measure | Original | Corrected v5 |
|---|---:|---:|
| Scene elements | 307 | **314** |
| Capacity below 400 for Stage 5 | 93 | **86** |
| Rooms | 23 | 23 |
| Glazed exterior door components | 0 | 6 |
| Windows in existing exterior metric | 26 | 31 |
| Short/narrow windows in that metric | 13 | 9 |
| Median window height/width | 0.82 | 1.44 |
| Stage 4 validator/hard relationship findings | 0 | 0 |

There are 33 added scene parts and 26 removed small shutter leaves: net +7. Additions are 15 wall-head cornices, ten sill/lintel pieces for improved circulation glazing, and eight shutter leaves on suitable larger windows. Existing metrics classify floor-height glass-wall bays as doors; the nine remaining short-window flags are bathroom privacy windows, while two narrow door sidelights fall into that metric's door category. Counts alone do not establish aesthetic success.

## Direct four-view comparison

The following use the original crop, viewport, renderer and normal view buttons. The original files remain untouched. Full-canvas captures also exist with `-full.png` suffixes, avoiding the historical crop's clipped building edges. A fresh unchanged-scene baseline (`corrected-v4-baseline-*`) supplies verified camera positions and targets for the final `corrected-v5-final-*` captures. An earlier v5 capture suffered a development refresh that reset Garden to Arrival; it is retained but superseded. The final run pins and checks all four baseline cameras within 1e-8 m before capture.

| View | Original Stage 4 | Final correction | Assessment |
|---|---|---|---|
| Arrival | [Original](../stage4-exterior/terra-stage4-arrival.png) | [Corrected](corrected-v5-final-arrival.png) | Masonry base and roof seams are clearly readable; the terrace door is transparent. The blank side of the entry pavilion remains a design choice. |
| Aerial | [Original](../stage4-exterior/terra-stage4-aerial.png) | [Corrected](corrected-v5-final-aerial.png) | Roofs share a coherent covering and veranda colour; unchanged broad terraces and simple roof composition still dominate. |
| Garden | [Original](../stage4-exterior/terra-stage4-garden.png) | [Corrected](corrected-v5-final-garden.png) | Opaque terrace door and narrow mullioned glazing improve clearly; stone at the base and wall heads gives contrast. The empty elevated terrace remains severe. |
| Poolside | [Original](../stage4-exterior/terra-stage4-poolside.png) | [Corrected](corrected-v5-final-poolside.png) | All visible garden/terrace doors read as glazing, small windows are calmer and the veranda roof coordinates. No pool exists at Stage 4; this is the view preset's name. |

![Corrected real Terra villa, poolside preset](corrected-v5-final-poolside.png)

The historical developer viewer chooses the first `entrance` element, which can be an interior door, for its Arrival camera. That behaviour is preserved for comparison; the supplemental entrance detail targets the actual semantic front door. This task does not claim the Arrival preset fully evaluates the entrance composition.

## Browser resource error investigation

The previous `ERR_FAILED` was reproduced and traced to **`GET /api/assets`** from `RootLayout` → `AssetLibrarySync` → `hydrateAssetsFromServer`. The initial fully blocked v2 capture records the exact URL, initiator, resource type and failure in [its browser log](corrected-v2-browser.json). It was unrelated to scene texture loading, but was a real capture error and was not discarded by a broad console filter.

The final capture harness explicitly returns `{catalog: [], queue: [], glbIds: []}` for that one GET without contacting the server/database. All other API and external requests remain blocked and would fail the check. The stub supplies no scene geometry or finish assets. Bundled stone, plaster, timber and concrete textures load locally with successful responses; bronze seams are procedural.

[Final four-view browser evidence](corrected-v5-final-browser.json), [unchanged-scene baseline](corrected-v4-baseline-browser.json), and [entrance detail evidence](corrected-v5-detail-browser.json) record zero console/page errors, zero request failures, zero HTTP error responses, no WebGL context loss and finite mesh vertices. Every view verifies the exact rendered element-ID set, local positions and yaw against its serialized scene. Default Three.js deprecation warnings remain outside this task's scope.

## Verification and practical limits

- **1,058 tests across 114 files passed:** `npx vitest run src/lib/villa src/components/scene`. [Results](tests.json). This includes six new real-Terra correction regressions; existing provider mocks make no live calls.
- The final focused run passed **41 tests**, covering the six correction regressions and the provider-schema route suite with mocked providers. [Results](final-focused-tests.json).
- `npx tsc --noEmit -p .` passed, including after the final entrance-render change.
- Focused ESLint passed with no warnings after cleanup: staged library, appearance helper, changed scene renderer components, `PrimitiveMesh`, dev viewer page and replay script.
- Replay validation, semantic-preservation checks, all-original-file hash checks and the overwrite-refusal check passed. Final [scene](corrected-v5.scene.json), [checkpoint](corrected-v5.checkpoint.json), [verification](corrected-v5.verification.json) and [preservation manifest](preservation-after.json) are separate from original evidence.

The remaining generic character comes partly from retained architectural choices: rectangular masses, wide empty terraces, several authored solid facade sides and a flat long veranda. The room solver's fixed partitions also limit where attractive window rhythms can be built; prior room-area and narrow-circulation warnings remain visible. Improving these decisively would require architectural changes beyond the authorised preservation scope.

Rendering/construction limits also remain: simple hip/gable meshes, no L-shaped pitched roof over exposed lower-floor remnants, no detailed ridge/hip/abutment assemblies, planar window/door glazing and chunky trim, repeated texture courses, stylized glass and flattened daylight contrast. Better tint and existing trim can improve this house but cannot supply those missing constructions. The unchanged ground surface still aliases visibly. Close-up timber/stone textures remain too coarse for a finished premium presentation. Interior fit-out, landscape and pool are absent at this checkpoint.

Not verified: hosted production, whole-repository tests outside the listed suites, other GPU/browser combinations, live AI edits, Stage 5 site construction, a terracotta render of this bronze-designed house, or generalisation to other Terra designs. No claim of complete semantic editing coverage, physical engineering or code compliance is made.

No paid calls, credential changes, database writes/migrations, commits, pushes or deployments were made. Stage 5, visual AI review and natural-language editing remain untouched.

## Offline reproduction

Use a new tag; output names are intentionally immutable:

```sh
npx vite-node --config vitest.config.mts scripts/staged-villa-stage4-replay.ts new-review-tag
npx vitest run src/lib/villa/staged/exteriorCorrections.test.ts
npx tsc --noEmit -p .
# With the local dev server on 3015 and local Chrome/Playwright available:
node scripts/staged-villa-stage4-corrections-capture.mjs new-review-tag
node scripts/staged-villa-stage4-corrections-capture.mjs new-review-tag --entry-detail
```

The dev viewer accepts `/dev/staged-villa?file=stage4-corrections_corrected-v5.scene.json`. The capture script uses the same existing local Playwright/Chrome paths as the retained Stage 4 script; `PLAYWRIGHT_CORE_PATH` can override the module path.
