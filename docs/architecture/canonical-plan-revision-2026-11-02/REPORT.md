# Bounded canonical plan revision: built and verified offline, live experiment prepared (not run)

No paid request, commit, deployment or database access. The saved mansion proposal is byte-identical (SHA-256 `792ebf0c…1689`, asserted by a test against the earlier diagnosis). **No model has revised anything yet.** Every "revision" below is a labelled developer mock that exercises the machinery; none is evidence that the model can improve its own design.

## 1. What the failure was, grouped by cause

The 57 findings are 8 cause groups ([analysis](analysis.saved-mansion.json)); five need an independent design decision (the table merges opening and screen placement).

| Group | Findings | Cause | Decision it needs |
|---|---:|---|---|
| Chain collision `living-salon × west-private-hall` (diverge at `central-gallery`) | 3 | Two relative-placement chains were authored without seeing where each ended. Kitchen/pantry occupy the same volume as west suites 1–2. | Which chain yields, or whether they should meet at all |
| Roof eaves | 44 | Overhangs (0.3–0.8 m) applied to rooms regardless of exposure, against an explicit "separated sections" rule | Where shade projection is wanted; separated or overhang-free sections elsewhere |
| Site containment | 1 | Site is centred on the room cells, so lawn/pool beyond them fall off it | Site size against the whole composition |
| Opening geometry / screens | 4 | Portal edges run counter-clockwise, so alignment on north/west walls is reversed against room placement | Openings on walls actually shared |
| Consequences (openings and screens in the colliding rooms) | 5 | Depend on the chain collision | None independent |

Beyond errors, five measured **architectural** signals fire: 6 identical 7×7 cells, 21 roofs with identical form and rise, envelope tops spanning only 1.2 m on one level, 44% of interior area without a window, uniform eaves. The software reads this as **redesign**, not repair, from measurement and without naming a style, a floor count or an area.

Two things found offline that the earlier diagnosis could not see:
- `diagnosePlan` does not flag a portal between two outdoor spaces (`terrace-terrace-opening`); only the compiler does.
- **The saved plan would fail even with every overlap fixed**: ground-level rise of 0.45 m is rejected by a later scene-support stage (probed: 0.36 m accepted, 0.40 m rejected). This is now reported to the model as a measured limit when, and only when, a plan's values reach it.

## 2. What was built (all in `src/lib/villa/canonical/revision/`, no new engine)

- **`analysis.ts`** `analysePlan`: absolute extents per room, level datums, placement chains, adjacency/door/stair dependencies, reachability and depth, findings grouped by cause (consequences kept apart), weakness signals, repair-or-redesign disposition. Read-only; proposes no layout.
- **`planView.ts`** `renderPlanSvg` / `renderPlanPng`: one panel per level at 14 px/m from the same measured rectangles (shape model and SVG are tested against the analysis): rooms with dimensions and heights, mass colours, site boundary, roof extents with eaves, measured overlaps in red, eave overlaps hatched, openings on the wall edge they were authored on (misfits circled), stairs, door/passage circulation from the arrival, unreachable rooms, ghosts of other levels, north and scale. [Saved mansion](plan-view.saved-mansion.png).
- **`revise.ts`**: `revisionResponseSchema` (complete `architectural-plan-1` plus declared kind, concept, per-group responses, changes, retained, limitations; never a patch or operations), `buildRevisionRequest`, `assessRevision` (pure, deterministic), `reviseCanonicalPlan`, `sceneFromAcceptedRevision`, `aiSdkRevisionSubmit` (live transport, zero retries, strict schema).
- **`evaluate.ts`**: entity diff, measured room moves relative to the shared root, programme preservation, and **composition / spatial coherence / ambition** reported separately as indicators. Level count, stair count and floor area are reported but never scored.
- The revised plan goes through the unchanged `compileArchitecturalPlan`; the scene keeps `architecturalPlan`, so editing, saving, history and Undo/Redo are the existing ones.

**Repair vs redesign.** The disposition is measurement the model sees, not an instruction. The model declares its own `revisionKind`, which is checked against what it changed. A coordinate-only repair of the mansion (mock A) is physically valid yet **stopped** with `no-demonstrated-improvement`: for a redesign-worthy original, at least half of the *concept* signals (repeated cells, uniform roofs, flat section, windowless interiors, unarticulated footprint) must clear without spatial coherence regressing. Eave removal, moving a kitchen or re-keying a door cannot satisfy that by themselves.

