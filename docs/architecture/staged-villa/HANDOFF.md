# AI Architect continuation handoff — current through live Stage 5 (2026-11-04)

**Read this current section first.** The complete previous handoff is retained below under “Historical handoff”; its pending-work statements, counts and risks describe that earlier point in time. This update supersedes them where explicitly stated. Read `AGENTS.md` before work; read relevant `node_modules/next/dist/docs/` guides before application code. Continue the existing project, do not restart generation.

## Current accepted baseline and immediate next work

The actual Terra-designed **Breezeway Courtyard Villa** now has real Stages 1–5, with accepted offline Stage 4 compiler/presentation corrections. Latest source checkpoint: [stage5-site/terra-stage5.checkpoint.json](stage5-site/terra-stage5.checkpoint.json); normal viewer scene: [stage5-site/terra-stage5.scene.json](stage5-site/terra-stage5.scene.json); editable source-and-scene save: [stage5-site/terra-stage5.save.json](stage5-site/terra-stage5.save.json).

- **377/400 scene elements**, comprising **314 unchanged corrected house elements + 63 site elements**; **23 slots remain**. Do not silently delete architecture or raise the limit.
- **23 rooms, four bedrooms, five bathroom rooms**, existing stairs/circulation and semantic component identities retained. The previous handoff's “seven baths” was incorrect; saved programme room types establish five. Construction validation retains its earlier minimum of four bedrooms/three baths; minimum requirements are not actual room counts.
- Flat **60×48 m** property; `scene.terrain` remains undefined. Latest derivation adjustments **zero**, validation findings **zero**. Prior Stage 3 room-area/circulation warnings remain disclosed; zero construction findings do not erase them or certify engineering, complete navigation or code compliance.
- Existing compiler and normal `OperationScene`/`VillaScene` renderer are reused. This is a constructed, semantically addressable villa with landscape, not a claim of finished premium visual quality or production readiness.

**Next priority: Stage 6 visual AI review and bounded architectural refinement using the actual current screenshots.** No Stage 6 implementation or review-model call has been run. First inspect the source/checkpoint and four real renders, define a strict review/refinement contract with semantic targets, preservation boundaries, element/cost limits and measurable acceptance. Separate architectural decisions from renderer/material defects. Implement and validate the bounded application path offline before any approved paid review. Keep screenshot input, raw review, proposed operations, diffs, findings and before/after images as separate evidence; reject invalid edits atomically. Existing `src/lib/villa/visual-review.ts` is earlier-system infrastructure, not proof of staged integration. A screenshot critique alone is not a refinement system.

**Subsequent priority: prove natural-language AI editing on this same actual Stage 5 villa.** Use a live planner producing existing constrained semantic operations, apply via the validated spec/compiler path, show exactly what changed and what stayed fixed, save/reload and render. No live edit planner, Stage 6 or production UI/API integration is yet proven. The last user authorization was exactly one Stage 5 call and is consumed; obtain new approval for any further paid model execution. Do not automatically proceed from this documentation task into implementation.

## What changed since the historical handoff

### Stage 4: safe offline replay and visual corrections — accepted baseline

Read [stage4-corrections/REPORT.md](stage4-corrections/REPORT.md). `scripts/staged-villa-stage4-replay.ts` has no provider/environment/database operations. It reads the original `stage4-exterior/live/result.json`, verifies raw/design equality, rebuilds actual Stage 3 from retained Terra responses and requires exact replay of its scene. It writes exclusive new filenames, refuses overwrite and retains the original Terra answer/checkpoints. Corrected spec opts in with `trim.visualRevision: 'stage4-v2'`; historical specs without it retain their original serialized output.

- Six existing garden/terrace door identities now render two glazed leaves through existing glazing components, in real sill-zero wall passages; no animated opening was added. Timber front-door panels/handles remain under the existing identity.
- Windows use actual exposed room-side dimensions and room functions, with solid piers and privacy sills. Narrow panes have fewer mullions; circulation glazing is taller. Bathroom privacy windows and constrained door sidelights remain small deliberately.
- Limestone uses bundled stone PBR with warm tint/roughness 0.9; stucco uses plaster/roughness 0.86. Diagnosis found stone had mapped to concrete. Opt-in component appearance corrects this without changing global defaults.
- Bronze uses existing procedural standing seams at measured spacing with coordinated veranda finish; gable infill uses its supporting wall finish. Terracotta mapping was tested in code but **this real house has bronze**, so no real-house terracotta visual claim.
- Existing cornices/sills/lintels/shutters provide modest facade depth, avoiding ornament on an almost nonexistent exposed upper-wing wall fragment. Roof geometry, massing, plans, stairs and daylight were preserved.
- Original Stage 4 **307 → corrected 314** elements (33 added parts, 26 small shutter leaves removed); original component ownership retained, seven exterior door IDs stable, 87 interior/slab/stair/guard elements exactly preserved. This differs from Stage 5's stricter preservation of every one of those 314 elements.

Accepted artifact is **corrected-v5**. Earlier corrected-v1…v4 and early v5 captures are retained diagnostics, not separate Terra designs. Use `corrected-v5-final-{arrival,aerial,garden,poolside}.png` and `corrected-v5-final-browser.json`; an earlier v5 capture had a development refresh camera reset and is superseded. Entrance detail: `corrected-v5-detail-entry-full.png`. Replay overwrite refusal and original evidence hashes were checked; 74 earlier artifacts stayed unchanged at that stage.

