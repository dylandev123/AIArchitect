# Second Terra revision, re-frozen: brief-derived programme and authorized redesign (NOT submitted)

No paid call, commit, deployment or database access. Terra's retained rejected revision is the starting point, read only (record SHA-256 prefix `5d0f0491…` unchanged; the request's `currentPlan` is byte-equal to its `revised.plan`).

- **Frozen request:** `request.prepared.NOT-SUBMITTED.json`, 508,633 bytes, SHA-256 `123e60b9f100e672facc2dece7d3d8962b3869a57e5bfd6c51a719df92f04a14`
- Supersedes `94b18aff…` (also never submitted, in `../canonical-second-revision-2026-11-02`). Its runner is repointed here, so it cannot be run.
- **Estimate** (repository default rates, not an invoice): ~33,850 input tokens; **about US$0.22 expected** (US$0.209 at the previous call's output of 11,774; US$0.43 worst case at the 30,000 ceiling). Previous call US$0.184.

## 1. The brief governs the programme
`briefProgramme.ts` reads requirements from the brief's own words; each carries the verbatim phrase (a test asserts it occurs in the brief). Nothing else is required.

| Requirement | Brief phrase | Gate |
|---|---|---|
| bedrooms | "approximately six generous bedroom suites" | at least 5 bedroom spaces; approximate, no upper limit enforced (a count above ~8 is only noted) |
| living-entertainment | "expansive living and entertainment spaces" | plural: at least 2 living or entertainment spaces |
| entrance | "memorable entrance" | at least 1 |
| service | "service accommodation" | at least 1 |
| terraces | "substantial shaded terraces" | plural: at least 2 |
| pool | "rectangular swimming pool" | at least 1 |

Interpretation calls that are mine, not the brief's: "approximately six" allows one fewer (80% rounded up); a plural noun with no number means at least two. Bathrooms, kitchen and dining are **not** required, because the brief does not name them. "Exceptional indoor-outdoor connections" and circulation are quality judgements, not counts.

- The old "retain every use" instruction and floor are gone from the request and the gate. The plan's counts are shown as information only (9 real suites, 16 baths). The earlier "12 bedrooms" came from a crude text match that also counted two suite-wing halls and the gallery, so the brief gate counts sleeping rooms only.
- Gate verified: a revision with 6 suites and no separate baths (far below the failed plan) passes while the old floor would have stopped it; missing pool, terrace, bedrooms below 5, service, entrance or living each fail naming the brief phrase. A brief that states nothing countable falls back to the old preservation check rather than requiring nothing.

## 2. Authorized redesign
- Disposition in the request now reads `redesign`, source "explicit user authorization"; the measured disposition (`repair`, one signal) and all signals remain as evidence.
- New appended system block (`REDESIGN_AUTHORIZATION`): Terra may reconsider wing arrangement, massing, floors, circulation, suite relationships, roofs and identity; may keep what succeeds; is not asked to preserve repeated suites/baths; the goal is a distinctive luxury residence that the compiler accepts, "not merely fewer validation findings". Every diagnostic, the exposure table, relationship decisions and the drawing are unchanged.
- The assessment uses the concept-signal improvement test under this authorization: repeated cells must clear without spatial coherence regressing, so a valid but still-repetitive plan is stopped (`no-demonstrated-improvement`), and an unchanged plan always is.
- One residual sentence is unchanged: "Do not enlarge the house, add storeys, add symmetry or copy any template for their own sake: change only what serves the brief." It is compatible with the authorization, but Terra may read it as caution about floors.

## 3. Differences (comparison.json)
Against the superseded `94b18aff…`: contract text, output schema, image, `currentPlan`, measured data, dependencies, findings, model and settings are **identical**. Changed: `requirements` (above), `architecturalWeaknesses.disposition`, one addendum sentence ("the planned programme" replaced by the brief-derived wording), and the appended redesign block.
Against the approved `d830dac2…`: additionally the coordination contract, the one schema enum widening (`shared`, `exposed`), the exposure table and relationship decisions, and the plan being Terra's revision.
Unchanged: model `gpt-5.6-terra`, 30,000 output ceiling, provider-default reasoning, strict schema, original brief, one call, zero retries, no fallback.

## Execution (only after you approve this hash)
```
node scripts/canonical-second-revision-once.mjs --approve-sha 123e60b9f100e672facc2dece7d3d8962b3869a57e5bfd6c51a719df92f04a14
npx vite-node --config vitest.config.mts scripts/canonical-second-revision-review.ts
node scripts/canonical-second-revision-capture.mjs   # only if scene.accepted-for-review.json exists; dev server on :3015
```
Reporting stays split: compilation and gate results first; architectural quality only from the browser renders (Arrival, Aerial, Garden, Poolside).

## Verification
New `revision/programmeRedesign.test.ts` (11 tests); canonical suite 229 pass; typecheck and ESLint clean for the changed files.
