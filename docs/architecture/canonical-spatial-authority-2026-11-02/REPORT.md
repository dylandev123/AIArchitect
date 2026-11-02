# Canonical consolidation, part 2: trustworthy tests and spatial authority (2026-11-02)

Offline only. No paid AI calls, database changes, commits or deployments. Historical requests, responses and projects were not modified. **No claim is made about architectural quality: only a later model-generated house can show that.**

## 1. Regression suite

Before: 3,141 pass / **274 fail** (the earlier 276, less two tests that now pass). After, whole suite: **3,441 pass, 0 fail, 3 skipped** (the skips are pre-existing database/live-asset tests that need external services).

Every failure was classified before anything changed:

| Class | Count | Resolution |
|---|---:|---|
| Retired new-house authors (V2, V3, villa, 2D plan, concept, direct-scene operations *Generate*) asserting that they still succeed | ~250 | Kept as regression evidence for the retained author code in a separately named vitest project, `retired-authors` (`npm run test:retired`, 376 tests). A test-only module replacement (`src/test/retiredAuthorsSetup.ts`) opens the retirement gate **inside that project only**. Production gates are unchanged and still hard-coded closed. |
| "Should now be 409 with zero provider calls" | – | Already asserted by the **active** project: `authority.test.ts`, `route.canonicalWorkflow.test.ts` (house, villa, plan design, concept, replay, scene edit of a canonical house). |
| Genuine failures of the canonical workflow | 0 | None found. |
| Stale expectation in an offline kernel test | 1 | `proposalRevision.test.ts` expected a sampled *physical* finding for a stair-crossing threshold; the compiler's own threshold guard now rejects that layout earlier and more strictly. The test now asserts the stronger rejection (message and `construction` finding). |
| Timeouts under full-suite parallel load (pass alone) | 2 | `testTimeout` raised to 30 s in both projects. |
| Retired suites using one-stage retained responses against a two-stage author | 4 | Same planning-stage isolation already used by `route.test.ts`. |

Notes: three directories that the retired project first appeared to cover (`concept/compact`, `villa/create-component`, `villa/visual-review`, `house additiveProxy`) pass without the gate and stay in the **active** project. Mixed files such as `scene/route.test.ts` run in the retired project; the gate only governs `mode:'generate'`, so their Edit assertions are unaffected. `route.knowledge.test.ts` used to overwrite `docs/architecture/code-driven/homepage-requests.json` on every pass; it now writes only if the file is absent. `vitest.config.mts` keeps a root `resolve.alias`, which the `vite-node --config vitest.config.mts` evidence scripts need.

`npm test` runs both projects and labels failures `|active|` or `|retired-authors|`. A failure in `|active|` is a new regression.

## 2. Is canonical generation still the sole authority?

Yes. New-house `generate` goes to `generateCanonical` (one provider call, zero retries, no fallback); V2/V3/villa/plan-design/concept/replay answer 409 with `providerCalls:0`; the gate is now one function (`canonicalGenerationRequired`) instead of per-route conditions. A canonical house refuses scene-operation editing (409, 0 calls). New projects store `architecturalPlan.version === 'architectural-plan-1'`. Old direct-scene, V2 and V3 projects still open, persist and Undo/Redo (store suites pass, unchanged). Nothing was renamed.

## 3. Why the spatial relationships were duplicated

Three independent declarations expressed one vertical fact:

1. `levels[].rise`: the floor-to-floor distance.
2. `spaces[].height`: every room's envelope height, usually just that same distance restated.
3. The `roofs` list plus (separately) "what is stacked above".

The compiler then required (1) = (2) for any covered room and required roof XOR cover, but the instructions only said "must not exceed". Terra restated 3.6 m as 4.2/3.9 m (a style choice that looks like a double-height room) while stacking rooms above, and gave roofs to rooms that were partly or wholly under upper floors. Two further defects were in the compiler's own interpretation:

* **Single-polygon cover (defect, fixed).** "Incomplete overhead enclosure" was satisfied only when one upper room contained the whole room. A ground room covered by *two* upper rooms was reported as open to the sky.
* **Fail-fast reporting (fixed in part 1).** One clash hid the rest.

## 4. What the compiler now derives

Provider-schema evolution (details in §8): space `height` is now optional (`null` on the wire). When omitted:

* If any space is stacked above, height = **floor datum of the lowest higher level overlapping it, minus its own floor datum**.
* Otherwise, if exactly one level sits directly above its level, height = **that level's rise** (ordinary storey height).
* Otherwise it is **refused** ("height is required"): single-storey and top-storey rooms are the planner's choice. Nothing is guessed.

Coverage is computed exactly (clipped area, union of all spaces at the lowest higher datum): `none | partial | full`, with the covering spaces. It feeds one rule set: roofless interiors must be fully covered at their envelope top; a roof on a fully covered space is contradictory; a partly covered space is reported as an unsupported capability with the exact percentages. All violations are returned in one rejection. Evidence (`result.vertical`, per space: height, `authored | derived:upper-datum | derived:storey-rise`, cover) is returned with the compile; the scene stores the plan as authored, so heights stay derived on reload and in future plan-level revisions. Compiler stamp `architectural-plan-1.2`.

An explicit height is still honoured and still checked, so every historical plan compiles exactly as before.

## 5. What remains the model's responsibility