Renderer additions are optional `appearance`, `roofWallFinish` and procedural-detail fields. They reuse existing rendering paths; do not generalize their visual claims to all saved projects. Files involved include staged compiler/trim/exterior code, `src/lib/villa/scene/appearance.ts`, `OperationScene.tsx`, `architecture.tsx`, `PrimitiveMesh.tsx` and textures. No alternate renderer or one-shot generation engine was introduced.

### Stage 5: offline infrastructure, then ONE actual Terra call

Read [stage5-site/REPORT.md](stage5-site/REPORT.md) for the **software-authored offline rehearsal**, and [stage5-site/LIVE-REPORT.md](stage5-site/LIVE-REPORT.md) for the **actual live result**. The former's pending-approval/live-quality statements are historical and superseded by the live report. Do not substitute `offline-preview-4` for Terra output.

New `siteContract.ts`, `siteDesigner.ts` and `site.ts` provide strict design-intent schema, measured request and deterministic geometry/spacing/bounds/clearance construction. Terra chooses pool scale/alignment/separation/water, paving, arrival character, palm count/stature, planting/lawn character, seating and lighting; it does not author coordinates or modify the house. Compiler/site validators and save/edit infrastructure support this optional rich-site path while keeping legacy mock specs readable.

Efficient geometry stays semantically meaningful: each palm is one editable tree element with shared detailed meshes, repeated bed plants are instances, lawn groups have editable masked patches, and seats/tables/loungers/lights retain IDs. `src/components/scene/SiteAsset.tsx` renders these assets. Path-array allowance increased from eight to sixteen for the connected hardscape; total scene cap stayed **400**. Site-asset vocabulary uses an anchored bounded pattern plus exact runtime membership to avoid exceeding the shared strict-schema enum budget; provider-schema regressions passed.

The user approved **one** Terra Stage 5 call: US$0.15 maximum, 4,000 output tokens, zero retries, within existing US$5 experiment ceiling. `scripts/staged-villa-site-live.ts` pins prepared-2 request/schema/compiler/base hashes, checks serialized wire cost bound, writes exclusive attempt/network markers, prevents a second request and records complete raw response/usage before construction interpretation. The call completed normally (`stop`) with **2,228 input + 582 output tokens** (201 reasoning; zero cache-read; raw provider also reports 2,225 cache-write). Usage-based cost **US$0.01144**, at approved project rates; independent billing invoice not checked. Recorded staged experiment spend is **US$0.08757**, excluding the earlier failed Stage 3 call's lost cost and unrelated prior canonical experiments. Exact historical remaining balance is therefore unknown; the ceiling was not raised. Do not rerun the paid script or remove its marker.

Actual Terra selected a **12×4.5 m turquoise pool** centred on the south veranda, close separation, limestone coping/terraces and north arrival drive, four loungers, shaded dining, a separate garden lounge, ten medium palms, layered tropical boundary beds, four lawn panels and arrival/garden bollards. Software constructed connected walking surfaces, arrival court/driveway, bounds and placements. No construction repair or design substitution occurred; zero adjustments/findings. Every one of the corrected house's 314 serialized elements is identical. Save/load reconstructs the same scene. All 246 prior evidence files remained unchanged during that task.

## Exact evidence and checkpoint map

Paths below are relative to `docs/architecture/staged-villa/` unless stated otherwise.

| Provenance | Source and construction | Images / reports |
|---|---|---|
| Real Terra Stages 1–2 | `live-1/raw-response.json`, `live-1/stage2.scene.json` | Historical section below |
| Failed real recursive Stage 3 | `live-1/stage3.raw.json`; preserved failure, never successful baseline | Historical diagnosis below |
| Real Terra programme Stage 3 | `stage3-programme/live/result.json`, `stage3-programme/live/stage3.scene.json`; `stage3Checkpoint.ts` / `loadTerraStage3()` | Stage 3 evidence directory; retained warnings |
| Real original Stage 4 | `stage4-exterior/live/request.json`, `stage4-exterior/live/result.json`, `stage4-exterior/terra-stage4.checkpoint.json`, `stage4-exterior/terra-stage4.scene.json` | `stage4-exterior/terra-stage4-{arrival,aerial,garden,poolside}.png` |
| Same real house, offline corrected Stage 4 | `stage4-corrections/corrected-v5.checkpoint.json`, `.scene.json`, `.verification.json` | `stage4-corrections/REPORT.md`, `corrected-v5-final-{arrival,aerial,garden,poolside}.png`, `corrected-v5-final-browser.json`, `preservation-after.json` |
| Developer Stage 5 rehearsal on real house — NOT Terra landscape | `stage5-site/offline-preview-4.checkpoint.json`, `.scene.json`, `.save.json`, `.verification.json` | `stage5-site/REPORT.md`, `offline-preview-4-*.png`; matched comparison `offline-at-terra-stage5-{arrival,aerial,garden,poolside}.png`, `offline-at-terra-stage5-browser.json` |
| Approved actual Terra Stage 5 | `stage5-site/prepared-2.{request,schema,approval}.json` (historical approval file still says awaiting; consumed authorization in `live/attempt.json`); `stage5-site/live/wire-request.json`, `raw-response.json`, `http.json`, `result.json`, `terra-design.json`, `derivation.json`, `validation.json` | `stage5-site/LIVE-REPORT.md` |
| Latest actual complete villa | `stage5-site/terra-stage5.checkpoint.json`, `.scene.json`, `.save.json`, `.verification.json` | `stage5-site/terra-stage5-{arrival,aerial,garden,poolside}.png` plus `-full.png`; `terra-stage5-browser.json`; `live/{preservation-before,preservation-after,final-checks}.json` |

