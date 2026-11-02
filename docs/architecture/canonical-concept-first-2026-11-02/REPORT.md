# Concept-first architecture on the existing canonical path (2026-11-02)

Offline only. No paid AI call, commit, deployment or database access. Retained responses, the failed mansion and every earlier artefact were read, not written. No new generator: `architecturalPlanSchema`, `compileArchitecturalPlan` and `generateCanonical` are the only authoring path, and the provider schema is unchanged.

**No claim is made that any of this makes Terra's architecture better.** What is demonstrated is mechanical: a class of collisions is removed by construction, the rest are explained with verified options, and a concept drawing can be produced before rooms exist. Whether a model designs better with it needs the experiment in section 8.

## 1. Audit: who computes what in `architectural-plan-1`

Placement is already relative, not absolute (`plan.ts` `locate`/`derive`). The model chooses `relativeTo/side/alignment/gap`, and software resolves each room from its **one** anchor. What still falls on the model:

| Quantity | Today | Determined by relationships? |
|---|---|---|
| Room width/depth | chosen | partly: area/proportion are judgement; the *fit* against neighbours is arithmetic |
| Where an unequal room lands against its host (alignment overhang) | model must compute the corner | **yes**, pure arithmetic from sizes |
| Where two chains meet | nothing tells it | **yes**, but only knowable over the whole plan |
| Wings, pavilions | `masses[]` hold a role string; the compiler only checks `relatesTo` exists (`compiler.ts:34`). No geometry. | not representable until now |
| Site width/depth vs pools, lawns (site is centred on the room cells) | chosen; checked afterwards | yes: minimum site is computable |
| Stair run vs cell depth, upper cell above lower | chosen; checked afterwards | partly |
| Roof overhang vs neighbour reach | chosen | yes, given neighbour heights |
| Door/window position, wall, level datums, envelope height, risers | **already derived** (`coordination.ts`, `derive`) | done |

**Why hosted doors work but chains still collide.** A door position is a function of two *already placed* rectangles: their shared segment. `placePortal` only reads rectangles. A room position is a function of the *whole arrangement*, and non-overlap is a constraint over every pair of rooms. The contract expresses pairwise relations ("A east of B") and resolves them by forward evaluation from one anchor each; nothing expresses "and keep clear of everything else". `compileBuilding` detects the overlap afterwards (`compiler.ts:44`) and `diagnosePlan` reports it. Neither moves a room, by design. In the redesign call the model also had no way to see its own new plan's extents before returning it (`canonical-redesign-revision-2026-11-02/RESULT.md`).

## 2–3. Concept-first, and what software can own

The cheapest real concept-first step the repository allows is to give the plan a vocabulary for wings, because the schema already groups every space into a mass.

**Implemented: wing anchors.** `relativeTo` may name a mass id. The anchor is then the bounding rectangle of every space in that mass ([massAnchor.ts](../../../src/lib/villa/canonical/massAnchor.ts)). A hall, pool or lawn is placed *beside a wing* without the model finding the wing's corners; resize the wing and the neighbour follows. Cycles, "same" stacking onto a wing and anchoring a room to its own wing are rejected with a precise message. A mass id used to be an unresolvable reference, so no existing plan changes meaning; the two retained mansions that name only spaces resolve identically (test). Wired into `derive` (compile), the diagnosis, pools and landscape.

**Mathematically determined, software may own:** rectangle resolution; wing envelopes; separation and non-overlap checks; shared-wall lengths and opening positions; level datums and envelope heights; the minimum gap or alignment that clears a given overlap; what moves when a room moves; minimum site.
**Architectural judgement, stays with the AI:** the parti, wing hierarchy and which wing is beside which; arrival sequence; privacy grouping; orientation and views; room sizes and programme; vertical idea; roof and façade identity; and, when relationships conflict, *which wing yields*. Software does not choose. `explainCollisions` ([arrangement.ts](../../../src/lib/villa/canonical/arrangement.ts)) returns, per collision, the measured cause, the single placement edits that would clear it (each verified by re-resolving the whole plan, with the new collisions it would create and the dependants it would move) and an explicit statement that this is a decision. Nothing is applied; nothing is silently fitted. The diagnosis findings now carry that text.