**One revision.** `authorizeRevisionExperiment` names the experiment, the authorizer and a scope (`repair-only` refuses concept-level change; `redesign-permitted`). The grant is spent *before* the call, so a failed or malformed call still consumes it and a second call throws without reaching the provider. The live runner adds an exclusive `call-started.json` marker and requires the approved request hash on its command line. Stops: physically invalid, programme not preserved, outside authorized scope, unrepresentable (`decision-required` preserved verbatim), schema-invalid, provider failure, or no demonstrated improvement. All independent failures are reported together. Only an accepted record compiles, and acceptance means *compile and render for review*, never "architecturally successful".

## 3. Offline results ([runs](offline-mock-runs.json))

| Mock (developer-authored) | Original | Result |
|---|---|---|
| Mansion, coordinate-only repair (kitchen moved, doors re-keyed, eaves removed) | 57 errors, redesign | 0 errors, compiles; **stopped: no-demonstrated-improvement** (composition unchanged, ambition not improved) |
| Mansion, still-colliding "repair" | 57 errors | **stopped: physically-invalid**, chain collision remains |
| Row house (6 identical cells, flat identical roofs; valid, 0 errors) → different-concept redesign, same programme | redesign | **accepted for construction**; composition, coherence and ambition all indicated improved; compiles into an editable scene |
| Same redesign under `repair-only` | | **stopped: concept-exceeds-bounds** |
| Compact two-level house with a stair, faulty → repaired | repair | **accepted**; stair and both levels intact |

Also tested: malformed output, `decision-required`, unchanged plan, lost bedroom (valid but **programme-not-preserved**), single-use budget, failed provider call consumes the grant, contract-invalid original costs nothing, the original preserved byte for byte in the record, the strict-schema wire (null-encoded optionals, one call, `maxRetries:0`, text + image parts), and an accepted revision saved, edited, reloaded, undone and redone. **125 canonical tests; 758 tests in 102 files across scene/storage/villa pass; typecheck and ESLint clean for the new files.** The replay script was exercised on a synthetic response in the scratchpad (real parser path); no file in this directory is synthetic output.

## 4. Prepared live experiment: awaiting separate approval

| Item | Value |
|---|---|
| Model | `gpt-5.6-terra`, provider-default reasoning, strict JSON schema |
| Calls | **1**, `maxRetries` 0, no fallback, no repeat |
| Request | [request.prepared.NOT-SUBMITTED.json](request.prepared.NOT-SUBMITTED.json), 373,292 bytes, SHA-256 `d830dac29bb576636bd2f3bd20ae9ed9e91ad50128d77e15f9505472f7304e8a` |
| Input | current contract + the retained architectural knowledge text from the original call (no new retrieval) + revision addendum (17.5k chars); the original brief, complete plan, measured table, dependencies, all 57 findings by cause, weakness signals and disposition, the latent-limit note (48.8k chars); output schema (9.5k chars); the [plan drawing](request.plan-image.png) (1384×1484 PNG) |
| Image support | The repository already sends images to this model in visual review and reference-image paths, but **acceptance of this image by `gpt-5.6-terra` has not been verified by a live call**. If the provider rejects images the call fails and consumes the one revision. |
| Estimated input | about 22,700 tokens (characters/3.6; image tiles 512 px × 170 + 85) |
| Output | 10,000–16,000 tokens expected (prior same-brief calls: 9.5k–9.9k); ceiling 30,000 |
| Estimated cost | **about US$0.20** (US$0.16–0.40 worst case at the output ceiling); repository default rates, not an invoice |
| Scope | `redesign-permitted` |
| Runner | `node scripts/canonical-revision-once.mjs --approve-sha d830dac2…4e8a`, then `npx vite-node --config vitest.config.mts scripts/canonical-revision-review.ts` |

The runner refuses without the exact hash, writes its evidence files with mode 0600, and never prints the credential. Nothing has been executed.

## 5. Limits you should know

- **Not wired into the route or UI.** Revision is a library plus scripts under the existing canonical schema and compiler; `/api/ai/scene` still returns 409 for canonical edits. This was deliberate so no paid path exists before approval.
- The disposition thresholds, repeated-cell test and programme categories (matched by use/id text) are **heuristics**; the brief's own requirements are not parsed, only carried to the model. Indicators are measurements, not aesthetic scores, and passing them proves nothing about beauty.
- The compiler remains fail-fast. A revision that clears all diagnosed errors can still be rejected by a later stage; that is reported, not repaired.
- The drawing is plan-only: roof forms are not shown beyond extents, and sections/elevations are absent.
- Whether the model uses the drawing, and whether a redesign is better, is unknown until the live call and a render. If the revision is accepted it still needs the existing rendered review.

Reproduce: `npx vitest run src/lib/villa/canonical/revision`; `npx vite-node --config vitest.config.mts scripts/canonical-revision-offline.ts` (refuses to overwrite this directory).