Corrected Stage 4 source scene SHA-256: `ef689e7e7b4ff49f1582a7810f228834aa65dac0fe10dd359dc397e0d11f2668`. Approved packet pins construction sources too; do not alter historical packet/hash evidence when refining future code.

**Mock warning:** Top-level `stage1/2/4/5.*`, `edit-*`, `casa-corallina.save.json`, top-level `stage5-*.png`, `mock-offline*`, `mockDesigner.ts`, `mockEditPlanner.ts` and `*.fixture.ts` are developer examples/tests. `offline-preview-1…4` use the real house but software landscape input. Correction replay variants use the real fixed Terra answer, not mock architecture. These three provenance classes must remain explicitly labelled.

Latest developer-only viewer URL: `/dev/staged-villa?file=stage5-site_terra-stage5.scene.json`. Corrected house-only URL: `/dev/staged-villa?file=stage4-corrections_corrected-v5.scene.json`. Prefix mapping also supports original Stage 4. Scene renders normally, with local-file loading restricted to development. Rich-site viewer targets the actual semantic front door instead of the old first-entrance heuristic, which could select an interior door.

## Current visual assessment and lessons

The landscape coherently connects house, veranda, pool and seating. Matched-camera comparison with rehearsal shows lighter limestone arrival paving and more numerous/lower palms; pool/terrace/furniture remain very similar because Terra chose the same corresponding schema options. **Do not claim a dramatic improvement or premium quality from zero findings.**

Architectural limitations: generic rectangular massing/proportions, broad roof planes, large empty upper terraces, restrained/blank elevations, fixed room partitions restricting window rhythms, simple roof junctions. Refined finishes alone cannot solve these. Any future architectural refinement needs explicit bounded scope and preservation/diff checks rather than silently moving rooms or changing accepted roofs.

Landscape/design-contract limitations: large empty lawns, narrow regular boundary bands and limited freedom within discrete schema choices. Terra's privacy/shade narrative exceeds the visible small plants. Repeated assets, sparse procedural palm crowns and limited species/size variation are rendering/asset constraints as well as software-layout constraints; they should not all be attributed to poor Terra prose.

Rendering limitations: simple animated coloured water without convincing optical depth, simplified furniture, missing ridge/hip caps/flashing and detailed roof abutments, planar glass, chunky trim, repeated/coarsely aligned texture courses, washed-out lighting/materials and visible surrounding-ground aliasing/repetition. Terracotta has no actual-house render proof. Night lighting is untested; bollards are daylight details, not a proven illumination system. No interior fit-out or engineering certification.

The failed one-shot system mixed interdependent programme, roof, facade and site coordinates in one long response, yielding contradictions and weak designs despite schema acceptance; first-error failure obscured other causes. The earlier direct-generation quality audit (`../generation-quality/REPORT.md`) also found plain repeated masses, false fixed-glass access claims and unmet premium quality despite valid construction. Its six outputs are a separate historical experiment, not the staged villa. Staging succeeds better by constraining each model decision, measuring actual built context, assigning exact geometry to deterministic software, validating independent relationships and retaining the last good checkpoint. This real 23-room villa plus landscape is concrete evidence of constructability improvement; one successful design is not statistical proof of design quality or generalisation. Keep the staged approach; do not return to one-shot generation.

## Editing infrastructure, preservation and integration gaps

`src/lib/villa/staged/edits.ts`: `EditPlanner`, strict `editPlanSchema`, `applyOps`, `runEdit`, semantic `diffScenes`. Operations: `resize-room`, `set-roof`, `add-block`, `move-pool`, `set-entrance`, `set-facade`, `set-finish`, plus `set-site-design` and `move-site-item`. `save.ts` stores spec+compiled scene+history in `staged-house-save-1`; load recompile rejects stale/tampered scene mismatch. Component ownership maps scene IDs to rooms, blocks, roofs, stairs, veranda, entrance, pool and landscape. Semantics do not mean every derived leaf/plant instance is independently editable.

Offline tests moved a single palm with exactly one changed tree element and rejected an out-of-bounds move atomically. Rich-site conflicting edits reject rather than silently trimming masks/furniture. Legacy `reconcileSite` can trim/remove site items; do not assume it preserves the rich real landscape or use that behavior as authorization to delete components. Old `move-pool` is south-veranda-specific; coupled furniture/routes need full validation. No live natural-language edit of this villa exists. Mock-edit success is not live AI proof; production revise code belongs to another flow until integrated and tested.

Preserve all original responses/checkpoints/captures, current semantic identities and unrelated dirty-tree work. New refinements get separate immutable names and source hashes; no overwriting accepted checkpoints or relabelling mock evidence. Preserve plans/stairs/massing/roof unless later scope explicitly authorizes a bounded change. Carry Stage 3 room-area/narrow-circulation warnings forward. Enforce flat site, collision/route checks, stable semantic ownership and 400 cap; only 23 slots remain. Never reset, clean, restore, discard, or silently remove architecture.

