# Roof and façade exposure at construction level (offline, no model calls)

Continues `../production-rejected-2026-11-03/REPORT.md`. The production export is untouched (sha256 `468a0e5b…395a`, asserted by `productionRejected.test.ts`).
Reproduce: `npx vite-node --config vitest.config.mts scripts/roof-facade-exposure-offline.ts` (writes `measurements.json` and the three `*.scene.json`),
then `node scripts/roof-facade-exposure-capture.mjs` against `npm run dev -- -p 3015` (writes the PNGs and `browser-result.json`).

## Result on the retained production plan

| | before | now |
|---|---:|---:|
| Total errors | 69 | **43** |
| Roof-overhang findings | 40 | **25** (all partial-edge, see below) |
| Façade-rhythm findings | 17 | **7** (6 rhythms + 1 clash with an authored opening) |
| "Volume claims one roof over rooms with their own" | 1 | 0 (contract change, below) |
| Edges built flush and stated in the review | 0 | 29 |
| Compiler | stops in derive | still stops in derive (8 decisions: 2 roof-span, 6 façade) |

**The plan still does not compile and nothing here makes it a house.** Its remaining 43 errors are Terra's decisions. They split as: 25 partial-edge roof overhangs,
7 façade, 11 others this task did not touch (veranda owned by two different roofs, rooms of that span not tiling a rectangle, its mixed envelope heights, 2 site, 4 authored
openings between rooms that share no wall, 2 screens).
The 10 façade findings that disappeared are **not** made valid: 12 per-bay findings and 5 pier findings (17) collapse into one finding per rhythm, because the
bays can no longer be placed anywhere. No rhythm on this plan could be derived.

## What changed

**Roof exposure.** The pitched-roof builders took one overhang for every edge. They now take an optional overhang per edge (`eaves`, builder compass, on the scene roof element, each ≤ `overhang`);
omitted, the output is byte-for-byte the old roof (tested). Flat roofs need no builder change: the slab is sized and centred on its eave rectangle.
`resolveEaves` (coordination.ts) is the one rule used by the compiler and the diagnosis. Every side keeps the authored overhang, except a side that would reach a wall or roof
and **lies wholly against it**: that side is built flush (eave 0), the other sides keep their overhang, and the review and the element provenance state it.
Both parties of a roof/roof clash give way on the side where they meet, so the result does not depend on order. Nothing is clipped; the surfaces are built to the resolved eaves.
The physical checks are unchanged and now run on the resolved eaves: roof/roof, roof/volume, site, the scene relationship tests. A plan that compiled before compiles to identical geometry
(`savedProjects.test.ts`, every retained saved scene).

Still rejected, each with its reason in the finding:
- a neighbour that stands against **only part** of an edge (one eave line cannot be flush along part of an edge and project along the rest);
- a corner two sides could yield; a neighbour that does not touch the wall (a smaller eave there would be a design value); two eaves overlapping in open air;
- rooms that overlap (never repaired by an eave rule).

**Façade exposure.** A rhythm's bays are still evenly spaced over the whole wall when that already puts every bay on the exposed wall (windows) or on the wall the named outdoor space
borders (doors): historical positions are kept. Otherwise they are spread over the one such run that can hold them. No run, or several, rejects naming the runs and how many bays each holds.
Authored openings are never moved or removed, and a bay that lands on one is still a pier conflict.

**Ownership.** `volumes[].roof` now names the volume's principal **building-scale** roof (a roofSpan, which may be a single room's). Its other rooms may keep **room-owned** `roofs` entries and a
volume may have further spans. Unchanged and still rejected: a room under two roofs (redundant duplicate vs different design, as before), a span covering another volume's room, a span not tiling a rectangle,
mixed envelope heights. The production veranda conflict (hip/bronze/1 m vs flat/timber/0.8 m) is not decided by software.
The contract text is an addendum paragraph in `CANONICAL_INSTRUCTIONS`; the frozen paragraphs are untouched (`mission.test.ts`).

## Fixtures (developer-authored, not Terra output)

| Fixture | Exercises | Errors | Flush edges | Save / reload / recompile | Browser |
|---|---|---:|---:|---|---|
| compact | flat gallery + hip over one bay | 0 | gallery east, sleep-room west | identical | 5 captures |
| multilevel (rotated 0.4 rad) | gable salon beside a taller stair hall, hips and gables on two storeys | 0 | salon west | identical | 5 captures |
| multi-wing | hip pavilion + gable bar spans, porch and deck room-owned roofs | 0 | porch north, deck west | identical | 5 captures |

15 captures, 0 page errors, no WebGL context loss; rendered element ids, positions and yaw match the scenes. Each fixture was also rendered after being saved to disk and reloaded through `validateScene`.
Façade fixtures (`roofExposure.test.ts`): historical positions kept; doors to a court spread over the court's run (offsets 6.25 / 8.75 m); windows on a wall's remainder; no-run, several-runs and
impossible rhythms rejected with the same text by diagnosis and compiler.

## Genuine architectural decisions that remain (not made by software)

1. **Partial-edge eaves (25 findings on production).** Typical case: a 6 m bedroom with a 4 m bath against part of one edge. Terra must choose: no overhang on that roof, or room alignment so the edge is wholly against the neighbour or wholly clear.
   The plan has no per-edge overhang field and I did not add one (that would put the bookkeeping back on the model).
2. **Façade rhythms with no run that can hold them (6 on production).** Another wall, fewer or narrower bays, or individual openings. Where two runs could each hold a rhythm the rhythm cannot name one, so the plan is rejected.
3. **Which of two different roofs a space gets** (the veranda).
4. **Consequence worth reading:** a flush edge loses its shading on that side, and a pitched roof with a flush edge has one steeper slope there (ridge and rise are unchanged).

## Where I stopped

A stepped eave (flush along the abutting part of an edge, projecting along the rest) is the 25 remaining findings. For pitched roofs it means eave geometry that changes along an edge (valley/junction work);
for flat roofs it would be a profile outline, which the roof/roof, roof/volume and site checks (all rectangle based) would then need to understand. That is the major roof-junction engine you said to stop at; not started.
The cost of that stop is concrete: of the 40 roof findings, 15 are cleared and 25 are not.

## Tests and tooling

`tsc` clean, eslint clean on `src/lib`, the new page and scripts. Full suite: 363 files, 3909 tests pass (27 new in `roofExposure.test.ts`: builders, resolver, fixtures, façades, save/reload).
Existing tests that encoded the old contract were changed, and these are the changes to review: overhang beside a neighbour now compiles flush (`coordination`, `roofAbutment`, `compositions`),
the volume one-roof claim (`composition`, `roofOwnership`, `consolidated`, `route.rejectedPlan`), counts of the production plan (`productionRejected`) and of the 2 Nov saved mansion, 53 → 14 findings
(`revision.test.ts`; the 5 that remain involve overlapping rooms or an eave beside a taller volume that is not wholly against it), and the model-facing construction reference limit 6200 → 6400 characters for the new `eaves` field.

## Not done / caveats

- A scene saved with `eaves` cannot be read by code from before this change (the scene schema is strict). Scenes that never needed a flush edge are unchanged.
- `eaves` is now visible to the scene-edit schema the model sees (about 150 characters), like `fascia`; it is validated (pitched roofs only, each ≤ overhang).
- No production build or deployment was run; browser checks used the local dev server, which I stopped afterwards. No commits, no paid calls, no database access.
- New files: `src/lib/villa/canonical/roofExposure.{test,fixture}.ts`, `src/app/dev/roof-exposure/page.tsx`, two scripts and this directory.