Level count and rises; plan placement and stacking; whether a room is deliberately taller (an explicit height with nothing above it); the height of single-storey and top-storey rooms; which exposed tops are roofed, with form, rise and overhang; splitting a room so that each part is wholly covered or wholly exposed; circulation; unsupported-feature disclosure. No room is shortened, no roof removed, no suite moved, no void invented.

## 6. Retained mansion replay (unchanged Terra response)

`npx vite-node --config vitest.config.mts scripts/canonical-spatial-replay.ts` → `mansion-replay.json`.

It still does **not** compile, and it is not expected to: it states every height explicitly. The 16 findings collapse into 12 classified ones (the old report listed a roof conflict once per *pair*):

| Finding | Count | Class |
|---|---:|---|
| foyer 4.2 m, gallery 3.9 m, living 4.2 m under 3.6 m upper floor (6 pairs) | 6 | **Model-authored contradiction**, enabled by the redundant `height`. Derivation resolves it (see below). |
| Roof on `gallery`, `guest-suite-1`, wholly covered by upper rooms | 2 | **Model-authored contradiction**: the floor above is the cover. |
| Roof on `foyer` (75% covered), `arrival-court` (38%), `living` (63%), `waterfront-veranda` (13%) | 4 | **Representation gap** (case 4): a roof is one slab over a whole space, so a partly covered room cannot be roofed. Plan decision: split the room at the upper edge. |

An **altered copy** (heights omitted for foyer, gallery, living only; clearly labelled, not a Terra output) shows the six overlaps disappear, leaving exactly the 6 roof findings. No case-2 interpretation defect remained beyond the single-polygon cover rule fixed above.

## 7. Expressiveness

Nothing was lost: omitting `height` is optional and every explicit value still works. Verified offline on a compact residence, a multilevel stacked residence, and a multi-volume courtyard estate (derived scenes are element-for-element identical to the explicitly authored ones where the values agree). Double-height rooms compile when nothing stacks above them; a double-height wall that meets the line of a stacked upper wall is reported (`staggered levels … overlapping wall sections`), a pre-existing capability limit, not hidden. **Not representable and reported, not simplified:** open-to-above voids beneath a stacked plan, partly covered rooms, roof valleys/junctions, curved or polygonal outlines, grading, planting.

Candidate future capability (not done; each needs its own derivation rules and negative tests): a **flat roof over the exposed remainder** of a partly covered room. It would convert the four representation-gap findings above into buildable terraces, which is how many real mansions step their massing.

## 8. Provider schema and API compatibility

`providerCompatibility.test.ts` (5 tests) uses the real SDK serializer and an in-memory transport:

* The historical prepared request is preserved byte for byte and still strict-valid.
* The current schema equals the historical one **except** `height` becomes `anyOf[number, null]`; reverting only that node reproduces the historical schema exactly. Model, messages, token ceiling and format flags are identical.
* All historical plans (including the retained mansion) parse under the new schema.
* The exact next request (frozen brief and retrieved knowledge, current instructions and precedence clause, current schema) is frozen in `provider-request.prepared.NOT-SUBMITTED.json` and re-verified. It has not been submitted.

`spatialWorkflow.test.ts` pushes derived-height plans through the strict wire (omitted values arrive as `null`), the SDK parser, the real handler, persistence, an individual edit and project Undo/Redo, and checks that an un-derivable height is refused with 422 and one provider call.

## 9. Prompt text

Part 1's two interim sentences were replaced, not stacked: the heights sentence now says what the compiler derives and when the planner must state a height; roof/cover rules are explicit; the precedence clause is unchanged. This does change future request text (see the frozen preparation). Legacy phrases in retrieved *data* ("translate ideas into scene operations") still reach the model; the precedence clause is still the only mitigation. Filtering the retrieved library for canonical requests is the durable fix and is not done.

## 10. Canonical plan-level revision (documented only)

See [CANONICAL-REVISION-CONTRACT.md](CANONICAL-REVISION-CONTRACT.md).

## 11. Verification

| Check | Result |
|---|---|
| Whole suite | 3,441 pass, 0 fail, 3 skipped (external services). Active ≈ 3,065, retired-authors 376 |
| `tsc --noEmit` | 0 errors under `src/` |
| ESLint on changed source | clean |
| Derived/explicit equivalence, determinism, save/reload | pass |
| Cover by union of upper rooms; partial/full classification; refusal when nothing can be derived | pass |
| Mansion replay classification | pass (`mansion-replay.json`) |

## 12. Answers

1. **Obsolete failures:** resolved and transparently isolated (§1). Zero failures remain; no test deleted, skipped or weakened.
2. **Single authority:** yes (§2).
3. **Cause:** redundant `height`/`rise`/roof declarations, plus a single-polygon cover rule in the compiler (§3).
4. **Derived:** ordinary room height, coverage, and enclosure (§4).
5. **Model's:** §5.
6. **Replay progresses further?** It still stops at the first compile, with fewer, classified findings (12, down from 16). Derivation alone resolves 6 of them in an altered copy; the other 6 are the model's design or a representation gap.
7. **Remaining contradictions:** 2 wholly-covered roofs (model), 4 partly-covered roofs (gap), 6 explicit heights (model, derivable if omitted).
8. **Expressiveness lost:** none.
9. **Schema compatible:** yes, one optional field; proven by exact serialization (§8).
10. **Ready for another controlled live mansion?** Technically yes, once you accept the changed prompt/schema (§8, §9). Expect the request to be much easier to satisfy on heights; partly covered rooms and roofs on covered rooms can still recur and will be reported in a single rejection. No live call has been made.