Provider/security: credentials reuse existing configuration without printing or changing secrets. Live script calls provider directly with local evidence instead of production DB bookkeeping; raw requests contain project design information, so review exact payload before future authorization. Existing one-call markers must stay. Every future call needs a hard budget, output cap, zero retries and raw/usage/finish recording before interpretation; failure stops, no automatic repair call. Current Stage 5 approval does not authorize Stage 6/editing calls. Pricing is project-configured, not independently invoice verified; historical failed usage is missing.

Production: staged flow remains developer-only, not integrated into production `/api/ai/scene`, `OperationStudio`, persistence/permissions/billing or hosted editing. Old canonical/direct/revision code remains modified alongside staged work; do not assume all dirty files form one approved release. No deployment, hosted check, production DB mutation/migration, commit or push occurred. HEAD deployment status is unknown. Next dev server started for captures was stopped; verify ports before starting another and do not kill unrelated servers.

## Testing evidence and safe commands

These are **previously observed results**, not tests rerun during this handoff-only update:

- Stage 4: 1,058 tests / 114 files (`stage4-corrections/tests.json`); 41 final focused tests (`final-focused-tests.json`); typecheck/lint passed. Opt-in historical replay and overwrite refusal tested.
- Stage 5 offline infrastructure: **1,104 tests / 116 files** including provider-schema route mocks; `stage5-site/verified-tests.json` is the final passing report. Earlier failed `tests.json` is retained diagnosis, superseded after enum-budget fix.
- Live Stage 5 task: **11 site tests**, `npm run typecheck`, focused ESLint passed; source save/load, all 314 house-element equality, 246 historical artifact hashes and cap/flat-site validation passed. `stage5-site/live/final-checks.json` records these. No additional paid calls in tests.
- Four actual + four rehearsal browser views verify all IDs/positions/yaw, finite geometry, no context loss; no page/console/resource/HTTP errors. Cameras match within 1e-8 m (observed maximum difference ~1.42e-14 m). Full canvas and historical crop both retained.
- Prior resource error was traced to `RootLayout → AssetLibrarySync → GET /api/assets`, not assumed harmless. Capture harness returns an empty offline catalog for that GET; blocks other APIs/external resources; bundled textures load locally. No DB was contacted for captures. Do not broadly filter browser failures.
- Short 45-frame local sample: actual median 16.7 ms/p95 18.4 ms; rehearsal 16.7/18.3 ms. Not long-session performance proof. Geometry cache increases during view resets also occurred on baseline; memory lifecycle remains unverified.
- Not verified: full repository/API/admin/proxy suite beyond listed checks, hosted deployment, other GPUs/browsers/devices, engineering/vehicle swept paths/code compliance, night lighting, long-session memory/performance, independent invoice, live editing or visual-review model integration, generalisation to other real houses.

```sh
# Read-only/offline validation; never run paid commands just to reproduce evidence.
npx vitest run src/lib/villa/staged
npx vitest run src/lib/villa src/components/scene src/app/api/ai/scene/route.providerSchema.test.ts
npm run typecheck
npx eslint src/lib/villa/staged src/lib/villa/scene/appearance.ts src/components/scene/SiteAsset.tsx
# Replay original real Stage 4 into a NEW tag, no provider call:
npx vite-node --config vitest.config.mts scripts/staged-villa-stage4-replay.ts new-review-tag
# SOFTWARE landscape rehearsal only; NEVER label this Terra:
npx vite-node --config vitest.config.mts scripts/staged-villa-site-offline.ts new-offline-tag
# Local isolated capture server (needs permission to bind in restricted environments):
npm run dev -- --hostname 127.0.0.1 -p 3016
# Existing scene, fresh output prefix; never overwrite prior captures:
node scripts/staged-villa-site-capture.mjs terra-stage5 --capture=new-terra-capture
node scripts/staged-villa-site-capture.mjs offline-preview-4 --capture=new-rehearsal-capture --match=new-terra-capture
```

Capture requires local Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and Playwright from `/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core`, overridable by `PLAYWRIGHT_CORE_PATH`. Stage 4 correction capture uses port 3015; Stage 5 capture uses 3016. `--baseline` renders corrected-v5 at the selected site's retained cameras. Scripts use exclusive outputs; choose new tags. `staged-villa-site-prepare.ts` has no paid branch, and `staged-villa-site-live.ts` refuses further execution once `live/attempt.json` exists. Do not remove evidence to make a dry/live script runnable. Actual Stage 5 reload via `loadHouse` is the offline reconstruction path; do not rerun Terra to load it.

## Current working tree — exact Git inventory at this update

Branch `main`, HEAD `5f3e39d`. Everything remains uncommitted; the staged directory and this handoff are untracked within a directory entry. The following is Git's compact inventory (directory entries include additional files). The older inventory below is retained historical context, not the current list. Do not infer authorship or release authorization merely from modification status.

Tracked modified entries: 34; untracked entries: 41.

