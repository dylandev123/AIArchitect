# Unified automatic generation — offline integration (2026-11-06)

Offline engineering only. No paid calls, approvals, commits, pushes, deployments or production database changes. Existing live runs, approvals and spending records in `.data/private-studio/state.json` were not modified (read-only summary only). All house answers below are **developer-authored provider doubles** run through the real pipeline; they are not Terra output.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Stage 4 contract | Terra authored roof records, raw door/veranda spans and facade keys; no trim; one strict-incompatible schema | Terra returns design intent only (`exteriorDesignV2Schema`, strict): finishes, roof forms/pitch/eaves, facade styles, entrance room/side, garden/terrace doors, any number of verandas, window trim, plinth/cornice/portal. `deriveStage4` (Breezeway's measured derivation) builds the exact geometry; `visualRevision: 'stage4-v2'` turns on Breezeway's glazed doors, clay/standing-seam roofs, cut limestone and window rhythm. |
| Stage 5 contract | Terra typed coordinates for pool, lawns, beds, trees, paths | Terra returns landscape intent only (`siteDesignV2Schema`, strict). New `siteGeneral.ts` derives everything for **any orientation**: garden side from the pool intention, main veranda or living room; quarter-turn frame; measured pool envelope; sun-deck terrace; straight arrival drive; grid-routed dry garden walk; boundary beds, frontage hedge, foundation planting; farthest-point tree placement keeping the pool view axis open; lawn masks; furniture fitted between real door routes. Breezeway's south-only `site.ts` is untouched for replay. |
| Pool (C) | Stage 2 pads smaller than any buildable pool; Stage 5 had to move them with hand-written coordinates | Stage 2 is told the minimum assembly envelope (9.2 × 7.4 m) and that Stage 5 places the actual pool. Stage 5 centres the one assembly on the reservation, binds `sourceIntent`, writes a measured `intentResolution`, never renders the old pad. Dropping a retained pool intention, a pool the brief excludes, or a missing pool the brief requires all fail. |
| Corrections (D) | None possible | Pipeline allows one targeted correction per stage only after a completed, billed answer with specific findings (schema, room solver, derivation, validation). Never after provider errors, timeouts, missing usage, refused dispatch or software construction faults. The request contains the original answer verbatim and the findings; the result re-runs the full stage contract. **Active policy still allows zero corrections.** `PROPOSED_CORRECTION_POLICY` (5 + 5 calls, same US$1.40) is prepared, not active. |
| Spending (E) | Fixed US$0.275 per call (65,536 input tokens assumed); one reservation per stage | Every call (design or correction) is admitted and reserved individually at `(measured request bytes + 1,024) × input price + 12,000 × output price`. A token always covers at least one byte, so this is a defensible upper bound; the transport refuses any request larger than the reserved bytes. Unknown outcomes keep their reservation and block all further spending for the owner. Measured bounds: US$0.162–0.180 per call. |
| Prompt handling (F) | "no pool" refused; "3-bed", "bedrooms: 4", "two floors", "master suite and two guest bedrooms", "2.5 baths" misread or rejected | All read correctly; conflicting counts or "with a pool … no pool" are refused as conflicts; pool is `required`/`excluded`/`optional`. Shape, storey and terrain limits unchanged. |
| Production risk (A) | Uncommitted `model.ts` guard + proxy silently disable every public AI route | One explicit switch `LEGACY_AI_ROUTES=enabled` restores the old public routes in both proxy and transport; Private Studio calls always require a reservation regardless. Default remains locked. |

## Integration defects found and fixed by running whole houses

1. **Room solver false conflicts.** A feasible six-bedroom programme was rejected (`cross-block-connections`) because the bounded search kept too few per-block layouts. `solveProgramme` now widens the beam only when the first search fails for search-limited reasons. Accepted layouts are unchanged.
2. **Exterior wall measurement.** `validateExterior` subtracted perpendicular walls that happened to share a coordinate, reporting −5.5 m free on a wall Terra was told was free. Now axis-filtered, matching `exteriorWalls`.
3. **Rotated pool envelope.** Side decks are 1.6 m, end decks 2.2 m; rotating the pool for east/west gardens must swap them. The terrace previously overlapped the real deck.
4. **Contradictory instructions.** The Stage 4 prompt allowed covering terraces while the feature audit treated a covered terrace as lost. Only veranda-kind spaces are now coverable, in prompt and validation.
5. **Dry routes.** Open terraces were not walkable surfaces, so the real Terra massing (veranda → terrace → pool) appeared disconnected; a ring walk failed for U-shaped forecourts. Both fixed (grid route search).
6. **Watchdog.** A running stage with no start timestamp was never treated as stale.

## Offline houses (unified-offline-2)

| House | Orientation | Result |
| --- | --- | --- |
| A compact Caribbean, 1 storey, 3 bed / 2 bath | entrance N, garden S, pool reservation from massing | 210 elements; plunge pool bound to `pool-reservation`; veranda, palms, 7 beds |
| B Mediterranean courtyard, 2 storeys, 4 bed / 3 bath | entrance S, courtyard garden N | 322 elements; stair, upper bar, loggia, courtyard pool, canopy trees |
| C contemporary estate, 6 bed / 5 bath | entrance W (U forecourt), garden E | 175 elements; flat roofs, glass pavilion, loggia, open sun terrace, lap pool parallel to facade |

All three: zero findings, authoritative save → reload reproduces the scene, every tree/fixture/bed is an editable landscape component. Screenshots: `capture-1-*-{arrival,aerial,garden,poolside}.png`.

**Visual assessment.** B and C read as composed houses (roof hierarchy, loggia/colonnade, stone bases, pool framed by terrace and trees). Weaknesses that remain: large plain paved terraces (A), wide empty lawns on a 60 × 48 m site, repetitive boundary shrubs, flat roofs that read as plain white planes (C), simplified water and furniture. Separate causes: composition (terrace extent, lawn emptiness) is derivation/design; material flatness, water and foliage stylisation are renderer/asset limits.

## Verification actually run

- Full repository suite: **4,156 passed, 3 skipped, 389 files** (both vitest projects). The retired-authors project now models the explicit `LEGACY_AI_ROUTES` decision; those 24 legacy route tests were already failing under the uncommitted lockdown and pass with the switch (69/69).
- New: `corrections.test.ts` (8), `siteGeneral.test.ts` (6), parser cases; automatic workflow suite migrated (27) including real Terra Stage 1–2 replay through the new Stage 3–5 contracts.
- `npm run typecheck`, ESLint on `src` and new scripts, `npm run build`: pass.
- Browser (`unified-offline-browser-2/`): one click, visible correction, refresh mid-run, completion, editable import into project history, reload; second run stops at Stage 5 after a failed correction with Stages 1–4 preserved. Zero page errors, zero paid calls. The first attempt (`-browser-1`) timed out during dev-server page compilation and is not counted.

## Not proven

Real Terra Stages 3–5 have never run. Terra's fidelity to the new design-intent vocabularies, its correction behaviour, latency and real billed cost are unknown. Live usage may be higher than the offline doubles; under the worst case (every call using all 12,000 output tokens) a 5 + 5 run would be stopped by the US$1.40 ceiling before completion — safely, but incomplete. Lowering `maxOutputTokens` to 8,000 would make all ten worst-case calls fit; observed Terra outputs so far are 537–1,819 tokens. Provider prices are the project-configured US$2 / US$12 per million tokens and are not invoice-verified.

## Before any live experiment

1. Cold-restart the `localhost:3015` dev server: the running worker loaded the old contracts at startup.
2. Approve explicitly: the brief, the policy (active v2 hash `2e851d77…c13a`, or the prepared correction policy `07624a75…5137`), and the output-token ceiling.
3. See `next-live-requirements.json`.