**Limits.** A wing's bounding rectangle is conservative: an L-shaped wing's notch cannot be tucked into by a wing anchored to it (use a room anchor there). Two wings anchored on adjacent sides of one wing can still meet at the corner; that is the same class, now at wing level, and is detected and explained the same way (test). Wing anchoring prevents the class only where it is used.

## 4. Visual concept feedback

`renderConceptSvg` draws wing envelopes only (no rooms), outdoor allocations, arrival and scale from the same resolved placements the compiler uses. A concept is therefore *a plan whose wings are single placeholder spaces*, already valid canonical data, drawable before any room exists. `conceptDrift` then measures how an elaborated plan's wing envelopes depart from the concept (size and relative position), without altering either. `compositionOf` reports measurements of a parti (spine, bilateral hosts, mirror share, repeated cells, footprint fill, chain depth). These are measurements, not beauty scores: a pinwheel and a courtyard differ numerically; that does not make either better. Drawings: [diagrams/](diagrams/).

## 5. Existing evidence (read-only)

[evidence.json](evidence.json), four retained mansion proposals (the corrected mansion, the original and Terra's response in `canonical-plan-revision`, and the redesign revision):

| Plan | Spaces | Collisions | Between wings | Single-edit options exist |
|---|---:|---:|---|---:|
| corrected mansion | 30 | 6 | main-house × upper-retreat (6) | 4 of 6 side-effect free |
| plan-revision original (courtyard estate) | 21 | 3 | service × west-suite-wing (3) | 3 of 3 |
| plan-revision response (belvedere; also the redesign's starting plan) | 33 | 1 | east-suite-wing × social (1) | 1 of 1 |
| **redesign revision (22 findings)** | 21 | 9 | social × cloisters (6), service × west (2), arrival × west (1) | 9 of 9 |

Common factors, all measured:
- **19 of 19 collisions lie between rooms of two different wings.** None is inside a wing. The wings are exactly what the contract cannot express.
- Each plan has the same skeleton: one spine room carrying 3–4 dependants (foyer / central-gallery / entry-hall), bilateral hosts (rooms east *and* west of one host), a group of 5–6 identically sized indoor cells (8×5, 7×7, 9×6, 10×6), chain depth 6, and a mirror share of 0.24–0.76.
- In the redesign, two collisions are the textbook corner overhang (salon vs each 4×20 hall, both anchored to the gallery, each larger than it along the other's axis); the other seven are consequences of those halls and their suites cutting through the social and service bands.

**Why revisions keep the same composition.** Measured: the redesign retains the entry-hall root, central gallery spine, salon to the south, east and west halls, six 10×6 suites. Plausible mechanisms, not tested: (a) the root and spine are the coordinate system of every chain, so a different parti means re-deriving all chains while local edits cost one line each; (b) the revision request supplies the whole current plan, extents and drawing, which anchors; (c) with no wing vocabulary, a "bedroom wing" can only be said as a hall with rooms chained to it, the same idiom as before; (d) `RESULT.md` records that the redesign went single-storey with flat roofs, possibly from the retained caution against adding storeys (also untested).

## 6. Options and recommendation

| | What it costs | What it fixes | What it does not |
|---|---|---|---|
| **A** continue absolute-coordinate generation and paid revisions | US$0.15 per call (measured) | nothing structural; two calls on one parti ended in the same class | everything |
| **B** geometry feedback step | a second paid call per generation; message work (largely done: findings now carry cause and options) | repairs; the model sees measured extents | conception; the model still does the arithmetic and cannot express wings |
| **C** concept decisions separated from deterministic arrangement, compiled through canonical | wing anchors (**done**, ~40 lines in the compiler path); then a two-stage route | removes the cross-wing class by construction where used; makes wing-level decisions explicit and drawable | needs the two-stage route and an experiment to know whether Terra uses it well |

**Recommendation: C, in increments, starting with what is already in.** The implemented step is small, additive and safe. Next, still one paid call and no new route: a controlled run of the existing one-call generation with the wing-first guidance now in `CANONICAL_INSTRUCTIONS`. Only if the model ignores wing anchors should the two-stage route be built.

**Two-stage route, scope reported not built** (≈400–700 lines plus prompts and tests): a concept schema (wings, relationships, levels, arrival, outdoor allocations) as a *constrained subset of the canonical plan*, a first call, deterministic arrangement through the code already added, a concept diagram and drift report, then a second call elaborating rooms inside each wing and compiled by the unchanged compiler. Trade-offs: two provider calls (cost and latency), a new request mode in `generateCanonical`, a strict provider schema for the concept, and the open question whether concept approval improves anything without a human or visual review in the loop.

**Operational note.** `CANONICAL_INSTRUCTIONS` changed, and revision requests embed it. Any prepared-but-unsubmitted request (the `*.NOT-SUBMITTED.json` files) no longer matches its recorded hash and must be regenerated and re-approved before it is sent.

## 7. Offline evidence for the implemented step

Developer-authored fixtures, [arrangement.fixture.ts](../../../src/lib/villa/canonical/arrangement.fixture.ts): four different concept arrangements (linear bar with offset pavilion, asymmetric courtyard U, asymmetric pinwheel, bilateral spine), plus a two-wing house that **compiles through the unchanged canonical compiler**, passes `physicalEvidence`, is reachable and deterministic.
- The retained parti, rebuilt as a fixture, reproduces the corner-overhang collision from sizes alone (`salon/east-hall`, host gallery); changing *only* the anchor from the gallery to its wing removes it (diagrams `fixture-spine-room-anchored` and `fixture-spine-wing-anchored`).
- Property sweep, 2,000 random size sets (halls 3–5×12–26 m, salon 10–22×8–14 m, gallery 6–12×6–14 m, seed 20261102): room-anchored collides in 1,943; wing-anchored has **0** cross-wing collisions. This is a *stress range*, not a base rate for Terra, and the zero is a property of the construction (a neighbour starts at the wing's edge), not evidence of good design.
- Every option offered for a collision is re-verified to clear it alone, with side effects listed; the plan is unchanged afterward (test).
- Tests: 250 canonical tests pass (17 new), 1,154 in `src/lib/villa` and `src/app/api/ai`; typecheck and ESLint clean. Existing diagnosis, roof, site-anchor and revision tests pass unchanged.
- Reproduce: `npx vitest run src/lib/villa/canonical` and `npx vite-node --config vitest.config.mts scripts/canonical-arrangement-offline.ts`.

## 8. A controlled experiment that could show real improvement

Same brief set (including the mansion brief), same model, same reasoning effort, same token ceiling, zero retries, N ≥ 5 per cell:
1. Control: previous instructions. 2. Wing-first guidance with wing anchors (one call). 3. (Only if 2 is promising) the two-stage route.

Pre-register the measures: hard-gate pass rate and collision counts (mechanical); fraction of placements that use wing anchors; wing-level composition spread via `compositionOf` (variety, symmetry, repeated cells, reported as measurements); and, separately, blind comparison of rendered plans and exteriors by people against the brief. Numerical variety is not evidence of beauty; only the human comparison can speak to that, and a mock or fixture result must never be counted.

## Files

New: `massAnchor.ts`, `arrangement.ts`, `arrangement.fixture.ts`, `arrangement.test.ts`, `scripts/canonical-arrangement-offline.ts`, this directory. Edited: `plan.ts` (wing anchors in `derive`, site items, planner guidance), `diagnose.ts` (wing anchors; volumes now use the shared collision definition and append cause and options). `plan.ts` and `diagnose.ts` had no earlier uncommitted changes; the user's other in-progress edits were left alone.