```text
 M src/app/api/ai/scene/route.providerSchema.test.ts
 M src/app/dev/semantic-building/viewer.tsx
 M src/components/admin/AdminGate.tsx
 M src/components/scene/OperationScene.tsx
 M src/components/scene/OperationStudio.tsx
 M src/components/scene/RejectedPlanPanel.tsx
 M src/components/scene/architecture.tsx
 M src/components/workspace/viewport/house/PrimitiveMesh.tsx
 M src/lib/house/architecture/profiles.ts
 M src/lib/house/roof/gableRoof.ts
 M src/lib/house/roof/hipRoof.ts
 M src/lib/proceduralTextures.ts
 M src/lib/villa/canonical/composition.test.ts
 M src/lib/villa/canonical/composition.ts
 M src/lib/villa/canonical/compositions.test.ts
 M src/lib/villa/canonical/consolidated.test.ts
 M src/lib/villa/canonical/coordination.test.ts
 M src/lib/villa/canonical/coordination.ts
 M src/lib/villa/canonical/diagnose.ts
 M src/lib/villa/canonical/plan.ts
 M src/lib/villa/canonical/rejection.ts
 M src/lib/villa/canonical/revision/revise.ts
 M src/lib/villa/canonical/revision/revision.test.ts
 M src/lib/villa/canonical/roofAbutment.test.ts
 M src/lib/villa/scene/codeArchitecture.test.ts
 M src/lib/villa/scene/evidenceRevision.ts
 M src/lib/villa/scene/generationQuality.ts
 M src/lib/villa/scene/model.ts
 M src/lib/villa/scene/programme.ts
 M src/lib/villa/scene/relationships.ts
 M src/lib/villa/scene/roofs.ts
 M src/lib/villa/scene/spatial.ts
 M src/proxy.test.ts
 M src/proxy.ts
?? docs/architecture/production-rejected-2026-11-03/
?? docs/architecture/roof-facade-exposure-2026-11-03/
?? docs/architecture/staged-villa/
?? scripts/production-rejected-analysis.ts
?? scripts/roof-facade-exposure-capture.mjs
?? scripts/roof-facade-exposure-offline.ts
?? scripts/stage4-identity-check.ts
?? scripts/stage4-offline.ts
?? scripts/stage4-verify-s3.ts
?? scripts/staged-villa-capture.mjs
?? scripts/staged-villa-checkpoints.ts
?? scripts/staged-villa-edits.ts
?? scripts/staged-villa-live-assess.ts
?? scripts/staged-villa-live-exterior.ts
?? scripts/staged-villa-live-massing.ts
?? scripts/staged-villa-live-programme.ts
?? scripts/staged-villa-live-save-stage2.ts
?? scripts/staged-villa-live-stage3.ts
?? scripts/staged-villa-probe.ts
?? scripts/staged-villa-programme-offline.ts
?? scripts/staged-villa-run.ts
?? scripts/staged-villa-save.ts
?? scripts/staged-villa-site-capture.mjs
?? scripts/staged-villa-site-live.ts
?? scripts/staged-villa-site-offline.ts
?? scripts/staged-villa-site-prepare.ts
?? scripts/staged-villa-stage4-capture.mjs
?? scripts/staged-villa-stage4-corrections-capture.mjs
?? scripts/staged-villa-stage4-replay.ts
?? src/app/api/ai/scene/revise/
?? src/app/dev/roof-exposure/
?? src/app/dev/staged-villa/
?? src/components/scene/RejectedPlanPanel.test.ts
?? src/components/scene/SiteAsset.tsx
?? src/lib/villa/canonical/productionRejected.test.ts
?? src/lib/villa/canonical/roofExposure.fixture.ts
?? src/lib/villa/canonical/roofExposure.test.ts
?? src/lib/villa/canonical/roofOwnership.test.ts
?? src/lib/villa/canonical/rootCauses.ts
?? src/lib/villa/scene/appearance.ts
?? src/lib/villa/staged/
```

Only this handoff was changed in the documentation-update task. No application code, models, database, Git history or deployment was changed. Historical evidence hash manifests predate this intentional handoff update: do not falsely claim this revised handoff still matches its old hash. All other evidence must remain untouched.

---

# Historical handoff — preserved verbatim below

# AI Architect: staged villa generation, handoff (as of 2026-11-04)

Read `AGENTS.md` first: this repo's Next.js has breaking changes; read `node_modules/next/dist/docs/` before touching app code.
Nothing below is committed, pushed or deployed. Last commit: `5f3e39d`.

## 1. Why we moved to staged generation

- **Old system:** one large Terra call produced a whole canonical house (rooms, roofs, facades, site) that a compiler then had to accept. Evidence is in `docs/architecture/canonical-*` and `production-rejected-2026-11-03/REPORT.md` (the repo's own analysis; I did not re-derive it).
- **Failure pattern (from those reports):** the one-shot answers carried many contradictory authored decisions. The retained production plan `caribbean-beach-estate-01` had 69 errors in 19 root causes, almost all Terra decisions: overlapping roof overhangs, facade rhythms on shared walls, openings between rooms with no shared wall, a lawn outside the site, spans with mixed heights. The compiler stopped at the first problem, which hid many others. Fixes to diagnosis and roof exposure are in `roof-facade-exposure-2026-11-03/REPORT.md`; that plan still does not compile.
- **Staged approach:** each stage is a small, inspectable model decision. Software builds and measures all geometry, validates it, and keeps a checkpoint. A failed stage never destroys the last good one. Terra decides character and relationships; software derives coordinates.

## 2. Architecture (Stages 1-4 implemented; Stage 5 and 6 not)

All in `src/lib/villa/staged/` (untracked, new):

| File | Role |
|---|---|
| `spec.ts` | Source-of-truth `HouseSpec` zod schema (blocks, plan trees, links, stairs, exterior, trim, siteWork). Constants: SLAB 0.3, STOREY 3.4, WALL_H 3.1 |
| `pipeline.ts` | `runStagedGeneration`, `measure`, `applySlice`, budgets (`CallBudget`), `DesignerError` (keeps usage and raw text on failure) |
| `programme.ts`, `roomSolver.ts` | Stage 3: Terra's flat room programme (no coordinates) and the deterministic solver that builds guillotine plans |
| `layout.ts`, `openSpaces.ts` | Plan geometry helpers; open spaces (veranda/terrace) separated from enclosed blocks |
| `compile.ts` | Deterministic `HouseSpec` to `ArchitecturalScene` compiler (walls, openings, slabs, stair, roofs, veranda, entrance, site). Stage 4 refinements are gated on `spec.trim` |
| `exteriorTrim.ts` | Software-derived trim: plinth, cornice, sills, lintels, shutters, entrance portal, with a 400-element budget |
| `exterior.ts` | Stage 4: Terra wire schema, local rules (`exteriorIssues`), `deriveStage4`, `measureExterior`, `roomPlanWarnings` |
| `exteriorDesigner.ts` | Stage 4 request builder and `LiveExteriorDesigner` (one call, no retries, injectable model) |
| `validate.ts` | Stage validators plus `relationshipFindings` (the independent scene audit) |
| `edits.ts`, `save.ts` | Semantic edit operations on the spec; save/load (`staged-house-save-1`) |
| `liveDesigner.ts`, `mockDesigner.ts`, `mockEditPlanner.ts`, `*.fixture.ts` | Live Terra designer for Stages 1-5 (Stage 3 uses the programme schema); developer mocks (labelled as mocks) |
| `stage3Checkpoint.ts` | Rebuilds the real Terra Stage 2+3 spec and scene from saved responses with no model call |

Related: `src/app/dev/staged-villa/page.tsx` is a dev-only viewer (`/dev/staged-villa?file=<name>.scene.json`; `live-1_` and `stage4-exterior_` prefixes map to subfolders). It renders through the normal ArchitecturalScene viewer.

**Stage contracts**
1. **Stage 1** (direction: identity, hierarchy, palette) and **Stage 2** (blocks: id, role, cx, cz, w, d, level, `open`) came from one live Terra call.
2. **Stage 3:** Terra returns `{rooms, connections, stairs, intentions}`. The solver gives areas, walls, doors, stair run; every layout is re-validated by `measure`.
3. **Stage 4:** Terra returns character decisions only (roof form, pitch, eave class, finishes, facade style per side, window trim, railing, entrance, garden/terrace doors, veranda style). Software derives the rest: rise from pitch, eaves clamped to site/neighbours (logged in `derivation.adjustments`), door widths from measured free wall, veranda span and column count, openings, trim.

## 3. What real Terra calls have produced (model `gpt-5.6-terra`)

| Call | Result | Cost |
|---|---|---|
| Stage 1+2 (`live-1/raw-response.json`) | Breezeway Courtyard Villa: 6 blocks (living plinth, east wing, entry pavilion, south veranda open space, upper bedroom bar, upper east suite) | US$0.0193 |
| Stage 3, first attempt (`live-1/stage3.raw.json`) | **Failed**: valid JSON but a brace slip in a recursive plan. Billed but the amount was lost (old pipeline dropped usage; now fixed) | unrecorded |
| Stage 3 programme (`stage3-programme/live/result.json`) | **Success**: 23 rooms, 4 bedrooms, 7 baths; software built 2 layouts, layout-1 chosen | US$0.0347 |
| Stage 4 (`stage4-exterior/live/result.json`) | **Success** (4,360 in / 1,119 out tokens, finish `stop`, ~12 s) | US$0.0221 |

Recorded total about US$0.076 of the US$5 experiment budget (excludes the unrecorded failed Stage 3 call and any earlier canonical-generation experiments). The Stage 4 script refuses a second paid call.

## 4. Checkpoints (all under `docs/architecture/staged-villa/`)

- **Stage 2 (real Terra):** `live-1/raw-response.json` (source of truth), `live-1/stage2.scene.json`. Top-level `stage1/2.checkpoint.json` and `stage2.scene.json` are **mock** (older developer-authored pipeline), not Terra.
- **Stage 3 (real Terra):** `stage3-programme/live/result.json` (programme + construction slice), `stage3-programme/live/stage3.scene.json`. Rebuilt byte for byte by `loadTerraStage3()`; pinned by SHA-256 in `exterior.test.ts`. Do not overwrite it.
- **Stage 4 (real Terra):** `stage4-exterior/terra-stage4.checkpoint.json` (design, derivation, spec, metrics, warnings), `terra-stage4.scene.json`, `live/request.json`, `live/result.json`, screenshots `terra-stage4-{arrival,aerial,garden,poolside}.png`. `mock-offline*` files are renders of a developer-authored mock answer (`exterior.fixture.ts`).
- **Caution on numbering:** the older files `stage4.*`, `stage5.*`, `edit-*`, `casa-corallina.save.json` and `stage5-*.png` in the top folder come from the earlier mock pipeline (mock stage 4/5), not from the real Terra Stage 4 above.

## 5. Deterministic construction and editing

- **Room solver:** beam search that generates guillotine trees (not a general constraint engine). It handles up to ~9 rooms per block comfortably, cross-block door alignment, stair stacking, ensuite pairing and bedroom privacy. Known gaps are in section 10.
- **Compiler:** walls are cut per room-side run; openings come from facade style via `bays()`; the scene cap is 400 elements.
- **Component identity:** `compileHouse` returns elementId to component (`room:x`, `block:x`, `roof:x`, `stair:x`, `entrance`, `veranda:x`, `pool`, `landscape:x`). Stage 4 verified (offline) that every Stage 3 non-exterior-wall element is identical in id, position and size, and that rooms, links and stairs are unchanged. Exterior wall pieces are re-cut around openings (ids change, total run per room side is conserved except where doors are cut). The open-space plate becomes the veranda under the same name.
- **Editing:** the spec is the source of truth. `edits.ts` has constrained semantic operations (resize-room, set-roof, add-block, move-pool, set-entrance, set-facade, set-finish) run through `runEdit`; software re-derives geometry and revalidates, and a rejected edit leaves the spec unchanged. Edit model calls: **no live edit planner was run**, only the mock planner.

## 6. Tested vs untested

**Tested (offline, passing as of the last run):**
- `npx vitest run src/lib/villa src/components/scene`: 113 files, 1,052 tests passed. `npx vitest run src/lib/villa/staged`: 59 tests passed.
- Type check `npx tsc --noEmit -p .`: clean after the final edit.
- `npx eslint src/lib/villa/staged`: clean at last run, apart from one unused-import warning (`Edge`) in `compile.ts` that I did not fix.
- Strict-schema compatibility of the Stage 3 and Stage 4 wire schemas; a mocked provider makes exactly one call and prices it.
- Stage 4 on the real Stage 3: zero validator findings, zero hard relationship conflicts, 307 elements, all rooms reachable from the entrance.
- Real renders in the browser (arrival/aerial/garden/poolside of the real Stage 4, plus the mock) inspected by eye.

**Not tested / not verified:**
- Whole-repo tests beyond `src/lib/villa` and `src/components/scene` (API routes, proxy, admin) were not re-run in this work.
- The Stage 4 capture reported one `ERR_FAILED` console error I believe is the capture script blocking a non-local request; not confirmed.
- No visual-review model call, no live edit-planner call, no Stage 5 live call, no live Stage 4 re-run after the corrections below.
- The Stage 1-5 `LiveDesigner` for Stages 4-5 (old schema) was never run live.
- No browser run on the hosted deployment; none of this is wired into the production `/api/ai/scene` flow.

## 7. Current visual deficiencies (Stage 4 corrections to make first, all offline)

Seen in `terra-stage4-*.png`; the house is clearly better than the Stage 2 boxes, but not yet "beautiful":
1. **Garden and terrace doors render as solid dark panels** (bronze, unglazed). Defect in `compile.ts`/`bays()`: they should be glazed French doors.
2. **Window proportions:** 13 of 26 windows are slit-like (<0.9 m wide or <1.2 m tall) and the median window is wider than tall. "punched" sizing in `bays()` refined mode is too small; also north-facade windows are tiny.
3. **Stone vs stucco contrast is lost:** "stone" walls render near white (limestone texture plus pale tint). Needs a stronger colour, or a stone-only plinth band taller than 0.6 m.
4. **Bronze roof reads muddy brown** and the veranda roof as a dark slate slab; revisit colours (`COLORS.roof` in `exterior.ts`) and give roofs more value variation.
5. **Facade relief:** the 18 m south plinth facade and the east suite west facade have almost no relief (measured 0.00 m).
6. **Roof terraces:** the two lower blocks under upper volumes (plinth, east wing) stay flat terraces; no pitched roof for an L-shaped uncovered area.
7. Entrance portal and doors read dark; check the door material is timber with visible panels.
After corrections, rebuild offline from the saved Terra answer (`result.json`), no new paid call: re-run `finish()` logic in `scripts/staged-villa-live-exterior.ts` (add an `--offline-replay` path) so Terra's design stays fixed.

## 8. Planned work

**Stage 5, site (not started for the real house):** pool, lawns, beds, trees, hedges, paths on flat ground. Compiler support and a mock exist (`compile.ts` stage 5, `validateSite`, `siteSchema`), and the LiveDesigner has a stage 5 prompt, but there is no live Terra run and no real-house checkpoint. Need: measured request (building footprint, veranda, entrance court, pool footprint rule `x ± (w/2+1.6), z..z+d+4.4`), keep everything inside the site and clear of the building, and verify against `validateSite`.

**Stage 6, not started:**
- Visual-review model call on screenshots (a one-call, budget-capped step; `src/lib/villa/visual-review.ts` exists from the earlier system but is not wired to staged output).
- Live AI editing: Terra plans `EditOp`s from an instruction and selected component; software applies them via `runEdit`. Needs a live `EditPlanner`, an API route/UI hook, and an edit-history save.
- Integration with the real product (`/api/ai/scene`, `src/app/api/ai/scene/revise/`, `OperationStudio`), none of which is done for staged output.

## 9. Architectural rules and requirements to preserve

- **Flat land by contract:** ground elevation 0, no terrain, no grade compensation; `scene.terrain` must stay undefined.
- Coordinates in metres, x east, z south (north = -z), origin at site centre. Blocks are axis-aligned rectangles on level 0 or 1; same-level blocks may touch but not overlap; an upper block must be at least 60% supported (cantilever at most 3 m).
- Terra makes architectural decisions; software derives anything measurable (wall runs, opening positions, roof junctions, door widths, eaves, rise). Never ask Terra for coordinates it can be given measured data for.
- **Do not silently move interior walls** to improve the exterior. Stage 3 plan warnings must stay visible in every later stage (north bedroom 63% of requested area, media lounge 73%, two 1.8 m ensuites, 18 x 1.8 m ground gallery, 2.1 x 8 m east-suite hall, narrow family lounge).
- A stage failure must preserve the last good checkpoint. Every paid call: hard call and cost budget, `maxRetries: 0`, raw response and usage saved before interpretation, refuse a second paid call.
- Component ids must be stable and semantic (`room:`, `block:`, `roof:`, `veranda:` and so on) so edits stay possible; every build must pass `relationshipFindings` with zero hard conflicts.
- "Geometrically valid" is not "visually successful": measure proportions and look at renders; do not report visual success without it.

## 10. Known limitations and risks

- Renderer primitives are boxes, thin glass rails, simple hip/gable roofs and per-element tints on three textures; no recessed or arched windows, no real stone/tile textures, no pitched roof over an L-shaped uncovered area. The scene is capped at 400 elements (Stage 4 uses 307).
- Room solver is guillotine-only (no pinwheel plans) and beam-searched, so "no layout" can miss a feasible one; very dense blocks hit a search budget. Areas are guidance: software scales rooms to fill each block, which caused undersized rooms.
- Eave clamping only checks site edge and neighbouring blocks, not roof-to-roof collisions in every case; hip-to-gable junctions are valid but plain.
- Stage 4 never tested against other Terra answers; a different answer could trigger findings (they are reported, not repaired). Only one real Terra Stage 4 exists.
- The cost figures exclude the unrecorded failed Stage 3 call.
- Possible naming confusion between the old mock stage 4/5 files and the real Stage 4 (section 4).
- The old canonical generation code is still in the repo and modified in the working tree (see below); I do not know how much of it is intentionally part of the next release.

## 11. Commands

```
npx vitest run src/lib/villa/staged                 # staged tests (59)
npx vitest run src/lib/villa src/components/scene   # wider suites (1,052 tests)
npx tsc --noEmit -p .
npx eslint src/lib/villa/staged
npx vite-node --config vitest.config.mts scripts/staged-villa-live-exterior.ts          # Stage 4 dry run, spends nothing
npx vite-node --config vitest.config.mts scripts/staged-villa-live-exterior.ts --live   # PAID; refuses if live/result.json exists
npx vite-node --config vitest.config.mts scripts/staged-villa-programme-offline.ts      # Stage 3 offline
npx vite-node --config vitest.config.mts scripts/stage4-identity-check.ts               # identity check on the real Stage 4
npm run dev -- -p 3015                                                                  # then:
node scripts/staged-villa-stage4-capture.mjs terra-stage4                               # screenshots (local only; blocks non-local and /api requests)
```
The capture script loads Playwright from `/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core` (override with `PLAYWRIGHT_CORE_PATH`) and Google Chrome at its standard macOS path. Viewer URL: `/dev/staged-villa?file=stage4-exterior_terra-stage4.scene.json`.

## 12. Working tree (exact, at handoff; branch `main`, nothing committed)

**Modified tracked files (29).** All were already modified before this session's Stage 4 work; I did not edit them:
`src/app/api/ai/scene/route.providerSchema.test.ts`, `src/components/admin/AdminGate.tsx`, `src/components/scene/OperationStudio.tsx`, `src/components/scene/RejectedPlanPanel.tsx`, `src/lib/house/architecture/profiles.ts`, `src/lib/house/roof/gableRoof.ts`, `src/lib/house/roof/hipRoof.ts`, `src/lib/villa/canonical/{composition.test,composition,compositions.test,consolidated.test,coordination.test,coordination,diagnose,plan,rejection,roofAbutment.test}.ts`, `src/lib/villa/canonical/revision/{revise,revision.test}.ts`, `src/lib/villa/scene/{codeArchitecture.test,evidenceRevision,generationQuality,model,programme,relationships,roofs,spatial}.ts`, `src/proxy.test.ts`, `src/proxy.ts`.

**Untracked (33 entries):**
- Docs: `docs/architecture/production-rejected-2026-11-03/`, `docs/architecture/roof-facade-exposure-2026-11-03/`, `docs/architecture/staged-villa/` (includes this file and `stage4-exterior/`).
- Scripts: `production-rejected-analysis.ts`, `roof-facade-exposure-{capture.mjs,offline.ts}`, `stage4-identity-check.ts`, `stage4-offline.ts`, `stage4-verify-s3.ts`, `staged-villa-{capture.mjs,checkpoints,edits,live-assess,live-exterior,live-massing,live-programme,live-save-stage2,live-stage3,probe,programme-offline,run,save,stage4-capture.mjs}`. `staged-villa-live-stage3.ts` is **superseded** (the recursive-plan approach that failed). `stage4-offline.ts` and `stage4-verify-s3.ts` are scratch scripts (the first writes into `stage4-exterior/` and a scratchpad path).
- App/lib: `src/app/api/ai/scene/revise/`, `src/app/dev/roof-exposure/`, `src/app/dev/staged-villa/`, `src/components/scene/RejectedPlanPanel.test.ts`, `src/lib/villa/canonical/{productionRejected.test,roofExposure.fixture,roofExposure.test,roofOwnership.test,rootCauses}.ts`, `src/lib/villa/staged/` (whole folder, all Stage 1-4 code above).
- Stage 4 work this session lives only in untracked files: `src/lib/villa/staged/` (incl. `exterior*.ts`, `stage3Checkpoint.ts`, `compile.ts`/`spec.ts` edits) and `src/app/dev/staged-villa/page.tsx`.

The Next dev server started for screenshots was stopped. The 5f3e39d commit's deployment status was never checked.
